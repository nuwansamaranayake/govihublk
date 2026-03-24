#!/bin/bash
set -euo pipefail

API="http://localhost:8000/api/v1"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
PASS=0
FAIL=0

check() {
    local desc=$1
    local expected_status=$2
    shift 2

    local http_code

    http_code=$(curl -s -o /tmp/govihub_test_response -w "%{http_code}" "$@")

    if [ "$http_code" = "$expected_status" ]; then
        echo -e "  ${GREEN}✓${NC} $desc (HTTP $http_code)"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}✗${NC} $desc — expected $expected_status, got $http_code"
        cat /tmp/govihub_test_response 2>/dev/null | head -3
        echo ""
        FAIL=$((FAIL + 1))
    fi
}

echo -e "${YELLOW}=== GoviHub API Smoke Test ===${NC}"
echo ""

# Health
echo "Health check:"
check "GET /health" "200" "$API/health"
echo ""

# Dev Auth
echo "Dev Authentication:"
check "POST /auth/dev/login/farmer" "200" -X POST "$API/auth/dev/login/farmer"
FARMER_TOKEN=$(curl -s -X POST "$API/auth/dev/login/farmer" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null || echo "")

check "POST /auth/dev/login/buyer" "200" -X POST "$API/auth/dev/login/buyer"
BUYER_TOKEN=$(curl -s -X POST "$API/auth/dev/login/buyer" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null || echo "")

check "POST /auth/dev/login/admin" "200" -X POST "$API/auth/dev/login/admin"
ADMIN_TOKEN=$(curl -s -X POST "$API/auth/dev/login/admin" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null || echo "")
echo ""

# Users
echo "User endpoints:"
if [ -n "$FARMER_TOKEN" ]; then
    check "GET /users/me (farmer)" "200" -H "Authorization: Bearer $FARMER_TOKEN" "$API/users/me"
fi
if [ -n "$BUYER_TOKEN" ]; then
    check "GET /users/me (buyer)" "200" -H "Authorization: Bearer $BUYER_TOKEN" "$API/users/me"
fi
check "GET /users/me (no auth)" "401" "$API/users/me"
echo ""

# Reference data
echo "Reference data:"
check "GET /crops" "200" "$API/crops"
check "GET /districts" "200" "$API/districts"
echo ""

# Listings
echo "Harvest listings (farmer):"
CROP_ID=$(curl -s "$API/crops" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items = d.get('data', d) if isinstance(d, dict) else d
if isinstance(items, list) and len(items) > 0:
    print(items[0].get('id', ''))
else:
    print('')
" 2>/dev/null || echo "")

if [ -n "$CROP_ID" ] && [ -n "$FARMER_TOKEN" ]; then
    check "POST /listings/harvest (create)" "201" \
        -X POST \
        -H "Authorization: Bearer $FARMER_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"crop_id\": \"$CROP_ID\", \"quantity_kg\": 500, \"available_from\": \"2026-04-01\", \"available_to\": \"2026-04-15\", \"pickup_latitude\": 8.3114, \"pickup_longitude\": 80.4037, \"pickup_address\": \"Anuradhapura\"}"

    check "GET /listings/harvest (my list)" "200" \
        -H "Authorization: Bearer $FARMER_TOKEN" \
        "$API/listings/harvest"
else
    echo -e "  ${YELLOW}⚠ Skipping listing tests — no crops seeded or no token${NC}"
fi
echo ""

# Demand postings
echo "Demand postings (buyer):"
if [ -n "$CROP_ID" ] && [ -n "$BUYER_TOKEN" ]; then
    check "POST /listings/demand (create)" "201" \
        -X POST \
        -H "Authorization: Bearer $BUYER_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"crop_id\": \"$CROP_ID\", \"quantity_kg\": 1000, \"delivery_from\": \"2026-04-01\", \"delivery_to\": \"2026-04-20\", \"sourcing_latitude\": 7.2906, \"sourcing_longitude\": 80.6337, \"sourcing_radius_km\": 100}"

    check "GET /listings/demand (my list)" "200" \
        -H "Authorization: Bearer $BUYER_TOKEN" \
        "$API/listings/demand"
fi
echo ""

# Alerts
echo "Alerts:"
if [ -n "$FARMER_TOKEN" ]; then
    check "GET /alerts/weather (user location)" "200" \
        -H "Authorization: Bearer $FARMER_TOKEN" \
        "$API/alerts/weather"
    check "GET /alerts/prices (farmer crops)" "200" \
        -H "Authorization: Bearer $FARMER_TOKEN" \
        "$API/alerts/prices"
fi
echo ""

# Marketplace
echo "Marketplace:"
if [ -n "$FARMER_TOKEN" ]; then
    check "GET /marketplace/categories" "200" \
        -H "Authorization: Bearer $FARMER_TOKEN" \
        "$API/marketplace/categories"
    check "GET /marketplace/search" "200" \
        -H "Authorization: Bearer $FARMER_TOKEN" \
        "$API/marketplace/search"
fi
echo ""

# Notifications
echo "Notifications:"
if [ -n "$FARMER_TOKEN" ]; then
    check "GET /notifications (farmer)" "200" \
        -H "Authorization: Bearer $FARMER_TOKEN" \
        "$API/notifications"
    check "GET /notifications/unread-count" "200" \
        -H "Authorization: Bearer $FARMER_TOKEN" \
        "$API/notifications/unread-count"
fi
echo ""

# Admin
echo "Admin endpoints:"
if [ -n "$ADMIN_TOKEN" ]; then
    check "GET /admin/dashboard" "200" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        "$API/admin/dashboard"
    check "GET /admin/users" "200" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        "$API/admin/users"
    check "GET /admin/crops" "200" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        "$API/admin/crops"
fi
if [ -n "$FARMER_TOKEN" ]; then
    check "GET /admin/dashboard (farmer — should 403)" "403" \
        -H "Authorization: Bearer $FARMER_TOKEN" \
        "$API/admin/dashboard"
fi
echo ""

# Summary
echo -e "${YELLOW}=== Results ===${NC}"
echo -e "  Passed: ${GREEN}$PASS${NC}"
echo -e "  Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}$FAIL test(s) failed.${NC}"
    exit 1
fi
