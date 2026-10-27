import {importRoute} from './imports';
import {sepayWebhook,sepayWallet} from './sepay';
import {GET,cleanupMedia} from '../app/api/[...path]/route';
import {auth} from './auth';
import {storageRoute} from './storage';
export default {
 async fetch(req:Request,env:any){let response:Response;try{const path=new URL(req.url).pathname;response=(path==='/api/admin/imports'||path.startsWith('/api/admin/imports/'))?await importRoute(req):path==='/api/sepay/webhook'?await sepayWebhook(req):path==='/api/wallet/transfer'?await sepayWallet(req):path.startsWith('/api/admin/storage')?await storageRoute(req):path.startsWith('/api/auth/')?await auth(req):path.startsWith('/api/')?await GET(req):await env.ASSETS.fetch(req)}catch{response=Response.json({error:'Dịch vụ tạm chưa sẵn sàng. Vui lòng thử lại.'},{status:503})}
  const h=new Headers(response.headers);if(h.get('Content-Type')?.includes('text/html'))h.set('Cache-Control',(h.get('Cache-Control')||'public')+', no-transform');h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','same-origin');h.set('Content-Security-Policy',"frame-ancestors 'none'; object-src 'none'; base-uri 'self'");h.set('X-Frame-Options','DENY');if(new URL(req.url).pathname.startsWith('/api/'))h.set('Cache-Control','private, no-store');return new Response(response.body,{status:response.status,headers:h});
 },
 async scheduled(_event:any,env:any){await cleanupMedia();await env.DB.batch([env.DB.prepare('DELETE FROM playback_leases WHERE expires_at<=?').bind(Date.now()),env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(Date.now()),env.DB.prepare('DELETE FROM auth_limits WHERE expires_at<=?').bind(Date.now())])}
};
