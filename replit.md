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
- **AI**: Claude (claude-haiku-4-5 for batch pricing, claude-sonnet-4-6 for complex items) via Replit AI Integrations
- **Validation**: Zod (zod/v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **File upload**: multer (in-memory)

## Architecture — Multi-Agent Pipeline

```
[User uploads BOQ file (CSV/XLSX/PDF)]
        ↓
[Document Parser] → Extracts line items, classifies categories
        ↓
[AI Pricing Agent] → Claude haiku prices batches of 20 items
        ↓
[Validation Agent] → Confidence scores, SASO compliance check
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
- **Materials database**: 20+ common Saudi electrical materials pre-seeded
- **Report export**: CSV Excel report + HTML executive summary in Arabic

## Database Tables

- `projects` — pricing projects with status and 3-scenario totals
- `boq_items` — individual BOQ line items with pricing, confidence, compliance
- `materials` — Saudi electrical materials price database
- `conversations` + `messages` — Anthropic AI integration tables

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## API Routes

- `GET /api/projects` — list all projects
- `POST /api/projects` — create new project
- `GET /api/projects/:id` — project detail with BOQ items
- `POST /api/projects/:id/upload` — upload BOQ file (multipart/form-data, field: "file")
- `POST /api/projects/:id/price` — start AI pricing pipeline
- `GET /api/projects/:id/status` — get pricing job status (polls progress)
- `GET /api/projects/:id/summary` — pricing summary with 3 scenarios + category breakdown
- `GET /api/projects/:id/review-queue` — items needing human review
- `GET /api/projects/:id/boq` — all BOQ items for project
- `PUT /api/boq/:itemId` — update/approve a BOQ item
- `GET /api/projects/:id/report/excel` — download CSV report
- `GET /api/projects/:id/report/pdf` — download HTML executive summary (Arabic)
- `GET /api/projects/stats` — dashboard statistics
- `GET /api/materials` — materials database (filterable by category/search)
