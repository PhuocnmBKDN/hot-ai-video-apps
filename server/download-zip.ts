// ZIP64, STORE mode: MP4 is already compressed. Stream each object once.
const utf8=new TextEncoder();
const table=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crcUpdate(crc:number,bytes:Uint8Array){for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return crc>>>0}
function header(size:number,write:(v:DataView)=>void){const bytes=new Uint8Array(size);write(new DataView(bytes.buffer));return bytes}
export function safeDownloadName(value:string){return value.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').replace(/[. ]+$/g,'').trim().slice(0,140)||'Hot AI Drama'}
export function downloadDisposition(name:string){const ascii=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]|["\\]/g,'_');return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`}
export function zipDownload(bucket:any,files:{key:string;name:string}[]){
 async function* archive(){
  let offset=BigInt(0);const entries:{name:Uint8Array;size:bigint;crc:number;offset:bigint}[]=[];
  for(const file of files){
   const obj=await bucket.get(file.key);if(!obj?.body)throw Error('Video chưa có trong kho: '+file.name);
   const name=utf8.encode(file.name),start=offset;
   const local=header(30,v=>{v.setUint32(0,0x04034b50,true);v.setUint16(4,45,true);v.setUint16(6,0x0808,true);v.setUint16(12,0x21,true);v.setUint32(18,0xffffffff,true);v.setUint32(22,0xffffffff,true);v.setUint16(26,name.length,true);v.setUint16(28,20,true)});
   const extra=header(20,v=>{v.setUint16(0,1,true);v.setUint16(2,16,true)});
   for(const bytes of [local,name,extra]){offset+=BigInt(bytes.length);yield bytes}
   let size=BigInt(0),crc=0xffffffff;const reader=obj.body.getReader();try{while(true){const {value,done}=await reader.read();if(done)break;crc=crcUpdate(crc,value);size+=BigInt(value.length);offset+=BigInt(value.length);yield value}}finally{await reader.cancel().catch(()=>{})}
   crc=(crc^0xffffffff)>>>0;
   const descriptor=header(24,v=>{v.setUint32(0,0x08074b50,true);v.setUint32(4,crc,true);v.setBigUint64(8,size,true);v.setBigUint64(16,size,true)});offset+=BigInt(24);yield descriptor;
   entries.push({name,size,crc,offset:start});
  }
  const centralOffset=offset;
  for(const entry of entries){const central=header(46,v=>{v.setUint32(0,0x02014b50,true);v.setUint16(4,45,true);v.setUint16(6,45,true);v.setUint16(8,0x0808,true);v.setUint16(14,0x21,true);v.setUint32(16,entry.crc,true);v.setUint32(20,0xffffffff,true);v.setUint32(24,0xffffffff,true);v.setUint16(28,entry.name.length,true);v.setUint16(30,28,true);v.setUint32(42,0xffffffff,true)});
   const extra=header(28,v=>{v.setUint16(0,1,true);v.setUint16(2,24,true);v.setBigUint64(4,entry.size,true);v.setBigUint64(12,entry.size,true);v.setBigUint64(20,entry.offset,true)});
   for(const bytes of [central,entry.name,extra]){offset+=BigInt(bytes.length);yield bytes}
  }
  const centralSize=offset-centralOffset,count=BigInt(entries.length),zip64Offset=offset;
  yield header(56,v=>{v.setUint32(0,0x06064b50,true);v.setBigUint64(4,BigInt(44),true);v.setUint16(12,45,true);v.setUint16(14,45,true);v.setBigUint64(24,count,true);v.setBigUint64(32,count,true);v.setBigUint64(40,centralSize,true);v.setBigUint64(48,centralOffset,true)});
  yield header(20,v=>{v.setUint32(0,0x07064b50,true);v.setBigUint64(8,zip64Offset,true);v.setUint32(16,1,true)});
  yield header(22,v=>{v.setUint32(0,0x06054b50,true);v.setUint16(8,0xffff,true);v.setUint16(10,0xffff,true);v.setUint32(12,0xffffffff,true);v.setUint32(16,0xffffffff,true)});
 }
 const iterator=archive();return new ReadableStream<Uint8Array>({async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(next.value)}catch(e){controller.error(e)}},async cancel(){await iterator.return(undefined)}});
}
