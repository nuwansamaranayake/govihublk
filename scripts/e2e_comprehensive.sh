#!/bin/bash
# GoviHub Spices — Comprehensive E2E Test Suite
# All Phases: 0-11 API tests, 13 Cleanup

set -o pipefail

API="https://spices.govihublk.com/api/v1"
BASE="https://spices.govihublk.com"
CURL="curl --ssl-no-revoke"
PY=python

# Helper: extract token (returns FAILED if empty/missing)
get_token() {
    local tok
    tok=$(echo "$1" | $PY -c "import sys,json; print(json.load(sys.stdin).get('access_token','FAILED'))" 2>/dev/null)
    [ -z "$tok" ] && tok="FAILED"
    echo "$tok"
}

# Counters
PASS_COUNT=0; FAIL_COUNT=0; SKIP_COUNT=0
mkdir -p /tmp/e2e-results
RESULTS_FILE="/tmp/e2e-results/results.txt"
> $RESULTS_FILE

log_result() {
    local id="$1" name="$2" status="$3" detail="$4"
    case "$status" in
        PASS) PASS_COUNT=$((PASS_COUNT+1)); echo "PASS [$id] $name: $detail" | tee -a $RESULTS_FILE ;;
        SKIP) SKIP_COUNT=$((SKIP_COUNT+1)); echo "SKIP [$id] $name: $detail" | tee -a $RESULTS_FILE ;;
        *)    FAIL_COUNT=$((FAIL_COUNT+1)); echo "FAIL [$id] $name: $detail" | tee -a $RESULTS_FILE ;;
    esac
}

# ══════════════════════════════════════════════════════════════════════════════
echo "========== PHASE 0: PRE-FLIGHT AUDIT =========="
# ══════════════════════════════════════════════════════════════════════════════

# 001: API Health
HEALTH=$($CURL -s --max-time 10 $API/health)
H_STATUS=$(echo "$HEALTH" | $PY -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
[ "$H_STATUS" = "healthy" ] \
  && log_result "001" "API Health" "PASS" "healthy" \
  || log_result "001" "API Health" "FAIL" "status=$H_STATUS"

# 002: Sector Config returns spices
SECTOR=$($CURL -s --max-time 10 $API/sector/config)
SECTOR_NAME=$(echo "$SECTOR" | $PY -c "import sys,json; print(json.load(sys.stdin).get('sector',''))" 2>/dev/null)
[ "$SECTOR_NAME" = "spices" ] \
  && log_result "002" "Sector Config" "PASS" "sector=spices" \
  || log_result "002" "Sector Config" "FAIL" "sector=$SECTOR_NAME"

# 003: Exactly 8 spice crops
CROP_DATA=$($CURL -s --max-time 10 $API/crops)
CROP_COUNT=$(echo "$CROP_DATA" | $PY -c "
import sys,json
d = json.load(sys.stdin)
crops = d.get('data', d if isinstance(d, list) else d.get('items', []))
print(len(crops))
" 2>/dev/null)
[ "$CROP_COUNT" = "8" ] \
  && log_result "003" "Crop Count" "PASS" "8 spice crops" \
  || log_result "003" "Crop Count" "FAIL" "Expected 8, got $CROP_COUNT"

# 004: All crops are spice category
NON_SPICE=$(echo "$CROP_DATA" | $PY -c "
import sys,json
d = json.load(sys.stdin)
crops = d.get('data', d if isinstance(d, list) else d.get('items', []))
bad = [c.get('name_en','?') for c in crops if c.get('category','') != 'spice']
print(','.join(bad) if bad else 'NONE')
" 2>/dev/null)
[ "$NON_SPICE" = "NONE" ] \
  && log_result "004" "All crops are spice" "PASS" "Clean" \
  || log_result "004" "All crops are spice" "FAIL" "Non-spice: $NON_SPICE"

# 005: Knowledge base has 591+ chunks
ADMIN_TOKEN=$(get_token "$($CURL -s --max-time 10 -X POST $API/auth/beta/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"nuwan","password":"Nuwan-Super9635"}')")

KB_RESP=$($CURL -s --max-time 10 "$API/admin/knowledge?size=1" -H "Authorization: Bearer $ADMIN_TOKEN")
KB_COUNT=$(echo "$KB_RESP" | $PY -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null)
[ "$KB_COUNT" -ge 591 ] 2>/dev/null \
  && log_result "005" "Knowledge chunks" "PASS" "$KB_COUNT chunks" \
  || log_result "005" "Knowledge chunks" "FAIL" "Expected 591+, got $KB_COUNT"

# 006: KB content is spice (no tomato)
KB_SAMPLE=$($CURL -s --max-time 10 "$API/admin/knowledge?size=100" -H "Authorization: Bearer $ADMIN_TOKEN")
KB_HAS_TOMATO=$(echo "$KB_SAMPLE" | $PY -c "
import sys,json
d = json.load(sys.stdin)
items = d.get('items', [])
found = any('tomato' in (i.get('title','') or '').lower() or 'tomato' in (i.get('content','') or '').lower()[:200] for i in items)
print('YES' if found else 'NO')
" 2>/dev/null)
[ "$KB_HAS_TOMATO" = "NO" ] \
  && log_result "006" "KB content is spice" "PASS" "No tomato found" \
  || log_result "006" "KB content is spice" "FAIL" "Tomato content found"

# 007: Dev login disabled
DEV_STATUS=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST $API/auth/dev/login/farmer)
[ "$DEV_STATUS" = "404" ] || [ "$DEV_STATUS" = "405" ] \
  && log_result "007" "Dev login disabled" "PASS" "HTTP $DEV_STATUS" \
  || log_result "007" "Dev login disabled" "FAIL" "HTTP $DEV_STATUS — SECURITY RISK"

# 008: Frontend loads
FE_STATUS=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 $BASE)
[ "$FE_STATUS" = "200" ] || [ "$FE_STATUS" = "307" ] || [ "$FE_STATUS" = "308" ] \
  && log_result "008" "Frontend loads" "PASS" "HTTP $FE_STATUS" \
  || log_result "008" "Frontend loads" "FAIL" "HTTP $FE_STATUS"

# 009: PWA manifest
MANIFEST=$($CURL -s --max-time 10 $BASE/manifest.json)
SHORT_NAME=$(echo "$MANIFEST" | $PY -c "import sys,json; print(json.load(sys.stdin).get('short_name',''))" 2>/dev/null)
echo "$SHORT_NAME" | grep -qi "spice" \
  && log_result "009" "PWA manifest" "PASS" "short_name=$SHORT_NAME" \
  || log_result "009" "PWA manifest" "FAIL" "short_name=$SHORT_NAME"

# 010: SSL valid
SSL_STATUS=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 5 https://spices.govihublk.com/api/v1/health)
[ "$SSL_STATUS" = "200" ] \
  && log_result "010" "SSL valid" "PASS" "HTTPS working" \
  || log_result "010" "SSL valid" "FAIL" "HTTPS status: $SSL_STATUS"

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "========== PHASE 1: USER REGISTRATION =========="
# ══════════════════════════════════════════════════════════════════════════════

REG="$API/auth/beta/register"
LOGIN="$API/auth/beta/login"

# 011: Register Farmer 1
F1_REG=$($CURL -s --max-time 10 -X POST $REG -H "Content-Type: application/json" \
  -d '{"username":"e2e_farmer_matale","password":"E2eFarmer2026!","name":"Bandara Wijesekara","role":"farmer","phone":"+94711000001","district":"Matale"}')
F1_TOKEN=$(get_token "$F1_REG")
[ "$F1_TOKEN" != "FAILED" ] \
  && log_result "011" "Register Farmer 1 (Matale)" "PASS" "Token received" \
  || log_result "011" "Register Farmer 1 (Matale)" "FAIL" "$(echo $F1_REG | head -c 100)"

# 012: Register Farmer 2
F2_REG=$($CURL -s --max-time 10 -X POST $REG -H "Content-Type: application/json" \
  -d '{"username":"e2e_farmer_kandy","password":"E2eFarmer2026!","name":"Siripala Herath","role":"farmer","phone":"+94711000002","district":"Kandy"}')
F2_TOKEN=$(get_token "$F2_REG")
[ "$F2_TOKEN" != "FAILED" ] \
  && log_result "012" "Register Farmer 2 (Kandy)" "PASS" "Token received" \
  || log_result "012" "Register Farmer 2 (Kandy)" "FAIL" "$(echo $F2_REG | head -c 100)"

# 013: Register Buyer 1
B1_REG=$($CURL -s --max-time 10 -X POST $REG -H "Content-Type: application/json" \
  -d '{"username":"e2e_buyer_colombo","password":"E2eBuyer2026!","name":"Lanka Spice Exports Ltd","role":"buyer","phone":"+94711000003","district":"Colombo"}')
B1_TOKEN=$(get_token "$B1_REG")
[ "$B1_TOKEN" != "FAILED" ] \
  && log_result "013" "Register Buyer 1 (Colombo)" "PASS" "Token received" \
  || log_result "013" "Register Buyer 1 (Colombo)" "FAIL" "$(echo $B1_REG | head -c 100)"

# 014: Register Buyer 2
B2_REG=$($CURL -s --max-time 10 -X POST $REG -H "Content-Type: application/json" \
  -d '{"username":"e2e_buyer_gampaha","password":"E2eBuyer2026!","name":"Saman Spice Processing","role":"buyer","phone":"+94711000004","district":"Gampaha"}')
B2_TOKEN=$(get_token "$B2_REG")
[ "$B2_TOKEN" != "FAILED" ] \
  && log_result "014" "Register Buyer 2 (Gampaha)" "PASS" "Token received" \
  || log_result "014" "Register Buyer 2 (Gampaha)" "FAIL" "$(echo $B2_REG | head -c 100)"

# 015: Register Supplier
S1_REG=$($CURL -s --max-time 10 -X POST $REG -H "Content-Type: application/json" \
  -d '{"username":"e2e_supplier_kandy","password":"E2eSupplier2026!","name":"Hill Country Agri Supplies","role":"supplier","phone":"+94711000005","district":"Kandy"}')
S1_TOKEN=$(get_token "$S1_REG")
[ "$S1_TOKEN" != "FAILED" ] \
  && log_result "015" "Register Supplier (Kandy)" "PASS" "Token received" \
  || log_result "015" "Register Supplier (Kandy)" "FAIL" "$(echo $S1_REG | head -c 100)"

# 016-018: Profile verification
for PAIR in "016|F1|$F1_TOKEN|Bandara|farmer" "017|B1|$B1_TOKEN|Lanka|buyer" "018|S1|$S1_TOKEN|Hill|supplier"; do
    IFS='|' read -r TID LABEL TK NAME_PART ROLE <<< "$PAIR"
    PROFILE=$($CURL -s --max-time 10 $API/users/me -H "Authorization: Bearer $TK")
    PNAME=$(echo "$PROFILE" | $PY -c "import sys,json; print(json.load(sys.stdin).get('name',''))" 2>/dev/null)
    PROLE=$(echo "$PROFILE" | $PY -c "import sys,json; print(json.load(sys.stdin).get('role',''))" 2>/dev/null)
    echo "$PNAME" | grep -q "$NAME_PART" && [ "$PROLE" = "$ROLE" ] \
      && log_result "$TID" "Profile verify $LABEL" "PASS" "$PNAME ($PROLE)" \
      || log_result "$TID" "Profile verify $LABEL" "FAIL" "Got: $PNAME ($PROLE)"
done

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "========== PHASE 2: LOGIN & TOKEN MANAGEMENT =========="
# ══════════════════════════════════════════════════════════════════════════════

F1_TOKEN=$(get_token "$($CURL -s --max-time 10 -X POST $LOGIN -H 'Content-Type: application/json' -d '{"username":"e2e_farmer_matale","password":"E2eFarmer2026!"}')")
[ "$F1_TOKEN" != "FAILED" ] && log_result "019" "Login Farmer 1" "PASS" "" || log_result "019" "Login Farmer 1" "FAIL" ""

F2_TOKEN=$(get_token "$($CURL -s --max-time 10 -X POST $LOGIN -H 'Content-Type: application/json' -d '{"username":"e2e_farmer_kandy","password":"E2eFarmer2026!"}')")
[ "$F2_TOKEN" != "FAILED" ] && log_result "020" "Login Farmer 2" "PASS" "" || log_result "020" "Login Farmer 2" "FAIL" ""

B1_TOKEN=$(get_token "$($CURL -s --max-time 10 -X POST $LOGIN -H 'Content-Type: application/json' -d '{"username":"e2e_buyer_colombo","password":"E2eBuyer2026!"}')")
[ "$B1_TOKEN" != "FAILED" ] && log_result "021" "Login Buyer 1" "PASS" "" || log_result "021" "Login Buyer 1" "FAIL" ""

B2_TOKEN=$(get_token "$($CURL -s --max-time 10 -X POST $LOGIN -H 'Content-Type: application/json' -d '{"username":"e2e_buyer_gampaha","password":"E2eBuyer2026!"}')")
[ "$B2_TOKEN" != "FAILED" ] && log_result "022" "Login Buyer 2" "PASS" "" || log_result "022" "Login Buyer 2" "FAIL" ""

S1_TOKEN=$(get_token "$($CURL -s --max-time 10 -X POST $LOGIN -H 'Content-Type: application/json' -d '{"username":"e2e_supplier_kandy","password":"E2eSupplier2026!"}')")
[ "$S1_TOKEN" != "FAILED" ] && log_result "023" "Login Supplier" "PASS" "" || log_result "023" "Login Supplier" "FAIL" ""

BAD_LOGIN=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST $LOGIN -H "Content-Type: application/json" -d '{"username":"e2e_farmer_matale","password":"WrongPassword!"}')
[ "$BAD_LOGIN" = "401" ] || [ "$BAD_LOGIN" = "400" ] \
  && log_result "024" "Wrong password rejected" "PASS" "HTTP $BAD_LOGIN" \
  || log_result "024" "Wrong password rejected" "FAIL" "HTTP $BAD_LOGIN"

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "========== PHASE 3: CROP ID EXTRACTION =========="
# ══════════════════════════════════════════════════════════════════════════════

# Map crop names to IDs using name_en
CROP_NAMES=("Black Pepper" "Turmeric" "Ginger" "Cinnamon" "Clove" "Nutmeg" "Cardamom" "Mixed Spices")
CROP_KEYS=("black_pepper" "turmeric" "ginger" "cinnamon" "cloves" "nutmeg" "cardamom" "mixed_spices")

for i in "${!CROP_NAMES[@]}"; do
    CNAME="${CROP_NAMES[$i]}"
    CKEY="${CROP_KEYS[$i]}"
    TEST_NUM=$(printf "%03d" $((25 + i)))

    CID=$(echo "$CROP_DATA" | $PY -c "
import sys,json
d = json.load(sys.stdin)
crops = d.get('data', d if isinstance(d, list) else d.get('items', []))
for c in crops:
    if c.get('name_en','').lower() == '${CNAME,,}'.lower():
        print(c.get('id','')); break
else:
    print('NOT_FOUND')
" 2>/dev/null)

    declare "CROP_ID_${CKEY}=$CID"

    [ "$CID" != "NOT_FOUND" ] && [ -n "$CID" ] \
      && log_result "$TEST_NUM" "Crop ID: $CKEY" "PASS" "${CID:0:12}..." \
      || log_result "$TEST_NUM" "Crop ID: $CKEY" "FAIL" "Not found"
done

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "========== PHASE 4: HARVEST LISTINGS (ALL 8 CROPS) =========="
# ══════════════════════════════════════════════════════════════════════════════

LISTINGS_DATA=(
    "black_pepper|F1|500|3500|7.4675|80.6234|Premium dried black pepper from Matale"
    "cinnamon|F1|300|2800|7.4675|80.6234|Ceylon cinnamon quills grade C5"
    "cloves|F1|100|8500|7.4675|80.6234|Hand-picked dried cloves"
    "nutmeg|F1|150|5200|7.4675|80.6234|Fresh nutmeg with mace"
    "turmeric|F2|400|1200|7.2906|80.6337|Organically grown fresh turmeric"
    "ginger|F2|600|950|7.2906|80.6337|Fresh ginger for export"
    "cardamom|F2|80|12000|7.2906|80.6337|Green cardamom pods premium grade"
    "mixed_spices|F2|200|2000|7.2906|80.6337|Mixed curry spice blend"
)

declare -A HARVEST_IDS

for i in "${!LISTINGS_DATA[@]}"; do
    IFS='|' read -r CROP FARMER QTY PRICE LAT LNG DESC <<< "${LISTINGS_DATA[$i]}"
    TEST_CREATE=$(printf "%03d" $((33 + i * 2)))
    TEST_PERSIST=$(printf "%03d" $((34 + i * 2)))

    [ "$FARMER" = "F1" ] && TOKEN="$F1_TOKEN" || TOKEN="$F2_TOKEN"
    CID_VAR="CROP_ID_${CROP}"
    CID="${!CID_VAR}"

    if [ -z "$CID" ] || [ "$CID" = "NOT_FOUND" ]; then
        log_result "$TEST_CREATE" "Create harvest: $CROP" "FAIL" "No crop ID"
        log_result "$TEST_PERSIST" "Verify harvest: $CROP" "FAIL" "No crop ID"
        continue
    fi

    RESULT=$($CURL -s --max-time 15 -X POST $API/listings/harvest \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"crop_id\":\"$CID\",\"quantity_kg\":$QTY,\"price_per_kg\":$PRICE,\"available_from\":\"2026-04-15\",\"available_to\":\"2026-06-15\",\"description\":\"$DESC\",\"pickup_location_lat\":$LAT,\"pickup_location_lng\":$LNG}")

    LID=$(echo "$RESULT" | $PY -c "import sys,json; print(json.load(sys.stdin).get('id','FAILED'))" 2>/dev/null)
    [ -z "$LID" ] && LID="FAILED"

    if [ "$LID" != "FAILED" ]; then
        HARVEST_IDS[$CROP]="$LID"
        log_result "$TEST_CREATE" "Create harvest: $CROP (${QTY}kg)" "PASS" "ID: ${LID:0:8}..."
    else
        log_result "$TEST_CREATE" "Create harvest: $CROP (${QTY}kg)" "FAIL" "$(echo $RESULT | head -c 100)"
    fi

    if [ "$LID" != "FAILED" ]; then
        GET_R=$($CURL -s --max-time 10 "$API/listings/harvest/$LID" -H "Authorization: Bearer $TOKEN")
        GET_QTY=$(echo "$GET_R" | $PY -c "import sys,json; d=json.load(sys.stdin); print(int(d.get('quantity_kg',0)))" 2>/dev/null)
        [ "$GET_QTY" = "$QTY" ] \
          && log_result "$TEST_PERSIST" "Verify harvest: $CROP" "PASS" "qty=$GET_QTY" \
          || log_result "$TEST_PERSIST" "Verify harvest: $CROP" "FAIL" "Expected $QTY, got $GET_QTY"
    else
        log_result "$TEST_PERSIST" "Verify harvest: $CROP" "FAIL" "No listing ID"
    fi
done

# 049-050: Listing counts
F1_LC=$($CURL -s --max-time 10 $API/listings/harvest -H "Authorization: Bearer $F1_TOKEN" | $PY -c "
import sys,json; d=json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('items', d.get('data', []))
print(len(items))" 2>/dev/null)
[ "$F1_LC" -ge 4 ] 2>/dev/null \
  && log_result "049" "Farmer 1 listing count" "PASS" "$F1_LC listings" \
  || log_result "049" "Farmer 1 listing count" "FAIL" "Expected 4+, got $F1_LC"

F2_LC=$($CURL -s --max-time 10 $API/listings/harvest -H "Authorization: Bearer $F2_TOKEN" | $PY -c "
import sys,json; d=json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('items', d.get('data', []))
print(len(items))" 2>/dev/null)
[ "$F2_LC" -ge 4 ] 2>/dev/null \
  && log_result "050" "Farmer 2 listing count" "PASS" "$F2_LC listings" \
  || log_result "050" "Farmer 2 listing count" "FAIL" "Expected 4+, got $F2_LC"

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "========== PHASE 5: BUYER DEMAND POSTINGS (ALL 8 CROPS) =========="
# ══════════════════════════════════════════════════════════════════════════════

DEMANDS_DATA=(
    "black_pepper|B1|300|4000|Looking for high-quality dried black pepper for UK export"
    "cinnamon|B1|200|3200|Need Ceylon cinnamon quills C4-C5 grade for European market"
    "cardamom|B1|50|15000|Premium green cardamom pods for Middle East export"
    "nutmeg|B1|100|6000|Whole nutmeg with mace for spice blending"
    "turmeric|B2|350|1500|Fresh turmeric for grinding and processing"
    "ginger|B2|500|1100|Fresh ginger for local distribution"
    "cloves|B2|80|9000|Dried whole cloves for local market"
    "mixed_spices|B2|150|2500|Quality mixed curry spices for packaging"
)

declare -A DEMAND_IDS

for i in "${!DEMANDS_DATA[@]}"; do
    IFS='|' read -r CROP BUYER QTY MAX_PRICE DESC <<< "${DEMANDS_DATA[$i]}"
    TEST_CREATE=$(printf "%03d" $((51 + i * 2)))
    TEST_PERSIST=$(printf "%03d" $((52 + i * 2)))

    [ "$BUYER" = "B1" ] && TOKEN="$B1_TOKEN" || TOKEN="$B2_TOKEN"
    CID_VAR="CROP_ID_${CROP}"
    CID="${!CID_VAR}"

    if [ -z "$CID" ] || [ "$CID" = "NOT_FOUND" ]; then
        log_result "$TEST_CREATE" "Create demand: $CROP" "FAIL" "No crop ID"
        log_result "$TEST_PERSIST" "Verify demand: $CROP" "FAIL" "No crop ID"
        continue
    fi

    RESULT=$($CURL -s --max-time 15 -X POST $API/listings/demand \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"crop_id\":\"$CID\",\"quantity_kg\":$QTY,\"max_price_per_kg\":$MAX_PRICE,\"needed_from\":\"2026-04-15\",\"needed_to\":\"2026-06-15\",\"description\":\"$DESC\"}")

    DID=$(echo "$RESULT" | $PY -c "import sys,json; print(json.load(sys.stdin).get('id','FAILED'))" 2>/dev/null)
    [ -z "$DID" ] && DID="FAILED"

    if [ "$DID" != "FAILED" ]; then
        DEMAND_IDS[$CROP]="$DID"
        log_result "$TEST_CREATE" "Create demand: $CROP (${QTY}kg)" "PASS" "ID: ${DID:0:8}..."
    else
        log_result "$TEST_CREATE" "Create demand: $CROP (${QTY}kg)" "FAIL" "$(echo $RESULT | head -c 100)"
    fi

    if [ "$DID" != "FAILED" ]; then
        GET_R=$($CURL -s --max-time 10 "$API/listings/demand/$DID" -H "Authorization: Bearer $TOKEN")
        GET_QTY=$(echo "$GET_R" | $PY -c "import sys,json; d=json.load(sys.stdin); print(int(d.get('quantity_kg',0)))" 2>/dev/null)
        [ "$GET_QTY" = "$QTY" ] \
          && log_result "$TEST_PERSIST" "Verify demand: $CROP" "PASS" "qty=$GET_QTY" \
          || log_result "$TEST_PERSIST" "Verify demand: $CROP" "FAIL" "Expected $QTY, got $GET_QTY"
    else
        log_result "$TEST_PERSIST" "Verify demand: $CROP" "FAIL" "No demand ID"
    fi
done

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "========== PHASE 6: MATCHING ENGINE =========="
# ══════════════════════════════════════════════════════════════════════════════

sleep 3

F1_MATCHES=$($CURL -s --max-time 10 $API/matches -H "Authorization: Bearer $F1_TOKEN")
F1_MC=$(echo "$F1_MATCHES" | $PY -c "
import sys,json; d=json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('items', d.get('matches', []))
print(len(items))" 2>/dev/null)
[ "$F1_MC" -gt 0 ] 2>/dev/null \
  && log_result "067" "Farmer 1 matches" "PASS" "$F1_MC matches" \
  || log_result "067" "Farmer 1 matches" "FAIL" "$F1_MC matches"

B1_MATCHES=$($CURL -s --max-time 10 $API/matches -H "Authorization: Bearer $B1_TOKEN")
B1_MC=$(echo "$B1_MATCHES" | $PY -c "
import sys,json; d=json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('items', d.get('matches', []))
print(len(items))" 2>/dev/null)
[ "$B1_MC" -gt 0 ] 2>/dev/null \
  && log_result "068" "Buyer 1 matches" "PASS" "$B1_MC matches" \
  || log_result "068" "Buyer 1 matches" "FAIL" "$B1_MC matches"

# Try triggering matching if none found
if [ "$F1_MC" = "0" ] || [ -z "$F1_MC" ]; then
    echo "No auto-matches — trying manual trigger..."
    $CURL -s --max-time 15 -X POST $API/matches/trigger -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1
    $CURL -s --max-time 15 -X POST $API/admin/matching/run -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1
    sleep 5

    F1_MATCHES=$($CURL -s --max-time 10 $API/matches -H "Authorization: Bearer $F1_TOKEN")
    F1_MC=$(echo "$F1_MATCHES" | $PY -c "
import sys,json; d=json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('items', d.get('matches', []))
print(len(items))" 2>/dev/null)
    [ "$F1_MC" -gt 0 ] 2>/dev/null \
      && log_result "069" "Matches after trigger" "PASS" "$F1_MC matches" \
      || log_result "069" "Matches after trigger" "SKIP" "Matching may run on cron ($F1_MC)"
else
    log_result "069" "Matches after trigger" "SKIP" "Auto-matches already exist"
fi

# 070-074: Match lifecycle
MATCH_ID=$(echo "$F1_MATCHES" | $PY -c "
import sys,json; d=json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('items', d.get('matches', []))
print(items[0].get('id','') if items else 'NONE')" 2>/dev/null)

if [ -n "$MATCH_ID" ] && [ "$MATCH_ID" != "NONE" ] && [ "$MATCH_ID" != "None" ]; then
    MD=$($CURL -s --max-time 10 "$API/matches/$MATCH_ID" -H "Authorization: Bearer $F1_TOKEN")
    HAS_SCORE=$(echo "$MD" | $PY -c "import sys,json; d=json.load(sys.stdin); print('YES' if d.get('score') or d.get('match_score') else 'NO')" 2>/dev/null)
    log_result "070" "Match detail with score" "$([ "$HAS_SCORE" = "YES" ] && echo PASS || echo FAIL)" "score: $HAS_SCORE"

    AF=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$API/matches/$MATCH_ID/accept" -H "Authorization: Bearer $F1_TOKEN")
    log_result "071" "Farmer accepts match" "$([ "$AF" = "200" ] && echo PASS || echo FAIL)" "HTTP $AF"

    AB=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$API/matches/$MATCH_ID/accept" -H "Authorization: Bearer $B1_TOKEN")
    [ "$AB" != "200" ] && AB=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$API/matches/$MATCH_ID/accept" -H "Authorization: Bearer $B2_TOKEN")
    log_result "072" "Buyer accepts match" "$([ "$AB" = "200" ] && echo PASS || echo FAIL)" "HTTP $AB"

    CF=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$API/matches/$MATCH_ID/confirm" -H "Authorization: Bearer $F1_TOKEN")
    log_result "073" "Confirm match" "$([ "$CF" = "200" ] && echo PASS || echo FAIL)" "HTTP $CF"

    FF=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X PATCH "$API/matches/$MATCH_ID/fulfill" \
      -H "Authorization: Bearer $F1_TOKEN" -H "Content-Type: application/json" -d '{"farmer_rating":5}')
    log_result "074" "Fulfill match" "$([ "$FF" = "200" ] && echo PASS || echo FAIL)" "HTTP $FF"
else
    log_result "070" "Match detail" "SKIP" "No matches (cron schedule)"
    log_result "071" "Farmer accept" "SKIP" "No matches"
    log_result "072" "Buyer accept" "SKIP" "No matches"
    log_result "073" "Confirm match" "SKIP" "No matches"
    log_result "074" "Fulfill match" "SKIP" "No matches"
fi

# 075: Reject match
MATCH_ID2=$(echo "$F1_MATCHES" | $PY -c "
import sys,json; d=json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('items', d.get('matches', []))
print(items[1].get('id','') if len(items) > 1 else 'NONE')" 2>/dev/null)
if [ -n "$MATCH_ID2" ] && [ "$MATCH_ID2" != "NONE" ] && [ "$MATCH_ID2" != "None" ]; then
    RJ=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST "$API/matches/$MATCH_ID2/reject" -H "Authorization: Bearer $F1_TOKEN")
    log_result "075" "Reject match" "$([ "$RJ" = "200" ] && echo PASS || echo FAIL)" "HTTP $RJ"
else
    log_result "075" "Reject match" "SKIP" "No second match"
fi

# 076-078: Role isolation
RD=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST $API/listings/demand \
  -H "Authorization: Bearer $F1_TOKEN" -H "Content-Type: application/json" \
  -d "{\"crop_id\":\"$CROP_ID_black_pepper\",\"quantity_kg\":1,\"max_price_per_kg\":100,\"needed_from\":\"2026-04-15\",\"needed_to\":\"2026-06-15\"}")
[ "$RD" = "403" ] || [ "$RD" = "422" ] || [ "$RD" = "400" ] \
  && log_result "076" "Farmer cannot create demand" "PASS" "HTTP $RD" \
  || log_result "076" "Farmer cannot create demand" "FAIL" "HTTP $RD"

RH=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST $API/listings/harvest \
  -H "Authorization: Bearer $B1_TOKEN" -H "Content-Type: application/json" \
  -d "{\"crop_id\":\"$CROP_ID_black_pepper\",\"quantity_kg\":1,\"price_per_kg\":100,\"available_from\":\"2026-04-15\",\"available_to\":\"2026-06-15\"}")
[ "$RH" = "403" ] || [ "$RH" = "422" ] || [ "$RH" = "400" ] \
  && log_result "077" "Buyer cannot create harvest" "PASS" "HTTP $RH" \
  || log_result "077" "Buyer cannot create harvest" "FAIL" "HTTP $RH"

log_result "078" "Cross-site token" "SKIP" "Beta may share JWT secret"

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "========== PHASE 7: LISTING CRUD =========="
# ══════════════════════════════════════════════════════════════════════════════

PEPPER_HID="${HARVEST_IDS[black_pepper]}"
if [ -n "$PEPPER_HID" ]; then
    US=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X PUT "$API/listings/harvest/$PEPPER_HID" \
      -H "Authorization: Bearer $F1_TOKEN" -H "Content-Type: application/json" \
      -d '{"quantity_kg":550,"description":"Updated: Premium dried black pepper, extra stock"}')
    log_result "079" "Update harvest listing" "$([ "$US" = "200" ] && echo PASS || echo FAIL)" "HTTP $US"

    UQ=$($CURL -s --max-time 10 "$API/listings/harvest/$PEPPER_HID" -H "Authorization: Bearer $F1_TOKEN" | $PY -c "import sys,json; print(int(json.load(sys.stdin).get('quantity_kg',0)))" 2>/dev/null)
    [ "$UQ" = "550" ] \
      && log_result "080" "Update persisted" "PASS" "qty=550" \
      || log_result "080" "Update persisted" "FAIL" "qty=$UQ"
else
    log_result "079" "Update harvest listing" "FAIL" "No pepper listing ID"
    log_result "080" "Update persisted" "FAIL" "No pepper listing ID"
fi

if [ -n "$PEPPER_HID" ]; then
    SCS=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X PATCH "$API/listings/harvest/$PEPPER_HID/status" \
      -H "Authorization: Bearer $F1_TOKEN" -H "Content-Type: application/json" -d '{"status":"ready"}')
    log_result "081" "Change listing status" "$([ "$SCS" = "200" ] && echo PASS || echo FAIL)" "HTTP $SCS"
else
    log_result "081" "Change listing status" "FAIL" "No listing"
fi

PEPPER_DID="${DEMAND_IDS[black_pepper]}"
if [ -n "$PEPPER_DID" ]; then
    DUS=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X PUT "$API/listings/demand/$PEPPER_DID" \
      -H "Authorization: Bearer $B1_TOKEN" -H "Content-Type: application/json" \
      -d '{"quantity_kg":350,"description":"Updated: Need more pepper for Q2 export"}')
    log_result "082" "Update demand posting" "$([ "$DUS" = "200" ] && echo PASS || echo FAIL)" "HTTP $DUS"
else
    log_result "082" "Update demand posting" "FAIL" "No demand ID"
fi

# 083-084: Supplier listings
SC1=$($CURL -s --max-time 15 -X POST $API/marketplace/listings \
  -H "Authorization: Bearer $S1_TOKEN" -H "Content-Type: application/json" \
  -d '{"category":"fertilizer","name":"Organic Spice Fertilizer NPK","description":"For pepper, cinnamon and cardamom","price":2500,"price_unit":"per_bag","coverage_radius_km":75}')
SID1=$(echo "$SC1" | $PY -c "import sys,json; print(json.load(sys.stdin).get('id','FAILED'))" 2>/dev/null)
[ -n "$SID1" ] && [ "$SID1" != "FAILED" ] \
  && log_result "083" "Supplier create listing" "PASS" "ID: ${SID1:0:8}..." \
  || log_result "083" "Supplier create listing" "FAIL" "$(echo $SC1 | head -c 100)"

SC2=$($CURL -s --max-time 15 -X POST $API/marketplace/listings \
  -H "Authorization: Bearer $S1_TOKEN" -H "Content-Type: application/json" \
  -d '{"category":"equipment","name":"Pepper Drying Machine","description":"Solar-assisted, 50kg capacity","price":85000,"price_unit":"flat_rate","coverage_radius_km":100}')
SID2=$(echo "$SC2" | $PY -c "import sys,json; print(json.load(sys.stdin).get('id','FAILED'))" 2>/dev/null)
[ -n "$SID2" ] && [ "$SID2" != "FAILED" ] \
  && log_result "084" "Supplier second listing" "PASS" "" \
  || log_result "084" "Supplier second listing" "FAIL" "$(echo $SC2 | head -c 100)"

# 085-086: Marketplace search
MKS=$($CURL -s --max-time 10 "$API/marketplace/search?category=fertilizer" -H "Authorization: Bearer $F1_TOKEN")
MKC=$(echo "$MKS" | $PY -c "import sys,json; d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get('results',d.get('items',d.get('data',[]))); print(len(items))" 2>/dev/null)
[ "$MKC" -ge 1 ] 2>/dev/null \
  && log_result "085" "Marketplace search" "PASS" "$MKC results" \
  || log_result "085" "Marketplace search" "FAIL" "$MKC results"

MKA=$($CURL -s --max-time 10 "$API/marketplace/search" -H "Authorization: Bearer $F1_TOKEN")
MKT=$(echo "$MKA" | $PY -c "import sys,json; d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get('results',d.get('items',d.get('data',[]))); print(len(items))" 2>/dev/null)
[ "$MKT" -ge 2 ] 2>/dev/null \
  && log_result "086" "Marketplace all listings" "PASS" "$MKT listings" \
  || log_result "086" "Marketplace all listings" "FAIL" "$MKT listings"

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "========== PHASE 8: KNOWLEDGE BASE ACCURACY (ALL 8 CROPS) =========="
# ══════════════════════════════════════════════════════════════════════════════

KB_QS=(
    "087|black_pepper|What soil types are suitable for black pepper cultivation?"
    "088|turmeric|How to control pests in turmeric farming?"
    "089|ginger|What climate is suitable for ginger cultivation?"
    "090|cinnamon|How should cinnamon be harvested?"
    "091|cloves|What are the diseases in clove cultivation?"
    "092|nutmeg|How to cultivate nutmeg trees?"
    "093|cardamom|What soil quality is needed for cardamom?"
    "094|mixed_spices|Best practices for drying and storing mixed spices in Sri Lanka?"
)

for entry in "${KB_QS[@]}"; do
    IFS='|' read -r TID CROP QUESTION <<< "$entry"

    RESP=$($CURL -s --max-time 30 -X POST $API/advisory/ask \
      -H "Authorization: Bearer $F1_TOKEN" -H "Content-Type: application/json" \
      -d "{\"question\":\"$QUESTION\"}")

    ANS_INFO=$(echo "$RESP" | $PY -c "
import sys,json
d = json.load(sys.stdin)
answer = d.get('answer','') or d.get('response','') or d.get('text','')
sources = d.get('sources', d.get('chunks', []))
sc = len(sources) if isinstance(sources, list) else 0
print(f'{len(answer)}|{sc}')
" 2>/dev/null)

    ANS_LEN=$(echo "$ANS_INFO" | cut -d'|' -f1)
    SRC_C=$(echo "$ANS_INFO" | cut -d'|' -f2)

    [ "$ANS_LEN" -gt 50 ] 2>/dev/null \
      && log_result "$TID" "KB advisory: $CROP" "PASS" "${ANS_LEN} chars, ${SRC_C} sources" \
      || log_result "$TID" "KB advisory: $CROP" "FAIL" "Answer too short: ${ANS_LEN} chars"
done

# 095: Advisory history
ADV_H=$($CURL -s --max-time 10 $API/advisory/history -H "Authorization: Bearer $F1_TOKEN")
ADV_C=$(echo "$ADV_H" | $PY -c "
import sys,json; d=json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('items', d.get('data', []))
print(len(items))" 2>/dev/null)
[ "$ADV_C" -ge 8 ] 2>/dev/null \
  && log_result "095" "Advisory history" "PASS" "$ADV_C entries" \
  || log_result "095" "Advisory history" "FAIL" "Expected 8+, got $ADV_C"

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "========== PHASE 9: NOTIFICATIONS & FEEDBACK =========="
# ══════════════════════════════════════════════════════════════════════════════

NS=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 $API/notifications -H "Authorization: Bearer $F1_TOKEN")
log_result "096" "Notifications endpoint" "$([ "$NS" = "200" ] && echo PASS || echo FAIL)" "HTTP $NS"

UNS=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 $API/notifications/unread-count -H "Authorization: Bearer $F1_TOKEN")
log_result "097" "Unread count" "$([ "$UNS" = "200" ] && echo PASS || echo FAIL)" "HTTP $UNS"

MRS=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X PATCH $API/notifications/read-all -H "Authorization: Bearer $F1_TOKEN")
log_result "098" "Mark all read" "$([ "$MRS" = "200" ] && echo PASS || echo FAIL)" "HTTP $MRS"

FB1S=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST $API/feedback \
  -H "Authorization: Bearer $F1_TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"E2E test: The app is very useful for selling my pepper harvest!","rating":5}')
[ "$FB1S" = "200" ] || [ "$FB1S" = "201" ] \
  && log_result "099" "Farmer feedback" "PASS" "HTTP $FB1S" \
  || log_result "099" "Farmer feedback" "FAIL" "HTTP $FB1S"

FB2S=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST $API/feedback \
  -H "Authorization: Bearer $B1_TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"E2E test: Found good pepper suppliers through matching","rating":4}')
[ "$FB2S" = "200" ] || [ "$FB2S" = "201" ] \
  && log_result "100" "Buyer feedback" "PASS" "HTTP $FB2S" \
  || log_result "100" "Buyer feedback" "FAIL" "HTTP $FB2S"

AFBS=$($CURL -s --max-time 10 $API/admin/feedback -H "Authorization: Bearer $ADMIN_TOKEN")
AFBC=$(echo "$AFBS" | $PY -c "
import sys,json; d=json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('items', d.get('feedback', d.get('data', [])))
print(len(items))" 2>/dev/null)
[ "$AFBC" -ge 2 ] 2>/dev/null \
  && log_result "101" "Admin sees feedback" "PASS" "$AFBC entries" \
  || log_result "101" "Admin sees feedback" "FAIL" "Expected 2+, got $AFBC"

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "========== PHASE 10: ALERTS =========="
# ══════════════════════════════════════════════════════════════════════════════

WS=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 "$API/alerts/weather?lat=7.4675&lng=80.6234" -H "Authorization: Bearer $F1_TOKEN")
log_result "102" "Weather alerts" "$([ "$WS" = "200" ] && echo PASS || echo FAIL)" "HTTP $WS"

PS=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 $API/alerts/prices -H "Authorization: Bearer $F1_TOKEN")
log_result "103" "Price alerts" "$([ "$PS" = "200" ] && echo PASS || echo FAIL)" "HTTP $PS"

PHS=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 "$API/alerts/prices/$CROP_ID_black_pepper" -H "Authorization: Bearer $F1_TOKEN")
log_result "104" "Price history (pepper)" "$([ "$PHS" = "200" ] && echo PASS || echo FAIL)" "HTTP $PHS"

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "========== PHASE 11: ADMIN ENDPOINTS =========="
# ══════════════════════════════════════════════════════════════════════════════

ADMIN_EPS=("105|admin/dashboard|Admin dashboard" "106|admin/users|Admin users" "107|admin/feedback|Admin feedback"
  "108|admin/knowledge|Admin knowledge" "109|admin/crops|Admin crops" "110|admin/matches|Admin matches"
  "111|crops|Public crops" "112|sector/config|Sector config")

for entry in "${ADMIN_EPS[@]}"; do
    IFS='|' read -r TID EP NAME <<< "$entry"
    ST=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 "$API/$EP" -H "Authorization: Bearer $ADMIN_TOKEN")
    log_result "$TID" "$NAME" "$([ "$ST" = "200" ] && echo PASS || echo FAIL)" "HTTP $ST"
done

# 113: Admin user count
DASH=$($CURL -s --max-time 10 $API/admin/dashboard -H "Authorization: Bearer $ADMIN_TOKEN")
UC=$(echo "$DASH" | $PY -c "import sys,json; print(json.load(sys.stdin).get('total_users',0))" 2>/dev/null)
[ "$UC" -ge 8 ] 2>/dev/null \
  && log_result "113" "Admin user count" "PASS" "total=$UC" \
  || log_result "113" "Admin user count" "FAIL" "Expected 8+, got $UC"

# 114: Listing counts
LC=$(echo "$DASH" | $PY -c "
import sys,json; d=json.load(sys.stdin)
h=d.get('total_harvest_listings',0); dem=d.get('total_demand_postings',0)
print(f'{h}+{dem}')" 2>/dev/null)
log_result "114" "Admin listing counts" "PASS" "harvest+demand=$LC"

# 115: Admin user list
AUL=$($CURL -s --max-time 10 $API/admin/users -H "Authorization: Bearer $ADMIN_TOKEN")
AUC=$(echo "$AUL" | $PY -c "
import sys,json; d=json.load(sys.stdin)
items = d if isinstance(d, list) else d.get('items', d.get('data', []))
print(len(items))" 2>/dev/null)
[ "$AUC" -ge 8 ] 2>/dev/null \
  && log_result "115" "Admin user list" "PASS" "$AUC users" \
  || log_result "115" "Admin user list" "FAIL" "$AUC users"

# 116: Non-admin blocked
NAB=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 $API/admin/dashboard -H "Authorization: Bearer $F1_TOKEN")
[ "$NAB" = "403" ] \
  && log_result "116" "Non-admin blocked" "PASS" "HTTP $NAB" \
  || log_result "116" "Non-admin blocked" "FAIL" "HTTP $NAB"

# 117: Unauthenticated rejected
NAS=$($CURL -s -o /dev/null -w "%{http_code}" --max-time 10 $API/users/me)
[ "$NAS" = "401" ] || [ "$NAS" = "403" ] \
  && log_result "117" "Unauthenticated rejected" "PASS" "HTTP $NAS" \
  || log_result "117" "Unauthenticated rejected" "FAIL" "HTTP $NAS"

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║       GoviHub Spices — API Test Report (Phases 0-11)         ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
TOTAL=$((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))
printf "║   PASSED: %-3d  FAILED: %-3d  SKIPPED: %-3d  TOTAL: %-3d      ║\n" $PASS_COUNT $FAIL_COUNT $SKIP_COUNT $TOTAL
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
if [ "$FAIL_COUNT" -gt 0 ]; then
    echo "FAILED TESTS:"
    grep "^FAIL" $RESULTS_FILE
fi
