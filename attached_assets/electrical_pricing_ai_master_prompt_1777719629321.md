# Master Prompt — AI Agents System for Electrical Project Pricing (Saudi Market)

You are a senior software architect and AI engineer. Your task is to build a professional, production-grade multi-agent system that automatically prices electrical project BOQs (Bill of Quantities) for the Saudi Arabian market.

---

## Project Overview

Build an AI-powered system where a user uploads electrical project documents and BOQ files, and the system automatically prices every line item using real Saudi market data, returning a professional pricing report in Arabic and English.

---

## System Architecture — Multi-Agent Pipeline

The system consists of 5 specialized agents orchestrated by a central controller:

```
[User uploads: Project Docs + BOQ]
        ↓
[Document Agent] → Parses and structures all file formats
        ↓
[Breakdown Agent] → Hierarchical classification + spec extraction
        ↓
[Pricing Agent] → Market research + cost calculation
        ↓
[Validation Agent] → Anomaly detection + compliance check
        ↓
[Report Agent] → Generates final pricing report (AR + EN)
```

---

## Module 1 — BOQ Breakdown System

### Goal
Parse every BOQ line item into a fully structured object, then classify and enrich it with technical specifications — without sending unnecessary data to the AI model.

### Tasks

**Task 1.1 — Multi-format File Ingestion**
- Accept: PDF, XLSX, DOCX, CSV
- Auto-detect and extract tables even with merged cells or non-standard headers
- Handle both Arabic and English file content
- Reject corrupt files with clear error messages
- Libraries: camelot-py, tabula-py, pdfplumber, python-docx, openpyxl

**Task 1.2 — Hierarchical Item Classifier**
- Classify each BOQ item into a tree structure:
  `Electrical Works → Power Systems → Panels → MDB 400A`
- Fine-tune a classifier on Saudi electrical project data
- Target accuracy: 95%+
- Output: category_level_1, category_level_2, category_level_3, item_code

**Task 1.3 — Technical Specification Extractor**
- From each item description, extract structured fields:
  - Voltage rating (220V / 380V / 11kV etc.)
  - Current capacity (Amps)
  - Cable type (XLPE / PVC / LSZH)
  - Standard (IEC / SASO / BS)
  - Cross-section (mm²)
  - Brand requirement (if specified)
- Use Claude API with structured output (JSON mode)
- Compress input format: instead of long text, send compact JSON to minimize tokens

**Task 1.4 — Quantity Take-off Validator**
- Validate quantities against engineering logic:
  - Compare room count vs lighting points
  - Check cable lengths against typical floor areas
  - Flag quantities deviating >3x from statistical norms
- Reference IEC standards database for typical quantity ranges

**Task 1.5 — Smart Grouping Engine**
- Group similar items before sending to pricing (e.g., 50 cable items of same type → 1 batch request)
- Clustering algorithm: group by category + specification similarity
- Output: batches of max 25 items per AI request
- Expected token saving: 85% reduction in API overhead

**Task 1.6 — Arabic/English Bilingual NER**
- Named Entity Recognition for material names in Arabic and English
- Handle hybrid text common in Saudi projects: "كابل XLPE مقطع 35 مم"
- Libraries: CAMeL NLP, spaCy
- Map Arabic material names to standardized English codes

---

## Module 2 — Token Optimization System

### Goal
Reduce AI API token consumption by ~80% while maintaining pricing accuracy above 90%.

### Strategy A — Cache-First Architecture

**Task 2.1 — Semantic Cache with Vector DB**
- Every priced item → convert to embedding → store in vector database (Pinecone or Qdrant)
- Before calling AI for any item: run similarity search
- If similarity score ≥ 0.95 → return cached price directly (no API call)
- Target cache hit rate: 70%+ after 3 months of usage
- Embedding model: text-embedding-3-small (cheap and fast)

**Task 2.2 — Tiered Pricing Database**
- Maintain a database of common electrical materials with weekly price updates
- Items in DB → fetch price directly, never call AI
- DB covers: cables, switches, sockets, conduits, standard panels, common fixtures
- Update frequency: every 48 hours via automated scraper

### Strategy B — Prompt Compression

**Task 2.3 — Structured JSON Input Format**
- Instead of natural language, send compressed JSON to AI:
  ```
  BAD:  "Copper armored cable cross-section 35mm IEC 60502 quantity 500 meters"
  GOOD: {"t":"cable","mat":"cu","arm":true,"cs":35,"std":"IEC60502","qty":500,"unit":"m"}
  ```
- Expected input token reduction: 70%

**Task 2.4 — Batch Processing Engine**
- Queue system that accumulates similar items
- Send batches of 20-25 items in a single prompt
- AI returns JSON array with prices for all items at once
- Implementation: Celery + Redis queue
- Expected overhead reduction: 85%

**Task 2.5 — Minimal System Prompt Design**
- Keep system prompt under 200 tokens
- Rely on Claude's built-in knowledge of electrical standards
- Only specify: Saudi market context, output JSON format, VAT rules
- Do NOT re-explain electrical engineering concepts — the model already knows them

### Strategy C — Smart Model Routing

**Task 2.6 — Confidence-Based Model Selection**
- Calculate complexity score for each item (0-100)
- Score < 40 (simple standard items) → use claude-haiku-4-5 (15x cheaper)
- Score 40-80 (moderate complexity) → use claude-sonnet-4-6
- Score > 80 (custom/special items) → use claude-sonnet-4-6 with extended thinking
- Expected cost reduction: 60%

**Task 2.7 — Pre-classification Filter**
- Local lightweight classifier (no API call) decides if AI is needed at all
- Items found in DB → go to DB directly
- Only NEW or UNMATCHED items go to AI
- Implementation: sklearn RandomForest trained on historical items

---

## Module 3 — Pricing Agent System

### Goal
Fetch real Saudi market prices, calculate full project costs including labor, VAT, and import duties.

### Tasks

**Task 3.1 — Saudi Market Price Scraper**
- Collect prices from: Saudi online marketplaces, local distributor APIs, manufacturer price lists
- Schedule: auto-update every 48 hours
- Store price history for trend analysis
- Implementation: Playwright for dynamic sites, httpx for APIs
- Store in PostgreSQL with TimescaleDB extension for time-series data

**Task 3.2 — Labor Cost Calculator**
- Calculate installation cost per item type based on:
  - Saudi regional labor rates (Riyadh / Jeddah / Dammam / other)
  - Saudization percentage requirements
  - Iqama and insurance costs per worker
  - Productivity rates per item type (hours/unit)
- Data source: HRDF published rates + internal project database

**Task 3.3 — VAT + Customs + SASO Fee Calculator**
- Automatically add:
  - VAT: 15% on all items (ZATCA rules)
  - Import customs by HS Code for non-locally-manufactured items
  - SASO certification fees where applicable
  - Port clearance costs for imported goods
- Integration: ZATCA API for VAT verification

**Task 3.4 — Alternative Material Suggester**
- When a specified material is expensive or unavailable:
  - Find alternative meeting same technical specification
  - Verify IEC/SASO compliance of alternative
  - Calculate price difference and present savings
  - Example: "ABB cable → Nexans equivalent, same IEC spec, 15% cheaper"
- Use Claude API with tool use to query materials database

**Task 3.5 — Multi-Scenario Pricing Engine**
- For every BOQ, generate 3 pricing scenarios simultaneously:
  1. **Economical**: cheapest materials meeting minimum spec compliance
  2. **Standard**: balanced quality/price, tier-1 regional brands
  3. **Premium**: top international brands, longest warranty
- Present all 3 in the final report so client can choose

---

## Module 4 — Validation & Compliance Agent

### Tasks

**Task 4.1 — Anomaly Detection System**
- Compare each priced item against historical average for that item type
- Flag if price deviates >30% from rolling 90-day average
- Flag potential duplicate items in the BOQ
- Flag items that seem swapped (e.g., quantity and unit price reversed)
- Method: IQR statistical analysis + rule-based checks

**Task 4.2 — SASO / SEC Compliance Checker**
- Verify every material against SASO approved materials list
- Check SEC (Saudi Electricity Company) technical requirements
- Check MOMRA standards for building projects
- Flag: prohibited materials, materials requiring special certification, items needing local type-testing
- Output: compliance status per item (PASS / WARNING / FAIL)

**Task 4.3 — Human Review Queue**
- Items with confidence < 70% → route to human review dashboard
- Items with anomaly flags → require human approval before finalizing
- Auditor sees: AI suggested price, confidence score, reason for flag, edit field
- All human edits feed back into the learning system

---

## Module 5 — Report Generation Agent

### Tasks

**Task 5.1 — Professional Excel BOQ Report**
- Output: fully priced BOQ in Excel format
- Include: item number, description (AR+EN), unit, quantity, unit price, total price, VAT, grand total
- Color coding: green = high confidence, yellow = medium, red = needs review
- Auto-generate summary sheet by category

**Task 5.2 — Executive Summary PDF (Arabic)**
- 2-page PDF summary for client presentation
- Include: total project cost, breakdown by category (pie chart), market comparison, key assumptions
- Professional formatting suitable for Saudi client presentation
- Libraries: ReportLab, Arabic text support via arabic-reshaper + python-bidi

**Task 5.3 — Market Comparison Report**
- Show how the priced project compares to Saudi market averages
- Price per m² comparison for similar project types
- Highlight where costs are above/below market

---

## Module 6 — Advanced Features

**Task 6.1 — Price History & Trend Analysis**
- Store all price data in TimescaleDB (time-series optimized PostgreSQL)
- Provide per-material price charts: 3-month, 6-month, 1-year trends
- Alert user when a key material price changes >10% week-over-week
- Predict price trend for next 30 days using simple regression

**Task 6.2 — SASO / SEC Compliance Database**
- Build and maintain database of all SASO-approved electrical materials
- Include: approval number, validity date, approved manufacturers, technical specs
- Auto-flag items where SASO approval is expired or missing

**Task 6.3 — REST API for System Integration**
- Build REST API so the system integrates with:
  - Procore (construction management)
  - Oracle Primavera (project planning)
  - SAP ERP (enterprise resource planning)
- Endpoints: POST /price-boq, GET /status/{job_id}, GET /report/{job_id}
- Auth: OAuth2 + API keys
- Webhooks: notify external system when pricing is complete

**Task 6.4 — Continuous Learning Loop**
- Every manual price edit by a user → logged as training data
- Retrain classifier monthly on accumulated corrections
- After 100 projects: target 95%+ auto-pricing accuracy for common items
- Implementation: active learning pipeline with human-in-the-loop

**Task 6.5 — Multi-tenant Dashboard**
- Web dashboard for users to:
  - Upload project files and BOQ
  - Track pricing job status in real time
  - Review and approve flagged items
  - Download final reports
  - View pricing history across projects
- Stack: React / Next.js frontend, FastAPI backend

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| AI Models | claude-haiku-4-5 (simple), claude-sonnet-4-6 (complex) |
| AI Framework | LangGraph (agent orchestration) |
| Vector Cache | Pinecone or Qdrant |
| Backend API | FastAPI (Python) |
| Task Queue | Celery + Redis |
| Primary DB | PostgreSQL + TimescaleDB |
| File Parsing | camelot-py, pdfplumber, openpyxl, python-docx |
| NLP | CAMeL NLP (Arabic), spaCy |
| Web Scraping | Playwright |
| Frontend | React / Next.js |
| Infrastructure | Docker, AWS or Azure |
| Auth | Auth0 / JWT |
| Reports | ReportLab, openpyxl, Jinja2 |

---

## Key Performance Targets

- Token cost reduction vs naive implementation: **≥80%**
- Cache hit rate after 3 months: **≥70%**
- Auto-pricing accuracy on common items: **≥90%**
- Time to price a 500-item BOQ: **<5 minutes**
- SASO compliance check coverage: **100% of items**
- Support for 3 pricing scenarios per BOQ: **always**

---

## Development Priority Order

1. Document ingestion + BOQ parser (foundation — nothing works without this)
2. Semantic cache + vector DB (biggest ROI — saves money from day 1)
3. Saudi market price scraper + DB (core data source)
4. Pricing agent with batch processing (main AI logic)
5. Validation + compliance checker (quality gate)
6. Report generator (user-facing output)
7. Advanced features: trends, alternatives, learning loop, API integrations

---

Start by building Module 1 (BOQ Breakdown) and Module 2 (Token Optimization) as the foundation. Provide complete, production-ready Python code with proper error handling, logging, and unit tests for each component.
