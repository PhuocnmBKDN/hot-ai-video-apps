function invalid(message:string,status:number):never {
 throw Object.assign(new Error(message),{status});
}

// Enforce the actual byte count even when Content-Length is absent or false.
export async function readBytes(req:Request,maxBytes:number):Promise<Uint8Array<ArrayBuffer>> {
 const length=req.headers.get('content-length');
 if(length!==null&&(!/^\d+$/.test(length)||!Number.isSafeInteger(Number(length))))invalid('Độ dài yêu cầu không hợp lệ',400);
 if(length!==null&&Number(length)>maxBytes)invalid('Yêu cầu quá lớn',413);
 if(!req.body){if(Number(length)>0)invalid('Dữ liệu nhận chưa đủ. Vui lòng thử lại.',400);return new Uint8Array()}
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try {
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
   if(size>maxBytes){void reader.cancel().catch(()=>{});invalid('Yêu cầu quá lớn',413)}
   chunks.push(part.value);
  }
 } finally {reader.releaseLock()}
 if(length!==null&&size!==Number(length))invalid('Dữ liệu nhận chưa đủ. Vui lòng thử lại.',400);
 const result=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength}
 return result;
}

export async function readObject(req:Request,maxBytes=16384):Promise<Record<string,any>> {
 const bytes=await readBytes(req,maxBytes);let value:unknown;
 try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{invalid('Dữ liệu JSON không hợp lệ',400)}
 if(!value||typeof value!=='object'||Array.isArray(value))invalid('Dữ liệu không hợp lệ',400);
 return value as Record<string,any>;
}

export function validImage(bytes:Uint8Array,type:string):boolean {
 if(bytes.length<12)return false;
 const ascii=(a:number,b:number)=>new TextDecoder().decode(bytes.subarray(a,b));
 if(type==='image/png')return [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 if(type==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 return type==='image/webp'&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP';
}
