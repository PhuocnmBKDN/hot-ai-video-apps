import {useEffect,useRef,useState} from 'react';
export default function AppUpdater(){
 const [version,setVersion]=useState(''),[working,setWorking]=useState(false);const reloading=useRef(false);
 function reload(){
  if(reloading.current)return;reloading.current=true;setWorking(true);
  const url=new URL(location.href),video=document.querySelector<HTMLVideoElement>('video[data-episode-id]');
  if(video?.dataset.episodeId){url.searchParams.set('episode',video.dataset.episodeId);history.replaceState(history.state,'',url.href)}
  location.reload();
 }
 useEffect(()=>{
  const current=document.querySelector<HTMLMetaElement>('meta[name="hotai-version"]')?.content;if(!current)return;
  let alive=true,last=0,checking=false,registration:ServiceWorkerRegistration|undefined;const abort=new AbortController();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(r=>{registration=r;void r.update().catch(()=>{})}).catch(()=>{});
  async function check(){
   if(!alive||checking||document.visibilityState!=='visible'||!navigator.onLine||Date.now()-last<60000)return;
   checking=true;last=Date.now();
   try{const response=await fetch('/version.json',{cache:'no-store',signal:abort.signal});if(!response.ok)return;const value:any=await response.json();if(!alive||typeof value.version!=='string'||value.version===current)return;
    setVersion(value.version);void registration?.update().catch(()=>{});
    const viewing=!!document.querySelector('[role="dialog"][aria-modal="true"]');const editing=document.activeElement?.matches('input,textarea,select');const videos=Array.from(document.querySelectorAll('video'));const playing=videos.some(v=>!v.paused&&!v.ended);
    if(location.pathname==='/'&&!viewing&&!editing&&!playing)reload();
   }catch{}finally{checking=false}
  }
  const onVisible=()=>{void check()};window.addEventListener('pageshow',onVisible);window.addEventListener('focus',onVisible);window.addEventListener('online',onVisible);document.addEventListener('visibilitychange',onVisible);const timer=setInterval(onVisible,300000);onVisible();
  return()=>{alive=false;abort.abort();clearInterval(timer);window.removeEventListener('pageshow',onVisible);window.removeEventListener('focus',onVisible);window.removeEventListener('online',onVisible);document.removeEventListener('visibilitychange',onVisible)};
 },[]);
 if(!version)return null;
 return <aside className="app-update-banner" role="status"><span><b>Có phiên bản mới</b><small>Cập nhật để nhận giao diện và tính năng mới nhất.</small></span><button className="mini" disabled={working} onClick={reload}>{working?'Đang cập nhật…':'Cập nhật'}</button></aside>;
}
