import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './AppShell';
import {Header} from './HeaderBar';

import 'bootstrap/dist/js/bootstrap.min.js';
import 'bootstrap/js/dist/dropdown.js';
import 'bootstrap/dist/css/bootstrap.min.css';

// app-specific CSS
import '../styles/App.css';

const headerRoot = document.getElementById('header');
const appRoot = document.getElementById('root');

if (!headerRoot || !appRoot) {
    throw new Error('应用挂载节点缺失');
}

ReactDOM.createRoot(headerRoot).render(
    <React.StrictMode>
        <Header/>
    </React.StrictMode>,
)

ReactDOM.createRoot(appRoot).render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>,
)
