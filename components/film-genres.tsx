import {GENRES} from '../lib/genres';
export {GENRES} from '../lib/genres';
export const splitGenres=(value:string)=>[...new Map(value.split(',').map(s=>s.normalize('NFC').trim()).filter(Boolean).map(s=>[s.toLocaleLowerCase('vi'),s])).values()];
export function filmForm(form:HTMLFormElement){const data=new FormData(form);return {...Object.fromEntries(data),genre:data.getAll('genre').join(', ')}}
export default function FilmGenres({value='',genres=GENRES}:{value?:string;genres?:string[]}){const selected=splitGenres(value);const names=new Map(genres.map(g=>[g.toLocaleLowerCase('vi'),g]));const options=[...new Set([...genres,...selected.map(g=>names.get(g.toLocaleLowerCase('vi'))||g)])];return <fieldset className="genre-checks"><legend>Thể loại phim · chọn nhiều</legend><div>{options.map(g=><label key={g}><input type="checkbox" name="genre" value={g} defaultChecked={selected.some(s=>s.toLocaleLowerCase('vi')===g.toLocaleLowerCase('vi'))}/><span>{g}</span></label>)}</div></fieldset>}
