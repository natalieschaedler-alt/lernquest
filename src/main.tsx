import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './i18n'
import './index.css'

// Show a reload prompt when a new service worker version is available
registerSW({
  onNeedRefresh() {
    toast(
      (toastInstance) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>🔄 Neue Version verfügbar!</span>
          <button
            onClick={() => {
              toast.dismiss(toastInstance.id)
              window.location.reload()
            }}
            style={{
              background: '#6C3CE1',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 12px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            Aktualisieren
          </button>
        </span>
      ),
      { duration: Infinity, id: 'sw-update' },
    )
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#16213E', color: '#fff', border: '1px solid #0F3460' },
          duration: 3500,
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
