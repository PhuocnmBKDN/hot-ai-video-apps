// Run only against a disposable local Worker; never accepts a production URL.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import ts from 'typescript';
import {Miniflare} from 'miniflare';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5188';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('Local disposable Worker only');
const mf=new Miniflare({scriptPath:resolve('dist/hot_ai_drama/index.js'),modules:true,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],host:'127.0.0.1',port:Number(new URL(origin).port)});
try{
await mf.ready;
const db=await mf.getD1Database('DB');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('drizzle/'+file,'utf8').replace(/--[^\r\n]*/g,'').replace(/[\r\n]+/g,' '));
const media=readFileSync(process.env.TEST_MEDIA),poster=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6oN8AAAAASUVORK5CYII=','base64');
const source=ts.transpileModule(readFileSync('lib/password-proof.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {passwordProof}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const username='qa_'+crypto.randomUUID().replaceAll('-','').slice(0,16),clientSalt=crypto.randomUUID().replaceAll('-','').repeat(2),passwordProofValue=await passwordProof(crypto.randomUUID().slice(0,24),clientSalt);
const registered=await fetch(origin+'/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username,clientSalt,scheme:'client600k-server100k',passwordProof:passwordProofValue})});assert.equal(registered.status,200);
const cookie=registered.headers.get('set-cookie').split(';')[0];
const denied=await fetch(origin+'/api/admin/imports',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);
await db.prepare("UPDATE accounts SET role='admin' WHERE username=?").bind(username).run();
const hash=async bytes=>Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex'),videoHash=await hash(media),posterHash=await hash(poster);
const id='9'+Date.now(),root='/api/admin/imports';
async function call(path,value,headers={}){const res=await fetch(origin+root+path,{method:value===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json',...headers},...(value===undefined?{}:{body:Buffer.isBuffer(value)?value:JSON.stringify(value)})});return {status:res.status,body:await res.json()}}
const meta={sourceId:id,variant:'runtime',expected:2,title:'Runtime English title',description:'Giới thiệu tiếng Việt cho phim kiểm thử.'};
const created=await call('',meta);assert.equal(created.status,200,JSON.stringify(created));
assert.equal((await call('/'+id+'/poster',poster,{'Content-Type':'image/png','X-Content-SHA256':posterHash})).status,200);
const headers={'Content-Type':'video/mp4','X-Content-SHA256':videoHash};
assert.equal((await call('/'+id+'/episodes/1',media,{...headers,'X-Content-SHA256':'0'.repeat(64)})).status,503,'Real R2 rejects wrong checksum');
assert.equal((await call('/'+id+'/episodes/1')).body.uploaded,false);
const first=await call('/'+id+'/episodes/1',media,headers);assert.equal(first.status,200,JSON.stringify(first));
assert.equal((await call('/'+id+'/episodes/1',media,headers)).body.alreadyUploaded,true);
const confirm={posterSha256:posterHash,episodes:[1,2].map(number=>({number,sha256:videoHash,size:media.length}))};
assert.equal((await call('/'+id+'/complete',confirm)).status,409);
assert.equal((await call('/'+id+'/episodes/2',media,headers)).status,200);
assert.equal((await call('/'+id+'/complete',confirm)).body.complete,true);
const publicCatalog=await (await fetch(origin+'/api/catalog')).json();assert(!publicCatalog.films.some(f=>f.id===created.body.seriesId));
const admin=await (await fetch(origin+'/api/admin',{headers:{Cookie:cookie}})).json();const film=admin.series.find(f=>f.id===created.body.seriesId);assert.equal(film.title,meta.title);assert.equal(film.description,meta.description);assert.equal(film.published,0);
const receipt=(await call('/'+id)).body.episodes[0];
const actual=await fetch(origin+'/api/video/'+receipt.id,{headers:{Cookie:cookie}});assert.equal(actual.status,200);assert.equal(await hash(await actual.arrayBuffer()),videoHash);
const image=await fetch(origin+'/api/poster/'+film.id,{headers:{Cookie:cookie}});assert.equal(await hash(await image.arrayBuffer()),posterHash);
if(process.env.TEST_DESKTOP_PROBE){const run=spawnSync(process.env.TEST_DESKTOP_PROBE,[process.env.TEST_DESKTOP_ROOT,resolve(process.env.TEST_MEDIA)],{input:cookie.split('=')[1],encoding:'utf8'});assert.equal(run.status,0,run.stderr+run.stdout);console.log(run.stdout.trim());}
console.log('PASS real local Worker + D1 + R2: authenticated import, checksum rejection, retries, complete set, private draft, exact playback bytes and poster.');
}finally{await mf.dispose()}
