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
  is_super_admin: import.meta.env.VITE_MOCK_SUPER_ADMIN === 'true',
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

// ─── Circles & Leaderboards ─────────────────────────
export const MOCK_CIRCLES = [
  { id: '33333333-0000-0000-0000-000000000001', name: 'Addis Morning Runners', description: 'We run every morning at 6 AM around Meskel Square.', member_count: 24 },
  { id: '33333333-0000-0000-0000-000000000002', name: 'Zen Seekers', description: 'Mindfulness, yoga, and finding peace in the chaotic city.', member_count: 56 }
];

export const MOCK_LEADERBOARD = [
  { user_id: '001', name: 'Dawit', photo_url: 'https://i.pravatar.cc/150?u=dawit', weekly_points: 120, total_points: 720 },
  { user_id: '002', name: 'Meron Tadesse', photo_url: 'https://i.pravatar.cc/150?u=meron', weekly_points: 85, total_points: 420 },
  { user_id: '003', name: 'Sara', photo_url: 'https://i.pravatar.cc/150?u=sara', weekly_points: 70, total_points: 310 },
  { user_id: '004', name: 'Abel', photo_url: 'https://i.pravatar.cc/150?u=abel', weekly_points: 55, total_points: 280 },
  { user_id: '005', name: 'Hana', photo_url: 'https://i.pravatar.cc/150?u=hana', weekly_points: 40, total_points: 190 },
  { user_id: '006', name: 'Yonas', photo_url: 'https://i.pravatar.cc/150?u=yonas', weekly_points: 30, total_points: 150 }
];

// ─── Posts & Reactions ──────────────────────────────
export const MOCK_POSTS = [
  {
    id: '44444444-0000-0000-0000-000000000001',
    content: "Just finished a 5K run! Feeling great! 🏃‍♀️",
    user: { id: '002', name: 'Meron Tadesse', photo_url: 'https://i.pravatar.cc/150?u=meron' },
    created_at: new Date(now - 1 * 3600000).toISOString(),
    reactions: { '🔥': 2, '👏': 1 },
    total_points_gifted: 5,
    circle_id: '33333333-0000-0000-0000-000000000001'
  },
  {
    id: '44444444-0000-0000-0000-000000000003',
    content: "Dawit checked in for their workout today! 💪 Earned 10 Legacy Points.",
    user: { id: '001', name: 'Dawit', photo_url: 'https://i.pravatar.cc/150?u=dawit' },
    created_at: new Date(now - 2 * 3600000).toISOString(),
    reactions: { '🔥': 4, '🙌': 2 },
    total_points_gifted: 10,
    circle_id: '33333333-0000-0000-0000-000000000001',
    is_system_event: true
  },
  {
    id: '44444444-0000-0000-0000-000000000002',
    content: "Anyone up for a group yoga session tomorrow at 7 AM?",
    user: { id: '001', name: 'Dawit', photo_url: 'https://i.pravatar.cc/150?u=dawit' },
    created_at: new Date(now - 4 * 3600000).toISOString(),
    reactions: { '🔥': 5, '✋': 3 },
    total_points_gifted: 0,
    circle_id: '33333333-0000-0000-0000-000000000002'
  },
  {
    id: '44444444-0000-0000-0000-000000000004',
    content: "Sara completed the '30-Day Step Challenge'! 🏆 Phenomenal effort!",
    user: { id: '003', name: 'Sara', photo_url: 'https://i.pravatar.cc/150?u=sara' },
    created_at: new Date(now - 12 * 3600000).toISOString(),
    reactions: { '🎉': 8, '👏': 5 },
    total_points_gifted: 50,
    circle_id: '33333333-0000-0000-0000-000000000001',
    is_system_event: true
  },
  {
    id: '44444444-0000-0000-0000-000000000005',
    content: "Abel high-fived Meron! 🙌 Keep up the momentum!",
    user: { id: '004', name: 'Abel', photo_url: 'https://i.pravatar.cc/150?u=abel' },
    created_at: new Date(now - 18 * 3600000).toISOString(),
    reactions: { '❤️': 3 },
    total_points_gifted: 0,
    circle_id: '33333333-0000-0000-0000-000000000002',
    is_system_event: true
  },
  {
    id: '44444444-0000-0000-0000-000000000006',
    content: "I finally managed to hold a handstand for 10 seconds today! So happy with the progress.",
    user: { id: '005', name: 'Hana', photo_url: 'https://i.pravatar.cc/150?u=hana' },
    created_at: new Date(now - 24 * 3600000).toISOString(),
    reactions: { '🔥': 10, '👏': 7, '🧘‍♀️': 4 },
    total_points_gifted: 15,
    circle_id: '33333333-0000-0000-0000-000000000002'
  },
  {
    id: '44444444-0000-0000-0000-000000000007',
    content: "Yonas just joined the circle! Say hello! 👋",
    user: { id: '006', name: 'Yonas', photo_url: 'https://i.pravatar.cc/150?u=yonas' },
    created_at: new Date(now - 48 * 3600000).toISOString(),
    reactions: { '👋': 12 },
    total_points_gifted: 0,
    circle_id: '33333333-0000-0000-0000-000000000001',
    is_system_event: true
  }
];

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
  { value: 'therapy', label: 'Therapy', emoji: '🧠' },
  { value: 'other', label: 'Other', emoji: '✨' }
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
  { value: 'running', label: 'Running', emoji: '🏃' },
  { value: 'other', label: 'Other', emoji: '✨' }
];

export const NEIGHBOURHOODS = ['Bole', 'Kazanchis', 'Piassa', 'CMC', 'Sarbet', 'Megenagna', 'Other'];

// ─── Time Slots ─────────────────────────────────────
export const MOCK_TIME_SLOTS = [
  '06:00', '06:30', '07:00', '08:00', '09:00', '10:00',
  '12:00', '14:00', '15:30', '17:00', '18:00', '18:30', '19:00'
];

// ─── Phase 2: Products Store ────────────────────────
export const MOCK_PRODUCTS = [
  // 1. Lifestyle Fitness Center
  {
    id: 'prod-01-1', name: '1-Day Gym Pass', description: 'Access to all cardio and weights equipment for one day.', type: 'digital', price_etb: 50, image_url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400', provider_id: '11111111-0000-0000-0000-000000000001', provider_name: 'Lifestyle Fitness Center', max_redemptions_per_user: 3, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: true, quantity_in_stock: 50, images: ['https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800'], provider: { id: '11111111-0000-0000-0000-000000000001', name: 'Lifestyle Fitness Center', category: 'gym', location_text: 'Bole', rating: 4.7 }, provider_instructions: 'Show digital voucher at reception.', shipping_required: false, redemption_count: 12
  },
  {
    id: 'prod-01-2', name: 'Fitness Merch T-Shirt', description: 'Branded moisture-wicking t-shirt.', type: 'physical', price_etb: 150, image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', provider_id: '11111111-0000-0000-0000-000000000001', provider_name: 'Lifestyle Fitness Center', max_redemptions_per_user: 1, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: false, quantity_in_stock: 20, images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800'], provider: { id: '11111111-0000-0000-0000-000000000001', name: 'Lifestyle Fitness Center', category: 'gym', location_text: 'Bole', rating: 4.7 }, provider_instructions: 'Will be shipped to your address.', shipping_required: true, redemption_count: 5
  },
  // 2. Iron & Soul Gym
  {
    id: 'prod-02-1', name: 'Powerlifting Class', description: 'A single guided powerlifting class with a coach.', type: 'digital', price_etb: 80, image_url: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400', provider_id: '11111111-0000-0000-0000-000000000002', provider_name: 'Iron & Soul Gym', max_redemptions_per_user: 2, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: true, quantity_in_stock: 15, images: ['https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800'], provider: { id: '11111111-0000-0000-0000-000000000002', name: 'Iron & Soul Gym', category: 'gym', location_text: 'Kazanchis', rating: 4.5 }, provider_instructions: 'Redeem at the front desk.', shipping_required: false, redemption_count: 8
  },
  {
    id: 'prod-02-2', name: 'Iron Supplements Pack', description: 'A pack of pre-workout supplements.', type: 'physical', price_etb: 120, image_url: 'https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=400', provider_id: '11111111-0000-0000-0000-000000000002', provider_name: 'Iron & Soul Gym', max_redemptions_per_user: 1, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: false, quantity_in_stock: 10, images: ['https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=800'], provider: { id: '11111111-0000-0000-0000-000000000002', name: 'Iron & Soul Gym', category: 'gym', location_text: 'Kazanchis', rating: 4.5 }, provider_instructions: 'Ships in 2-3 business days.', shipping_required: true, redemption_count: 3
  },
  // 3. Shanti Yoga Addis
  {
    id: 'prod-03-1', name: 'Free Yoga Class', description: 'Join any 60-min group session.', type: 'digital', price_etb: 60, image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400', provider_id: '11111111-0000-0000-0000-000000000003', provider_name: 'Shanti Yoga Addis', max_redemptions_per_user: 2, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: true, quantity_in_stock: 30, images: ['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800'], provider: { id: '11111111-0000-0000-0000-000000000003', name: 'Shanti Yoga Addis', category: 'yoga', location_text: 'Bole', rating: 4.9 }, provider_instructions: 'Show voucher to instructor.', shipping_required: false, redemption_count: 22
  },
  {
    id: 'prod-03-2', name: 'Yoga Mat', description: 'High-quality non-slip yoga mat.', type: 'physical', price_etb: 140, image_url: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400', provider_id: '11111111-0000-0000-0000-000000000003', provider_name: 'Shanti Yoga Addis', max_redemptions_per_user: 1, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: false, quantity_in_stock: 5, images: ['https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800'], provider: { id: '11111111-0000-0000-0000-000000000003', name: 'Shanti Yoga Addis', category: 'yoga', location_text: 'Bole', rating: 4.9 }, provider_instructions: 'Delivery to your address.', shipping_required: true, redemption_count: 6
  },
  // 4. Zen Flow Studio
  {
    id: 'prod-04-1', name: 'Hot Yoga Intro Class', description: 'One entry to the infrared heated yoga room.', type: 'digital', price_etb: 70, image_url: 'https://images.unsplash.com/photo-1593810451137-5dc55105dace?w=400', provider_id: '11111111-0000-0000-0000-000000000004', provider_name: 'Zen Flow Studio', max_redemptions_per_user: 2, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: true, quantity_in_stock: 20, images: ['https://images.unsplash.com/photo-1593810451137-5dc55105dace?w=800'], provider: { id: '11111111-0000-0000-0000-000000000004', name: 'Zen Flow Studio', category: 'yoga', location_text: 'CMC', rating: 4.6 }, provider_instructions: 'Bring a towel! Show voucher.', shipping_required: false, redemption_count: 10
  },
  {
    id: 'prod-04-2', name: 'Aromatherapy Candle', description: 'Relaxing lavender scented candle.', type: 'physical', price_etb: 90, image_url: 'https://images.unsplash.com/photo-1602928321679-560bb453f190?w=400', provider_id: '11111111-0000-0000-0000-000000000004', provider_name: 'Zen Flow Studio', max_redemptions_per_user: 1, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: false, quantity_in_stock: 12, images: ['https://images.unsplash.com/photo-1602928321679-560bb453f190?w=800'], provider: { id: '11111111-0000-0000-0000-000000000004', name: 'Zen Flow Studio', category: 'yoga', location_text: 'CMC', rating: 4.6 }, provider_instructions: 'Ships in 2-3 business days.', shipping_required: true, redemption_count: 2
  },
  // 5. Nourish Ethiopia
  {
    id: 'prod-05-1', name: 'Quick Diet Review', description: 'A 20-min online diet consultation.', type: 'digital', price_etb: 100, image_url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400', provider_id: '11111111-0000-0000-0000-000000000005', provider_name: 'Nourish Ethiopia', max_redemptions_per_user: 1, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: true, quantity_in_stock: 10, images: ['https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800'], provider: { id: '11111111-0000-0000-0000-000000000005', name: 'Nourish Ethiopia', category: 'nutrition', location_text: 'Sarbet', rating: 4.8 }, provider_instructions: 'We will email you a meeting link.', shipping_required: false, redemption_count: 4
  },
  {
    id: 'prod-05-2', name: 'Healthy Ethiopian Recipes Book', description: 'Digital PDF of healthy local recipes.', type: 'digital', price_etb: 50, image_url: 'https://images.unsplash.com/photo-1589310371424-34062fb0da98?w=400', provider_id: '11111111-0000-0000-0000-000000000005', provider_name: 'Nourish Ethiopia', max_redemptions_per_user: 1, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: false, quantity_in_stock: 999, images: ['https://images.unsplash.com/photo-1589310371424-34062fb0da98?w=800'], provider: { id: '11111111-0000-0000-0000-000000000005', name: 'Nourish Ethiopia', category: 'nutrition', location_text: 'Sarbet', rating: 4.8 }, provider_instructions: 'Download link will be emailed.', shipping_required: false, redemption_count: 15
  },
  // 6. Green Plate Kitchen
  {
    id: 'prod-06-1', name: '1-Day Detox Meal Box', description: '3 healthy meals delivered to you.', type: 'physical', price_etb: 150, image_url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400', provider_id: '11111111-0000-0000-0000-000000000006', provider_name: 'Green Plate Kitchen', max_redemptions_per_user: 2, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: true, quantity_in_stock: 20, images: ['https://images.unsplash.com/photo-1547592180-85f173990554?w=800'], provider: { id: '11111111-0000-0000-0000-000000000006', name: 'Green Plate Kitchen', category: 'nutrition', location_text: 'Megenagna', rating: 4.4 }, provider_instructions: 'Delivered to your address next morning.', shipping_required: true, redemption_count: 5
  },
  {
    id: 'prod-06-2', name: 'Healthy Snack Pack', description: 'Assorted healthy nuts and bars.', type: 'physical', price_etb: 80, image_url: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400', provider_id: '11111111-0000-0000-0000-000000000006', provider_name: 'Green Plate Kitchen', max_redemptions_per_user: 3, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: false, quantity_in_stock: 30, images: ['https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=800'], provider: { id: '11111111-0000-0000-0000-000000000006', name: 'Green Plate Kitchen', category: 'nutrition', location_text: 'Megenagna', rating: 4.4 }, provider_instructions: 'Ships in 2-3 business days.', shipping_required: true, redemption_count: 11
  },
  // 7. Haile Spa & Wellness
  {
    id: 'prod-07-1', name: '30-Min Head & Shoulder Massage', description: 'Relieve stress with a quick massage.', type: 'digital', price_etb: 120, image_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400', provider_id: '11111111-0000-0000-0000-000000000007', provider_name: 'Haile Spa & Wellness', max_redemptions_per_user: 1, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: true, quantity_in_stock: 15, images: ['https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800'], provider: { id: '11111111-0000-0000-0000-000000000007', name: 'Haile Spa & Wellness', category: 'spa', location_text: 'Bole Atlas', rating: 4.8 }, provider_instructions: 'Show voucher at spa reception.', shipping_required: false, redemption_count: 19
  },
  {
    id: 'prod-07-2', name: 'Ethiopian Coffee Scrub (Product)', description: 'Take-home jar of our signature scrub.', type: 'physical', price_etb: 90, image_url: 'https://images.unsplash.com/photo-1615397323755-8cb962ea400e?w=400', provider_id: '11111111-0000-0000-0000-000000000007', provider_name: 'Haile Spa & Wellness', max_redemptions_per_user: 2, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: false, quantity_in_stock: 25, images: ['https://images.unsplash.com/photo-1615397323755-8cb962ea400e?w=800'], provider: { id: '11111111-0000-0000-0000-000000000007', name: 'Haile Spa & Wellness', category: 'spa', location_text: 'Bole Atlas', rating: 4.8 }, provider_instructions: 'Ships in 2-3 business days.', shipping_required: true, redemption_count: 7
  },
  // 8. Piassa Heritage Hammam
  {
    id: 'prod-08-1', name: 'Herbal Steam Session', description: '45 minutes in our authentic steam room.', type: 'digital', price_etb: 60, image_url: 'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=400', provider_id: '11111111-0000-0000-0000-000000000008', provider_name: 'Piassa Heritage Hammam', max_redemptions_per_user: 2, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: true, quantity_in_stock: 20, images: ['https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=800'], provider: { id: '11111111-0000-0000-0000-000000000008', name: 'Piassa Heritage Hammam', category: 'spa', location_text: 'Piassa', rating: 4.5 }, provider_instructions: 'Show voucher at reception.', shipping_required: false, redemption_count: 4
  },
  {
    id: 'prod-08-2', name: 'Hammam Towel', description: 'Traditional cotton hammam towel.', type: 'physical', price_etb: 110, image_url: 'https://images.unsplash.com/photo-1616628203875-c9e5cd3db3ac?w=400', provider_id: '11111111-0000-0000-0000-000000000008', provider_name: 'Piassa Heritage Hammam', max_redemptions_per_user: 1, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: false, quantity_in_stock: 15, images: ['https://images.unsplash.com/photo-1616628203875-c9e5cd3db3ac?w=800'], provider: { id: '11111111-0000-0000-0000-000000000008', name: 'Piassa Heritage Hammam', category: 'spa', location_text: 'Piassa', rating: 4.5 }, provider_instructions: 'Ships in 2-3 business days.', shipping_required: true, redemption_count: 2
  },
  // 9. Biruh Mind Wellness
  {
    id: 'prod-09-1', name: 'Intro Therapy Session', description: 'A 30-min introductory video call.', type: 'digital', price_etb: 130, image_url: 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=400', provider_id: '11111111-0000-0000-0000-000000000009', provider_name: 'Biruh Mind Wellness', max_redemptions_per_user: 1, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: true, quantity_in_stock: 10, images: ['https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=800'], provider: { id: '11111111-0000-0000-0000-000000000009', name: 'Biruh Mind Wellness', category: 'therapy', location_text: 'Kazanchis', rating: 4.9 }, provider_instructions: 'Link to book a time slot will be sent.', shipping_required: false, redemption_count: 14
  },
  {
    id: 'prod-09-2', name: 'Mindfulness Journal', description: 'Guided journal for daily mindfulness.', type: 'physical', price_etb: 80, image_url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=400', provider_id: '11111111-0000-0000-0000-000000000009', provider_name: 'Biruh Mind Wellness', max_redemptions_per_user: 2, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: false, quantity_in_stock: 30, images: ['https://images.unsplash.com/photo-1517842645767-c639042777db?w=800'], provider: { id: '11111111-0000-0000-0000-000000000009', name: 'Biruh Mind Wellness', category: 'therapy', location_text: 'Kazanchis', rating: 4.9 }, provider_instructions: 'Ships in 2-3 business days.', shipping_required: true, redemption_count: 5
  },
  // 10. MoveMind Running Club
  {
    id: 'prod-10-1', name: 'Group Run Entry', description: 'Join one of our weekly guided runs.', type: 'digital', price_etb: 50, image_url: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=400', provider_id: '11111111-0000-0000-0000-000000000010', provider_name: 'MoveMind Running Club', max_redemptions_per_user: 3, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: true, quantity_in_stock: 50, images: ['https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800'], provider: { id: '11111111-0000-0000-0000-000000000010', name: 'MoveMind Running Club', category: 'gym', location_text: 'Addis Ababa Stadium', rating: 4.7 }, provider_instructions: 'Show voucher to run leader.', shipping_required: false, redemption_count: 31
  },
  {
    id: 'prod-10-2', name: 'Running Water Bottle', description: 'BPA-free branded sports bottle.', type: 'physical', price_etb: 70, image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400', provider_id: '11111111-0000-0000-0000-000000000010', provider_name: 'MoveMind Running Club', max_redemptions_per_user: 1, expiry_date: '2026-12-31T23:59:59Z', is_in_stock: true, is_recommended: false, quantity_in_stock: 25, images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800'], provider: { id: '11111111-0000-0000-0000-000000000010', name: 'MoveMind Running Club', category: 'gym', location_text: 'Addis Ababa Stadium', rating: 4.7 }, provider_instructions: 'Ships in 2-3 business days.', shipping_required: true, redemption_count: 9
  }
];

export const MOCK_REDEMPTIONS = [
  {
    id: 'red-001',
    product_name: 'Private Yoga Session',
    product_image_url: 'https://images.unsplash.com/photo-1545205597-3b2a3a0b0b0b?w=400',
    provider_name: 'Shanti Yoga Addis',
    points_spent: 2000,
    redeemed_at: '2026-06-08T10:30:00Z',
    type: 'digital',
    delivery_status: 'confirmed',
    redemption_code: 'YOGA-ABC123',
    delivery_address: null,
    provider_notes: null
  },
  {
    id: 'red-002',
    product_name: 'Wellness Nutrition Kit',
    product_image_url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400',
    provider_name: 'Lifestyle Fitness Center',
    points_spent: 1500,
    redeemed_at: '2026-06-05T14:00:00Z',
    type: 'physical',
    delivery_status: 'shipped',
    redemption_code: null,
    delivery_address: 'Addis Ababa, Bole, Building 45',
    provider_notes: 'Shipped via DHL. Tracking: 123ABC'
  }
];

export const MOCK_ADMIN_ANALYTICS = {
  total_users: 156,
  onboarded_users: 120,
  total_providers: 8,
  total_communities: 12,
  total_bookings: 47,
  successful_payments: 38,
  total_revenue_etb: 45600,
  active_users_7d: 89,
  new_users_today: 5,
  top_categories: [
    { category: 'yoga', count: 48 },
    { category: 'gym', count: 35 },
    { category: 'nutrition', count: 12 }
  ]
};

export const MOCK_PENDING_PROVIDERS = [
  {
    id: 'prov-pending-001',
    name: 'Zen Yoga Studio',
    category: 'yoga',
    status: 'pending_approval',
    owner_user_id: '00000000-0000-0000-0000-000000000002',
    owner_name: 'Abebe Tadesse',
    owner_telegram_handle: '@abebe_fitness',
    submitted_at: new Date(now - 2 * 3600000).toISOString(),
    description: 'Premium yoga in Bole with certified instructors.',
    location_text: 'Bole, Addis Ababa',
    lat: 9.0054,
    lng: 38.7636,
    price_range: 'ETB 500-2000',
    services: [
      { name: 'Morning Vinyasa', price: 800, duration: '60 min' },
      { name: 'Private Session', price: 2000, duration: '90 min' }
    ],
    cover_photo_url: 'https://images.unsplash.com/photo-1545205597-3b2a3a0b0b0b?w=800',
    photos: []
  }
];

export const MOCK_ADMIN_PROVIDERS = [
  { id: '11111111-0000-0000-0000-000000000003', name: 'Shanti Yoga Addis', category: 'yoga', status: 'active', location_text: 'Bole', owner_name: 'Sara M.', member_count: 83, onboarded_by_admin: true },
  { id: '11111111-0000-0000-0000-000000000001', name: 'Lifestyle Fitness Center', category: 'gym', status: 'active', location_text: 'Bole', owner_name: 'Admin', member_count: 47, onboarded_by_admin: true }
];

export const MOCK_ADMIN_PRODUCTS = MOCK_PRODUCTS.map(p => ({
  id: p.id,
  name: p.name,
  provider_id: p.provider_id,
  provider_name: p.provider_name,
  type: p.type,
  price_etb: p.price_etb,
  quantity_in_stock: p.quantity_in_stock,
  redemption_count: p.redemption_count,
  is_active: true,
  created_at: '2026-06-01T00:00:00Z'
}));

export const MOCK_PROVIDER_PRODUCTS = MOCK_PRODUCTS.filter(
  p => p.provider_id === '11111111-0000-0000-0000-000000000003'
).map(p => ({
  id: p.id,
  name: p.name,
  type: p.type,
  price_etb: p.price_etb,
  quantity_in_stock: p.quantity_in_stock,
  is_active: true
}));

// Generate next 7 days for date picker
export function getNextDays(count = 7) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push({
      date: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en', { weekday: 'short' }),
    });
  }
  return days;
}
