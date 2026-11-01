import {informationHtml} from './scripts/site-pages';
import {informationPages} from './lib/site-information';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {cloudflare} from '@cloudflare/vite-plugin';
import {randomUUID} from 'node:crypto';
const release=randomUUID();
export default defineConfig({plugins:[react(),cloudflare(),{
 name:'app-release-version',
 transformIndexHtml(){return [{tag:'meta',attrs:{name:'hotai-version',content:release},injectTo:'head'}]},
 generateBundle(){this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify({version:release})})}
},{
 name:'public-information-pages',
 generateBundle(){if(this.environment.name!=='client')return;for(const page of informationPages)this.emitFile({type:'asset',fileName:page.path.slice(1)+'.html',source:informationHtml(page.path)!});this.emitFile({type:'asset',fileName:'sitemap.xml',source:'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/',...informationPages.map(p=>p.path)].map(path=>'<url><loc>https://hotai.bro.io.vn'+path+'</loc></url>').join('')+'</urlset>'})}
}],server:{host:'127.0.0.1',port:5174}});
