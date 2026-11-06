import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import '@shared/i18n';
import { registerImageCache } from '@shared/registerImageCache';
import { registerLinkingProviders } from '@shared/utils/linkingProviders';
import { firebaseGoogleConfigured, signInWithGoogle } from './utils/firebaseGoogle';
import { prepareTelegramLogin, signInWithTelegram } from './utils/telegramLogin';
registerImageCache();

// Browser-only auth adapters for the shared Connected Sign-ins screen. The
// Mini App never registers these, so it stays read-only there.
registerLinkingProviders({
  google: { configured: firebaseGoogleConfigured, signIn: signInWithGoogle },
  telegram: { prepare: prepareTelegramLogin, signIn: signInWithTelegram },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
