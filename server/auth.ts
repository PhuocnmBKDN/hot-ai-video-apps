import {env} from 'cloudflare:workers';
const E=()=>env as any;
const encoder=new TextEncoder();
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
export const digest=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
const cookieName='__Host-hotai_session';
const reject=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
async function derive(proof:string,salt:string){const key=await crypto.subtle.importKey('raw',encoder.encode(proof),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256))}
export async function hashPassword(proof:string){const salt=random();return 'client600k-server100k$'+salt+'$'+await derive(proof,salt)}
export async function verifyPassword(proof:string,encoded:string){const [scheme,salt,expected]=encoded.split('$');if(scheme!=='client600k-server100k'||!salt||!expected)return false;const actual=await derive(proof,salt);let diff=actual.length^expected.length;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^(expected.charCodeAt(i)||0);return diff===0}
export async function currentUser(req:Request){const cookie=req.headers.get('cookie')||'';const token=cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!token||!/^[a-f0-9]{64}$/.test(token))return null;return await E().DB.prepare('SELECT a.id AS userId,a.username AS email,a.username,a.role FROM sessions s JOIN accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first()}
function sessionCookie(token:string,age=2592000){return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`}
export async function auth(req:Request){
 const url=new URL(req.url);
 if(url.pathname==='/api/auth/challenge'&&req.method==='GET'){
  const username=(url.searchParams.get('username')||'').trim().toLowerCase();if(!/^[a-z0-9_]{3,32}$/.test(username))return reject('Tên đăng nhập không hợp lệ');
  const row=await E().DB.prepare('SELECT client_salt FROM accounts WHERE username=?').bind(username).first();return Response.json({clientSalt:row?.client_salt||random(),scheme:'client600k-server100k'},{headers:{'Cache-Control':'no-store'}});
 }
 if(req.method!=='POST')return reject('Phương thức không được hỗ trợ',405);
 if(req.headers.get('origin')!==new URL(req.url).origin)return reject('Yêu cầu khác nguồn bị từ chối',403);
 const action=new URL(req.url).pathname.split('/').pop(),db=E().DB;
 if(action==='logout'){const raw=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(raw)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(raw)).run();return Response.json({ok:true},{headers:{'Set-Cookie':sessionCookie('',0),'Cache-Control':'no-store'}})}
 if(!['login','register'].includes(action||''))return reject('Không tìm thấy',404);
 if(Number(req.headers.get('content-length')||0)>2048)return reject('Yêu cầu quá lớn',413);
 const body=await req.text();if(body.length>2048)return reject('Yêu cầu quá lớn',413);let b:any;try{b=JSON.parse(body)}catch{return reject('Dữ liệu không hợp lệ')}
 const username=typeof b.username==='string'?b.username.trim().toLowerCase():'',password=b.passwordProof,clientSalt=b.clientSalt;
 if(!/^[a-z0-9_]{3,32}$/.test(username)||typeof password!=='string'||!/^[a-f0-9]{64}$/.test(password)||typeof clientSalt!=='string'||!/^[a-f0-9]{64}$/.test(clientSalt)||b.scheme!=='client600k-server100k')return reject('Dữ liệu đăng nhập không hợp lệ. Hãy tải lại trang rồi thử lại.');
 let account=await db.prepare('SELECT * FROM accounts WHERE username=?').bind(username).first();
 if(action==='register'){
  if(account)return reject('Tên đăng nhập không khả dụng',409);
  const id=crypto.randomUUID(),hash=await hashPassword(password);
  try{await db.prepare("INSERT INTO accounts(id,username,password_hash,role,created_at,client_salt) VALUES(?,?,?,'viewer',?,?)").bind(id,username,hash,Date.now(),clientSalt).run()}catch{ return reject('Tên đăng nhập không khả dụng',409) }
  account={id,username};
 }else{
  const encoded=account?.password_hash||'client600k-server100k$0000000000000000000000000000000000000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';
  const valid=await verifyPassword(password,encoded);if(!account||!valid||account.client_salt!==clientSalt)return reject('Tên đăng nhập hoặc mật khẩu không đúng',401);
 }
 const token=random();await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),account.id,Date.now()+2592000000).run();
 return Response.json({ok:true},{headers:{'Set-Cookie':sessionCookie(token),'Cache-Control':'no-store'}});
}
