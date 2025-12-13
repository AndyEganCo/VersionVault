import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { forceLogout } from './lib/auth/session'

// Expose force logout to window for emergency use
// Users can call window.forceLogout() from browser console if stuck
declare global {
  interface Window {
    forceLogout: () => void;
  }
}
window.forceLogout = forceLogout;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
