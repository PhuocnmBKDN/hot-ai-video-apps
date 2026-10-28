import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync} from 'node:fs';
const js=ts.transpileModule(readFileSync('lib/return-path.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {safeReturnPath}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const origin='https://hotai.test';
for(const value of [null,'https://evil.test','//evil.test','///evil.test','/\\evil.test','/\n/evil.test','/\t/evil.test','javascript:alert(1)'])assert.equal(safeReturnPath(value,origin),'/');
for(const path of ['/admin','/?episode=fixture','/?tab=account','/terms#privacy','/some%20path'])assert.equal(safeReturnPath(path,origin),path);
console.log('PASS: login redirects remain on the app, including control-character and backslash bypass attempts.');
