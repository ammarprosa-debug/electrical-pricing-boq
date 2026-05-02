# نظام تسعير المشاريع الكهربائية بالذكاء الاصطناعي
## AI-Powered Electrical Project BOQ Pricing System (Saudi Market)

## Overview

A professional multi-agent AI system that automatically prices electrical project BOQs (Bill of Quantities) for the Saudi Arabian market. Users upload BOQ files and the system uses Claude AI to price every line item, generating reports in Arabic and English with 3 pricing scenarios.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifact: electrical-pricing, preview: /)
- **API framework**: Express 5 (artifact: api-server, preview: /api)
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: Claude (claude-haiku-4-5 for batch pricing) via Replit AI Integrations
- **Validation**: Zod (zod/v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **File upload**: multer (in-memory)

## Architecture — 17-Agent Intelligence Pipeline

```
[User uploads BOQ file (CSV/XLSX/PDF)]
        ↓
[Document Parser] → Extracts line items, classifies categories
        ↓
[AI Pricing Agent] → Claude haiku prices batches of 20 items
        ↓ (Stage 1: Market & Compliance — parallel)
[Agent 1] KSA Market Price Comparator  ─┐
[Agent 2] Compliance & Consistency     ─┤→ priceReviews DB
        ↓ (Stage 2: Takeoff — parallel)
[Agent 3] Material Takeoff (MTO)       ─┐
[Agent 4] BOM Enrichment               ─┤→ materialTakeoff DB
        ↓ (Stage 3: Intelligence — parallel)
[Agent 5] Anomaly Detection (IQR)       → priceReviews (anomaly_detector)
[Agent 6] Commodity Risk Analyzer       → projectRisk DB
[Agent 7] Scope Gap Analyzer            → scopeGaps DB
[Agent 8] Negotiation Strategy          → in-memory result
[Agent 9] Alternative Materials         → alternatives DB
        ↓ (Stage 4: BOQ Optimization — parallel)
[Agent 10] Labor Cost Optimizer         → laborCosts DB
[Agent 11] Procurement & Supplier Group → procurement DB
[Agent 12] Value Engineering            → valueEngineering DB
[Agent 13] Project Timeline & Phasing   → projectTimeline DB
[Agent 14] Subcontractor BOQ Split      → subcontractorSplit DB
        ↓ (Stage 5: Professional BOQ Output — sequential)
[Agent 15] Materials Price Manager      → materialPriceHistory DB (global)
[Agent 16] BOQ Document Formatter       → boqDocuments DB (HTML output)
[Agent 17] BOQ Technical Reviewer       → priceReviews + scopeGaps DB
        ↓
[Report Generator] → CSV/HTML reports (Economical | Standard | Premium)
```

## Key Features

- **Multi-format file upload**: CSV, Excel, PDF, DOCX
- **AI batch pricing**: 20 items per Claude API call for token efficiency
- **3 pricing scenarios**: Economical / Standard / Premium with Saudi VAT (15%)
- **Labor cost calculator**: Region-specific rates (Riyadh/Jeddah/Dammam)
- **SASO compliance checking**: Pass/Warning/Fail per item
- **Human review queue**: Items with confidence <70% flagged for review
- **Bilingual UI**: English/Arabic descriptions, RTL support
- **Agent 10 — Labor Optimizer**: Productivity rates, site-specific adjustments, crew optimization
- **Agent 11 — Procurement**: Supplier grouping, bulk discounts, lead times per trade
- **Agent 12 — Value Engineering**: Cost reduction alternatives maintaining SASO compliance
- **Agent 13 — Timeline**: Phase scheduling, critical path, manpower histogram
- **Agent 14 — Subcontractor Split**: BOQ split by trade with overhead/profit per subcontractor
- **Agent 15 — Materials Price Manager**: AI agent to update market prices from KSA signals
- **Agent 16 — BOQ Formatter**: Generates professional HTML BOQ document (print-ready)
- **Agent 17 — BOQ Reviewer**: Technical review, price reasonability, scope completeness
- **Project Intelligence page** (`/intelligence`): Unified view of all 9 basic agents + link to BOQ report
- **BOQ Report page** (`/boq-report`): Agents 10-14 + BOQ document output (16-17)
- **Materials DB page** (`/materials-db`): AI-powered materials price management (Agent 15)

## Database Tables

- `projects` — pricing projects with status and 3-scenario totals
- `boq_items` — individual BOQ line items with pricing, confidence, compliance, anomaly flags
- `materials` — Saudi electrical materials price database
- `conversations` + `messages` — Anthropic AI integration tables
- `price_reviews` — AI agent review findings (agents 1, 2, 5, 17)
- `material_takeoff` — sub-component breakdown (agents 3, 4)
- `scope_gaps` — missing required systems (agent 7, 17)
- `project_risk` — commodity exposure analysis (agent 6)
- `alternatives` — cheaper material alternatives (agent 9)
- `labor_costs` — crew plans, productivity, site adjustments (agent 10)
- `procurement` — supplier groupings, bulk discounts, lead times (agent 11)
- `value_engineering` — VE findings and approved substitutions (agent 12)
- `project_timeline` — phase schedule, critical path, milestones (agent 13)
- `subcontractor_split` — BOQ split by trade/subcontractor (agent 14)
- `material_price_history` — historical price updates from AI manager (agent 15)
- `boq_documents` — formatted BOQ HTML documents (agent 16)

## GitHub Auto-Sync

Every Replit commit is automatically pushed to GitHub via a git post-commit hook.

### Required secrets / env vars
| Name | Type | Description |
|------|------|-------------|
| `GITHUB_TOKEN` | Secret | GitHub Personal Access Token with `repo` (full) scope |
| `GITHUB_REPO_URL` | Shared env var | Target repo URL, e.g. `https://github.com/ammarprosa-debug/electrical-pricing-boq` |

### How it works
1. `scripts/github-sync-hook.sh` — the sync script. Reads `GITHUB_TOKEN` + `GITHUB_REPO_URL`, configures a `github` git remote with token-based authentication, and pushes the current branch. Skips silently if either variable is missing.
2. `scripts/install-github-hook.sh` — installs the above script as `.git/hooks/post-commit`. Run this manually if you clone the repo or if the hook disappears.
3. `scripts/post-merge.sh` — runs the installer automatically after every task merge so the hook survives Replit's merge process.

### Re-installing the hook manually
```bash
bash scripts/install-github-hook.sh
```

### Troubleshooting
- **Push skipped** — check that both `GITHUB_TOKEN` and `GITHUB_REPO_URL` are set (Replit Secrets / Env Vars panel).
- **Permission denied / 403** — ensure `GITHUB_TOKEN` has `repo` write scope and hasn't expired. Rotate it at https://github.com/settings/tokens.
- **Repository not found** — verify `GITHUB_REPO_URL` is the full `https://github.com/owner/repo` URL (no trailing slash, no embedded credentials).
- **Push protection blocked** — GitHub detected a secret in a historical commit. Remove it from history or allow it at the URL shown in the error.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, run from lib/db/)

## Important Notes

- Use `zod/v4` (NOT `zod`) in all DB schema files
- Import `.js` extension in ESM API server imports
- DB package: `@workspace/db`; run migrations from `lib/db/` directory
- `@workspace/integrations-anthropic-ai` provides **named export** `{ anthropic }` (NOT default import)
- Drizzle v2: use `and()` combinator for multiple WHERE conditions
- Agent job status tracked in-memory Map in `agents.ts` router; no Redis needed
- Proxy: frontend `/`, API `/api`; use `localhost:80` for curl

## API Routes

### Core
- `GET /api/projects` — list all projects
- `POST /api/projects` — create new project
- `GET /api/projects/:id` — project detail with BOQ items
- `POST /api/projects/:id/upload` — upload BOQ file (multipart/form-data, field: "file")
- `POST /api/projects/:id/price` — start AI pricing pipeline
- `GET /api/projects/:id/status` — get pricing job status
- `GET /api/projects/:id/summary` — pricing summary with 3 scenarios
- `GET /api/projects/:id/report/excel` — download CSV report
- `GET /api/projects/:id/report/pdf` — download HTML summary (Arabic)
- `GET /api/projects/stats` — dashboard statistics

### AI Agents (POST to run, GET to read results)
- `POST /api/projects/:id/agents/price-review` — Agent 1: KSA Market Price Comparator
- `POST /api/projects/:id/agents/compliance-review` — Agent 2: Compliance Validator
- `POST /api/projects/:id/agents/material-takeoff` — Agent 3+4: MTO + BOM Enrichment
- `POST /api/projects/:id/agents/anomaly-detection` — Agent 5: IQR Anomaly Detection
- `POST /api/projects/:id/agents/risk-analysis` — Agent 6: Commodity Risk
- `POST /api/projects/:id/agents/scope-analysis` — Agent 7: Scope Gap Analyzer
- `POST /api/projects/:id/agents/negotiation` — Agent 8: Negotiation Strategy
- `POST /api/projects/:id/agents/alternatives` — Agent 9: Alternative Materials
- `POST /api/projects/:id/agents/labor-optimizer` — Agent 10: Labor Cost Optimizer
- `POST /api/projects/:id/agents/procurement` — Agent 11: Procurement & Supplier Grouping
- `POST /api/projects/:id/agents/value-engineering` — Agent 12: Value Engineering
- `POST /api/projects/:id/agents/timeline` — Agent 13: Project Timeline & Phasing
- `POST /api/projects/:id/agents/subcontractor-split` — Agent 14: Subcontractor BOQ Split
- `POST /api/projects/:id/agents/boq-formatter` — Agent 16: BOQ Document Formatter
- `POST /api/projects/:id/agents/boq-reviewer` — Agent 17: BOQ Technical Reviewer
- `POST /api/projects/:id/agents/run-all` — Run all 17 agents in 5-stage sequence
- `GET /api/projects/:id/agents/status` — All agent job statuses

### Materials Manager (Agent 15 — global, no project ID)
- `POST /api/agents/materials-price-update` — Trigger AI price update job
- `GET /api/agents/materials-price-update/status` — Job status + last run info

### BOQ Document
- `GET /api/projects/:id/boq-document` — Latest BOQ document record
- `GET /api/projects/:id/boq-document/html` — Rendered BOQ HTML (print-ready)

### Intelligence Data
- `GET /api/projects/:id/price-reviews` — Agent findings (filter: ?agent=&severity=)
- `GET /api/projects/:id/price-reviews/summary` — Summary stats
- `GET /api/projects/:id/scope-gaps` — Missing scope items
- `GET /api/projects/:id/risk` — Risk analysis result
- `GET /api/projects/:id/alternatives` — Alternative materials
- `GET /api/projects/:id/takeoff` — Material takeoff breakdown
- `GET /api/projects/:id/labor` — Labor optimization result
- `GET /api/projects/:id/procurement` — Procurement grouping result
- `GET /api/projects/:id/value-engineering` — VE findings
- `GET /api/projects/:id/timeline` — Project timeline/phases
- `GET /api/projects/:id/subcontractor-split` — Subcontractor BOQ split
