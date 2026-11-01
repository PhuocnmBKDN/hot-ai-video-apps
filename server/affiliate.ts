import {env} from 'cloudflare:workers';
const db=()=> (env as any).DB;
export type AffiliateRule={id:string;episode?:number;episodes?:number[];legacyEpisode?:number;url:string;title?:string;image?:string};
export async function affiliateConfig(){const row=await db().prepare("SELECT value FROM settings WHERE key='affiliate'").first();return row?JSON.parse(row.value):{enabled:false,rules:[]};}
export function validateAffiliate(value:any){
 if(typeof value.enabled!=='boolean'||!Array.isArray(value.rules)||value.rules.length>50)throw Error('Cấu hình Affiliate không hợp lệ');
 const seen=new Set<number>();
 const rules:AffiliateRule[]=value.rules.map((r:any)=>{const raw=r.episodeText??r.episodes??r.episode;const parts=Array.isArray(raw)?raw:typeof raw==='string'?raw.trim().split(/[,;\s]+/):[raw];
 if(!parts.length||parts.length>200)throw Error('Mỗi link cần từ 1 đến 200 mốc tập');
 const episodes=parts.map((x:any)=>{if(!/^\d+$/.test(String(x)))throw Error('Nhập số tập cách nhau bằng dấu phẩy, ví dụ: 5, 10, 15');const n=Number(x);if(!Number.isSafeInteger(n)||n<1||n>1000000||seen.has(n))throw Error('Số tập phải từ 1 đến 1.000.000 và không trùng nhau');seen.add(n);return n}).sort((a:number,b:number)=>a-b);
 let url:URL;try{url=new URL(r.url)}catch{throw Error('Link Affiliate không hợp lệ')}
 if(url.protocol!=='https:'||url.username||url.password||url.href.length>2048)throw Error('Link Affiliate phải dùng HTTPS');
 const title=typeof r.title==='string'?r.title.trim().slice(0,200):'';const image=typeof r.image==='string'?r.image.trim():'';if(image){const img=new URL(image);if(img.protocol!=='https:'||img.username||img.password||image.length>2048)throw Error('Ảnh sản phẩm phải dùng link HTTPS');}
 return {id:typeof r.id==='string'&&/^[a-f0-9-]{36}$/.test(r.id)?r.id:crypto.randomUUID(),episodes,legacyEpisode:r.legacyEpisode??(r.episodes?undefined:r.episode),url:url.href,title,image};});
 return {enabled:value.enabled,rules:rules.sort((a,b)=>a.episodes![0]-b.episodes![0])};
}
function previewURL(value:string){const u=new URL(value);if(u.protocol!=='https:'||u.port||u.username||u.password||!['shopee.vn','shopee.com','shope.ee','tiktok.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw Error('Chỉ hỗ trợ lấy xem trước từ link Shopee hoặc TikTok');return u;}
function decode(value:string){return value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)));}
export async function affiliatePreview(value:string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));const key='affiliate-preview:'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 const saved=await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first();if(saved){try{const cache=JSON.parse(saved.value);if(cache.until>Date.now())return cache.data}catch{}}
 let data={title:'',image:''};
 try{let url=previewURL(value);const signal=AbortSignal.timeout(5000);let response:Response|undefined;
 for(let i=0;i<5;i++){response=await fetch(url.href,{redirect:'manual',signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; HotAIDramaPreview/1.0)','Accept':'text/html'}});if(response.status>=300&&response.status<400){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Thiếu link chuyển tiếp');url=previewURL(new URL(location,url).href);continue}break}
 if(!response?.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('Không có bản xem trước');
 const reader=response.body!.getReader();const chunks:Uint8Array[]=[];let size=0;try{while(true){const {done,value:chunk}=await reader.read();if(done)break;size+=chunk.length;if(size>524288)break;chunks.push(chunk)}}finally{await reader.cancel()}
 const html=chunks.map(c=>new TextDecoder().decode(c)).join('');const meta:Record<string,string>={};for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const attrs:Record<string,string>={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g))attrs[m[1].toLowerCase()]=decode(m[3]);if(attrs.property||attrs.name)meta[attrs.property||attrs.name]=attrs.content||'';}
 data.title=(meta['og:title']||meta['twitter:title']||decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]||'')).slice(0,200);
 const image=meta['og:image']||meta['twitter:image'];if(image){const u=new URL(image,url);if(u.protocol==='https:')data.image=u.href;}
 }catch{}
 await db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify({until:Date.now()+(data.image?86400000:3600000),data})).run();return data;
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
