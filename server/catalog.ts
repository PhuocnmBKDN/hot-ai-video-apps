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
   db.prepare('SELECT id,public_share_id,title,description,genre,paid_from,created_at,updated_at,published,first_published_at,view_count,artwork_version,episode_count FROM series WHERE deleted_at IS NULL AND (published=1 OR ?=1) ORDER BY created_at DESC').bind(drafts?1:0).all(),
   db.prepare('SELECT id AS series_id,episode_count AS total FROM series WHERE deleted_at IS NULL AND (published=1 OR ?=1)').bind(drafts?1:0).all(),
   db.prepare("SELECT key,value FROM settings WHERE key LIKE 'price:%' OR key LIKE 'poster:%' OR key IN ('payment_recipient','qr','genres','payment_features')").all(),
   Promise.resolve({results:[]})
  ]);
  const settings=new Map<string,string>(settingsRows.results.map((r:any)=>[r.key,r.value]));
  const episodes=new Map<string,number>(episodeRows.results.map((e:any)=>[e.series_id,e.total]));
  const buyers=new Map(buyerRows.results.map((r:any)=>[r.series_id,r]));
  const rawFeatures=JSON.parse(settings.get('payment_features')||'{}');const features={paidLock:rawFeatures.paidLock!==false,wallet:rawFeatures.wallet!==false};const films=filmRows.results.map((f:any)=>{const stats:any=buyers.get(f.id),count=episodes.get(f.id)||0;return {...f,paidLockEnabled:features.paidLock,price:Number(settings.get('price:'+f.id)||10000),poster:!!settings.get('poster:'+f.id),posterFromEpisodeOne:settings.get('poster:frame:'+f.id)!=='no',buyers:stats?.buyers||0,hotScore:stats?.hotScore||0,total:count}});
  let recipient=null,genres:any;try{recipient=JSON.parse(settings.get('payment_recipient')||'null')}catch{}try{genres=JSON.parse(settings.get('genres')||'null')}catch{}
  if(!Array.isArray(genres))genres=[...new Set([...GENRES,...films.flatMap((f:any)=>f.genre.split(',').map((g:string)=>g.trim()).filter(Boolean))])].sort((a:any,b:any)=>a.localeCompare(b,'vi'));
  const data={films,genres,recipient,features,checkoutReady:features.wallet&&!!recipient&&!!settings.get('qr')};
  // Bounded, isolate-local, 30s TTL also ages out rolling seven-day rankings.
  if(JSON.stringify(data).length<=2_000_000)cache!.set(drafts,{revision,expires:Date.now()+30000,data});
  return data;
 })();inflight.set(key,load);try{return await load}finally{inflight.delete(key)}
}
