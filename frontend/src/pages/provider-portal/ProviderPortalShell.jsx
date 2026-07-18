import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useProviderPortalAuth } from '../../context/ProviderPortalAuthContext';
import { ProviderPortalDataProvider, useProviderPortalData } from '../../context/ProviderPortalDataContext';
import Icon from '../../components/Icon';

const NAV_ITEMS = [
  { path: 'overview', label: 'Overview', icon: 'chart' },
  { path: 'bookings', label: 'Bookings & Insights', icon: 'calendar' },
  { path: 'events', label: 'Events', icon: 'ticket' },
  { path: 'products', label: 'Products', icon: 'store' },
  { path: 'customers', label: 'Customers', icon: 'users' },
  { path: 'promotions', label: 'Promotions', icon: 'flame' },
  { path: 'subscriptions', label: 'Subscriptions', icon: 'coins' },
];

function ProviderPortalShellInner() {
  const { providerUser, logout } = useProviderPortalAuth();
  const { stats, loading, error } = useProviderPortalData();
  const navigate = useNavigate();

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <div className="portal-sidebar-brand">
          <div>
            <div className="portal-sidebar-brand-name">{stats?.provider_name || 'Well Circle'}</div>
            <div className="portal-sidebar-brand-sub">Provider Website</div>
          </div>
        </div>

        <nav className="portal-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `portal-nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon name={item.icon} size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="portal-sidebar-footer">
          <div className="portal-provider-name">{providerUser?.name || providerUser?.telegram_handle}</div>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => { logout(); navigate('/provider-portal/login'); }}>
            Logout
          </button>
        </div>
      </aside>

      <main className="portal-content">
        <div className="portal-content-inner">
          {loading ? (
            <>
              <div className="skeleton" style={{ height: 24, width: 240, marginBottom: 24 }} />
              <div className="portal-kpi-grid">
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 90 }} />)}
              </div>
            </>
          ) : error || !stats ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon name="chart" size={32} /></div>
              <div className="empty-state-text">{error || 'Unable to load provider dashboard'}</div>
              <p className="text-sm text-secondary mt-8">Provider access is required. Ask an admin to approve your account.</p>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </main>
    </div>
  );
}

export default function ProviderPortalShell() {
  // Breaks the app-wide #root max-width:430px mobile constraint for this
  // subtree only — the sidebar layout needs the full viewport width.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.add('provider-portal-active');
    return () => root?.classList.remove('provider-portal-active');
  }, []);

  return (
    <ProviderPortalDataProvider>
      <ProviderPortalShellInner />
    </ProviderPortalDataProvider>
  );
}
