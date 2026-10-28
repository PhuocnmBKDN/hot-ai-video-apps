// Deduplicate simultaneous reads only. No cached balances or permissions.
const inflight=new Map<string,Promise<any>>();
export function readApi(path:string):Promise<any>{
 const existing=inflight.get(path);if(existing)return existing;
 const task=fetch(path,{cache:'no-store'}).then(async response=>{const data:any=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Không tải được dữ liệu'),{status:response.status});return data});
 inflight.set(path,task);void task.finally(()=>{if(inflight.get(path)===task)inflight.delete(path)}).catch(()=>{});return task;
}
