import {Settings2} from 'lucide-react';
export default function ManageFilmLink({admin,film}:{admin?:boolean;film:{id:string;title:string}}){
 if(!admin)return null;
 return <a className="manage-film-link" href={'/admin?film='+encodeURIComponent(film.id)} aria-label={'Quản lý phim: '+film.title}><Settings2 size={15} aria-hidden="true"/><span>Quản lý phim này</span></a>;
}
