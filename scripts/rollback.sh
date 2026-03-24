#!/usr/bin/env bash
# =============================================================================
# GoviHub Rollback Script
# Restores database from backup and restarts previous Docker images.
# =============================================================================

set -euo pipefail

VPS_HOST="${VPS_HOST:-govihublk.com}"
VPS_USER="${VPS_USER:-deploy}"
VPS_SSH_KEY="${VPS_SSH_KEY:-~/.ssh/govihub_deploy}"
REMOTE_DIR="${REMOTE_DIR:-/opt/govihub}"
BACKUP_DIR="${BACKUP_DIR:-/opt/govihub/backups}"
R2_BUCKET="${R2_BUCKET:-govihub}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}  $(date '+%H:%M:%S') $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $(date '+%H:%M:%S') $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $(date '+%H:%M:%S') $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $*" >&2; }

SSH_CMD="ssh -i $VPS_SSH_KEY -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST"
DOCKER_COMPOSE_FILE="docker-compose.yml"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

BACKUP_TAG=""
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --tag)   BACKUP_TAG="$2"; shift ;;
    --file)  BACKUP_FILE="$2"; shift ;;
    --list)
      log_info "Available backups:"
      $SSH_CMD "ls -lt $BACKUP_DIR/*.sql.gz 2>/dev/null | head -20" || echo "  (none found)"
      exit 0
      ;;
    *) log_error "Unknown argument: $1"; exit 1 ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# Determine backup to restore
# ---------------------------------------------------------------------------

if [[ -z "$BACKUP_FILE" && -z "$BACKUP_TAG" ]]; then
  log_info "No backup specified — using most recent backup"
  BACKUP_FILE=$($SSH_CMD "ls -t $BACKUP_DIR/*.sql.gz 2>/dev/null | head -1")
  if [[ -z "$BACKUP_FILE" ]]; then
    log_error "No backup files found in $BACKUP_DIR"
    exit 1
  fi
elif [[ -n "$BACKUP_TAG" ]]; then
  BACKUP_FILE="$BACKUP_DIR/govihub_${BACKUP_TAG}.sql.gz"
fi

log_info "Rollback target: $BACKUP_FILE"

# Confirm with user
echo ""
echo -e "${RED}WARNING: This will restore the database from backup.${NC}"
echo -e "${RED}Current database will be OVERWRITTEN. This is irreversible.${NC}"
echo ""
read -r -p "Are you sure you want to roll back? [yes/N] " confirm

if [[ "$confirm" != "yes" ]]; then
  log_warn "Rollback cancelled"
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 1: Stop application services (keep database running)
# ---------------------------------------------------------------------------

log_info "=== Step 1: Stopping application services ==="

$SSH_CMD "cd $REMOTE_DIR && \
  docker compose -f $DOCKER_COMPOSE_FILE stop govihub-api govihub-web nginx"

log_success "Application services stopped"

# ---------------------------------------------------------------------------
# Step 2: Restore database backup
# ---------------------------------------------------------------------------

log_info "=== Step 2: Restoring database from $BACKUP_FILE ==="

# If backup is on R2, download it first
if [[ "$BACKUP_FILE" == s3://* ]]; then
  log_info "Downloading backup from R2..."
  LOCAL_BACKUP="/tmp/govihub_rollback_$(date +%s).sql.gz"
  $SSH_CMD "aws s3 cp '$BACKUP_FILE' '$LOCAL_BACKUP' \
    --endpoint-url=https://\${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
  BACKUP_FILE="$LOCAL_BACKUP"
fi

$SSH_CMD "cd $REMOTE_DIR && \
  docker compose -f $DOCKER_COMPOSE_FILE exec -T postgres \
    dropdb --if-exists -U govihub govihub && \
  docker compose -f $DOCKER_COMPOSE_FILE exec -T postgres \
    createdb -U govihub govihub && \
  gunzip -c '$BACKUP_FILE' | \
    docker compose -f $DOCKER_COMPOSE_FILE exec -T postgres \
      psql -U govihub govihub"

log_success "Database restored from backup"

# ---------------------------------------------------------------------------
# Step 3: Roll back Docker images to previous tag
# ---------------------------------------------------------------------------

log_info "=== Step 3: Restarting with previous image tag ==="

# Check if there's a previous image tagged as 'previous'
PREV_API=$($SSH_CMD "docker images govihub-api:previous -q 2>/dev/null || true")

if [[ -n "$PREV_API" ]]; then
  log_info "Found previous API image — restoring"
  $SSH_CMD "cd $REMOTE_DIR && \
    docker tag govihub-api:latest govihub-api:failed && \
    docker tag govihub-api:previous govihub-api:latest"
fi

# Restart services
$SSH_CMD "cd $REMOTE_DIR && \
  docker compose -f $DOCKER_COMPOSE_FILE up -d govihub-api govihub-web nginx"

log_success "Services restarted"

# ---------------------------------------------------------------------------
# Step 4: Verify rollback health
# ---------------------------------------------------------------------------

log_info "=== Step 4: Verifying health after rollback ==="

sleep 10
MAX_RETRIES=20
RETRY_COUNT=0
until curl -sf "https://$VPS_HOST/api/v1/health" > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [[ $RETRY_COUNT -ge $MAX_RETRIES ]]; then
    log_error "Health check failed after rollback"
    log_error "Manual intervention may be required"
    exit 1
  fi
  sleep 5
done

log_success "Application is healthy after rollback"
log_info "Rollback completed successfully"
