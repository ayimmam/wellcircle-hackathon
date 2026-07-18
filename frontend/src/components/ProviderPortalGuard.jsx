import { Navigate } from 'react-router-dom';
import { useProviderPortalAuth } from '../context/ProviderPortalAuthContext';

export default function ProviderPortalGuard({ children }) {
  const { providerUser, loading } = useProviderPortalAuth();

  if (loading) {
    return (
      <div className="admin-shell">
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (!providerUser) {
    return <Navigate to="/provider-portal/login" replace />;
  }

  return children;
}
