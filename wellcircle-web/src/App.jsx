import { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import BurgerMenu from './components/BurgerMenu';
import ToastContainer from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import AdminGuard from './components/AdminGuard';

import LoginScreen from './pages/LoginScreen';
import LandingPage from './pages/LandingPage';
import SplashScreen from './pages/SplashScreen';

const OnboardingFlow = lazy(() => import('./pages/OnboardingFlow'));
const ForYouScreen = lazy(() => import('./pages/ForYouScreen'));
const ExploreScreen = lazy(() => import('./pages/ExploreScreen'));
const NotificationsScreen = lazy(() => import('./pages/NotificationsScreen'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const EventsScreen = lazy(() => import('./pages/EventsScreen'));
const AboutScreen = lazy(() => import('./pages/AboutScreen'));
const ProviderDetail = lazy(() => import('./pages/ProviderDetail'));
const CommunityList = lazy(() => import('./pages/CommunityList'));
const CommunityDetail = lazy(() => import('./pages/CommunityDetail'));
const CircleDetailScreen = lazy(() => import('./pages/CircleDetailScreen'));
const BookingFlow = lazy(() => import('./pages/BookingFlow'));
const ProfileScreen = lazy(() => import('./pages/ProfileScreen'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const FollowersList = lazy(() => import('./pages/FollowersList'));
const TrainerVerification = lazy(() => import('./pages/TrainerVerification'));
const ProviderDashboard = lazy(() => import('./pages/ProviderDashboard'));
const ProviderOnboard = lazy(() => import('./pages/ProviderOnboard'));
const ProductsStore = lazy(() => import('./pages/ProductsStore'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const ProductRedeem = lazy(() => import('./pages/ProductRedeem'));
const MyRedemptions = lazy(() => import('./pages/MyRedemptions'));

// Admin bundle
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminProviders = lazy(() => import('./pages/admin/AdminProviders'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback'));
const AdminTrainerVerifications = lazy(() => import('./pages/admin/AdminTrainerVerifications'));
const AdminPaidCircles = lazy(() => import('./pages/admin/AdminPaidCircles'));
const AdminPointsAward = lazy(() => import('./pages/admin/AdminPointsAward'));

function RouteFallback() {
  return (
    <div className="route-fallback" style={{ padding: 16 }} aria-busy="true">
      <div className="skeleton" style={{ height: 120, marginBottom: 12, borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 80, borderRadius: 16 }} />
    </div>
  );
}

function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (user) {
    return user.is_onboarded ? <Navigate to="/home" replace /> : <Navigate to="/onboarding" replace />;
  }
  return <LoginScreen />;
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell web-shell">
      <ToastContainer />
      <Header onMenuOpen={() => setMenuOpen(true)} />
      <BurgerMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <main className="app-main-content">
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Primary entry: shows Login/Signup directly on app.wellcircle.et */}
              <Route path="/" element={<RootRoute />} />
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/splash" element={<SplashScreen />} />
              <Route path="/onboarding" element={<OnboardingFlow />} />

              {/* Main tabs */}
              <Route path="/home" element={<ForYouScreen />} />
              <Route path="/explore" element={<ExploreScreen />} />
              <Route path="/notifications" element={<NotificationsScreen />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/users/me/bookings" element={<MyBookings />} />
              <Route path="/community" element={<CommunityList />} />
              <Route path="/profile" element={<ProfileScreen />} />

              {/* Burger menu destinations */}
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

              {/* Provider management */}
              <Route path="/provider-dashboard" element={<ProviderDashboard />} />
              <Route path="/provider-onboard" element={<ProviderOnboard />} />

              {/* Products & Rewards store */}
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

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <BottomNav />
    </div>
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
