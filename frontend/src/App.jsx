import { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProviderPortalAuthProvider } from './context/ProviderPortalAuthContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import BurgerMenu from './components/BurgerMenu';
import ToastContainer from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import AdminGuard from './components/AdminGuard';
import ProviderPortalGuard from './components/ProviderPortalGuard';

// SplashScreen is the entry/landing screen — keep it eager so first paint is
// instant. Everything else is code-split so the initial bundle stays small,
// which matters a lot on free-tier hosting + slow Telegram in-app networks.
import SplashScreen from './pages/SplashScreen';

const OnboardingFlow = lazy(() => import('./pages/OnboardingFlow'));
const HomeScreen = lazy(() => import('./pages/HomeScreen'));
const ExploreScreen = lazy(() => import('./pages/ExploreScreen'));
const NotificationsScreen = lazy(() => import('./pages/NotificationsScreen'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const ProviderDetail = lazy(() => import('./pages/ProviderDetail'));
const CommunityList = lazy(() => import('./pages/CommunityList'));
const CommunityDetail = lazy(() => import('./pages/CommunityDetail'));
const CircleDetailScreen = lazy(() => import('./pages/CircleDetailScreen'));
const BookingFlow = lazy(() => import('./pages/BookingFlow'));
const ProfileScreen = lazy(() => import('./pages/ProfileScreen'));
const ProviderDashboard = lazy(() => import('./pages/ProviderDashboard'));
const ProviderOnboard = lazy(() => import('./pages/ProviderOnboard'));
const ProductsStore = lazy(() => import('./pages/ProductsStore'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const ProductRedeem = lazy(() => import('./pages/ProductRedeem'));
const MyRedemptions = lazy(() => import('./pages/MyRedemptions'));

// Admin bundle — only ever loaded for super admins, so keep it out of the
// main chunk entirely.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminProviders = lazy(() => import('./pages/admin/AdminProviders'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback'));

// Provider website — standalone Telegram-Login-Widget-authenticated portal,
// reachable outside the Telegram Mini App. Full-screen landscape layout with
// a sidebar nav (ProviderPortalShell) and one dedicated page per section —
// independent of the Mini App's mobile-tabbed ProviderDashboard.
const ProviderPortalLogin = lazy(() => import('./pages/provider-portal/ProviderPortalLogin'));
const ProviderPortalShell = lazy(() => import('./pages/provider-portal/ProviderPortalShell'));
const ProviderPortalOverview = lazy(() => import('./pages/provider-portal/ProviderPortalOverview'));
const ProviderPortalBookings = lazy(() => import('./pages/provider-portal/ProviderPortalBookings'));
const ProviderPortalEvents = lazy(() => import('./pages/provider-portal/ProviderPortalEvents'));
const ProviderPortalProducts = lazy(() => import('./pages/provider-portal/ProviderPortalProducts'));
const ProviderPortalCustomers = lazy(() => import('./pages/provider-portal/ProviderPortalCustomers'));
const ProviderPortalPromotions = lazy(() => import('./pages/provider-portal/ProviderPortalPromotions'));
const ProviderPortalSubscriptions = lazy(() => import('./pages/provider-portal/ProviderPortalSubscriptions'));

function RouteFallback() {
  return (
    <div className="route-fallback" style={{ padding: 16 }} aria-busy="true">
      <div className="skeleton" style={{ height: 120, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 80 }} />
    </div>
  );
}

/**
 * App chrome + route table. Router-agnostic so tests can mount it under a
 * MemoryRouter at any path. Production wraps it with BrowserRouter below.
 * Wraps itself in ProviderPortalAuthProvider (rather than at the App() level
 * like AuthProvider) so tests that mount AppShell directly still get a
 * working provider-portal session context.
 */
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <ProviderPortalAuthProvider>
      <div className="app-shell">
        <ToastContainer />
        <Header onMenuOpen={() => setMenuOpen(true)} />
        <BurgerMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Auth & Onboarding */}
              <Route path="/" element={<SplashScreen />} />
              <Route path="/onboarding" element={<OnboardingFlow />} />

              {/* Main tabs */}
              <Route path="/home" element={<HomeScreen />} />
              <Route path="/explore" element={<ExploreScreen />} />
              <Route path="/notifications" element={<NotificationsScreen />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/users/me/bookings" element={<MyBookings />} />
              <Route path="/community" element={<CommunityList />} />
              <Route path="/profile" element={<ProfileScreen />} />

              {/* Detail screens */}
              <Route path="/provider/:id" element={<ProviderDetail />} />
              <Route path="/community/:id" element={<CommunityDetail />} />
              <Route path="/circle/:id" element={<CircleDetailScreen />} />
              <Route path="/booking/:providerId" element={<BookingFlow />} />

              {/* Provider dashboard (Mini App) */}
              <Route path="/provider-dashboard" element={<ProviderDashboard />} />
              <Route path="/provider-onboard" element={<ProviderOnboard />} />

              {/* Products store */}
              <Route path="/products" element={<ProductsStore />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/products/:id/redeem" element={<ProductRedeem />} />
              <Route path="/users/me/redemptions" element={<MyRedemptions />} />

              {/* Admin dashboard */}
              <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
                <Route index element={<Navigate to="/admin/analytics" replace />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="providers" element={<AdminProviders />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="feedback" element={<AdminFeedback />} />
              </Route>

              {/* Provider website — Telegram Login Widget auth, not the Mini App */}
              <Route path="/provider-portal/login" element={<ProviderPortalLogin />} />
              <Route path="/provider-portal" element={<ProviderPortalGuard><ProviderPortalShell /></ProviderPortalGuard>}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<ProviderPortalOverview />} />
                <Route path="bookings" element={<ProviderPortalBookings />} />
                <Route path="events" element={<ProviderPortalEvents />} />
                <Route path="products" element={<ProviderPortalProducts />} />
                <Route path="customers" element={<ProviderPortalCustomers />} />
                <Route path="promotions" element={<ProviderPortalPromotions />} />
                <Route path="subscriptions" element={<ProviderPortalSubscriptions />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>

        <BottomNav />
      </div>
    </ProviderPortalAuthProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
