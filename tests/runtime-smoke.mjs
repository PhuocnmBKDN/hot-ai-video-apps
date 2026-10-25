// Real local workerd smoke test; no production credentials or test accounts.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import ts from 'typescript';
const proofJs=ts.transpileModule(readFileSync('lib/password-proof.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;const {passwordProof}=await import('data:text/javascript;base64,'+Buffer.from(proofJs).toString('base64'));
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5174';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))throw Error('This test may run only against a local disposable database.');
const username='qa_'+crypto.randomUUID().replaceAll('-','').slice(0,16),password=crypto.randomUUID().slice(0,24);
async function post(action,body,cookie=''){if(body.password){const clientSalt=action==='register'?crypto.randomUUID().replaceAll('-','').repeat(2):(await (await fetch(origin+'/api/auth/challenge?username='+body.username)).json()).clientSalt;body={...body,clientSalt,scheme:'client600k-server100k',passwordProof:await passwordProof(body.password,clientSalt)};delete body.password;}return fetch(origin+'/api/auth/'+action,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)})}
const r=await post('register',{username,password,role:'admin'});assert.equal(r.status,200,await r.text());const cookie=r.headers.get('set-cookie').split(';')[0];
const me=await (await fetch(origin+'/api/me',{headers:{Cookie:cookie}})).json();assert.equal(me.user.email,username);assert.equal(me.admin,false);
assert.equal((await fetch(origin+'/api/admin',{headers:{Cookie:cookie}})).status,403);
assert.equal((await post('login',{username,password:'incorrect-password'})).status,401);
const login=await post('login',{username,password});assert.equal(login.status,200);const next=login.headers.get('set-cookie').split(';')[0];
assert.equal((await post('logout',{},next)).status,200);
assert.equal((await (await fetch(origin+'/api/me',{headers:{Cookie:next}})).json()).user,null);
console.log('PASS: actual workerd PBKDF2 registration/login, database session lookup, role authorization and logout.');
