import assert from 'node:assert/strict';
import ts from 'typescript';import {readFileSync} from 'node:fs';
const js=ts.transpileModule(readFileSync('lib/local-library.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {readLocalLibrary}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
assert.deepEqual(readLocalLibrary({getItem(){throw Error('Storage blocked')}}),{saved:[],history:[],watched:{}});
for(const value of ['null','42','"hello"','[]','{}','{bad']){
 const result=readLocalLibrary({getItem:()=>value});assert(Array.isArray(result.saved));assert(Array.isArray(result.history));assert(result.watched&&typeof result.watched==='object');
}
const h={seriesId:'f',episodeId:'e',title:'Film',number:2,position:12.5,at:100,completed:false};
const state=readLocalLibrary({getItem:key=>JSON.stringify(key==='lt-saved'?['f','f',null,1]:key==='lt-history'?[null,h,{...h,position:-1},{...h,number:'2'},{...h,title:null}]:{e:false,bad:'true'})});
assert.deepEqual(state,{saved:['f'],history:[h],watched:{e:false}});
console.log('PASS: damaged, unavailable and incorrectly shaped browser storage cannot break guest catalog or history.');
