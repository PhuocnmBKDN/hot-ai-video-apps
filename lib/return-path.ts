export function safeReturnPath(value:string|null,origin:string):string {
 if(!value||!value.startsWith('/')||/[\u0000-\u0020\u007f\\]/.test(value))return '/';
 try{const next=new URL(value,origin);return next.origin===origin?next.pathname+next.search+next.hash:'/'}catch{return '/'}
}
