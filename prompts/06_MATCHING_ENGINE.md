# Prompt 06 — Matching Engine

## Context
Harvest listings and demand postings exist. Now build the core differentiator: the AI-powered matching engine that pairs farmers with buyers.

## Objective
Implement the rules-based matching algorithm (Phase 1), background job processing, match lifecycle management, and farmer cluster aggregation.

## Instructions

### 1. app/matching/schemas.py

- `MatchRead`: id, harvest_id, demand_id, match_score, score_breakdown (dict), status, distance_km, agreed_price_kg, agreed_quantity, farmer_rating, buyer_rating, created_at, updated_at, confirmed_at, fulfilled_at, harvest (nested brief), demand (nested brief), farmer (nested UserBrief), buyer (nested UserBrief)
- `MatchBrief`: id, crop_name, match_score, status, other_party_name, quantity_kg, distance_km, created_at
- `MatchListFilter`: status (opt), crop_id (opt), page, size
- `MatchAcceptRequest`: (empty body — action is implicit)
- `MatchRejectRequest`: reason (opt str)
- `MatchConfirmRequest`: agreed_price_kg (decimal), agreed_quantity (decimal)
- `MatchFulfillRequest`: rating (1-5), fulfillment_notes (opt str)
- `MatchDisputeRequest`: reason (str)
- `MatchScoreBreakdown`: distance (float), quantity (float), date_overlap (float), freshness (float), total (float)

### 2. app/matching/engine.py — THE CORE ALGORITHM

This is the most important file in the system. Implement exactly per architecture doc:

```python
class MatchingEngine:
    """
    Phase 1: Rules-based scoring with weighted sum.
    Phase 2: Replace with LightGBM trained on fulfillment outcomes.
    """
    
    WEIGHTS = {
        "distance": 0.35,
        "quantity": 0.25,
        "date_overlap": 0.25,
        "freshness": 0.15,
    }
    
    async def find_matches_for_demand(self, db, demand: DemandPosting) -> list[MatchCandidate]:
        """Find all harvest listings that could match this demand."""
        # Step 1: Hard filters via SQL query
        #   - crop_id exact match
        #   - date window overlap (harvest available_from/to overlaps with demand delivery_from/to)
        #   - geographic feasibility: ST_DWithin(harvest.pickup_location, demand.sourcing_location, demand.sourcing_radius_km * 1000)
        #   - harvest status IN ('planned', 'ready')
        #   - harvest not already in active match for this demand
        
        # Step 2: Soft scoring for each candidate
        #   - distance_score = max(0, 1 - (actual_distance_km / sourcing_radius_km))
        #   - quantity_score = min(harvest_qty, demand_qty) / max(harvest_qty, demand_qty)
        #   - date_overlap_score = overlap_days / max_possible_overlap_days
        #   - freshness_score = 1.0 / (1 + days_since_posted)
        #   - total = weighted sum
        
        # Step 3: Sort by total score descending
        # Step 4: Return top 10 candidates
    
    async def find_matches_for_harvest(self, db, harvest: HarvestListing) -> list[MatchCandidate]:
        """Find all demand postings that could match this harvest."""
        # Mirror of above but searching demands for a given harvest
    
    async def compute_match_score(self, harvest, demand, distance_km) -> MatchScoreBreakdown:
        """Compute the detailed score breakdown for a harvest-demand pair."""
        # Implement the exact algorithm from the architecture doc
    
    async def suggest_farmer_cluster(self, db, demand: DemandPosting) -> list[ClusterSuggestion]:
        """
        When no single farmer meets the full demand quantity,
        suggest nearby farmer clusters that collectively meet it.
        Uses PostGIS ST_ClusterDBSCAN or manual grouping.
        """
        # Find all qualifying harvests within radius
        # If best single match < 80% of demand quantity:
        #   Group nearby farmers (within 10km of each other)
        #   Sum their quantities
        #   Return cluster suggestions where sum >= demand quantity
```

Use raw SQL with PostGIS functions for the geospatial queries (ST_DWithin, ST_Distance). SQLAlchemy's GeoAlchemy2 can be used for some queries but raw SQL with `text()` is acceptable for complex PostGIS operations.

### 3. app/matching/tasks.py — Background Job Processing

```python
async def run_matching_for_new_listing(listing_type: str, listing_id: UUID):
    """
    Triggered when a new harvest or demand is created/updated to 'ready'/'open'.
    Runs matching engine, creates Match records, sends notifications.
    """
    # 1. Load the listing
    # 2. Run matching engine
    # 3. For each candidate scoring > 0.3 (minimum threshold):
    #    - Create Match record with status='proposed'
    #    - Create notification for both farmer and buyer
    # 4. If no single match covers >80% quantity, also run cluster suggestion
    # 5. Log: listing_id, candidates_found, matches_created, execution_time_ms
```

For Phase 1, this runs synchronously within the request (triggered after listing creation). In Phase 2, it would be a Celery/Redis queue task. Design the interface so the swap is trivial.

### 4. app/matching/service.py

**MatchService** class:
- `list_matches(user_id, role, filters)` → Paginated matches. Farmer sees matches where harvest.farmer_id = user_id. Buyer sees matches where demand.buyer_id = user_id.
- `get_match(match_id, user_id)` → Validate user is party to this match
- `accept_match(match_id, user_id)`:
  - If farmer accepting: status → 'farmer_accepted'
  - If buyer accepting: status → 'buyer_accepted'
  - If both have accepted (check other party status): status → 'confirmed', set confirmed_at
  - Send notification to other party
- `reject_match(match_id, user_id, reason)`:
  - Status → 'cancelled'
  - Notify other party
- `confirm_match(match_id, user_id, agreed_price, agreed_quantity)`:
  - Only valid when both parties accepted
  - Records agreed terms
  - Status → 'confirmed'
- `fulfill_match(match_id, user_id, rating, notes)`:
  - Status → 'fulfilled'
  - Record rating (farmer_rating or buyer_rating depending on who's calling)
  - Set fulfilled_at
  - Update listing statuses (harvest → fulfilled, demand → fulfilled if all matches fulfilled)
- `dispute_match(match_id, user_id, reason)`:
  - Status → 'disputed'
  - Create admin notification

### 5. app/matching/router.py

```
GET    /matches                    — List my matches (farmer or buyer view)
GET    /matches/{id}               — Match detail with score breakdown
POST   /matches/{id}/accept        — Accept match
POST   /matches/{id}/reject        — Reject match
POST   /matches/{id}/confirm       — Confirm with agreed terms
PATCH  /matches/{id}/fulfill       — Mark fulfilled + rate
PATCH  /matches/{id}/dispute       — Flag dispute
```

All endpoints require auth + complete registration. Access control: user must be farmer or buyer of the match.

### 6. Trigger Matching on Listing Events

In the listings service, after creating/updating a harvest to 'ready' or a demand to 'open', call the matching task:
```python
# In listings/service.py create_harvest():
await run_matching_for_new_listing("harvest", new_listing.id)
```

### 7. Register Router

Add matching router to main.py.

## Verification

1. Creating a harvest listing triggers matching against existing open demands
2. Creating a demand posting triggers matching against existing ready harvests
3. Match scores are computed correctly (test with known inputs)
4. Hard filters correctly exclude non-qualifying listings
5. Distance calculation uses PostGIS correctly
6. Match lifecycle transitions work (propose → accept → confirm → fulfill)
7. Both parties must accept before confirmation
8. Farmer cluster suggestion works when single farmer insufficient
9. All access control checks pass

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_06_MATCHING.md`
