import {env} from 'cloudflare:workers';
import {currentUser} from './auth';
import {importGenreNames,attachImportGenres} from './import-genres';

// Session authentication is identical to the admin website. No storage keys or
// privileged API token are issued to the desktop client.
const E=()=>env as any;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const fail=(message:string,status=400):never=>{throw Object.assign(new Error(message),{status})};
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length<=max?v.trim():fail('Thông tin phim không hợp lệ');
const hex=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)?v:fail('Thiếu SHA-256 hợp lệ');
const movie=(id:string)=>E().DB.prepare('SELECT i.*,s.deleted_at,s.published,s.genre FROM videolink_imports i JOIN series s ON s.id=i.series_id WHERE i.source_id=?').bind(id).first();
const episodes=(id:string)=>E().DB.prepare('SELECT v.number,v.sha256,v.size,e.id FROM videolink_episodes v JOIN episodes e ON e.id=v.episode_id AND e.series_id=v.series_id AND e.number=v.number WHERE v.series_id=? ORDER BY v.number').bind(id).all();
async function status(f:any){const rows=(await episodes(f.series_id)).results;return {seriesId:f.series_id,sourceId:f.source_id,variant:f.variant,expected:f.expected,genres:(f.genre||'').split(',').map((s:string)=>s.trim()).filter(Boolean),posterSha256:f.poster_sha256,complete:!!f.completed_at&&rows.length===f.expected,episodes:rows}}
async function body(req:Request){if(Number(req.headers.get('content-length')||0)>1024*1024)fail('Yêu cầu quá lớn',413);const raw=await req.text();if(raw.length>1024*1024)fail('Yêu cầu quá lớn',413);try{return JSON.parse(raw)}catch{return fail('JSON không hợp lệ')}}
function image(bytes:Uint8Array,type:string){
 const ascii=(a:number,b:number)=>new TextDecoder().decode(bytes.slice(a,b));
 return bytes.length>=12&&(type==='image/png'&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)||type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255||type==='image/webp'&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'||type==='image/avif'&&ascii(4,8)==='ftyp'&&/avif|avis/.test(ascii(8,32)));
}
async function route(req:Request){
 const user=await currentUser(req);if(user?.role!=='admin')return json({error:'Đăng nhập tài khoản admin HotAI để upload'},403);
 const url=new URL(req.url);if(req.method!=='GET'&&req.headers.get('origin')!==url.origin)return json({error:'Yêu cầu khác nguồn bị từ chối'},403);
 const path=url.pathname.split('/').filter(Boolean).slice(3),db=E().DB,bucket=E().BUCKET;
 if(!path.length&&req.method==='GET')return json({genreImportVersion:1});
 if(!path.length&&req.method==='POST'){
  const b=await body(req),sourceId=text(b.sourceId,30),variant=text(b.variant,250),title=text(b.title,120),description=text(b.description,1500),expected=Number(b.expected);
  if(!/^[0-9]{10,30}$/.test(sourceId)||!variant||!title||!description||!Number.isInteger(expected)||expected<1||expected>5000)fail('Cần tên tiếng Anh, giới thiệu tiếng Việt và tổng tập hợp lệ');
  const genres=importGenreNames(b.genres);
  const seriesId='tiktok-'+sourceId;
  if(!await movie(sourceId)){
   if(await db.prepare('SELECT id FROM series WHERE id=?').bind(seriesId).first())fail('Mã phim đã tồn tại ngoài luồng VideoLink',409);
   await db.batch([
    db.prepare("INSERT OR IGNORE INTO series(id,title,description,genre,total,paid_from,published,created_at) VALUES(?,?,?,'',?,?,0,?)").bind(seriesId,title,description,expected,Math.floor(expected/4)+1,Date.now()),
    db.prepare('INSERT OR IGNORE INTO videolink_imports(source_id,series_id,variant,expected,created_at) VALUES(?,?,?,?,?)').bind(sourceId,seriesId,variant,expected,Date.now())
   ]);
  }
  const f=await movie(sourceId);if(!f||f.deleted_at)fail('Phim đã bị xóa trên HotAI; không tự tạo lại',409);
  if(f.variant!==variant||f.expected!==expected)fail('Phim này đã được tạo với lựa chọn hình/tiếng/phụ đề khác. Kiểm tra trên HotAI trước khi thay bản.',409);
  await attachImportGenres(db,seriesId,genres);
  return json(await status(await movie(sourceId)));
 }
 if(!/^[0-9]{10,30}$/.test(path[0]||''))fail('Không tìm thấy phim',404);
 const f=await movie(path[0]);if(!f||f.deleted_at)fail('Không tìm thấy phim đã nhập',404);
 if(path.length===1&&req.method==='GET')return json(await status(f));
 if(req.method==='GET'&&path[1]==='episodes'&&path.length===3){
  const n=Number(path[2]);if(!Number.isInteger(n)||n<1||n>f.expected)fail('Số tập ngoài bộ phim');
  const row=await db.prepare('SELECT v.sha256,v.size,e.object_key FROM videolink_episodes v JOIN episodes e ON e.id=v.episode_id AND e.series_id=v.series_id AND e.number=v.number WHERE v.series_id=? AND v.number=?').bind(f.series_id,n).first();
  return json(row&& (await bucket.head(row.object_key))?.size===row.size?{uploaded:true,sha256:row.sha256,size:row.size}:{uploaded:false});
 }
 if(req.method!=='POST')fail('Phương thức không được hỗ trợ',405);
 if(path[1]==='poster'&&path.length===2){
  const hash=hex(req.headers.get('x-content-sha256')),type=req.headers.get('content-type')||'',length=Number(req.headers.get('content-length'));
  if(!Number.isSafeInteger(length)||length<12||length>8*1024*1024)fail('Poster tối đa 8 MB',413);
  if(f.poster_sha256&&f.poster_sha256!==hash)fail('Poster đã nhập khác với file này',409);
  const bytes=new Uint8Array(await req.arrayBuffer());if(bytes.length!==length||!image(bytes,type))fail('Poster cần PNG/JPEG/WebP/AVIF hợp lệ');
  await bucket.put('posters/'+f.series_id,bytes,{httpMetadata:{contentType:type},sha256:hash});
  await db.batch([db.prepare('UPDATE videolink_imports SET poster_sha256=? WHERE source_id=?').bind(hash,f.source_id),db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('poster:'+f.series_id,'yes')]);
  return json({ok:true,sha256:hash});
 }
 if(path[1]==='episodes'&&path.length===3){
  const n=Number(path[2]),size=Number(req.headers.get('content-length')),hash=hex(req.headers.get('x-content-sha256'));
  if(!Number.isInteger(n)||n<1||n>f.expected)fail('Số tập ngoài bộ phim');
  if(req.headers.get('content-type')!=='video/mp4'||!Number.isSafeInteger(size)||size<12||size>90*1024*1024)fail('HotAI nhận video MP4 tối đa 90 MB/tập',413);
  const existing=await db.prepare('SELECT e.id,e.object_key,v.sha256,v.size FROM episodes e LEFT JOIN videolink_episodes v ON v.episode_id=e.id WHERE e.series_id=? AND e.number=?').bind(f.series_id,n).first();
  if(existing){if(existing.sha256!==hash||existing.size!==size)fail('Tập '+n+' đã tồn tại với nội dung khác',409);const stored=await bucket.head(existing.object_key);if(stored?.size===size)return json({ok:true,alreadyUploaded:true,sha256:hash,size});fail('File trên kho bị thiếu; kiểm tra tập trên HotAI',409)}
  const id=crypto.randomUUID(),key='episodes/'+id+'.mp4';
  try{
   // R2 checks the received stream against the checksum, without buffering a
   // complete video inside the Worker's limited memory.
   const obj=await bucket.put(key,req.body,{httpMetadata:{contentType:'video/mp4'},sha256:hash});
   if(!obj||obj.size!==size)fail('Video nhận chưa đủ; chưa ghi tập vào phim',409);
   await db.batch([
    db.prepare('DELETE FROM videolink_episodes WHERE series_id=? AND number=? AND NOT EXISTS(SELECT 1 FROM episodes WHERE id=videolink_episodes.episode_id)').bind(f.series_id,n),
    db.prepare('INSERT INTO episodes(id,series_id,number,title,object_key) VALUES(?,?,?,?,?)').bind(id,f.series_id,n,'Tập '+n,key),
    db.prepare('INSERT INTO videolink_episodes(series_id,number,episode_id,sha256,size) VALUES(?,?,?,?,?)').bind(f.series_id,n,id,hash,size),
    db.prepare('UPDATE videolink_imports SET completed_at=NULL WHERE source_id=?').bind(f.source_id)
   ]);
  }catch(e){await bucket.delete(key);const winner=await db.prepare('SELECT v.sha256,v.size,e.object_key FROM videolink_episodes v JOIN episodes e ON e.id=v.episode_id WHERE v.series_id=? AND v.number=?').bind(f.series_id,n).first();if(winner?.sha256===hash&&winner.size===size&&(await bucket.head(winner.object_key))?.size===size)return json({ok:true,alreadyUploaded:true,sha256:hash,size});throw e}
  return json({ok:true,sha256:hash,size});
 }
 if(path[1]==='complete'&&path.length===2){
  const b=await body(req),rows=(await episodes(f.series_id)).results;
  if(!f.poster_sha256||b.posterSha256!==f.poster_sha256||rows.length!==f.expected||rows.some((r:any,i:number)=>r.number!==i+1))fail('Chưa đủ poster và toàn bộ tập; chưa hoàn tất',409);
  if(!Array.isArray(b.episodes)||b.episodes.length!==rows.length||rows.some((r:any,i:number)=>b.episodes[i]?.number!==r.number||b.episodes[i]?.sha256!==r.sha256||b.episodes[i]?.size!==r.size))fail('Danh sách xác nhận chưa khớp file đã upload',409);
  if(!await bucket.head('posters/'+f.series_id))fail('Poster chưa có trên kho',409);
  await db.prepare('UPDATE videolink_imports SET completed_at=? WHERE source_id=?').bind(Date.now(),f.source_id).run();
  return json({...await status(await movie(f.source_id)),message:'Đã nhận đủ bộ phim. Phim mới ở bản nháp; phát hành trong trang quản trị HotAI.'});
 }
 fail('Không tìm thấy',404);
}
export async function importRoute(req:Request){try{return await route(req)}catch(e:any){return json({error:e.status?e.message:'Upload chưa thành công. Có thể tiếp tục lại an toàn.'},e.status||503)}}
