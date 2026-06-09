import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page admin-page">
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (!user?.is_super_admin) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
