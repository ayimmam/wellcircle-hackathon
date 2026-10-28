import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, useLocation, useNavigate } from 'react-router-dom';
import { AppShell as SharedAppShell } from '@shared/App';
import { ThemeProvider } from '@shared/context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './pages/LoginScreen';
import LandingPage from './pages/LandingPage';

const PUBLIC_ROUTES = ['/', '/login', '/landing', '/about', '/visit', '/help', '/privacy', '/terms', '/data-deletion'];
function Loading() { return <div className="route-fallback" aria-busy="true" aria-label="Loading"><div className="skeleton" style={{ height: 160, margin: 24 }} /></div>; }

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Navigate to={user.is_onboarded ? '/home' : '/onboarding'} replace /> : <LoginScreen />;
}

export function AppShell() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isPortal = location.pathname.startsWith('/provider-portal');
  const needsLogin = !isPortal && !PUBLIC_ROUTES.includes(location.pathname);
  useEffect(() => {
    if (!loading && !user && needsLogin) {
      sessionStorage.setItem('wc_post_redirect', location.pathname + location.search + location.hash);
      navigate('/login', { replace: true });
    }
  }, [loading, user, needsLogin, location.pathname, location.search, location.hash, navigate]);
  if (!isPortal && (loading || (!user && needsLogin))) return <Loading />;
  return <SharedAppShell web entryElement={<RootRoute />} extraRoutes={[
    <Route key="login" path="/login" element={<RootRoute />} />,
    <Route key="landing" path="/landing" element={<LandingPage />} />,
    <Route key="splash" path="/splash" element={<RootRoute />} />,
  ]} />;
}

export default function App() {
  return <BrowserRouter><ThemeProvider><AuthProvider><AppShell /></AuthProvider></ThemeProvider></BrowserRouter>;
}
