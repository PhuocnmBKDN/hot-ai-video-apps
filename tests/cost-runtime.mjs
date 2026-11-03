import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
const mf=new Miniflare({scriptPath:resolve('dist/hot_ai_drama/index.js'),modules:true,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{PLAYBACK_SECRET:'ab'.repeat(32)}});
try{
await mf.ready;const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('BUCKET');
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('drizzle/'+f,'utf8').replace(/--[^\r\n]*/g,'').replace(/[\r\n]+/g,' '));
await db.prepare("INSERT INTO series(id,title,description,genre,total,published,created_at,paid_from) VALUES('f','Fixture','','Test',0,1,1,100)").run();
await db.prepare("INSERT INTO episodes VALUES('e','f',1,'Episode','episodes/e.mp4')").run();
await bucket.put('episodes/e.mp4','0123456789',{httpMetadata:{contentType:'video/mp4'}});await bucket.put('previews/f.jpg','fixture-image',{httpMetadata:{contentType:'image/jpeg'}});
const origin='https://test.local';const call=(path,init)=>mf.dispatchFetch(origin+path,init);
let response=await call('/api/catalog?size=1&page=1');assert.equal(response.status,200);const catalog=await response.json();assert.equal(catalog.total,1);assert.equal(catalog.films[0].total,1);assert.equal(catalog.films[0].episodes,undefined);
const detail=await (await call('/api/film?id=f')).json();assert.equal(detail.film.episodes[0].id,'e');assert.equal(detail.film.total,1);
for(let i=0;i<2;i++){response=await call('/api/poster/f?v=1');assert.equal(response.status,200);assert.equal(await response.text(),'fixture-image')}
await db.prepare("UPDATE series SET published=0 WHERE id='f'").run();assert.equal((await call('/api/poster/f?v=1')).status,404);assert.equal((await call('/api/film?id=f')).status,404);
console.log('PASS real Worker/D1/R2: compact paged catalog, lazy film details, repeated artwork delivery and immediate unpublish enforcement.');
}finally{await mf.dispose()}
