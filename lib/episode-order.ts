const collator=new Intl.Collator('vi',{numeric:true,sensitivity:'base'});
export function compareEpisodeFiles(a:{name:string},b:{name:string}){const stem=(name:string)=>name.normalize('NFC').replace(/\.mp4$/i,'').trim();return collator.compare(stem(a.name),stem(b.name))||a.name.localeCompare(b.name,'vi')}

export function nextEpisodeNumber(episodes:{number:number}[]){return episodes.reduce((max,ep)=>Number.isSafeInteger(ep.number)&&ep.number>max?ep.number:max,0)+1}
