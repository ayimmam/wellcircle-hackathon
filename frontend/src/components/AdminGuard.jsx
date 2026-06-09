import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSuperAdmin } from '../utils/auth';

export default function AdminGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="admin-shell">
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (!isSuperAdmin(user)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
