import {catalog as catalogModule,metadata} from './cost-modules.mjs';
globalThis.__catalog=catalogModule;globalThis.__metadata=metadata;
import {requestBodyModule} from './request-body-module.mjs';
globalThis.__requestBody=requestBodyModule;
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
const objects=new Map();let r2Heads=0,r2Deletes=0;
let preparedCalls=0;const db={prepare(sql){preparedCalls++;let args=[];const q={bind(...a){args=a;return q},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){return sqlite.prepare(sql).run(...args)}};return q},async batch(list){sqlite.exec('BEGIN');try{const out=[];for(const q of list)out.push(await q.run());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}}};
globalThis.__testEnv={DB:db,ADMIN_EMAIL:'owner@test.local',BUCKET:{async head(k){r2Heads++;return objects.has(k)?{size:objects.get(k).length}:null},async get(k,options){const body=objects.get(k);if(!body)return null;const r=options?.range;return {body:r?body.subarray(r.offset,r.offset+r.length):body,size:body.length,httpMetadata:{contentType:'video/mp4'}}},async put(k,v){objects.set(k,Buffer.from(await new Response(v).arrayBuffer()));return {size:objects.get(k).length}},async delete(k){r2Deletes++;for(const key of Array.isArray(k)?k:[k])objects.delete(key)}}};globalThis.__testUser=null;
let source=readFileSync('app/api/[...path]/route.ts','utf8').replace("import {catalogBase} from '../../../server/catalog';","const {catalogBase}=globalThis.__catalog;").replace("import {mediaMetadata,forgetMediaMetadata} from '../../../server/media-metadata';","const {mediaMetadata,forgetMediaMetadata}=globalThis.__metadata;").replace("import {readBytes,readObject,validImage} from '../../../lib/request-body';","const {readBytes,readObject,validImage}=globalThis.__requestBody;").replace("import {issuePlayback,validatePlayback,playbackControl,foreignMedia} from '../../../server/playback';","const validatePlayback=async()=>null;const foreignMedia=()=>false;const issuePlayback=()=>new Response('{}');const playbackControl=()=>new Response('{}');").replace("import {GENRES} from '../../../lib/genres';","const GENRES=['Tình cảm','Test'];").replace("import { env } from 'cloudflare:workers';","const env=globalThis.__testEnv;").replace("import {media} from '../../../server/media';","const media=()=>env.BUCKET;").replace("import { currentUser } from '../../../server/auth';","const currentUser=async()=>globalThis.__testUser;");
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const api=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const origin='https://test.local';async function call(path,body,headers={}){const r=new Request(origin+'/api/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json','Origin':origin}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});const res=await api.GET(r);return {status:res.status,body:res.headers.get('content-type')?.includes('json')?await res.json():await res.text()}}
const owner={userId:'owner',email:'owner@test.local',role:'admin'};const alice={userId:'alice',email:'alice@test.local'};const bob={userId:'bob',email:'bob@test.local'};
assert.equal((await call('admin')).status,403);
globalThis.__testUser=owner;assert.equal((await call('admin/series',{title:'Test',genre:'Bí ẩn',description:'Test',paidFrom:0})).status,400);
await call('admin/series',{title:'Test',genre:'Bí ẩn',description:'Test',paidFrom:4});const film=sqlite.prepare('SELECT * FROM series').get();assert(film);
assert.equal((await call('admin/publish',{id:film.id,publish:true})).status,400,'Film without episode 1 must not publish');
sqlite.prepare('INSERT INTO episodes VALUES(?,?,?,?,?)').run('early',film.id,1,'First','early');
assert.equal((await call('admin/publish',{id:film.id,publish:true})).status,200,'Film can publish while later episodes are still pending');
assert.equal((await call('catalog')).body.films[0].episodes.length,1);
globalThis.__testUser=null;assert.equal((await call('series-view',{seriesId:film.id})).status,200);assert.equal(sqlite.prepare('SELECT view_count FROM series WHERE id=?').get(film.id).view_count,1,'Opening a published film increments its view count');
for(const period of ['day','week','month','year']){const ranking=await call('rankings?period='+period);assert.equal(ranking.status,200);assert.equal(ranking.body.rows.find(r=>r.series_id===film.id).views,1)}assert.equal((await call('rankings?period=bad')).status,400);globalThis.__testUser=owner;
sqlite.prepare('DELETE FROM episodes WHERE id=?').run('early');
for(let n=1;n<=12;n++){sqlite.prepare('INSERT INTO episodes VALUES(?,?,?,?,?)').run('e'+n,film.id,n,'Ep '+n,'v'+n);objects.set('v'+n,Buffer.from('test-video'))}
assert.equal((await call('admin/publish',{id:film.id,publish:true})).status,200);
globalThis.__testUser=null;assert.equal((await call('video/e3')).status,200);assert.equal((await call('video/e4')).status,401);
globalThis.__testUser=alice;assert.equal((await call('video/e4')).status,403);assert.equal((await call('orders',{seriesId:film.id})).status,503,'No QR means no checkout');
sqlite.prepare('INSERT INTO settings VALUES(?,?)').run('qr','payment/qr');assert.equal((await call('orders',{seriesId:film.id})).status,503,'QR without recipient must not enable checkout');sqlite.prepare('INSERT INTO settings VALUES(?,?)').run('payment_recipient',JSON.stringify({bank:'Test bank',account:'0123456789',name:'TEST RECIPIENT'}));const order=await call('orders',{seriesId:film.id});assert.equal(order.status,200);assert.equal((await call('orders',{seriesId:film.id})).body.id,order.body.id,'Pending order reused');
assert.equal((await call('admin/confirm',{id:order.body.id,reference:'bank1'})).status,403,'Customer cannot self-confirm');
globalThis.__testUser=owner;assert.equal((await call('admin/confirm',{id:order.body.id,reference:'bank1'},{Origin:'https://evil.local'})).status,403);
assert.equal((await call('admin/confirm',{id:order.body.id,reference:'bank1'})).status,200);assert.equal((await call('admin/confirm',{id:order.body.id,reference:'bank1'})).status,200);
globalThis.__testUser=alice;assert.equal((await call('video/e12')).status,200);
globalThis.__testUser=bob;assert.equal((await call('video/e4')).status,403,'Grant belongs only to purchaser');const order2=await call('orders',{seriesId:film.id});globalThis.__testUser=owner;assert.equal((await call('admin/confirm',{id:order2.body.id,reference:'bank1'})).status,400,'Bank reference cannot be reused');
globalThis.__testUser=bob;assert.equal((await call('video/e4')).status,403);assert.equal((await call('orders')).body.orders.length,1,'Users see only own orders');
const catalog=(await call('catalog')).body;assert.equal(catalog.films[0].buyers,1);assert.equal(catalog.films[0].unlocked,false);assert(!JSON.stringify(catalog).includes('object_key'));
console.log('PASS: guest/paywall boundary, owner authorization, CSRF, serialized publishing, QR gate, pending order reuse, payment idempotency, cross-user isolation, duplicate bank reference, private object keys.');

globalThis.__testUser=owner;
assert.equal((await call('admin/series',{title:'One-episode preview',genre:'Bản thử',description:'Free preview',paidFrom:2})).status,200);
const preview=sqlite.prepare("SELECT * FROM series WHERE title='One-episode preview'").get();sqlite.prepare('INSERT INTO episodes VALUES(?,?,?,?,?)').run('preview1',preview.id,1,'Preview','preview-video');objects.set('preview-video',Buffer.from('preview'));
assert.equal((await call('admin/publish',{id:preview.id,publish:true})).status,200);
globalThis.__testUser=null;assert.equal((await call('video/preview1')).status,200,'One-episode preview is free');
globalThis.__testUser=alice;assert.equal((await call('orders',{seriesId:preview.id})).status,200,'Whole-film purchase covers future locked episodes');
console.log('PASS: single-episode preview publishing, free playback and future-episode purchase.');

globalThis.__testUser=owner;
const beforeAdminOrder=sqlite.prepare('SELECT count(*) AS n FROM orders').get().n;
const adminCatalog=(await call('catalog')).body;
assert(adminCatalog.films.every(f=>f.unlocked&&f.adminAccess),'Admin gets all published films unlocked in catalog');
assert.equal((await call('me')).body.user.role,'admin');
assert.equal((await call('video/e12')).status,200,'Admin streams final paid episode without grant');
sqlite.prepare("DELETE FROM settings WHERE key='qr'").run();
assert.equal((await call('orders',{seriesId:film.id})).body.alreadyUnlocked,true,'Admin never needs checkout even with no QR');
assert.equal(sqlite.prepare('SELECT count(*) AS n FROM orders').get().n,beforeAdminOrder,'Admin access creates no order or revenue');
globalThis.__testUser=bob;
assert.equal((await call('me')).body.user.role,'viewer');
assert.equal((await call('catalog')).body.films.find(f=>f.id===film.id).unlocked,false);
assert.equal((await call('video/e12')).status,403);
assert.equal((await call('admin')).status,403);
assert.equal((await call('admin/series',{title:'Spoofed admin',genre:'Test',description:'Test',total:4})).status,403);
console.log('PASS: admin catalog, full free playback, checkout bypass without orders, viewer paywall and upload authorization.');

// Only admin can change the recipient; QR upload alone is insufficient.
globalThis.__testUser=bob;assert.equal((await call('admin/payment',{bank:'Fake',account:'0123456789',name:'Imposter'})).status,403);
globalThis.__testUser=owner;assert.equal((await call('admin/payment',{bank:'Bank',account:'not-an-account',name:'NAME'})).status,400);
assert.equal((await call('admin/payment',{bank:'Test bank',account:'01991855501',name:'TEST NAME'})).status,200);
const paymentCatalog=(await call('catalog')).body;assert.equal(paymentCatalog.recipient.account,'01991855501');assert.equal(paymentCatalog.checkoutReady,false,'No QR remains fail-closed');
console.log('PASS: payment recipient authorization, account validation, QR plus recipient checkout gate.');

// Wallet purchases must debit and grant together; amount is always server-owned.
globalThis.__testUser=bob;
assert.equal((await call('wallet/buy',{seriesId:film.id,amount:0})).status,409);
assert.equal((await call('video/e12')).status,403);
assert.equal((await call('wallet')).body.balance,0);
globalThis.__testUser=owner;
assert.equal((await call('admin/edit',{id:film.id,title:'Edited film',genre:'Test',description:'Edited',paidFrom:4,price:19000})).status,200);
assert.equal((await call('admin/edit',{id:film.id,title:'Invalid',genre:'Test',description:'',paidFrom:0,price:19000})).status,400,'Cannot configure invalid paywall');
assert.equal((await call('admin/edit',{id:film.id,title:'Invalid',genre:'Test',description:'',paidFrom:4,price:-1})).status,400);
sqlite.prepare("INSERT INTO wallet_ledger VALUES(?,?,?,?,?,?)").run('seed-bob','bob',30000,'deposit','seed',Date.now());
globalThis.__testUser=bob;
assert.equal((await call('wallet/buy',{seriesId:film.id,amount:1})).status,200);
assert.equal((await call('wallet')).body.balance,11000,'Deduct actual configured price');
assert.equal((await call('video/e12')).status,200);
assert.equal((await call('wallet/buy',{seriesId:film.id})).status,200);
assert.equal((await call('wallet')).body.balance,11000,'Repeat purchase never double debits');
const carol={userId:'carol',email:'carol@test.local'};globalThis.__testUser=carol;
assert.equal((await call('video/e12')).status,403);
assert.equal((await call('wallet')).body.ledger.length,0,'Wallet private');
assert.equal((await call('wallet/buy',{seriesId:film.id},{Origin:'https://evil.local'})).status,403);
sqlite.prepare("INSERT INTO settings VALUES('qr','payment/qr')").run();
const deposit=(await call('wallet/deposit',{amount:20000})).body;
assert(deposit.id.startsWith('NAP'));
assert.equal((await call('wallet/deposit',{amount:-20000})).status,400);
assert.equal((await call('wallet/deposit',{amount:10000.5})).status,400);
const pngFixture=text=>Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13]),Buffer.from(text)]);
const upload=async(id,bytes)=>api.POST(new Request(origin+'/api/wallet/receipt?id='+id,{method:'POST',headers:{Origin:origin,'Content-Type':'image/png'},body:bytes}));
assert.equal((await upload(deposit.id,pngFixture('receipt-fixture'))).status,200);
assert.equal((await call('wallet')).body.balance,0,'Upload alone never credits money');
assert.equal((await call('admin/deposit-confirm',{id:deposit.id,reference:'TRANSFER20'})).status,403);
assert.equal((await call('admin/receipt/'+deposit.id)).status,403);
globalThis.__testUser=bob;
assert.equal((await upload(deposit.id,Buffer.from('another-image'))).status,404,'Cross-account receipt upload denied');
globalThis.__testUser=owner;
assert.equal((await call('admin/deposit-confirm',{id:deposit.id,reference:'TRANSFER20'})).status,200);
assert.equal((await call('admin/deposit-confirm',{id:deposit.id,reference:'TRANSFER20'})).status,200);
assert.equal((await call('admin/receipt/'+deposit.id)).status,200);
globalThis.__testUser=carol;
assert.equal((await call('wallet')).body.balance,20000,'Approved deposit credited once');
const duplicate=(await call('wallet/deposit',{amount:20000})).body;
assert.equal((await upload(duplicate.id,pngFixture('receipt-fixture'))).status,400,'Exact receipt cannot be reused');
assert.equal((await upload(duplicate.id,pngFixture('different-receipt'))).status,200);
globalThis.__testUser=owner;
assert.equal((await call('admin/deposit-confirm',{id:duplicate.id,reference:'TRANSFER20'})).status,400,'Bank reference cannot be credited twice');
assert.equal((await call('admin/deposit-reject',{id:duplicate.id})).status,200);
assert.equal((await call('admin/deposit-confirm',{id:duplicate.id,reference:'TRANSFER21'})).status,400,'Rejected receipt cannot credit');
globalThis.__testUser=carol;
assert.equal((await call('wallet/buy',{seriesId:film.id})).status,200);
assert.equal((await call('wallet')).body.balance,1000);
assert.equal((await call('video/e12')).status,200);
globalThis.__testUser=owner;
const beforeWallet=(await call('wallet')).body.balance;
assert.equal((await call('wallet/buy',{seriesId:film.id})).body.alreadyUnlocked,true);
assert.equal((await call('wallet')).body.balance,beforeWallet);
console.log('PASS: configured film price, atomic wallet debit/grant, insufficient balance, repeated buy, private wallets/receipts, CSRF, deposit review, duplicate receipts/references, rejection, admin free.');

globalThis.__testUser={userId:'dave',email:'dave@test.local'};
sqlite.prepare('INSERT INTO wallet_ledger VALUES(?,?,?,?,?,?)').run('seed-dave','dave',50000,'deposit','seed-dave',Date.now());
assert.equal((await call('wallet/buy',{seriesId:film.id,expectedPrice:10000})).status,409,'Price changes require confirmation');
assert.equal((await call('wallet')).body.balance,50000);
const failingBatch=globalThis.__testEnv.DB.batch;
globalThis.__testEnv.DB.batch=async function(list){return failingBatch.call(this,[...list,this.prepare('INSERT INTO table_that_does_not_exist VALUES(1)')])};
assert.equal((await call('wallet/buy',{seriesId:film.id,expectedPrice:19000})).status,503);
globalThis.__testEnv.DB.batch=failingBatch;
assert.equal((await call('wallet')).body.balance,50000,'Failed transaction rolls back wallet debit');
assert.equal((await call('video/e12')).status,403,'Failed transaction never grants access');
console.log('PASS: changed-price confirmation and rollback on database failure.');

globalThis.__testUser=owner;
assert.equal((await call('admin/edit',{id:film.id,title:'Edited film',genre:'Test',description:'Edited',paidFrom:2,price:19000})).status,200);
globalThis.__testUser=null;assert.equal((await call('video/e1')).status,200);assert.equal((await call('video/e2')).status,401);
globalThis.__testUser=bob;assert.equal((await call('video/e2')).status,200,'Existing buyer retains access after threshold change');
assert.equal((await call('catalog')).body.films.find(f=>f.id===film.id).total,12,'Catalog reports uploaded count');
console.log('PASS: configurable paywall boundary and retained purchase access.');
globalThis.__testUser=alice;assert.equal((await call('admin/delete-episodes',{seriesId:film.id,ids:['e1']})).status,403);
globalThis.__testUser=owner;assert.equal((await call('admin/delete-episodes',{seriesId:film.id,ids:['preview1']})).status,409,'Cannot delete another film episode');
assert.equal((await call('admin/delete-episodes',{seriesId:film.id,ids:['e1','e2']})).status,200);assert(!objects.has('v1'));assert(!objects.has('v2'));assert.equal(sqlite.prepare('SELECT number FROM episodes WHERE id=?').get('e3').number,3,'Remaining episode numbers stay unchanged');
assert.equal((await call('admin/delete-film',{id:film.id,confirmTitle:'wrong'})).status,400);
const orderCount=sqlite.prepare('SELECT count(*) AS n FROM orders WHERE series_id=?').get(film.id).n;const originalDelete=globalThis.__testEnv.BUCKET.delete;globalThis.__testEnv.BUCKET.delete=async()=>{throw Error('Storage temporarily unavailable')};
assert.equal((await call('admin/delete-film',{id:film.id,confirmTitle:'Edited film'})).status,200);assert(sqlite.prepare('SELECT count(*) AS n FROM media_cleanup').get().n>0,'Failed storage deletions queued for retry');
assert(!(await call('catalog')).body.films.some(f=>f.id===film.id));assert.equal((await call('video/e3')).status,404);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM orders WHERE series_id=?').get(film.id).n,orderCount,'Payment history retained');
globalThis.__testEnv.BUCKET.delete=originalDelete;await api.cleanupMedia();assert.equal(sqlite.prepare('SELECT count(*) AS n FROM media_cleanup').get().n,0);
console.log('PASS: admin-only scoped episode deletion, title confirmation, hidden deleted films, preserved payment history, retryable media cleanup.');
for(const u of [alice,bob])sqlite.prepare('INSERT OR IGNORE INTO accounts(id,username,password_hash,created_at) VALUES(?,?,?,?)').run(u.userId,u.userId,'test-only',0);
sqlite.prepare('UPDATE series SET paid_from=1 WHERE id=?').run(preview.id);
globalThis.__testUser=alice;assert.equal((await call('admin/free-access',{seriesId:preview.id,username:'alice'})).status,403);assert.equal((await call('video/preview1')).status,403);
globalThis.__testUser=owner;assert.equal((await call('admin/free-access',{seriesId:preview.id,username:'missing'})).status,404);assert.equal((await call('admin/free-access',{seriesId:preview.id,username:'alice'})).status,200);
globalThis.__testUser=alice;assert.equal((await call('video/preview1')).status,200);assert((await call('catalog')).body.films.find(f=>f.id===preview.id).unlocked);const beforeFreeBuy=(await call('wallet')).body.balance;assert((await call('wallet/buy',{seriesId:preview.id})).body.alreadyUnlocked);assert.equal((await call('wallet')).body.balance,beforeFreeBuy);
globalThis.__testUser=owner;assert.equal((await call('admin/free-access',{seriesId:preview.id,previousUsername:'alice',username:'bob'})).status,200);
globalThis.__testUser=alice;assert.equal((await call('video/preview1')).status,403);globalThis.__testUser=bob;assert.equal((await call('video/preview1')).status,200);
sqlite.prepare('INSERT INTO grants VALUES(?,?,?,?)').run('paid-preview','bob',preview.id,'paid-test');globalThis.__testUser=owner;await call('admin/free-access',{seriesId:preview.id,username:'bob',remove:true});globalThis.__testUser=bob;assert.equal((await call('video/preview1')).status,200,'Removing gift access never removes purchased access');
console.log('PASS: film-specific free access, username validation, admin-only add/edit/revoke, no wallet charge, purchased access preserved.');
globalThis.__testUser=owner;assert.equal((await call('admin/user-role',{username:'missing',role:'vip'})).status,404);assert.equal((await call('admin/user-role',{username:'alice',role:'vip'})).status,200);assert.equal(sqlite.prepare('SELECT vip FROM accounts WHERE id=?').get('alice').vip,1);
globalThis.__testUser={...alice,role:'vip'};assert.equal((await call('video/preview1')).status,200);assert.equal((await call('admin')).status,403);assert.equal((await call('admin/user-role',{username:'bob',role:'admin'})).status,403);assert((await call('wallet/buy',{seriesId:preview.id})).body.alreadyUnlocked);
globalThis.__testUser=owner;assert.equal((await call('admin/user-role',{username:'alice',role:'admin'})).status,200);assert.equal(sqlite.prepare('SELECT role FROM accounts WHERE id=?').get('alice').role,'admin');
console.log('PASS: existing-user role changes, VIP playback/purchase bypass, VIP admin denial, missing username validation.');
globalThis.__testUser=owner;await call('admin/series',{title:'Draft visibility fixture',genre:'Test',description:'Test',paidFrom:2});const draft=sqlite.prepare("SELECT id FROM series WHERE title='Draft visibility fixture'").get();
assert(!(await call('catalog')).body.films.some(f=>f.id===draft.id));assert((await call('catalog?drafts=1')).body.films.some(f=>f.id===draft.id&&f.published===0));
for(const u of [null,alice,{...bob,role:'vip'}]){globalThis.__testUser=u;assert(!(await call('catalog?drafts=1')).body.films.some(f=>f.id===draft.id),'Non-admin cannot request draft catalog')}
console.log('PASS: drafts hidden by default and exposed only by explicit admin toggle, never to viewers or VIP.');

for(const u of [null,bob,{...bob,role:'vip'}]){globalThis.__testUser=u;assert.equal((await call('admin/user-activity?username=alice')).status,403)}
globalThis.__testUser=owner;
assert.equal((await call('admin/user-activity?username=missing')).status,404);
for(const section of ['ledger','purchased','watched']){const result=await call('admin/user-activity?username=alice&section='+section+'&size=1');assert.equal(result.status,200);assert(result.body.rows.length<=1);assert(!JSON.stringify(result.body).includes('password_hash'))}
const depositsOnly=(await call('admin/user-activity?username=alice&kind=deposit')).body;assert(depositsOnly.rows.every(r=>r.amount>0));
const spendsOnly=(await call('admin/user-activity?username=alice&kind=purchase')).body;assert(spendsOnly.rows.every(r=>r.amount<0));
globalThis.__testUser=bob;assert.equal((await call('watch-history',{episodeId:'preview1',position:12,completed:false})).status,200);
globalThis.__testUser=owner;const watched=(await call('admin/user-activity?username=bob&section=watched')).body;assert.equal(watched.total,1);assert.equal(watched.rows[0].position,12);
globalThis.__testUser=null;assert.equal((await call('watch-history',{episodeId:'preview1',position:1})).status,401);
console.log('PASS: private admin user activity, ledger filters, pagination, purchase lists and authenticated watch history.');

globalThis.__testUser=bob;const rangeKey=sqlite.prepare('SELECT object_key FROM episodes WHERE id=?').get('preview1').object_key;metadata.forgetMediaMetadata(globalThis.__testEnv.BUCKET,rangeKey);objects.set(rangeKey,Buffer.from('test-video'));
for(const [range,status,body,contentRange] of [['bytes=0-1',206,'te','bytes 0-1/10'],['bytes=5-',206,'video','bytes 5-9/10'],['bytes=-3',206,'deo','bytes 7-9/10'],['bytes=8-999',206,'eo','bytes 8-9/10'],['bytes=10-',416,'','bytes */10'],['bytes=-0',416,'','bytes */10']]){
 const response=await api.GET(new Request(origin+'/api/video/preview1',{headers:{Range:range}}));assert.equal(response.status,status,range);assert.equal(response.headers.get('Content-Range'),contentRange);assert.equal(await response.text(),body);if(status===206)assert.equal(Number(response.headers.get('Content-Length')),body.length);
}
const head=await api.GET(new Request(origin+'/api/video/preview1',{method:'HEAD'}));assert.equal(head.status,200);assert.equal(head.headers.get('Content-Length'),'10');assert.equal(await head.text(),'');
console.log('PASS: seek byte probes, open-ended and suffix ranges, EOF clamping, unsatisfiable ranges and HEAD.');

globalThis.__testUser=bob;const ownWatch=(await call('watch-history')).body;assert(ownWatch.episodes.some(e=>e.episode_id==='preview1'));globalThis.__testUser=alice;assert(!(await call('watch-history')).body.episodes.some(e=>e.episode_id==='preview1'));globalThis.__testUser=null;assert.equal((await call('watch-history')).status,401);console.log('PASS: watched episode markers persist and are isolated by account.');

globalThis.__testUser=bob;assert.equal((await call('admin/genres',{name:'New genre'})).status,403);
globalThis.__testUser=owner;assert.equal((await call('admin/genres',{name:'New genre'})).status,200);assert.equal((await call('admin/genres',{name:'new genre'})).status,400);
sqlite.prepare('UPDATE series SET genre=? WHERE id=?').run('New genre, Test',preview.id);assert.equal((await call('admin/genres',{previous:'New genre',name:'Renamed genre'})).status,200);assert.equal(sqlite.prepare('SELECT genre FROM series WHERE id=?').get(preview.id).genre,'Renamed genre, Test');assert.equal((await call('admin/genres',{previous:'Renamed genre',remove:true})).status,200);assert.equal(sqlite.prepare('SELECT genre FROM series WHERE id=?').get(preview.id).genre,'Test');console.log('PASS: admin genre CRUD, duplicate validation and film genre propagation.');

globalThis.__testUser=owner;const firstPublished=sqlite.prepare('SELECT first_published_at FROM series WHERE id=?').get(preview.id).first_published_at;assert(firstPublished>0);await call('admin/publish',{id:preview.id,publish:false});await call('admin/publish',{id:preview.id,publish:true});assert.equal(sqlite.prepare('SELECT first_published_at FROM series WHERE id=?').get(preview.id).first_published_at,firstPublished);console.log('PASS: first publication timestamp persists across hide and republish.');

globalThis.__testUser=alice;
const walletPage=await call('wallet/history?type=ledger&size=1');assert.equal(walletPage.status,200);assert(walletPage.body.rows.length<=1);assert(walletPage.body.total>=walletPage.body.rows.length);
assert((await call('wallet/history?kind=deposit')).body.rows.every(r=>r.amount>0));assert((await call('wallet/history?kind=purchase')).body.rows.every(r=>r.amount<0));assert.equal((await call('wallet/history?type=invalid')).status,400);assert.equal((await call('wallet/history?size=1.3&page=Infinity')).status,200);assert.equal((await call('wallet?summary=1')).body.ledger,undefined);
globalThis.__testUser=null;assert.equal((await call('wallet/history')).status,401);
globalThis.__testUser=owner;
const malformed=await api.GET(new Request(origin+'/api/admin/series',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'null'}));assert.equal(malformed.status,400);
for(let i=0;i<120;i++)sqlite.prepare('INSERT INTO series(id,title,description,genre,total,paid_from,published,created_at) VALUES(?,?,?,?,0,2,1,?)').run('perf'+i,'Performance fixture '+i,'fixture','Test',i);
preparedCalls=0;const bigCatalog=await call('catalog');assert.equal(bigCatalog.status,200);assert(bigCatalog.body.films.length>=120);assert(preparedCalls<=8,'Catalog query count must stay constant for 120 films');
console.log('PASS: private paginated wallet history, summary polling, malformed JSON and bounded catalog queries at 120 films.');

// Regression coverage for the second audit, using isolated fixtures only.
globalThis.__testUser=owner;
for(let i=0;i<2;i++)sqlite.prepare('INSERT INTO wallet_ledger VALUES(?,?,?,?,?,?)').run('page-fixture'+i,'alice',1000,'deposit','page-fixture'+i,i);
const clamped=await call('admin/user-activity?username=alice&section=ledger&page=999999&size=1');
assert.equal(clamped.status,200);assert.equal(clamped.body.page,clamped.body.pages);assert(clamped.body.rows.length>0);
assert.equal((await call('admin/user-activity?username=alice&kind=invalid')).status,400);
const posterReq=(bytes,type='image/png',extra={})=>api.POST(new Request(origin+'/api/admin/poster?seriesId='+preview.id,{method:'POST',headers:{Origin:origin,'Content-Type':type,...extra},body:bytes}));
assert.equal((await posterReq(pngFixture('poster'))).status,200);const posterBefore=objects.get('posters/'+preview.id);
for(const bytes of [Buffer.alloc(0),Buffer.from('<html>invalid image</html>')])assert.equal((await posterReq(bytes)).status,400);
assert.equal((await posterReq(pngFixture('wrong type'),'image/webp')).status,400);assert.deepEqual(objects.get('posters/'+preview.id),posterBefore,'Invalid poster never overwrites current image');
assert.equal((await posterReq(pngFixture('oversized declaration'),'image/png',{'Content-Length':String(6*1024*1024)})).status,413);
const tooLarge=JSON.stringify({name:'á'.repeat(10000)});assert(tooLarge.length<16384);assert.equal((await api.POST(new Request(origin+'/api/admin/genres',{method:'POST',headers:{Origin:origin},body:tooLarge}))).status,413);
sqlite.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run('price:'+preview.id,'19000');
globalThis.__testUser={userId:'legacy-price',email:'legacy-price@test.local'};
const legacy=await call('orders',{seriesId:preview.id});assert.equal(legacy.status,200);assert.equal(sqlite.prepare('SELECT amount FROM orders WHERE id=?').get(legacy.body.id).amount,19000);
console.log('PASS: clamped admin history pages, malformed filters, invalid/oversized poster preservation, UTF-8 byte limits and configured legacy order prices.');

globalThis.__testUser=owner;
const videoCount=sqlite.prepare('SELECT count(*) AS n FROM episodes').get().n,objectCount=objects.size;
const truncatedUpload=await api.POST(new Request(origin+'/api/admin/upload?'+new URLSearchParams({seriesId:preview.id,number:'99',title:'Fixture'}),{method:'POST',headers:{Origin:origin,'Content-Type':'video/mp4','Content-Length':'100'},body:Buffer.from('truncated fixture')}));
assert.equal(truncatedUpload.status,409);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM episodes').get().n,videoCount);assert.equal(objects.size,objectCount,'Incomplete video object is cleaned up');
console.log('PASS: incomplete video uploads never create playable episodes or leave new objects.');

// Cache only shared metadata. Every response must hydrate live entitlements.
globalThis.__testUser=null;await call('catalog');preparedCalls=0;const cachedGuest=await call('catalog');assert.equal(preparedCalls,1,'Warm guest catalog checks only the revision, not all films/episodes/orders');assert.equal(cachedGuest.body.account.user,null);
globalThis.__testUser=owner;preparedCalls=0;const cachedAdmin=await call('catalog');assert.equal(preparedCalls,2);assert(cachedAdmin.body.films.every(f=>f.unlocked&&f.adminAccess));
globalThis.__testUser={userId:'cache-viewer',email:'cache-viewer@test.local'};const privateCatalog=await call('catalog');assert(privateCatalog.body.films.every(f=>!f.unlocked&&!f.adminAccess),'Admin rights never enter shared cached data');
sqlite.prepare('INSERT INTO complimentary_access VALUES(?,?,?)').run(preview.id,'cache-viewer',1);assert((await call('catalog')).body.films.find(f=>f.id===preview.id).unlocked,'Gift rights are fresh without changing the base revision');
globalThis.__testUser=owner;await call('admin/publish',{id:preview.id,publish:false});globalThis.__testUser=null;assert(!(await call('catalog')).body.films.some(f=>f.id===preview.id),'Unpublish invalidates the cached base immediately');
globalThis.__testUser=owner;await call('admin/publish',{id:preview.id,publish:true});
preparedCalls=0;assert.equal((await call('admin?section=users')).status,200);assert.equal(preparedCalls,0,'User section must not preload film and payment history');
const watchBefore=sqlite.prepare('SELECT total_changes() AS n').get().n;globalThis.__testUser=bob;await call('watch-history',{episodeId:'preview1',position:12,completed:false});const once=sqlite.prepare('SELECT total_changes() AS n').get().n;await call('watch-history',{episodeId:'preview1',position:12,completed:false});assert.equal(sqlite.prepare('SELECT total_changes() AS n').get().n,once,'Identical progress writes must not update either table');
metadata.forgetMediaMetadata(globalThis.__testEnv.BUCKET,rangeKey);r2Heads=0;for(let i=0;i<8;i++)assert.equal((await api.GET(new Request(origin+'/api/video/preview1',{headers:{Range:'bytes=0-1'}}))).status,206);assert.equal(r2Heads,1,'Eight seeks need one metadata HEAD in a warm worker, not eight');
globalThis.__testUser=owner;assert((await call('poster/'+preview.id+'?v=1')).status===200);const cachedPoster=await api.GET(new Request(origin+'/api/poster/'+preview.id+'?v=1'));assert(cachedPoster.headers.get('Cache-Control').includes('private'));assert(cachedPoster.headers.get('Cache-Control').includes('immutable'));
for(let i=0;i<120;i++){const key='cleanup-cost-fixture-'+i;sqlite.prepare('INSERT INTO media_cleanup VALUES(?)').run(key);objects.set(key,Buffer.from('fixture'))}r2Deletes=0;preparedCalls=0;await api.cleanupMedia();assert.equal(r2Deletes,1);assert.equal(preparedCalls,2);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM media_cleanup').get().n,0);
console.log('PASS: warm catalog 1/2 SQL reads with live rights, immediate unpublish invalidation, lazy admin reads, zero duplicate progress writes, 1 HEAD for 8 seeks and 1 bulk R2 delete for 120 queued objects.');

globalThis.__testUser=owner;await call('admin/publish',{id:preview.id,publish:false});const draftPoster=await api.GET(new Request(origin+'/api/poster/'+preview.id+'?v=private'));assert(draftPoster.headers.get('Cache-Control').includes('no-store'),'Draft posters must not remain cached across logout');await call('admin/publish',{id:preview.id,publish:true});console.log('PASS: draft images remain non-cacheable; browser caching is limited to published artwork.');

// Poster source is per-film, defaults to episode one, and never removes uploaded artwork.
globalThis.__testUser=owner;
const sourceId=preview.id, uploadedKey='posters/'+sourceId, frameKey='previews/'+sourceId+'.jpg';
objects.set(uploadedKey,Buffer.from('uploaded-poster-fixture'));objects.set(frameKey,Buffer.from('first-frame-fixture'));
assert.equal((await call('admin/films?summary=1')).body.films.find(f=>f.id===sourceId).posterFromEpisodeOne,true);
assert.equal((await call('catalog')).body.films.find(f=>f.id===sourceId).posterFromEpisodeOne,true);
assert.equal((await call('poster/'+sourceId)).body,'first-frame-fixture','Default frame wins even with an uploaded poster');
const sourceTimestamp=sqlite.prepare('SELECT updated_at FROM series WHERE id=?').get(sourceId).updated_at;
assert.equal((await call('admin/poster-source',{seriesId:sourceId,fromEpisodeOne:false})).status,200);
assert(sqlite.prepare('SELECT updated_at FROM series WHERE id=?').get(sourceId).updated_at>sourceTimestamp,'Image version advances on source changes');
assert.equal((await call('poster/'+sourceId)).body,'uploaded-poster-fixture');
assert.equal((await call('catalog')).body.films.find(f=>f.id===sourceId).posterFromEpisodeOne,false,'Warm catalog invalidates on source changes');
assert.equal((await call('admin/films?summary=1')).body.films.find(f=>f.id===sourceId).posterFromEpisodeOne,false,'Selection persists on reload');
assert.equal((await call('admin/poster-source',{seriesId:sourceId,fromEpisodeOne:'false'})).status,400);
assert.equal((await call('admin/poster-source',{seriesId:'missing',fromEpisodeOne:true})).status,404);
assert.equal((await call('admin/poster-source',{seriesId:sourceId,fromEpisodeOne:true},{Origin:'https://evil.local'})).status,403);
globalThis.__testUser=bob;assert.equal((await call('admin/poster-source',{seriesId:sourceId,fromEpisodeOne:true})).status,403);
globalThis.__testUser=null;assert.equal((await call('admin/poster-source',{seriesId:sourceId,fromEpisodeOne:true})).status,403);assert.equal((await call('poster/'+sourceId)).body,'uploaded-poster-fixture');
globalThis.__testUser=owner;assert.equal((await call('admin/poster-source',{seriesId:sourceId,fromEpisodeOne:true})).status,200);
assert.equal((await call('poster/'+sourceId)).body,'first-frame-fixture');assert(objects.has(uploadedKey),'Switching to a frame keeps the uploaded image');
objects.delete(frameKey);assert.equal((await call('poster/'+sourceId)).body,'uploaded-poster-fixture','Missing frame falls back without a broken image');
assert.equal((await call('admin/films?summary=1')).body.films.find(f=>f.id==='perf0').posterFromEpisodeOne,true,'Other films keep their default selection');
const jpegFrame=Buffer.from([255,216,255,224,0,16,74,70,73,70,0,1]);
globalThis.__testUser=owner;const thumbnailUpload=await api.POST(new Request(origin+'/api/admin/thumbnail?seriesId='+sourceId,{method:'POST',headers:{Origin:origin,'Content-Type':'image/jpeg'},body:jpegFrame}));assert.equal(thumbnailUpload.status,200);assert.equal((await call('admin/films?summary=1')).body.films.find(f=>f.id===sourceId).preview,true,'Successful frame capture is persisted for the admin UI');assert.deepEqual(objects.get(frameKey),jpegFrame);
await call('admin/publish',{id:sourceId,publish:false});globalThis.__testUser=null;assert.equal((await call('poster/'+sourceId)).status,404,'Source preference does not expose drafts');
console.log('PASS: per-film poster source, real frame state, default frame priority, persisted toggles, cache invalidation, upload preservation, missing-frame fallback, admin authorization, CSRF and draft protection.');
