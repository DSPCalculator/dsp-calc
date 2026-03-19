import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import {Header} from './header.jsx';
import {IconStyles} from './icon.jsx';
import {ThemeProvider} from './ThemeContext.jsx';

import 'bootstrap/dist/js/bootstrap.min.js';

import '../css/styles.scss';
import '../css/App.css';

ReactDOM.createRoot(document.getElementById('header')).render(
    <React.StrictMode>
        <ThemeProvider>
            <IconStyles/>
            <Header/>
        </ThemeProvider>
    </React.StrictMode>,
)

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider>
            <App/>
        </ThemeProvider>
    </React.StrictMode>,
)
