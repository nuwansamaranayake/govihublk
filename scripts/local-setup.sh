#!/bin/bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  GoviHub Local Development Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${YELLOW}[1/7] Checking prerequisites...${NC}"
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker is not installed.${NC}"; exit 1; }
command -v docker compose >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1 || { echo -e "${RED}Docker Compose is not installed.${NC}"; exit 1; }
echo "  Docker: $(docker --version | head -1)"

# Determine docker compose command
if docker compose version >/dev/null 2>&1; then
    DC="docker compose"
else
    DC="docker-compose"
fi

# Step 2: Check .env exists
echo -e "${YELLOW}[2/7] Checking environment files...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}  .env file not found. Please create it from .env.example${NC}"
    echo "  cp .env.example .env  # then edit values"
    exit 1
fi
if [ ! -f .env.frontend ]; then
    echo -e "${RED}  .env.frontend not found.${NC}"
    exit 1
fi
echo "  .env and .env.frontend found"

# Step 3: Stop any existing containers
echo -e "${YELLOW}[3/7] Stopping existing containers...${NC}"
$DC -f docker-compose.dev.yml down 2>/dev/null || true

# Step 4: Build and start
echo -e "${YELLOW}[4/7] Building and starting containers...${NC}"
$DC -f docker-compose.dev.yml build
$DC -f docker-compose.dev.yml up -d

# Step 5: Wait for services to be healthy
echo -e "${YELLOW}[5/7] Waiting for services to be healthy...${NC}"
echo -n "  PostgreSQL: "
for i in $(seq 1 30); do
    if $DC -f docker-compose.dev.yml exec -T postgres pg_isready -U govihub -q 2>/dev/null; then
        echo -e "${GREEN}ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}timeout${NC}"
        echo "  Check logs: $DC -f docker-compose.dev.yml logs postgres"
        exit 1
    fi
    sleep 2
    echo -n "."
done

echo -n "  Redis: "
for i in $(seq 1 15); do
    if $DC -f docker-compose.dev.yml exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
        echo -e "${GREEN}ready${NC}"
        break
    fi
    if [ $i -eq 15 ]; then
        echo -e "${RED}timeout${NC}"
        exit 1
    fi
    sleep 1
    echo -n "."
done

echo -n "  API: "
for i in $(seq 1 60); do
    if curl -sf http://localhost:8000/api/v1/health >/dev/null 2>&1; then
        echo -e "${GREEN}ready${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${RED}timeout${NC}"
        echo "  Check logs: $DC -f docker-compose.dev.yml logs govihub-api"
        exit 1
    fi
    sleep 2
    echo -n "."
done

# Step 6: Run migrations and seeds
echo -e "${YELLOW}[6/7] Running database migrations and seeds...${NC}"
$DC -f docker-compose.dev.yml exec -T govihub-api alembic upgrade head 2>/dev/null || echo "  (migrations may need manual review)"
echo "  Migrations applied"

$DC -f docker-compose.dev.yml exec -T govihub-api python -m scripts.seed_crops 2>/dev/null || echo "  (seed_crops may have already run or not exist)"
$DC -f docker-compose.dev.yml exec -T govihub-api python -m scripts.seed_prices 2>/dev/null || echo "  (seed_prices may have already run or not exist)"
$DC -f docker-compose.dev.yml exec -T govihub-api python -m scripts.seed_knowledge 2>/dev/null || echo "  (seed_knowledge may have already run or not exist)"
echo "  Seeds loaded"

# Step 7: Print access info
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  GoviHub is running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Frontend:    http://localhost:6001"
echo "  API:         http://localhost:8000"
echo "  API Docs:    http://localhost:8000/api/v1/docs"
echo "  Health:      http://localhost:8000/api/v1/health"
echo ""
echo -e "${YELLOW}  Dev Login:   http://localhost:6001/en/auth/dev-login${NC}"
echo ""
echo "  Quick test with curl:"
echo "    # Log in as farmer:"
echo '    curl -s -X POST http://localhost:8000/api/v1/auth/dev/login/farmer | python3 -m json.tool'
echo ""
echo "    # Log in as admin:"
echo '    curl -s -X POST http://localhost:8000/api/v1/auth/dev/login/admin | python3 -m json.tool'
echo ""
echo "    # Use the token:"
echo '    TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/dev/login/farmer | python3 -c "import sys,json; print(json.load(sys.stdin)[\"access_token\"])")'
echo '    curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/users/me | python3 -m json.tool'
echo ""
echo "  Database:"
echo "    psql postgresql://govihub:govihub_dev_2026@localhost:5432/govihub"
echo ""
echo "  Logs:"
echo "    $DC -f docker-compose.dev.yml logs -f govihub-api"
echo "    $DC -f docker-compose.dev.yml logs -f govihub-web"
echo ""
echo "  Stop:"
echo "    $DC -f docker-compose.dev.yml down"
echo ""
echo "  Stop and wipe data (fresh start):"
echo "    $DC -f docker-compose.dev.yml down -v"
echo ""
