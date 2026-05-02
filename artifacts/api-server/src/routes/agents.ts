import { Router } from "express";
import { db } from "@workspace/db";
import { priceReviewsTable, materialTakeoffTable, boqItemsTable, projectsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { GetProjectParams } from "@workspace/api-zod";
import { runMarketPriceReview, runComplianceReview } from "../lib/priceReviewAgent.js";
import { runMaterialTakeoff, runBomEnrichment } from "../lib/materialTakeoffAgent.js";

const router = Router();

// ── Running agent jobs tracker ────────────────────────────────────────────────
const agentJobs = new Map<string, { status: "running" | "done" | "error"; result?: unknown; startedAt: Date }>();

function jobKey(projectId: number, agentType: string) { return `${projectId}:${agentType}`; }

// ── POST: Run Agent 1 — Market Price Review ────────────────────────────────
router.post("/projects/:id/agents/price-review", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "price-review");
  if (agentJobs.get(key)?.status === "running") {
    res.json({ status: "running", message: "الوكيل يعمل بالفعل" });
    return;
  }
  agentJobs.set(key, { status: "running", startedAt: new Date() });
  res.json({ status: "started", message: "وكيل مراجعة الأسعار بدأ العمل" });

  runMarketPriceReview(id).then(result => {
    agentJobs.set(key, { status: "done", result, startedAt: new Date() });
  }).catch(err => {
    req.log.error({ err, id }, "Agent 1 failed");
    agentJobs.set(key, { status: "error", result: { error: String(err) }, startedAt: new Date() });
  });
});

// ── POST: Run Agent 2 — Compliance & Consistency Review ───────────────────
router.post("/projects/:id/agents/compliance-review", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "compliance-review");
  if (agentJobs.get(key)?.status === "running") {
    res.json({ status: "running", message: "الوكيل يعمل بالفعل" });
    return;
  }
  agentJobs.set(key, { status: "running", startedAt: new Date() });
  res.json({ status: "started", message: "وكيل مراجعة الامتثال بدأ العمل" });

  runComplianceReview(id).then(result => {
    agentJobs.set(key, { status: "done", result, startedAt: new Date() });
  }).catch(err => {
    req.log.error({ err, id }, "Agent 2 failed");
    agentJobs.set(key, { status: "error", result: { error: String(err) }, startedAt: new Date() });
  });
});

// ── POST: Run Agent 3 — Material Takeoff ──────────────────────────────────
router.post("/projects/:id/agents/material-takeoff", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const itemIds: number[] | undefined = req.body?.itemIds;
  const key = jobKey(id, "material-takeoff");
  if (agentJobs.get(key)?.status === "running") {
    res.json({ status: "running", message: "وكيل التحليل المادي يعمل بالفعل" });
    return;
  }
  agentJobs.set(key, { status: "running", startedAt: new Date() });
  res.json({ status: "started", message: "وكيل تفصيل المواد بدأ العمل" });

  runMaterialTakeoff(id, itemIds).then(async result => {
    await runBomEnrichment(id);
    agentJobs.set(key, { status: "done", result, startedAt: new Date() });
  }).catch(err => {
    req.log.error({ err, id }, "Agent 3 failed");
    agentJobs.set(key, { status: "error", result: { error: String(err) }, startedAt: new Date() });
  });
});

// ── POST: Run ALL agents (full analysis) ─────────────────────────────────
router.post("/projects/:id/agents/run-all", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const key = jobKey(id, "run-all");
  if (agentJobs.get(key)?.status === "running") {
    res.json({ status: "running", message: "الوكلاء يعملون بالفعل" });
    return;
  }
  agentJobs.set(key, { status: "running", startedAt: new Date() });
  res.json({ status: "started", message: "تم تشغيل جميع الوكلاء — المراجعة + تفصيل المواد" });

  Promise.all([
    runMarketPriceReview(id),
    runComplianceReview(id),
  ]).then(async ([r1, r2]) => {
    const r3 = await runMaterialTakeoff(id);
    await runBomEnrichment(id);
    agentJobs.set(key, { status: "done", result: { marketReview: r1, complianceReview: r2, takeoff: r3 }, startedAt: new Date() });
  }).catch(err => {
    req.log.error({ err, id }, "Run-all failed");
    agentJobs.set(key, { status: "error", result: { error: String(err) }, startedAt: new Date() });
  });
});

// ── GET: Agent job status ─────────────────────────────────────────────────
router.get("/projects/:id/agents/status", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const allKeys = ["price-review", "compliance-review", "material-takeoff", "run-all"];
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
    let reviews = await db.select().from(priceReviewsTable)
      .where(eq(priceReviewsTable.projectId, id));

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
    const reviews = await db.select().from(priceReviewsTable)
      .where(eq(priceReviewsTable.projectId, id));

    res.json({
      total: reviews.length,
      critical: reviews.filter(r => r.severity === "critical").length,
      warnings: reviews.filter(r => r.severity === "warning").length,
      info: reviews.filter(r => r.severity === "info").length,
      pending: reviews.filter(r => r.status === "pending").length,
      byAgent: {
        market_comparator: reviews.filter(r => r.agentId === "market_comparator").length,
        compliance_validator: reviews.filter(r => r.agentId === "compliance_validator").length,
      },
      byType: reviews.reduce((acc: Record<string, number>, r) => {
        acc[r.reviewType] = (acc[r.reviewType] || 0) + 1;
        return acc;
      }, {}),
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
    const [review] = await db.select().from(priceReviewsTable)
      .where(eq(priceReviewsTable.id, reviewId));
    if (!review) { res.status(404).json({ error: "Not found" }); return; }

    const updates: Partial<typeof priceReviewsTable.$inferInsert> = {
      status: status as "pending" | "accepted" | "rejected" | "auto_fixed" | undefined,
      updatedAt: new Date(),
    };

    // Auto-apply suggested price if requested
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

    const [updated] = await db.update(priceReviewsTable)
      .set(updates as Parameters<typeof db.update>[0] extends infer T ? T : never)
      .where(eq(priceReviewsTable.id, reviewId))
      .returning();

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
    let rows = await db.select().from(materialTakeoffTable)
      .where(eq(materialTakeoffTable.projectId, id));

    if (boqItemId) rows = rows.filter(r => r.boqItemId === boqItemId);

    // Group by BOQ item
    const grouped: Record<number, {
      boqItemId: number;
      parentDesc: string;
      items: typeof rows;
      totals: { min: number; std: number; premium: number };
    }> = {};

    for (const row of rows) {
      if (!grouped[row.boqItemId]) {
        grouped[row.boqItemId] = {
          boqItemId: row.boqItemId,
          parentDesc: row.parentBoqDesc,
          items: [],
          totals: { min: 0, std: 0, premium: 0 },
        };
      }
      grouped[row.boqItemId].items.push(row);
      grouped[row.boqItemId].totals.min += (row.unitPriceMin || 0) * row.quantity;
      grouped[row.boqItemId].totals.std += (row.unitPriceStd || 0) * row.quantity;
      grouped[row.boqItemId].totals.premium += (row.unitPricePremium || 0) * row.quantity;
    }

    const summary = {
      totalSubItems: rows.length,
      totalMaterials: rows.filter(r => !r.isLabor).length,
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
    const rows = await db.select().from(materialTakeoffTable)
      .where(eq(materialTakeoffTable.projectId, id));

    const catMap: Record<string, { qty: number; total: number }> = {};
    for (const r of rows) {
      const cat = r.category || "Other";
      if (!catMap[cat]) catMap[cat] = { qty: 0, total: 0 };
      catMap[cat].qty += r.quantity;
      catMap[cat].total += r.totalPriceStd || 0;
    }

    res.json({
      totalItems: rows.length,
      materials: rows.filter(r => !r.isLabor && !r.isAccessory).length,
      labor: rows.filter(r => r.isLabor).length,
      accessories: rows.filter(r => r.isAccessory).length,
      grandTotal: rows.reduce((s, r) => s + (r.totalPriceStd || 0), 0),
      categories: Object.entries(catMap)
        .map(([cat, v]) => ({ cat, qty: Math.round(v.qty), total: Math.round(v.total) }))
        .sort((a, b) => b.total - a.total),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get takeoff summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
