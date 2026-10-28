import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync} from 'node:fs';
const js=ts.transpileModule(readFileSync('lib/episode-order.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;const {compareEpisodeFiles,nextEpisodeNumber}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
for(const names of [['Film (10).mp4','Film (2).mp4','Film.mp4','Film (1).mp4'],['Film (2) (10).mp4','Film (2) (2).mp4','Film (2).mp4']]){const result=names.map(name=>({name})).sort(compareEpisodeFiles).map(f=>f.name);assert.deepEqual(result,names.length===4?['Film.mp4','Film (1).mp4','Film (2).mp4','Film (10).mp4']:['Film (2).mp4','Film (2) (2).mp4','Film (2) (10).mp4'])}
console.log('PASS: original filename first, ascending numeric suffixes, nested suffixes.');

assert.equal(nextEpisodeNumber([]),1);assert.equal(nextEpisodeNumber([{number:12},{number:1},{number:4}]),13);assert.equal(nextEpisodeNumber([{number:5},{number:7}]),8);
console.log('PASS: next batch starts after the largest uploaded episode, including gaps and unordered lists.');
