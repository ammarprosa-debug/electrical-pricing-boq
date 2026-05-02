# Implementation Prompt — Add AI Agents to Electrical Pricing System

You are a senior AI engineer. I have an existing electrical project pricing system and I need you to extend it by implementing the following agents. For each agent, write complete, production-ready Python code with proper error handling, logging, and unit tests.

Follow this approach for every agent:
- Create a self-contained Python class for each agent
- Each agent receives a structured JSON input and returns a structured JSON output
- All agents must handle errors gracefully and log failures without crashing the pipeline
- Use async/await where applicable for performance
- Add docstrings and inline comments

---

## TASK 1 — Document Parser Agent

**File:** `agents/document_parser_agent.py`

Build a class `DocumentParserAgent` that:
- Accepts any of these file types: PDF, XLSX, DOCX, CSV
- Auto-detects the file format from extension and MIME type
- Extracts all tables from the file, even if they have merged cells or non-standard headers
- Handles bilingual content (Arabic + English) in the same file
- Returns a list of structured BOQ items as JSON

Input:
```json
{ "file_path": "/uploads/project_boq.xlsx", "project_id": "PRJ-001" }
```

Output:
```json
{
  "project_id": "PRJ-001",
  "total_items": 342,
  "items": [
    {
      "id": "item_001",
      "raw_description": "Copper cable XLPE 35mm",
      "quantity": 500,
      "unit": "m",
      "section": "Power Systems",
      "row_number": 12
    }
  ],
  "parse_errors": []
}
```

Libraries to use: `camelot-py`, `pdfplumber`, `openpyxl`, `python-docx`, `tabula-py`

---

## TASK 2 — Breakdown Agent

**File:** `agents/breakdown_agent.py`

Build a class `BreakdownAgent` that:
- Takes the output items from DocumentParserAgent
- Classifies each item into a 3-level hierarchy: `category > subcategory > item_type`
  - Example: `Electrical Works > Power Cables > XLPE Armored Cable`
- Extracts technical specifications from the item description:
  - voltage rating, current capacity, cable type, cross-section (mm²), standard (IEC/SASO/BS), brand if mentioned
- Groups similar items into batches of max 25 for efficient AI processing
- Uses Claude API with structured JSON output mode (NOT natural language)
- Compresses input to save tokens — use compact JSON keys, not verbose field names

Compressed prompt format to send to Claude API:
```json
{"items":[{"id":"item_001","d":"Copper cable XLPE 35mm IEC60502","qty":500,"u":"m"}]}
```

Expected Claude response:
```json
{"items":[{"id":"item_001","cat":"Power Cables","sub":"XLPE Armored","spec":{"mat":"cu","cs":35,"std":"IEC60502","v":null,"a":null},"confidence":0.94}]}
```

---

## TASK 3 — Semantic Cache Agent

**File:** `agents/semantic_cache_agent.py`

Build a class `SemanticCacheAgent` that:
- Before any item goes to the AI pricing model, checks the vector database first
- Converts each item description + specs to an embedding using `text-embedding-3-small`
- Searches Pinecone (or Qdrant) for similar items with similarity >= 0.95
- If cache hit: returns the cached price directly without any API call
- If cache miss: marks the item for AI processing and logs it as a candidate for future caching
- After pricing is complete, stores new results back into the vector database
- Tracks and logs: total requests, cache hits, cache misses, hit rate percentage

Input per item:
```json
{"id": "item_001", "description": "XLPE copper cable 35mm", "spec": {"mat":"cu","cs":35,"std":"IEC60502"}}
```

Output per item:
```json
{"id": "item_001", "cache_hit": true, "unit_price": 45.50, "currency": "SAR", "similarity_score": 0.97, "source": "cache"}
```

Use: `openai` SDK for embeddings, `pinecone-client` or `qdrant-client` for vector DB, `redis` for fast key-value cache layer

---

## TASK 4 — Model Router Agent

**File:** `agents/model_router_agent.py`

Build a class `ModelRouterAgent` that:
- Calculates a complexity score (0–100) for each BOQ item
- Routes each item to the correct AI model based on score:
  - Score 0–40: `claude-haiku-4-5` (fast, cheap — standard cables, switches, sockets)
  - Score 41–80: `claude-sonnet-4-6` (balanced — panels, transformers, custom fixtures)
  - Score 81–100: `claude-sonnet-4-6` with extended thinking (complex — specialized equipment)
- Items already priced by cache: skip entirely, do not assign a model
- Items found in the local price database: assign model = "db_lookup", skip AI

Complexity scoring rules (implement as a scoring function):
- Has brand specification: +20 points
- Non-standard voltage (not 220V/380V): +15 points
- Multiple technical specs extracted: +10 points per spec field
- Description length > 50 chars: +10 points
- Unknown/unrecognized category: +25 points
- Standard common item (cable, socket, switch): -20 points base

Output per item:
```json
{"id": "item_001", "complexity_score": 35, "assigned_model": "claude-haiku-4-5", "reason": "standard cable, known spec"}
```

---

## TASK 5 — Market Research Agent

**File:** `agents/market_research_agent.py`

Build a class `MarketResearchAgent` that:
- Maintains a local PostgreSQL database of electrical material prices for the Saudi market
- Fetches prices on a schedule (every 48 hours) using Playwright for dynamic sites
- Calculates a 30-day rolling average price per material code
- Detects price changes > 10% week-over-week and generates alerts
- For any BOQ item, returns the best available market price with source and date

Database schema to create:
```sql
CREATE TABLE material_prices (
    id SERIAL PRIMARY KEY,
    material_code VARCHAR(50),
    description TEXT,
    unit_price DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'SAR',
    source VARCHAR(100),
    region VARCHAR(50),
    recorded_at TIMESTAMP DEFAULT NOW()
);
```

Output per item:
```json
{
  "material_code": "CABLE-CU-XLPE-35",
  "unit_price": 45.50,
  "currency": "SAR",
  "30d_avg": 43.80,
  "price_trend": "rising",
  "source": "local_distributor",
  "last_updated": "2025-05-01",
  "alert": null
}
```

---

## TASK 6 — Labor Cost Agent

**File:** `agents/labor_cost_agent.py`

Build a class `LaborCostAgent` that:
- Calculates installation labor cost per BOQ item
- Uses a regional rate table (Riyadh / Jeddah / Dammam / Remote)
- Applies productivity rates (hours per unit) based on item category
- Includes: base labor rate + Iqama cost allocation + insurance + Saudization overhead
- Returns itemized labor cost breakdown

Rate table to hardcode as starting data (can be overridden from DB):
```python
REGIONAL_RATES = {
    "riyadh":  {"base_rate_per_hour": 35, "saudization_factor": 1.15},
    "jeddah":  {"base_rate_per_hour": 38, "saudization_factor": 1.15},
    "dammam":  {"base_rate_per_hour": 36, "saudization_factor": 1.12},
    "remote":  {"base_rate_per_hour": 45, "saudization_factor": 1.20},
}

PRODUCTIVITY_RATES = {
    "cable_per_meter":      0.05,  # hours per meter
    "panel_installation":   8.0,   # hours per panel
    "socket_outlet":        0.75,  # hours per point
    "lighting_point":       0.50,  # hours per point
    "conduit_per_meter":    0.08,  # hours per meter
    "cable_tray_per_meter": 0.12,  # hours per meter
}
```

Output per item:
```json
{
  "id": "item_001",
  "labor_hours": 25.0,
  "labor_cost_sar": 1006.25,
  "region": "riyadh",
  "breakdown": {
    "base_labor": 875.0,
    "saudization_overhead": 131.25,
    "insurance": 0.0
  }
}
```

---

## TASK 7 — Customs and VAT Agent

**File:** `agents/customs_vat_agent.py`

Build a class `CustomsVatAgent` that:
- Applies Saudi VAT (15%) to all items per ZATCA rules
- Maps each material category to an HS Code and applies the correct import duty rate
- Adds SASO certification fee where applicable
- Returns full landed cost per item

HS Code duty rate table to implement:
```python
HS_DUTY_RATES = {
    "8544": 0.05,   # Insulated wire and cable — 5%
    "8536": 0.05,   # Switches and socket outlets — 5%
    "8537": 0.05,   # Switchboards and control panels — 5%
    "8541": 0.00,   # Semiconductor devices — 0% (exempted)
    "9405": 0.12,   # Luminaires and lighting fittings — 12%
    "8504": 0.05,   # Transformers — 5%
    "3917": 0.06,   # Conduit and fittings (PVC) — 6%
}

SASO_FEES = {
    "cable":   150,   # SAR per product type
    "panel":   500,
    "fixture": 200,
    "default": 100,
}
```

Output per item:
```json
{
  "id": "item_001",
  "material_cost_sar": 22750.0,
  "import_duty_sar": 1137.5,
  "saso_fee_sar": 150.0,
  "vat_sar": 3605.63,
  "total_landed_cost_sar": 27643.13,
  "hs_code": "8544",
  "duty_rate": 0.05
}
```

---

## TASK 8 — Scope Analyzer Agent

**File:** `agents/scope_analyzer_agent.py`

Build a class `ScopeAnalyzerAgent` that:
- Reads the project specification documents (PDF/DOCX) separately from the BOQ
- Extracts all electrical systems and requirements mentioned in the specs
- Cross-references them against the BOQ items list
- Detects systems mentioned in specs but NOT priced in the BOQ
- Generates a gap report with recommended items to add

Common missing item patterns to detect:
```python
REQUIRED_SYSTEMS = [
    "earthing system", "lightning protection", "fire alarm interface",
    "emergency lighting", "UPS system", "generator connection",
    "BMS integration", "cable management", "testing and commissioning",
    "as-built drawings", "operation and maintenance manuals"
]
```

Output:
```json
{
  "project_id": "PRJ-001",
  "boq_items_count": 342,
  "specs_systems_found": ["earthing system", "emergency lighting", "UPS system"],
  "missing_from_boq": [
    {
      "system": "earthing system",
      "recommendation": "Add: Earthing and bonding complete system per IEC 60364",
      "estimated_cost_range_sar": "15000-35000",
      "risk_level": "HIGH"
    }
  ]
}
```

---

## TASK 9 — Risk Agent

**File:** `agents/risk_agent.py`

Build a class `RiskAgent` that:
- Identifies BOQ items with high commodity price exposure (copper, aluminum, steel)
- Calculates each item's commodity exposure as a percentage of total project cost
- Fetches current LME (London Metal Exchange) commodity prices via API or scraping
- Assigns risk level per item: LOW / MEDIUM / HIGH / CRITICAL
- Recommends contingency percentage to add per risk level
- Generates a project-level risk summary

Commodity exposure thresholds:
```python
COMMODITY_CONTENT = {
    "copper_cable":     {"cu": 0.65, "al": 0.00},  # 65% of material cost is copper
    "aluminum_cable":   {"cu": 0.00, "al": 0.55},
    "transformer":      {"cu": 0.30, "al": 0.10, "steel": 0.25},
    "panel_board":      {"cu": 0.15, "steel": 0.20},
    "conduit_pvc":      {"cu": 0.00, "al": 0.00},  # no commodity risk
}

RISK_THRESHOLDS = {
    "LOW":      {"contingency": 0.03},  # 3% contingency
    "MEDIUM":   {"contingency": 0.07},
    "HIGH":     {"contingency": 0.12},
    "CRITICAL": {"contingency": 0.18},
}
```

Output:
```json
{
  "project_id": "PRJ-001",
  "total_project_cost_sar": 1250000,
  "commodity_exposure_sar": 437500,
  "commodity_exposure_pct": 35.0,
  "recommended_contingency_sar": 87500,
  "risk_level": "HIGH",
  "items_at_risk": [
    {"id": "item_001", "commodity": "copper", "exposure_pct": 65, "risk_level": "HIGH"}
  ]
}
```

---

## TASK 10 — Alternative Materials Agent

**File:** `agents/alternative_materials_agent.py`

Build a class `AlternativeMaterialsAgent` that:
- For each priced item, checks if a cheaper equivalent exists in the materials database
- Matches alternatives based on: same standard, same voltage rating, same current capacity, same cross-section
- Verifies SASO compliance of all suggested alternatives
- Returns up to 3 alternatives per item ranked by price (cheapest first)
- Calculates and displays the savings percentage vs the original spec

Use Claude API to suggest alternatives for items not found in the local DB.
Prompt format (compressed, max tokens):
```
Find 3 alternatives for: {item_spec_json}
Requirements: same IEC/SASO standard, same electrical rating, SASO approved
Return JSON: [{brand, model, unit_price_sar, savings_pct, availability}]
```

Output per item:
```json
{
  "id": "item_001",
  "original_spec": "ABB XLPE 35mm IEC60502",
  "original_price_sar": 52.00,
  "alternatives": [
    {"brand": "Nexans", "spec": "XLPE 35mm IEC60502", "unit_price_sar": 44.20, "savings_pct": 15.0, "saso_approved": true},
    {"brand": "Prysmian", "spec": "XLPE 35mm IEC60502", "unit_price_sar": 46.50, "savings_pct": 10.6, "saso_approved": true}
  ]
}
```

---

## TASK 11 — Anomaly Detection Agent

**File:** `agents/anomaly_detection_agent.py`

Build a class `AnomalyDetectionAgent` that:
- Runs after all items are priced, as a final quality gate
- Uses IQR (Interquartile Range) statistical method to detect outlier prices
- Flags any item where: price > 30% above rolling 90-day average for that item type
- Detects potential duplicate items: same description, different row numbers
- Detects unit/quantity mismatches (price looks like it was entered per roll instead of per meter)
- Assigns each flag a severity: WARNING or ERROR
- Routes ERROR items to human review queue, WARNING items are noted in report

Anomaly types to detect:
```python
ANOMALY_TYPES = {
    "PRICE_TOO_HIGH":    "Unit price > 30% above 90-day rolling average",
    "PRICE_TOO_LOW":     "Unit price < 50% below 90-day rolling average (possible error)",
    "DUPLICATE_ITEM":    "Same description appears more than once in BOQ",
    "UNIT_MISMATCH":     "Price appears to be per roll/coil, not per meter",
    "ZERO_PRICE":        "Item has no price assigned after all agents ran",
    "MISSING_SPEC":      "Item could not be classified with confidence > 0.5",
}
```

Output:
```json
{
  "total_items": 342,
  "anomalies_found": 8,
  "errors": [
    {"id": "item_045", "type": "PRICE_TOO_HIGH", "severity": "ERROR", "detail": "Unit price SAR 450 vs avg SAR 45 — possible 10x data entry error"}
  ],
  "warnings": [
    {"id": "item_112", "type": "DUPLICATE_ITEM", "severity": "WARNING", "detail": "Same as item_067"}
  ],
  "items_for_human_review": ["item_045", "item_198"]
}
```

---

## TASK 12 — SASO/SEC Compliance Agent

**File:** `agents/compliance_agent.py`

Build a class `ComplianceAgent` that:
- Checks every BOQ item against the SASO approved materials list
- Verifies SEC (Saudi Electricity Company) technical requirements for electrical equipment
- Returns compliance status per item: PASS / WARNING / FAIL
- Generates a compliance certificate for items that pass

SASO check rules to implement:
```python
SASO_RULES = {
    "cable": {
        "required_standard": ["IEC 60502", "IEC 60228", "SASO 14"],
        "prohibited_materials": ["lead sheathing", "asbestos insulation"],
        "min_voltage_marking": True,
    },
    "panel": {
        "required_standard": ["IEC 61439", "SASO 302"],
        "required_ip_rating": "IP41",
        "required_marking": ["voltage", "current", "manufacturer", "serial"],
    },
    "fixture": {
        "required_standard": ["IEC 60598", "SASO 14"],
        "energy_class_required": True,
    }
}
```

Output per item:
```json
{
  "id": "item_001",
  "compliance_status": "PASS",
  "standard_verified": "IEC 60502",
  "saso_approval_number": "SASO-2024-8851",
  "sec_compliant": true,
  "warnings": [],
  "required_actions": []
}
```

---

## TASK 13 — Cross-Reference Agent

**File:** `agents/cross_reference_agent.py`

Build a class `CrossReferenceAgent` that:
- Stores all completed project pricings in a vector database indexed by project type and scope
- When a new project is priced, finds the top-3 most similar past projects
- Compares: price per m², price per distribution board, total cost vs project size
- Flags any category where current pricing deviates more than 25% from historical average
- Returns a benchmark score (0–100) and deviation report

Similarity matching fields for vector embedding:
```python
PROJECT_EMBEDDING_FIELDS = [
    "project_type",        # villa, commercial, industrial, hospital
    "total_area_m2",
    "voltage_level",       # LV only / LV+MV / HV
    "num_distribution_boards",
    "num_floors",
    "location_region",
]
```

Output:
```json
{
  "project_id": "PRJ-001",
  "benchmark_score": 78,
  "similar_projects": ["PRJ-045", "PRJ-112", "PRJ-089"],
  "comparison": {
    "price_per_m2_current": 185,
    "price_per_m2_historical_avg": 172,
    "deviation_pct": 7.6,
    "verdict": "WITHIN_RANGE"
  },
  "category_deviations": [
    {"category": "Power Cables", "current_sar": 185000, "historical_avg_sar": 130000, "deviation_pct": 42.3, "flag": "HIGH_DEVIATION"}
  ]
}
```

---

## TASK 14 — Multi-Scenario Agent

**File:** `agents/multi_scenario_agent.py`

Build a class `MultiScenarioAgent` that:
- Takes the fully priced BOQ (Standard scenario) as input
- Generates two additional scenarios: Economical and Premium
- For Economical: replaces items with cheapest SASO-compliant equivalent (from AlternativeMaterialsAgent data)
- For Premium: replaces items with tier-1 international brands (ABB, Schneider, Siemens, Nexans, Prysmian)
- Calculates total cost for each scenario and the price delta between them
- Returns all three scenarios in a structured format ready for the Report Agent

Scenario generation rules:
```python
SCENARIO_RULES = {
    "economical": {
        "brand_tier": "regional",        # Saudi/GCC brands
        "spec_compliance": "minimum",    # minimum SASO-compliant spec
        "target_saving_pct": 20,         # aim for 20% below standard
    },
    "standard": {
        "brand_tier": "tier1_regional",  # current pricing — no change
        "spec_compliance": "standard",
    },
    "premium": {
        "brand_tier": "international",   # ABB, Schneider, Siemens, Nexans
        "spec_compliance": "enhanced",   # above-minimum specs
        "target_premium_pct": 25,        # aim for 25% above standard
    }
}
```

Output:
```json
{
  "project_id": "PRJ-001",
  "scenarios": {
    "economical": {"total_sar": 980000, "delta_vs_standard": -220000, "delta_pct": -18.3},
    "standard":   {"total_sar": 1200000, "delta_vs_standard": 0, "delta_pct": 0},
    "premium":    {"total_sar": 1485000, "delta_vs_standard": +285000, "delta_pct": +23.75}
  },
  "scenario_items": { "economical": [...], "standard": [...], "premium": [...] }
}
```

---

## TASK 15 — Negotiation Strategy Agent

**File:** `agents/negotiation_agent.py`

Build a class `NegotiationAgent` that:
- Analyzes the priced BOQ and identifies high-margin vs fixed-cost items
- Suggests safe discount ranges per item category without going below break-even
- Identifies where competitors are likely to undercut and by how much
- Recommends a payment milestone structure based on project phases
- Uses Claude API for the strategic analysis (single call, full project context)

Input to Claude API (compressed format):
```json
{
  "total_cost_sar": 1200000,
  "margin_pct": 18,
  "categories": [
    {"name": "Power Cables", "cost": 185000, "margin": 12},
    {"name": "Panels", "cost": 320000, "margin": 22}
  ],
  "risk_level": "HIGH",
  "project_type": "commercial"
}
```

Output:
```json
{
  "recommended_bid_price_sar": 1416000,
  "safe_discount_floor_sar": 1290000,
  "max_discount_pct": 8.9,
  "high_flex_categories": ["Panels", "Lighting"],
  "fixed_cost_categories": ["Power Cables", "Earthing"],
  "payment_milestones": [
    {"phase": "Mobilization", "pct": 10, "trigger": "Contract signing"},
    {"phase": "Material delivery", "pct": 30, "trigger": "Materials on site"},
    {"phase": "Rough-in complete", "pct": 30, "trigger": "First fix done"},
    {"phase": "Testing & commissioning", "pct": 20, "trigger": "T&C complete"},
    {"phase": "Final handover", "pct": 10, "trigger": "Defects liability period start"}
  ]
}
```

---

## TASK 16 — Orchestrator Agent

**File:** `agents/orchestrator.py`

Build a class `OrchestratorAgent` that:
- Coordinates the execution of all 15 agents above in the correct order
- Passes the output of each agent as input to the next agent
- Handles failures: if one agent fails, log the error and continue with partial data where possible
- Tracks execution time per agent and logs it
- Provides a real-time status update system (via Redis pub/sub or WebSocket) so the frontend can show progress

Execution order:
```
1. DocumentParserAgent
2. BreakdownAgent
3. QuantityValidatorAgent (your existing agent)
4. SemanticCacheAgent
5. ModelRouterAgent
6. MarketResearchAgent + LaborCostAgent + CustomsVatAgent (run in parallel)
7. ScopeAnalyzerAgent (run in parallel with step 6)
8. RiskAgent + AlternativeMaterialsAgent (run in parallel)
9. AnomalyDetectionAgent
10. ComplianceAgent
11. CrossReferenceAgent
12. MultiScenarioAgent
13. NegotiationAgent
14. ReportGenerationAgent (your existing agent)
```

Use `asyncio.gather()` for parallel execution of agents that don't depend on each other.

Status update format (publish to Redis channel `project:{project_id}:status`):
```json
{"project_id": "PRJ-001", "stage": "MarketResearchAgent", "progress_pct": 45, "status": "running", "message": "Fetching prices for 342 items..."}
```

---

## TASK 17 — Report Generation Agent

**File:** `agents/report_generation_agent.py`

Build a class `ReportGenerationAgent` that:
- Takes the complete priced BOQ + all agent outputs as input
- Generates a professional Excel file with the following sheets:
  1. **Summary**: total cost, VAT, grand total, confidence stats
  2. **Priced BOQ**: all items with unit price, total, compliance status, color-coded by confidence
  3. **Scenario Comparison**: Economic vs Standard vs Premium side by side
  4. **Risk Report**: commodity exposure, recommended contingency
  5. **Compliance Certificate**: all SASO/SEC verified items
  6. **Anomalies**: flagged items requiring human review
- Color coding for confidence:
  - Green fill: confidence >= 0.90
  - Yellow fill: confidence 0.70–0.89
  - Red fill: confidence < 0.70 (needs review)
- Generates a PDF executive summary in Arabic and English

Libraries: `openpyxl` for Excel, `ReportLab` for PDF, `arabic-reshaper` + `python-bidi` for Arabic text

---

## TASK 18 — Integration & Testing

**File:** `tests/test_all_agents.py`

Write unit tests for every agent using `pytest`:
- Each agent gets at least 3 test cases: happy path, edge case, error case
- Use mock data that represents realistic Saudi electrical BOQ items
- Mock all external API calls (Claude API, Pinecone, market scrapers) using `pytest-mock`
- Assert that every agent returns valid JSON matching the expected schema
- Assert that error cases are handled gracefully (no unhandled exceptions)

Also create:

**File:** `config/settings.py`
- Centralized configuration for all API keys, DB connections, thresholds
- Load from environment variables using `python-dotenv`
- Never hardcode credentials

**File:** `requirements.txt`
- Complete list of all Python dependencies with pinned versions

---

## General Rules for All Code

1. Every agent class must have an `async def run(self, input_data: dict) -> dict` method
2. Every agent must log: start time, end time, item count processed, errors encountered
3. Use Python type hints throughout
4. If Claude API call fails: retry once with exponential backoff, then mark item as "needs_review"
5. All monetary values must be in SAR (Saudi Riyal) with 2 decimal places
6. All timestamps must be ISO 8601 format in UTC
7. Never hardcode API keys — always read from environment variables
8. For the Claude API, always use model `claude-sonnet-4-6` for complex tasks and `claude-haiku-4-5` for simple routing/classification

Start with TASK 16 (Orchestrator) so you understand the full flow, then implement each agent in the priority order listed there.
