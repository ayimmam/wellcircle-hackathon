/**
 * Well Circle — Mock Data
 * Matches API_CONTRACT.md response shapes exactly.
 * Replace with real API calls when backend is ready.
 */

// ─── Demo Users ─────────────────────────────────────
export const MOCK_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  telegram_id: 100000001,
  telegram_handle: 'meron_hr',
  name: 'Meron Tadesse',
  photo_url: 'https://i.pravatar.cc/150?u=meron',
  goal: 'Lose weight and stay consistent',
  interest_category: 'yoga',
  exercise_frequency: 'sometimes',
  points_balance: 120,
  tier: 'sprout',
  tier_emoji: '🌿',
  is_onboarded: true,
  is_provider: false,
  is_super_admin: false,
  location_neighborhood: null,
  health_app_connected: false,
  joined_communities: [
    '22222222-0000-0000-0000-000000000003',
    '22222222-0000-0000-0000-000000000005'
  ],
  created_at: '2026-06-06T10:00:00Z'
};

// ─── Providers ──────────────────────────────────────
export const MOCK_PROVIDERS = [
  {
    id: '11111111-0000-0000-0000-000000000001',
    name: 'Lifestyle Fitness Center',
    category: 'gym',
    description: "Addis Ababa's premier multi-level fitness club featuring cutting-edge equipment, certified personal trainers, and a rooftop functional training area.",
    location_text: 'Bole Sub-City, near Edna Mall, Addis Ababa',
    lat: 9.0105, lng: 38.7878,
    price_range: 'ETB 800 – 4,500',
    rating: 4.7,
    cover_photo_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800',
    photos: [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800',
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800',
      'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800',
      'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800'
    ],
    services: [
      { name: 'Monthly Membership', price: 2500, duration: '30 days' },
      { name: 'Day Pass', price: 250, duration: '1 day' },
      { name: 'Personal Training (1hr)', price: 1200, duration: '60 min' },
      { name: 'Group Fitness Class', price: 400, duration: '45 min' }
    ],
    community: { id: '22222222-0000-0000-0000-000000000001', name: 'Lifestyle Fit Squad', member_count: 47, user_joined: false },
    member_count: 47,
    community_id: '22222222-0000-0000-0000-000000000001'
  },
  {
    id: '11111111-0000-0000-0000-000000000002',
    name: 'Iron & Soul Gym',
    category: 'gym',
    description: 'Raw, results-driven strength training facility in the heart of Kazanchis. Powerlifting platforms, Olympic lifting, and no fluff.',
    location_text: 'Kazanchis, Kirkos Sub-City, Addis Ababa',
    lat: 9.0227, lng: 38.7574,
    price_range: 'ETB 600 – 2,000',
    rating: 4.5,
    cover_photo_url: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800',
    photos: [
      'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800',
      'https://images.unsplash.com/photo-1581009137042-c552e485697a?w=800',
      'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800'
    ],
    services: [
      { name: 'Monthly Membership', price: 1500, duration: '30 days' },
      { name: 'Day Pass', price: 180, duration: '1 day' },
      { name: 'Strength Assessment', price: 900, duration: '90 min' },
      { name: 'Powerlifting Class', price: 350, duration: '60 min' }
    ],
    community: { id: '22222222-0000-0000-0000-000000000002', name: 'Iron & Soul Lifters', member_count: 28, user_joined: false },
    member_count: 28,
    community_id: '22222222-0000-0000-0000-000000000002'
  },
  {
    id: '11111111-0000-0000-0000-000000000003',
    name: 'Shanti Yoga Addis',
    category: 'yoga',
    description: "Addis Ababa's most loved yoga studio, blending Hatha and Vinyasa practices with breathwork and mindfulness rooted in Ethiopian wellness traditions.",
    location_text: 'Bole Medhanialem, Bole Sub-City, Addis Ababa',
    lat: 9.0054, lng: 38.7868,
    price_range: 'ETB 500 – 3,000',
    rating: 4.9,
    cover_photo_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
    photos: [
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
      'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
      'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=800',
      'https://images.unsplash.com/photo-1588286840104-8957b019727f?w=800',
      'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=800'
    ],
    services: [
      { name: 'Drop-in Yoga Class', price: 500, duration: '60 min' },
      { name: 'Monthly Unlimited Pass', price: 2800, duration: '30 days' },
      { name: '10-Class Pack', price: 3500, duration: 'Flexible' },
      { name: 'Private 1-on-1 Session', price: 1800, duration: '75 min' },
      { name: "Beginner's Yoga (4 weeks)", price: 3000, duration: '8 sessions' }
    ],
    community: { id: '22222222-0000-0000-0000-000000000003', name: 'Shanti Yoga Circle', member_count: 83, user_joined: true },
    member_count: 83,
    community_id: '22222222-0000-0000-0000-000000000003'
  },
  {
    id: '11111111-0000-0000-0000-000000000004',
    name: 'Zen Flow Studio',
    category: 'yoga',
    description: 'Boutique hot yoga studio in CMC. Infrared heated rooms, Bikram sequences, and sound bath sessions.',
    location_text: 'CMC Road, Yeka Sub-City, Addis Ababa',
    lat: 9.0398, lng: 38.8012,
    price_range: 'ETB 600 – 3,500',
    rating: 4.6,
    cover_photo_url: 'https://images.unsplash.com/photo-1593810451137-5dc55105dace?w=800',
    photos: [
      'https://images.unsplash.com/photo-1593810451137-5dc55105dace?w=800',
      'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
      'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800'
    ],
    services: [
      { name: 'Hot Yoga Class', price: 600, duration: '60 min' },
      { name: 'Monthly Pass', price: 3200, duration: '30 days' },
      { name: 'Sound Bath Experience', price: 1200, duration: '90 min' }
    ],
    community: { id: '22222222-0000-0000-0000-000000000004', name: 'Zen Flow Hot Yoga', member_count: 35, user_joined: false },
    member_count: 35,
    community_id: '22222222-0000-0000-0000-000000000004'
  },
  {
    id: '11111111-0000-0000-0000-000000000005',
    name: 'Nourish Ethiopia',
    category: 'nutrition',
    description: 'Registered dietitians specialising in Ethiopian food culture and modern sports nutrition. Meal plans that work with injera, not against it.',
    location_text: 'Sarbet, Nifas Silk-Lafto Sub-City, Addis Ababa',
    lat: 8.9812, lng: 38.7654,
    price_range: 'ETB 1,200 – 8,000',
    rating: 4.8,
    cover_photo_url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800',
    photos: [
      'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800',
      'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800'
    ],
    services: [
      { name: 'Initial Consultation', price: 1800, duration: '60 min' },
      { name: '4-Week Meal Plan', price: 5500, duration: '30 days' },
      { name: 'Sports Nutrition Assessment', price: 2400, duration: '90 min' },
      { name: 'Monthly Follow-up', price: 900, duration: '30 min' }
    ],
    community: { id: '22222222-0000-0000-0000-000000000005', name: 'Nourish Community', member_count: 61, user_joined: true },
    member_count: 61,
    community_id: '22222222-0000-0000-0000-000000000005'
  },
  {
    id: '11111111-0000-0000-0000-000000000006',
    name: 'Green Plate Kitchen',
    category: 'nutrition',
    description: 'Meal prep subscription and nutrition coaching service in Megenagna. Weekly healthy Ethiopian and Mediterranean meal boxes.',
    location_text: 'Megenagna, Yeka Sub-City, Addis Ababa',
    lat: 9.0315, lng: 38.7934,
    price_range: 'ETB 2,000 – 6,000',
    rating: 4.4,
    cover_photo_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800',
    photos: [
      'https://images.unsplash.com/photo-1547592180-85f173990554?w=800',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800'
    ],
    services: [
      { name: 'Weekly Meal Box (5 meals)', price: 2500, duration: '1 week' },
      { name: 'Weekly Meal Box (10 meals)', price: 4500, duration: '1 week' },
      { name: 'Nutrition Coaching', price: 3200, duration: '30 days' },
      { name: '1-Day Detox Pack', price: 800, duration: '1 day' }
    ],
    community: { id: '22222222-0000-0000-0000-000000000006', name: 'Green Plate Members', member_count: 22, user_joined: false },
    member_count: 22,
    community_id: '22222222-0000-0000-0000-000000000006'
  },
  {
    id: '11111111-0000-0000-0000-000000000007',
    name: 'Haile Spa & Wellness',
    category: 'spa',
    description: 'Luxury urban spa in Bole offering full-body massages, traditional Ethiopian coffee scrubs, hammam rituals, and facial treatments.',
    location_text: 'Bole Atlas, Bole Sub-City, Addis Ababa',
    lat: 9.0089, lng: 38.7912,
    price_range: 'ETB 1,500 – 6,500',
    rating: 4.8,
    cover_photo_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800',
    photos: [
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800',
      'https://images.unsplash.com/photo-1560750133-c09be1a39f87?w=800',
      'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=800'
    ],
    services: [
      { name: 'Swedish Full-Body Massage', price: 2000, duration: '60 min' },
      { name: 'Deep Tissue Massage', price: 3200, duration: '90 min' },
      { name: 'Ethiopian Coffee Scrub', price: 2800, duration: '75 min' },
      { name: 'Hammam Ritual', price: 4500, duration: '2 hrs' },
      { name: 'Signature Facial', price: 1800, duration: '60 min' }
    ],
    community: { id: '22222222-0000-0000-0000-000000000007', name: 'Haile Spa Circle', member_count: 54, user_joined: false },
    member_count: 54,
    community_id: '22222222-0000-0000-0000-000000000007'
  },
  {
    id: '11111111-0000-0000-0000-000000000008',
    name: 'Piassa Heritage Hammam',
    category: 'spa',
    description: 'Authentic steam and hammam experience in the historic Piassa neighbourhood. Traditional Ethiopian and North African bathing rituals.',
    location_text: 'Piassa (Arada), Arada Sub-City, Addis Ababa',
    lat: 9.0379, lng: 38.7542,
    price_range: 'ETB 400 – 3,000',
    rating: 4.5,
    cover_photo_url: 'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=800',
    photos: [
      'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=800',
      'https://images.unsplash.com/photo-1560750133-c09be1a39f87?w=800',
      'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800'
    ],
    services: [
      { name: 'Classic Hammam', price: 1200, duration: '90 min' },
      { name: 'Herbal Steam Room', price: 400, duration: '45 min' },
      { name: 'Kessa Scrub', price: 800, duration: '60 min' },
      { name: 'Hammam + Massage Combo', price: 2500, duration: '2.5 hrs' }
    ],
    community: { id: '22222222-0000-0000-0000-000000000008', name: 'Piassa Hammam Club', member_count: 18, user_joined: false },
    member_count: 18,
    community_id: '22222222-0000-0000-0000-000000000008'
  },
  {
    id: '11111111-0000-0000-0000-000000000009',
    name: 'Biruh Mind Wellness',
    category: 'therapy',
    description: "Addis Ababa's first Telegram-native mental wellness clinic. Licensed psychotherapists and counsellors. Bilingual: Amharic & English.",
    location_text: 'Kazanchis, Kirkos Sub-City, Addis Ababa',
    lat: 9.0201, lng: 38.7598,
    price_range: 'ETB 1,500 – 5,000',
    rating: 4.9,
    cover_photo_url: 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=800',
    photos: [
      'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=800',
      'https://images.unsplash.com/photo-1527689638836-411945a2b57c?w=800',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800'
    ],
    services: [
      { name: 'Individual Therapy', price: 2200, duration: '50 min' },
      { name: 'Couples Counselling', price: 3500, duration: '80 min' },
      { name: 'Anxiety Program (6 sessions)', price: 10800, duration: '6 sessions' },
      { name: 'Student Rate Session', price: 1500, duration: '50 min' }
    ],
    community: { id: '22222222-0000-0000-0000-000000000009', name: 'Biruh Mind Space', member_count: 96, user_joined: false },
    member_count: 96,
    community_id: '22222222-0000-0000-0000-000000000009'
  },
  {
    id: '11111111-0000-0000-0000-000000000010',
    name: 'MoveMind Running Club',
    category: 'gym',
    description: 'Community-first running club training at altitude (2,355m). Weekly group runs around Entoto and the ring road.',
    location_text: 'Addis Ababa Stadium, Kirkos Sub-City',
    lat: 9.0261, lng: 38.7505,
    price_range: 'ETB 300 – 1,500',
    rating: 4.7,
    cover_photo_url: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800',
    photos: [
      'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800',
      'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800',
      'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800'
    ],
    services: [
      { name: 'Monthly Membership', price: 1200, duration: '30 days' },
      { name: 'Single Group Run', price: 300, duration: '1 session' },
      { name: 'Coached Intervals', price: 500, duration: '90 min' },
      { name: 'Trail Race Entry', price: 800, duration: '1 event' }
    ],
    community: { id: '22222222-0000-0000-0000-000000000010', name: 'MoveMind Runners', member_count: 142, user_joined: false },
    member_count: 142,
    community_id: '22222222-0000-0000-0000-000000000010'
  }
];

// ─── Communities ────────────────────────────────────
export const MOCK_COMMUNITIES = MOCK_PROVIDERS.map(p => ({
  id: p.community.id,
  name: p.community.name,
  description: p.description,
  category: p.category,
  member_count: p.community.member_count,
  provider_name: p.name,
  provider_id: p.id,
  cover_photo_url: p.cover_photo_url,
  user_joined: p.community.user_joined,
  user_checked_in_today: false,
  provider: {
    id: p.id,
    name: p.name,
    cover_photo_url: p.cover_photo_url
  }
}));

// ─── Feed Events ────────────────────────────────────
const now = new Date();
export const MOCK_FEED_EVENTS = [
  {
    id: 'evt-001',
    event_type: 'checkin',
    user_name: 'Dawit',
    user_photo: 'https://i.pravatar.cc/150?u=dawit',
    event_metadata: null,
    created_at: new Date(now - 2 * 3600000).toISOString()
  },
  {
    id: 'evt-002',
    event_type: 'join',
    user_name: 'Sara',
    user_photo: 'https://i.pravatar.cc/150?u=sara',
    event_metadata: null,
    created_at: new Date(now - 4 * 3600000).toISOString()
  },
  {
    id: 'evt-003',
    event_type: 'booking',
    user_name: 'Abel',
    user_photo: 'https://i.pravatar.cc/150?u=abel',
    event_metadata: { service_name: 'Drop-in Yoga Class', amount: 500 },
    created_at: new Date(now - 6 * 3600000).toISOString()
  },
  {
    id: 'evt-004',
    event_type: 'checkin',
    user_name: 'Hana',
    user_photo: 'https://i.pravatar.cc/150?u=hana',
    event_metadata: null,
    created_at: new Date(now - 8 * 3600000).toISOString()
  },
  {
    id: 'evt-005',
    event_type: 'join',
    user_name: 'Yonas',
    user_photo: 'https://i.pravatar.cc/150?u=yonas',
    event_metadata: null,
    created_at: new Date(now - 12 * 3600000).toISOString()
  },
  {
    id: 'evt-006',
    event_type: 'booking',
    user_name: 'Meron',
    user_photo: 'https://i.pravatar.cc/150?u=meron',
    event_metadata: { service_name: 'Monthly Unlimited Pass', amount: 2800 },
    created_at: new Date(now - 24 * 3600000).toISOString()
  }
];

// ─── Points History ─────────────────────────────────
export const MOCK_POINTS_HISTORY = {
  items: [
    { action: 'checkin', points: 10, community_name: 'Shanti Yoga Circle', created_at: new Date(now - 1 * 3600000).toISOString() },
    { action: 'checkin', points: 10, community_name: 'Nourish Community', created_at: new Date(now - 25 * 3600000).toISOString() },
    { action: 'checkin', points: 10, community_name: 'Shanti Yoga Circle', created_at: new Date(now - 49 * 3600000).toISOString() },
    { action: 'decay', points: -5, community_name: null, created_at: new Date(now - 72 * 3600000).toISOString() },
    { action: 'checkin', points: 10, community_name: 'Shanti Yoga Circle', created_at: new Date(now - 96 * 3600000).toISOString() }
  ],
  current_balance: 120,
  tier: 'sprout',
  tier_emoji: '🌿'
};

// ─── Provider Dashboard Stats ───────────────────────
export const MOCK_PROVIDER_STATS = {
  provider_id: '11111111-0000-0000-0000-000000000003',
  provider_name: 'Shanti Yoga Addis',
  stats: {
    total_members: 83,
    new_members_today: 3,
    bookings_this_week: 12,
    estimated_revenue_etb: 14400,
    checkins_today: 8,
    engagement_rate: 0.67
  },
  communities: [
    { id: '22222222-0000-0000-0000-000000000003', name: 'Shanti Yoga Circle', member_count: 83, checkins_today: 8, engagement_rate: 0.67 }
  ],
  recent_bookings: [
    { id: 'bk-001', user_handle: 'meron_hr', service_name: 'Drop-in Yoga Class', slot_datetime: '2026-06-07T07:00:00Z', amount_etb: 500, payment_status: 'success', created_at: new Date(now - 2 * 3600000).toISOString() },
    { id: 'bk-002', user_handle: 'dawit_fit', service_name: 'Monthly Unlimited Pass', slot_datetime: '2026-06-07T09:00:00Z', amount_etb: 2800, payment_status: 'success', created_at: new Date(now - 5 * 3600000).toISOString() },
    { id: 'bk-003', user_handle: 'sara_wellness', service_name: 'Private 1-on-1 Session', slot_datetime: '2026-06-08T18:30:00Z', amount_etb: 1800, payment_status: 'pending', created_at: new Date(now - 8 * 3600000).toISOString() },
    { id: 'bk-004', user_handle: 'abel_runner', service_name: 'Drop-in Yoga Class', slot_datetime: '2026-06-08T06:30:00Z', amount_etb: 500, payment_status: 'success', created_at: new Date(now - 24 * 3600000).toISOString() }
  ],
  recent_feed: MOCK_FEED_EVENTS.slice(0, 5).map(e => ({ ...e, community_name: 'Shanti Yoga Circle' }))
};

// ─── Neighbourhood Alerts ───────────────────────────
export const NEIGHBOURHOOD_ALERTS = {
  "Bole": "🧘 New yoga session opening in Bole this Saturday — only 3 spots left. Book now via Well Circle.",
  "Kazanchis": "💪 Iron & Soul Gym is running a 2-for-1 day pass offer in Kazanchis this week.",
  "Piassa": "🛁 Piassa Heritage Hammam is offering a free herbal steam add-on for all bookings today.",
  "CMC": "🌿 Zen Flow Studio in CMC just opened evening slots — hot yoga at 7 PM starting Monday.",
  "Sarbet": "🥗 Nourish Ethiopia is hosting a free nutrition consultation clinic in Sarbet this weekend.",
  "Megenagna": "🥡 Green Plate Kitchen is delivering free trial meal boxes to Megenagna — order by 12 PM.",
  "Other": "🌟 Three new wellness providers just joined Well Circle near you. Tap Explore to discover them."
};

// ─── Health Metrics (hardcoded) ─────────────────────
export const MOCK_HEALTH_METRICS = {
  steps_this_week: 6240,
  active_minutes: 48,
  wellness_score: 72
};

// ─── Tiers ──────────────────────────────────────────
export const TIERS = [
  { name: 'Seed',   tier: 'seed',   emoji: '🌱', min: 0,   max: 99 },
  { name: 'Sprout', tier: 'sprout', emoji: '🌿', min: 100, max: 299 },
  { name: 'Grove',  tier: 'grove',  emoji: '🌳', min: 300, max: 699 },
  { name: 'Forest', tier: 'forest', emoji: '🌲', min: 700, max: Infinity }
];

export function getTier(points) {
  return TIERS.find(t => points >= t.min && points <= t.max) || TIERS[0];
}

// ─── Enums ──────────────────────────────────────────
export const CATEGORIES = [
  { value: 'all', label: 'All', emoji: '✨' },
  { value: 'gym', label: 'Gym', emoji: '💪' },
  { value: 'yoga', label: 'Yoga', emoji: '🧘' },
  { value: 'nutrition', label: 'Nutrition', emoji: '🥗' },
  { value: 'spa', label: 'Spa', emoji: '💆' },
  { value: 'therapy', label: 'Therapy', emoji: '🧠' }
];

export const EXERCISE_FREQUENCIES = [
  { value: 'never', label: 'Never', emoji: '🛋️', desc: 'Just getting started' },
  { value: 'rarely', label: 'Rarely', emoji: '🚶', desc: '1-2x / month' },
  { value: 'sometimes', label: 'Sometimes', emoji: '🏃', desc: '1-2x / week' },
  { value: 'regular', label: 'Regular', emoji: '💪', desc: '3-4x / week' },
  { value: 'daily', label: 'Daily', emoji: '🔥', desc: 'Every day' }
];

export const INTEREST_CATEGORIES = [
  { value: 'yoga', label: 'Yoga', emoji: '🧘' },
  { value: 'gym', label: 'Gym', emoji: '🏋️' },
  { value: 'nutrition', label: 'Nutrition', emoji: '🥗' },
  { value: 'spa', label: 'Spa', emoji: '💆' },
  { value: 'therapy', label: 'Therapy', emoji: '🧠' },
  { value: 'running', label: 'Running', emoji: '🏃' }
];

export const NEIGHBOURHOODS = ['Bole', 'Kazanchis', 'Piassa', 'CMC', 'Sarbet', 'Megenagna', 'Other'];

// ─── Time Slots ─────────────────────────────────────
export const MOCK_TIME_SLOTS = [
  '06:00', '06:30', '07:00', '08:00', '09:00', '10:00',
  '12:00', '14:00', '15:30', '17:00', '18:00', '18:30', '19:00'
];

// Generate next 7 days for date picker
export function getNextDays(count = 7) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push({
      date: d.toISOString().split('T')[0],
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }),
      dayName: d.toLocaleDateString('en', { weekday: 'short' })
    });
  }
  return days;
}
