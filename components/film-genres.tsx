import {GENRES} from '../lib/genres';
export {GENRES} from '../lib/genres';
export const splitGenres=(value:string)=>[...new Set(value.split(',').map(s=>s.trim()).filter(Boolean).map(s=>GENRES.find(g=>g.toLocaleLowerCase('vi')===s.toLocaleLowerCase('vi'))||s))];
export function filmForm(form:HTMLFormElement){const data=new FormData(form);return {...Object.fromEntries(data),genre:data.getAll('genre').join(', ')}}
export default function FilmGenres({value='',genres=GENRES}:{value?:string;genres?:string[]}){const selected=splitGenres(value);const options=[...new Set([...genres,...selected])];return <fieldset className="genre-checks"><legend>Thể loại phim · chọn nhiều</legend><div>{options.map(g=><label key={g}><input type="checkbox" name="genre" value={g} defaultChecked={selected.includes(g)}/><span>{g}</span></label>)}</div></fieldset>}
