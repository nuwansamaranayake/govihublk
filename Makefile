.PHONY: dev prod down logs migrate seed test shell-api shell-db backup restore

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
