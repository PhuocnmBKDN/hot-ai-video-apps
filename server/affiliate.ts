import {env} from 'cloudflare:workers';
const db=()=> (env as any).DB;
export type AffiliateRule={id:string;episode?:number;episodes?:number[];legacyEpisode?:number;url:string};
export async function affiliateConfig(){const row=await db().prepare("SELECT value FROM settings WHERE key='affiliate'").first();return row?JSON.parse(row.value):{enabled:false,rules:[]};}
export function validateAffiliate(value:any){
 if(typeof value.enabled!=='boolean'||!Array.isArray(value.rules)||value.rules.length>50)throw Error('Cấu hình Affiliate không hợp lệ');
 const seen=new Set<number>();
 const rules:AffiliateRule[]=value.rules.map((r:any)=>{const raw=r.episodeText??r.episodes??r.episode;const parts=Array.isArray(raw)?raw:typeof raw==='string'?raw.trim().split(/[,;\s]+/):[raw];
 if(!parts.length||parts.length>200)throw Error('Mỗi link cần từ 1 đến 200 mốc tập');
 const episodes=parts.map((x:any)=>{if(!/^\d+$/.test(String(x)))throw Error('Nhập số tập cách nhau bằng dấu phẩy, ví dụ: 5, 10, 15');const n=Number(x);if(!Number.isSafeInteger(n)||n<1||n>1000000||seen.has(n))throw Error('Số tập phải từ 1 đến 1.000.000 và không trùng nhau');seen.add(n);return n}).sort((a:number,b:number)=>a-b);
 let url:URL;try{url=new URL(r.url)}catch{throw Error('Link Affiliate không hợp lệ')}
 if(url.protocol!=='https:'||url.username||url.password||url.href.length>2048)throw Error('Link Affiliate phải dùng HTTPS');
 return {id:typeof r.id==='string'&&/^[a-f0-9-]{36}$/.test(r.id)?r.id:crypto.randomUUID(),episodes,legacyEpisode:r.legacyEpisode??(r.episodes?undefined:r.episode),url:url.href};});
 return {enabled:value.enabled,rules:rules.sort((a,b)=>a.episodes![0]-b.episodes![0])};
}
export async function affiliateActor(req:Request,user:any){if(user)return 'user:'+user.userId;const value=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-hotai_aff='))?.split('=')[1];return value&&/^[a-f0-9-]{36}$/.test(value)?'guest:'+value:'';}
export async function affiliateGate(req:Request,user:any,ep:any){
 const config=await affiliateConfig();if(!config.enabled)return null;
 const actor=await affiliateActor(req,user);
 const rows=actor?(await db().prepare('SELECT rule_id FROM affiliate_clicks WHERE actor=? AND series_id=?').bind(actor,ep.series_id).all()).results:[];
 const done=new Set(rows.map((r:any)=>r.rule_id));
 const milestones=config.rules.flatMap((r:AffiliateRule)=>(r.episodes??[r.episode!]).map(episode=>({...r,episode,id:!r.episodes||episode===r.legacyEpisode?r.id:r.id+'-'+episode}))).sort((a:any,b:any)=>a.episode-b.episode);
 return milestones.find((r:any)=>r.episode<=ep.number&&!done.has(r.id+':'+r.url))||null;
}
