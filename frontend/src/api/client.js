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
  MOCK_POINTS_HISTORY, MOCK_PROVIDER_STATS, MOCK_CIRCLES, MOCK_POSTS, MOCK_LEADERBOARD
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
