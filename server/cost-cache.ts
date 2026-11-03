// Bounded isolate-local caches. No sessions, balances, entitlements or private data.
const stores=new WeakMap<object,Map<string,{until:number;value:any}>>();
const pending=new WeakMap<object,Map<string,Promise<any>>>();
export async function cachedRead<T>(owner:object,key:string,ttl:number,load:()=>Promise<T>):Promise<T>{
 let entries=stores.get(owner);if(!entries){entries=new Map();stores.set(owner,entries)}
 const hit=entries.get(key);if(hit&&hit.until>Date.now())return hit.value;
 let jobs=pending.get(owner);if(!jobs){jobs=new Map();pending.set(owner,jobs)}
 if(jobs.has(key))return jobs.get(key)!;
 const task=load().then(value=>{if(entries!.size>=256)entries!.delete(entries!.keys().next().value!);entries!.set(key,{until:Date.now()+ttl,value});return value});jobs.set(key,task);
 try{return await task}finally{jobs.delete(key)}
}
const views=new Map<string,number>();
export function allowView(key:string,now=Date.now()){
 const until=views.get(key)||0;if(until>now)return false;
 if(views.size>=4096)views.delete(views.keys().next().value!);
 views.set(key,now+30*60000);return true;
}
