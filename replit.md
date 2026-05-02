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

## Architecture — 9-Agent Intelligence Pipeline

```
[User uploads BOQ file (CSV/XLSX/PDF)]
        ↓
[Document Parser] → Extracts line items, classifies categories
        ↓
[AI Pricing Agent] → Claude haiku prices batches of 20 items
        ↓ (Parallel Stage)
[Agent 1] KSA Market Price Comparator  ─┐
[Agent 2] Compliance & Consistency     ─┤→ priceReviews DB
        ↓ (Parallel Stage)
[Agent 3] Material Takeoff (MTO)       ─┐
[Agent 4] BOM Enrichment               ─┤→ materialTakeoff DB
        ↓ (Intelligence Stage — parallel)
[Agent 5] Anomaly Detection (IQR)       → priceReviews (anomaly_detector)
[Agent 6] Commodity Risk Analyzer       → projectRisk DB
[Agent 7] Scope Gap Analyzer            → scopeGaps DB
[Agent 8] Negotiation Strategy          → in-memory result
[Agent 9] Alternative Materials         → alternatives DB
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
- **Agent 5 — Anomaly Detection**: IQR statistical outlier detection, duplicate items, unit mismatches (no AI — pure math)
- **Agent 6 — Commodity Risk**: Copper/aluminum/steel exposure %, contingency recommendation
- **Agent 7 — Scope Gap Analysis**: Detects missing required systems (earthing, emergency lighting, lightning protection, etc.)
- **Agent 8 — Negotiation Strategy**: Bid price, safe floor, payment milestones, AI strategic advice
- **Agent 9 — Alternative Materials**: Cheaper SASO-compliant equivalents from KSA market + AI suggestions
- **Project Intelligence page** (`/intelligence`): Unified view of all 5 advanced agents with KPI cards

## Database Tables

- `projects` — pricing projects with status and 3-scenario totals
- `boq_items` — individual BOQ line items with pricing, confidence, compliance, anomaly flags
- `materials` — Saudi electrical materials price database
- `conversations` + `messages` — Anthropic AI integration tables
- `price_reviews` — AI agent review findings (agents 1, 2, 5)
- `material_takeoff` — sub-component breakdown (agents 3, 4)
- `scope_gaps` — missing required systems (agent 7)
- `project_risk` — commodity exposure analysis (agent 6)
- `alternatives` — cheaper material alternatives (agent 9)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, run from lib/db/)

## Important Notes

- Use `zod/v4` (NOT `zod`) in all DB schema files
- Import `.js` extension in ESM API server imports
- DB package: `@workspace/db`; run migrations from `lib/db/` directory
- `@workspace/integrations-anthropic-ai` provides `anthropic` client and `batchProcess` helper
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
- `POST /api/projects/:id/agents/run-all` — Run all 9 agents in smart sequence
- `GET /api/projects/:id/agents/status` — All agent job statuses

### Intelligence Data
- `GET /api/projects/:id/price-reviews` — Agent findings (filter: ?agent=&severity=)
- `GET /api/projects/:id/price-reviews/summary` — Summary stats
- `GET /api/projects/:id/scope-gaps` — Missing scope items
- `GET /api/projects/:id/risk` — Risk analysis result
- `GET /api/projects/:id/alternatives` — Alternative materials
- `GET /api/projects/:id/takeoff` — Material takeoff breakdown
