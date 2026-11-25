import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isNativeMobile } from './lib/platform'

const isDesktop = Boolean(window.trucktapDesktop?.isDesktop)
const isNative = isNativeMobile()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD && !isDesktop && !isNative) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        // The app remains fully usable without a service worker.
      })
  })
}
