(function(){
 var ready=false,timer,hiddenAt=0,key='hotai-boot-retry';
 function recover(){
  if(!navigator.onLine)return;
  var last=0;try{last=Number(sessionStorage.getItem(key)||0)}catch(e){}
  if(Date.now()-last<120000){var message=document.getElementById('boot-message');if(message)message.textContent='Chưa tải được ứng dụng. Hãy kiểm tra mạng rồi bấm Tải lại.';return}
  try{sessionStorage.setItem(key,String(Date.now()))}catch(e){return}
  location.reload();
 }
 function check(){clearTimeout(timer);timer=setTimeout(function(){if(!ready||!document.getElementById('root')?.hasChildNodes())recover()},20000)}
 window.addEventListener('hotai-ready',function(){ready=true;clearTimeout(timer)});
 window.addEventListener('vite:preloadError',function(event){event.preventDefault();recover()});
 window.addEventListener('hotai-boot-error',recover);
 window.addEventListener('pageshow',function(){check()});
 window.addEventListener('online',function(){if(!ready)recover();else check()});
 document.addEventListener('visibilitychange',function(){if(document.hidden){hiddenAt=Date.now();clearTimeout(timer)}else{if(hiddenAt&&Date.now()-hiddenAt>60000&&!document.getElementById('root')?.hasChildNodes())recover();else check()}});
 check();
})();
