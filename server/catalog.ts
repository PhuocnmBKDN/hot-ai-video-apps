import {GENRES} from '../lib/genres';
type Entry={revision:string;expires:number;data:any};
const caches=new WeakMap<object,Map<boolean,Entry>>();
const pending=new WeakMap<object,Map<string,Promise<any>>>();

export async function catalogBase(db:any,drafts:boolean){
 const revision=String((await db.prepare("SELECT value FROM settings WHERE key='catalog_revision'").first())?.value||'0');
 let cache=caches.get(db);if(!cache){cache=new Map();caches.set(db,cache)}
 const hit=cache.get(drafts);if(hit&&hit.revision===revision&&hit.expires>Date.now())return hit.data;
 let inflight=pending.get(db);if(!inflight){inflight=new Map();pending.set(db,inflight)}
 const key=revision+':'+drafts;const existing=inflight.get(key);if(existing)return existing;
 const load=(async()=>{
  const [filmRows,episodeRows,settingsRows,buyerRows]=await Promise.all([
   db.prepare('SELECT id,title,description,genre,paid_from,created_at,updated_at,published,first_published_at,view_count FROM series WHERE deleted_at IS NULL AND (published=1 OR ?=1) ORDER BY created_at DESC').bind(drafts?1:0).all(),
   db.prepare('SELECT e.id,e.series_id,e.number FROM episodes e JOIN series s ON s.id=e.series_id WHERE s.deleted_at IS NULL AND (s.published=1 OR ?=1) ORDER BY e.series_id,e.number').bind(drafts?1:0).all(),
   db.prepare("SELECT key,value FROM settings WHERE key LIKE 'price:%' OR key LIKE 'poster:%' OR key IN ('payment_recipient','qr','genres')").all(),
   db.prepare("SELECT series_id,count(*) AS buyers,sum(CASE WHEN created_at>=? THEN 1 ELSE 0 END) AS hotScore FROM orders WHERE status='paid' GROUP BY series_id").bind(Date.now()-7*86400000).all()
  ]);
  const settings=new Map<string,string>(settingsRows.results.map((r:any)=>[r.key,r.value]));
  const episodes=new Map<string,any[]>();for(const e of episodeRows.results){const rows=episodes.get(e.series_id)||[];rows.push({id:e.id,number:e.number});episodes.set(e.series_id,rows)}
  const buyers=new Map(buyerRows.results.map((r:any)=>[r.series_id,r]));
  const films=filmRows.results.map((f:any)=>{const stats:any=buyers.get(f.id),list=episodes.get(f.id)||[];return {...f,price:Number(settings.get('price:'+f.id)||10000),poster:!!settings.get('poster:'+f.id),posterFromEpisodeOne:settings.get('poster:frame:'+f.id)!=='no',buyers:stats?.buyers||0,hotScore:stats?.hotScore||0,episodes:list,total:list.length}});
  let recipient=null,genres:any;try{recipient=JSON.parse(settings.get('payment_recipient')||'null')}catch{}try{genres=JSON.parse(settings.get('genres')||'null')}catch{}
  if(!Array.isArray(genres))genres=[...new Set([...GENRES,...films.flatMap((f:any)=>f.genre.split(',').map((g:string)=>g.trim()).filter(Boolean))])].sort((a:any,b:any)=>a.localeCompare(b,'vi'));
  const data={films,genres,recipient,checkoutReady:!!recipient&&!!settings.get('qr')};
  // Bounded, isolate-local, 30s TTL also ages out rolling seven-day rankings.
  if(JSON.stringify(data).length<=2_000_000)cache!.set(drafts,{revision,expires:Date.now()+30000,data});
  return data;
 })();inflight.set(key,load);try{return await load}finally{inflight.delete(key)}
}
