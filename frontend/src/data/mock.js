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
  interest_categories: ['yoga', 'nutrition'],
  exercise_frequency: 'sometimes',
  points_balance: 120,
  tier: 'sprout',
  tier_emoji: '🌿',
  current_streak: 3,
  freeze_count: 0,
  is_onboarded: true,
  is_provider: false,
  is_super_admin: import.meta.env.VITE_MOCK_SUPER_ADMIN === 'true',
  location_neighborhood: null,
  health_app_connected: false,
  bio: 'Finding balance through yoga, mindful movement, and community.',
  follower_count: 2,
  following_count: 2,
  profile_privacy: 'public',
  is_verified_trainer: false,
  verified_trainer_expires_at: null,
  strava_connected: false,
  strava_visible_stats: ['distance', 'moving_time', 'elevation', 'activity_count', 'recent_activities'],
  phone_number: null,
  time_format: null,
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
    // Kept bookable (unlike the other non-pilot mocks) so the online/promo/
    // multi-day booking-flow tests still have a live, priced fixture to
    // exercise — those mechanics are independent of the Boston Day Spa
    // pilot-exclusivity rule and stay valid once other providers launch.
    is_coming_soon: false,
    category: 'gym',
    description: "Addis Ababa's premier multi-level fitness club featuring cutting-edge equipment, certified personal trainers, and a rooftop functional training area.",
    location_text: 'Bole Sub-City, near Edna Mall, Addis Ababa',
    lat: 9.0105, lng: 38.7878,
    price_range: 'ETB 800 – 4,500',
    rating: 4.7,
    contact_phone: '+251 91 123 4567',
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
    community_id: '22222222-0000-0000-0000-000000000001',
    // Presale loop (Biniyam sprint): mirrors backend shape incl. per-user eligibility
    active_promotion: {
      id: '33333333-0000-0000-0000-000000000001',
      headline: 'Presale: 20% off your first visit',
      discount_pct: 20,
      valid_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      audience: 'first_time',
      user_eligible: true,
    },
  },
  {
    id: '11111111-0000-0000-0000-000000000002',
    name: 'Iron & Soul Gym',
    // Kept bookable — used as the generic no-promo/multi-day booking fixture
    // across several tests (see Lifestyle Fitness Center's comment above).
    is_coming_soon: false,
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
    is_coming_soon: true,
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
    is_coming_soon: true,
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
    is_coming_soon: true,
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
    is_coming_soon: true,
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
    is_coming_soon: true,
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
    is_coming_soon: true,
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
    is_coming_soon: true,
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
    is_coming_soon: true,
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
  },
  {
    id: '11111111-0000-0000-0000-000000000011',
    name: 'Boston Day Spa',
    category: 'spa',
    description: 'Boston Day Spa is where the Kuriftu brand was born, a testament to our commitment to community empowerment… What began as a capacity-building project in Addis Ababa has transformed into a sanctuary of well-being, showcasing the work of celebrated Ethiopian artists like Merikokeb Berhanu.',
    location_text: 'Bole, Addis Ababa',
    lat: null, lng: null,
    price_range: 'Price on enquiry',
    rating: 4.9,
    cover_photo_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800',
    photos: [
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800',
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800',
      'https://images.unsplash.com/photo-1560750133-c09be1a39f87?w=800',
      'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=800',
      'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800'
    ],
    // Confirmed from the official Boston Day Spa PDF — no prices yet (B1),
    // priced-on-enquiry until the owner confirms them (see FEATURE_PLAN).
    services: [
      { name: 'Hair Salon', description: 'Professional hair styling and barber studio.', price: null, duration: null, booking_method: 'phone' },
      { name: 'Steam / Sauna / Jacuzzi', description: 'Steam, sauna, and jacuzzi facilities.', price: null, duration: null, booking_method: 'phone' },
      { name: 'Massage Cave', description: 'Serene massage room experiences.', price: null, duration: null, booking_method: 'phone' },
      { name: 'Mani / Pedi', description: 'Dedicated manicure lounge and pedicure space.', price: null, duration: null, booking_method: 'phone' },
      { name: 'Facial', description: 'Luxury facial suite treatments.', price: null, duration: null, booking_method: 'phone' },
      { name: 'Wax', description: 'Waxing studio services.', price: null, duration: null, booking_method: 'phone' },
      { name: 'Barber', description: 'Full-service barber studio.', price: null, duration: null, booking_method: 'phone' }
    ],
    facilities: [
      'Professional hair styling and barber studio', 'Dedicated manicure lounge', 'Relaxing pedicure space',
      'Serene massage room', 'Luxury facial suite', 'Waxing studio', 'Full-service spa'
    ],
    navigation_tips: [
      { title: 'Location', detail: 'Located in the heart of Addis Ababa, Bole.' },
      { title: 'Call ahead', detail: '+251 11 662 3808 or +251 11 663 6557 to confirm your visit.' },
    ],
    contact_phone: '+251 11 662 3808',
    contact_email: 'booking@kurifturesorts.com',
    is_featured: true,
    is_coming_soon: false,
    community: { id: '22222222-0000-0000-0000-000000000011', name: 'Boston Day Spa Circle', member_count: 58, user_joined: false },
    member_count: 58,
    community_id: '22222222-0000-0000-0000-000000000011'
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
  checked_in_today: false, // list-shape field (drives the Home check-in card)
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
    { action: 'checkin', points: 0, community_name: 'Shanti Yoga Circle', created_at: new Date(now - 1 * 3600000).toISOString() },
    { action: 'checkin', points: 0, community_name: 'Nourish Community', created_at: new Date(now - 25 * 3600000).toISOString() },
    { action: 'checkin', points: 0, community_name: 'Shanti Yoga Circle', created_at: new Date(now - 49 * 3600000).toISOString() },
    { action: 'decay', points: -5, community_name: null, created_at: new Date(now - 72 * 3600000).toISOString() },
    { action: 'checkin', points: 0, community_name: 'Shanti Yoga Circle', created_at: new Date(now - 96 * 3600000).toISOString() }
  ],
  current_balance: 120,
  tier: 'sprout',
  tier_emoji: '🌿'
};

// ─── Circles & Leaderboards ─────────────────────────
// is_joined/is_private mirror the real GET /api/circles shape — used to
// build the onboarding "Available Circles" join list (not-joined, public).
export const MOCK_CIRCLES = [
  { id: '33333333-0000-0000-0000-000000000001', name: 'Addis Morning Runners', description: 'We run every morning at 6 AM around Meskel Square.', member_count: 24, join_code: 'RUN24AM', is_private: false, is_joined: false, owner_id: '00000000-0000-0000-0000-000000000097', owner_name: 'Selam Alemu', owner_telegram_handle: 'selam_well', owner_is_verified: false, is_paid: false, price_etb: null, paid_circle_status: 'free', total_revenue_etb: 0 },
  { id: '33333333-0000-0000-0000-000000000002', name: 'Zen Seekers', description: 'Mindfulness, yoga, and finding peace in the chaotic city.', member_count: 112, join_code: 'ZEN56', is_private: false, is_joined: true, owner_id: MOCK_USER.id, owner_name: MOCK_USER.name, owner_telegram_handle: MOCK_USER.telegram_handle, owner_is_verified: false, is_paid: false, price_etb: null, paid_circle_status: 'free', total_revenue_etb: 0 },
  { id: '33333333-0000-0000-0000-000000000003', name: 'Hana Endurance Club', description: 'Monthly coached running plans and community accountability.', member_count: 124, join_code: 'HANA124', is_private: false, is_joined: false, owner_id: '00000000-0000-0000-0000-000000000099', owner_name: 'Hana Girma', owner_telegram_handle: 'hana_runs', owner_is_verified: true, is_paid: true, price_etb: 350, paid_circle_status: 'approved', total_revenue_etb: 33250 }
];

// ─── Profiles, verification, paid circles & Strava ───────────────────────
export const MOCK_PUBLIC_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000099',
    name: 'Hana Girma',
    telegram_handle: 'hana_runs',
    photo_url: 'https://i.pravatar.cc/150?u=hana',
    bio: 'Certified running coach helping Addis athletes build joyful, sustainable routines.',
    follower_count: 148,
    following_count: 38,
    profile_privacy: 'public',
    is_verified_trainer: true,
    is_following: false,
    created_circles: [MOCK_CIRCLES[2]],
    strava_connected: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000098',
    name: 'Dawit Bekele',
    telegram_handle: 'dawit_fit',
    photo_url: 'https://i.pravatar.cc/150?u=dawit',
    bio: 'Strength, mobility, and good coffee.',
    follower_count: 76,
    following_count: 51,
    profile_privacy: 'followers',
    is_verified_trainer: false,
    is_following: true,
    created_circles: [],
    stats_hidden: false,
    strava_connected: false,
  },
];

export const MOCK_FOLLOWERS = [
  { ...MOCK_PUBLIC_USERS[0], is_following: false },
  { ...MOCK_PUBLIC_USERS[1], is_following: true },
];

export const MOCK_FOLLOWING = [
  { ...MOCK_PUBLIC_USERS[1], is_following: true },
  { id: '00000000-0000-0000-0000-000000000097', name: 'Selam Alemu', telegram_handle: 'selam_well', photo_url: 'https://i.pravatar.cc/150?u=selam', bio: 'Wellness enthusiast', is_verified_trainer: false, is_following: true },
];

export const MOCK_STRAVA_STATS = {
  connected: true,
  athlete_name: 'Hana Girma',
  visible_stats: ['distance', 'moving_time', 'elevation', 'activity_count', 'recent_activities'],
  // Backend aggregated stats use kilometres (recent activities do too).
  distance: 128.43,
  calories: 4820,
  moving_time: 36720,
  elevation: 1860,
  activity_count: 18,
  recent_activities: [
    { id: 'strava-1', name: 'Entoto Morning Run', type: 'Run', distance: 10.24, moving_time: 3260, start_date: new Date(now - 86400000).toISOString() },
    { id: 'strava-2', name: 'Recovery Walk', type: 'Walk', distance: 4.2, moving_time: 3010, start_date: new Date(now - 3 * 86400000).toISOString() },
  ],
};

export const MOCK_TRAINER_VERIFICATIONS = [
  {
    id: 'verify-001',
    user_id: MOCK_PUBLIC_USERS[1].id,
    user_name: MOCK_PUBLIC_USERS[1].name,
    user_handle: MOCK_PUBLIC_USERS[1].telegram_handle,
    user_photo_url: MOCK_PUBLIC_USERS[1].photo_url,
    certificate_url: 'https://example.com/certificate.pdf',
    payment_receipt_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500',
    status: 'pending',
    payment_status: 'paid',
    rejection_reason: null,
    created_at: new Date(now - 2 * 86400000).toISOString(),
    expires_at: null,
  },
];

export const MOCK_PAID_CIRCLE_APPLICATIONS = [
  {
    ...MOCK_CIRCLES[1],
    member_count: 112,
    price_etb: 250,
    paid_circle_status: 'pending_approval',
    owner_lifetime_points: 1320,
    applied_at: new Date(now - 86400000).toISOString(),
  },
];

export const MOCK_CIRCLE_SUBSCRIPTIONS = [
  {
    id: 'circle-sub-001',
    circle_id: MOCK_CIRCLES[1].id,
    user_id: MOCK_PUBLIC_USERS[1].id,
    user_name: MOCK_PUBLIC_USERS[1].name,
    user_handle: MOCK_PUBLIC_USERS[1].telegram_handle,
    user_photo_url: MOCK_PUBLIC_USERS[1].photo_url,
    amount_etb: 250,
    status: 'pending_approval',
    receipt_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500',
    created_at: new Date(now - 3600000).toISOString(),
  },
];

export const MOCK_CIRCLE_REVENUE = {
  total_revenue_etb: 33250,
  creator_earnings_etb: 31588,
  platform_fee_etb: 1662,
  active_subscribers: 95,
  pending_receipts: 1,
  monthly_trend: [
    { month: 'May', revenue: 21000, subscribers: 60 },
    { month: 'June', revenue: 28000, subscribers: 80 },
    { month: 'July', revenue: 33250, subscribers: 95 },
  ],
};

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
    content: "Just finished a 5K run! Feeling great!",
    user: { id: '002', name: 'Meron Tadesse', photo_url: 'https://i.pravatar.cc/150?u=meron' },
    created_at: new Date(now - 1 * 3600000).toISOString(),
    activity_type: 'run',
    distance_km: 5.0,
    duration_min: 28,
    photo_url: null,
    reactions: { '🔥': 2, 'coins': 1 },
    total_points_gifted: 5,
    circle_id: '33333333-0000-0000-0000-000000000001',
    comments: [
      {
        id: 'cmt-0001',
        content: 'Nice pace!',
        created_at: new Date(now - 0.9 * 3600000).toISOString(),
        parent_comment_id: null,
        user: { id: '001', name: 'Dawit', photo_url: 'https://i.pravatar.cc/150?u=dawit' },
        replies: [
          {
            id: 'cmt-0002',
            content: 'Thanks! Trying to beat it next week.',
            created_at: new Date(now - 0.8 * 3600000).toISOString(),
            parent_comment_id: 'cmt-0001',
            user: { id: '002', name: 'Meron Tadesse', photo_url: 'https://i.pravatar.cc/150?u=meron' },
            replies: []
          }
        ]
      }
    ]
  },
  {
    id: '44444444-0000-0000-0000-000000000003',
    content: "Dawit checked in for their workout today! 💪 Keep it up!",
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

// ─── Provider Website: bookings, service mix, demographics, custom-range metrics ──
export const MOCK_PROVIDER_BOOKINGS = {
  bookings: MOCK_PROVIDER_STATS.recent_bookings.map((b, i) => ({
    ...b,
    user_name: ['Meron Tadesse', 'Dawit Hailu', 'Sara Alemayehu', 'Abel Kebede'][i] || 'Guest',
    customer_demographics: [
      { location_neighborhood: 'Bole', interest_categories: ['yoga', 'nutrition'], exercise_frequency: 'sometimes' },
      { location_neighborhood: 'CMC', interest_categories: ['gym'], exercise_frequency: 'daily' },
      { location_neighborhood: 'Sarbet', interest_categories: ['nutrition'], exercise_frequency: 'rarely' },
      { location_neighborhood: 'Bole', interest_categories: ['running', 'yoga'], exercise_frequency: 'regular' },
    ][i] || { location_neighborhood: null, interest_categories: [], exercise_frequency: null },
  })),
  total: MOCK_PROVIDER_STATS.recent_bookings.length,
  page: 1,
  per_page: 20,
};

export const MOCK_PROVIDER_SERVICE_BREAKDOWN = {
  services: [
    { service_name: 'Drop-in Yoga Class', bookings_count: 18, revenue_etb: 9000 },
    { service_name: 'Monthly Unlimited Pass', bookings_count: 6, revenue_etb: 16800 },
    { service_name: 'Private 1-on-1 Session', bookings_count: 4, revenue_etb: 7200 },
  ],
};

export const MOCK_PROVIDER_DEMOGRAPHICS = {
  total_customers: 4,
  by_neighborhood: [
    { label: 'Bole', count: 2 },
    { label: 'CMC', count: 1 },
    { label: 'Sarbet', count: 1 },
  ],
  by_interest_category: [
    { label: 'yoga', count: 2 },
    { label: 'nutrition', count: 2 },
    { label: 'gym', count: 1 },
    { label: 'running', count: 1 },
  ],
  by_exercise_frequency: [
    { label: 'sometimes', count: 1 },
    { label: 'daily', count: 1 },
    { label: 'rarely', count: 1 },
    { label: 'regular', count: 1 },
  ],
};

export function buildMockProviderTimeseries(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const series = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    series.push({
      date: d.toISOString().slice(0, 10),
      bookings: Math.floor(Math.random() * 4),
      revenue_etb: Math.floor(Math.random() * 4) * 500,
      checkins: Math.floor(Math.random() * 6),
    });
  }
  return {
    provider_id: MOCK_PROVIDER_STATS.provider_id,
    start_date: series[0]?.date || startDate,
    end_date: series[series.length - 1]?.date || endDate,
    series,
    totals: {
      bookings: series.reduce((s, d) => s + d.bookings, 0),
      revenue_etb: series.reduce((s, d) => s + d.revenue_etb, 0),
      checkins: series.reduce((s, d) => s + d.checkins, 0),
      unique_customers: 4,
    },
  };
}

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

// ─── Events (Phase 3 featured events + V2 "near you") ──
// getEvents()/getFeaturedEvents() previously always returned an empty mock
// array — the "Happening Soon" carousel and the location-nearby matching
// both needed at least one real event to have anything to show in mock mode.
export const MOCK_EVENTS = [
  {
    id: 'evt-shanti-01',
    provider_id: '11111111-0000-0000-0000-000000000003', // Shanti Yoga Addis, Bole
    provider_name: 'Shanti Yoga Addis',
    service_name: 'Sunrise Rooftop Yoga',
    price_etb: 350,
    capacity: 20,
    spots_remaining: 4,
    urgency: 'high',
    is_boosted: true,
    starts_at: new Date(Date.now() + 2 * 86400000).toISOString(),
  },
  {
    id: 'evt-lifestyle-01',
    provider_id: '11111111-0000-0000-0000-000000000001', // Lifestyle Fitness Center, Bole
    provider_name: 'Lifestyle Fitness Center',
    service_name: 'Group HIIT Class',
    price_etb: 200,
    capacity: 15,
    spots_remaining: 9,
    urgency: 'medium',
    is_boosted: false,
    starts_at: new Date(Date.now() + 4 * 86400000).toISOString(),
  },
];

// ─── For You Feed (Phase 4/5) ───────────────────────
// Mirrors the backend's fixed interleave (see docs/API_CONTRACT.md #2b):
// posts newest-first, splicing one non-post item after every 3rd post,
// cycling event -> service -> provider, skipping an empty category, with any
// leftover items appended at the end so the feed is never empty.
function buildMockForYouFeed() {
  const postItems = MOCK_POSTS
    .filter(p => !p.is_system_event)
    .map(p => {
      const circle = MOCK_CIRCLES.find(c => c.id === p.circle_id);
      return {
        type: 'post',
        render_cost: p.photo_url ? 'media' : 'instant',
        id: p.id,
        created_at: p.created_at,
        post: {
          ...p,
          comment_count: (p.comments || []).length,
          truncated: false,
          source: circle
            ? { kind: 'circle', id: circle.id, name: circle.name, member_count: circle.member_count }
            : { kind: 'community', id: null, name: null, member_count: 0 },
        },
      };
    });

  const providerBrief = (p) => ({
    id: p.id, name: p.name, category: p.category, location_text: p.location_text,
    rating: p.rating, cover_photo_url: p.cover_photo_url, is_coming_soon: !!p.is_coming_soon,
  });

  const boston = MOCK_PROVIDERS.find(p => p.name === 'Boston Day Spa');
  const serviceItems = (boston?.services || []).map((service, idx) => ({
    type: 'service',
    render_cost: 'media',
    id: `${boston.id}:${idx}`,
    provider: providerBrief(boston),
    service,
  }));

  // Coming-soon providers are included too — FeedProviderCard shows a
  // "Coming soon" badge and hides the booking CTA for them, so they stay
  // visible in the feed pre-launch instead of being invisible until then.
  const providerItems = MOCK_PROVIDERS.map(p => ({
    type: 'provider',
    render_cost: 'media',
    id: p.id,
    provider: providerBrief(p),
    promotion: p.active_promotion || null,
  }));

  const eventItems = MOCK_EVENTS.filter(e => e.is_boosted).map(e => ({
    type: 'event',
    render_cost: 'media',
    id: e.id,
    event: e,
    provider: { id: e.provider_id, name: e.provider_name, category: null, cover_photo_url: null },
  }));

  const pools = [eventItems, serviceItems, providerItems];
  const cursors = [0, 0, 0];
  let cycleIdx = 0;
  const takeNext = () => {
    for (let attempt = 0; attempt < pools.length; attempt++) {
      const chosen = cycleIdx;
      cycleIdx = (cycleIdx + 1) % pools.length;
      if (cursors[chosen] < pools[chosen].length) {
        cursors[chosen] += 1;
        return pools[chosen][cursors[chosen] - 1];
      }
    }
    return null;
  };

  const items = [];
  // Pin the top featured provider (Boston Day Spa) as the very first feed
  // item — mirrors the backend's fixed interleave (feed_service.py
  // _interleave) so it doesn't depend on the every-3rd-post cadence.
  if (providerItems.length > 0) {
    items.push(providerItems[0]);
    cursors[2] = 1;
  }
  postItems.forEach((postItem, i) => {
    items.push(postItem);
    if ((i + 1) % 3 === 0) {
      const next = takeNext();
      if (next) items.push(next);
    }
  });
  let leftover = takeNext();
  while (leftover) {
    items.push(leftover);
    leftover = takeNext();
  }
  return items;
}

export const MOCK_FOR_YOU_FEED = buildMockForYouFeed();

// ─── Ranks (V2 UX Phase 5 — weekly leaderboard) ─────
export const MOCK_RANKS = {
  communities: [
    { community_id: '22222222-0000-0000-0000-000000000003', name: 'Shanti Yoga Circle', member_count: 83, weekly_points: 2450, rank: 1 },
    { community_id: '22222222-0000-0000-0000-000000000001', name: 'Lifestyle Fit Squad', member_count: 47, weekly_points: 1980, rank: 2 },
    { community_id: '22222222-0000-0000-0000-000000000002', name: 'Iron & Soul Lifters', member_count: 28, weekly_points: 1120, rank: 3 },
    { community_id: '22222222-0000-0000-0000-000000000004', name: 'Zen Flow Hot Yoga', member_count: 35, weekly_points: 860, rank: 4 },
  ],
  users: [
    { user_id: '00000000-0000-0000-0000-000000000099', name: 'Hana Girma', photo_url: 'https://i.pravatar.cc/150?u=hana', weekly_points: 340, rank: 1 },
    { user_id: '00000000-0000-0000-0000-000000000098', name: 'Dawit Bekele', photo_url: 'https://i.pravatar.cc/150?u=dawit', weekly_points: 295, rank: 2 },
    { user_id: '00000000-0000-0000-0000-000000000097', name: 'Selam Alemu', photo_url: 'https://i.pravatar.cc/150?u=selam', weekly_points: 210, rank: 3 },
    { user_id: '00000000-0000-0000-0000-000000000001', name: 'Meron Tadesse', photo_url: 'https://i.pravatar.cc/150?u=meron', weekly_points: 120, rank: 8 },
  ],
  me: { rank: 8, weekly_points: 120 },
};

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
  { id: '11111111-0000-0000-0000-000000000003', name: 'Shanti Yoga Addis', category: 'yoga', status: 'active', location_text: 'Bole', owner_name: 'Sara M.', member_count: 83, onboarded_by_admin: true, is_coming_soon: true },
  { id: '11111111-0000-0000-0000-000000000001', name: 'Lifestyle Fitness Center', category: 'gym', status: 'active', location_text: 'Bole', owner_name: 'Admin', member_count: 47, onboarded_by_admin: true, is_coming_soon: true },
  { id: '22222222-0000-0000-0000-000000000010', name: 'Boston Day Spa', category: 'spa', status: 'active', location_text: 'Bole, Addis Ababa', owner_name: 'Kuriftu', member_count: 58, onboarded_by_admin: true, is_coming_soon: false }
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

// ─── Points Economy: Provider CRM, price suggestions, analytics (C1/D1/C5) ──
export const MOCK_PROVIDER_CUSTOMERS = [
  {
    user_id: '00000000-0000-0000-0000-000000000001',
    name: 'Meron Tadesse',
    photo_url: 'https://i.pravatar.cc/150?u=meron',
    last_visit: '2026-07-07T09:00:00Z',
    lifetime_points_redeemed: 120,
    points_balance: 120,
  },
  {
    user_id: '00000000-0000-0000-0000-000000000002',
    name: 'Abel Girma',
    photo_url: 'https://i.pravatar.cc/150?u=abel',
    last_visit: '2026-07-05T14:30:00Z',
    lifetime_points_redeemed: 60,
    points_balance: 40,
  },
];

export const MOCK_PRICE_SUGGESTION = {
  has_comparables: true,
  suggestion_text: 'Similar yoga providers charge 300–500 pts (median 400)',
  median: 400,
  p25: 300,
  p75: 500,
  sample_size: 6,
};

export const MOCK_PROVIDER_POINTS_ANALYTICS = {
  weekly_trend: [
    { week_label: 'Week 1', points_redeemed: 220, unique_visits: 5 },
    { week_label: 'Week 2', points_redeemed: 340, unique_visits: 8 },
    { week_label: 'Week 3', points_redeemed: 180, unique_visits: 4 },
    { week_label: 'Week 4', points_redeemed: 410, unique_visits: 9 },
  ],
};

// ─── Social growth (E1/E2) ───────────────────────────────────────────────
export const MOCK_SOCIAL_PROOF = { checked_in_today: 3 };

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
      dayNumber: d.getDate(),
    });
  }
  return days;
}
