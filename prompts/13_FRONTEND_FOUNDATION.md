# Prompt 13 — Frontend Foundation (Design System, Auth, i18n, Layouts)

## Context
The entire backend API is complete. Now build the frontend foundation that all feature pages will use.

## Objective
Create the design system (reusable components), Google OAuth integration, i18n setup with Sinhala/English/Tamil, navigation shells for each role, and the API client layer.

## Design Requirements
- **Mobile-first**: All components designed for 360px+ width. Desktop is responsive enhancement.
- **Colors**: Green (primary) and Gold (accent). NO brown anywhere. Neutral slate for backgrounds.
- **Typography**: Noto Sans Sinhala for Sinhala text, Inter for English. Ensure Sinhala renders correctly.
- **Touch targets**: Minimum 44x44px for all interactive elements.
- **Loading states**: Skeleton loaders, not spinners, for all data-heavy views.
- **Offline indicators**: Show connection status. Queue actions when offline.

## Instructions

### 1. Design System Components (src/components/ui/)

Build these reusable components using Tailwind CSS. Each component must be a separate file.

**Button.tsx**: 
- Variants: primary (green), secondary (outline), accent (gold), danger (red), ghost
- Sizes: sm, md, lg
- States: loading (with spinner), disabled
- Full-width option for mobile

**Input.tsx**: Text input with label, error message, helper text, icons
**TextArea.tsx**: Multi-line input
**Select.tsx**: Dropdown with search support
**Card.tsx**: Content card with optional header, footer, image
**Badge.tsx**: Status badges (color-coded by status)
**Modal.tsx**: Bottom sheet on mobile, centered modal on desktop
**Toast.tsx**: Toast notifications (success, error, warning, info)
**Skeleton.tsx**: Skeleton loader component
**Avatar.tsx**: User avatar with fallback initials
**EmptyState.tsx**: Empty state illustration with message and CTA
**Tabs.tsx**: Tab navigation component
**BottomNav.tsx**: Mobile bottom navigation bar
**TopBar.tsx**: App header with back button, title, actions
**SearchBar.tsx**: Search input with debounce
**ListItem.tsx**: List item with avatar, title, subtitle, trailing content
**StatusBadge.tsx**: Listing/match status with localized labels and colors:
  - planned/open: blue
  - ready: green
  - matched/reviewing: gold
  - confirmed: green (darker)
  - fulfilled: green with checkmark
  - cancelled/expired: gray
  - disputed: red
**PriceTag.tsx**: Price display in LKR with formatting (e.g., "Rs. 350/kg")
**QuantityDisplay.tsx**: Quantity with unit (e.g., "2,500 kg")
**DateRange.tsx**: Date range display component
**LanguageSwitcher.tsx**: Language toggle (SI / EN / TA) — persistent to localStorage + user preference API

### 2. API Client (src/lib/api.ts)

```typescript
// Typed API client with auth token management

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

class ApiClient {
  private accessToken: string | null = null;
  
  setToken(token: string) { this.accessToken = token; }
  clearToken() { this.accessToken = null; }
  
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include', // for refresh token cookie
    });
    
    if (response.status === 401) {
      // Try refresh
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry original request
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retryResponse = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
        if (!retryResponse.ok) throw new ApiError(retryResponse);
        return retryResponse.json();
      }
      // Refresh failed, redirect to login
      window.location.href = '/auth/login';
      throw new Error('Session expired');
    }
    
    if (!response.ok) throw new ApiError(response);
    return response.json();
  }
  
  private async refreshToken(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        this.accessToken = data.access_token;
        return true;
      }
      return false;
    } catch { return false; }
  }
  
  // Typed method shortcuts
  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, body?: any) { return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) }); }
  put<T>(path: string, body?: any) { return this.request<T>(path, { method: 'PUT', body: JSON.stringify(body) }); }
  patch<T>(path: string, body?: any) { return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }); }
  delete<T>(path: string) { return this.request<T>(path, { method: 'DELETE' }); }
  
  async upload<T>(path: string, formData: FormData) {
    // Special handler for file uploads (no Content-Type header)
  }
}

export const api = new ApiClient();
```

### 3. Auth Context (src/lib/auth.tsx)

React context provider for auth state:
```typescript
// AuthProvider wraps the app
// Provides: user, isAuthenticated, isLoading, login(), logout(), updateUser()
// On mount: try refresh token to restore session
// On login success: store access token in memory, user in state
// On logout: clear tokens, redirect to login
```

### 4. Google OAuth Flow (src/app/[locale]/auth/login/page.tsx)

Login page:
- GoviHub logo (green/gold)
- Welcome message in current locale
- "Sign in with Google" button (Google's branded button guidelines)
- On click: redirect to Google OAuth consent URL
- Google callback URL: `/api/auth/callback`

**src/app/api/auth/callback/route.ts** (Next.js API route):
- Receives Google auth code from redirect
- Exchanges with backend `POST /api/v1/auth/google`
- Sets access token in memory (via redirect with token in URL fragment or PostMessage)
- Redirects to appropriate dashboard based on role (or to /register if new user)

**Registration page** (src/app/[locale]/auth/register/page.tsx):
- Role selection: Farmer / Buyer / Supplier (large cards with icons and descriptions)
- Basic profile fields based on selected role
- District selection (dropdown with all 25 Sri Lankan districts)
- Language preference
- Submit → `POST /api/v1/users/complete-registration`
- Redirect to role-specific dashboard

### 5. Navigation Shells

**Farmer Layout** (src/app/[locale]/farmer/layout.tsx):
- Bottom navigation: Home, Listings, Matches, Diagnosis, More
- Top bar: GoviHub logo, notification bell (with unread count), language switcher
- Sidebar on desktop with full navigation

**Buyer Layout** (src/app/[locale]/buyer/layout.tsx):
- Bottom navigation: Home, Demands, Matches, Market, More
- Top bar: similar to farmer

**Supplier Layout** (src/app/[locale]/supplier/layout.tsx):
- Bottom navigation: Home, Listings, Inquiries, More

**Admin Layout** (src/app/[locale]/admin/layout.tsx):
- Desktop-optimized sidebar navigation
- No bottom nav (admin is desktop-first)

### 6. i18n Translation Keys (src/messages/)

Flesh out `en.json` and `si.json` with all common UI strings:

```json
// en.json (structure — fill in all keys)
{
  "common": {
    "appName": "GoviHub",
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "search": "Search",
    "filter": "Filter",
    "noResults": "No results found",
    "error": "Something went wrong",
    "retry": "Try again",
    "back": "Back",
    "next": "Next",
    "submit": "Submit",
    "viewAll": "View All",
    "lkr": "Rs."
  },
  "auth": {
    "signIn": "Sign in with Google",
    "signOut": "Sign Out",
    "welcome": "Welcome to GoviHub",
    "tagline": "Sri Lanka's Smart Farming Marketplace",
    "selectRole": "Choose your role",
    "farmer": "Farmer",
    "buyer": "Buyer",
    "supplier": "Supplier",
    "farmerDesc": "Sell your harvest directly to buyers",
    "buyerDesc": "Source fresh produce from local farmers",
    "supplierDesc": "Provide farming inputs and services"
  },
  "nav": {
    "home": "Home",
    "listings": "My Listings",
    "matches": "Matches",
    "diagnosis": "Crop Doctor",
    "advisory": "Ask Expert",
    "marketplace": "Market",
    "demands": "My Demands",
    "notifications": "Notifications",
    "profile": "Profile",
    "settings": "Settings"
  },
  "farmer": {
    "dashboard": { ... },
    "harvest": { ... },
    "diagnosis": { ... }
  },
  "buyer": { ... },
  "supplier": { ... },
  "status": {
    "planned": "Planned",
    "ready": "Ready",
    "open": "Open",
    "matched": "Matched",
    "reviewing": "Reviewing",
    "confirmed": "Confirmed",
    "fulfilled": "Fulfilled",
    "cancelled": "Cancelled",
    "disputed": "Disputed",
    "expired": "Expired"
  }
}
```

For `si.json`, provide accurate Sinhala translations. Key translations that MUST be correct:
- GoviHub = ගොවි හබ් (keep brand name in English or use ගොවි හබ්)
- Farmer = ගොවියා
- Buyer = ගැනුම්කරු  
- Supplier = සැපයුම්කරු
- Harvest = අස්වැන්න
- Crop = බෝගය
- Match = ගැලපීම
- Price = මිල
- Weather = කාලගුණය
- Diagnosis = රෝග විනිශ්චය
- Market = වෙළඳපොළ
- Search = සොයන්න
- Notifications = දැනුම්දීම්
- Dashboard = මුල් පිටුව
- Sign in = පුරන්න
- Sign out = ඉවත් වන්න

For `ta.json`, use placeholder format: `"[TA] English text"` for now.

### 7. PWA Configuration

**next.config.js**: Configure next-pwa with:
- Service worker registration
- Precache for static assets
- Runtime cache for API responses (network-first strategy)
- Offline fallback page

**public/manifest.json**:
```json
{
  "name": "GoviHub - Smart Farming Marketplace",
  "short_name": "GoviHub",
  "description": "Sri Lanka's AI-powered farming marketplace",
  "start_url": "/si/farmer/dashboard",
  "display": "standalone",
  "background_color": "#f0fdf4",
  "theme_color": "#16a34a",
  "icons": [
    {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png"}
  ]
}
```

Create placeholder icon files (simple green circle with "GH" text) using SVG converted to PNG.

### 8. Global Styles (src/app/globals.css)

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Sinhala:wght@400;500;600;700&family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom CSS for GoviHub */
:root {
  --color-primary: #16a34a;
  --color-accent: #d4a017;
}

/* Sinhala text rendering optimization */
[lang="si"] {
  font-family: 'Noto Sans Sinhala', sans-serif;
  line-height: 1.8;  /* Sinhala needs more line height */
}

[lang="ta"] {
  font-family: 'Noto Sans Tamil', sans-serif;
  line-height: 1.7;
}
```

## Verification

1. All UI components render correctly in both mobile (360px) and desktop (1024px+)
2. Google OAuth flow redirects correctly
3. Language switching works between SI/EN/TA
4. Sinhala text renders with proper font
5. API client handles auth token refresh automatically
6. Navigation shells show correct items per role
7. PWA manifest is valid
8. Color theme is green/gold with no brown
9. All components have loading/error states

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_13_FRONTEND_FOUNDATION.md`
