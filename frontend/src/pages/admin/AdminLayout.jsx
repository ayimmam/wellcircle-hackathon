import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { path: '/admin/analytics', label: 'Analytics' },
  { path: '/admin/providers', label: 'Providers' },
  { path: '/admin/products', label: 'Products' },
  { path: '/admin/reports', label: 'Reports' },
  { path: '/admin/feedback', label: 'Feedback' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <h1 className="admin-title">Admin Dashboard</h1>
          <p className="admin-subtitle">
            Logged in as: {user?.name} | {user?.points_balance ?? 0} pts
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate('/'); }}>
          Logout
        </button>
      </header>

      <nav className="admin-tabs">
        {TABS.map(tab => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => `admin-tab ${isActive ? 'active' : ''}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
