import {GENRES} from '../lib/genres';

const name=(s:string)=>s.normalize('NFC').trim().replace(/\s+/g,' ');
const key=(s:string)=>name(s).toLocaleLowerCase('vi');
const fail=(message:string,status=400):never=>{throw Object.assign(new Error(message),{status})};

export function importGenreNames(value:unknown):string[]{
 if(value===undefined)return []; // Compatibility with desktop 0.11.
 if(!Array.isArray(value)||value.length>20)return fail('Thể loại phải là danh sách tối đa 20 nhãn');
 const result=new Map<string,string>();
 for(const raw of value){
  if(typeof raw!=='string'||/[\x00-\x1f\x7f,]/.test(raw))fail('Nhãn thể loại không hợp lệ');
  const label=name(raw);if(!label||label.length>60)fail('Nhãn thể loại từ 1–60 ký tự');
  if(!result.has(key(label)))result.set(key(label),label);
 }
 const labels=[...result.values()];if(labels.join(', ').length>500)fail('Thể loại phim tối đa 500 ký tự');return labels;
}

export async function attachImportGenres(db:any,seriesId:string,incoming:string[]){
 if(!incoming.length)return;
 // Compare-and-swap the existing JSON registry in the same D1 transaction as
 // the film update. Concurrent imports/admin edits cannot lose other labels.
 for(let attempt=0;attempt<8;attempt++){
  const stored=await db.prepare("SELECT value FROM settings WHERE key='genres'").first();
  const registered:unknown=stored?JSON.parse(stored.value):GENRES;
  if(!Array.isArray(registered)||registered.some(v=>typeof v!=='string'))return fail('Danh sách thể loại HotAI chưa hợp lệ',503);
  const films=(await db.prepare('SELECT id,genre FROM series WHERE deleted_at IS NULL').all()).results;
  const target=films.find((f:any)=>f.id===seriesId);if(!target)fail('Không tìm thấy phim',404);
  const known=new Map<string,string>();
  for(const label of [...registered,...films.flatMap((f:any)=>f.genre.split(','))]){
   const clean=name(label);if(clean&&!known.has(key(clean)))known.set(key(clean),clean);
  }
  const labels=new Map<string,string>();
  for(const raw of [...target.genre.split(',').filter((s:string)=>s.trim()),...incoming]){
   const canonical=known.get(key(raw))||name(raw);known.set(key(canonical),canonical);labels.set(key(canonical),canonical);
  }
  const registry=[...known.values()].sort((a,b)=>a.localeCompare(b,'vi')),genre=[...labels.values()].join(', ');
  if(registry.length>200)fail('HotAI có tối đa 200 nhãn thể loại');if(genre.length>500)fail('Thể loại phim tối đa 500 ký tự');
  const next=JSON.stringify(registry);
  const update=stored
   ?db.prepare("UPDATE settings SET value=? WHERE key='genres' AND value=?").bind(next,stored.value)
   :db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('genres',?)").bind(next);
  await db.batch([update,db.prepare("UPDATE series SET genre=? WHERE id=? AND deleted_at IS NULL AND genre=? AND (SELECT value FROM settings WHERE key='genres')=?").bind(genre,seriesId,target.genre,next)]);
  const result=await db.prepare('SELECT genre FROM series WHERE id=? AND deleted_at IS NULL').bind(seriesId).first();
  const saved=await db.prepare("SELECT value FROM settings WHERE key='genres'").first();
  if(result?.genre===genre&&saved){const actual:string[]=JSON.parse(saved.value);if(incoming.every(g=>actual.some(v=>key(v)===key(g))))return;}
 }
 fail('Thể loại đang được cập nhật đồng thời. Vui lòng tiếp tục upload lại.',503);
}
