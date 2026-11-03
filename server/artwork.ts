// Authorize publication on every request; only image bytes are shared at edge.
export async function artworkResponse(req:Request,db:any,bucket:any,admin:boolean|(()=>Promise<boolean>)){
 const url=new URL(req.url),parts=url.pathname.split('/'),thumbnail=parts[2]==='thumbnail';
 const f=await db.prepare("SELECT id,published,artwork_version,(SELECT value FROM settings WHERE key='poster:frame:'||series.id) AS poster_frame FROM series WHERE id=? AND deleted_at IS NULL").bind(parts[3]).first();
 if(!f||(!f.published&&!(typeof admin==='function'?await admin():admin)))return Response.json({error:'Không tìm thấy ảnh'},{status:404});
 const cache=typeof caches!=='undefined'?(caches as unknown as {default:Cache}).default:null;
 const key=new Request(url.origin+'/__artwork/'+(thumbnail?'thumbnail/':'poster/')+encodeURIComponent(f.id)+'/'+f.artwork_version);
 let response=f.published?await cache?.match(key):undefined;
 if(!response){
  const keys=thumbnail?['previews/'+f.id+'.jpg']:f.poster_frame==='no'?['posters/'+f.id,'previews/'+f.id+'.jpg']:['previews/'+f.id+'.jpg','posters/'+f.id];
  let obj:any=null;for(const objectKey of keys){obj=await bucket.get(objectKey);if(obj)break}
  if(!obj)return Response.json({error:'Ảnh chưa sẵn sàng'},{status:404});
  response=new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'image/jpeg','ETag':obj.httpEtag||'','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'}});
  if(f.published&&cache){try{await cache.put(key,response.clone())}catch{}}
 }
 const headers=new Headers(response.headers);const version=url.searchParams.get('v')?.match(/(?:^|-)(\d+)$/)?.[1];
 headers.set('Cache-Control',!f.published?'private, no-store':version===String(f.artwork_version)?'private, max-age=86400, immutable':'private, max-age=60');
 if(req.headers.get('if-none-match')&&req.headers.get('if-none-match')===headers.get('ETag'))return new Response(null,{status:304,headers});
 return new Response(response.body,{headers});
}
