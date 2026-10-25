// The browser performs the expensive standard KDF; the server independently
// salts and hashes this password-equivalent proof before storing anything.
// Proofs must travel only over HTTPS and must never be logged or persisted.
export async function passwordProof(password:string,salt:string){
 const encoder=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const result=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:600000},key,256);
 return Array.from(new Uint8Array(result),b=>b.toString(16).padStart(2,'0')).join('');
}
