# REPORT 13 — Frontend Foundation

**Date:** 2026-03-23
**Status:** COMPLETE

---

## Summary

Prompt 13 delivered the complete frontend foundation for GoviHub. All files were written from scratch or updated in place. No dependencies were added (all components use only React, Next.js 14, Tailwind CSS, and next-intl which are already installed).

---

## 1. Design System Components

Location: `govihub-web/src/components/ui/`

| File | Description |
|---|---|
| `Button.tsx` | 5 variants (primary/secondary/accent/danger/ghost), 3 sizes (sm/md/lg), loading spinner, disabled, left/right icon, fullWidth |
| `Input.tsx` | Label, error with icon, helper text, left/right icon slots, required indicator |
| `TextArea.tsx` | Multi-line, same validation UX as Input |
| `Select.tsx` | Dropdown with custom chevron, label, error, helper, options array |
| `Card.tsx` | header/footer/image slots, hoverable, padding variants, button or div tag |
| `Badge.tsx` | 8 colors (green/gold/blue/red/gray/orange/purple/darkgreen), dot indicator |
| `Modal.tsx` | Bottom sheet on mobile (rounded-t-3xl), centered on sm+, drag handle, ESC key close, backdrop blur |
| `Toast.tsx` | Context+provider pattern, 4 types (success/error/warning/info), auto-dismiss, manual dismiss |
| `Skeleton.tsx` | Base Skeleton, SkeletonText, SkeletonCard compositions |
| `Avatar.tsx` | Image with next/image, fallback initials with deterministic color palette |
| `EmptyState.tsx` | Icon, title, description, optional CTA Button |
| `Tabs.tsx` | ARIA-compliant tablist/tabpanel, badge counts, render-prop children |
| `BottomNav.tsx` | Fixed bottom, active state via usePathname, badge counts, safe-area-pb |
| `TopBar.tsx` | Sticky, back button with router.back(), left/right action slots |
| `SearchBar.tsx` | Debounced (300ms default), clear button, accessible |
| `ListItem.tsx` | Avatar or leftIcon, title/subtitle, rightContent, badge slot |
| `StatusBadge.tsx` | 7 statuses: planned=blue, ready=green, matched=gold, confirmed=darkgreen, fulfilled=green+checkmark, cancelled=gray, disputed=red |
| `PriceTag.tsx` | "Rs. 350/kg" display, currency/unit configurable, highlight=gold mode |
| `QuantityDisplay.tsx` | "2,500 kg" with locale formatting, optional label |
| `DateRange.tsx` | Start/end dates, calendar icon, short/long format |
| `LanguageSwitcher.tsx` | SI/EN/TA toggle, uses next-intl useLocale + useTransition for smooth switching |
| `index.ts` | Barrel export for all components |

---

## 2. API Client

File: `govihub-web/src/lib/api.ts`

- Access token stored in module-level variable (memory only, not localStorage)
- `setAccessToken(token)` / `getAccessToken()` for external control
- Auto-refresh on 401: calls `POST /api/v1/auth/refresh`, retries original request once
- Deduplicates concurrent refresh calls (single `refreshPromise`)
- Methods: `api.get`, `api.post`, `api.put`, `api.patch`, `api.delete`, `api.upload`
- `credentials: 'include'` on all requests for httpOnly cookie refresh token
- Throws `ApiException` with `status`, `code`, `message`, `details`

---

## 3. Auth Context

File: `govihub-web/src/lib/auth.tsx`

- `"use client"` React context
- `AuthProvider` wraps app, attempts `refreshSession()` on mount to restore session
- State: `user: AuthUser | null`, `isAuthenticated`, `isLoading`
- `login(code, redirectUri)` — exchanges Google code with backend, stores token, fetches `/api/v1/users/me`
- `logout()` — calls `POST /api/v1/auth/logout` (best-effort), clears token and user
- `refreshSession()` — returns `boolean`, used by app shell and api.ts
- `updateUser(updates)` — partial patch for post-registration profile update
- `useAuth()` hook exported for consumers

---

## 4. Auth Pages

### Login (`govihub-web/src/app/[locale]/auth/login/page.tsx`)
- GoviHub logo (green rounded square with bolt icon)
- Green/gold gradient strip at bottom
- "Sign in with Google" button with real Google SVG multicolor icon
- LanguageSwitcher in top-right
- Feature highlights (Smart Listings, AI Matching, 3 Languages)
- Redirects to `NEXT_PUBLIC_GOOGLE_AUTH_URL` with `redirect_uri` param

### Register (`govihub-web/src/app/[locale]/auth/register/page.tsx`)
- Two-step flow: role selection → profile form
- Role cards (Farmer/Buyer/Supplier) with emoji, name, description, active border indicator
- Profile form: Full Name, Phone, District dropdown (all 25 Sri Lanka districts), Language preference
- Client-side validation with error messages
- Calls `POST /api/v1/users/complete-registration`
- On success: updates auth context, redirects to `/{locale}/{role}/dashboard`

### Callback Route (`govihub-web/src/app/api/auth/callback/route.ts`)
- Receives `?code=` from Google OAuth
- Exchanges code with backend `POST /api/v1/auth/google/callback`
- Forwards Set-Cookie headers (refresh token)
- Stores access token in short-lived (15min) non-httpOnly cookie `govihub_at` for client pickup
- Routes: incomplete profile → `/register`, complete → `/{locale}/{role}/dashboard`
- Error handling: redirects to login with `?error=` param

---

## 5. Navigation Layouts

### Farmer (`govihub-web/src/app/[locale]/farmer/layout.tsx`)
- BottomNav: Home, Listings, Matches, Diagnosis, More
- TopBar with GoviHub branding + "Farmer" gold badge
- `pb-20` main content padding for BottomNav clearance

### Buyer (`govihub-web/src/app/[locale]/buyer/layout.tsx`)
- BottomNav: Home, Demands, Matches, Market, More
- TopBar with "Buyer" blue badge

### Supplier (`govihub-web/src/app/[locale]/supplier/layout.tsx`)
- BottomNav: Home, Listings, Inquiries, More
- TopBar with "Supplier" purple badge

### Admin (`govihub-web/src/app/[locale]/admin/layout.tsx`)
- Desktop sidebar with 7 nav items (Dashboard, Users, Listings, Matches, Disputes, Analytics, Settings)
- Active state highlighting
- User avatar + name + email + logout button in sidebar footer
- Mobile: hamburger button reveals sidebar as overlay
- All icons use inline SVG paths (no external icon library dependency)

---

## 6. i18n Messages

All three locale files updated with matching key structure:

**Namespaces added:** `common`, `nav`, `auth`, `roles`, `roleDesc`, `home`, `farmer`, `buyer`, `supplier`, `admin`, `status`, `listing`, `match`, `error`

| File | Status |
|---|---|
| `en.json` | Full English translations (~100 keys) |
| `si.json` | Accurate Sinhala translations using proper Unicode (UTF-8 encoded) |
| `ta.json` | `[TA]` placeholders for all new keys (ready for translator handoff) |

---

## 7. globals.css

Updated with:
- Google Fonts import: Inter (latin), Noto Sans Sinhala, Noto Sans Tamil (all weights 400–700)
- `:lang(si)` override: `line-height: 1.8`, `word-spacing: 0.05em`
- `:lang(ta)` override: `line-height: 1.85`, `word-spacing: 0.03em`
- `.no-scrollbar` utility (used by Tabs horizontal scroll)
- `.safe-area-pb` utility (used by BottomNav)
- `-webkit-tap-highlight-color: transparent` on button/a
- `focus-visible` global outline using primary green

---

## 8. Root Layout

Updated `govihub-web/src/app/[locale]/layout.tsx`:
- Wraps children with `AuthProvider` (from `@/lib/auth`)
- Wraps with `ToastProvider` (from `@/components/ui/Toast`)
- Provider order: `NextIntlClientProvider > AuthProvider > ToastProvider > children`

---

## File Count

| Category | Files |
|---|---|
| UI Components | 22 (21 components + index.ts) |
| API/Auth lib | 2 (api.ts, auth.tsx) |
| Auth pages | 2 (login, register) |
| API route | 1 (callback/route.ts) |
| Layouts | 4 (farmer, buyer, supplier, admin) |
| Root layout | 1 (updated) |
| i18n messages | 3 (en, si, ta) |
| globals.css | 1 (updated) |
| **Total** | **36 files** |

---

## Design Decisions

- **No external icon library** — all icons are inline SVG to avoid bundle dependencies
- **No localStorage** — access token lives in module memory; refresh token is httpOnly cookie
- **Bottom sheet modal** — `rounded-t-3xl sm:rounded-2xl` gives native feel on mobile
- **`min-h-dvh`** — uses CSS `dvh` units for correct height on mobile browsers with dynamic toolbars
- **Theme** — exclusively Green (`#16a34a`) and Gold (`#d4a017`). No brown anywhere.
- **`no-scrollbar` + horizontal scroll on Tabs** — accessible swipeable tabs on mobile
