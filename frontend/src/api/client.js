/**
 * Well Circle — API Client
 * 
 * Mock mode by default. Set USE_MOCK = false and configure API_BASE
 * to connect to the real FastAPI backend.
 */

let USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

import {
  MOCK_USER, MOCK_PROVIDERS, MOCK_COMMUNITIES, MOCK_FEED_EVENTS,
  MOCK_POINTS_HISTORY, MOCK_PROVIDER_STATS, MOCK_CIRCLES, MOCK_POSTS, MOCK_LEADERBOARD,
  MOCK_PRODUCTS, MOCK_REDEMPTIONS, MOCK_ADMIN_ANALYTICS, MOCK_PENDING_PROVIDERS,
  MOCK_ADMIN_PROVIDERS, MOCK_ADMIN_PRODUCTS, MOCK_PROVIDER_PRODUCTS
} from '../data/mock';

// ─── Auth helpers ───────────────────────────────────
let authToken = null;

export function setToken(token) { authToken = token; }
export function getToken() { return authToken; }

async function request(method, path, body = null, extraOptions = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
    ...extraOptions
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// ─── Simulated delay for mock responses ─────────────
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

// ─── Auth ───────────────────────────────────────────
export async function authTelegram(initData) {
  if (USE_MOCK) {
    await delay(800);
    return { token: 'mock-jwt-token', user: { ...MOCK_USER }, is_new_user: false };
  }
  if (!initData || initData === 'mock-init-data') {
    throw new Error('Telegram initData is missing. Please open the app inside Telegram, or set VITE_USE_MOCK=true for testing.');
  }

  return request('POST', '/auth/telegram', { init_data: initData });
}

// ─── Users ──────────────────────────────────────────
export async function getMe() {
  if (USE_MOCK) { await delay(); return { ...MOCK_USER }; }
  return request('GET', '/users/me');
}

export async function onboardUser(data) {
  if (USE_MOCK) {
    await delay(500);
    return {
      ...MOCK_USER,
      ...data,
      is_onboarded: true,
      auto_joined_communities: data.suggested_circle_ids || [],
      suggested_communities: MOCK_COMMUNITIES.filter(c => c.category === data.interest_category).slice(0, 3)
    };
  }
  const payload = {
    name: data.name,
    interest_category: data.interest_category,
    exercise_frequency: data.exercise_frequency
  };
  if (data.goal) payload.goal = data.goal;
  if (data.suggested_circle_ids?.length) payload.suggested_circle_ids = data.suggested_circle_ids;

  return request('POST', '/users/me/onboard', payload);
}

export async function updateProfile(data) {
  if (USE_MOCK) {
    await delay();
    return { ...MOCK_USER, ...data };
  }
  return request('PATCH', '/users/me', data);
}

export async function getPointsHistory() {
  if (USE_MOCK) { await delay(); return { ...MOCK_POINTS_HISTORY }; }
  return request('GET', '/users/me/points-history');
}

// ─── Providers ──────────────────────────────────────
export async function getProviders(category = null, search = null) {
  if (USE_MOCK) {
    await delay();
    let providers = [...MOCK_PROVIDERS];
    if (category && category !== 'all') providers = providers.filter(p => p.category === category);
    if (search) providers = providers.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    return { providers, count: providers.length };
  }
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  return request('GET', `/providers?${params}`);
}

export async function getProvider(id) {
  if (USE_MOCK) {
    await delay();
    const p = MOCK_PROVIDERS.find(p => p.id === id);
    if (!p) throw new Error('Provider not found');
    return { ...p };
  }
  return request('GET', `/providers/${id}`);
}

export async function getProviderStats(id) {
  if (USE_MOCK) { await delay(); return { ...MOCK_PROVIDER_STATS }; }
  return request('GET', `/providers/${id}/stats`);
}

// ─── Communities ────────────────────────────────────
export async function getCommunities(joined = null, category = null) {
  if (USE_MOCK) {
    await delay();
    let communities = [...MOCK_COMMUNITIES];
    if (joined) communities = communities.filter(c => c.user_joined);
    if (category && category !== 'all') communities = communities.filter(c => c.category === category);
    return { communities, count: communities.length };
  }
  const params = new URLSearchParams();
  if (joined) params.set('joined', 'true');
  if (category) params.set('category', category);
  return request('GET', `/communities?${params}`);
}

export async function getCommunity(id) {
  if (USE_MOCK) {
    await delay();
    const c = MOCK_COMMUNITIES.find(c => c.id === id);
    if (!c) throw new Error('Community not found');
    return { ...c };
  }
  return request('GET', `/communities/${id}`);
}

export async function joinCommunity(id) {
  if (USE_MOCK) {
    await delay(400);
    const c = MOCK_COMMUNITIES.find(c => c.id === id);
    return {
      community_id: id,
      member_count: (c?.member_count || 0) + 1,
      joined: true,
      feed_event: {
        id: 'evt-new-join-' + Date.now(),
        event_type: 'join',
        user_name: MOCK_USER.name.split(' ')[0],
        created_at: new Date().toISOString()
      }
    };
  }
  return request('POST', `/communities/${id}/join`);
}

export async function leaveCommunity(id) {
  if (USE_MOCK) {
    await delay(400);
    const c = MOCK_COMMUNITIES.find(c => c.id === id);
    return { community_id: id, member_count: (c?.member_count || 1) - 1, left: true };
  }
  return request('POST', `/communities/${id}/leave`);
}

export async function checkinCommunity(id) {
  if (USE_MOCK) {
    await delay(400);
    return {
      points_earned: 10,
      new_balance: MOCK_USER.points_balance + 10,
      tier: 'sprout',
      tier_emoji: '🌿',
      feed_event: {
        id: 'evt-new-checkin-' + Date.now(),
        event_type: 'checkin',
        user_name: MOCK_USER.name.split(' ')[0],
        created_at: new Date().toISOString()
      }
    };
  }
  return request('POST', `/communities/${id}/checkin`);
}

export async function getCommunityFeed(id, since = null) {
  if (USE_MOCK) {
    await delay(200);
    let events = [...MOCK_FEED_EVENTS];
    if (since) events = events.filter(e => new Date(e.created_at) > new Date(since));
    return { events, count: events.length };
  }
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  return request('GET', `/communities/${id}/feed?${params}`);
}

// ─── Bookings & Payments ────────────────────────────
export async function createBooking(data) {
  if (USE_MOCK) {
    await delay(500);
    return {
      id: 'bk-new-' + Date.now(),
      ...data,
      payment_status: 'pending',
      created_at: new Date().toISOString()
    };
  }
  return request('POST', '/bookings', data);
}

export async function initiateTelebirr(bookingId) {
  if (USE_MOCK) {
    await delay(600);
    return {
      booking_id: bookingId,
      to_pay_url: 'https://app.ethiomobilemoney.et/demo',
      trade_no: 'WC' + Date.now()
    };
  }
  return request('POST', '/payments/telebirr/initiate', { booking_id: bookingId });
}

export async function initiateMpesa(bookingId, phoneNumber) {
  if (USE_MOCK) {
    await delay(600);
    return {
      booking_id: bookingId,
      checkout_request_id: 'ws_CO_' + Date.now(),
      message: 'STK Push sent. Check your phone.'
    };
  }
  return request('POST', '/payments/mpesa/initiate', { booking_id: bookingId, phone_number: phoneNumber });
}

export async function getPaymentStatus(bookingId) {
  if (USE_MOCK) {
    await delay(300);
    // Simulate success after a few polls
    return {
      booking_id: bookingId,
      payment_status: 'success',
      payment_method: 'telebirr',
      amount_etb: 500,
      reference_number: 'WC' + Date.now()
    };
  }
  return request('GET', `/payments/${bookingId}/status`);
}

// ─── Circles ─────────────────────────────────────────
export async function getCircles() {
  if (USE_MOCK) {
    await delay();
    return { circles: [...MOCK_CIRCLES] };
  }
  return request('GET', '/circles');
}

export async function createCircle(data) {
  if (USE_MOCK) {
    await delay();
    return { id: 'mock-circle-id', name: data.name };
  }
  return request('POST', '/circles', data);
}

export async function joinCircle(id) {
  if (USE_MOCK) {
    await delay();
    return { message: "Joined successfully" };
  }
  return request('POST', `/circles/${id}/join`);
}

export async function getCircleLeaderboard(id) {
  if (USE_MOCK) {
    await delay();
    return { leaderboard: [...MOCK_LEADERBOARD] };
  }
  return request('GET', `/circles/${id}/leaderboard`);
}

// ─── Posts & Reactions ────────────────────────────────
export async function getPosts(communityId = null, circleId = null) {
  if (USE_MOCK) {
    await delay();
    return { posts: [...MOCK_POSTS] };
  }
  const params = new URLSearchParams();
  if (communityId) params.set('community_id', communityId);
  if (circleId) params.set('circle_id', circleId);
  return request('GET', `/posts?${params}`);
}

export async function createPost(data) {
  if (USE_MOCK) {
    await delay();
    return { id: 'mock-post-id', message: "Success" };
  }
  return request('POST', '/posts', data);
}

export async function reactToPost(postId, data) {
  if (USE_MOCK) {
    await delay();
    return { message: "Success", points_gifted: data.points_gifted || 0 };
  }
  return request('POST', `/posts/${postId}/react`, data);
}

// ─── Provider Self-Onboarding ───────────────────────
export async function selfOnboardProvider(data) {
  if (USE_MOCK) {
    await delay(600);
    return {
      provider_id: 'prov-new-' + Date.now(),
      name: data.name,
      status: 'pending_approval',
      message: 'Application submitted. Admin will review within 24 hours.'
    };
  }
  return request('POST', '/providers/self-onboard', data);
}

export async function generateInviteCode(expiresInDays = 30) {
  if (USE_MOCK) {
    await delay();
    const expires = new Date();
    expires.setDate(expires.getDate() + expiresInDays);
    return {
      invite_code: 'INVITE-MOCK123XYZ',
      expires_at: expires.toISOString(),
      created_at: new Date().toISOString()
    };
  }
  return request('POST', '/providers/invite-code/generate', { expires_in_days: expiresInDays });
}

export async function getProviderMe() {
  if (USE_MOCK) {
    await delay();
    return {
      id: '11111111-0000-0000-0000-000000000003',
      name: 'Shanti Yoga Addis',
      category: 'yoga',
      status: 'active',
      description: 'Premium yoga studio',
      location_text: 'Bole, Addis Ababa',
      services: [],
      theme_primary_color: '#10B981',
      theme_accent_color: '#F59E0B',
      dashboard_stats: { total_members: 83, new_members_today: 3, total_products: 3, active_products: 2 }
    };
  }
  return request('GET', '/providers/me');
}

// ─── Products Store ─────────────────────────────────
export async function getProducts(params = {}) {
  if (USE_MOCK) {
    await delay();
    let products = [...MOCK_PRODUCTS];
    if (params.search) products = products.filter(p => p.name.toLowerCase().includes(params.search.toLowerCase()));
    if (params.type) products = products.filter(p => p.type === params.type);
    if (params.in_stock_only) products = products.filter(p => p.is_in_stock);
    return { products, total: products.length, page: 1, per_page: 12 };
  }
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') qs.set(k, v); });
  return request('GET', `/products?${qs}`);
}

export async function getProduct(id) {
  if (USE_MOCK) {
    await delay();
    const p = MOCK_PRODUCTS.find(x => x.id === id);
    if (!p) throw new Error('Product not found');
    return { ...p };
  }
  return request('GET', `/products/${id}`);
}

export async function redeemProduct(id, data = {}) {
  if (USE_MOCK) {
    await delay(500);
    const p = MOCK_PRODUCTS.find(x => x.id === id);
    if (!p) throw new Error('Product not found');
    if (MOCK_USER.points_balance < p.price_etb) {
      throw new Error(`Insufficient Legacy Points. You have ${MOCK_USER.points_balance} points; need ${p.price_etb}.`);
    }
    const code = p.type === 'digital' ? 'YOGA-' + Math.random().toString(36).substring(2, 8).toUpperCase() : null;
    return {
      redemption_id: 'red-new-' + Date.now(),
      redemption_code: code,
      delivery_status: 'pending',
      message: 'Product redeemed! Check redemption details below.',
      details: {
        product_name: p.name,
        points_spent: p.price_etb,
        new_balance: MOCK_USER.points_balance - p.price_etb,
        provider_instructions: p.provider_instructions,
        delivery_address: data.delivery_address || null
      }
    };
  }
  return request('POST', `/products/${id}/redeem`, data);
}

export async function getMyRedemptions() {
  if (USE_MOCK) { await delay(); return { redemptions: [...MOCK_REDEMPTIONS], count: MOCK_REDEMPTIONS.length }; }
  return request('GET', '/users/me/redemptions');
}

// ─── Provider Products ────────────────────────────
export async function getProviderProducts() {
  if (USE_MOCK) { await delay(); return { products: [...MOCK_PROVIDER_PRODUCTS], count: MOCK_PROVIDER_PRODUCTS.length }; }
  return request('GET', '/providers/me/products');
}

export async function createProviderProduct(data) {
  if (USE_MOCK) { await delay(); return { id: 'prod-new-' + Date.now(), name: data.name, created: true }; }
  return request('POST', '/providers/me/products', data);
}

export async function getProviderRedemptions() {
  if (USE_MOCK) {
    await delay();
    return {
      redemptions: [
        { id: 'r1', user_name: 'Meron Tadesse', product_name: 'Private Yoga Session', redemption_code: 'YOGA-ABC123', redeemed_at: new Date().toISOString(), delivery_status: 'pending' }
      ],
      count: 1
    };
  }
  return request('GET', '/providers/me/redemptions');
}

// ─── Admin API ────────────────────────────────────
export async function getAdminAnalytics() {
  if (USE_MOCK) { await delay(); return { ...MOCK_ADMIN_ANALYTICS }; }
  return request('GET', '/admin/analytics');
}

export async function getPendingProviders() {
  if (USE_MOCK) { await delay(); return { pending_providers: [...MOCK_PENDING_PROVIDERS], count: MOCK_PENDING_PROVIDERS.length }; }
  return request('GET', '/admin/providers/pending');
}

export async function getAdminProviders(status = null, search = null) {
  if (USE_MOCK) {
    await delay();
    let providers = [...MOCK_ADMIN_PROVIDERS];
    if (status) providers = providers.filter(p => p.status === status);
    if (search) providers = providers.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    return { providers, total: providers.length };
  }
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (search) qs.set('search', search);
  return request('GET', `/admin/providers?${qs}`);
}

export async function approveProvider(id, notes = '') {
  if (USE_MOCK) { await delay(); return { provider_id: id, status: 'active', message: 'Provider approved. Auto-community created.' }; }
  return request('POST', `/admin/providers/${id}/approve`, { notes });
}

export async function rejectProvider(id, rejectionReason) {
  if (USE_MOCK) { await delay(); return { provider_id: id, status: 'rejected', message: 'Provider rejected. Owner notified.' }; }
  return request('POST', `/admin/providers/${id}/reject`, { rejection_reason: rejectionReason });
}

export async function promoteProvider(data) {
  if (USE_MOCK) { await delay(); return { provider_id: 'prov-new', status: 'active', user_id: 'user-new', message: 'User promoted to provider directly.' }; }
  return request('PUT', '/admin/providers/promote-user', data);
}

export async function getAdminProducts(params = {}) {
  if (USE_MOCK) { await delay(); return { products: [...MOCK_ADMIN_PRODUCTS], total: MOCK_ADMIN_PRODUCTS.length }; }
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
  return request('GET', `/admin/products?${qs}`);
}

export async function updateProductStock(productId, quantity) {
  if (USE_MOCK) { await delay(); return { product_id: productId, quantity_in_stock: quantity, updated: true }; }
  return request('POST', `/admin/products/${productId}/update-stock`, { quantity });
}

export async function getAdminNotifications(limit = 20, offset = 0) {
  if (USE_MOCK) {
    await delay();
    return {
      notifications: [
        { id: 'n1', event_type: 'provider_submitted', message: 'Zen Yoga Studio submitted onboarding application', created_at: new Date().toISOString(), is_read: false }
      ],
      unread_count: 1
    };
  }
  return request('GET', `/admin/notifications?limit=${limit}&offset=${offset}`);
}
