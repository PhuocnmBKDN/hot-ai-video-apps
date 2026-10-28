type LocalStore=Pick<Storage,'getItem'>;
const id=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=100;
export function readLocalLibrary(storage?:LocalStore){
 const read=(key:string,fallback:any)=>{try{return JSON.parse((storage??globalThis.localStorage).getItem(key)||'null')??fallback}catch{return fallback}};
 const rawSaved=read('lt-saved',[]),rawHistory=read('lt-history',[]),rawWatched=read('lt-watched',{});
 const saved:string[]=Array.isArray(rawSaved)?[...new Set<string>(rawSaved.filter(id))].slice(0,1000):[];
 const history:any[]=Array.isArray(rawHistory)?rawHistory.filter(h=>h&&typeof h==='object'&&id(h.seriesId)&&id(h.episodeId)&&typeof h.title==='string'&&Number.isSafeInteger(h.number)&&h.number>0&&Number.isFinite(h.position)&&h.position>=0&&h.position<=86400&&Number.isFinite(h.at)).slice(0,100):[];
 const watched:Record<string,boolean>=Object.fromEntries(rawWatched&&typeof rawWatched==='object'&&!Array.isArray(rawWatched)?Object.entries(rawWatched).filter(([k,v])=>id(k)&&typeof v==='boolean').slice(0,10000).map(([k,v])=>[k,v as boolean]):[]);
 return {saved,history,watched};
}
