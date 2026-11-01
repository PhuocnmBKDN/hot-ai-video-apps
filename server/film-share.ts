import {filmShareUrl,sharedFilmId} from '../lib/film-share';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function filmSharePage(req:Request,env:any){
 const id=sharedFilmId(req.url);if(!id||id.length>64)return new Response('Không tìm thấy phim',{status:404});
 const film=await env.DB.prepare('SELECT id,title,description,updated_at FROM series WHERE id=? AND published=1 AND deleted_at IS NULL').bind(id).first();
 if(!film)return new Response('<!doctype html><html lang="vi"><meta charset="utf-8"><title>Phim chưa khả dụng</title><body style="background:#09090c;color:white;font:18px system-ui;padding:30px"><h1>Phim chưa khả dụng</h1><p>Bộ phim đã được ẩn hoặc không còn tồn tại.</p><a style="color:#ff8eb0" href="/">Về thư viện phim</a></body></html>',{status:404,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
 const artwork=await env.DB.prepare("SELECT key FROM settings WHERE key IN (?,?) LIMIT 1").bind('poster:'+id,'preview:'+id).first();
 const response=await env.ASSETS.fetch(new Request(new URL('/',req.url),{headers:{Accept:'text/html'}}));let html=await response.text();
 const canonical=filmShareUrl(id),title=film.title+' | Hot AI Drama',description=film.description?.slice(0,240)||'Khám phá '+film.title+' trên Hot AI Drama.',image=artwork?'https://hotai.bro.io.vn/api/poster/'+encodeURIComponent(id)+'?v='+Number(film.updated_at||0):'https://hotai.bro.io.vn/social-card-v2.png';
 html=html.replace(/<title>[^<]*<\/title>/,'<title>'+escape(title)+'</title>').replace(/<link rel="canonical"[^>]*>/,'<link rel="canonical" href="'+escape(canonical)+'"/>');
 const values:Record<string,string>={'og:title':title,'og:description':description,'og:url':canonical,'og:image':image,'og:image:secure_url':image,'og:image:alt':film.title,'twitter:title':title,'twitter:image':image,'description':description};
 html=html.replace(/<meta\s+(?:property|name)="([^"]+)"\s+content="[^"]*"\s*\/?\s*>/g,(tag:string,key:string)=>values[key]!==undefined?'<meta '+(key.startsWith('og:')?'property':'name')+'="'+key+'" content="'+escape(values[key])+'"/>':tag);
 if(artwork)html=html.replace(/<meta property="og:image:(?:width|height|type)"[^>]*>/g,'');
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache, no-transform'}});
}
