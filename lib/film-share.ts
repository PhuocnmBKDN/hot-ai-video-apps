export function filmShareUrl(id:string,origin='https://hotai.bro.io.vn'){return new URL('/share/film/'+encodeURIComponent(id),origin).href}
export function sharedFilmId(value:string){try{const u=new URL(value);const match=/^\/share\/film\/([^/]+)\/?$/.exec(u.pathname);return match?decodeURIComponent(match[1]):u.searchParams.get('film')||''}catch{return ''}}
