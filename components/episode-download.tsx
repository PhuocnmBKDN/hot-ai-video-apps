import {useEffect,useRef,useState} from 'react';
import {zipDownload,safeDownloadName} from '../server/download-zip';
export default function EpisodeDownload({film,episodes,selected,busy,onBusy}:{film:any;episodes:any[];selected:string[];busy:boolean;onBusy:(value:boolean)=>void}){
 const [running,setRunning]=useState(false),[message,setMessage]=useState('');const abort=useRef<AbortController|null>(null);
 useEffect(()=>()=>{abort.current?.abort()},[]);
 const url=(number:number)=>'/api/admin/download?'+new URLSearchParams({seriesId:film.id,episodes:String(number)});
 async function download(all:boolean){
  const rows=[...episodes].filter(e=>all||selected.includes(e.id)).sort((a,b)=>a.number-b.number);if(!rows.length)return;
  if(rows.length===1){location.assign(url(rows[0].number));return}
  setRunning(true);onBusy(true);setMessage('Đang chuẩn bị ZIP…');const controller=new AbortController();abort.current=controller;let writer:any=null;
  try{
   const name=safeDownloadName(film.title)+(all?' - Tron bo':' - Cac tap da chon')+'.zip';const picker=(window as any).showSaveFilePicker;
   if(picker){const handle=await picker.call(window,{suggestedName:name,types:[{description:'ZIP archive',accept:{'application/zip':['.zip']}}]});writer=await handle.createWritable()}
   let count=0;const stream=zipDownload({get:async(key:string)=>{if(controller.signal.aborted)throw Error('Đã hủy tải.');const episode=rows.find(e=>e.id===key)!;setMessage(`Đang tải tập ${episode.number} · ${++count}/${rows.length}`);const r=await fetch(url(episode.number),{signal:controller.signal,cache:'no-store'});if(!r.ok){const data:any=await r.json().catch(()=>({}));throw Error(data.error||'Không tải được tập '+episode.number)}return {body:r.body}}},rows.map(e=>({key:e.id,name:safeDownloadName(film.title)+' - Tap '+String(e.number).padStart(3,'0')+'.mp4'})));
   const reader=stream.getReader();const chunks:Uint8Array[]=[];let bytes=0;
   try{while(true){if(controller.signal.aborted)throw Error('Đã hủy tải.');const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(writer)await writer.write(value);else{if(bytes>256*1024*1024)throw Error('ZIP vượt 256 MB. Hãy tải ít tập hơn hoặc dùng Chrome/Edge trên PC để lưu bộ lớn theo luồng.');chunks.push(value)}}}finally{await reader.cancel().catch(()=>{})}
   if(writer){await writer.close();writer=null}else{const blob=new Blob(chunks as BlobPart[],{type:'application/zip'}),link=document.createElement('a'),objectUrl=URL.createObjectURL(blob);link.href=objectUrl;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),60000)}setMessage('Đã tạo ZIP thành công.');
  }catch(e:any){await writer?.abort?.().catch(()=>{});setMessage(controller.signal.aborted||e.name==='AbortError'?'Đã hủy tải.':e.message||'Chưa tải được phim. Vui lòng thử lại.')}finally{abort.current=null;setRunning(false);onBusy(false)}
 }
 return <><button className="mini" disabled={busy||running||!selected.length} onClick={()=>void download(false)}>Tải {selected.length} tập đã chọn</button><button className="mini" disabled={busy||running||!episodes.length} onClick={()=>void download(true)}>Tải cả bộ phim</button>{running&&<button className="mini" onClick={()=>abort.current?.abort()}>Hủy tải</button>}{message&&<span role="status">{message}</span>}</>;
}
