import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/auth';

export default function AdminGuard({ children }) {
  const { user, loading, error, login } = useAuth();

  if (loading) {
    return (
      <div className="admin-shell">
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-shell" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--danger, #ef4444)', marginBottom: 16 }}>
          {error || 'Sign-in failed. Reopen from Telegram or retry.'}
        </p>
        <button className="btn btn-primary" onClick={() => login()}>
          Retry
        </button>
      </div>
    );
  }

  if (!isSuperAdmin(user)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
