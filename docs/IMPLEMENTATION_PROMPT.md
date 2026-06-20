# 🚀 Well Circle - Phase 2 Full-Stack Implementation Prompt

**Project**: Well Circle - Wellness Marketplace + Community Platform  
**Scope**: Provider Self-Onboarding + Products Store + Super Admin Dashboard  
**Target**: Production-ready, no breaking changes, mobile-first responsive design  
**Date**: June 2026

---

## 📋 EXECUTIVE SUMMARY

Implement three interconnected Phase 2 features across full stack (backend + frontend + Telegram bot):

1. **Provider Self-Onboarding (Gated)**: Authenticated providers can submit applications → admin approves → goes live
2. **Wellness Products Store**: Providers manage products → users browse/search with filters → redeem Legacy Points
3. **Super Admin Dashboard**: Protected admin interface in Mini App (`/admin` route) for provider approval, product management, analytics

### Design Constraints
- **Frontend**: Mobile-first responsive (320–430px), match existing Dark/Gold/Green theme, use CSS variables
- **Backend**: Zero breaking changes to existing endpoints, maintain JWT auth patterns
- **Bot**: Minimal changes—add `/admin` command & approval notifications only

---

## 🏗️ ARCHITECTURE OVERVIEW

### Database Schema Additions

#### 1. **Providers Table Updates**
```sql
ALTER TABLE providers ADD COLUMN status VARCHAR(50) DEFAULT 'draft';  
-- Values: draft | pending_approval | active | inactive | rejected
-- NEW: Track provider lifecycle

ALTER TABLE providers ADD COLUMN owner_user_id UUID NOT NULL REFERENCES users(id);  
-- Existing column, ensure NOT NULL for self-onboarded providers

ALTER TABLE providers ADD COLUMN onboarded_by_admin BOOLEAN DEFAULT false;
-- NEW: Track if admin-created (existing) vs self-onboarded (new)

ALTER TABLE providers ADD COLUMN submitted_at TIMESTAMP WITH TIME ZONE;
-- NEW: When provider first submitted application

ALTER TABLE providers ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;
-- NEW: When admin approved/rejected
```

#### 2. **New: Provider Invites Table**
```sql
CREATE TABLE provider_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code VARCHAR(20) UNIQUE NOT NULL,  -- e.g., "INVITE-ABC123XYZ"
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  used_by_user_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- 30 days from creation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_invite_code ON provider_invites(invite_code);
CREATE INDEX idx_is_active ON provider_invites(is_active);
```

#### 3. **New: Products Table**
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,  -- "digital" | "physical"
  price_etb INTEGER NOT NULL,  -- in cents to avoid float precision issues; display as ETB
  image_url VARCHAR(500),
  images JSONB,  -- Array of photo URLs (max 5)
  quantity_in_stock INTEGER DEFAULT 0,
  max_redemptions_per_user INTEGER DEFAULT 1,
  expiry_date TIMESTAMP WITH TIME ZONE,
  digital_code_template VARCHAR(255),  -- e.g., "YOGA-{RANDOM_6CHARS}" for generating codes
  provider_instructions TEXT,  -- "Redeem at studio with QR code" or "Valid for 30 days"
  shipping_required BOOLEAN DEFAULT false,  -- if true, user must provide address
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX idx_provider_products ON products(provider_id);
CREATE INDEX idx_product_type ON products(type);
```

#### 4. **New: User Redemptions Table**
```sql
CREATE TABLE user_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  product_id UUID NOT NULL REFERENCES products(id),
  points_spent INTEGER NOT NULL,  -- Historical record of points at redemption time
  redemption_code VARCHAR(50),  -- For digital products (auto-generated)
  delivery_status VARCHAR(50) DEFAULT 'pending',  -- "pending" | "confirmed" | "shipped" | "delivered"
  delivery_address TEXT,  -- For physical products
  delivery_notes TEXT,
  provider_notes TEXT,  -- Admin/provider notes
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX idx_user_redemptions ON user_redemptions(user_id);
CREATE INDEX idx_product_redemptions ON user_redemptions(product_id);
CREATE INDEX idx_delivery_status ON user_redemptions(delivery_status);
```

#### 5. **New: Admin Notifications Table** (In-app + Bot tracking)
```sql
CREATE TABLE admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  event_type VARCHAR(50),  -- "provider_submitted" | "provider_approved" | "product_created"
  related_provider_id UUID REFERENCES providers(id),
  related_user_id UUID REFERENCES users(id),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  bot_message_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX idx_admin_notifications ON admin_notifications(admin_user_id, is_read);
```

---

## 📡 BACKEND API SPECIFICATION

### 1. Provider Self-Onboarding Endpoints

#### `POST /api/providers/self-onboard`
**Auth**: JWT (any authenticated user with no pending/active provider)  
**Validation**: User must have valid `provider_invite_code` in payload

```json
// REQUEST
{
  "name": "Zen Yoga Studio",
  "category": "yoga",  // yoga|gym|nutrition|spa|therapy|running
  "description": "Premium yoga in Bole...",
  "location_text": "Bole, Addis Ababa",
  "lat": 9.0054,
  "lng": 38.7636,
  "price_range": "ETB 500-2000",
  "services": [
    { "name": "Morning Vinyasa", "price": 800, "duration": "60 min" },
    { "name": "Private Session", "price": 2000, "duration": "90 min" }
  ],
  "provider_invite_code": "INVITE-ABC123XYZ",
  "cover_photo_url": "https://...",
  "photos": ["https://photo1.jpg", "https://photo2.jpg"]
}

// RESPONSE 201
{
  "provider_id": "uuid",
  "name": "Zen Yoga Studio",
  "status": "pending_approval",
  "message": "Application submitted. Admin will review within 24 hours."
}

// RESPONSE 422 - Invalid invite code
{
  "detail": "Invalid or expired invite code"
}

// RESPONSE 409 - User already has a provider account
{
  "detail": "User already has an active provider account"
}
```

**Backend Logic**:
- Validate invite code exists, is active, and not expired
- Create Provider record with `status="pending_approval"`, `owner_user_id`, `submitted_at=now()`
- Mark invite as `used_at=now()`, `is_active=false`
- Do NOT set `is_provider=true` yet (wait for admin approval)
- Create in-app notification for all super admins
- Return 201 with provider_id

---

#### `POST /api/providers/invite-code/generate` (Admin only)
**Auth**: `Depends(get_super_admin)`

```json
// REQUEST
{
  "expires_in_days": 30  // optional, default 30
}

// RESPONSE 201
{
  "invite_code": "INVITE-ABC123XYZ",
  "expires_at": "2026-07-09T12:00:00Z",
  "created_at": "2026-06-09T12:00:00Z"
}
```

---

#### `GET /api/providers/me` (Provider only)
**Auth**: JWT (user with `is_provider=true`)

```json
// RESPONSE 200
{
  "id": "uuid",
  "name": "Zen Yoga Studio",
  "category": "yoga",
  "status": "active",
  "description": "...",
  "location_text": "Bole, Addis Ababa",
  "lat": 9.0054,
  "lng": 38.7636,
  "services": [...],
  "theme_primary_color": "#10B981",
  "theme_accent_color": "#F59E0B",
  "dashboard_stats": {
    "total_members": 45,
    "new_members_today": 3,
    "total_products": 5,
    "active_products": 3
  }
}
```

---

#### `PATCH /api/providers/me` (Provider only)
**Auth**: JWT (user with `is_provider=true`)  
Update own provider profile (all fields optional, except cannot change status)

```json
// REQUEST (any fields optional)
{
  "description": "Updated description",
  "price_range": "ETB 800-3000",
  "theme_primary_color": "#34D399",
  "services": [...]
}

// RESPONSE 200 - Same as GET /api/providers/me
```

---

### 2. Provider Admin Management Endpoints

#### `GET /api/admin/providers/pending` (Admin only)
**Auth**: `Depends(get_super_admin)`

```json
// RESPONSE 200
{
  "pending_providers": [
    {
      "id": "uuid",
      "name": "Zen Yoga",
      "category": "yoga",
      "status": "pending_approval",
      "owner_user_id": "uuid",
      "owner_name": "Abebe Tadesse",
      "owner_telegram_handle": "@abebe_fitness",
      "submitted_at": "2026-06-08T10:00:00Z",
      "description": "...",
      "location_text": "Bole"
    }
  ],
  "count": 3
}
```

---

#### `POST /api/admin/providers/:provider_id/approve` (Admin only)
**Auth**: `Depends(get_super_admin)`

```json
// REQUEST
{
  "notes": "Verified location. Looks good."  // optional
}

// RESPONSE 200
{
  "provider_id": "uuid",
  "status": "active",
  "owner_user_id": "uuid",
  "message": "Provider approved. Auto-community created."
}

// BACKEND LOGIC
// 1. Update providers.status = "active"
// 2. Set owner user is_provider = true
// 3. Auto-create community linked to provider
// 4. Create admin_notification for approval
// 5. Send Telegram message to provider user via bot
// 6. Return success
```

---

#### `POST /api/admin/providers/:provider_id/reject` (Admin only)
**Auth**: `Depends(get_super_admin)`

```json
// REQUEST
{
  "rejection_reason": "Unable to verify location. Please resubmit with proof."
}

// RESPONSE 200
{
  "provider_id": "uuid",
  "status": "rejected",
  "message": "Provider rejected. Owner notified."
}

// BACKEND LOGIC
// 1. Update providers.status = "rejected"
// 2. Do NOT set is_provider = true
// 3. Create admin_notification
// 4. Send rejection message via Telegram bot to provider user
// 5. Keep provider record for audit trail
```

---

#### `PUT /api/admin/providers/:provider_id/promote-user` (Admin only)
**Auth**: `Depends(get_super_admin)`  
Convert any existing user directly to provider without needing invite code.

```json
// REQUEST
{
  "user_telegram_id": 123456789,
  "provider_data": {
    "name": "FitEthiopia Gym",
    "category": "gym",
    "location_text": "Kazanchis, Addis Ababa",
    "lat": 9.0100,
    "lng": 38.7700,
    "services": [...]
  }
}

// RESPONSE 201
{
  "provider_id": "uuid",
  "status": "active",
  "user_id": "uuid",
  "message": "User promoted to provider directly."
}

// BACKEND LOGIC
// 1. Fetch user by telegram_id
// 2. Check user doesn't already have active provider
// 3. Create provider with status="active" (skip pending)
// 4. Set user.is_provider = true
// 5. Auto-create community
// 6. Send notification to user
```

---

### 3. Products Store Endpoints

#### `GET /api/products` (Public, JWT optional)
Browse all available products with search, filters, recommendations

**Query Params**:
- `search` (optional): Search by product name
- `provider_id` (optional): Filter by provider
- `type` (optional): "digital" | "physical"
- `price_min` (optional): in cents
- `price_max` (optional): in cents
- `in_stock_only` (optional): true | false
- `sort_by` (optional): "newest" | "popular" | "price_asc" | "price_desc"
- `page` (default: 1)
- `per_page` (default: 12)

```json
// RESPONSE 200
{
  "products": [
    {
      "id": "uuid",
      "name": "Private Yoga Session",
      "description": "90-minute personalized yoga session",
      "type": "digital",
      "price_etb": 2000,
      "image_url": "https://...",
      "provider_id": "uuid",
      "provider_name": "Zen Yoga Studio",
      "max_redemptions_per_user": 1,
      "expiry_date": "2026-12-31T23:59:59Z",
      "is_in_stock": true,
      "is_recommended": true  // Based on user's interest_category
    }
  ],
  "total": 47,
  "page": 1,
  "per_page": 12
}
```

**Recommendation Logic**:
- If authenticated, mark products from providers in user's `interest_category` as `is_recommended: true`
- Otherwise, mark popular/highly-redeemed products as recommended

---

#### `GET /api/products/:id` (Public, JWT optional)
Full product detail

```json
// RESPONSE 200
{
  "id": "uuid",
  "name": "Private Yoga Session",
  "description": "90-minute personalized yoga session at Zen Studio",
  "type": "digital",
  "price_etb": 2000,
  "image_url": "https://...",
  "images": ["https://...", "https://..."],
  "provider": {
    "id": "uuid",
    "name": "Zen Yoga Studio",
    "category": "yoga",
    "location_text": "Bole, Addis Ababa",
    "rating": 4.8
  },
  "quantity_in_stock": 15,
  "max_redemptions_per_user": 1,
  "expiry_date": "2026-12-31T23:59:59Z",
  "provider_instructions": "Valid for 90 days from purchase. Book online or call studio.",
  "shipping_required": false,
  "redemption_count": 8
}
```

---

#### `POST /api/products/:id/redeem` (JWT required)
Redeem a product using Legacy Points

```json
// REQUEST
{
  "delivery_address": "Addis Ababa, Bole, Building 45, Apt 3A"  // Required if product.shipping_required=true
}

// RESPONSE 201
{
  "redemption_id": "uuid",
  "redemption_code": "YOGA-ABC123",  // For digital products
  "delivery_status": "pending",
  "message": "Product redeemed! Check redemption details below.",
  "details": {
    "product_name": "Private Yoga Session",
    "points_spent": 500,
    "new_balance": 450,
    "provider_instructions": "Valid for 90 days. Book at Zen Studio.",
    "delivery_address": "Addis Ababa, Bole, Building 45, Apt 3A"  // if physical
  }
}

// RESPONSE 409 - Already redeemed max times
{
  "detail": "You have already redeemed this product maximum times (limit: 1)"
}

// RESPONSE 422 - Insufficient points
{
  "detail": "Insufficient Legacy Points. You have 450 points; need 500."
}

// RESPONSE 422 - Product expired or out of stock
{
  "detail": "Product is no longer available."
}

// BACKEND LOGIC
// 1. Fetch product, validate not expired, in_stock > 0
// 2. Fetch user, check points_balance >= price_etb
// 3. Check max_redemptions_per_user not exceeded
// 4. Deduct points: user.points_balance -= product.price_etb
// 5. If type="digital": generate code using template (e.g., "YOGA-{RANDOM_6CHARS}")
// 6. Create user_redemption record
// 7. Decrement product.quantity_in_stock
// 8. If product.quantity_in_stock == 0: set is_active=false
// 9. Notify provider via admin notification + bot
// 10. Return redemption details
```

---

#### `GET /api/users/me/redemptions` (JWT required)
User's redemption history

```json
// RESPONSE 200
{
  "redemptions": [
    {
      "id": "uuid",
      "product_name": "Private Yoga Session",
      "product_image_url": "https://...",
      "provider_name": "Zen Yoga Studio",
      "points_spent": 500,
      "redeemed_at": "2026-06-08T10:00:00Z",
      "type": "digital",
      "delivery_status": "confirmed",  // pending | confirmed | shipped | delivered
      "redemption_code": "YOGA-ABC123",
      "delivery_address": null,  // null if digital
      "provider_notes": null
    }
  ],
  "count": 3
}
```

---

#### `GET /api/admin/products` (Admin only)
List all products in the system

**Query Params**:
- `provider_id` (optional): Filter by provider
- `status` (optional): "active" | "inactive"
- `search` (optional): Search by product name
- `page`, `per_page`

```json
// RESPONSE 200
{
  "products": [
    {
      "id": "uuid",
      "name": "Private Session",
      "provider_id": "uuid",
      "provider_name": "Zen Yoga",
      "type": "digital",
      "price_etb": 2000,
      "quantity_in_stock": 10,
      "redemption_count": 5,
      "is_active": true,
      "created_at": "2026-06-01T00:00:00Z"
    }
  ],
  "total": 42
}
```

---

#### `POST /api/admin/products/:product_id/update-stock` (Admin only)
Adjust product inventory

```json
// REQUEST
{
  "quantity": 25  // Set to this quantity
}

// RESPONSE 200
{
  "product_id": "uuid",
  "quantity_in_stock": 25,
  "updated": true
}
```

---

#### `POST /api/admin/redemptions/:redemption_id/update-status` (Admin only)
Update delivery status of a redemption

```json
// REQUEST
{
  "status": "shipped",  // pending | confirmed | shipped | delivered
  "notes": "Shipped via DHL. Tracking: 123ABC"
}

// RESPONSE 200
{
  "redemption_id": "uuid",
  "delivery_status": "shipped",
  "provider_notes": "Shipped via DHL. Tracking: 123ABC"
}
```

---

### 4. Admin Dashboard Endpoints (Existing + New)

Existing endpoints already implemented:
- `GET /api/admin/analytics` — Use for dashboard
- `GET /api/admin/users` — Use for user management
- `GET /api/admin/providers` → Extend to include all providers with status filter
- `PUT /api/admin/providers/:id` — Update provider (existing)
- `DELETE /api/admin/providers/:id` — Delete provider (existing)

**New additions**:
- `GET /api/admin/notifications` (NEW) — Admin notifications feed

```json
// GET /api/admin/notifications?limit=20&offset=0
{
  "notifications": [
    {
      "id": "uuid",
      "event_type": "provider_submitted",
      "message": "Zen Yoga Studio submitted onboarding application",
      "related_provider_id": "uuid",
      "related_user_id": "uuid",
      "created_at": "2026-06-08T14:30:00Z",
      "is_read": false
    }
  ],
  "unread_count": 5
}
```

---

## 🎨 FRONTEND SPECIFICATION

### Design System (Existing + New Pages)

**Use existing CSS variables from `index.css`:**
```css
--accent: #F5A623 (Gold)
--secondary: #10B981 (Green)
--bg-primary: #0A0A0F (Dark)
--bg-card: #18181F
--text-primary: #F5F5F7
--text-secondary: #9CA3AF
--radius-md: 12px
--radius-lg: 16px
--shadow-md: 0 4px 16px rgba(0,0,0,0.5)
```

**Responsive breakpoints** (Mobile-first):
- Mobile: 320px–430px (Telegram Mini App)
- Tablet: 430px–768px (future)
- Desktop: 768px+ (future)

---

### 1. Admin Dashboard Pages

#### **Route**: `/admin`
Protected route: Only accessible if `user.is_super_admin === true`

**Admin Shell Structure**:
```
/admin
├── Layout: Header (minimal "Admin Dashboard"), Tab Navigation
│   └── Tabs: [Analytics] [Providers] [Products] [Reports]
├── Header shows: Logged in as: {admin_name} | {points} | Logout
└── Bottom Nav: Hidden for admin (full width)
```

---

#### **Tab 1: Analytics** (`/admin/analytics`)
Display platform-wide metrics from `GET /api/admin/analytics`

**Components**:
```
┌─────────────────────────────────────┐
│        ANALYTICS DASHBOARD          │
├─────────────────────────────────────┤
│                                     │
│  [Total Users: 156]  [Active 7d: 89] │
│  [Providers: 8]      [Communities: 12]│
│  [Bookings: 47]      [Revenue: ETB 45.6K] │
│                                     │
│  ─── Top Categories ────           │
│  • Yoga: 48                         │
│  • Gym: 35                          │
│  • Nutrition: 12                    │
│                                     │
│  [Refresh] [Export CSV]             │
└─────────────────────────────────────┘
```

**Features**:
- Real-time cards with icon badges
- Top categories as mini bar chart or list
- Refresh button to fetch latest
- Export button → CSV download

**Responsive**: Full-width cards stack on mobile

---

#### **Tab 2: Providers** (`/admin/providers`)
Manage provider applications and existing providers

**Sub-tabs**:
- **Pending Applications** (red badge with count)
- **Active Providers** (green)
- **Rejected** (gray)

**Pending Applications View**:
```
┌─────────────────────────────────────┐
│  PENDING PROVIDER APPLICATIONS (3)  │
├─────────────────────────────────────┤
│                                     │
│  [Card: Zen Yoga Studio]            │
│  Category: Yoga                     │
│  Owner: Abebe T. (@abebe_fit)       │
│  Location: Bole, Addis Ababa        │
│  Submitted: 2 hours ago             │
│  [View] [Approve] [Reject]          │
│                                     │
│  [Card: FitEthiopia Gym]            │
│  Category: Gym                      │
│  Owner: Marta S. (@marta_gym)       │
│  Location: Kazanchis                │
│  Submitted: 5 hours ago             │
│  [View] [Approve] [Reject]          │
│                                     │
└─────────────────────────────────────┘
```

**Detail View** (Modal on [View] click):
```
┌──────────────────────────────────┐
│ ZEN YOGA STUDIO - Application    │
├──────────────────────────────────┤
│ Owner: Abebe Tadesse             │
│ Telegram: @abebe_fitness         │
│ Category: Yoga                   │
│ Location: Bole, Addis Ababa      │
│ Lat: 9.0054, Lng: 38.7636        │
│ Price Range: ETB 500-2000        │
│ Description: Premium yoga in...  │
│                                  │
│ Services:                        │
│ • Morning Vinyasa (ETB 800, 60m) │
│ • Private Session (ETB 2000, 90m)│
│                                  │
│ Cover Photo: [image]             │
│                                  │
│ ─────────────────────────────────│
│ [Approve]  [Reject]  [Back]      │
└──────────────────────────────────┘
```

**Active Providers View**:
```
┌─────────────────────────────────────┐
│       ACTIVE PROVIDERS (8)          │
├─────────────────────────────────────┤
│ [Search] [Add New Provider]          │
│                                     │
│ [List View]                         │
│ • Zen Yoga Studio | 45 members      │
│   Category: Yoga | Bole             │
│   [Edit] [Manage Products] [Delete] │
│                                     │
│ • FitEthiopia Gym | 62 members      │
│   Category: Gym | Kazanchis         │
│   [Edit] [Manage Products] [Delete] │
│                                     │
└─────────────────────────────────────┘
```

**Add Provider Modal** (Direct promotion):
```
┌────────────────────────────────────┐
│  ADD PROVIDER DIRECTLY              │
├────────────────────────────────────┤
│ User Telegram ID:  [________]       │
│ Provider Name:     [________]       │
│ Category:          [Dropdown]       │
│ Location:          [________]       │
│ Lat/Lng:           [__] [__]        │
│ Services:          [Add Service]    │
│ ─────────────────────────────────── │
│ [Create] [Cancel]                   │
└────────────────────────────────────┘
```

**Responsive**: Cards stack on mobile, action buttons wrap

---

#### **Tab 3: Products** (`/admin/products`)
Manage all products across all providers

**View**:
```
┌─────────────────────────────────────┐
│        PRODUCTS INVENTORY           │
├─────────────────────────────────────┤
│ [Search: ____] [Filter ▼] [Sort ▼] │
│                                     │
│ Provider: [All ▼]                   │
│ Status:   [Active ▼]                │
│                                     │
│ [Table/Cards]                       │
│                                     │
│ Name | Provider | Type | Stock | .. │
│ Private Yoga | Zen Yoga | Digital | 10│
│   [Edit Stock] [Details] [Delete]   │
│                                     │
│ Private PT | FitEthiopia | Physical| 5 │
│   [Edit Stock] [Details] [Delete]   │
│                                     │
└─────────────────────────────────────┘
```

**Stock Editor (Modal)**:
```
┌──────────────────────────────┐
│ ADJUST STOCK                 │
├──────────────────────────────┤
│ Product: Private Yoga Session│
│ Current Stock: 10            │
│ New Stock: [___]             │
│ ──────────────────────────── │
│ [Save]  [Cancel]             │
└──────────────────────────────┘
```

**Responsive**: Table → card list on mobile

---

#### **Tab 4: Reports** (`/admin/reports`)
Export and view detailed reports

```
┌─────────────────────────────────────┐
│          REPORTS & EXPORTS          │
├─────────────────────────────────────┤
│                                     │
│ [Export Users CSV]                  │
│   All users with activity data      │
│                                     │
│ [Export Providers CSV]              │
│   Provider list with metrics        │
│                                     │
│ [Export Bookings CSV]               │
│   All bookings with payments        │
│                                     │
│ [Export Redemptions CSV]            │
│   Product redemption history        │
│                                     │
│ [Generate PDF Report]               │
│   Monthly platform summary          │
│                                     │
└─────────────────────────────────────┘
```

---

### 2. Provider Onboarding Pages

#### **Route**: `/provider-onboard`
Multi-step form for provider self-signup

**Step 1: Invite Code**
```
┌─────────────────────────────────────┐
│  BECOME A WELLNESS PROVIDER         │
├─────────────────────────────────────┤
│ Enter your invitation code to start │
│                                     │
│ Invite Code: [INVITE-________]      │
│                                     │
│ ─────────────────────────────────── │
│ [Next] [Cancel]                     │
│                                     │
│ Don't have a code?                  │
│ Contact: admin@wellcircle.et        │
└─────────────────────────────────────┘
```

**Step 2: Basic Info**
```
┌─────────────────────────────────────┐
│  PROVIDER DETAILS (1/3)             │
├─────────────────────────────────────┤
│                                     │
│ Studio/Business Name: [_________]   │
│ Category:        [Yoga ▼]           │
│ Description:     [Text area___]     │
│ Location:        [Bole, ________]   │
│ Latitude:        [9.0054___]        │
│ Longitude:       [38.7636___]       │
│                                     │
│ ─────────────────────────────────── │
│ [< Back] [Next >]                   │
└─────────────────────────────────────┘
```

**Step 3: Services & Photos**
```
┌─────────────────────────────────────┐
│  SERVICES & PRICING (2/3)           │
├─────────────────────────────────────┤
│ Add services your studio offers     │
│                                     │
│ Service Name: [Morning Vinyasa]     │
│ Price (ETB):  [800]                 │
│ Duration:     [60 min]              │
│ [Add Service]                       │
│                                     │
│ [+ Morning Vinyasa | ETB 800 | 60min]│
│ [+ Private Session | ETB 2000 | 90m]│
│                                     │
│ Cover Photo:  [Upload ▶]            │
│ Additional:   [Upload ▶]            │
│                                     │
│ Price Range:  [ETB 500-2000 ▼]     │
│                                     │
│ ─────────────────────────────────── │
│ [< Back] [Next >]                   │
└─────────────────────────────────────┘
```

**Step 4: Review & Submit**
```
┌─────────────────────────────────────┐
│  REVIEW APPLICATION (3/3)           │
├─────────────────────────────────────┤
│                                     │
│ Studio: Zen Yoga Studio             │
│ Category: Yoga | Bole               │
│ Services: 2 (Vinyasa, Private)      │
│ Price Range: ETB 500-2000           │
│                                     │
│ ✓ All info verified                 │
│                                     │
│ By clicking Submit, you agree to... │
│ [✓] Terms of Service               │
│ [✓] Community Guidelines           │
│                                     │
│ ─────────────────────────────────── │
│ [< Back] [Submit Application]       │
└─────────────────────────────────────┘
```

**Success Screen**:
```
┌─────────────────────────────────────┐
│          APPLICATION SUBMITTED      │
├─────────────────────────────────────┤
│                                     │
│ ✓ Your application is pending       │
│   review by our admin team.         │
│                                     │
│ Expected timeline: 24-48 hours      │
│                                     │
│ You'll be notified when approved.   │
│ Check this app or Telegram for      │
│ updates.                            │
│                                     │
│ [Return to Home]                    │
└─────────────────────────────────────┘
```

---

### 3. Products Store Pages

#### **Route**: `/products`
Browse & search redeemable products

```
┌─────────────────────────────────────┐
│     LEGACY POINTS STORE             │
├─────────────────────────────────────┤
│ Your Balance: 450 🌿 Points         │
│                                     │
│ [Search products...___] [Filter ▼] │
│                                     │
│ Category: [All ▼]  Type: [All ▼]   │
│ Price: [500-3000 ▼]                 │
│ [In Stock ▼]                        │
│                                     │
│ ─── RECOMMENDED FOR YOU ────        │
│                                     │
│ [Product Card]                      │
│ [Image]  Private Yoga Session       │
│ Zen Yoga Studio • 2000 pts          │
│ Type: Digital | In Stock: ✓         │
│ ★ 4.8 (45 reviews)                  │
│ [View Details]                      │
│                                     │
│ [Product Card]                      │
│ [Image]  Nutrition Plan             │
│ Health & Wellness • 800 pts         │
│ Type: Physical | In Stock: ✓        │
│ [View Details]                      │
│                                     │
│ ──── MORE PRODUCTS ────             │
│ [Prod 3] [Prod 4] [Prod 5]          │
│                                     │
└─────────────────────────────────────┘
```

**Responsive**: Product cards 2-column on mobile, 3-4 on tablet

---

#### **Route**: `/products/:id`
Product detail & redemption

```
┌─────────────────────────────────────┐
│      PRIVATE YOGA SESSION           │
├─────────────────────────────────────┤
│                                     │
│ [Image Carousel]                    │
│ ◀ [Main Photo] ▶                    │
│                                     │
│ Zen Yoga Studio                     │
│ ★ 4.8 (45) • Bole, Addis Ababa    │
│                                     │
│ PRICE: 2000 Legacy Points 🌿        │
│                                     │
│ Description:                        │
│ 90-minute personalized yoga session │
│ with certified instructor. One-on- │
│ one attention.                      │
│                                     │
│ Type: Digital Voucher               │
│ Valid Until: Dec 31, 2026           │
│ Limit: 1 per user                   │
│                                     │
│ Instructions:                       │
│ You'll receive a voucher code via   │
│ email. Valid for 90 days from       │
│ purchase. Book via studio website.  │
│                                     │
│ ─────────────────────────────────── │
│ [✓ Redeem for 2000 Points]          │
│ [View Studio Profile]               │
│ [Share] [Save]                      │
│                                     │
│ [Back]                              │
└─────────────────────────────────────┘
```

---

#### **Route**: `/products/:id/redeem`
Redemption confirmation flow

**For Digital Products**:
```
┌─────────────────────────────────────┐
│    CONFIRM REDEMPTION               │
├─────────────────────────────────────┤
│                                     │
│ Product: Private Yoga Session       │
│ Cost: 2000 Points 🌿                │
│ Your Balance: 450 Points 🌿         │
│                                     │
│ ERROR: Insufficient Points          │
│ You need 2000 but only have 450.    │
│                                     │
│ [Earn More Points] [Browse More]    │
└─────────────────────────────────────┘
```

**For Physical Products** (requires address):
```
┌─────────────────────────────────────┐
│    ENTER DELIVERY ADDRESS           │
├─────────────────────────────────────┤
│                                     │
│ Product: Wellness Kit               │
│ Cost: 1500 Points 🌿                │
│ Your Balance: 3000 Points 🌿        │
│                                     │
│ Full Name:       [Meron Tadesse]    │
│ Phone:           [0911234567___]    │
│ Address Line 1:  [Building 45___]   │
│ Neighborhood:    [Bole ▼]           │
│ City:            [Addis Ababa ▼]    │
│                                     │
│ ─────────────────────────────────── │
│ [Cancel] [Confirm Redemption]       │
└─────────────────────────────────────┘
```

**Success**:
```
┌─────────────────────────────────────┐
│      ✓ REDEEMED SUCCESSFULLY        │
├─────────────────────────────────────┤
│                                     │
│ Your voucher code:                  │
│ ┌─────────────────────────────────┐ │
│ │ YOGA-ABC12345                   │ │
│ │ [Copy to Clipboard]             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ New Balance: 1000 Points 🌿         │
│                                     │
│ Provider Instructions:              │
│ Valid for 90 days. Book online or  │
│ visit Zen Yoga Studio in person.   │
│                                     │
│ Sent to: Telegram, In-App           │
│                                     │
│ [Browse More Products] [Home]       │
└─────────────────────────────────────┘
```

---

#### **Route**: `/users/me/redemptions`
User redemption history

```
┌─────────────────────────────────────┐
│     MY REDEMPTIONS                  │
├─────────────────────────────────────┤
│ [Filter: All | Pending | Delivered] │
│                                     │
│ Redemption #1: Private Yoga         │
│ Provider: Zen Yoga Studio           │
│ Points Spent: 500 🌿                │
│ Status: ✓ Confirmed                 │
│ Date: Jun 8, 2026 | 10:30 AM        │
│ Code: YOGA-ABC123                   │
│ [Details] [Share]                   │
│                                     │
│ Redemption #2: Nutrition Plan       │
│ Provider: Health & Wellness         │
│ Points Spent: 1200 🌿               │
│ Status: ⟳ Shipped                   │
│ Date: Jun 5, 2026 | 2:00 PM         │
│ Tracking: DHL 123ABC                │
│ [Details] [Track]                   │
│                                     │
│ Redemption #3: Gym Pass (pending)   │
│ Provider: FitEthiopia               │
│ Points Spent: 800 🌿                │
│ Status: ⏳ Pending Confirmation     │
│ Date: Jun 1, 2026 | 8:15 AM         │
│ [Details] [Cancel]                  │
│                                     │
└─────────────────────────────────────┘
```

---

### 4. Provider Dashboard Updates

Add new section to existing Provider Dashboard:

```
┌─────────────────────────────────────┐
│  PROVIDER DASHBOARD (Updated)       │
├─────────────────────────────────────┤
│                                     │
│ [Analytics Tab] [Products Tab]      │
│                                     │
│ ─── PRODUCTS MANAGEMENT ────        │
│ Total Products: 5                   │
│ Active: 3 | Inactive: 2             │
│                                     │
│ [+ Create Product]                  │
│                                     │
│ [Product Card]                      │
│ Private Yoga | Digital | 2000 pts   │
│ Stock: 10 | Redeemed: 5             │
│ [Edit] [Details] [Deactivate]       │
│                                     │
│ [Product Card]                      │
│ Wellness Kit | Physical | 1500 pts  │
│ Stock: 3 | Redeemed: 8              │
│ [Edit] [Details] [Deactivate]       │
│                                     │
│ ─── RECENT REDEMPTIONS ────         │
│ Meron Tadesse → YOGA-ABC123         │
│ Jun 8, 10:30 AM | Pending Confirm   │
│                                     │
│ Abel Tafese → WKT-XYZ789            │
│ Jun 7, 2:00 PM | Shipped            │
│                                     │
│ [View All Redemptions]              │
│                                     │
└─────────────────────────────────────┘
```

---

## 🤖 TELEGRAM BOT UPDATES

### New Commands

#### `/admin`
**Visibility**: Only shown to users with `is_super_admin=true` in user record

```
/admin - Access admin dashboard

Response to Admin:
📊 Admin Dashboard
https://wellcircle.app/admin

Use this link to:
• Approve/reject provider applications
• Manage products inventory
• View platform analytics
• Manage user roles
```

**Backend Logic**:
- Check if user.is_super_admin == true
- If yes: Send inline button with link to /admin
- If no: Send "You don't have permission" message

---

### Approval Notifications

When admin approves/rejects a provider via admin dashboard:

**On Approval**:
```
Telegram message to provider's Telegram ID:

✅ PROVIDER APPROVED

Your application for "Zen Yoga Studio" has been approved!

Your provider dashboard is now live. You can:
• Manage your community
• Create product listings
• View analytics and bookings

Start here: https://wellcircle.app/provider-dashboard

Welcome aboard! 🎉
```

**On Rejection**:
```
Telegram message to provider's Telegram ID:

❌ APPLICATION NOT APPROVED

Your application for "Zen Yoga Studio" requires revision.

Reason:
"Unable to verify location. Please resubmit with proof."

You can reapply by contacting: admin@wellcircle.et

We look forward to welcoming you soon! 💚
```

**Backend Implementation**:
- After provider approval/rejection, fetch provider owner's telegram_id
- Use Telegram bot API to send message:
  ```python
  # In backend after approval
  from app.services.telegram_auth import bot
  await bot.send_message(
    chat_id=provider_owner_telegram_id,
    text=approval_message,
    disable_web_page_preview=True
  )
  ```

---

## 🛡️ BREAKING CHANGES ANALYSIS

### What MUST NOT Break

1. **User Auth Flow**
   - ✅ JWT token generation (`/auth/telegram`)
   - ✅ Mini App shell and navigation
   - ✅ Existing user profile fields

2. **Provider Endpoints**
   - ✅ Existing `GET /api/providers`, `GET /api/providers/:id`
   - ✅ Existing `GET /api/providers/:id/stats` (provider dashboard)
   - ✅ Keep all existing admin provider endpoints functional

3. **Community & Booking Flows**
   - ✅ Existing community join/leave/checkin
   - ✅ Existing booking and payment endpoints
   - ✅ Existing feed generation

4. **Frontend Routes**
   - ✅ All existing page routes continue to work
   - ✅ Bottom navigation remains accessible
   - ✅ Provider dashboard remains at `/provider-dashboard`

### What's NEW (non-breaking)

- ✅ New provider status workflow (migration: existing providers get `status="active"` automatically)
- ✅ New tables: products, redemptions, invites, notifications (no schema changes to existing tables)
- ✅ New endpoints: `/products/*`, `/admin/providers/pending`, `/admin/redemptions/*`
- ✅ New admin routes: `/admin`, `/provider-onboard`
- ✅ New bot command: `/admin`

### Migration Strategy

**Day 1 - Database**:
1. Run migrations to add new columns/tables (non-destructive)
2. Backfill existing providers: `UPDATE providers SET status='active' WHERE status IS NULL`
3. No downtime required

**Day 2 - Backend Deployment**:
1. Deploy new endpoints alongside existing ones
2. Existing endpoints continue working
3. Feature-flag new routes (only accessible if user has new fields set)

**Day 3 - Frontend Deployment**:
1. Add new routes to React Router
2. Existing routes unaffected
3. Admin only sees `/admin` if `is_super_admin=true`

**Day 4 - Bot Deployment**:
1. Add `/admin` command handler
2. Enable approval notifications
3. Existing bot commands unaffected

---

## 📊 IMPLEMENTATION ROADMAP (Priority Order)

### Phase 1: Backend Foundation (Days 1-3)
- [ ] Create database migrations (models, tables)
- [ ] Implement provider onboarding endpoints
- [ ] Implement admin provider management endpoints
- [ ] Implement products CRUD endpoints
- [ ] Implement redemption endpoints
- [ ] Add Telegram bot integration for notifications

### Phase 2: Frontend Admin (Days 4-5)
- [ ] Create `/admin` route with authentication guard
- [ ] Build analytics dashboard tab
- [ ] Build providers management tab (pending + active)
- [ ] Build products inventory tab
- [ ] Build reports tab

### Phase 3: Frontend Provider Onboarding (Days 6-7)
- [ ] Create `/provider-onboard` multi-step form
- [ ] Implement invite code validation
- [ ] Build provider detail forms
- [ ] Add success confirmation screen

### Phase 4: Frontend Products Store (Days 8-9)
- [ ] Create `/products` browse page with search/filters
- [ ] Create `/products/:id` detail page
- [ ] Implement redemption flow
- [ ] Build `/users/me/redemptions` history page
- [ ] Update provider dashboard with products section

### Phase 5: Testing & Polish (Day 10)
- [ ] Integration testing (admin workflow)
- [ ] Telegram bot testing
- [ ] Mobile responsiveness QA
- [ ] Performance testing

---

## 🧪 TESTING REQUIREMENTS

### Backend Tests
- [ ] Invite code generation & validation
- [ ] Provider self-onboarding workflow
- [ ] Admin approval/rejection flow
- [ ] Product creation, filtering, search
- [ ] Redemption logic (points deduction, inventory management)
- [ ] Permission checks (admin-only endpoints)

### Frontend Tests
- [ ] Admin dashboard accessibility (super_admin only)
- [ ] Provider onboarding form validation
- [ ] Product search & filtering
- [ ] Redemption flow (digital + physical)
- [ ] Responsive design on 320px–430px

### Integration Tests
- [ ] End-to-end provider signup → admin approval → provider dashboard
- [ ] End-to-end product creation → user browsing → redemption
- [ ] Telegram bot notifications

---

## 📝 NOTES & CONVENTIONS

### API Responses
- All timestamps in ISO 8601 UTC: `2026-06-09T12:00:00Z`
- All monetary amounts in cents ETB (stored as integers, display divided by 100)
- All UUIDs as strings in responses
- Standard error format:
  ```json
  {
    "detail": "User-friendly error message"
  }
  ```

### Database
- Use PostgreSQL/Supabase exclusively
- All `created_at`/`updated_at` timestamps in UTC
- Soft deletes not used (physical deletes with cascade)
- Foreign key constraints enforced

### Frontend
- Use existing CSS variables for all colors
- Mobile-first: design for 320px first, enhance for larger screens
- Responsive images: use `max-width: 100%`
- Accessibility: semantic HTML, proper ARIA labels
- Performance: lazy-load images, paginate lists

### Git/Code
- No credentials in code (use env vars)
- Commit messages: `feat: [Feature]`, `fix: [Bug]`, `refactor: [Code]`
- Create feature branches: `feature/provider-onboarding`, `feature/products-store`

---

## ✅ ACCEPTANCE CRITERIA

### Success Metrics
- [ ] All existing features work without regression
- [ ] Provider can self-onboard with invite code
- [ ] Admin can approve/reject providers from dashboard
- [ ] Users can browse, search, and redeem products
- [ ] Providers receive Telegram notifications
- [ ] Mobile responsive on 320–430px
- [ ] No breaking changes to existing API contracts
- [ ] Telegram bot `/admin` command works for super admins

---

**Ready for AI Coding Agent Implementation** ✨

Copy this prompt to your coding agent and they'll have all the context needed to build the full-stack feature set without breaking existing functionality.

