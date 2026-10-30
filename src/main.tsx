import RouteBoundary from '../components/route-boundary';
import React,{lazy,Suspense,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
const Home=lazy(()=>import('../app/page'));
const Admin=lazy(()=>import('../app/admin/page'));
const Terms=lazy(()=>import('../app/terms/page'));
const Login=lazy(()=>import('./login'));
import '../app/globals.css';
const path=location.pathname.replace(/\/+$/,'')||'/';
function BootReady(){useEffect(()=>{document.getElementById('boot-screen')?.remove();window.dispatchEvent(new Event('hotai-ready'))},[]);return null}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BootReady/><RouteBoundary><Suspense fallback={<main className="legal" role="status">Đang tải…</main>}>{path==='/admin'?<Admin/>:path==='/terms'?<Terms/>:path==='/login'?<Login/>:path==='/'?<Home/>:<main className="legal"><a href="/">← Hot AI Drama</a><h1>Không tìm thấy trang</h1><p>Địa chỉ này không còn tồn tại hoặc đã thay đổi.</p><a className="button" href="/">Về trang chủ</a></main>}</Suspense></RouteBoundary></React.StrictMode>);
