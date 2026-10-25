import {env} from 'cloudflare:workers';
import {currentUser} from './auth';
export async function storageRoute(req:Request){const u=await currentUser(req);if(u?.role!=='admin')return Response.json({error:'Chỉ admin được quản lý kho phim'},{status:403});if(req.method!=='GET'||new URL(req.url).pathname!=='/api/admin/storage')return Response.json({error:'Không tìm thấy'},{status:404});return Response.json({provider:'r2',configured:!!(env as any).BUCKET,connected:!!(env as any).BUCKET},{headers:{'Cache-Control':'no-store'}});}
