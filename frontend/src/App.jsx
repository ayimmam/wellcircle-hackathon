import { useState, useEffect, lazy, Suspense } from 'react';
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
import useDoubleBackToExit from './hooks/useDoubleBackToExit';
import { isProviderPortalDomain, providerPortalBase } from './utils/providerPortal';
import { getProviders, getProvider } from './api/client';

// SplashScreen is the entry/landing screen — keep it eager so first paint is
// instant. Everything else is code-split so the initial bundle stays small,
// which matters a lot on free-tier hosting + slow Telegram in-app networks.
import SplashScreen from './pages/SplashScreen';

// The bottom-nav destinations are kept as named importers so they can be
// warmed on idle (see prefetchTabs below). Without that, the first tap on a
// tab pays for a chunk download over a Telegram in-app connection, which is
// exactly the pause that makes a Mini App feel like a web page.
const importHome = () => import('./pages/ForYouScreen');
const importExplore = () => import('./pages/ExploreScreen');
const importCommunity = () => import('./pages/CommunityList');
const importProfile = () => import('./pages/ProfileScreen');
const importProviderDetail = () => import('./pages/ProviderDetail');

const OnboardingFlow = lazy(() => import('./pages/OnboardingFlow'));
const ForYouScreen = lazy(importHome);
const ExploreScreen = lazy(importExplore);
const NotificationsScreen = lazy(() => import('./pages/NotificationsScreen'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const EventsScreen = lazy(() => import('./pages/EventsScreen'));
const AboutScreen = lazy(() => import('./pages/AboutScreen'));
const VisitScreen = lazy(() => import('./pages/VisitScreen'));
const ProviderDetail = lazy(importProviderDetail);
const CommunityList = lazy(importCommunity);
const CommunityDetail = lazy(() => import('./pages/CommunityDetail'));
const CircleDetailScreen = lazy(() => import('./pages/CircleDetailScreen'));
const BookingFlow = lazy(() => import('./pages/BookingFlow'));
const ProfileScreen = lazy(importProfile);
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const FollowersList = lazy(() => import('./pages/FollowersList'));
const TrainerVerification = lazy(() => import('./pages/TrainerVerification'));
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
const AdminTrainerVerifications = lazy(() => import('./pages/admin/AdminTrainerVerifications'));
const AdminPaidCircles = lazy(() => import('./pages/admin/AdminPaidCircles'));
const AdminPointsAward = lazy(() => import('./pages/admin/AdminPointsAward'));

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

/**
 * Pull the bottom-nav route chunks down once the browser is idle, so switching
 * tabs is a render rather than a download. Failures are ignored — the chunk
 * will simply be fetched on demand as before.
 */
function prefetchTabs() {
  const warm = () => {
    [importHome, importExplore, importCommunity, importProfile, importProviderDetail]
      .forEach(load => { load().catch(() => {}); });
    // A single live provider (Boston Day Spa) is the most probable next
    // screen after Explore/Home — warm its detail payload into the cache so
    // the tap feels free (Phase 2: instant open).
    getProviders()
      .then(res => {
        const live = (res.providers || []).find(p => !p.is_coming_soon);
        if (live) return getProvider(live.id);
      })
      .catch(() => {});
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(warm, { timeout: 4000 });
  else setTimeout(warm, 2000);
}

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

  useEffect(() => { if (!isProviderPortalDomain()) prefetchTabs(); }, []);
  useDoubleBackToExit();

  return (
    <ProviderPortalAuthProvider>
      <div className="app-shell">
        <ToastContainer />
        <Header onMenuOpen={() => setMenuOpen(true)} />
        <BurgerMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Auth & Onboarding — the "/" route below is skipped on
                  provider.wellcircle.et since the portal route claims "/" there */}
              {!isProviderPortalDomain() && <Route path="/" element={<SplashScreen />} />}
              <Route path="/onboarding" element={<OnboardingFlow />} />

              {/* Printed-QR landing: asks "do you have Telegram?" and routes
                  the answer to the bot or to the web entry at "/". */}
              <Route path="/visit" element={<VisitScreen />} />

              {/* Main tabs */}
              <Route path="/home" element={<ForYouScreen />} />
              <Route path="/explore" element={<ExploreScreen />} />
              <Route path="/notifications" element={<NotificationsScreen />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/users/me/bookings" element={<MyBookings />} />
              <Route path="/community" element={<CommunityList />} />
              <Route path="/profile" element={<ProfileScreen />} />

              {/* Burger-menu destinations — the screens with no permanent
                  entry point on the bottom nav or header. */}
              <Route path="/events" element={<EventsScreen />} />
              <Route path="/about" element={<AboutScreen />} />
              <Route path="/trainer/verify" element={<TrainerVerification />} />

              {/* Detail screens */}
              <Route path="/provider/:id" element={<ProviderDetail />} />
              <Route path="/community/:id" element={<CommunityDetail />} />
              <Route path="/circle/:id" element={<CircleDetailScreen />} />
              <Route path="/booking/:providerId" element={<BookingFlow />} />
              <Route path="/users/:id" element={<PublicProfile />} />
              <Route path="/users/:id/followers" element={<FollowersList />} />
              <Route path="/users/:id/following" element={<FollowersList />} />

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
                <Route path="trainers" element={<AdminTrainerVerifications />} />
                <Route path="paid-circles" element={<AdminPaidCircles />} />
                <Route path="award-points" element={<AdminPointsAward />} />
              </Route>

              {/* Provider website — Telegram Login Widget auth, not the Mini App.
                  On provider.wellcircle.et this is the whole site, so it's mounted
                  at root paths instead of the redundant /provider-portal prefix. */}
              <Route path={`${providerPortalBase()}/login`} element={<ProviderPortalLogin />} />
              <Route path={providerPortalBase() || '/'} element={<ProviderPortalGuard><ProviderPortalShell /></ProviderPortalGuard>}>
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
