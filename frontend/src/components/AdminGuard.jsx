import ErrorScreen from './ErrorScreen';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/auth';

export default function AdminGuard({ children }) {
  const { user, loading, login } = useAuth();

  if (loading) {
    return (
      <div className="admin-shell">
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorScreen variant="auth" onRetry={() => login()} retryLabel="Retry" />
    );
  }

  if (!isSuperAdmin(user)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
