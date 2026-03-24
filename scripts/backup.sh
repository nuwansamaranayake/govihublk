#!/usr/bin/env bash
# =============================================================================
# GoviHub Backup Script
# PostgreSQL dump → gzip → upload to Cloudflare R2 → cleanup old backups
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-govihub}"
DB_NAME="${DB_NAME:-govihub}"
DB_PASS="${DB_PASS:-password}"

BACKUP_DIR="${BACKUP_DIR:-/opt/govihub/backups}"
R2_BUCKET="${R2_BUCKET:-govihub}"
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
R2_PREFIX="${R2_PREFIX:-backups/postgres}"

RETENTION_DAYS="${RETENTION_DAYS:-30}"
RETENTION_R2_DAYS="${RETENTION_R2_DAYS:-90}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}  $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*" >&2; }

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

BACKUP_TAG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --tag) BACKUP_TAG="$2"; shift ;;
    *) log_error "Unknown argument: $1"; exit 1 ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# Prepare backup directory
# ---------------------------------------------------------------------------

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

if [[ -n "$BACKUP_TAG" ]]; then
  FILENAME="govihub_${BACKUP_TAG}.sql.gz"
else
  FILENAME="govihub_${TIMESTAMP}.sql.gz"
fi

BACKUP_PATH="$BACKUP_DIR/$FILENAME"
METADATA_PATH="$BACKUP_DIR/${FILENAME%.sql.gz}.meta.json"

log_info "Starting backup: $FILENAME"

# ---------------------------------------------------------------------------
# Step 1: PostgreSQL dump
# ---------------------------------------------------------------------------

log_info "=== Step 1: Creating PostgreSQL dump ==="

export PGPASSWORD="$DB_PASS"

pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --no-owner \
  --no-privileges \
  --format=plain \
  --verbose \
  2>/dev/null | gzip -9 > "$BACKUP_PATH"

BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
log_success "Database dump created: $BACKUP_PATH ($BACKUP_SIZE)"

# Write metadata
cat > "$METADATA_PATH" << EOF
{
  "filename": "$FILENAME",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "database": "$DB_NAME",
  "size_bytes": $(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH"),
  "tag": "$BACKUP_TAG"
}
EOF

# ---------------------------------------------------------------------------
# Step 2: Upload to Cloudflare R2
# ---------------------------------------------------------------------------

log_info "=== Step 2: Uploading to Cloudflare R2 ==="

if [[ -n "$R2_ACCOUNT_ID" && -n "$R2_ACCESS_KEY_ID" ]]; then
  R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
  R2_KEY="${R2_PREFIX}/${FILENAME}"

  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  aws s3 cp \
    "$BACKUP_PATH" \
    "s3://${R2_BUCKET}/${R2_KEY}" \
    --endpoint-url="$R2_ENDPOINT" \
    --storage-class=STANDARD

  log_success "Backup uploaded to R2: s3://${R2_BUCKET}/${R2_KEY}"

  # Upload metadata too
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  aws s3 cp \
    "$METADATA_PATH" \
    "s3://${R2_BUCKET}/${R2_PREFIX}/${FILENAME%.sql.gz}.meta.json" \
    --endpoint-url="$R2_ENDPOINT" 2>/dev/null || true
else
  log_warn "R2 credentials not configured — skipping remote upload"
  log_warn "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY to enable"
fi

# ---------------------------------------------------------------------------
# Step 3: Retention cleanup (local)
# ---------------------------------------------------------------------------

log_info "=== Step 3: Cleaning up local backups older than ${RETENTION_DAYS} days ==="

DELETED_COUNT=0
while IFS= read -r old_file; do
  rm -f "$old_file" "${old_file%.sql.gz}.meta.json"
  log_info "  Deleted: $(basename "$old_file")"
  DELETED_COUNT=$((DELETED_COUNT + 1))
done < <(find "$BACKUP_DIR" -name "govihub_*.sql.gz" -mtime +"$RETENTION_DAYS" 2>/dev/null)

if [[ $DELETED_COUNT -eq 0 ]]; then
  log_info "  No old backups to clean up"
else
  log_success "Cleaned up $DELETED_COUNT old local backups"
fi

# ---------------------------------------------------------------------------
# Step 4: Retention cleanup (R2)
# ---------------------------------------------------------------------------

if [[ -n "$R2_ACCOUNT_ID" && -n "$R2_ACCESS_KEY_ID" ]]; then
  log_info "=== Step 4: Cleaning up R2 backups older than ${RETENTION_R2_DAYS} days ==="

  CUTOFF_DATE=$(date -d "${RETENTION_R2_DAYS} days ago" +%Y-%m-%d 2>/dev/null || \
                date -v-${RETENTION_R2_DAYS}d +%Y-%m-%d)

  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  aws s3 ls \
    "s3://${R2_BUCKET}/${R2_PREFIX}/" \
    --endpoint-url="$R2_ENDPOINT" 2>/dev/null | \
  awk -v cutoff="$CUTOFF_DATE" '$1 < cutoff {print $4}' | \
  while read -r old_key; do
    if [[ "$old_key" == *.sql.gz ]]; then
      AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
      AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
      aws s3 rm \
        "s3://${R2_BUCKET}/${R2_PREFIX}/$old_key" \
        --endpoint-url="$R2_ENDPOINT" 2>/dev/null && \
        log_info "  Deleted from R2: $old_key" || true
    fi
  done

  log_success "R2 cleanup complete"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
log_success "=== BACKUP COMPLETE ==="
log_info "File:      $BACKUP_PATH"
log_info "Size:      $BACKUP_SIZE"
log_info "Timestamp: $TIMESTAMP"
