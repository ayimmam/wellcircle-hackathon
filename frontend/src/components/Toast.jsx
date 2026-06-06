import { useState, useEffect, useCallback } from 'react';

let toastId = 0;

// Global toast state
let globalSetToasts = null;

export function showToast(message, icon = '✨') {
  if (globalSetToasts) {
    const id = ++toastId;
    globalSetToasts(prev => [...prev, { id, message, icon }]);
    setTimeout(() => {
      globalSetToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    globalSetToasts = setToasts;
    return () => { globalSetToasts = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div className="toast" key={t.id}>
          <span className="toast-icon">{t.icon}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
