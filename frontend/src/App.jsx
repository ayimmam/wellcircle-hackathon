import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import BurgerMenu from './components/BurgerMenu';
import ToastContainer from './components/Toast';

// Pages
import SplashScreen from './pages/SplashScreen';
import OnboardingFlow from './pages/OnboardingFlow';
import HomeScreen from './pages/HomeScreen';
import ExploreScreen from './pages/ExploreScreen';
import ProviderDetail from './pages/ProviderDetail';
import CommunityList from './pages/CommunityList';
import CommunityDetail from './pages/CommunityDetail';
import CircleDetailScreen from './pages/CircleDetailScreen';
import BookingFlow from './pages/BookingFlow';
import ProfileScreen from './pages/ProfileScreen';
import ProviderDashboard from './pages/ProviderDashboard';
import AdminGuard from './components/AdminGuard';
import AdminLayout from './pages/admin/AdminLayout';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminProviders from './pages/admin/AdminProviders';
import AdminProducts from './pages/admin/AdminProducts';
import AdminReports from './pages/admin/AdminReports';
import ProviderOnboard from './pages/ProviderOnboard';
import ProductsStore from './pages/ProductsStore';
import ProductDetail from './pages/ProductDetail';
import ProductRedeem from './pages/ProductRedeem';
import MyRedemptions from './pages/MyRedemptions';

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-shell">
          <ToastContainer />
          <Header onMenuOpen={() => setMenuOpen(true)} />
          <BurgerMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

          <Routes>
            {/* Auth & Onboarding */}
            <Route path="/" element={<SplashScreen />} />
            <Route path="/onboarding" element={<OnboardingFlow />} />

            {/* Main tabs */}
            <Route path="/home" element={<HomeScreen />} />
            <Route path="/explore" element={<ExploreScreen />} />
            <Route path="/community" element={<CommunityList />} />
            <Route path="/profile" element={<ProfileScreen />} />

            {/* Detail screens */}
            <Route path="/provider/:id" element={<ProviderDetail />} />
            <Route path="/community/:id" element={<CommunityDetail />} />
            <Route path="/circle/:id" element={<CircleDetailScreen />} />
            <Route path="/booking/:providerId" element={<BookingFlow />} />

            {/* Provider dashboard */}
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
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <BottomNav />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
