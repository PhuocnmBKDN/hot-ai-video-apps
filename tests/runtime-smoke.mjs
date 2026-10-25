// Real local workerd smoke test; no production credentials or test accounts.
import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5174';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))throw Error('This test may run only against a local disposable database.');
const username='qa_'+crypto.randomUUID().replaceAll('-','').slice(0,16),password=crypto.randomUUID();
async function post(action,body,cookie=''){return fetch(origin+'/api/auth/'+action,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)})}
const r=await post('register',{username,password,role:'admin'});assert.equal(r.status,200,await r.text());const cookie=r.headers.get('set-cookie').split(';')[0];
const me=await (await fetch(origin+'/api/me',{headers:{Cookie:cookie}})).json();assert.equal(me.user.email,username);assert.equal(me.admin,false);
assert.equal((await fetch(origin+'/api/admin',{headers:{Cookie:cookie}})).status,403);
assert.equal((await post('login',{username,password:'incorrect-password'})).status,401);
const login=await post('login',{username,password});assert.equal(login.status,200);const next=login.headers.get('set-cookie').split(';')[0];
assert.equal((await post('logout',{},next)).status,200);
assert.equal((await (await fetch(origin+'/api/me',{headers:{Cookie:next}})).json()).user,null);
console.log('PASS: actual workerd PBKDF2 registration/login, database session lookup, role authorization and logout.');
