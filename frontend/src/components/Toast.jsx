import { useState, useEffect } from 'react';
import Icon from './Icon';
import { haptic } from '../utils/haptic';

let activeTimeout = null;
let globalSetToast = null;
let currentToastRef = { message: '', count: 1, variant: '' };

/** variant: 'success' | 'error' | undefined (neutral — no icon) */
export function showToast(message, variant) {
  if (variant === 'success') haptic('notification.success');
  else if (variant === 'error') haptic('notification.error');

  if (globalSetToast) {
    if (activeTimeout && currentToastRef.message === message) {
      currentToastRef.count += 1;
    } else {
      currentToastRef = { message, count: 1, variant };
    }
    
    globalSetToast({ ...currentToastRef });
    
    if (activeTimeout) clearTimeout(activeTimeout);
    activeTimeout = setTimeout(() => {
      globalSetToast(null);
      activeTimeout = null;
      currentToastRef = { message: '', count: 1, variant: '' };
    }, 3000);
  }
}

export default function ToastContainer() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    globalSetToast = setToast;
    return () => { globalSetToast = null; };
  }, []);

  if (!toast) return null;
  
  const displayMessage = toast.count > 1 ? `${toast.message} (+${toast.count - 1} more)` : toast.message;

  return (
    <div className="toast-container">
      <div className="toast" style={{ animation: 'pageIn 0.2s ease' }}>
        {toast.variant === 'success' && (
          <span className="toast-icon" style={{ color: '#10b981' }}><Icon name="check" size={16} /></span>
        )}
        {toast.variant === 'error' && (
          <span className="toast-icon" style={{ color: 'var(--danger)' }}><Icon name="x" size={16} /></span>
        )}
        <span>{displayMessage}</span>
      </div>
    </div>
  );
}
