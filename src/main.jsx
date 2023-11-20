import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import "./script.jsx"

console.log("Hey")

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
