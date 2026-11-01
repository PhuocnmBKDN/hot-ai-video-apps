import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE series(id TEXT PRIMARY KEY,title TEXT);CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);INSERT INTO settings VALUES('catalog_revision','0');INSERT INTO series VALUES('tiktok-old','Old title');");db.exec(readFileSync('drizzle/0020_public_film_links.sql','utf8'));
const oldCode=db.prepare("SELECT public_share_id FROM series WHERE id='tiktok-old'").get().public_share_id;assert.match(oldCode,/^[a-f0-9]{24}$/);
db.exec("UPDATE series SET id='douyin-new',title='New title' WHERE id='tiktok-old';INSERT INTO series(id,title) VALUES('other-source','Another');");assert.equal(db.prepare("SELECT public_share_id FROM series WHERE id='douyin-new'").get().public_share_id,oldCode);assert.notEqual(db.prepare("SELECT public_share_id FROM series WHERE id='other-source'").get().public_share_id,oldCode);
async function load(source){return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText).toString('base64'))}
const helpers=await load(readFileSync('lib/film-share.ts','utf8'));globalThis.__filmShare=helpers;
assert.equal(helpers.filmShareUrl('abc'), 'https://hotai.bro.io.vn/share/film/abc');assert.equal(helpers.sharedFilmId('https://hotai.bro.io.vn/share/film/abc'),'abc');assert.equal(helpers.sharedFilmId('https://hotai.bro.io.vn/?film=abc'),'abc');assert.equal(helpers.sharedFilmId('not-a-url'),'');
const {filmSharePage}=await load(readFileSync('server/film-share.ts','utf8').replace("import {filmShareUrl,sharedFilmId} from '../lib/film-share';","const {filmShareUrl,sharedFilmId}=globalThis.__filmShare;"));
let published=true,poster=true;
const env={
 DB:{prepare:sql=>({bind:id=>({first:async()=>sql.includes('FROM series')?(published&&['abc','public-code'].includes(id)?{id:'abc',public_share_id:'public-code',title:'Phim "A" <script>',description:'Nội dung & bạn',updated_at:42}:null):(poster?{key:'poster:abc'}:null)})})},
 ASSETS:{async fetch(){return new Response(readFileSync('index.html','utf8'))}}
};
let r=await filmSharePage(new Request(helpers.filmShareUrl('public-code')),env);let html=await r.text();assert.equal(r.status,200);assert(html.includes('Phim &quot;A&quot; &lt;script&gt; | Hot AI Drama'));assert(html.includes('https://hotai.bro.io.vn/api/poster/abc?v=42'));assert(!html.includes('property="og:image:width"'));assert(html.includes('href="https://hotai.bro.io.vn/share/film/public-code"'));assert(html.includes('src="/src/main.tsx"'),'Shared page still boots the application');
assert.equal((await filmSharePage(new Request(helpers.filmShareUrl('abc')),env)).status,200,'Old internal-ID links remain compatible');
poster=false;r=await filmSharePage(new Request(helpers.filmShareUrl('abc')),env);assert((await r.text()).includes('social-card-v2.png'));
published=false;r=await filmSharePage(new Request(helpers.filmShareUrl('abc')),env);assert.equal(r.status,404);assert(!(await r.text()).includes('Phim &quot;A&quot;'));
console.log('PASS: stable film links, legacy query links, film-specific social metadata, HTML escaping, fallback artwork and hidden/deleted film protection.');
