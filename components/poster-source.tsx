import {useEffect,useRef,useState} from 'react';

async function firstFrame(episodeId:string){
 const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';let token='';
 try{
  const session=await fetch('/api/playback/'+encodeURIComponent(episodeId),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device:crypto.randomUUID()})});
  const result:any=await session.json();if(!session.ok)throw Error(result.error||'Không mở được tập 1 để lấy ảnh.');token=result.token;
  return await new Promise<Blob>((resolve,reject)=>{
   const timeout=setTimeout(()=>finish(Error('Video tập 1 tải quá lâu. Hãy thử lại.')),20000);
   function finish(error?:Error,image?:Blob){clearTimeout(timeout);video.onloadeddata=null;video.onerror=null;error?reject(error):image?resolve(image):reject(Error('Không tạo được ảnh từ video.'))}
   video.onloadeddata=()=>{try{const canvas=document.createElement('canvas');canvas.width=480;canvas.height=Math.max(1,Math.round(video.videoHeight*480/video.videoWidth));const context=canvas.getContext('2d');if(!context)throw Error('Không tạo được ảnh từ video.');context.drawImage(video,0,0,canvas.width,canvas.height);canvas.toBlob(image=>finish(undefined,image||undefined),'image/jpeg',.82)}catch(error:any){finish(error)}};
   video.onerror=()=>finish(Error('Không đọc được video tập 1 để lấy ảnh.'));video.src=result.src;video.load();
  });
 }finally{
  video.pause();video.removeAttribute('src');video.load();
  if(token)void fetch('/api/playback-control/release',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),keepalive:true}).catch(()=>{});
 }
}

export default function PosterSource({film,episodes,busy,setBusy,action,onComplete}:{film:any;episodes:any[];busy:boolean;setBusy:(value:boolean)=>void;action:(path:string,body:any)=>Promise<boolean>;onComplete:()=>Promise<void>}){
 const [status,setStatus]=useState('');const started=useRef(false);const episodeOne=episodes.find(e=>e.number===1);
 async function createFrame(){if(!episodeOne)throw Error('Phim chưa có tập 1 nên chưa thể lấy khung hình làm poster.');const image=await firstFrame(episodeOne.id);const response=await fetch('/api/admin/thumbnail?seriesId='+encodeURIComponent(film.id),{method:'POST',headers:{'Content-Type':'image/jpeg'},body:image});const result:any=await response.json();if(!response.ok)throw Error(result.error||'Không lưu được khung hình tập 1.')}
 async function enableFrame(savePreference:boolean){
  if(busy)return;setBusy(true);setStatus('Đang lấy khung hình đầu của tập 1…');
  try{await createFrame();if(savePreference&&!await action('poster-source',{seriesId:film.id,fromEpisodeOne:true}))throw Error('Không lưu được lựa chọn poster.');if(!savePreference)await onComplete();setStatus('Đã lấy và sử dụng khung hình đầu của tập 1.')}
  catch(error:any){setStatus(error.message||'Không lấy được khung hình tập 1.');await onComplete()}
  finally{setBusy(false)}
 }
 useEffect(()=>{if(busy||film.posterFromEpisodeOne===false||film.preview||!episodeOne||started.current)return;started.current=true;void enableFrame(false)},[busy,film.id,film.posterFromEpisodeOne,film.preview,episodeOne?.id]);
 return <div className="poster-source-control"><label className="poster-source-option"><input type="checkbox" checked={film.posterFromEpisodeOne!==false} disabled={busy} onChange={e=>{if(e.target.checked)void enableFrame(true);else void action('poster-source',{seriesId:film.id,fromEpisodeOne:false})}}/><span>Lấy khung hình đầu của tập 1 làm poster</span></label><p className="muted">Khi tích chọn, hệ thống tạo ảnh mới trực tiếp từ video tập 1. Bỏ tích để dùng poster đã tải lên; ảnh tải lên vẫn được giữ.</p>{film.posterFromEpisodeOne!==false&&!film.preview&&episodeOne&&<p className="muted">Chưa có ảnh khung hình tập 1; hệ thống sẽ tự tạo.</p>}{film.posterFromEpisodeOne!==false&&!episodeOne&&<p className="muted">Cần tải tập 1 trước khi dùng lựa chọn này.</p>}<p role="status">{status}</p></div>;
}
