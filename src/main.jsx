import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Inside the Octos desktop app: the page is marked, for the app's own look
// (index.css, html.octos-desktop). Browsers are left as they are.
if (window.__TAURI__) document.documentElement.classList.add('octos-desktop')
