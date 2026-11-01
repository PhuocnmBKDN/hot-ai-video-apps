const KEY='hotai-affiliate-return';
export function leaveForAffiliate(episodeId:string,target:string){
 const url=new URL(target);if(url.protocol!=='https:')throw Error('Liên kết đối tác không hợp lệ');
 const back=new URL(location.href);back.searchParams.set('episode',episodeId);
 history.replaceState(history.state,'',back.href);
 try{sessionStorage.setItem(KEY,JSON.stringify({episodeId,at:Date.now()}))}catch{}
 // Navigate from the actual app document: no about:blank tab remains after an app deep link.
 location.assign(url.href);
}
export function consumeAffiliateReturn(episodeId:string){
 try{const saved=JSON.parse(sessionStorage.getItem(KEY)||'null');if(!saved||saved.episodeId!==episodeId)return false;sessionStorage.removeItem(KEY);return Date.now()-saved.at<7200000}catch{return false}
}
