import {mediaMetadata,forgetMediaMetadata} from '../../../server/media-metadata';
import {catalogBase} from '../../../server/catalog';
import {readBytes,readObject,validImage} from '../../../lib/request-body';
import {issuePlayback,validatePlayback,playbackControl,foreignMedia} from '../../../server/playback';
import {GENRES} from '../../../lib/genres';
import { env } from 'cloudflare:workers';
import { currentUser } from '../../../server/auth';
import {media} from '../../../server/media';
export const dynamic='force-dynamic';
const E=()=>env as any;
const json=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const fail=(message:string,status=400)=>{throw Object.assign(new Error(message),{status})};
const uid=()=>crypto.randomUUID();
const admin=(u:any)=>!!u && u.role==='admin';
const fullAccess=(u:any)=>admin(u)||u?.role==='vip';
const text=(v:any,max=500)=>typeof v==='string'&&v.trim().length<=max?v.trim():fail('Nội dung không hợp lệ');
const readJson=readObject;
async function setting(k:string){return (await E().DB.prepare('SELECT value FROM settings WHERE key=?').bind(k).first())?.value}
async function writeSetting(k:string,v:string){await E().DB.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k,v).run()}
async function paymentRecipient(){try{const value=JSON.parse(await setting('payment_recipient')||'null');return value&&typeof value.bank==='string'&&typeof value.name==='string'&&/^[0-9]{6,30}$/.test(value.account)?value:null}catch{return null}}
async function balance(userId:string){return (await E().DB.prepare('SELECT balance FROM wallet_balances WHERE user_id=?').bind(userId).first())?.balance||0}
async function genreList(){const saved=await setting('genres');if(saved)return JSON.parse(saved);const films=(await E().DB.prepare('SELECT genre FROM series WHERE deleted_at IS NULL').all()).results;return [...new Set([...GENRES,...films.flatMap((f:any)=>f.genre.split(',').map((g:string)=>g.trim()).filter(Boolean))])].sort((a:any,b:any)=>a.localeCompare(b,'vi'))}
async function price(id:string){return Number(await setting('price:'+id)||10000)}
async function creditDeposit(d:any,reference:string){
 const db=E().DB;const id=uid();
 await db.batch([
  db.prepare("UPDATE deposits SET status='approved',reference=? WHERE id=? AND status='pending_review'").bind(reference,d.id),
  db.prepare("INSERT OR IGNORE INTO wallet_ledger(id,user_id,amount,kind,source_id,created_at) SELECT ?,user_id,amount,'deposit',id,? FROM deposits WHERE id=? AND status='approved'").bind(id,Date.now(),d.id)
 ]);
}
export async function cleanupMedia(){
 const db=E().DB,bucket=media(),rows=(await db.prepare('SELECT object_key FROM media_cleanup LIMIT 500').all()).results;
 const keys=rows.filter((r:any)=>!r.object_key.endsWith('/')).map((r:any)=>r.object_key);
 if(keys.length){try{for(const key of keys)forgetMediaMetadata(bucket,key);await bucket.delete(keys);await db.prepare('DELETE FROM media_cleanup WHERE object_key IN (SELECT value FROM json_each(?))').bind(JSON.stringify(keys)).run()}catch{}}
 for(const row of rows.filter((r:any)=>r.object_key.endsWith('/'))){try{const list=await bucket.list({prefix:row.object_key,limit:1000});if(list.objects.length)await bucket.delete(list.objects.map((o:any)=>o.key));if(!list.truncated)await db.prepare('DELETE FROM media_cleanup WHERE object_key=?').bind(row.object_key).run()}catch{}}
}
async function hasAccess(userId:string,seriesId:string){return !!await E().DB.prepare('SELECT 1 AS ok FROM grants WHERE user_id=? AND series_id=? UNION ALL SELECT 1 AS ok FROM complimentary_access WHERE user_id=? AND series_id=? LIMIT 1').bind(userId,seriesId,userId,seriesId).first()}
async function route(req:Request){
 const p=new URL(req.url).pathname.split('/').slice(2); const db=E().DB; const bucket=media(); const user=await currentUser(req);
 if(req.method!=='GET'&&!(req.method==='HEAD'&&p[0]==='video')&&req.headers.get('origin')!==new URL(req.url).origin) return json({error:'Yêu cầu khác nguồn bị từ chối'},403);
 if(p[0]==='me')return json({user:user?{email:user.email,role:user.role||'viewer'}:null,admin:admin(user)});
 if(p[0]==='watch-history'&&req.method==='GET'){
  if(!user)fail('Cần đăng nhập',401);return json({episodes:(await db.prepare('SELECT episode_id,series_id,completed FROM watched_episodes WHERE user_id=?').bind(user.userId).all()).results,history:(await db.prepare('SELECT w.series_id AS seriesId,w.episode_id AS episodeId,w.episode_number AS number,w.position,w.completed,w.updated_at AS at,s.title FROM watch_history w JOIN series s ON s.id=w.series_id WHERE w.user_id=? AND s.deleted_at IS NULL ORDER BY w.updated_at DESC LIMIT 100').bind(user.userId).all()).results});
 }
 if(p[0]==='watch-history'&&req.method==='POST'){
  if(!user)fail('Cần đăng nhập',401);const b:any=await readJson(req);const e=await db.prepare('SELECT e.id,e.series_id,e.number,s.paid_from,s.published FROM episodes e JOIN series s ON s.id=e.series_id WHERE e.id=? AND s.deleted_at IS NULL').bind(text(b.episodeId,64)).first();
  if(!e||(!e.published&&!admin(user)))fail('Không tìm thấy tập',404);if(e.number>=e.paid_from&&!fullAccess(user)&&!await hasAccess(user.userId,e.series_id))fail('Chưa mở khóa phim',403);
  const position=Number(b.position);if(!Number.isFinite(position)||position<0||position>86400)fail('Vị trí không hợp lệ');
  await db.batch([db.prepare('INSERT INTO watch_history(user_id,series_id,episode_id,episode_number,position,completed,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,series_id) DO UPDATE SET episode_id=excluded.episode_id,episode_number=excluded.episode_number,position=excluded.position,completed=excluded.completed,updated_at=excluded.updated_at WHERE watch_history.episode_id<>excluded.episode_id OR abs(watch_history.position-excluded.position)>=1 OR watch_history.completed<>excluded.completed').bind(user.userId,e.series_id,e.id,e.number,position,b.completed===true?1:0,Date.now()),db.prepare('INSERT INTO watched_episodes(user_id,episode_id,series_id,completed,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,episode_id) DO UPDATE SET completed=excluded.completed,updated_at=excluded.updated_at WHERE watched_episodes.completed<excluded.completed').bind(user.userId,e.id,e.series_id,b.completed===true?1:0,Date.now())]);return json({ok:true});
 }
 if(p[0]==='catalog'){
  const showDrafts=admin(user)&&new URL(req.url).searchParams.get('drafts')==='1';
  const [base,accessRows]=await Promise.all([catalogBase(db,showDrafts),user?db.prepare('SELECT series_id,0 AS free FROM grants WHERE user_id=? UNION ALL SELECT series_id,1 AS free FROM complimentary_access WHERE user_id=?').bind(user.userId,user.userId).all():Promise.resolve({results:[]})]);
  const unlocked=new Set(accessRows.results.map((r:any)=>r.series_id)),free=new Set(accessRows.results.filter((r:any)=>r.free).map((r:any)=>r.series_id));
  // Never mutate/cache account entitlements or identities in the shared base.
  return json({...base,films:base.films.map((f:any)=>({...f,freeAccess:free.has(f.id),adminAccess:admin(user),unlocked:fullAccess(user)||unlocked.has(f.id)})),account:{user:user?{email:user.email,role:user.role||'viewer'}:null,admin:admin(user)}});
 }
 if(p[0]==='series-view'&&req.method==='POST'){
  const b:any=await readJson(req,1024),id=text(b.seriesId,64);const updated=await db.prepare('UPDATE series SET view_count=view_count+1 WHERE id=? AND published=1 AND deleted_at IS NULL RETURNING view_count').bind(id).first();if(!updated)fail('Không tìm thấy phim',404);return json({ok:true,views:updated.view_count});
 }
 if(p[0]==='playback-control'&&req.method==='POST')return playbackControl(req,user,p[1]==='release');
 if(p[0]==='video'||p[0]==='playback'){

  const ep=await db.prepare('SELECT e.*,s.paid_from,s.published,s.deleted_at FROM episodes e JOIN series s ON s.id=e.series_id WHERE e.id=?').bind(p[1]).first();
  if(!ep||ep.deleted_at||(!ep.published&&!admin(user)))return json({error:'Không tìm thấy tập phim'},404);
  if(ep.number>=ep.paid_from&&!fullAccess(user)){
   if(!user)return json({error:'Cần đăng nhập'},401);
   if(!await hasAccess(user.userId,ep.series_id))return json({error:'Tập này cần mở khóa'},403);
  }
  if(p[0]==='playback'){
   if(req.method!=='POST')return json({error:'Cần mở phim từ ứng dụng'},405);if(Number(req.headers.get('content-length')||0)>2048)return json({error:'Yêu cầu quá lớn'},413);const b:any=await readJson(req,2048);return issuePlayback(req,user,ep,String(b.device||''));
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json({error:'Phương thức không hỗ trợ'},405);const blocked=await validatePlayback(req,user,ep.id);if(blocked)return blocked;
  const meta=await mediaMetadata(bucket,ep.object_key);if(!meta)return json({error:'Video chưa sẵn sàng'},404);
  const h=new Headers({'Content-Type':'video/mp4','Cache-Control':'private, no-store, no-transform','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Disposition':'inline'});if(meta.httpEtag)h.set('ETag',meta.httpEtag);
  let status=200,start=0,end=meta.size-1;const range=req.headers.get('range');
  // Resolve byte ranges against the full size, including Safari's suffix reads.
  if(range&&req.method!=='HEAD'){
   const m=/^bytes=(\d*)-(\d*)$/i.exec(range.trim());
   if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{...Object.fromEntries(h),'Content-Range':`bytes */${meta.size}`}});
   if(!m[1]){const suffix=Number(m[2]);start=Math.max(0,meta.size-suffix);if(!Number.isSafeInteger(suffix)||suffix<=0)start=meta.size}
   else{start=Number(m[1]);if(m[2])end=Math.min(Number(m[2]),end)}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=meta.size||end<start)return new Response(null,{status:416,headers:{...Object.fromEntries(h),'Content-Range':`bytes */${meta.size}`}});
   status=206;h.set('Content-Range',`bytes ${start}-${end}/${meta.size}`);
  }
  h.set('Content-Length',String(end-start+1));if(req.method==='HEAD')return new Response(null,{headers:h});
  const obj=await bucket.get(ep.object_key,{...(status===206?{range:{offset:start,length:end-start+1}}:{}),...(meta.etag?{onlyIf:{etagMatches:meta.etag}}:{})});
  if(!obj)return json({error:'Video chưa sẵn sàng'},404);if(!('body' in obj)){forgetMediaMetadata(bucket,ep.object_key);return new Response(null,{status:412,headers:{'Cache-Control':'no-store'}})}
  return new Response(obj.body,{status,headers:h});
 }
 if(p[0]==='thumbnail'){const f=await db.prepare('SELECT id,published FROM series WHERE id=? AND deleted_at IS NULL').bind(p[1]).first();if(!f||(!f.published&&!admin(user)))return json({error:'Không tìm thấy ảnh'},404);const obj=await bucket.get('previews/'+f.id+'.jpg');return obj?new Response(obj.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':!f.published?'private, no-store':new URL(req.url).searchParams.has('v')?'private, max-age=86400, immutable':'private, max-age=60','Cross-Origin-Resource-Policy':'same-origin'}}):json({error:'Ảnh chưa sẵn sàng'},404)}
 if(p[0]==='poster'){const f=await db.prepare("SELECT id,published,(SELECT value FROM settings WHERE key='poster:frame:'||series.id) AS poster_frame FROM series WHERE id=? AND deleted_at IS NULL").bind(p[1]).first();if(!f||(!f.published&&!admin(user)))return json({error:'Không tìm thấy poster'},404);const keys=f.poster_frame==='no'?['posters/'+f.id,'previews/'+f.id+'.jpg']:['previews/'+f.id+'.jpg','posters/'+f.id];const obj=await bucket.get(keys[0])||await bucket.get(keys[1]);return obj?new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'image/png','Cache-Control':!f.published?'private, no-store':new URL(req.url).searchParams.has('v')?'private, max-age=86400, immutable':'private, max-age=60','X-Content-Type-Options':'nosniff'}}):json({error:'Không có poster'},404)}
 if(p[0]==='qr'){const key=await setting('qr');if(!key)return json({error:'Chưa cấu hình thanh toán'},503);const obj=await bucket.get(key);return obj?new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'image/png','Cache-Control':'no-store'}}):json({error:'QR chưa có'},404)}
 if(p[0]==='wallet'){
  if(!user)return json({error:'Đăng nhập để sử dụng ví'},401);
  if(req.method==='GET'&&p[1]==='history'){
   const q=new URL(req.url).searchParams,type=q.get('type')||'ledger',kind=q.get('kind')||'';if(!['ledger','deposits'].includes(type)||!['','deposit','purchase'].includes(kind))fail('Bộ lọc không hợp lệ');const n=Number(q.get('size')),pn=Number(q.get('page'));const size=Number.isSafeInteger(n)&&n>0?Math.min(n,100):10,page=Number.isSafeInteger(pn)&&pn>0?Math.min(pn,1000000):1;
   const from=type==='deposits'?'deposits l':"wallet_ledger l LEFT JOIN orders o ON l.kind='purchase' AND o.id=l.source_id AND o.user_id=l.user_id LEFT JOIN series s ON s.id=o.series_id";const where='l.user_id=?'+(type==='ledger'&&kind?kind==='deposit'?' AND l.amount>0':' AND l.amount<0':'');const fields=type==='deposits'?'l.id,l.amount,l.status,l.created_at':'l.id,l.amount,l.kind,l.created_at,s.title AS film_title';const total=(await db.prepare('SELECT count(*) AS n FROM '+from+' WHERE '+where).bind(user.userId).first()).n;const pages=Math.max(1,Math.ceil(total/size)),current=Math.min(page,pages);return json({total,page:current,pages,rows:(await db.prepare('SELECT '+fields+' FROM '+from+' WHERE '+where+' ORDER BY l.created_at DESC,l.id DESC LIMIT ? OFFSET ?').bind(user.userId,size,(current-1)*size).all()).results});
  }
  if(req.method==='GET'&&new URL(req.url).searchParams.get('summary')==='1')return json({balance:await balance(user.userId)});
  if(req.method==='GET')return json({balance:await balance(user.userId),ledger:(await db.prepare("SELECT l.id,l.amount,l.kind,l.source_id,l.created_at,s.title AS film_title FROM wallet_ledger l LEFT JOIN orders o ON l.kind='purchase' AND o.id=l.source_id AND o.user_id=l.user_id LEFT JOIN series s ON s.id=o.series_id WHERE l.user_id=? ORDER BY l.created_at DESC LIMIT 100").bind(user.userId).all()).results,deposits:(await db.prepare('SELECT id,amount,status,created_at FROM deposits WHERE user_id=? ORDER BY created_at DESC LIMIT 30').bind(user.userId).all()).results});
  if(p[1]==='buy'&&req.method==='POST'){
   const b=await readJson(req) as any;const f=await db.prepare('SELECT * FROM series WHERE id=? AND published=1 AND deleted_at IS NULL').bind(text(b.seriesId,64)).first();if(!f)fail('Không tìm thấy phim');
   if(fullAccess(user))return json({alreadyUnlocked:true});
   if(await hasAccess(user.userId,f.id))return json({alreadyUnlocked:true,balance:await balance(user.userId)});
   const amount=await price(f.id);if(b.expectedPrice!==undefined&&b.expectedPrice!==amount)fail('Giá phim vừa thay đổi. Hãy tải lại và xác nhận giá mới.',409);const id=uid();const now=Date.now();
   await db.batch([
    db.prepare("INSERT INTO orders(id,user_id,email,series_id,amount,status,created_at) SELECT ?,?,?,?,?,'paid',? WHERE coalesce((SELECT balance FROM wallet_balances WHERE user_id=?),0)>=? AND NOT EXISTS(SELECT 1 FROM grants WHERE user_id=? AND series_id=?)").bind(id,user.userId,user.email,f.id,amount,now,user.userId,amount,user.userId,f.id),
    db.prepare("INSERT INTO wallet_ledger(id,user_id,amount,kind,source_id,created_at) SELECT ?,user_id,-amount,'purchase',id,? FROM orders WHERE id=? AND status='paid'").bind(uid(),now,id),
    db.prepare('INSERT OR IGNORE INTO grants(id,user_id,series_id,order_id) SELECT ?,user_id,series_id,id FROM orders WHERE id=?').bind(uid(),id)
   ]);
   if(!await db.prepare('SELECT id FROM grants WHERE user_id=? AND series_id=?').bind(user.userId,f.id).first())return json({error:'Số dư chưa đủ. Hãy nạp thêm vào ví.'},409);
   return json({ok:true,balance:await balance(user.userId)});
  }
  if(p[1]==='deposit'&&req.method==='POST'){
   if(!await paymentRecipient()||!await setting('qr'))fail('Chưa mở nạp tiền',503);
   const b=await readJson(req) as any;const amount=Number(b.amount);if(!Number.isSafeInteger(amount)||amount<10000||amount>1000000)fail('Số tiền từ 10.000đ đến 1.000.000đ');
   const count=await db.prepare('SELECT count(*) AS n FROM deposits WHERE user_id=? AND created_at>?').bind(user.userId,Date.now()-86400000).first();if(count.n>=10)fail('Tối đa 10 yêu cầu nạp mỗi ngày',429);
   const id='NAP'+uid().replaceAll('-','').slice(0,16).toUpperCase();await db.prepare("INSERT INTO deposits(id,user_id,email,amount,status,created_at) VALUES(?,?,?,?,'awaiting_receipt',?)").bind(id,user.userId,user.email,amount,Date.now()).run();return json({id,amount});
  }
  if(p[1]==='receipt'&&req.method==='POST'){
   const id=text(new URL(req.url).searchParams.get('id'),64);const d=await db.prepare('SELECT * FROM deposits WHERE id=? AND user_id=?').bind(id,user.userId).first();if(!d)fail('Không tìm thấy yêu cầu',404);if(d.status!=='awaiting_receipt')fail('Biên lai này đã gửi');
   const type=req.headers.get('content-type')||'';if(!['image/png','image/jpeg','image/webp'].includes(type))fail('Dùng ảnh PNG/JPEG/WebP');const bytes=await readBytes(req,5*1024*1024);if(!validImage(bytes,type))fail('Biên lai cần là ảnh PNG/JPEG/WebP hợp lệ');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');if(await db.prepare('SELECT id FROM deposits WHERE receipt_hash=?').bind(hash).first())fail('Ảnh biên lai đã được sử dụng');
   const key='receipts/'+uid();await bucket.put(key,bytes,{httpMetadata:{contentType:type}});try{const saved=await db.prepare("UPDATE deposits SET receipt_key=?,receipt_hash=?,status='pending_review' WHERE id=? AND status='awaiting_receipt' RETURNING id").bind(key,hash,id).first();if(!saved)fail('Biên lai này đã gửi. Vui lòng tải lại lịch sử.',409)}catch(e){await bucket.delete(key);throw e}return json({ok:true,status:'pending_review'});
  }
 }
 if(p[0]==='orders'){
  if(!user)return json({error:'Đăng nhập để lưu quyền xem'},401);
  if(req.method==='GET')return json({orders:(await db.prepare('SELECT o.id,o.series_id,o.amount,o.status,o.created_at,s.title FROM orders o JOIN series s ON s.id=o.series_id WHERE o.user_id=? ORDER BY o.created_at DESC').bind(user.userId).all()).results});
  if(req.method==='POST'){
   const b=await readJson(req) as any;const film=await db.prepare('SELECT id,paid_from FROM series WHERE id=? AND published=1 AND deleted_at IS NULL').bind(text(b.seriesId,64)).first();if(!film)fail('Bộ phim chưa phát hành');if(fullAccess(user))return json({alreadyUnlocked:true,adminAccess:true});
   if(await hasAccess(user.userId,film.id))return json({alreadyUnlocked:true});
   if(!await setting('qr')||!await paymentRecipient())return json({error:'Thanh toán chưa mở. Vui lòng quay lại sau.'},503);
   const old=await db.prepare("SELECT id FROM orders WHERE user_id=? AND series_id=? AND status='pending'").bind(user.userId,film.id).first();if(old)return json({id:old.id});
   const count=await db.prepare('SELECT count(*) AS n FROM orders WHERE user_id=? AND created_at>?').bind(user.userId,Date.now()-86400000).first();if(count.n>=10)return json({error:'Đã đạt giới hạn tạo đơn hôm nay'},429);
   const id='LT'+uid().replaceAll('-','').slice(0,14).toUpperCase();await db.prepare("INSERT INTO orders(id,user_id,email,series_id,amount,status,created_at) VALUES(?,?,?,?,?,'pending',?)").bind(id,user.userId,user.email,film.id,await price(film.id),Date.now()).run();return json({id});
  }
 }
 if(p[0]==='admin'){
  if(!admin(user))return json({error:'Chỉ chủ trang được quản trị'},403);
  if(p[1]==='user-activity'&&req.method==='GET'){
   const q=new URL(req.url).searchParams;const a=await db.prepare('SELECT id FROM accounts WHERE username=?').bind(text(q.get('username'),32)).first();if(!a)fail('Tài khoản này không tồn tại',404);
   const kind=q.get('kind');if(kind&&!['deposit','purchase'].includes(kind))fail('Bộ lọc không hợp lệ');const section=q.get('section')||'ledger';const requestedSize=Number(q.get('size')),requestedPage=Number(q.get('page'));const size=Number.isSafeInteger(requestedSize)&&requestedSize>0?Math.min(100,requestedSize):10;const page=Number.isSafeInteger(requestedPage)&&requestedPage>0?Math.min(1000000,requestedPage):1;let from='',where='',order='';
   if(section==='ledger'){from="wallet_ledger l LEFT JOIN orders o ON l.kind='purchase' AND o.id=l.source_id AND o.user_id=l.user_id LEFT JOIN series s ON s.id=o.series_id";where="l.user_id=?"+(kind==='deposit'?" AND l.amount>0":kind==='purchase'?" AND l.amount<0":"");order='l.created_at DESC,l.id DESC'}
   else if(section==='purchased'){from='orders o JOIN series s ON s.id=o.series_id';where="o.user_id=? AND o.status='paid'";order='o.created_at DESC,o.id DESC'}
   else if(section==='watched'){from='watch_history w JOIN series s ON s.id=w.series_id';where='w.user_id=?';order='w.updated_at DESC,w.series_id'}else fail('Mục không hợp lệ');
   const fields=section==='ledger'?'l.id,l.amount,l.kind,l.created_at,s.title':section==='purchased'?'o.id,o.amount,o.created_at,s.title':'w.series_id AS id,w.episode_number,w.position,w.completed,w.updated_at AS created_at,s.title';
   const total=(await db.prepare('SELECT count(*) AS n FROM '+from+' WHERE '+where).bind(a.id).first()).n;
   const pages=Math.max(1,Math.ceil(total/size)),current=Math.min(page,pages);return json({balance:await balance(a.id),total,page:current,pages,rows:(await db.prepare('SELECT '+fields+' FROM '+from+' WHERE '+where+' ORDER BY '+order+' LIMIT ? OFFSET ?').bind(a.id,size,(current-1)*size).all()).results});
  }
  if(p[1]==='genres'&&req.method==='POST'){
   const b:any=await readJson(req);const list:string[]=await genreList();const name=text(b.name||'',60),previous=text(b.previous||'',60);const same=(a:string,c:string)=>a.toLocaleLowerCase('vi')===c.toLocaleLowerCase('vi');
   if(b.remove!==true&&(!name||name.includes(',')))fail('Tên thể loại không được trống hoặc chứa dấu phẩy');
   if(previous&&!list.some(g=>same(g,previous)))fail('Không tìm thấy thể loại',404);
   if(!previous&&b.remove===true)fail('Thiếu thể loại');
   if(b.remove!==true&&list.some(g=>same(g,name)&&!same(g,previous)))fail('Thể loại đã tồn tại');
   const next=previous?list.flatMap(g=>same(g,previous)?b.remove===true?[]:[name]:[g]):[...list,name];if(next.length>200)fail('Tối đa 200 thể loại');
   const statements=[];if(previous){const films=(await db.prepare('SELECT id,genre FROM series').all()).results;for(const f of films){const parts=f.genre.split(',').map((g:string)=>g.trim()).filter(Boolean);if(parts.some((g:string)=>same(g,previous))){const value=[...new Set(parts.flatMap((g:string)=>same(g,previous)?b.remove===true?[]:[name]:[g]))].join(', ');if(value.length>500)fail('Thể loại của phim quá dài');statements.push(db.prepare('UPDATE series SET genre=? WHERE id=?').bind(value,f.id))}}}
   statements.push(db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('genres',JSON.stringify(next.sort((a,b)=>a.localeCompare(b,'vi')))));await db.batch(statements);return json({ok:true});
  }
  if(p[1]==='user-list'&&req.method==='GET'){return json({users:(await db.prepare("SELECT username,CASE WHEN role='admin' THEN 'admin' WHEN vip=1 THEN 'vip' ELSE 'viewer' END AS role,created_at FROM accounts ORDER BY username COLLATE NOCASE").all()).results})}
  if(p[1]==='users'&&req.method==='GET'){const username=(new URL(req.url).searchParams.get('username')||'').trim().toLowerCase();const account=await db.prepare('SELECT username,role,vip FROM accounts WHERE username=?').bind(username).first();return account?json({account:{username:account.username,role:account.role==='admin'?'admin':account.vip?'vip':'viewer'}}):json({error:'Tài khoản này không tồn tại'},404)}
  if(p[1]==='free-access'&&req.method==='GET'){const id=text(new URL(req.url).searchParams.get('seriesId'),64);return json({users:(await db.prepare('SELECT a.username,c.created_at FROM complimentary_access c JOIN accounts a ON a.id=c.user_id WHERE c.series_id=? ORDER BY a.username COLLATE NOCASE').bind(id).all()).results})}
  if(p[1]==='receipt'&&req.method==='GET'){const d=await db.prepare('SELECT receipt_key FROM deposits WHERE id=?').bind(p[2]).first();if(!d?.receipt_key)fail('Không có biên lai',404);const obj=await bucket.get(d.receipt_key);return obj?new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}):json({error:'Không có ảnh'},404)}
  if(p[1]==='films'&&req.method==='GET'){const query=new URL(req.url).searchParams;if(query.get('section')==='payments')return json({films:[],genres:[],deposits:(await db.prepare('SELECT id,email,amount,status,created_at FROM deposits ORDER BY created_at DESC LIMIT 100').all()).results});const films=(await db.prepare('SELECT * FROM series WHERE deleted_at IS NULL ORDER BY created_at DESC').all()).results;const settings=new Map<string,string>((await db.prepare("SELECT key,value FROM settings WHERE key LIKE 'price:%' OR key LIKE 'poster:%' OR key LIKE 'preview:%'").all()).results.map((r:any)=>[r.key,r.value]));for(const f of films){f.price=Number(settings.get('price:'+f.id)||10000);f.poster=!!settings.get('poster:'+f.id);f.preview=!!settings.get('preview:'+f.id);f.posterFromEpisodeOne=settings.get('poster:frame:'+f.id)!=='no'}return json({films,genres:await genreList(),deposits:query.get('summary')==='1'?[]:(await db.prepare('SELECT id,email,amount,status,created_at FROM deposits ORDER BY created_at DESC LIMIT 100').all()).results,automaticReceiptCheck:false})}
  if(req.method==='GET'&&new URL(req.url).searchParams.get('section')==='users')return json({episodes:[],orders:[]});
  if(req.method==='GET'&&new URL(req.url).searchParams.get('section')==='films')return json({episodes:(await db.prepare('SELECT id,series_id,number,title FROM episodes ORDER BY series_id,number').all()).results,orders:[]});
  if(req.method==='GET')return json({series:new URL(req.url).searchParams.get('section')==='payments'?[]:(await db.prepare('SELECT * FROM series WHERE deleted_at IS NULL ORDER BY created_at DESC').all()).results,episodes:new URL(req.url).searchParams.get('section')==='payments'?[]:(await db.prepare('SELECT id,series_id,number,title FROM episodes ORDER BY number').all()).results,orders:(await db.prepare('SELECT o.*,s.title FROM orders o JOIN series s ON s.id=o.series_id ORDER BY created_at DESC LIMIT 100').all()).results,qrReady:!!await setting('qr'),recipient:await paymentRecipient(),checkoutReady:!!await paymentRecipient()&&!!await setting('qr'),revenue:(await db.prepare("SELECT coalesce(sum(amount),0) AS value FROM orders WHERE status='paid'").first()).value});
  if(req.method!=='GET'&&req.method!=='POST')return json({error:'Phương thức không hỗ trợ'},405);
  if(p[1]==='upload'||p[1]==='qr'||p[1]==='poster'||p[1]==='thumbnail'){
   const size=Number(req.headers.get('content-length'));const type=req.headers.get('content-type')||'';
   if(p[1]==='thumbnail'){const id=text(new URL(req.url).searchParams.get('seriesId'),64);if(!await db.prepare('SELECT id FROM series WHERE id=? AND deleted_at IS NULL').bind(id).first())fail('Không tìm thấy phim');if(type!=='image/jpeg')fail('Ảnh cần định dạng JPEG');if(Number(req.headers.get('content-length')||0)>1024*1024)fail('Ảnh tối đa 1 MB');const bytes=await readBytes(req,1024*1024);if(!validImage(bytes,type))fail('Ảnh không hợp lệ');await bucket.put('previews/'+id+'.jpg',bytes,{httpMetadata:{contentType:'image/jpeg'}});await db.batch([db.prepare('UPDATE series SET updated_at=? WHERE id=?').bind(Date.now(),id),db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind('preview:'+id,'yes'),db.prepare("UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='catalog_revision'")]);return json({ok:true})}
   if(p[1]==='poster'){const id=text(new URL(req.url).searchParams.get('seriesId'),64);if(!await db.prepare('SELECT id FROM series WHERE id=? AND deleted_at IS NULL').bind(id).first())fail('Không tìm thấy phim');if(!['image/png','image/jpeg','image/webp'].includes(type))fail('Poster cần PNG/JPEG/WebP');const bytes=await readBytes(req,5*1024*1024);if(!validImage(bytes,type))fail('Poster cần là ảnh PNG/JPEG/WebP hợp lệ');await bucket.put('posters/'+id,bytes,{httpMetadata:{contentType:type}});await db.batch([db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('poster:'+id,'yes'),db.prepare('UPDATE series SET updated_at=max(coalesce(updated_at,0)+1,?) WHERE id=?').bind(Date.now(),id)]);return json({ok:true})}
   if(p[1]==='qr'){
    if(!['image/png','image/jpeg','image/webp'].includes(type))fail('QR cần là PNG, JPEG hoặc WebP');const data=await readBytes(req,2*1024*1024);if(!validImage(data,type))fail('QR cần là ảnh PNG/JPEG/WebP hợp lệ');await bucket.put('payment/qr',data,{httpMetadata:{contentType:type}});await writeSetting('qr','payment/qr');return json({ok:true});
   }
   if(type!=='video/mp4'||!size||size>90*1024*1024)fail('Video MP4, tối đa 90 MB mỗi tập');
   const u=new URL(req.url);const seriesId=text(u.searchParams.get('seriesId'),64);const n=Number(u.searchParams.get('number'));const f=await db.prepare('SELECT * FROM series WHERE id=? AND deleted_at IS NULL').bind(seriesId).first();if(!f||!Number.isInteger(n)||n<1||n>1000000)fail('Số tập phải là số nguyên từ 1 trở lên');
   if(await db.prepare('SELECT id FROM episodes WHERE series_id=? AND number=?').bind(seriesId,n).first())fail('Tập này đã được tải lên');
   const id=uid();const key='episodes/'+id+'.mp4';try{const stored=await bucket.put(key,req.body,{httpMetadata:{contentType:'video/mp4'},size});if(stored?.size!==size)fail('Video nhận chưa đủ. Vui lòng thử tải lại.',409);await db.prepare('INSERT INTO episodes(id,series_id,number,title,object_key) VALUES(?,?,?,?,?)').bind(id,seriesId,n,text(u.searchParams.get('title'),100)||'Tập '+n,key).run()}catch(err){await bucket.delete(key);throw err}return json({ok:true});
  }
  const b=await readJson(req) as any;
  if(p[1]==='poster-source'){
   const id=text(b.seriesId,64);if(typeof b.fromEpisodeOne!=='boolean')fail('Lựa chọn poster không hợp lệ');if(!await db.prepare('SELECT id FROM series WHERE id=? AND deleted_at IS NULL').bind(id).first())fail('Không tìm thấy phim',404);
   await db.batch([db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('poster:frame:'+id,b.fromEpisodeOne?'yes':'no'),db.prepare('UPDATE series SET updated_at=max(coalesce(updated_at,0)+1,?) WHERE id=?').bind(Date.now(),id)]);return json({ok:true});
  }
  if(p[1]==='user-role'){
   const username=text(b.username,32).toLowerCase();if(!['admin','vip','viewer'].includes(b.role))fail('Quyền không hợp lệ');const account=await db.prepare('SELECT id FROM accounts WHERE username=?').bind(username).first();if(!account)fail('Tài khoản này không tồn tại',404);if(account.id===user.userId&&b.role!=='admin')fail('Không thể tự hạ quyền tài khoản admin đang sử dụng');await db.prepare('UPDATE accounts SET role=?,vip=? WHERE id=?').bind(b.role==='admin'?'admin':'viewer',b.role==='vip'?1:0,account.id).run();return json({ok:true});
  }
  if(p[1]==='free-access'){
   const id=text(b.seriesId,64);if(!await db.prepare('SELECT id FROM series WHERE id=? AND deleted_at IS NULL').bind(id).first())fail('Không tìm thấy phim',404);const username=text(b.username,32).toLowerCase();const account=await db.prepare('SELECT id FROM accounts WHERE username=?').bind(username).first();if(!account)fail('Username chưa có tài khoản',404);
   if(b.remove){await db.prepare('DELETE FROM complimentary_access WHERE series_id=? AND user_id=?').bind(id,account.id).run();return json({ok:true})}
   const previous=typeof b.previousUsername==='string'?b.previousUsername.trim().toLowerCase():'';
   await db.batch([db.prepare('INSERT OR IGNORE INTO complimentary_access(series_id,user_id,created_at) VALUES(?,?,?)').bind(id,account.id,Date.now()),...(previous&&previous!==username?[db.prepare('DELETE FROM complimentary_access WHERE series_id=? AND user_id IN (SELECT id FROM accounts WHERE username=?)').bind(id,previous)]:[])]);return json({ok:true});
  }
  if(p[1]==='delete-episodes'){
   const id=text(b.seriesId,64);if(!await db.prepare('SELECT id FROM series WHERE id=? AND deleted_at IS NULL').bind(id).first())fail('Không tìm thấy phim',404);
   if(!Array.isArray(b.ids)||!b.ids.length||b.ids.length>1000||b.ids.some((x:any)=>typeof x!=='string'||x.length>64))fail('Danh sách tập không hợp lệ');const ids=[...new Set(b.ids)];const list=JSON.stringify(ids);
   const found=(await db.prepare('SELECT id FROM episodes WHERE series_id=? AND id IN (SELECT value FROM json_each(?))').bind(id,list).all()).results;if(found.length!==ids.length)fail('Một số tập không thuộc phim này hoặc đã bị xóa',409);
   await db.batch([db.prepare('INSERT OR IGNORE INTO media_cleanup(object_key) SELECT object_key FROM episodes WHERE series_id=? AND id IN (SELECT value FROM json_each(?))').bind(id,list),db.prepare("INSERT OR IGNORE INTO media_cleanup(object_key) SELECT h.prefix||'/' FROM episode_hls h JOIN episodes e ON e.id=h.episode_id WHERE e.series_id=? AND e.id IN (SELECT value FROM json_each(?))").bind(id,list),db.prepare('DELETE FROM episode_hls WHERE episode_id IN (SELECT id FROM episodes WHERE series_id=? AND id IN (SELECT value FROM json_each(?)))').bind(id,list),db.prepare('DELETE FROM episodes WHERE series_id=? AND id IN (SELECT value FROM json_each(?))').bind(id,list),db.prepare('UPDATE series SET updated_at=? WHERE id=?').bind(Date.now(),id)]);await cleanupMedia();return json({ok:true,deleted:ids.length});
  }
  if(p[1]==='delete-film'){
   const id=text(b.id,64);const f=await db.prepare('SELECT * FROM series WHERE id=? AND deleted_at IS NULL').bind(id).first();if(!f)fail('Không tìm thấy phim',404);if(b.confirmTitle!==f.title)fail('Tên xác nhận chưa khớp');
   await db.batch([db.prepare('INSERT OR IGNORE INTO media_cleanup(object_key) SELECT object_key FROM episodes WHERE series_id=?').bind(id),db.prepare('INSERT OR IGNORE INTO media_cleanup(object_key) VALUES(?)').bind('posters/'+id),db.prepare('INSERT OR IGNORE INTO media_cleanup(object_key) VALUES(?)').bind('previews/'+id+'.jpg'),db.prepare("INSERT OR IGNORE INTO media_cleanup(object_key) SELECT h.prefix||'/' FROM episode_hls h JOIN episodes e ON e.id=h.episode_id WHERE e.series_id=?").bind(id),db.prepare('DELETE FROM episode_hls WHERE episode_id IN (SELECT id FROM episodes WHERE series_id=?)').bind(id),db.prepare('DELETE FROM episodes WHERE series_id=?').bind(id),db.prepare('UPDATE series SET deleted_at=?,published=0,updated_at=? WHERE id=?').bind(Date.now(),Date.now(),id)]);await cleanupMedia();return json({ok:true});
  }
  if(p[1]==='edit'){
   const id=text(b.id,64);const f=await db.prepare('SELECT * FROM series WHERE id=? AND deleted_at IS NULL').bind(id).first();if(!f)fail('Không tìm thấy phim');const paidFrom=Number(b.paidFrom),amount=Number(b.price),views=Number(b.viewCount??f.view_count??0);const title=text(b.title,120);
   if(!title||!Number.isSafeInteger(paidFrom)||paidFrom<1||paidFrom>1000000||!Number.isSafeInteger(amount)||amount<1000||amount>1000000||!Number.isSafeInteger(views)||views<0||views>2147483647)fail('Tên phim bắt buộc; lượt xem từ 0; tập bắt đầu khóa từ 1; giá từ 1.000đ–1.000.000đ');
   await db.batch([db.prepare('UPDATE series SET title=?,description=?,genre=?,paid_from=?,view_count=? WHERE id=?').bind(title,text(b.description,1500),text(b.genre,500),paidFrom,views,id),db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('price:'+id,String(amount))]);return json({ok:true});
  }
  if(p[1]==='deposit-confirm'){
   const d=await db.prepare('SELECT * FROM deposits WHERE id=?').bind(text(b.id,64)).first();if(!d)fail('Không tìm thấy yêu cầu');if(d.status==='approved')return json({ok:true});if(d.status!=='pending_review')fail('Yêu cầu chưa có biên lai');const ref=text(b.reference,150).toUpperCase();if(!ref)fail('Điền mã giao dịch đã kiểm tra');if(await db.prepare('SELECT id FROM deposits WHERE reference=?').bind(ref).first()||await db.prepare('SELECT id FROM orders WHERE reference=?').bind(ref).first())fail('Mã giao dịch đã sử dụng');await creditDeposit(d,ref);return json({ok:true});
  }
  if(p[1]==='deposit-reject'){await db.prepare("UPDATE deposits SET status='rejected' WHERE id=? AND status='pending_review'").bind(text(b.id,64)).run();return json({ok:true})}
  if(p[1]==='payment'){const bank=text(b.bank,50);const account=text(b.account,30);const name=text(b.name,100);if(!bank||!name||!/^[0-9]{6,30}$/.test(account))fail('Điền ngân hàng, số tài khoản 6–30 chữ số và tên người nhận');await writeSetting('payment_recipient',JSON.stringify({bank,account,name}));return json({ok:true})}
  if(p[1]==='series'){
   const paidFrom=Number(b.paidFrom);if(!Number.isSafeInteger(paidFrom)||paidFrom<1||paidFrom>1000000)fail('Tập bắt đầu khóa phải là số nguyên từ 1');
   const title=text(b.title,120),views=Number(b.viewCount??0);if(!title||!Number.isSafeInteger(views)||views<0||views>2147483647)fail('Tên phim hoặc lượt xem ban đầu không hợp lệ');await db.prepare('INSERT INTO series(id,title,description,genre,total,paid_from,published,created_at,view_count) VALUES(?,?,?,?,0,?,0,?,?)').bind(uid(),title,text(b.description,1500),text(b.genre,500),paidFrom,Date.now(),views).run();return json({ok:true});
  }
  if(p[1]==='publish'){
   const f=await db.prepare('SELECT * FROM series WHERE id=? AND deleted_at IS NULL').bind(text(b.id,64)).first();if(!f)fail('Không tìm thấy phim');const first=await db.prepare('SELECT id FROM episodes WHERE series_id=? AND number=1').bind(f.id).first();if(b.publish&&!first)fail('Cần tải tập 1 trước khi phát hành');await db.prepare('UPDATE series SET published=? WHERE id=?').bind(b.publish?1:0,f.id).run();return json({ok:true});
  }
  if(p[1]==='confirm'){
   const o=await db.prepare('SELECT * FROM orders WHERE id=?').bind(text(b.id,64)).first();if(!o)fail('Không tìm thấy đơn');if(o.status==='paid')return json({ok:true});const ref=text(b.reference,150);if(!ref)fail('Cần mã giao dịch ngân hàng đã đối soát');if(await db.prepare('SELECT id FROM deposits WHERE reference=?').bind(ref.toUpperCase()).first())fail('Mã giao dịch này đã dùng nạp ví');if(await db.prepare("SELECT id FROM orders WHERE reference=? AND status='paid'").bind(ref).first())fail('Mã giao dịch này đã dùng');
   await db.batch([db.prepare('INSERT OR IGNORE INTO grants(id,user_id,series_id,order_id) VALUES(?,?,?,?)').bind(uid(),o.user_id,o.series_id,o.id),db.prepare("UPDATE orders SET status='paid',reference=? WHERE id=? AND status='pending'").bind(ref,o.id)]);return json({ok:true});
  }
 }
 return json({error:'Không tìm thấy'},404);
}
export async function GET(r:Request){try{return await route(r)}catch(e:any){return json({error:e.status?e.message:'Dịch vụ chưa sẵn sàng. Vui lòng thử lại.'},e.status||503)}}
export const POST=GET;

