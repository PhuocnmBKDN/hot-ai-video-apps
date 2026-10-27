import React from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import Admin from '../app/admin/page';
import Terms from '../app/terms/page';
import Login from './login';
import '../app/globals.css';
const path=location.pathname.replace(/\/+$/,'')||'/';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{path==='/admin'?<Admin/>:path==='/terms'?<Terms/>:path==='/login'?<Login/>:path==='/'?<Home/>:<main className="legal"><a href="/">← Hot AI Drama</a><h1>Không tìm thấy trang</h1><p>Địa chỉ này không còn tồn tại hoặc đã thay đổi.</p><a className="button" href="/">Về trang chủ</a></main>}</React.StrictMode>);
