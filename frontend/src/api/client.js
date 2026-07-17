/**
 * Well Circle — API Client
 * 
 * Mock mode by default. Set USE_MOCK = false and configure API_BASE
 * to connect to the real FastAPI backend.
 */

let USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/** Vercel proxy target — see frontend/vercel.json rewrites */
const BACKEND_ORIGIN = 'https://wellcircle-hackathon-backend.vercel.app';

function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (import.meta.env.PROD) {
    // Same-origin /api proxy avoids CORS blocks in Telegram WebView
    if (!configured || configured.startsWith(BACKEND_ORIGIN)) {
      return '/api';
    }
    return configured;
  }
  return configured || 'http://localhost:8000/api';
}

const API_BASE = resolveApiBase();

export function getApiBase() { return API_BASE; }

import {
  MOCK_USER, MOCK_PROVIDERS, MOCK_COMMUNITIES, MOCK_FEED_EVENTS,
  MOCK_POINTS_HISTORY, MOCK_PROVIDER_STATS, MOCK_CIRCLES, MOCK_POSTS, MOCK_LEADERBOARD,
  MOCK_PRODUCTS, MOCK_REDEMPTIONS, MOCK_ADMIN_ANALYTICS, MOCK_PENDING_PROVIDERS,
  MOCK_ADMIN_PROVIDERS, MOCK_ADMIN_PRODUCTS, MOCK_PROVIDER_PRODUCTS,
  MOCK_PROVIDER_CUSTOMERS, MOCK_PRICE_SUGGESTION, MOCK_PROVIDER_POINTS_ANALYTICS,
  MOCK_SOCIAL_PROOF, MOCK_EVENTS, MOCK_RANKS,
} from '../data/mock';

// ─── Auth helpers ───────────────────────────────────
let authToken = null;

export function setToken(token) { authToken = token; }
export function getToken() { return authToken; }

// Mock mode has no backend to persist to — bookings created via
// createBooking() are kept here so getMyBookings() can read them back
// within the same session (mirrors what a real backend would do).
const mockBookingsCreatedThisSession = [];

const REQUEST_TIMEOUT_MS = 15000;
const NETWORK_RETRY_DELAY_MS = 800;

function isNetworkError(err) {
  return err instanceof TypeError
    || err?.message === 'Failed to fetch'
    || err?.name === 'AbortError';
}

function wrapNetworkError(err) {
  // Keep technical detail in the console for debugging; show users plain language.
  if (err.name === 'AbortError') {
    console.error(`[WellCircle] Request timed out (API_BASE=${API_BASE})`, err);
    return new Error('This is taking longer than usual. Please check your connection and try again.');
  }
  if (err instanceof TypeError || err?.message === 'Failed to fetch') {
    console.error(`[WellCircle] Network error reaching ${API_BASE}`, err);
    return new Error("We couldn't connect right now. Please check your connection and try again.");
  }
  return err;
}

async function request(method, path, body = null, extraOptions = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      signal: controller.signal,
      ...extraOptions
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Request failed' }));
      let msg = err.detail || 'Request failed';
      if (Array.isArray(msg)) {
        msg = msg.map(e => `${e.loc ? e.loc.slice(-1) : 'Field'}: ${e.msg}`).join(', ');
      }
      // Server attaches a correlation id on errors — log it so support can trace.
      const reqId = err.request_id || res.headers.get('X-Request-ID');
      if (res.status >= 500) {
        console.error(`[WellCircle] Server error ${res.status} on ${method} ${path} (request_id=${reqId || 'n/a'})`);
      }
      throw new Error(msg);
    }
    return res.json();
  } catch (err) {
    throw wrapNetworkError(err);
  } finally {
    clearTimeout(timeoutId);
  }
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
    throw Object.assign(
      new Error('Telegram initData is missing. Please open the app inside Telegram, or set VITE_USE_MOCK=true for testing.'),
      { code: 'TELEGRAM_INIT_DATA_MISSING' }
    );
  }

  try {
    return await request('POST', '/auth/telegram', { init_data: initData });
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    await delay(NETWORK_RETRY_DELAY_MS);
    return request('POST', '/auth/telegram', { init_data: initData });
  }
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
      suggested_communities: MOCK_COMMUNITIES.filter(c => (data.interest_categories || []).includes(c.category)).slice(0, 3),
      // mirrors backend endowed-progress welcome award
      welcome_points: 20,
      points_balance: (MOCK_USER.points_balance || 0) + 20,
    };
  }
  const payload = {
    name: data.name,
    interest_categories: data.interest_categories,
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
      current_streak: (MOCK_USER.current_streak || 0) + 1,
      freeze_count: MOCK_USER.freeze_count || 0,
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

export async function createInteraction(communityId, targetUserId, actionType) {
  if (USE_MOCK) {
    await delay(300);
    return { status: "Interaction logged and pushed to feed" };
  }
  return request('POST', `/communities/${communityId}/interactions`, {
    target_user_id: targetUserId,
    action_type: actionType
  });
}

// ─── Bookings & Payments ────────────────────────────
export async function createBooking(data) {
  if (USE_MOCK) {
    await delay(500);
    // Mirror the backend's server-side promo application: clients send the
    // undiscounted per-day amount; an eligible promotion knocks off a flat %
    // on the primary (first) day only.
    const provider = MOCK_PROVIDERS.find(p => p.id === data.provider_id);
    const promo = provider?.active_promotion;
    const eligible = promo && promo.discount_pct > 0 && promo.user_eligible !== false;
    const discountEtb = eligible
      ? Math.min(Math.round((data.amount_etb * promo.discount_pct) / 100), data.amount_etb)
      : 0;
    const primaryAmount = data.amount_etb - discountEtb;
    // Multi-day booking: one sibling per additional date, each at the plain
    // per-day rate (mirrors backend create_sibling_bookings — no discount).
    const extraDates = data.additional_slot_datetimes || [];
    const additionalBookingIds = extraDates.map((_, i) => `bk-new-${Date.now()}-${i + 1}`);
    const booking = {
      id: 'bk-new-' + Date.now(),
      ...data,
      provider_name: provider?.name || '',
      amount_etb: primaryAmount,
      promotion: discountEtb > 0 ? {
        id: promo.id,
        headline: promo.headline,
        discount_pct: promo.discount_pct,
        discount_etb: discountEtb,
      } : null,
      // Every booking starts pending — pay_on_site bookings wait on our team
      // calling to confirm, not an automatic flip (mirrors the backend).
      payment_status: 'pending',
      created_at: new Date().toISOString(),
      additional_booking_ids: additionalBookingIds,
      total_amount_etb: primaryAmount + extraDates.length * data.amount_etb,
    };
    // Mock mode has no backend to persist to — keep it in-session so
    // getMyBookings() can read it back (see mockBookingsCreatedThisSession).
    mockBookingsCreatedThisSession.push(booking);
    return booking;
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
    return { id: 'mock-circle-' + Date.now(), name: data.name, join_code: 'MOCK' + Date.now().toString(36).toUpperCase(), message: 'Circle created successfully' };
  }
  return request('POST', '/circles', data);
}

export async function joinCircle(id, joinCode = null) {
  if (USE_MOCK) {
    await delay();
    const circle = MOCK_CIRCLES.find(c => c.id === id);
    return { id, name: circle?.name || 'Circle', join_code: circle?.join_code || null, message: 'Joined circle successfully' };
  }
  return request('POST', `/circles/${id}/join`, { join_code: joinCode });
}

export async function getCircleLeaderboard(id) {
  if (USE_MOCK) {
    await delay();
    return { leaderboard: [...MOCK_LEADERBOARD] };
  }
  return request('GET', `/circles/${id}/leaderboard`);
}

// E1: join a circle via a `?startapp=circle_{code}` deep link
export async function joinCircleByCode(joinCode) {
  if (USE_MOCK) {
    await delay();
    return { id: 'mock-circle-id', name: 'Mock Circle', message: 'Joined circle successfully' };
  }
  return request('POST', '/circles/join-by-code', { join_code: joinCode });
}

// E2: how many circle-mates checked in today, across all the user's circles
export async function getCircleSocialProof() {
  if (USE_MOCK) {
    await delay();
    return { ...MOCK_SOCIAL_PROOF };
  }
  return request('GET', '/circles/social-proof/today');
}

// ─── Posts & Reactions ────────────────────────────────
export async function getPosts(communityId = null, circleId = null) {
  if (USE_MOCK) {
    await delay();
    let posts = [...MOCK_POSTS];
    if (circleId) posts = posts.filter(p => p.circle_id === circleId);
    return { posts };
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

export async function commentOnPost(postId, content, parentCommentId = null) {
  if (USE_MOCK) {
    await delay();
    return { id: 'mock-comment', message: "Success" };
  }
  return request('POST', `/posts/${postId}/comments`, {
    content,
    ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
  });
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

// C1: distinct customers (booking or check-in) with last-visit + lifetime redeemed
export async function getProviderCustomers() {
  if (USE_MOCK) {
    await delay();
    return { customers: [...MOCK_PROVIDER_CUSTOMERS], count: MOCK_PROVIDER_CUSTOMERS.length };
  }
  return request('GET', '/providers/me/customers');
}

// D3: one-tap point award to a verified customer (max 50/award, 1/day/customer, 300/day total)
export async function awardCustomerPoints(customerUserId, points, note = null) {
  if (USE_MOCK) {
    await delay(400);
    return {
      transaction_id: 'mock-txn-' + Date.now(),
      customer_user_id: customerUserId,
      points_awarded: points,
      customer_new_balance: (MOCK_USER.points_balance || 0) + points,
      provider_daily_remaining: 300 - points,
    };
  }
  const qs = new URLSearchParams({ points: String(points) });
  if (note) qs.set('note', note);
  return request('POST', `/providers/me/customers/${customerUserId}/award?${qs}`);
}

// D1: recommended point cost for a new product, based on category peers
export async function getPriceSuggestion(category) {
  if (USE_MOCK) {
    await delay();
    return { ...MOCK_PRICE_SUGGESTION, category };
  }
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return request('GET', `/providers/me/products/price-suggestion${qs}`);
}

// C5: points redeemed at this provider — weekly trend for the analytics tab
export async function getProviderPointsAnalytics() {
  if (USE_MOCK) {
    await delay();
    return { ...MOCK_PROVIDER_POINTS_ANALYTICS };
  }
  return request('GET', '/providers/me/analytics/points');
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

export async function getAdminUsers(params = {}) {
  if (USE_MOCK) {
    await delay();
    return {
      users: [{ id: 'u1', telegram_id: 123, name: 'Meron Tadesse', is_onboarded: true, points_balance: 120, created_at: new Date().toISOString() }],
      total: 1, page: 1, per_page: 100, pages: 1,
    };
  }
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') qs.set(k, v); });
  return request('GET', `/admin/users?${qs}`);
}

export async function getAdminRedemptions(params = {}) {
  if (USE_MOCK) {
    await delay();
    return {
      redemptions: [{ id: 'r1', user_name: 'Meron', product_name: 'Yoga Session', provider_name: 'Shanti Yoga', points_spent: 500, type: 'digital', delivery_status: 'pending', redeemed_at: new Date().toISOString() }],
      total: 1, page: 1, per_page: 50,
    };
  }
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') qs.set(k, v); });
  return request('GET', `/admin/redemptions?${qs}`);
}

export async function getAdminBookings(params = {}) {
  if (USE_MOCK) {
    await delay();
    return {
      bookings: [{ id: 'b1', user_name: 'Meron', provider_name: 'Shanti Yoga', service_name: 'Vinyasa Flow', amount_etb: 500, payment_method: 'telebirr', payment_status: 'success', slot_datetime: new Date().toISOString(), created_at: new Date().toISOString() }],
      total: 1, page: 1, per_page: 100,
    };
  }
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') qs.set(k, v); });
  return request('GET', `/admin/bookings?${qs}`);
}

export async function updateRedemptionStatus(redemptionId, status, notes = '') {
  if (USE_MOCK) { await delay(); return { redemption_id: redemptionId, delivery_status: status, provider_notes: notes }; }
  return request('POST', `/admin/redemptions/${redemptionId}/update-status`, { status, notes: notes || undefined });
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

// ─── Phase 3 ──────────────────────────────────────
export async function getEvents(params = {}) {
  if (USE_MOCK) return { events: [...MOCK_EVENTS], count: MOCK_EVENTS.length };
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') qs.set(k, String(v));
  });
  const q = qs.toString();
  return request('GET', q ? `/events?${q}` : '/events');
}

export async function getFeaturedEvents() {
  if (USE_MOCK) {
    await delay();
    return { events: [] };
  }
  const to = new Date();
  to.setDate(to.getDate() + 7);
  return request('GET', `/events?boosted_only=true&limit=10&to=${to.toISOString()}`);
}

export async function getRanks() {
  if (USE_MOCK) {
    await delay();
    return MOCK_RANKS;
  }
  return request('GET', '/ranks');
}

// ─── Feedback (V2 UX Phase 6) ───────────────────────
// In-memory mock store — mirrors the backend's feedback table for the
// duration of a mock-mode session so the Admin Feedback tab can list
// what was just submitted via submitFeedback().
let _mockFeedback = [];

export async function submitFeedback({ type, message, context }) {
  if (USE_MOCK) {
    await delay();
    const item = {
      id: `mock-fb-${_mockFeedback.length + 1}`,
      user_id: MOCK_USER.id,
      user_name: MOCK_USER.name,
      user_handle: MOCK_USER.telegram_handle,
      type, message, context: context || null,
      status: 'new',
      created_at: new Date().toISOString(),
    };
    _mockFeedback = [item, ..._mockFeedback];
    return { id: item.id };
  }
  return request('POST', '/feedback', { type, message, context });
}

export async function getAdminFeedback({ type, status, page = 1 } = {}) {
  if (USE_MOCK) {
    await delay();
    let items = _mockFeedback;
    if (type) items = items.filter(f => f.type === type);
    if (status) items = items.filter(f => f.status === status);
    return { items, total: items.length, page };
  }
  const qs = new URLSearchParams();
  if (type) qs.set('type', type);
  if (status) qs.set('status', status);
  qs.set('page', String(page));
  return request('GET', `/admin/feedback?${qs.toString()}`);
}

export async function updateFeedbackStatus(id, status) {
  if (USE_MOCK) {
    await delay();
    _mockFeedback = _mockFeedback.map(f => f.id === id ? { ...f, status } : f);
    return { id, status };
  }
  return request('PATCH', `/admin/feedback/${id}`, { status });
}

export async function getChallenges(communityId) {
  if (USE_MOCK) return { challenges: [] };
  return request('GET', `/communities/${communityId}/challenges`);
}

export async function createCommunityChallenge(communityId, data) {
  if (USE_MOCK) return { id: 'chal-new-' + Date.now(), ...data };
  return request('POST', `/providers/me/communities/${communityId}/challenges`, data);
}

export async function getLeaderboard(communityId) {
  if (USE_MOCK) return { leaderboard: [] };
  return request('GET', `/communities/${communityId}/leaderboard`);
}

export async function getNotifications() {
  if (USE_MOCK) return { notifications: [], unread_count: 0 };
  return request('GET', '/users/me/notifications');
}

export async function getNotificationUnreadCount() {
  if (USE_MOCK) return 0;
  const res = await request('GET', '/users/me/notifications?unread=true&limit=1');
  return res.unread_count ?? 0;
}

export async function markNotificationRead(id) {
  if (USE_MOCK) return { is_read: true };
  return request('POST', `/users/me/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  if (USE_MOCK) return { marked_read: 0 };
  return request('POST', '/users/me/notifications/read-all');
}

export async function getMyBookings() {
  if (USE_MOCK) return { bookings: mockBookingsCreatedThisSession };
  return request('GET', '/users/me/bookings');
}

export async function getProviderEvents(providerId) {
  if (USE_MOCK) return { events: [] };
  return request('GET', `/providers/${providerId}/events`);
}

export async function createProviderEvent(data) {
  if (USE_MOCK) return { id: 'evt-new-' + Date.now(), ...data };
  return request('POST', '/providers/me/events', data);
}

export async function updateProviderEvent(eventId, data) {
  if (USE_MOCK) return { id: eventId, ...data };
  return request('PATCH', `/providers/me/events/${eventId}`, data);
}

export async function getSubscriptionPlans() {
  if (USE_MOCK) {
    // mirrors backend SUBSCRIPTION_PLANS (subscription_service.py)
    return { plans: [
      { plan_id: 'starter', name: 'Starter', amount_etb: 500, billing: 'monthly',
        features: ['1 community space', 'Basic dashboard (members, check-ins)', 'Up to 5 events per month'] },
      { plan_id: 'growth', name: 'Growth', amount_etb: 1500, billing: 'monthly',
        features: ['3 community spaces', 'Full dashboard + analytics', 'Unlimited events', 'Products store access', 'Community challenges'] },
      { plan_id: 'pro', name: 'Pro', amount_etb: 3000, billing: 'monthly',
        features: ['Unlimited community spaces', 'Featured placement in Explore', 'Event boost credits (3/month)', 'All Growth features', 'Priority support'] },
    ] };
  }
  const res = await request('GET', '/subscriptions/plans');
  const plans = (res.plans || []).map(p => ({
    ...p,
    plan_id: p.id || p.plan_id,
    amount_etb: p.price_etb ?? p.amount_etb,
  }));
  return { plans };
}

export async function initiateSubscription(data) {
  if (USE_MOCK) return { subscription_id: 'sub-mock', to_pay_url: 'https://mock.pay', trade_no: 'mock' };
  if (data.provider_id) {
    return request('POST', '/subscriptions/initiate', data);
  }
  return request('POST', '/providers/me/subscriptions/initiate', data);
}

export async function getSubscriptionStatus(subscriptionId) {
  if (USE_MOCK) return { subscription_id: subscriptionId, plan: 'growth', status: 'active' };
  return request('GET', `/subscriptions/status/${subscriptionId}`);
}

export async function createProviderPromotion(data) {
  if (USE_MOCK) return { id: 'promo-mock', ...data, is_active: true };
  return request('POST', '/providers/me/promotions', data);
}
