import {useState} from 'react';
import {Share2,Check,Copy} from 'lucide-react';
import {filmShareUrl} from '../lib/film-share';
export default function ShareFilm({film}:{film:any}){
 const [copied,setCopied]=useState(false),[fallback,setFallback]=useState(false),[busy,setBusy]=useState(false);
 if(!film?.published)return null;
 const url=filmShareUrl(film.id);
 async function share(){setBusy(true);try{if(navigator.share&&matchMedia('(pointer: coarse)').matches){await navigator.share({title:film.title+' | Hot AI Drama',text:'Cùng xem '+film.title+' trên Hot AI Drama',url});return}await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),3000)}catch(e:any){if(e.name!=='AbortError')setFallback(true)}finally{setBusy(false)}}
 return <span className="film-share"><button className="mini film-share-button" disabled={busy} onClick={()=>void share()} title="Chia sẻ bộ phim này" aria-label="Chia sẻ phim">{copied?<Check size={18}/>:<Share2 size={18}/>}<span>{copied?'Đã sao chép link':'Chia sẻ'}</span></button>{fallback&&<span className="film-share-fallback"><label>Link phim<input readOnly value={url} onFocus={e=>e.currentTarget.select()}/></label><button className="mini" onClick={()=>{void navigator.clipboard?.writeText(url).then(()=>setCopied(true)).catch(()=>{})}}><Copy size={16}/> Sao chép</button><button className="mini" onClick={()=>setFallback(false)}>Đóng</button></span>}</span>;
}
