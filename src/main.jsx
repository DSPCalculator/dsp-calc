import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

import '../css/styles.scss'
import 'bootstrap/dist/js/bootstrap.bundle.js'
// import * as bootstrap from 'bootstrap'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
