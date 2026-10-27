import {env} from 'cloudflare:workers';
const E=()=>env as any;
const json=(error:string,status=403)=>Response.json({error},{status,headers:{'Cache-Control':'private, no-store'}});
const hex=(b:Uint8Array)=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const hash=async(s:string)=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));
function cookie(req:Request,name:string){return (req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||''}
async function identity(req:Request,user:any){const raw=cookie(req,user?'__Host-hotai_session':'__Host-hotai_viewer');return {raw,actor:user?'user:'+user.userId:'guest:'+await hash(raw),session:await hash(raw)}}
async function key(){const secret=E().PLAYBACK_SECRET;if(!secret||!/^[a-f0-9]{64}$/.test(secret))throw Error('Playback key missing');return crypto.subtle.importKey('raw',Uint8Array.from(secret.match(/../g)!, (x:any)=>parseInt(x,16)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
function base64(b:Uint8Array){return btoa(String.fromCharCode(...b)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
async function seal(data:any){const iv=crypto.getRandomValues(new Uint8Array(12));const b=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('hotai-playback-v1')},await key(),new TextEncoder().encode(JSON.stringify(data))));const out=new Uint8Array(iv.length+b.length);out.set(iv);out.set(b,12);return base64(out)}
async function unseal(token:string){if(!/^[A-Za-z0-9_-]{40,2000}$/.test(token))throw Error('token');const b=Uint8Array.from(atob(token.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12),additionalData:new TextEncoder().encode('hotai-playback-v1')},await key(),b.slice(12))))}
export function foreignMedia(req:Request){const site=req.headers.get('sec-fetch-site'),origin=req.headers.get('origin');return site==='cross-site'||site==='same-site'||!!origin&&origin!==new URL(req.url).origin}
export async function issuePlayback(req:Request,user:any,ep:any,device:string){
 if(req.headers.get('origin')!==new URL(req.url).origin||foreignMedia(req))return json('Yêu cầu phát không hợp lệ');
 if(!/^[a-f0-9-]{16,64}$/.test(device))return json('Mã thiết bị không hợp lệ',400);
 let who=await identity(req,user);let setCookie='';if(!user&&!who.raw){const raw=hex(crypto.getRandomValues(new Uint8Array(32)));setCookie=`__Host-hotai_viewer=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`;who={raw,actor:'guest:'+await hash(raw),session:await hash(raw)}}
 if(E().PLAYBACK_ISSUE_LIMIT&&!((await E().PLAYBACK_ISSUE_LIMIT.limit({key:who.actor})).success))return json('Mở tập quá nhanh. Vui lòng thử lại sau một phút.',429);
 if(E().PLAYBACK_READ_LIMIT&&!((await E().PLAYBACK_READ_LIMIT.limit({key:'issue-ip:'+await hash(req.headers.get('cf-connecting-ip')||'unknown')})).success))return json('Quá nhiều yêu cầu mở video. Vui lòng thử lại sau một phút.',429);
 const db=E().DB,now=Date.now(),id=crypto.randomUUID();await db.prepare('INSERT INTO playback_leases(actor,device,id,episode_id,session_hash,expires_at) SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM playback_leases WHERE actor=? AND device<>? AND expires_at>?)<2 ON CONFLICT(actor,device) DO UPDATE SET id=excluded.id,episode_id=excluded.episode_id,session_hash=excluded.session_hash,expires_at=excluded.expires_at').bind(who.actor,device,id,ep.id,who.session,now+240000,who.actor,device,now).run();
 const lease=await db.prepare('SELECT id FROM playback_leases WHERE actor=? AND device=?').bind(who.actor,device).first();if(lease?.id!==id)return json('Tài khoản đang có 2 phiên xem. Hãy đóng trình phát ở tab hoặc thiết bị khác rồi thử lại.',409);
 const token=await seal({id,episode:ep.id,actor:who.actor,session:who.session,exp:now+30*60000});return Response.json({token,mode:'mp4',src:`/api/video/${ep.id}?token=${token}`,expiresAt:now+30*60000},{headers:{'Cache-Control':'private, no-store',...(setCookie?{'Set-Cookie':setCookie}:{})}})

}
export async function validatePlayback(req:Request,user:any,episodeId:string){
 if(foreignMedia(req))return json('Không cho phép phát từ website khác');
 try{const token=new URL(req.url).searchParams.get('token')||'';const claims=await unseal(token);const who=await identity(req,user);if(!who.raw||claims.exp<=Date.now()||claims.episode!==episodeId||claims.actor!==who.actor||claims.session!==who.session)return json('Phiên phát đã hết hạn. Hãy mở lại tập phim.',401);
 const row=await E().DB.prepare('SELECT id FROM playback_leases WHERE id=? AND actor=? AND session_hash=? AND episode_id=? AND expires_at>?').bind(claims.id,who.actor,who.session,episodeId,Date.now()).first();if(!row)return json('Phiên phát đã đóng hoặc được mở ở tab khác.',409);
 if(E().PLAYBACK_READ_LIMIT&&!((await E().PLAYBACK_READ_LIMIT.limit({key:who.actor})).success))return json('Quá nhiều yêu cầu video. Vui lòng thử lại sau một phút.',429);
 return null}catch{return json('Cần mở phim trong ứng dụng để phát video.',401)}
}
export async function playbackControl(req:Request,user:any,release=false){
 if(req.headers.get('origin')!==new URL(req.url).origin||foreignMedia(req))return json('Yêu cầu không hợp lệ');try{const b:any=await req.json();const claims=await unseal(b.token||'');const who=await identity(req,user);if(!who.raw||claims.exp<=Date.now()||claims.actor!==who.actor||claims.session!==who.session)return json('Phiên phát hết hạn',401);const sql=release?'DELETE FROM playback_leases WHERE id=? AND actor=? AND session_hash=?':'UPDATE playback_leases SET expires_at=? WHERE id=? AND actor=? AND session_hash=? AND (expires_at>? OR (SELECT count(*) FROM playback_leases WHERE actor=? AND id<>? AND expires_at>?)<2)';const q=E().DB.prepare(sql);if(release)await q.bind(claims.id,who.actor,who.session).run();else{const now=Date.now();await q.bind(now+240000,claims.id,who.actor,who.session,now,who.actor,claims.id,now).run();if(!await E().DB.prepare('SELECT id FROM playback_leases WHERE id=? AND actor=? AND session_hash=? AND expires_at>?').bind(claims.id,who.actor,who.session,now).first())return json('Phiên đã đóng hoặc tài khoản đang có 2 phiên xem khác. Bấm Phát lại sau khi đóng phiên khác.',409)}return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}})}catch{return json('Phiên phát không hợp lệ',401)}
}
