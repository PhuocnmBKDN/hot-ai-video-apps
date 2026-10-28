type Metadata={size:number;etag?:string;httpEtag?:string};
const stores=new WeakMap<object,Map<string,{expires:number;data:Metadata}>>();
const pending=new WeakMap<object,Map<string,Promise<Metadata|null>>>();
export function forgetMediaMetadata(bucket:object,key:string){stores.get(bucket)?.delete(key)}
export async function mediaMetadata(bucket:any,key:string):Promise<Metadata|null>{
 let cache=stores.get(bucket);if(!cache){cache=new Map();stores.set(bucket,cache)}
 const hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.data;
 let inflight=pending.get(bucket);if(!inflight){inflight=new Map();pending.set(bucket,inflight)}
 const existing=inflight.get(key);if(existing)return existing;
 const load=(async()=>{const value=await bucket.head(key);if(!value)return null;
  const data={size:value.size,etag:value.etag,httpEtag:value.httpEtag};
  if(cache!.size>=512)cache!.delete(cache!.keys().next().value!);
  cache!.set(key,{expires:Date.now()+300000,data});return data;
 })();inflight.set(key,load);try{return await load}finally{inflight.delete(key)}
}
