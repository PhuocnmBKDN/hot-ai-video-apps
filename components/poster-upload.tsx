import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ClipboardPaste,ImagePlus} from 'lucide-react';

const imageTypes=['image/png','image/jpeg','image/webp'];
async function decodePoster(image:File){
 if(typeof createImageBitmap==='function'){
  const bitmap=await createImageBitmap(image);
  return {width:bitmap.width,height:bitmap.height,draw:(context:CanvasRenderingContext2D,width:number,height:number)=>context.drawImage(bitmap,0,0,width,height),close:()=>bitmap.close()};
 }
 const url=URL.createObjectURL(image),element=new Image();
 try{
  await new Promise<void>((resolve,reject)=>{element.onload=()=>resolve();element.onerror=()=>reject(Error('Không đọc được kích thước ảnh poster.'));element.src=url});
  return {width:element.naturalWidth,height:element.naturalHeight,draw:(context:CanvasRenderingContext2D,width:number,height:number)=>context.drawImage(element,0,0,width,height),close:()=>URL.revokeObjectURL(url)};
 }catch(error){URL.revokeObjectURL(url);throw error}
}
async function optimizePoster(image:File){
 const decoded=await decodePoster(image),limit=1440,scale=Math.min(1,limit/Math.max(decoded.width,decoded.height));
 if(scale===1&&image.type==='image/webp'&&image.size<500*1024){decoded.close();return image}
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(decoded.width*scale));canvas.height=Math.max(1,Math.round(decoded.height*scale));
 const context=canvas.getContext('2d');if(!context){decoded.close();throw Error('Không thể tối ưu ảnh trên thiết bị này.')}
 decoded.draw(context,canvas.width,canvas.height);decoded.close();
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.82));if(!blob)throw Error('Không thể tối ưu ảnh poster.');
 return new File([blob],image.name.replace(/\.[^.]+$/,'.webp'),{type:'image/webp'});
}
export default function PosterUpload({filmId,fromEpisodeOne,busy,setBusy,onComplete}:{filmId:string;fromEpisodeOne:boolean;busy:boolean;setBusy:(value:boolean)=>void;onComplete:()=>Promise<void>}){
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[message,setMessage]=useState('');
 const picker=useRef<HTMLInputElement>(null),pasteArea=useRef<HTMLDivElement>(null),working=useRef(false);
 useEffect(()=>{if(!file){setPreview('');return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
 async function choose(image:File){
  if(busy||working.current)return;
  if(!imageTypes.includes(image.type)){setMessage('Chỉ nhận ảnh PNG, JPEG hoặc WebP.');return}
  if(!image.size||image.size>5*1024*1024){setMessage('Ảnh phải có dung lượng lớn hơn 0 và không quá 5 MB.');return}
  working.current=true;setBusy(true);setMessage('Đang tối ưu ảnh poster…');
  try{const optimized=await optimizePoster(image);setFile(optimized);setMessage('Ảnh đã được chuẩn hóa WebP cho màn hình Retina. Bấm Lưu poster để tải lên.')}catch(error:any){setMessage(error.message||'Không đọc được ảnh poster.')}
  finally{working.current=false;setBusy(false)}
 }
 async function paste(){
  if(busy||working.current)return;
  if(!navigator.clipboard?.read){setMessage('Trình duyệt chưa hỗ trợ nút dán. Bấm vào ô dán ảnh rồi nhấn Ctrl+V hoặc chọn tệp.');pasteArea.current?.focus();return}
  working.current=true;setBusy(true);
  try{
   const items=await navigator.clipboard.read();let image:File|null=null;
   for(const item of items){const type=imageTypes.find(t=>item.types.includes(t));if(type){const blob=await item.getType(type);image=new File([blob],'poster-clipboard.'+(type==='image/jpeg'?'jpg':type.split('/')[1]),{type});break}}
   if(!image){setMessage('Clipboard chưa có ảnh PNG, JPEG hoặc WebP. Hãy sao chép ảnh trước.');return}
   if(!image.size||image.size>5*1024*1024){setMessage('Ảnh phải có dung lượng lớn hơn 0 và không quá 5 MB.');return}
   const optimized=await optimizePoster(image);setFile(optimized);setMessage('Ảnh đã dán và tối ưu. Bấm Lưu poster để tải lên.');
  }catch{setMessage('Không đọc được clipboard. Cho phép trình duyệt đọc clipboard, hoặc bấm vào ô dán ảnh rồi nhấn Ctrl+V.');pasteArea.current?.focus()}
  finally{working.current=false;setBusy(false)}
 }
 async function upload(event:FormEvent){
  event.preventDefault();if(!file||busy||working.current)return;working.current=true;setBusy(true);setMessage('Đang tải poster…');
  try{
   const response=await fetch('/api/admin/poster?'+new URLSearchParams({seriesId:filmId}),{method:'POST',headers:{'Content-Type':file.type},body:file});
   const result:any=await response.json();if(!response.ok)throw Error(result.error||'Không tải được poster.');
   setFile(null);if(picker.current)picker.current.value='';setMessage('Đã lưu poster.');await onComplete();
  }catch(error:any){setMessage(error.message||'Không tải được poster. Vui lòng thử lại.')}
  finally{working.current=false;setBusy(false)}
 }
 return <form className="poster-upload" onSubmit={upload}>
  <label>Ảnh dọc · tối đa 5 MB · tự động WebP tối đa 1440 px<input ref={picker} type="file" accept={imageTypes.join(',')} disabled={busy} onChange={e=>{const image=e.currentTarget.files?.[0];if(image)void choose(image);e.currentTarget.value=''}}/></label>
  <div className="poster-paste-area" ref={pasteArea} tabIndex={0} role="group" aria-label="Dán ảnh poster bằng Ctrl+V hoặc Command+V" aria-disabled={busy} onPaste={e=>{if(busy||working.current)return;const image=Array.from(e.clipboardData.items).filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).find(Boolean)||Array.from(e.clipboardData.files).find(item=>item.type.startsWith('image/'));if(image){e.preventDefault();void choose(image)}else setMessage('Clipboard chưa có ảnh. Hãy sao chép ảnh rồi dán lại.')}}>
   <ImagePlus size={24} aria-hidden="true"/><span>Bấm vào đây rồi dán ảnh bằng Ctrl+V / ⌘V</span>
   <button type="button" className="mini" disabled={busy} onClick={()=>void paste()}><ClipboardPaste size={17} aria-hidden="true"/>Dán từ clipboard</button>
  </div>
  {file&&<figure className="poster-upload-preview">{preview&&<img src={preview} alt="Ảnh poster mới, chưa lưu"/>}<figcaption>{file.name} · {(file.size/1024/1024).toLocaleString('vi-VN',{maximumFractionDigits:2})} MB</figcaption><button type="button" className="mini" disabled={busy} onClick={()=>{setFile(null);setMessage('Đã bỏ ảnh đã chọn.')}}>Bỏ ảnh đã chọn</button></figure>}
  {file&&fromEpisodeOne&&<p className="muted">Phim đang ưu tiên ảnh từ tập 1. Bỏ tích tùy chọn phía trên nếu muốn hiển thị poster tải lên này.</p>}
  <button className="mini" disabled={busy||!file}>Lưu poster ↑</button><p role="status">{message}</p>
 </form>
}
