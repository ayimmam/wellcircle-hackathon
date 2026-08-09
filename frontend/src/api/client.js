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

import { cached, invalidate, keyOf, write as cacheWrite, setCacheScope, clearAll as clearCache } from './cache';

import {
  MOCK_USER, MOCK_PROVIDERS, MOCK_COMMUNITIES, MOCK_FEED_EVENTS,
  MOCK_POINTS_HISTORY, MOCK_PROVIDER_STATS, MOCK_CIRCLES, MOCK_POSTS, MOCK_LEADERBOARD,
  MOCK_PRODUCTS, MOCK_REDEMPTIONS, MOCK_ADMIN_ANALYTICS, MOCK_PENDING_PROVIDERS,
  MOCK_ADMIN_PROVIDERS, MOCK_ADMIN_PRODUCTS, MOCK_PROVIDER_PRODUCTS,
  MOCK_PROVIDER_CUSTOMERS, MOCK_PRICE_SUGGESTION, MOCK_PROVIDER_POINTS_ANALYTICS,
  MOCK_SOCIAL_PROOF, MOCK_EVENTS, MOCK_RANKS,
  MOCK_PROVIDER_BOOKINGS, MOCK_PROVIDER_SERVICE_BREAKDOWN, MOCK_PROVIDER_DEMOGRAPHICS,
  MOCK_PUBLIC_USERS, MOCK_FOLLOWERS, MOCK_FOLLOWING, MOCK_STRAVA_STATS,
  MOCK_TRAINER_VERIFICATIONS, MOCK_PAID_CIRCLE_APPLICATIONS,
  MOCK_CIRCLE_SUBSCRIPTIONS, MOCK_CIRCLE_REVENUE, buildMockProviderTimeseries,
  MOCK_FOR_YOU_FEED,
} from '../data/mock';

// ─── Auth helpers ───────────────────────────────────
let authToken = null;

export function setToken(token) { authToken = token; }
export function getToken() { return authToken; }

// Re-export the cache controls so screens and contexts have a single import
// site for everything API-related.
export { invalidate as invalidateCache, setCacheScope, clearCache };

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
      const detail = err.detail;
      let msg = (detail && typeof detail === 'object' ? detail.message : detail) || 'Request failed';
      if (Array.isArray(msg)) {
        msg = msg.map(e => `${e.loc ? e.loc.slice(-1) : 'Field'}: ${e.msg}`).join(', ');
      }
      // Server attaches a correlation id on errors — log it so support can trace.
      const reqId = err.request_id || res.headers.get('X-Request-ID');
      if (res.status >= 500) {
        console.error(`[WellCircle] Server error ${res.status} on ${method} ${path} (request_id=${reqId || 'n/a'})`);
      }
      const requestError = new Error(msg);
      requestError.status = res.status;
      requestError.payload = detail && typeof detail === 'object'
        ? { ...err, ...detail }
        : err;
      throw requestError;
    }
    return res.json();
  } catch (err) {
    throw wrapNetworkError(err);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function multipartRequest(path, formData) {
  const headers = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({ detail: 'Upload failed' }));
      const detail = payload.detail;
      const err = new Error(
        (detail && typeof detail === 'object' ? detail.message : detail) || 'Upload failed'
      );
      err.status = res.status;
      err.payload = detail && typeof detail === 'object'
        ? { ...payload, ...detail }
        : payload;
      throw err;
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

/**
 * Cache keys for every read that goes through the response cache.
 *
 * Screens import these to hand `useResource` the same key the client writes
 * to, which is what lets a screen paint from cache on its first render. Keys
 * are grouped into a handful of namespaces (see TTL in ./cache) so a mutation
 * can expire a whole family at once — `invalidate('communities')` covers both
 * the list and every community detail record.
 */
export const cacheKeys = {
  me: () => 'me',
  points: () => 'points',
  bookings: () => 'bookings',
  redemptions: () => 'redemptions',
  notifications: () => 'notifications',
  unread: () => 'unread',
  social: () => 'social',
  ranks: () => 'ranks',
  home: () => 'home',
  trainer: () => 'trainer',
  strava: (userId) => keyOf('strava', { userId }),
  subscriptionPlans: () => 'subscriptions',

  providers: (category, search) => keyOf('providers', { category, search }),
  provider: (id) => keyOf('providers', { id }),
  providerEvents: (id) => keyOf('providers', { id, events: 1 }),

  communities: (joined, category) => keyOf('communities', { joined, category }),
  community: (id) => keyOf('communities', { id }),
  challenges: (communityId) => keyOf('challenges', { communityId }),
  leaderboard: (id) => keyOf('leaderboard', { id }),

  circles: () => 'circles',
  circle: (id) => keyOf('circles', { id, detail: 1 }),
  circleLeaderboard: (id) => keyOf('circles', { id, leaderboard: 1 }),

  posts: (communityId, circleId) => keyOf('posts', { communityId, circleId }),
  feed: (before) => keyOf('feed', { before }),

  products: (params) => keyOf('products', params),
  product: (id) => keyOf('products', { id }),

  events: (params) => keyOf('events', params),
  featuredEvents: () => keyOf('events', { featured: 1 }),

  profile: (userId) => keyOf('profile', { userId }),
  followers: (userId, page) => keyOf('followers', { userId, page }),
  following: (userId, page) => keyOf('followers', { userId, page, dir: 'following' }),

  providerMe: () => 'provider-me',
  providerProducts: () => keyOf('provider-me', { products: 1 }),
  providerCustomers: () => keyOf('provider-me', { customers: 1 }),
  providerPointsAnalytics: () => keyOf('provider-me', { analytics: 'points' }),
  providerDemographics: () => keyOf('provider-me', { analytics: 'demographics' }),
  providerRedemptions: (params) => keyOf('provider-me', { redemptions: 1, ...params }),
  providerBookings: (params) => keyOf('provider-me', { bookings: 1, ...params }),
  providerServices: (params) => keyOf('provider-me', { analytics: 'services', ...params }),
};

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

// Provider website login — Telegram Login Widget callback payload
// ({ id, first_name, last_name?, username?, photo_url?, auth_date, hash }).
// Distinct from authTelegram(): browser tab, not Mini App, and only ever
// signs in an existing provider account — never creates a user.
export async function authTelegramWidget(widgetData) {
  if (USE_MOCK) {
    await delay(600);
    return { token: 'mock-provider-jwt-token', user: { ...MOCK_USER, is_provider: true }, is_new_user: false };
  }
  return request('POST', '/auth/telegram-widget', widgetData);
}

// ─── Users ──────────────────────────────────────────
export async function getMe() {
  return cached(cacheKeys.me(), async () => {
    if (USE_MOCK) { await delay(); return { ...MOCK_USER }; }
    return request('GET', '/users/me');
  });
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

  const result = await request('POST', '/users/me/onboard', payload);
  // Onboarding auto-joins circles and awards welcome points, so the cached
  // user, circle list and home payload are all out of date.
  ['me', 'communities', 'circles', 'home'].forEach(invalidate);
  return result;
}

export async function updateProfile(data) {
  invalidate('me');
  invalidate('profile');
  if (USE_MOCK) {
    await delay();
    Object.assign(MOCK_USER, data);
    return { ...MOCK_USER };
  }
  return request('PATCH', '/users/me', data);
}

export async function getUserProfile(userId) {
  return cached(cacheKeys.profile(userId), () => fetchUserProfile(userId));
}

async function fetchUserProfile(userId) {
  if (USE_MOCK) {
    await delay();
    if (userId === MOCK_USER.id) {
      return { ...MOCK_USER, is_following: false, created_circles: MOCK_CIRCLES.filter(c => c.owner_id === MOCK_USER.id), strava_stats: MOCK_USER.strava_connected ? { ...MOCK_STRAVA_STATS } : null };
    }
    const profile = MOCK_PUBLIC_USERS.find(u => u.id === userId);
    if (!profile) throw new Error('User not found');
    const statsHidden = profile.profile_privacy === 'private'
      || (profile.profile_privacy === 'followers' && !profile.is_following)
      || Boolean(profile.stats_hidden);
    return {
      ...profile,
      stats_hidden: statsHidden,
      created_circles: statsHidden ? [] : (profile.created_circles || []),
      strava_stats: profile.strava_connected && !statsHidden
        ? { ...MOCK_STRAVA_STATS, visible_stats: [...MOCK_STRAVA_STATS.visible_stats] }
        : null,
    };
  }
  const profile = await request('GET', `/users/${userId}/profile`);
  return {
    ...profile,
    created_circles: profile.created_circles || profile.circles || [],
    stats_hidden: profile.stats_hidden ?? (
      profile.profile_privacy === 'private'
      || (profile.profile_privacy === 'followers' && !profile.is_following)
    ),
  };
}

export async function followUser(userId) {
  invalidate('profile');
  invalidate('followers');
  invalidate('me');
  if (USE_MOCK) {
    await delay();
    const profile = MOCK_PUBLIC_USERS.find(u => u.id === userId);
    if (profile && !profile.is_following) {
      profile.is_following = true;
      if (profile.profile_privacy === 'followers') profile.stats_hidden = false;
      profile.follower_count = (profile.follower_count || 0) + 1;
      MOCK_USER.following_count = (MOCK_USER.following_count || 0) + 1;
    }
    return { user_id: userId, is_following: true, follower_count: profile?.follower_count };
  }
  return request('POST', `/users/${userId}/follow`);
}

export async function unfollowUser(userId) {
  invalidate('profile');
  invalidate('followers');
  invalidate('me');
  if (USE_MOCK) {
    await delay();
    const profile = MOCK_PUBLIC_USERS.find(u => u.id === userId);
    if (profile?.is_following) {
      profile.is_following = false;
      if (profile.profile_privacy === 'followers') profile.stats_hidden = true;
      profile.follower_count = Math.max((profile.follower_count || 1) - 1, 0);
      MOCK_USER.following_count = Math.max((MOCK_USER.following_count || 1) - 1, 0);
    }
    return { user_id: userId, is_following: false, follower_count: profile?.follower_count };
  }
  return request('DELETE', `/users/${userId}/follow`);
}

export async function getFollowers(userId, page = 1) {
  return cached(cacheKeys.followers(userId, page), async () => {
    if (USE_MOCK) {
      await delay();
      return { users: MOCK_FOLLOWERS.map(u => ({ ...u })), followers: MOCK_FOLLOWERS.map(u => ({ ...u })), total: MOCK_FOLLOWERS.length, page, pages: 1 };
    }
    const result = await request('GET', `/users/${userId}/followers?page=${page}`);
    return {
      ...result,
      users: result.users || result.items || [],
      pages: result.pages || Math.max(1, Math.ceil((result.total || 0) / (result.per_page || 20))),
    };
  });
}

export async function getFollowing(userId, page = 1) {
  return cached(cacheKeys.following(userId, page), async () => {
    if (USE_MOCK) {
      await delay();
      return { users: MOCK_FOLLOWING.map(u => ({ ...u })), following: MOCK_FOLLOWING.map(u => ({ ...u })), total: MOCK_FOLLOWING.length, page, pages: 1 };
    }
    const result = await request('GET', `/users/${userId}/following?page=${page}`);
    return {
      ...result,
      users: result.users || result.items || [],
      pages: result.pages || Math.max(1, Math.ceil((result.total || 0) / (result.per_page || 20))),
    };
  });
}

export async function getPointsHistory() {
  return cached(cacheKeys.points(), async () => {
    if (USE_MOCK) { await delay(); return { ...MOCK_POINTS_HISTORY }; }
    return request('GET', '/users/me/points-history');
  });
}

// ─── Providers ──────────────────────────────────────
export async function getProviders(category = null, search = null) {
  return cached(cacheKeys.providers(category, search), async () => {
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
  });
}

export async function getProvider(id) {
  return cached(cacheKeys.provider(id), async () => {
    if (USE_MOCK) {
      await delay();
      const p = MOCK_PROVIDERS.find(p => p.id === id);
      if (!p) throw new Error('Provider not found');
      return { ...p };
    }
    return request('GET', `/providers/${id}`);
  });
}

export async function getProviderStats(id) {
  if (USE_MOCK) { await delay(); return { ...MOCK_PROVIDER_STATS }; }
  return request('GET', `/providers/${id}/stats`);
}

// ─── Communities ────────────────────────────────────
export async function getCommunities(joined = null, category = null) {
  return cached(cacheKeys.communities(joined, category), async () => {
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
  });
}

export async function getCommunity(id) {
  return cached(cacheKeys.community(id), async () => {
    if (USE_MOCK) {
      await delay();
      const c = MOCK_COMMUNITIES.find(c => c.id === id);
      if (!c) throw new Error('Community not found');
      return { ...c };
    }
    return request('GET', `/communities/${id}`);
  });
}

/** Membership changes shift member counts, join flags and the home payload. */
function invalidateMembership() {
  ['communities', 'circles', 'home', 'me', 'social', 'ranks'].forEach(invalidate);
}

export async function joinCommunity(id) {
  invalidateMembership();
  if (USE_MOCK) {
    await delay(400);
    const c = MOCK_COMMUNITIES.find(c => c.id === id);
    // Mock mode has no backend to persist to — mutate the seed record so a
    // subsequent getCommunity()/getCommunities() reflects the join instead
    // of reverting to the static seed's user_joined value.
    if (c) {
      c.user_joined = true;
      c.member_count = (c.member_count || 0) + 1;
    }
    return {
      community_id: id,
      member_count: c?.member_count ?? 1,
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
  invalidateMembership();
  if (USE_MOCK) {
    await delay(400);
    const c = MOCK_COMMUNITIES.find(c => c.id === id);
    if (c) {
      c.user_joined = false;
      c.member_count = Math.max((c.member_count || 1) - 1, 0);
    }
    return { community_id: id, member_count: c?.member_count ?? 0, left: true };
  }
  return request('POST', `/communities/${id}/leave`);
}

export async function checkinCommunity(id) {
  // A check-in moves points, streak, leaderboards and the social-proof banner.
  invalidateMembership();
  ['points', 'leaderboard'].forEach(invalidate);
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
  invalidate('bookings');
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
  return cached(cacheKeys.circles(), async () => {
    if (USE_MOCK) {
      await delay();
      return { circles: [...MOCK_CIRCLES] };
    }
    return request('GET', '/circles');
  });
}

// Phase 6: circle preview + Join CTA — replaces the old hack of fetching the
// whole GET /circles list and .find()-ing it.
export async function getCircle(id) {
  return cached(cacheKeys.circle(id), async () => {
    if (USE_MOCK) {
      await delay();
      const circle = MOCK_CIRCLES.find(c => c.id === id);
      if (!circle) {
        const err = new Error('Circle not found');
        err.status = 404;
        throw err;
      }
      const isOwner = circle.owner_id === MOCK_USER.id;
      const isJoined = Boolean(circle.is_joined) || isOwner;
      if (circle.is_private && !isJoined) {
        const err = new Error('Circle not found');
        err.status = 404;
        throw err;
      }
      const previewPosts = (!isJoined && !circle.is_paid)
        ? MOCK_POSTS.filter(p => p.circle_id === id).slice(0, 5)
        : null;
      return {
        id: circle.id,
        name: circle.name,
        description: circle.description,
        member_count: circle.member_count,
        is_joined: isJoined,
        is_owner: isOwner,
        is_private: Boolean(circle.is_private),
        is_paid: Boolean(circle.is_paid),
        price_etb: circle.price_etb,
        paid_circle_status: circle.paid_circle_status,
        join_code: isJoined ? circle.join_code : null,
        owner: {
          id: circle.owner_id,
          name: circle.owner_name,
          telegram_handle: circle.owner_telegram_handle,
          is_verified_trainer: Boolean(circle.owner_is_verified),
        },
        owner_is_verified: Boolean(circle.owner_is_verified),
        preview_posts: previewPosts,
      };
    }
    return request('GET', `/circles/${id}`);
  });
}

export async function createCircle(data) {
  invalidateMembership();
  if (USE_MOCK) {
    await delay();
    return { id: 'mock-circle-' + Date.now(), name: data.name, join_code: 'MOCK' + Date.now().toString(36).toUpperCase(), message: 'Circle created successfully' };
  }
  return request('POST', '/circles', data);
}

export async function joinCircle(id, joinCode = null) {
  invalidateMembership();
  if (USE_MOCK) {
    await delay();
    const circle = MOCK_CIRCLES.find(c => c.id === id);
    if (circle?.is_paid && !circle.is_joined && _mockCircleStatuses.get(id)?.status !== 'active') {
      const err = new Error('Paid circle — subscription required');
      err.status = 402;
      err.payload = { detail: err.message, price_etb: circle.price_etb, circle_id: id };
      throw err;
    }
    // Mock mode has no backend to persist to — mutate the seed record so a
    // subsequent getCircles() reflects the join instead of reverting to the
    // static seed's is_joined value.
    if (circle) {
      circle.is_joined = true;
      circle.member_count = (circle.member_count || 0) + 1;
    }
    return { id, name: circle?.name || 'Circle', join_code: circle?.join_code || null, message: 'Joined circle successfully' };
  }
  return request('POST', `/circles/${id}/join`, { join_code: joinCode });
}

export async function getCircleLeaderboard(id) {
  return cached(cacheKeys.circleLeaderboard(id), async () => {
    if (USE_MOCK) {
      await delay();
      return { leaderboard: [...MOCK_LEADERBOARD] };
    }
    return request('GET', `/circles/${id}/leaderboard`);
  });
}

// E1: join a circle via a `?startapp=circle_{code}` deep link
export async function joinCircleByCode(joinCode) {
  invalidateMembership();
  if (USE_MOCK) {
    await delay();
    return { id: 'mock-circle-id', name: 'Mock Circle', message: 'Joined circle successfully' };
  }
  return request('POST', '/circles/join-by-code', { join_code: joinCode });
}

// E2: how many circle-mates checked in today, across all the user's circles
export async function getCircleSocialProof() {
  return cached(cacheKeys.social(), async () => {
    if (USE_MOCK) {
      await delay();
      return { ...MOCK_SOCIAL_PROOF };
    }
    return request('GET', '/circles/social-proof/today');
  });
}

// ─── Posts & Reactions ────────────────────────────────
export async function getPosts(communityId = null, circleId = null) {
  return cached(cacheKeys.posts(communityId, circleId), async () => {
    if (USE_MOCK) {
      await delay();
      let posts = [...MOCK_POSTS];
      // Was unconditionally returning every post (including other circles'
      // seed data) whenever a communityId-only call came through, since only
      // circleId was ever filtered on.
      if (circleId) posts = posts.filter(p => p.circle_id === circleId);
      else if (communityId) posts = posts.filter(p => p.community_id === communityId);
      return { posts };
    }
    const params = new URLSearchParams();
    if (communityId) params.set('community_id', communityId);
    if (circleId) params.set('circle_id', circleId);
    return request('GET', `/posts?${params}`);
  });
}

// ─── For You Feed (Phase 4/5) ──────────────────────────
export async function getForYouFeed({ before } = {}) {
  return cached(cacheKeys.feed(before), async () => {
    if (USE_MOCK) {
      await delay();
      // Mock mode has no real pagination cursor — the first page carries
      // everything; a `before` request (scroll) has nothing further to add.
      if (before) return { items: [], next_before: null };
      return { items: [...MOCK_FOR_YOU_FEED], next_before: null };
    }
    const params = new URLSearchParams({ limit: '10' });
    if (before) params.set('before', before);
    return request('GET', `/feed/for-you?${params}`);
  });
}

export async function createPost(data) {
  invalidate('posts');
  if (USE_MOCK) {
    await delay();
    // Mock mode has no backend to persist to — build a real post record and
    // add it to MOCK_POSTS so the feed's next getPosts() actually shows it,
    // instead of returning a stub that createPost's caller immediately loses.
    const post = {
      id: 'mock-post-' + Date.now(),
      content: data.content,
      user: { id: MOCK_USER.id, name: MOCK_USER.name, photo_url: MOCK_USER.photo_url },
      created_at: new Date().toISOString(),
      activity_type: data.activity_type || null,
      distance_km: data.distance_km || null,
      duration_min: data.duration_min || null,
      photo_url: data.photo_url || null,
      reactions: {},
      total_points_gifted: 0,
      community_id: data.community_id || null,
      circle_id: data.circle_id || null,
      comments: [],
    };
    MOCK_POSTS.unshift(post);
    return post;
  }
  return request('POST', '/posts', data);
}

export async function reactToPost(postId, data) {
  invalidate('posts');
  if (data?.points_gifted > 0) invalidate('me');
  if (USE_MOCK) {
    await delay();
    const post = MOCK_POSTS.find(p => p.id === postId);
    if (post) {
      post.reactions = { ...post.reactions, [data.emoji]: (post.reactions?.[data.emoji] || 0) + 1 };
      if (data.points_gifted > 0) post.total_points_gifted = (post.total_points_gifted || 0) + data.points_gifted;
    }
    return { message: "Success", points_gifted: data.points_gifted || 0 };
  }
  return request('POST', `/posts/${postId}/react`, data);
}

export async function commentOnPost(postId, content, parentCommentId = null) {
  invalidate('posts');
  if (USE_MOCK) {
    await delay();
    const post = MOCK_POSTS.find(p => p.id === postId);
    const comment = {
      id: 'mock-comment-' + Date.now(),
      content,
      user: { id: MOCK_USER.id, name: MOCK_USER.name, photo_url: MOCK_USER.photo_url },
      created_at: new Date().toISOString(),
      replies: [],
    };
    if (post) {
      if (parentCommentId) {
        const parent = (post.comments || []).find(c => c.id === parentCommentId);
        if (parent) {
          parent.replies = [...(parent.replies || []), comment];
        }
      } else {
        post.comments = [...(post.comments || []), comment];
      }
    }
    return { ...comment, message: "Success" };
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

// Mock mode has no backend to persist to — a mutable singleton so
// updateProviderMe()'s changes survive across getProviderMe() calls.
const MOCK_PROVIDER_ME = {
  id: '11111111-0000-0000-0000-000000000003',
  name: 'Shanti Yoga Addis',
  category: 'yoga',
  status: 'active',
  description: 'Premium yoga studio',
  location_text: 'Bole, Addis Ababa',
  services: [],
  theme_primary_color: '#10B981',
  theme_accent_color: '#F59E0B',
  contact_phone: null,
  contact_email: null,
  facilities: [],
  navigation_tips: [],
  dashboard_stats: { total_members: 83, new_members_today: 3, total_products: 3, active_products: 2 }
};

export async function getProviderMe() {
  return cached(cacheKeys.providerMe(), () => fetchProviderMe());
}

async function fetchProviderMe() {
  if (USE_MOCK) {
    await delay();
    return { ...MOCK_PROVIDER_ME };
  }
  return request('GET', '/providers/me');
}

export async function updateProviderMe(data) {
  invalidate('provider-me');
  if (USE_MOCK) {
    await delay();
    Object.assign(MOCK_PROVIDER_ME, data);
    return { ...MOCK_PROVIDER_ME };
  }
  return request('PATCH', '/providers/me', data);
}

// C1: distinct customers (booking or check-in) with last-visit + lifetime redeemed
export async function getProviderCustomers() {
  return cached(cacheKeys.providerCustomers(), async () => {
    if (USE_MOCK) {
      await delay();
      return { customers: [...MOCK_PROVIDER_CUSTOMERS], count: MOCK_PROVIDER_CUSTOMERS.length };
    }
    return request('GET', '/providers/me/customers');
  });
}

// D3: one-tap point award to a verified customer (max 50/award, 1/day/customer, 300/day total)
export async function awardCustomerPoints(customerUserId, points, note = null) {
  invalidate('provider-me');
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
  return cached(cacheKeys.providerPointsAnalytics(), async () => {
    if (USE_MOCK) {
      await delay();
      return { ...MOCK_PROVIDER_POINTS_ANALYTICS };
    }
    return request('GET', '/providers/me/analytics/points');
  });
}

// ─── Products Store ─────────────────────────────────
export async function getProducts(params = {}) {
  return cached(cacheKeys.products(params), async () => {
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
  });
}

export async function getProduct(id) {
  return cached(cacheKeys.product(id), async () => {
    if (USE_MOCK) {
      await delay();
      const p = MOCK_PRODUCTS.find(x => x.id === id);
      if (!p) throw new Error('Product not found');
      return { ...p };
    }
    return request('GET', `/products/${id}`);
  });
}

export async function redeemProduct(id, data = {}) {
  // Spends points and decrements stock.
  ['products', 'redemptions', 'me', 'points'].forEach(invalidate);
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
  return cached(cacheKeys.redemptions(), async () => {
    if (USE_MOCK) { await delay(); return { redemptions: [...MOCK_REDEMPTIONS], count: MOCK_REDEMPTIONS.length }; }
    return request('GET', '/users/me/redemptions');
  });
}

// ─── Provider Products ────────────────────────────
export async function getProviderProducts() {
  return cached(cacheKeys.providerProducts(), async () => {
    if (USE_MOCK) { await delay(); return { products: [...MOCK_PROVIDER_PRODUCTS], count: MOCK_PROVIDER_PRODUCTS.length }; }
    return request('GET', '/providers/me/products');
  });
}

export async function createProviderProduct(data) {
  invalidate('provider-me');
  invalidate('products');
  if (USE_MOCK) { await delay(); return { id: 'prod-new-' + Date.now(), name: data.name, created: true }; }
  return request('POST', '/providers/me/products', data);
}

export async function getProviderRedemptions(params = {}) {
  return cached(cacheKeys.providerRedemptions(params), async () => {
    if (USE_MOCK) {
      await delay();
      const redemptions = [
        { id: 'r1', user_name: 'Meron Tadesse', product_name: 'Private Yoga Session', redemption_code: 'YOGA-ABC123', redeemed_at: new Date().toISOString(), delivery_status: 'pending', provider_notes: null, delivery_address: null, points_spent: 400 }
      ];
      return { redemptions, count: redemptions.length, total: redemptions.length, page: 1, per_page: 20 };
    }
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') qs.set(k, v); });
    const query = qs.toString();
    return request('GET', `/providers/me/redemptions${query ? `?${query}` : ''}`);
  });
}

// Redeem management — provider confirms/ships/delivers a redemption of their own product.
export async function updateProviderRedemptionStatus(redemptionId, status, notes = null) {
  invalidate('provider-me');
  if (USE_MOCK) {
    await delay(400);
    return { redemption_id: redemptionId, delivery_status: status, provider_notes: notes };
  }
  return request('POST', `/providers/me/redemptions/${redemptionId}/update-status`, { status, notes });
}

// Full paginated booking list — each row carries the customer's demographics.
export async function getProviderBookings(params = {}) {
  return cached(cacheKeys.providerBookings(params), async () => {
    if (USE_MOCK) { await delay(); return { ...MOCK_PROVIDER_BOOKINGS }; }
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') qs.set(k, v); });
    const query = qs.toString();
    return request('GET', `/providers/me/bookings${query ? `?${query}` : ''}`);
  });
}

// Most-booked-service breakdown (bookings + revenue per service).
export async function getProviderServiceBreakdown(params = {}) {
  return cached(cacheKeys.providerServices(params), async () => {
    if (USE_MOCK) { await delay(); return { ...MOCK_PROVIDER_SERVICE_BREAKDOWN }; }
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') qs.set(k, v); });
    const query = qs.toString();
    return request('GET', `/providers/me/analytics/services${query ? `?${query}` : ''}`);
  });
}

// Customer demographics — neighborhood / interest / exercise-frequency breakdowns.
export async function getProviderDemographics() {
  return cached(cacheKeys.providerDemographics(), async () => {
    if (USE_MOCK) { await delay(); return { ...MOCK_PROVIDER_DEMOGRAPHICS }; }
    return request('GET', '/providers/me/analytics/demographics');
  });
}

// Custom time metrics — daily bookings/revenue/check-ins over a chosen date range.
export async function getProviderMetricsTimeseries(startDate, endDate) {
  if (USE_MOCK) { await delay(); return buildMockProviderTimeseries(startDate, endDate); }
  const qs = new URLSearchParams({ start_date: startDate, end_date: endDate });
  return request('GET', `/providers/me/analytics/timeseries?${qs}`);
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

export async function setProviderLaunchState(id, isComingSoon) {
  if (USE_MOCK) { await delay(); return { provider_id: id, is_coming_soon: isComingSoon }; }
  return request('PATCH', `/admin/providers/${id}/launch-state`, { is_coming_soon: isComingSoon });
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

export async function adminAwardPoints({ user_ids, amount, note }) {
  if (USE_MOCK) {
    await delay();
    return { awarded_count: user_ids.length, total_points: user_ids.length * amount };
  }
  return request('POST', '/admin/users/award-points', { user_ids, amount, note });
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
  return cached(cacheKeys.events(params), async () => {
    if (USE_MOCK) return { events: [...MOCK_EVENTS], count: MOCK_EVENTS.length };
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
    });
    const q = qs.toString();
    return request('GET', q ? `/events?${q}` : '/events');
  });
}

export async function getFeaturedEvents() {
  return cached(cacheKeys.featuredEvents(), async () => {
    if (USE_MOCK) {
      await delay();
      return { events: [] };
    }
    // The window end is rounded to the day so the cache key stays stable
    // across calls made seconds apart.
    const to = new Date();
    to.setDate(to.getDate() + 7);
    to.setHours(23, 59, 59, 0);
    return request('GET', `/events?boosted_only=true&limit=10&to=${to.toISOString()}`);
  });
}

// ─── Home bootstrap ───────────────────────────────────
/**
 * Everything Home renders, in one request.
 *
 * Home used to open with six parallel calls, each of which could land on its
 * own cold serverless function. `GET /home/bootstrap` answers all of them from
 * a single warm invocation. The individual endpoints still exist and the
 * client falls back to them when the aggregate isn't available, so a frontend
 * deploy that lands ahead of the backend degrades to the old behaviour rather
 * than breaking Home.
 */
export async function getHomeBootstrap() {
  return cached(cacheKeys.home(), async () => {
    const payload = USE_MOCK ? await mockHomeBootstrap() : await fetchHomeBootstrap();
    warmFromBootstrap(payload);
    return payload;
  });
}

async function fetchHomeBootstrap() {
  try {
    return await request('GET', '/home/bootstrap');
  } catch (err) {
    if (err.status !== 404) throw err;
    return legacyHomeBootstrap();
  }
}

/** Pre-aggregate assembly, used when the backend has no /home/bootstrap. */
async function legacyHomeBootstrap() {
  const [providers, communities, events, featured, social, unread] = await Promise.all([
    getProviders().catch(() => ({ providers: [] })),
    getCommunities().catch(() => ({ communities: [] })),
    getEvents().catch(() => ({ events: [] })),
    getFeaturedEvents().catch(() => ({ events: [] })),
    getCircleSocialProof().catch(() => null),
    getNotificationUnreadCount().catch(() => 0),
  ]);
  const feed = await getForYouFeed().catch(() => ({ items: [], next_before: null }));
  return {
    providers: providers.providers || [],
    communities: communities.communities || [],
    events: events.events || [],
    featured_events: featured.events || [],
    social_proof: social,
    unread_count: unread,
    feed,
  };
}

async function mockHomeBootstrap() {
  await delay();
  return {
    providers: [...MOCK_PROVIDERS],
    communities: [...MOCK_COMMUNITIES],
    events: [...MOCK_EVENTS],
    featured_events: [],
    social_proof: { ...MOCK_SOCIAL_PROOF },
    unread_count: 0,
    feed: { items: [...MOCK_FOR_YOU_FEED], next_before: null },
  };
}

/**
 * Seed the per-endpoint cache keys from the aggregate response, so opening
 * Explore or the circles tab straight after Home costs no requests at all.
 */
function warmFromBootstrap(payload) {
  if (!payload) return;
  cacheWrite(cacheKeys.providers(), { providers: payload.providers || [], count: (payload.providers || []).length });
  cacheWrite(cacheKeys.communities(), { communities: payload.communities || [], count: (payload.communities || []).length });
  cacheWrite(cacheKeys.events(), { events: payload.events || [], count: (payload.events || []).length });
  cacheWrite(cacheKeys.featuredEvents(), { events: payload.featured_events || [] });
  if (payload.social_proof) cacheWrite(cacheKeys.social(), payload.social_proof);
  if (typeof payload.unread_count === 'number') cacheWrite(cacheKeys.unread(), payload.unread_count);
  if (payload.feed) cacheWrite(cacheKeys.feed(undefined), payload.feed);
}

export async function getRanks() {
  return cached(cacheKeys.ranks(), async () => {
    if (USE_MOCK) {
      await delay();
      return MOCK_RANKS;
    }
    return request('GET', '/ranks');
  });
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
  return cached(cacheKeys.challenges(communityId), async () => {
    if (USE_MOCK) return { challenges: [] };
    return request('GET', `/communities/${communityId}/challenges`);
  });
}

export async function createCommunityChallenge(communityId, data) {
  if (USE_MOCK) return { id: 'chal-new-' + Date.now(), ...data };
  return request('POST', `/providers/me/communities/${communityId}/challenges`, data);
}

export async function getLeaderboard(communityId) {
  return cached(cacheKeys.leaderboard(communityId), async () => {
    if (USE_MOCK) return { leaderboard: [] };
    return request('GET', `/communities/${communityId}/leaderboard`);
  });
}

export async function getNotifications() {
  return cached(cacheKeys.notifications(), async () => {
    if (USE_MOCK) return { notifications: [], unread_count: 0 };
    return request('GET', '/users/me/notifications');
  });
}

export async function getNotificationUnreadCount() {
  // The header re-reads this on every route change; the cache absorbs those
  // while the 30s poll (just past this key's TTL) still reaches the server.
  return cached(cacheKeys.unread(), async () => {
    if (USE_MOCK) return 0;
    const res = await request('GET', '/users/me/notifications?unread=true&limit=1');
    return res.unread_count ?? 0;
  });
}

export async function markNotificationRead(id) {
  invalidate('notifications');
  invalidate('unread');
  if (USE_MOCK) return { is_read: true };
  return request('POST', `/users/me/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  invalidate('notifications');
  invalidate('unread');
  if (USE_MOCK) return { marked_read: 0 };
  return request('POST', '/users/me/notifications/read-all');
}

export async function getMyBookings() {
  return cached(cacheKeys.bookings(), async () => {
    if (USE_MOCK) return { bookings: mockBookingsCreatedThisSession };
    return request('GET', '/users/me/bookings');
  });
}

export async function getProviderEvents(providerId) {
  return cached(cacheKeys.providerEvents(providerId), async () => {
    if (USE_MOCK) return { events: [] };
    return request('GET', `/providers/${providerId}/events`);
  });
}

export async function createProviderEvent(data) {
  invalidate('events');
  invalidate('provider-me');
  invalidate('providers');
  if (USE_MOCK) return { id: 'evt-new-' + Date.now(), ...data };
  return request('POST', '/providers/me/events', data);
}

export async function updateProviderEvent(eventId, data) {
  invalidate('events');
  invalidate('provider-me');
  invalidate('providers');
  if (USE_MOCK) return { id: eventId, ...data };
  return request('PATCH', `/providers/me/events/${eventId}`, data);
}

export async function getSubscriptionPlans() {
  return cached(cacheKeys.subscriptionPlans(), () => fetchSubscriptionPlans());
}

async function fetchSubscriptionPlans() {
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
  // Promotions ride along on the provider payload the marketplace renders.
  invalidate('providers');
  invalidate('provider-me');
  invalidate('home');
  if (USE_MOCK) return { id: 'promo-mock', ...data, is_active: true };
  return request('POST', '/providers/me/promotions', data);
}

// ─── Phase 15: uploads, trainers, paid circles, profiles & Strava ────────
let _mockTrainerStatus = null;
let _mockStravaConnected = false;
let _mockVisibleStats = [...MOCK_STRAVA_STATS.visible_stats];
const _mockCircleStatuses = new Map();

export async function uploadFile(file, folder) {
  if (USE_MOCK) {
    await delay(250);
    if (!file) throw new Error('Choose a file to upload');
    return {
      url: URL.createObjectURL ? URL.createObjectURL(file) : `https://mock.local/${folder}/${encodeURIComponent(file.name)}`,
      public_id: `${folder}/mock-${Date.now()}`,
    };
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  return multipartRequest('/uploads', formData);
}

export async function applyForTrainerVerification(data) {
  invalidate('trainer');
  if (USE_MOCK) {
    await delay();
    _mockTrainerStatus = {
      id: `verify-${Date.now()}`,
      status: 'pending',
      payment_status: 'paid',
      rejection_reason: null,
      created_at: new Date().toISOString(),
      expires_at: null,
      ...data,
    };
    return { ..._mockTrainerStatus };
  }
  return request('POST', '/trainer/apply', data);
}

export async function getTrainerVerificationStatus() {
  return cached(cacheKeys.trainer(), async () => {
    if (USE_MOCK) { await delay(); return _mockTrainerStatus ? { ..._mockTrainerStatus } : null; }
    const result = await request('GET', '/trainer/status');
    return result?.application ?? null;
  });
}

export async function getAdminTrainerVerifications(page = 1, status = 'pending') {
  if (USE_MOCK) {
    await delay();
    const items = MOCK_TRAINER_VERIFICATIONS.filter(v => !status || status === 'all' || v.status === status);
    return { items: items.map(v => ({ ...v })), verifications: items.map(v => ({ ...v })), total: items.length, page };
  }
  const qs = new URLSearchParams({ page: String(page) });
  if (status) qs.set('status', status);
  return request('GET', `/admin/trainer-verifications?${qs}`);
}

export async function reviewTrainerVerification(id, action, reason = null) {
  if (USE_MOCK) {
    await delay();
    const item = MOCK_TRAINER_VERIFICATIONS.find(v => v.id === id);
    if (item) {
      item.status = action === 'approve' ? 'approved' : 'rejected';
      item.rejection_reason = action === 'reject' ? reason : null;
    }
    return { ...(item || {}), id, status: action === 'approve' ? 'approved' : 'rejected' };
  }
  return request('POST', `/admin/trainer-verifications/${id}/review`, { action, rejection_reason: reason || undefined });
}

export async function applyForPaidCircle(circleId, priceEtb) {
  invalidate('circles');
  if (USE_MOCK) {
    await delay();
    const circle = MOCK_CIRCLES.find(c => c.id === circleId);
    if (circle) Object.assign(circle, { price_etb: priceEtb, paid_circle_status: 'pending_approval' });
    return { ...circle };
  }
  return request('POST', `/circles/${circleId}/apply-paid`, { price_etb: priceEtb });
}

export async function subscribeToCircle(circleId, receiptUrl, receiptPublicId) {
  invalidate('circles');
  if (USE_MOCK) {
    await delay();
    const status = {
      id: `circle-sub-${Date.now()}`,
      circle_id: circleId,
      status: 'pending_approval',
      receipt_url: receiptUrl,
      receipt_public_id: receiptPublicId,
      created_at: new Date().toISOString(),
    };
    _mockCircleStatuses.set(circleId, status);
    return { ...status };
  }
  return request('POST', `/circles/${circleId}/subscribe`, { receipt_url: receiptUrl, receipt_public_id: receiptPublicId });
}

export async function getPendingSubscriptions(circleId) {
  if (USE_MOCK) {
    await delay();
    const subscriptions = MOCK_CIRCLE_SUBSCRIPTIONS.filter(s => s.circle_id === circleId);
    return { subscriptions: subscriptions.map(s => ({ ...s })), total: subscriptions.length };
  }
  const result = await request('GET', `/circles/${circleId}/subscriptions/pending`);
  return { ...result, subscriptions: result.subscriptions || result.items || [] };
}

export async function reviewSubscription(subscriptionId, action) {
  invalidate('circles');
  if (USE_MOCK) {
    await delay();
    const item = MOCK_CIRCLE_SUBSCRIPTIONS.find(s => s.id === subscriptionId);
    if (item) item.status = action === 'approve' ? 'active' : 'rejected';
    return { ...(item || {}), status: action === 'approve' ? 'active' : 'rejected' };
  }
  return request('POST', `/circles/subscriptions/${subscriptionId}/review`, { action });
}

export async function getCircleRevenue(circleId) {
  if (USE_MOCK) { await delay(); return { ...MOCK_CIRCLE_REVENUE, circle_id: circleId }; }
  return request('GET', `/circles/${circleId}/revenue`);
}

export async function getCircleSubscriptionStatus(circleId) {
  if (USE_MOCK) { await delay(); return _mockCircleStatuses.get(circleId) || { status: null }; }
  const result = await request('GET', `/circles/${circleId}/subscription-status`);
  return result.subscription || { status: null };
}

export async function getAdminPaidCircleApplications(page = 1) {
  if (USE_MOCK) {
    await delay();
    return { applications: MOCK_PAID_CIRCLE_APPLICATIONS.map(c => ({ ...c })), circles: MOCK_PAID_CIRCLE_APPLICATIONS.map(c => ({ ...c })), total: MOCK_PAID_CIRCLE_APPLICATIONS.length, page };
  }
  const result = await request('GET', `/admin/paid-circle-applications?page=${page}`);
  return { ...result, applications: result.applications || result.items || [] };
}

export async function reviewPaidCircleApplication(circleId, action, reason = null) {
  if (USE_MOCK) {
    await delay();
    const item = MOCK_PAID_CIRCLE_APPLICATIONS.find(c => c.id === circleId);
    if (item) item.paid_circle_status = action === 'approve' ? 'approved' : 'rejected';
    return { ...(item || {}), paid_circle_status: action === 'approve' ? 'approved' : 'rejected', rejection_reason: reason };
  }
  return request('POST', `/admin/paid-circle-applications/${circleId}/review`, { action, reason: reason || undefined });
}

export async function getStravaConnectUrl() {
  if (USE_MOCK) { await delay(); return { url: `${window.location.origin}/profile?strava=connected` }; }
  return request('GET', '/strava/connect');
}

export async function disconnectStrava() {
  invalidate('strava');
  invalidate('me');
  if (USE_MOCK) {
    await delay();
    _mockStravaConnected = false;
    MOCK_USER.strava_connected = false;
    MOCK_USER.health_app_connected = false;
    return { connected: false };
  }
  return request('POST', '/strava/disconnect');
}

export async function getStravaStats() {
  return cached(cacheKeys.strava(), async () => {
    if (USE_MOCK) {
      await delay();
      const connected = _mockStravaConnected || MOCK_USER.strava_connected;
      return connected ? { ...MOCK_STRAVA_STATS, connected: true, visible_stats: [..._mockVisibleStats] } : { connected: false, visible_stats: [..._mockVisibleStats] };
    }
    const [result, me] = await Promise.all([request('GET', '/strava/stats'), getMe()]);
    return {
      ...(result.stats || {}),
      connected: result.connected,
      // The backend filters the stats object to exactly the saved visibility
      // selection. Older UserResponse shapes do not expose strava_visible_stats,
      // so the returned keys are the authoritative fallback.
      visible_stats: me.strava_visible_stats || Object.keys(result.stats || {}),
    };
  });
}

export async function updateStravaVisibility(visibleStats) {
  invalidate('strava');
  invalidate('me');
  if (USE_MOCK) {
    await delay();
    _mockVisibleStats = [...visibleStats];
    MOCK_USER.strava_visible_stats = [...visibleStats];
    return { visible_stats: [...visibleStats] };
  }
  return request('PATCH', '/strava/visibility', { visible_stats: visibleStats });
}

export async function getUserStravaStats(userId) {
  if (USE_MOCK) {
    await delay();
    const profile = MOCK_PUBLIC_USERS.find(u => u.id === userId);
    return profile?.strava_connected && !profile.stats_hidden ? { ...MOCK_STRAVA_STATS } : null;
  }
  const profile = await getUserProfile(userId);
  return profile.strava_stats || null;
}

// Used by the mock OAuth callback to mirror the backend-synchronized fields.
export function completeMockStravaConnection() {
  if (!USE_MOCK) return;
  _mockStravaConnected = true;
  MOCK_USER.strava_connected = true;
  MOCK_USER.health_app_connected = true;
}
