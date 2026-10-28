import {readObject} from '../lib/request-body';
import {env} from 'cloudflare:workers';
import {currentUser} from './auth';
const E=()=>env as any;
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
async function config(){const r=await E().DB.prepare("SELECT value FROM settings WHERE key='payment_recipient'").first();try{return JSON.parse(r?.value||'null')}catch{return null}}
export async function sepayWallet(req:Request){
 const user=await currentUser(req);if(!user)return json({error:'Cần đăng nhập'},401);if(req.method!=='GET')return json({error:'Phương thức không hỗ trợ'},405);
 const recipient=await config();const enabled=await E().DB.prepare("SELECT value FROM settings WHERE key='sepay_enabled'").first();
 if(!E().SEPAY_WEBHOOK_KEY||enabled?.value!=='1'||recipient?.bank?.toLowerCase()!=='tpbank')return json({ready:false});
 const db=E().DB;let row=await db.prepare('SELECT code FROM payment_codes WHERE user_id=?').bind(user.userId).first();if(!row){await db.prepare('INSERT OR IGNORE INTO payment_codes(user_id,code) VALUES(?,?)').bind(user.userId,'HOTAI'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase()).run();row=await db.prepare('SELECT code FROM payment_codes WHERE user_id=?').bind(user.userId).first()}
 const memo=row.code+' '+user.username;
 const amount=Number(new URL(req.url).searchParams.get('amount')||10000);if(!Number.isSafeInteger(amount)||amount<=1000||amount>100000000)return json({error:'Số tiền phải lớn hơn 1,000đ và không quá 100,000,000đ'},400);
 const qr=new URL('https://vietqr.app/img');for(const [key,value] of Object.entries({acc:recipient.account,bank:'TPBank',amount:String(amount),des:memo,template:'compact',showinfo:'true',holder:recipient.name}))qr.searchParams.set(key,value);
 return json({ready:true,recipient,memo,amount,qrUrl:qr.href});
}
export async function sepayWebhook(req:Request){
 if(req.method!=='POST')return json({success:false},405);
 const secret=E().SEPAY_WEBHOOK_KEY;if(!secret)return json({success:false},503);
 const supplied=req.headers.get('authorization')||'';const expected='Apikey '+secret;
 const digest=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [a,b]=await Promise.all([digest(supplied),digest(expected)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(diff)return json({success:false},401);
 let body:any;try{body=await readObject(req)}catch(e:any){return json({success:false},e.status||400)}
 const recipient=await config();const enabled=await E().DB.prepare("SELECT value FROM settings WHERE key='sepay_enabled'").first();if(enabled?.value!=='1')return json({success:false},503);
 if(body.transferType!=='in')return json({success:true});
 if(typeof body.gateway!=='string')return json({success:false},400);
 if(body.gateway.toLowerCase()!=='tpbank'||String(body.accountNumber)!==recipient?.account)return json({success:true});
 const id=String(body.id||''),amount=body.transferAmount,reference=typeof body.referenceCode==='string'?body.referenceCode.trim():'';
 if(!/^[1-9][0-9]*$/.test(id)||!Number.isSafeInteger(amount)||amount<=0)return json({success:false},400);
 const codes=[...new Set((String(body.content||'').toUpperCase().match(/\bHOTAI[A-F0-9]{16}\b/g)||[]))];
 const match=codes.length===1?await E().DB.prepare('SELECT p.user_id FROM payment_codes p JOIN accounts a ON a.id=p.user_id WHERE p.code=?').bind(codes[0]).first():null;
 const now=Date.now(),source='SEPAY'+id;const db=E().DB;
 await db.batch([
 db.prepare('INSERT OR IGNORE INTO sepay_transactions(id,reference,user_id,amount,status,created_at) VALUES(?,?,?,?,?,?)').bind(id,reference||null,match?.user_id||null,amount,match?'credited':'unmatched',now),
 db.prepare("INSERT OR IGNORE INTO deposits(id,user_id,email,amount,status,reference,created_at) SELECT ?,t.user_id,a.username,t.amount,'approved',?,t.created_at FROM sepay_transactions t JOIN accounts a ON a.id=t.user_id WHERE t.id=? AND t.status='credited'").bind(source,source,id),
 db.prepare("INSERT OR IGNORE INTO wallet_ledger(id,user_id,amount,kind,source_id,created_at) SELECT ?,user_id,amount,'deposit',?,created_at FROM sepay_transactions WHERE id=? AND status='credited'").bind(crypto.randomUUID(),source,id)
 ]);
 return json({success:true});
}
