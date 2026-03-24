#!/usr/bin/env bash
# =============================================================================
# GoviHub Build & Test Pipeline
# Builds Docker images, starts services, runs health checks, migrations,
# seeds test data, and executes the full test suite.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev.yml"

# Colours
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

cleanup() {
  log_warn "Cleaning up test containers..."
  docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

SKIP_BUILD=false
SKIP_SEED=false
TEST_FILTER=""
KEEP_RUNNING=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build)   SKIP_BUILD=true ;;
    --skip-seed)    SKIP_SEED=true ;;
    --keep-running) KEEP_RUNNING=true ;;
    --filter)       TEST_FILTER="$2"; shift ;;
    *) log_error "Unknown argument: $1"; exit 1 ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# Trap for cleanup
# ---------------------------------------------------------------------------

if [[ "$KEEP_RUNNING" == "false" ]]; then
  trap cleanup EXIT
fi

# ---------------------------------------------------------------------------
# Step 1: Build Docker images
# ---------------------------------------------------------------------------

log_info "=== Step 1: Building Docker images ==="

if [[ "$SKIP_BUILD" == "false" ]]; then
  cd "$PROJECT_ROOT"
  docker compose -f "$COMPOSE_FILE" build --no-cache govihub-api govihub-web
  log_success "Docker images built successfully"
else
  log_warn "Skipping build (--skip-build flag set)"
fi

# ---------------------------------------------------------------------------
# Step 2: Start infrastructure services
# ---------------------------------------------------------------------------

log_info "=== Step 2: Starting infrastructure services ==="

cd "$PROJECT_ROOT"
docker compose -f "$COMPOSE_FILE" up -d postgres redis

# Wait for Postgres to be healthy
log_info "Waiting for PostgreSQL to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
until docker compose -f "$COMPOSE_FILE" exec postgres pg_isready -U govihub -d govihub -q 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
    log_error "PostgreSQL did not become ready within $MAX_RETRIES retries"
    exit 1
  fi
  sleep 2
done
log_success "PostgreSQL is ready"

# Wait for Redis
log_info "Waiting for Redis to be ready..."
RETRY_COUNT=0
until docker compose -f "$COMPOSE_FILE" exec redis redis-cli ping 2>/dev/null | grep -q PONG; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [[ $RETRY_COUNT -ge 15 ]]; then
    log_error "Redis did not become ready"
    exit 1
  fi
  sleep 2
done
log_success "Redis is ready"

# ---------------------------------------------------------------------------
# Step 3: Run database migrations
# ---------------------------------------------------------------------------

log_info "=== Step 3: Running Alembic migrations ==="

docker compose -f "$COMPOSE_FILE" run --rm govihub-api \
  alembic upgrade head

log_success "Database migrations applied"

# ---------------------------------------------------------------------------
# Step 4: Seed test data
# ---------------------------------------------------------------------------

if [[ "$SKIP_SEED" == "false" ]]; then
  log_info "=== Step 4: Seeding test data ==="

  docker compose -f "$COMPOSE_FILE" run --rm govihub-api \
    python scripts/seed_crops.py

  docker compose -f "$COMPOSE_FILE" run --rm govihub-api \
    python scripts/seed_knowledge.py

  log_success "Test data seeded"
else
  log_warn "Skipping seed (--skip-seed flag set)"
fi

# ---------------------------------------------------------------------------
# Step 5: Start application services
# ---------------------------------------------------------------------------

log_info "=== Step 5: Starting application services ==="

docker compose -f "$COMPOSE_FILE" up -d govihub-api govihub-web

# Wait for API health check
log_info "Waiting for API health endpoint..."
RETRY_COUNT=0
MAX_RETRIES=30
until curl -sf http://localhost:8000/api/v1/health > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
    log_error "API did not become healthy within $MAX_RETRIES retries"
    docker compose -f "$COMPOSE_FILE" logs govihub-api --tail=50
    exit 1
  fi
  sleep 3
done
log_success "API is healthy"

# Wait for frontend
log_info "Waiting for frontend..."
RETRY_COUNT=0
until curl -sf http://localhost:3000 > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [[ $RETRY_COUNT -ge 20 ]]; then
    log_warn "Frontend did not respond — continuing without it"
    break
  fi
  sleep 3
done
log_success "Frontend is ready"

# ---------------------------------------------------------------------------
# Step 6: Run test suite
# ---------------------------------------------------------------------------

log_info "=== Step 6: Running test suite ==="

PYTEST_ARGS="-v --tb=short --no-header -rN"
if [[ -n "$TEST_FILTER" ]]; then
  PYTEST_ARGS="$PYTEST_ARGS -k $TEST_FILTER"
fi

docker compose -f "$COMPOSE_FILE" run --rm \
  -e DATABASE_URL="postgresql+asyncpg://govihub:password@postgres:5432/govihub" \
  -e REDIS_URL="redis://redis:6379/0" \
  govihub-api \
  python -m pytest tests/ $PYTEST_ARGS

TEST_EXIT_CODE=$?

# ---------------------------------------------------------------------------
# Step 7: Summary
# ---------------------------------------------------------------------------

echo ""
if [[ $TEST_EXIT_CODE -eq 0 ]]; then
  log_success "=== ALL TESTS PASSED ==="
else
  log_error "=== TESTS FAILED (exit code: $TEST_EXIT_CODE) ==="
fi

exit $TEST_EXIT_CODE
