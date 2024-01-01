import React from 'react';
import ReactDOM from 'react-dom/client';
import { Header } from './header.jsx';
import App from './App.jsx';

import 'bootstrap/dist/js/bootstrap.min.js';
import 'bootstrap/js/dist/dropdown.js';
import '../css/App.css';
import '../css/styles.scss';

ReactDOM.createRoot(document.getElementById('header')).render(
  <React.StrictMode>
    <Header />
  </React.StrictMode>,
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
