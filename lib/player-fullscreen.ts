// Native iPhone fullscreen displays only the <video>, hiding HTML gate/error UI.
export async function revealPlayerOverlay(video:HTMLVideoElement|null){
 const native=video as (HTMLVideoElement&{webkitDisplayingFullscreen?:boolean;webkitPresentationMode?:string;webkitExitFullscreen?:()=>void;webkitSetPresentationMode?:(mode:string)=>void})|null;
 try{if(native?.webkitDisplayingFullscreen||native?.webkitPresentationMode==='fullscreen'){
  if(native.webkitExitFullscreen)native.webkitExitFullscreen();
  else native.webkitSetPresentationMode?.('inline');
 }}catch{try{native?.webkitSetPresentationMode?.('inline')}catch{}}
 const page=document as Document&{webkitFullscreenElement?:Element;webkitExitFullscreen?:()=>void};
 try{if(page.fullscreenElement)await page.exitFullscreen();else if(page.webkitFullscreenElement)page.webkitExitFullscreen?.()}catch{}
}
