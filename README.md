# نظام تسعير المشاريع الكهربائية بالذكاء الاصطناعي
## AI-Powered Electrical Project BOQ Pricing System — Saudi Market

<p align="center">
  <img src="https://img.shields.io/badge/Language-Arabic%20%2F%20English-blue" alt="Bilingual"/>
  <img src="https://img.shields.io/badge/AI-Claude%20(Anthropic)-orange" alt="Claude AI"/>
  <img src="https://img.shields.io/badge/Market-Saudi%20Arabia%20(KSA)-green" alt="KSA"/>
  <img src="https://img.shields.io/badge/Stack-React%20%2B%20Express%20%2B%20PostgreSQL-informational" alt="Stack"/>
</p>

---

## 📋 وصف المشروع | Project Description

**بالعربية:**
نظام احترافي متعدد الوكلاء يعمل بالذكاء الاصطناعي لتسعير جداول الكميات (BOQ) للمشاريع الكهربائية في السوق السعودية. يقوم المستخدم برفع ملف جدول الكميات، ويقوم النظام باستخدام الذكاء الاصطناعي لتسعير كل بند تلقائياً، مع إنشاء تقارير باللغتين العربية والإنجليزية وفق 3 سيناريوهات تسعيرية.

**In English:**
A professional multi-agent AI system that automatically prices electrical project BOQs (Bill of Quantities) for the Saudi Arabian market. Users upload BOQ files and the system uses Claude AI to price every line item, generating bilingual reports (Arabic/English) with 3 pricing scenarios (Economical, Standard, and Premium), including Saudi VAT (15%).

---

## ✨ المميزات | Features

- **رفع ملفات متعددة الصيغ**: CSV، Excel، PDF، DOCX
- **تسعير بالذكاء الاصطناعي**: معالجة 20 بنداً لكل طلب لكفاءة استخدام الرموز
- **3 سيناريوهات تسعيرية**: اقتصادي / قياسي / مميز مع ضريبة القيمة المضافة السعودية (15%)
- **حاسبة تكلفة العمالة**: معدلات خاصة بكل منطقة (الرياض / جدة / الدمام)
- **فحص امتثال SASO**: نجاح / تحذير / رفض لكل بند
- **قائمة المراجعة البشرية**: تمييز البنود ذات الثقة أقل من 70% للمراجعة
- **واجهة ثنائية اللغة**: عربي / إنجليزي مع دعم RTL كامل
- **9 وكلاء ذكاء اصطناعي متخصصين** (تفاصيل أدناه)

---

## 🤖 معمارية الوكلاء التسعة | 9-Agent Intelligence Pipeline

```
[المستخدم يرفع ملف BOQ (CSV/XLSX/PDF)]
        ↓
[محلل المستندات] → استخراج البنود وتصنيف الفئات
        ↓
[وكيل التسعير بالذكاء الاصطناعي] → Claude يسعّر دفعات من 20 بنداً
        ↓ (مرحلة متوازية)
[وكيل 1] مقارنة أسعار السوق السعودي  ─┐
[وكيل 2] الامتثال والاتساق            ─┤→ قاعدة بيانات مراجعات الأسعار
        ↓ (مرحلة متوازية)
[وكيل 3] قائمة المواد (MTO)           ─┐
[وكيل 4] إثراء BOM                    ─┤→ قاعدة بيانات المستخلص المادي
        ↓ (مرحلة الذكاء — متوازية)
[وكيل 5] كشف الشذوذ (IQR)             → مراجعات الأسعار
[وكيل 6] محلل مخاطر السلع              → قاعدة بيانات مخاطر المشروع
[وكيل 7] محلل ثغرات النطاق             → قاعدة بيانات الثغرات
[وكيل 8] استراتيجية التفاوض            → نتيجة في الذاكرة
[وكيل 9] المواد البديلة                → قاعدة بيانات البدائل
        ↓
[مولد التقارير] → CSV / HTML (اقتصادي | قياسي | مميز)
```

| Agent | Role |
|-------|------|
| Agent 1 | KSA Market Price Comparator |
| Agent 2 | Compliance & Consistency Validator |
| Agent 3 | Material Takeoff (MTO) |
| Agent 4 | BOM Enrichment |
| Agent 5 | Anomaly Detection (IQR — pure math, no AI) |
| Agent 6 | Commodity Risk Analyzer (copper/aluminum/steel) |
| Agent 7 | Scope Gap Analyzer |
| Agent 8 | Negotiation Strategy |
| Agent 9 | Alternative Materials (SASO-compliant cheaper equivalents) |

---

## 🛠️ التقنيات المستخدمة | Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | pnpm workspaces |
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 |
| Frontend | React + Vite |
| Backend | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| AI | Claude (claude-haiku-4-5) via Anthropic |
| Validation | Zod v4, drizzle-zod |
| API Codegen | Orval (OpenAPI → React Query hooks) |
| Build | esbuild (CJS bundle) |
| File Upload | multer (in-memory) |

---

## 📸 Screenshots

### لوحة التحكم الرئيسية | Main Dashboard
![Dashboard](docs/screenshots/dashboard.jpg)

### إدارة المشاريع | Projects Management
![Projects](docs/screenshots/projects.jpg)

### استخبارات المشروع | Project Intelligence (Agents 5–9)
![Project Intelligence](docs/screenshots/intelligence.jpg)

---

## 🚀 إعداد وتشغيل المشروع | Setup & Installation

### المتطلبات | Prerequisites

- Node.js >= 24
- pnpm >= 9
- PostgreSQL database

### خطوات الإعداد | Steps

```bash
# 1. Clone the repository
git clone https://github.com/ammarprosa-debug/electrical-pricing-boq.git
cd electrical-pricing-boq

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
# Create a .env file in lib/db/ with:
# DATABASE_URL=postgresql://user:password@host:5432/dbname
# ANTHROPIC_API_KEY=your_anthropic_api_key

# 4. Push the database schema
cd lib/db
pnpm run push
cd ../..

# 5. Start the API server (port defined by PORT env var)
pnpm --filter @workspace/api-server run dev

# 6. Start the frontend (separate terminal)
pnpm --filter @workspace/electrical-pricing run dev
```

### الأوامر المفيدة | Useful Commands

```bash
# Full typecheck across all packages
pnpm run typecheck

# Build all packages
pnpm run build

# Regenerate API hooks and Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes (dev only — run from lib/db/)
pnpm --filter @workspace/db run push
```

---

## 📡 API Overview

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create a new project |
| GET | `/api/projects/:id` | Project detail with BOQ items |
| POST | `/api/projects/:id/upload` | Upload BOQ file |
| POST | `/api/projects/:id/price` | Start AI pricing pipeline |
| GET | `/api/projects/:id/status` | Get pricing job status |
| GET | `/api/projects/:id/summary` | 3-scenario pricing summary |
| GET | `/api/projects/:id/report/excel` | Download CSV report |
| GET | `/api/projects/:id/report/pdf` | Download HTML Arabic summary |

### AI Agent Endpoints

| Method | Endpoint | Agent |
|--------|----------|-------|
| POST | `/api/projects/:id/agents/price-review` | Agent 1: KSA Market Comparator |
| POST | `/api/projects/:id/agents/compliance-review` | Agent 2: Compliance Validator |
| POST | `/api/projects/:id/agents/material-takeoff` | Agents 3+4: MTO + BOM |
| POST | `/api/projects/:id/agents/anomaly-detection` | Agent 5: IQR Anomaly Detection |
| POST | `/api/projects/:id/agents/risk-analysis` | Agent 6: Commodity Risk |
| POST | `/api/projects/:id/agents/scope-analysis` | Agent 7: Scope Gaps |
| POST | `/api/projects/:id/agents/negotiation` | Agent 8: Negotiation Strategy |
| POST | `/api/projects/:id/agents/alternatives` | Agent 9: Alternative Materials |
| POST | `/api/projects/:id/agents/run-all` | Run all 9 agents in sequence |

---

## 🗄️ Database Schema

| Table | Purpose |
|-------|---------|
| `projects` | Pricing projects with status and 3-scenario totals |
| `boq_items` | BOQ line items with pricing, confidence, compliance, anomaly flags |
| `materials` | Saudi electrical materials price database |
| `conversations` + `messages` | Anthropic AI integration tables |
| `price_reviews` | AI agent review findings (Agents 1, 2, 5) |
| `material_takeoff` | Sub-component breakdown (Agents 3, 4) |
| `scope_gaps` | Missing required systems (Agent 7) |
| `project_risk` | Commodity exposure analysis (Agent 6) |
| `alternatives` | Cheaper SASO-compliant material alternatives (Agent 9) |

---

## 📄 License

MIT License — feel free to use and adapt for your own electrical pricing projects.

---

<p align="center">Built with ❤️ for the Saudi Arabian construction and electrical engineering market.</p>
