.PHONY: dev prod down logs migrate seed test shell-api shell-db backup restore \
       local-setup local-up local-down local-restart local-logs local-logs-api \
       local-logs-web local-psql local-redis local-test-api local-fresh

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

prod:
	docker compose -f docker-compose.yml up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose exec govihub-api alembic upgrade head

seed:
	docker compose exec govihub-api python -m scripts.seed

test:
	docker compose exec govihub-api pytest -v

shell-api:
	docker compose exec govihub-api bash

shell-db:
	docker compose exec postgres psql -U govihub -d govihub

backup:
	@mkdir -p backups
	docker compose exec postgres pg_dump -U govihub govihub | gzip > backups/govihub_$$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "Backup saved to backups/"

restore:
	@LATEST=$$(ls -t backups/*.sql.gz 2>/dev/null | head -1); \
	if [ -z "$$LATEST" ]; then echo "No backup found"; exit 1; fi; \
	echo "Restoring from $$LATEST"; \
	gunzip -c "$$LATEST" | docker compose exec -T postgres psql -U govihub -d govihub

# ============================================
# Local development (standalone docker-compose.dev.yml)
# ============================================

local-setup:
	@bash scripts/local-setup.sh

local-up:
	docker compose -f docker-compose.dev.yml up -d

local-down:
	docker compose -f docker-compose.dev.yml down

local-restart:
	docker compose -f docker-compose.dev.yml restart govihub-api govihub-web

local-logs:
	docker compose -f docker-compose.dev.yml logs -f

local-logs-api:
	docker compose -f docker-compose.dev.yml logs -f govihub-api

local-logs-web:
	docker compose -f docker-compose.dev.yml logs -f govihub-web

local-psql:
	docker compose -f docker-compose.dev.yml exec postgres psql -U govihub -d govihub

local-redis:
	docker compose -f docker-compose.dev.yml exec redis redis-cli

local-test-api:
	@bash scripts/test-api.sh

local-fresh:
	docker compose -f docker-compose.dev.yml down -v
	@bash scripts/local-setup.sh
