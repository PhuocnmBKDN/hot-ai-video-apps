import ts from 'typescript';import {readFileSync} from 'node:fs';
const load=async path=>{const source=readFileSync(path,'utf8').replace("import {GENRES} from '../lib/genres';","const GENRES=['Tình cảm','Test'];");const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))};
export const catalog=await load('server/catalog.ts');
export const metadata=await load('server/media-metadata.ts');
