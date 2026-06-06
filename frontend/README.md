# Well Circle Frontend

Telegram Mini App frontend for **Well Circle** — a wellness marketplace & community platform for Ethiopia.

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173`

## Architecture

```
src/
├── api/client.js          # API client (mock toggle → real backend)
├── context/AuthContext.jsx # Auth state management
├── data/mock.js           # Mock data matching API contract
├── components/            # Reusable UI components
│   ├── BottomNav.jsx      # 4-tab navigation
│   ├── ProviderCard.jsx   # Provider card
│   ├── CommunityCard.jsx  # Community card
│   ├── FeedEvent.jsx      # Feed event row
│   ├── PointsBadge.jsx    # Points chip
│   └── Toast.jsx          # Toast notifications
├── pages/                 # Screen components
│   ├── SplashScreen.jsx   # Auto-auth + loading
│   ├── OnboardingFlow.jsx # 5-step onboarding
│   ├── HomeScreen.jsx     # Featured + alerts
│   ├── ExploreScreen.jsx  # Provider grid + search
│   ├── ProviderDetail.jsx # Gallery + services + Book Now
│   ├── CommunityList.jsx  # Circles list + filters
│   ├── CommunityDetail.jsx# Live feed + check-in
│   ├── BookingFlow.jsx    # 3-step booking + payment
│   ├── ProfileScreen.jsx  # Points + neighbourhood + health
│   └── ProviderDashboard.jsx # KPIs + live feed + bookings
├── App.jsx                # Router + shell
├── main.jsx               # Entry point
└── index.css              # Full design system
```

## Switching to Real Backend

In `src/api/client.js`, change:

```js
const USE_MOCK = false;
```

And set your backend URL in `.env`:

```
VITE_API_BASE=https://your-render-app.onrender.com/api
```

## Screens (10 total)

| Screen | Route | Tab |
|--------|-------|-----|
| Splash / Auth | `/` | — |
| Onboarding | `/onboarding` | — |
| Home | `/home` | Home |
| Explore | `/explore` | Explore |
| Provider Detail | `/provider/:id` | — |
| Community List | `/community` | Community |
| Community Detail | `/community/:id` | — |
| Booking Flow | `/booking/:providerId` | — |
| Profile | `/profile` | Profile |
| Provider Dashboard | `/provider-dashboard` | — |

## Tech Stack

- **React 18** + **Vite 5**
- **React Router v6** for client-side routing
- **Vanilla CSS** with design tokens
- **Telegram Web App SDK** for Mini App integration
- **Mock data** matching API_CONTRACT.md exactly
