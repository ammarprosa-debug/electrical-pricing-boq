import { Router } from "express";
import { db } from "@workspace/db";
import {
  priceReviewsTable, materialTakeoffTable, boqItemsTable, projectsTable,
  scopeGapsTable, projectRiskTable, alternativesTable,
  laborCostsTable, procurementTable, procurementSummaryTable,
  projectTimelineTable, timelinePhasesTable,
  valueEngineeringTable, veProjectSummaryTable,
  subcontractorSplitTable, subcontractorSummaryTable,
  boqDocumentsTable, materialUpdateJobsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { GetProjectParams } from "@workspace/api-zod";
import { runMarketPriceReview, runComplianceReview } from "../lib/priceReviewAgent.js";
import { runMaterialTakeoff, runBomEnrichment } from "../lib/materialTakeoffAgent.js";
import { runAnomalyDetection } from "../lib/anomalyAgent.js";
import { runRiskAnalysis } from "../lib/riskAgent.js";
import { runScopeAnalysis } from "../lib/scopeAnalyzerAgent.js";
import { runNegotiationAnalysis } from "../lib/negotiationAgent.js";
import { runAlternativesAnalysis } from "../lib/alternativesAgent.js";
import { runLaborOptimizer } from "../lib/laborOptimizerAgent.js";
import { runProcurementPlanning } from "../lib/procurementAgent.js";
import { runValueEngineering } from "../lib/valueEngineeringAgent.js";
import { runTimelineEstimation } from "../lib/timelineAgent.js";
import { runSubcontractorSplit } from "../lib/subcontractorAgent.js";
import { runMaterialsPriceUpdate, getLatestMaterialUpdateJob } from "../lib/materialsPriceManager.js";
import { runBoqFormatter } from "../lib/boqFormatterAgent.js";
import { runBoqReview } from "../lib/boqReviewerAgent.js";

const router = Router();

// ── Running agent jobs tracker ────────────────────────────────────────────────
const agentJobs = new Map<string, { status: "running" | "done" | "error"; result?: unknown; startedAt: Date }>();

function jobKey(projectId: number, agentType: string) { return `${projectId}:${agentType}`; }
function launchJob(key: string, fn: () => Promise<unknown>, logCtx: { id: number; agent: string }, req: { log: { error: (...a: unknown[]) => void } }) {
  agentJobs.set(key, { status: "running", startedAt: new Date() });
  fn().then(result => {
    agentJobs.set(key, { status: "done", result, startedAt: new Date() });
  }).catch(err => {
    req.log.error({ err, ...logCtx }, `${logCtx.agent} failed`);
    agentJobs.set(key, { status: "error", result: { error: String(err) }, startedAt: new Date() });
  });
}

// ── POST: Run Agent 1 — Market Price Review ────────────────────────────────
router.post("/projects/:id/agents/price-review", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "price-review");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runMarketPriceReview(id), { id, agent: "Agent 1" }, req);
  res.json({ status: "started", message: "وكيل مراجعة الأسعار بدأ العمل" });
});

// ── POST: Run Agent 2 — Compliance & Consistency Review ───────────────────
router.post("/projects/:id/agents/compliance-review", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "compliance-review");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runComplianceReview(id), { id, agent: "Agent 2" }, req);
  res.json({ status: "started", message: "وكيل مراجعة الامتثال بدأ العمل" });
});

// ── POST: Run Agent 3+4 — Material Takeoff + BOM Enrichment ───────────────
router.post("/projects/:id/agents/material-takeoff", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const itemIds: number[] | undefined = req.body?.itemIds;
  const key = jobKey(id, "material-takeoff");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, async () => {
    const r = await runMaterialTakeoff(id, itemIds);
    await runBomEnrichment(id);
    return r;
  }, { id, agent: "Agent 3+4" }, req);
  res.json({ status: "started", message: "وكيل تفصيل المواد بدأ العمل" });
});

// ── POST: Run Agent 5 — Anomaly Detection ─────────────────────────────────
router.post("/projects/:id/agents/anomaly-detection", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "anomaly-detection");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runAnomalyDetection(id), { id, agent: "Agent 5" }, req);
  res.json({ status: "started", message: "وكيل كشف الشذوذ بدأ العمل" });
});

// ── POST: Run Agent 6 — Commodity Risk Analysis ────────────────────────────
router.post("/projects/:id/agents/risk-analysis", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "risk-analysis");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runRiskAnalysis(id), { id, agent: "Agent 6" }, req);
  res.json({ status: "started", message: "وكيل تحليل المخاطر بدأ العمل" });
});

// ── POST: Run Agent 7 — Scope Gap Analyzer ────────────────────────────────
router.post("/projects/:id/agents/scope-analysis", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "scope-analysis");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runScopeAnalysis(id), { id, agent: "Agent 7" }, req);
  res.json({ status: "started", message: "وكيل تحليل النطاق بدأ العمل" });
});

// ── POST: Run Agent 8 — Negotiation Strategy ──────────────────────────────
router.post("/projects/:id/agents/negotiation", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "negotiation");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runNegotiationAnalysis(id), { id, agent: "Agent 8" }, req);
  res.json({ status: "started", message: "وكيل استراتيجية التفاوض بدأ العمل" });
});

// ── POST: Run Agent 9 — Alternative Materials ─────────────────────────────
router.post("/projects/:id/agents/alternatives", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "alternatives");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runAlternativesAnalysis(id), { id, agent: "Agent 9" }, req);
  res.json({ status: "started", message: "وكيل المواد البديلة بدأ العمل" });
});

// ── POST: Run Agent 10 — Labor Cost Optimizer ─────────────────────────────
router.post("/projects/:id/agents/labor-optimizer", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const region = (req.body?.region as string) || "Riyadh";
  const key = jobKey(id, "labor-optimizer");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runLaborOptimizer(id, region), { id, agent: "Agent 10" }, req);
  res.json({ status: "started", message: "وكيل تحسين تكاليف العمالة بدأ العمل" });
});

// ── POST: Run Agent 11 — Procurement Planning ─────────────────────────────
router.post("/projects/:id/agents/procurement", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "procurement");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runProcurementPlanning(id), { id, agent: "Agent 11" }, req);
  res.json({ status: "started", message: "وكيل تخطيط المشتريات بدأ العمل" });
});

// ── POST: Run Agent 12 — Value Engineering ────────────────────────────────
router.post("/projects/:id/agents/value-engineering", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "value-engineering");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runValueEngineering(id), { id, agent: "Agent 12" }, req);
  res.json({ status: "started", message: "وكيل هندسة القيمة بدأ العمل" });
});

// ── POST: Run Agent 13 — Timeline Estimation ──────────────────────────────
router.post("/projects/:id/agents/timeline", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "timeline");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runTimelineEstimation(id), { id, agent: "Agent 13" }, req);
  res.json({ status: "started", message: "وكيل تقدير الجدول الزمني بدأ العمل" });
});

// ── POST: Run Agent 14 — Subcontractor Split ──────────────────────────────
router.post("/projects/:id/agents/subcontractor-split", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "subcontractor-split");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runSubcontractorSplit(id), { id, agent: "Agent 14" }, req);
  res.json({ status: "started", message: "وكيل تقسيم المقاولين بدأ العمل" });
});

// ── POST: Run Agent 16 — BOQ Formatter ────────────────────────────────────
router.post("/projects/:id/agents/boq-format", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const scenario = (req.body?.scenario as "standard" | "economical" | "premium") || "standard";
  const key = jobKey(id, "boq-format");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runBoqFormatter(id, scenario), { id, agent: "Agent 16" }, req);
  res.json({ status: "started", message: "وكيل تنسيق المقايسة بدأ العمل" });
});

// ── POST: Run Agent 17 — BOQ Reviewer ────────────────────────────────────
router.post("/projects/:id/agents/boq-review", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "boq-review");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runBoqReview(id), { id, agent: "Agent 17" }, req);
  res.json({ status: "started", message: "وكيل مراجعة المقايسة بدأ العمل" });
});

// ── POST: Agent 15 — Materials Price Manager (global, no project) ─────────
router.post("/agents/materials-price-update", async (req, res) => {
  const forceAll = req.body?.forceAll === true;
  const key = "global:materials-price-update";
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, () => runMaterialsPriceUpdate(forceAll), { id: 0, agent: "Agent 15" }, req);
  res.json({ status: "started", message: "وكيل إدارة أسعار المواد بدأ العمل" });
});

router.get("/agents/materials-price-update/status", async (req, res) => {
  const key = "global:materials-price-update";
  const job = agentJobs.get(key);
  const latestJob = await getLatestMaterialUpdateJob();
  res.json({ jobStatus: job || { status: "idle" }, latestJob });
});

// ── POST: Run ALL 17 agents (full intelligence suite) ─────────────────────
router.post("/projects/:id/agents/run-all", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "run-all");
  if (agentJobs.get(key)?.status === "running") { res.json({ status: "running" }); return; }
  launchJob(key, async () => {
    // Stage 1: Price review agents (parallel)
    const [r1, r2] = await Promise.all([
      runMarketPriceReview(id),
      runComplianceReview(id),
    ]);
    // Stage 2: Takeoff + Scope + Labor + Subcontractor (parallel)
    const [r3, r7, r10, r14] = await Promise.all([
      runMaterialTakeoff(id).then(async r => { await runBomEnrichment(id); return r; }),
      runScopeAnalysis(id),
      runLaborOptimizer(id),
      runSubcontractorSplit(id),
    ]);
    // Stage 3: Risk + Alternatives + Anomaly + Procurement + Timeline (parallel)
    const [r5, r6, r9, r11, r13] = await Promise.all([
      runAnomalyDetection(id),
      runRiskAnalysis(id),
      runAlternativesAnalysis(id, 30),
      runProcurementPlanning(id),
      runTimelineEstimation(id),
    ]);
    // Stage 4: Negotiation + Value Engineering (needs earlier data)
    const [r8, r12] = await Promise.all([
      runNegotiationAnalysis(id),
      runValueEngineering(id),
    ]);
    // Stage 5: BOQ Format + Review (needs all data)
    const r16 = await runBoqFormatter(id);
    const r17 = await runBoqReview(id);
    return {
      priceReview: r1, compliance: r2, takeoff: r3, scopeGaps: r7, anomalies: r5,
      risk: r6, alternatives: r9, negotiation: r8, laborOptimizer: r10,
      procurement: r11, valueEngineering: r12, timeline: r13, subcontractor: r14,
      boqFormat: r16, boqReview: r17,
    };
  }, { id, agent: "All Agents" }, req);
  res.json({ status: "started", message: "تم تشغيل جميع الوكلاء — 17 وكيل يعملون بالتسلسل الذكي" });
});

// ── GET: Agent job status ─────────────────────────────────────────────────
router.get("/projects/:id/agents/status", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const allKeys = ["price-review", "compliance-review", "material-takeoff", "anomaly-detection",
    "risk-analysis", "scope-analysis", "negotiation", "alternatives",
    "labor-optimizer", "procurement", "value-engineering", "timeline", "subcontractor-split",
    "boq-format", "boq-review", "run-all"];
  const statuses: Record<string, unknown> = {};
  for (const k of allKeys) {
    const job = agentJobs.get(jobKey(id, k));
    statuses[k] = job ? { status: job.status, result: job.result, startedAt: job.startedAt } : { status: "idle" };
  }
  res.json(statuses);
});

// ── GET: Price reviews for project ───────────────────────────────────────
router.get("/projects/:id/price-reviews", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const agentId = req.query.agent as string | undefined;
  const severity = req.query.severity as string | undefined;
  try {
    let reviews = await db.select().from(priceReviewsTable).where(eq(priceReviewsTable.projectId, id));
    if (agentId) reviews = reviews.filter(r => r.agentId === agentId);
    if (severity) reviews = reviews.filter(r => r.severity === severity);
    res.json(reviews);
  } catch (err) {
    req.log.error({ err }, "Failed to get price reviews");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET: Price reviews summary ───────────────────────────────────────────
router.get("/projects/:id/price-reviews/summary", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const reviews = await db.select().from(priceReviewsTable).where(eq(priceReviewsTable.projectId, id));
    res.json({
      total: reviews.length,
      critical: reviews.filter(r => r.severity === "critical").length,
      warnings: reviews.filter(r => r.severity === "warning").length,
      info: reviews.filter(r => r.severity === "info").length,
      pending: reviews.filter(r => r.status === "pending").length,
      byAgent: reviews.reduce((acc: Record<string, number>, r) => { acc[r.agentId] = (acc[r.agentId] || 0) + 1; return acc; }, {}),
      byType: reviews.reduce((acc: Record<string, number>, r) => { acc[r.reviewType] = (acc[r.reviewType] || 0) + 1; return acc; }, {}),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get review summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH: Accept/reject a review ────────────────────────────────────────
router.patch("/price-reviews/:reviewId", async (req, res) => {
  const reviewId = Number(req.params.reviewId);
  const { status, applyFix } = req.body as { status?: string; applyFix?: boolean };
  try {
    const [review] = await db.select().from(priceReviewsTable).where(eq(priceReviewsTable.id, reviewId));
    if (!review) { res.status(404).json({ error: "Not found" }); return; }
    const updates: Partial<typeof priceReviewsTable.$inferInsert> = {
      status: status as "pending" | "accepted" | "rejected" | "auto_fixed" | undefined,
      updatedAt: new Date(),
    };
    if (applyFix && review.suggestedValue && review.boqItemId) {
      const suggested = review.suggestedValue;
      await db.update(boqItemsTable).set({
        unitPriceStandard: suggested,
        unitPriceEconomical: Math.ceil(suggested * 0.78),
        unitPricePremium: Math.ceil(suggested * 1.32),
        updatedAt: new Date(),
      }).where(eq(boqItemsTable.id, review.boqItemId));
      updates.autoFixApplied = true;
      updates.status = "auto_fixed";
    }
    const [updated] = await db.update(priceReviewsTable).set(updates as Parameters<typeof db.update>[0] extends infer T ? T : never).where(eq(priceReviewsTable.id, reviewId)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update review");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET: Material takeoff for project ─────────────────────────────────────
router.get("/projects/:id/takeoff", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const boqItemId = req.query.itemId ? Number(req.query.itemId) : undefined;
  try {
    let rows = await db.select().from(materialTakeoffTable).where(eq(materialTakeoffTable.projectId, id));
    if (boqItemId) rows = rows.filter(r => r.boqItemId === boqItemId);
    const grouped: Record<number, { boqItemId: number; parentDesc: string; items: typeof rows; totals: { min: number; std: number; premium: number } }> = {};
    for (const row of rows) {
      if (!grouped[row.boqItemId]) grouped[row.boqItemId] = { boqItemId: row.boqItemId, parentDesc: row.parentBoqDesc, items: [], totals: { min: 0, std: 0, premium: 0 } };
      grouped[row.boqItemId].items.push(row);
      grouped[row.boqItemId].totals.min += (row.unitPriceMin || 0) * row.quantity;
      grouped[row.boqItemId].totals.std += (row.unitPriceStd || 0) * row.quantity;
      grouped[row.boqItemId].totals.premium += (row.unitPricePremium || 0) * row.quantity;
    }
    const summary = {
      totalSubItems: rows.length, totalMaterials: rows.filter(r => !r.isLabor).length,
      totalLabor: rows.filter(r => r.isLabor).length,
      grandTotalStd: rows.reduce((s, r) => s + (r.totalPriceStd || 0), 0),
      categories: [...new Set(rows.map(r => r.category).filter(Boolean))],
    };
    res.json({ groups: Object.values(grouped), summary });
  } catch (err) {
    req.log.error({ err }, "Failed to get takeoff");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET: Takeoff summary stats ────────────────────────────────────────────
router.get("/projects/:id/takeoff/summary", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const rows = await db.select().from(materialTakeoffTable).where(eq(materialTakeoffTable.projectId, id));
    const catMap: Record<string, { qty: number; total: number }> = {};
    for (const r of rows) {
      const cat = r.category || "Other";
      if (!catMap[cat]) catMap[cat] = { qty: 0, total: 0 };
      catMap[cat].qty += r.quantity;
      catMap[cat].total += r.totalPriceStd || 0;
    }
    res.json({
      totalItems: rows.length, materials: rows.filter(r => !r.isLabor && !r.isAccessory).length,
      labor: rows.filter(r => r.isLabor).length, accessories: rows.filter(r => r.isAccessory).length,
      grandTotal: rows.reduce((s, r) => s + (r.totalPriceStd || 0), 0),
      categories: Object.entries(catMap).map(([cat, v]) => ({ cat, qty: Math.round(v.qty), total: Math.round(v.total) })).sort((a, b) => b.total - a.total),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get takeoff summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET: Scope gaps for project ───────────────────────────────────────────
router.get("/projects/:id/scope-gaps", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const gaps = await db.select().from(scopeGapsTable).where(eq(scopeGapsTable.projectId, id));
    res.json(gaps);
  } catch (err) {
    req.log.error({ err }, "Failed to get scope gaps");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET: Risk analysis for project ───────────────────────────────────────
router.get("/projects/:id/risk", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const [risk] = await db.select().from(projectRiskTable).where(eq(projectRiskTable.projectId, id));
    res.json(risk || null);
  } catch (err) {
    req.log.error({ err }, "Failed to get risk");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET: Alternatives for project ────────────────────────────────────────
router.get("/projects/:id/alternatives", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const alts = await db.select().from(alternativesTable).where(eq(alternativesTable.projectId, id));
    res.json(alts);
  } catch (err) {
    req.log.error({ err }, "Failed to get alternatives");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET: Labor costs for project ──────────────────────────────────────────
router.get("/projects/:id/labor-costs", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const [labor] = await db.select().from(laborCostsTable).where(eq(laborCostsTable.projectId, id));
    res.json(labor || null);
  } catch (err) {
    req.log.error({ err }, "Failed to get labor costs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET: Procurement for project ──────────────────────────────────────────
router.get("/projects/:id/procurement", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const [summary] = await db.select().from(procurementSummaryTable).where(eq(procurementSummaryTable.projectId, id));
    const groups = await db.select().from(procurementTable).where(eq(procurementTable.projectId, id));
    res.json({ summary: summary || null, groups });
  } catch (err) {
    req.log.error({ err }, "Failed to get procurement");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET: Value engineering for project ────────────────────────────────────
router.get("/projects/:id/value-engineering", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const [summary] = await db.select().from(veProjectSummaryTable).where(eq(veProjectSummaryTable.projectId, id));
    const findings = await db.select().from(valueEngineeringTable).where(eq(valueEngineeringTable.projectId, id));
    res.json({ summary: summary || null, findings });
  } catch (err) {
    req.log.error({ err }, "Failed to get value engineering");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET: Timeline for project ─────────────────────────────────────────────
router.get("/projects/:id/timeline", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const [timeline] = await db.select().from(projectTimelineTable).where(eq(projectTimelineTable.projectId, id));
    const phases = await db.select().from(timelinePhasesTable).where(eq(timelinePhasesTable.projectId, id));
    res.json({ timeline: timeline || null, phases });
  } catch (err) {
    req.log.error({ err }, "Failed to get timeline");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET: Subcontractor split for project ──────────────────────────────────
router.get("/projects/:id/subcontractor-split", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const [summary] = await db.select().from(subcontractorSummaryTable).where(eq(subcontractorSummaryTable.projectId, id));
    const splits = await db.select().from(subcontractorSplitTable).where(eq(subcontractorSplitTable.projectId, id));
    res.json({ summary: summary || null, splits });
  } catch (err) {
    req.log.error({ err }, "Failed to get subcontractor split");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET: BOQ document for project ─────────────────────────────────────────
router.get("/projects/:id/boq-document", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const docs = await db.select().from(boqDocumentsTable).where(eq(boqDocumentsTable.projectId, id));
    res.json(docs[0] || null);
  } catch (err) {
    req.log.error({ err }, "Failed to get BOQ document");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET: BOQ HTML (rendered) ──────────────────────────────────────────────
router.get("/projects/:id/boq-document/html", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const [doc] = await db.select().from(boqDocumentsTable).where(eq(boqDocumentsTable.projectId, id));
    if (!doc || !doc.htmlContent) {
      res.status(404).send("<h1>No BOQ document generated yet.</h1>");
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(doc.htmlContent);
  } catch (err) {
    req.log.error({ err }, "Failed to get BOQ HTML");
    res.status(500).send("<h1>Error loading BOQ</h1>");
  }
});

export default router;
