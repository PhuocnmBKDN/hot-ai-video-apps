import {informationLinks} from '../lib/site-links';
export default function SiteFooter(){return <footer className="site-information-footer"><nav aria-label="Thông tin dịch vụ">{informationLinks.map(p=><a href={p.path} key={p.path}>{p.label}</a>)}</nav><p>Hot AI Drama · <a href="https://zalo.me/0914814900" target="_blank" rel="noopener noreferrer">Hỗ trợ Zalo 0914814900 ↗</a></p></footer>}
