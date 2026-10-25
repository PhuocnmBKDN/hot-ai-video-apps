import React from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import Admin from '../app/admin/page';
import Terms from '../app/terms/page';
import Login from './login';
import '../app/globals.css';
const path=location.pathname;
createRoot(document.getElementById('root')!).render(<React.StrictMode>{path==='/admin'?<Admin/>:path==='/terms'?<Terms/>:path==='/login'?<Login/>:<Home/>}</React.StrictMode>);
