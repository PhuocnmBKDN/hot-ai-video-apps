import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {cloudflare} from '@cloudflare/vite-plugin';
import {randomUUID} from 'node:crypto';
const release=randomUUID();
export default defineConfig({plugins:[react(),cloudflare(),{
 name:'app-release-version',
 transformIndexHtml(){return [{tag:'meta',attrs:{name:'hotai-version',content:release},injectTo:'head'}]},
 generateBundle(){this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify({version:release})})}
}],server:{host:'127.0.0.1',port:5174}});
