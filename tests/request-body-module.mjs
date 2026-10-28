import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync('lib/request-body.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
export const requestBodyModule=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
