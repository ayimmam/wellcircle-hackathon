import { useState, useEffect } from 'react';
import Icon from './Icon';

let toastId = 0;

// Global toast state
let globalSetToasts = null;

/** variant: 'success' | 'error' | undefined (neutral — no icon) */
export function showToast(message, variant) {
  if (globalSetToasts) {
    const id = ++toastId;
    globalSetToasts(prev => [...prev, { id, message, variant }]);
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
          {t.variant === 'success' && (
            <span className="toast-icon" style={{ color: '#10b981' }}><Icon name="check" size={16} /></span>
          )}
          {t.variant === 'error' && (
            <span className="toast-icon" style={{ color: 'var(--danger)' }}><Icon name="x" size={16} /></span>
          )}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
