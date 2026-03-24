# GoviHub Build Runner — Instructions for Claude Code

## How to Use This

Open Claude Code in your terminal and run this master instruction. Claude Code will read each prompt file in sequence and execute them.

### Command to start:

```bash
claude "Read the file /home/claude/govihub-prompts/00_MASTER_ORCHESTRATOR.md for project context, then execute each prompt in /home/claude/govihub-prompts/ in numerical order (01 through 15). For each prompt: read the file, execute ALL instructions completely, run verifications, write a report to /home/claude/govihub-prompts/reports/REPORT_XX.md, then proceed to the next. If any prompt fails verification, stop and report. Begin with 01_PROJECT_SCAFFOLDING.md now."
```

### If you need to resume from a specific prompt:

```bash
claude "Read /home/claude/govihub-prompts/00_MASTER_ORCHESTRATOR.md for context. The project is partially built — prompts 01 through NN are complete (check reports in /home/claude/govihub-prompts/reports/). Resume execution from prompt (NN+1). Read the prompt file, execute all instructions, verify, report, and continue sequentially."
```

### If a single prompt is too large for one session:

Some prompts (especially 13 and 14 — frontend) are substantial. You can split execution:

```bash
# For prompt 14, split by role:
claude "Read /home/claude/govihub-prompts/14_FRONTEND_FEATURES.md. Execute ONLY the Farmer Pages section (items 1-6). Write partial report."
claude "Continue /home/claude/govihub-prompts/14_FRONTEND_FEATURES.md. Execute Buyer Pages (items 7-9) and Supplier Pages (items 10-11). Write partial report."
claude "Continue /home/claude/govihub-prompts/14_FRONTEND_FEATURES.md. Execute Admin Pages (items 12-16) and Shared Pages (items 17-18). Write final report."
```

## Prompt Inventory

| File | Description | Dependencies |
|------|-------------|--------------|
| `00_MASTER_ORCHESTRATOR.md` | Project context, env vars, tech stack | None — read first |
| `01_PROJECT_SCAFFOLDING.md` | Monorepo, Docker, configs, skeletons | None |
| `02_DATABASE_MIGRATIONS.md` | Models, Alembic, seeds | 01 |
| `03_AUTH_MODULE.md` | Google OAuth, JWT, RBAC | 01, 02 |
| `04_USER_PROFILE_MODULE.md` | Registration, profiles, preferences | 01, 02, 03 |
| `05_LISTINGS_MODULE.md` | Harvest + Demand CRUD | 01-04 |
| `06_MATCHING_ENGINE.md` | Scoring algorithm, lifecycle | 01-05 |
| `07_DIAGNOSIS_MODULE.md` | CNN + OpenRouter advice | 01-04 |
| `08_ADVISORY_RAG_MODULE.md` | Embeddings, pgvector, RAG | 01-04 |
| `09_MARKETPLACE_ALERTS.md` | Supply listings, weather, prices | 01-04 |
| `10_NOTIFICATIONS_MODULE.md` | FCM, SMS, in-app dispatch | 01-04 |
| `11_ADMIN_MODULE.md` | Admin dashboard, management | 01-10 |
| `12_MCP_ENDPOINTS.md` | MCP SSE server, admin tools | 01-11 |
| `13_FRONTEND_FOUNDATION.md` | Design system, auth, i18n, layouts | 01 (backend running) |
| `14_FRONTEND_FEATURES.md` | All role-specific pages | 13 |
| `15_INTEGRATION_DEPLOY.md` | Tests, deploy scripts, production | 01-14 |

## Expected Total Output

When all 15 prompts complete:
- **Backend**: ~80 Python files, 14+ model classes, 50+ API endpoints, 10 MCP tools
- **Frontend**: ~60 React/TypeScript files, 20+ pages, 20+ UI components, 3 locales
- **Infrastructure**: Docker Compose (4 services), Nginx config, deploy scripts, backup automation
- **Tests**: 50+ test cases covering all modules
- **Documentation**: Setup guide, production checklist, MCP client guide

## Estimated Build Time

With Claude Code (Opus tier): approximately 3-5 hours of sequential execution.
With Claude Code (Sonnet tier): approximately 5-8 hours.

Prompts 01-02 are fastest (~15-20 min each). Prompts 13-14 are slowest (~45-60 min each).
