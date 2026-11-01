import {env} from 'cloudflare:workers';
const db=()=> (env as any).DB;
export type AffiliateRule={id:string;episode:number;url:string};
export async function affiliateConfig(){const row=await db().prepare("SELECT value FROM settings WHERE key='affiliate'").first();return row?JSON.parse(row.value):{enabled:false,rules:[]};}
export function validateAffiliate(value:any){
 if(typeof value.enabled!=='boolean'||!Array.isArray(value.rules)||value.rules.length>50)throw Error('Cấu hình Affiliate không hợp lệ');
 const seen=new Set<number>();
 const rules:AffiliateRule[]=value.rules.map((r:any)=>{const episode=Number(r.episode);let url:URL;try{url=new URL(r.url)}catch{throw Error('Link Affiliate không hợp lệ')}
 if(!Number.isSafeInteger(episode)||episode<1||episode>1000000||seen.has(episode))throw Error('Số tập phải là số nguyên dương và không trùng nhau');
 if(url.protocol!=='https:'||url.username||url.password||url.href.length>2048)throw Error('Link Affiliate phải dùng HTTPS');seen.add(episode);
 return {id:typeof r.id==='string'&&/^[a-f0-9-]{36}$/.test(r.id)?r.id:crypto.randomUUID(),episode,url:url.href};});
 return {enabled:value.enabled,rules:rules.sort((a,b)=>a.episode-b.episode)};
}
export async function affiliateActor(req:Request,user:any){if(user)return 'user:'+user.userId;const value=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-hotai_aff='))?.split('=')[1];return value&&/^[a-f0-9-]{36}$/.test(value)?'guest:'+value:'';}
export async function affiliateGate(req:Request,user:any,ep:any){
 const config=await affiliateConfig();if(!config.enabled)return null;
 const actor=await affiliateActor(req,user);
 const rows=actor?(await db().prepare('SELECT rule_id FROM affiliate_clicks WHERE actor=? AND series_id=?').bind(actor,ep.series_id).all()).results:[];
 const done=new Set(rows.map((r:any)=>r.rule_id));return config.rules.find((r:AffiliateRule)=>r.episode<=ep.number&&!done.has(r.id+':'+r.url))||null;
}
