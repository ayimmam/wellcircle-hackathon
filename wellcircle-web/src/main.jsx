import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import '@shared/i18n';
import { registerImageCache } from '@shared/registerImageCache';
registerImageCache();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
