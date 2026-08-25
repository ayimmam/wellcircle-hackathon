import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';

// On-device image cache (public/sw.js). Registered after load so it never
// competes with the first paint, and only in a production build — under `vite
// dev` a worker sitting in front of the page is a debugging trap for no gain.
// `updateViaCache: 'none'` keeps the HTTP cache away from the worker script
// itself, which is what makes a bad version fixable by shipping a new one.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      // No worker just means images fall back to the browser's HTTP cache.
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
