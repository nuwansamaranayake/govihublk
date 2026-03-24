# Prompt 14 — Frontend Feature Pages (All Roles)

## Context
Frontend foundation (design system, auth, i18n, layouts) is complete. Now build all feature pages.

## Objective
Implement every page for farmer, buyer, supplier, and admin roles. Each page connects to the backend API via the api client built in prompt 13.

## Instructions

### FARMER PAGES

#### 1. Farmer Dashboard (src/app/[locale]/farmer/dashboard/page.tsx)
The daily engagement hook. Shows:
- **Greeting**: "සුභ උදෑසනක් [name]" (Good morning) — time-aware greeting in locale
- **Today's Weather**: Card showing current weather + 3-day forecast for farmer's location. Pull from `/api/v1/alerts/weather`. Show rain probability prominently.
- **Market Prices**: Horizontal scroll cards showing today's prices for farmer's primary crops. Pull from `/api/v1/alerts/prices`. Show price trend arrow (up/down).
- **Active Matches**: Count badge + list of recent match notifications. Link to matches page.
- **Quick Actions**: Large buttons — "Add Harvest Listing", "Diagnose Crop", "Ask Expert"
- **Recent Activity**: Timeline of recent events (new match, price change, etc.)

#### 2. Harvest Listings (src/app/[locale]/farmer/listings/page.tsx)
- **Tab navigation**: All / Active / Completed / Cancelled
- **List view**: Cards showing crop name (Sinhala), quantity, date range, status badge, match count
- **FAB (Floating Action Button)**: "+" to create new listing
- **Create/Edit form** (modal or separate page):
  - Crop selector (searchable dropdown with Sinhala names)
  - Quantity input (kg)
  - Quality notes (textarea)
  - Date range picker (available from/to)
  - Location picker (map or "Use my location" button)
  - Photo upload (camera capture or gallery)
  - "Ready Now" toggle
  - Submit → creates listing and shows matching results

#### 3. Matches (src/app/[locale]/farmer/matches/page.tsx)
- **Tab navigation**: Proposed / Active / Completed / Disputed
- **Match card**: Shows buyer name, crop, quantity needed, distance, match score (as percentage), proposed price range
- **Match detail view** (click to expand or navigate):
  - Score breakdown visualization (bar chart: distance, quantity, date, freshness)
  - Buyer profile summary
  - Action buttons: Accept / Reject
  - If both accepted: Confirm form (agree price, quantity)
  - If confirmed: Fulfill button + rating form
  - Chat/message (Phase 2 — show "Contact buyer" with phone/WhatsApp link for now)

#### 4. Crop Diagnosis (src/app/[locale]/farmer/diagnosis/page.tsx)
- **Camera capture**: Full-screen camera view with overlay guide ("Point camera at affected leaf")
- **Or upload from gallery**: Button to select existing photo
- **Processing screen**: Upload animation → "Analyzing..." → Results
- **Results view**:
  - Disease classification with confidence level (color-coded: green >70%, yellow 40-70%, red <40%)
  - Sinhala treatment advice (from OpenRouter)
  - "Was this helpful?" feedback buttons
  - "Save to history" button
- **History tab**: List of past diagnoses with thumbnails and classifications

#### 5. Advisory (src/app/[locale]/farmer/advisory/page.tsx)
- **Chat-like interface**: Question input at bottom, answers displayed as messages
- **Suggested questions**: Pre-built common questions in Sinhala (e.g., "වී වගාවට හොඳම පොහොර මොනවාද?" — "What are the best fertilizers for rice?")
- **Answer display**: Formatted answer with source citations
- **History**: Previous Q&A accessible

#### 6. Marketplace (src/app/[locale]/farmer/marketplace/page.tsx)
- **Category tabs**: Fertilizer, Seeds, Equipment, Transport, Chemicals, Labor
- **Search bar** with keyword search
- **List of supplier listings**: Card with title, price, supplier name, distance
- **Contact supplier**: Phone link, WhatsApp link
- **Location-based sort**: Nearest first (using farmer's location)

### BUYER PAGES

#### 7. Buyer Dashboard (src/app/[locale]/buyer/dashboard/page.tsx)
- **Active Demands**: Count and summary of open demand postings
- **Matched Farmers**: Count of proposed matches awaiting review
- **Procurement Pipeline**: Visual pipeline (open → reviewing → confirmed → fulfilled) with counts
- **Recent Matches**: Latest match proposals
- **Quick Action**: "Post New Demand"

#### 8. Demand Postings (src/app/[locale]/buyer/demands/page.tsx)
- **List view**: Cards with crop, quantity, delivery window, status, match count
- **Create/Edit form**:
  - Crop selector
  - Quantity needed (kg)
  - Grade requirements (text)
  - Delivery date range
  - Sourcing location + radius (map)
  - Price range (min-max per kg)
  - Recurring toggle + pattern selector (weekly/biweekly/monthly)
  - Submit → creates demand and triggers matching

#### 9. Buyer Matches (src/app/[locale]/buyer/matches/page.tsx)
- Similar to farmer matches but from buyer perspective
- Shows: farmer name, location, quantity available, match score, distance
- Actions: Accept, Reject, Confirm (with agreed terms), Fulfill + Rate
- **Cluster view**: When matching suggests farmer clusters, show map with multiple farmers and aggregate quantity

### SUPPLIER PAGES

#### 10. Supplier Dashboard (src/app/[locale]/supplier/dashboard/page.tsx)
- **My Listings**: Count of active listings by category
- **Recent Views** (Phase 2): How many farmers viewed listings
- **Quick Action**: "Add New Listing"

#### 11. Supplier Listings (src/app/[locale]/supplier/listings/page.tsx)
- **List view**: Cards with title, category, price, availability status
- **Create/Edit form**:
  - Category selector
  - Title, description
  - Price and unit
  - Availability status
  - Coverage area (multi-district selector)
  - Photos
  - Submit

### ADMIN PAGES

#### 12. Admin Dashboard (src/app/[locale]/admin/dashboard/page.tsx)
- **Stats cards**: Total users, active today, new this week, total matches, fulfillment rate
- **Charts** (use Recharts or Chart.js):
  - User registrations over time (line chart)
  - Matches by status (pie chart)
  - Top 5 crops traded (bar chart)
  - Diagnoses per day (line chart)
- **Recent activity feed**: Latest registrations, matches, disputes
- **System health**: API response time, DB connections, Redis memory

#### 13. Admin User Management (src/app/[locale]/admin/users/page.tsx)
- **Table view**: Name, role, district, registered date, last active, status (active/inactive/verified)
- **Search and filter**: By role, district, status
- **User detail panel**: Full profile, activity log, action buttons (verify, deactivate, change role)

#### 14. Admin Match Monitoring (src/app/[locale]/admin/matches/page.tsx)
- **Table view**: Harvest crop, farmer, buyer, score, status, created date
- **Filter**: By status, crop, district, date range
- **Dispute resolution**: View dispute details, resolve with notes

#### 15. Admin Knowledge Base (src/app/[locale]/admin/knowledge/page.tsx)
- **List of chunks**: Source, language, preview of content, created date
- **Ingest form**: Upload text content, select language, set source name
- **Stats**: Total chunks, by language, by source
- **Delete individual chunks**

#### 16. Admin Crop Management (src/app/[locale]/admin/crops/page.tsx)
- **Table**: Code, English name, Sinhala name, category, active status
- **CRUD**: Add new crop, edit existing, toggle active status

### SHARED PAGES

#### 17. Profile Page (accessible from all role layouts under /settings)
- **View/Edit** personal information
- **Change language preference**
- **Notification preferences**
- **Account deactivation**

#### 18. Notifications Page
- **List** of all notifications with read/unread indicators
- **Mark as read** (individual and all)
- **Deep links**: Clicking notification navigates to relevant page (match detail, diagnosis result, etc.)

### IMPLEMENTATION NOTES

- Every page should use the `api` client from `src/lib/api.ts`
- Every page should use `useTranslations()` from next-intl for all user-visible text
- Every page should have loading skeletons and error states
- Forms should have client-side validation matching backend schemas
- Lists should be paginated (infinite scroll on mobile, page numbers on desktop)
- Use React Query (TanStack Query) or SWR for data fetching with caching
- All pages must work on 360px mobile viewport

## Verification

1. Navigate through farmer flow: login → dashboard → create listing → view matches → accept match → fulfill
2. Navigate through buyer flow: login → dashboard → post demand → review matches → confirm → rate
3. Navigate through supplier flow: login → create listing → edit → deactivate
4. Admin flow: dashboard → view users → manage crops → resolve dispute
5. Language switch persists across pages
6. All forms validate inputs before submission
7. Loading states show while data fetches
8. Empty states show when no data
9. Mobile viewport renders correctly (360px)
10. Desktop viewport renders correctly (1024px+)

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_14_FRONTEND_FEATURES.md`
