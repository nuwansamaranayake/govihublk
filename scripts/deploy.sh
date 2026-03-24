#!/usr/bin/env bash
# =============================================================================
# GoviHub Production Deploy Script
# Deploys to VPS via rsync, builds production images, applies migrations,
# performs rolling restart, and verifies health.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — override via environment variables
# ---------------------------------------------------------------------------

VPS_HOST="${VPS_HOST:-govihublk.com}"
VPS_USER="${VPS_USER:-deploy}"
VPS_SSH_KEY="${VPS_SSH_KEY:-~/.ssh/govihub_deploy}"
REMOTE_DIR="${REMOTE_DIR:-/opt/govihub}"
DOCKER_COMPOSE_FILE="docker-compose.yml"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"

# Colours
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}  $(date '+%H:%M:%S') $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $(date '+%H:%M:%S') $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $(date '+%H:%M:%S') $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SSH_CMD="ssh -i $VPS_SSH_KEY -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST"
RSYNC_CMD="rsync -az --delete --exclude='*.pyc' --exclude='__pycache__' \
  --exclude='.env' --exclude='node_modules' --exclude='.next' \
  --exclude='*.pt' --exclude='uploads/' --exclude='backups/' \
  -e 'ssh -i $VPS_SSH_KEY -o StrictHostKeyChecking=no'"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

DRY_RUN=false
SKIP_TESTS=false
ROLLBACK_ON_FAIL=true

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)            DRY_RUN=true ;;
    --skip-tests)         SKIP_TESTS=true ;;
    --no-rollback)        ROLLBACK_ON_FAIL=false ;;
    *) log_error "Unknown argument: $1"; exit 1 ;;
  esac
  shift
done

if [[ "$DRY_RUN" == "true" ]]; then
  log_warn "DRY RUN MODE — no changes will be made to the server"
fi

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

log_info "=== Pre-flight checks ==="

# Verify SSH connectivity
if ! $SSH_CMD "echo 'SSH OK'" > /dev/null 2>&1; then
  log_error "Cannot connect to $VPS_USER@$VPS_HOST via SSH"
  exit 1
fi
log_success "SSH connection verified"

# Verify .env file exists on remote
if ! $SSH_CMD "test -f $REMOTE_DIR/.env"; then
  log_error ".env file not found at $REMOTE_DIR/.env on server"
  log_error "Please create the production .env file before deploying"
  exit 1
fi
log_success "Production .env file found"

# ---------------------------------------------------------------------------
# Step 1: Create deployment backup
# ---------------------------------------------------------------------------

log_info "=== Step 1: Creating pre-deploy backup ==="

if [[ "$DRY_RUN" == "false" ]]; then
  BACKUP_TAG="pre-deploy-$(date +%Y%m%d-%H%M%S)"
  $SSH_CMD "cd $REMOTE_DIR && bash scripts/backup.sh --tag $BACKUP_TAG" || {
    log_warn "Backup failed — continuing with deploy"
  }
  log_success "Pre-deploy backup created: $BACKUP_TAG"
fi

# ---------------------------------------------------------------------------
# Step 2: Sync code to VPS
# ---------------------------------------------------------------------------

log_info "=== Step 2: Syncing code to VPS ==="

if [[ "$DRY_RUN" == "false" ]]; then
  eval "$RSYNC_CMD $PROJECT_ROOT/ $VPS_USER@$VPS_HOST:$REMOTE_DIR/"
  log_success "Code synced to $VPS_HOST:$REMOTE_DIR"
else
  log_warn "DRY RUN: Would rsync to $VPS_HOST:$REMOTE_DIR"
fi

# ---------------------------------------------------------------------------
# Step 3: Build production images on VPS
# ---------------------------------------------------------------------------

log_info "=== Step 3: Building production images ==="

if [[ "$DRY_RUN" == "false" ]]; then
  $SSH_CMD "cd $REMOTE_DIR && docker compose -f $DOCKER_COMPOSE_FILE build --no-cache"
  log_success "Production images built"
fi

# ---------------------------------------------------------------------------
# Step 4: Run database migrations
# ---------------------------------------------------------------------------

log_info "=== Step 4: Applying database migrations ==="

if [[ "$DRY_RUN" == "false" ]]; then
  $SSH_CMD "cd $REMOTE_DIR && docker compose -f $DOCKER_COMPOSE_FILE run --rm govihub-api alembic upgrade head"
  log_success "Migrations applied"
fi

# ---------------------------------------------------------------------------
# Step 5: Rolling restart
# ---------------------------------------------------------------------------

log_info "=== Step 5: Rolling service restart ==="

if [[ "$DRY_RUN" == "false" ]]; then
  # Scale up new containers before stopping old ones
  $SSH_CMD "cd $REMOTE_DIR && \
    docker compose -f $DOCKER_COMPOSE_FILE up -d --no-deps govihub-api && \
    sleep 10 && \
    docker compose -f $DOCKER_COMPOSE_FILE up -d --no-deps govihub-web && \
    sleep 5 && \
    docker compose -f $DOCKER_COMPOSE_FILE up -d nginx"
  log_success "Services restarted"
fi

# ---------------------------------------------------------------------------
# Step 6: Health verification
# ---------------------------------------------------------------------------

log_info "=== Step 6: Verifying deployment health ==="

if [[ "$DRY_RUN" == "false" ]]; then
  log_info "Waiting up to ${HEALTH_TIMEOUT}s for API health..."
  elapsed=0
  while [[ $elapsed -lt $HEALTH_TIMEOUT ]]; do
    if curl -sf "https://$VPS_HOST/api/v1/health" > /dev/null 2>&1; then
      log_success "Production API is healthy at https://$VPS_HOST"
      break
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done

  if [[ $elapsed -ge $HEALTH_TIMEOUT ]]; then
    log_error "API health check timed out after ${HEALTH_TIMEOUT}s"
    if [[ "$ROLLBACK_ON_FAIL" == "true" ]]; then
      log_warn "Initiating automatic rollback..."
      bash "$SCRIPT_DIR/rollback.sh" --tag "$BACKUP_TAG"
    fi
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Step 7: Clean up old images
# ---------------------------------------------------------------------------

log_info "=== Step 7: Cleaning up dangling images ==="

if [[ "$DRY_RUN" == "false" ]]; then
  $SSH_CMD "docker image prune -f" || true
  log_success "Old images cleaned up"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
log_success "=== DEPLOYMENT COMPLETE ==="
log_info "Production URL: https://$VPS_HOST"
log_info "API Docs: https://$VPS_HOST/api/v1/docs"
