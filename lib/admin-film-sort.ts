export const FILM_SORT_COLUMNS=[['name','Tên phim'],['firstPublished','Ngày phát hành lần đầu'],['updated','Chỉnh sửa gần nhất'],['genre','Thể loại'],['episodes','Số tập đã tải'],['paidFrom','Khóa từ tập'],['price','Giá mở khóa'],['status','Trạng thái']] as const;
export type FilmSortKey=typeof FILM_SORT_COLUMNS[number][0];
const collator=new Intl.Collator('vi',{numeric:true,sensitivity:'base'});
export function sortAdminFilms(films:any[],episodes:any[],key:FilmSortKey,direction:'asc'|'desc'){
 const counts=new Map<string,number>();for(const e of episodes)counts.set(e.series_id,(counts.get(e.series_id)||0)+1);
 const number=(v:any)=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
 const value=(f:any):string|number|null=>{switch(key){case 'name':return f.title||'';case 'genre':return f.genre||'';case 'status':return f.published?'Đã phát hành':'Bản nháp';case 'episodes':return counts.get(f.id)||0;case 'paidFrom':return number(f.paid_from);case 'price':return number(f.price);case 'firstPublished':return number(f.first_published_at)||null;case 'updated':return number(f.updated_at)||null}};
 return [...films].sort((a,b)=>{const x=value(a),y=value(b);if(x===null&&y!==null)return 1;if(y===null&&x!==null)return -1;const result=x===null||y===null?0:typeof x==='number'&&typeof y==='number'?x-y:collator.compare(String(x),String(y));return result*(direction==='asc'?1:-1)||collator.compare(a.title||'',b.title||'')||String(a.id).localeCompare(String(b.id))})
}
