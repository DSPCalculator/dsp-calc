import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { Header } from './header.jsx';

import 'bootstrap/dist/js/bootstrap.min.js';
import 'bootstrap/js/dist/dropdown.js';

import '../css/styles.scss';
// app-specific CSS
import '../css/App.css';


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
