import {env} from 'cloudflare:workers';
export function media(){return (env as any).BUCKET;}
