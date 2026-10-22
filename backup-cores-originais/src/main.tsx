import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './i18n/LanguageContext'

// Vite dynamic import preload error recovery
window.addEventListener('vite:preload-error', (event) => {
  console.warn('Vite preload error detected, reloading to fetch latest assets...', event);
  const reloadKey = 'vite_preload_error_reload';
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, '1');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)

