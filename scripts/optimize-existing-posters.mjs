import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const origin=process.env.APP_ORIGIN||'https://hotai.bro.io.vn';
const bucket=process.env.R2_BUCKET||'hot-ai-drama-media';
const backupRoot=process.env.POSTER_BACKUP_DIR||path.resolve('..','work','poster-optimization','originals',String(Date.now()));
const outputRoot=path.resolve('..','work','poster-optimization','optimized');
const wrangler=path.resolve('node_modules','wrangler','bin','wrangler.js');
await mkdir(backupRoot,{recursive:true});await mkdir(outputRoot,{recursive:true});

const response=await fetch(origin+'/api/catalog');
if(!response.ok)throw Error('Không đọc được catalog: '+response.status);
const {films=[]}=await response.json();
let before=0,after=0,changed=0;
for(const film of films){
 let source,key,contentType,extension;
 if(film.posterFromEpisodeOne!==false){
  const thumbnail=await fetch(origin+'/api/thumbnail/'+encodeURIComponent(film.id)+'?v=poster-opt');
  if(thumbnail.ok){source=thumbnail;key='previews/'+film.id+'.jpg';contentType='image/jpeg';extension='jpg'}
 }
 if(!source){
  const poster=await fetch(origin+'/api/poster/'+encodeURIComponent(film.id)+'?v=poster-opt');
  if(!poster.ok){console.log('SKIP',film.id,'không có poster');continue}
  source=poster;key='posters/'+film.id;contentType='image/webp';extension='webp';
 }
 const input=Buffer.from(await source.arrayBuffer());before+=input.length;
 if(input.length<300*1024){after+=input.length;console.log('KEEP',film.id,Math.round(input.length/1024)+' KB');continue}
 const safe=film.id.replace(/[^a-zA-Z0-9._-]/g,'_');
 const originalType=(source.headers.get('content-type')||'image/jpeg').split('/')[1].replace('jpeg','jpg');
 await writeFile(path.join(backupRoot,safe+'.'+originalType),input);
 const image=sharp(input,{failOn:'warning'}).rotate().resize({width:1080,height:1440,fit:'inside',withoutEnlargement:true});
 const optimized=contentType==='image/jpeg'?await image.jpeg({quality:82,progressive:true,mozjpeg:true}).toBuffer():await image.webp({quality:82,effort:4,smartSubsample:true}).toBuffer();
 after+=optimized.length;
 if(optimized.length>=input.length*.96){console.log('KEEP',film.id,Math.round(input.length/1024)+' KB');continue}
 const output=path.join(outputRoot,safe+'.'+extension);await writeFile(output,optimized);
 execFileSync(process.execPath,[wrangler,'r2','object','put',bucket+'/'+key,'--remote','--file',output,'--content-type',contentType],{stdio:'pipe',env:{...process.env,CLOUDFLARE_SEND_METRICS:'false'}});
 changed++;console.log('OK',film.id,Math.round(input.length/1024)+' → '+Math.round(optimized.length/1024)+' KB');
}
console.log(JSON.stringify({films:films.length,changed,beforeBytes:before,optimizedBytes:after,backupRoot},null,2));
