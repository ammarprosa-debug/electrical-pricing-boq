import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, boqItemsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { CreateProjectBody, GetProjectParams, GetProjectSummaryParams, GetReviewQueueParams, GetPricingStatusParams } from "@workspace/api-zod";

const router = Router();

router.get("/projects/stats", async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt)).limit(5);
    const all = await db.select().from(projectsTable);
    const totalItemsPriced = all.reduce((acc, p) => acc + (p.pricedItems || 0), 0);
    const avgConf = await db.execute(sql`SELECT AVG(confidence_score) as avg FROM boq_items WHERE confidence_score IS NOT NULL`);
    res.json({
      totalProjects: all.length,
      completedProjects: all.filter(p => p.status === "completed").length,
      inProgressProjects: all.filter(p => ["parsing", "pricing", "reviewing"].includes(p.status)).length,
      totalItemsPriced,
      avgConfidenceScore: Number((avgConf.rows[0] as any)?.avg) || 0,
      recentProjects: projects,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/projects", async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt));
    res.json(projects);
  } catch (err) {
    req.log.error({ err }, "Failed to list projects");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/projects", async (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [project] = await db.insert(projectsTable).values(parsed.data).returning();
    res.status(201).json(project);
  } catch (err) {
    req.log.error({ err }, "Failed to create project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/projects/:id", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, id));
    res.json({ ...project, boqItems: items });
  } catch (err) {
    req.log.error({ err }, "Failed to get project");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/projects/:id/status", async (req, res) => {
  const { id } = GetPricingStatusParams.parse(req.params);
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, id));
    const priced = items.filter(i => i.status !== "pending").length;
    res.json({
      status: project.status,
      progress: project.totalItems > 0 ? Math.round((priced / project.totalItems) * 100) : 0,
      currentStep: project.status === "pricing" ? "Pricing items with AI..." : project.status,
      itemsTotal: project.totalItems,
      itemsDone: priced,
      errors: [],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get pricing status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/projects/:id/summary", async (req, res) => {
  const { id } = GetProjectSummaryParams.parse(req.params);
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, id));
    const pricedItems = items.filter(i => i.unitPriceStandard !== null);

    const calcScenario = (priceKey: "unitPriceEconomical" | "unitPriceStandard" | "unitPricePremium") => {
      const subtotal = pricedItems.reduce((s, i) => s + (i[priceKey] || 0) * i.quantity, 0);
      const laborTotal = pricedItems.reduce((s, i) => s + (i.laborCost || 0), 0);
      const vatTotal = (subtotal + laborTotal) * 0.15;
      return { subtotal, laborTotal, vatTotal, grandTotal: subtotal + laborTotal + vatTotal };
    };

    const categoryMap = new Map<string, { count: number; total: number }>();
    pricedItems.forEach(i => {
      const cat = i.categoryLevel1 || "General";
      const existing = categoryMap.get(cat) || { count: 0, total: 0 };
      categoryMap.set(cat, {
        count: existing.count + 1,
        total: existing.total + (i.unitPriceStandard || 0) * i.quantity,
      });
    });
    const totalStd = Array.from(categoryMap.values()).reduce((s, v) => s + v.total, 0);
    const categoryBreakdown = Array.from(categoryMap.entries()).map(([cat, v]) => ({
      category: cat,
      itemCount: v.count,
      totalStandard: v.total,
      percentage: totalStd > 0 ? (v.total / totalStd) * 100 : 0,
    }));

    res.json({
      projectId: id,
      totalItems: project.totalItems,
      pricedItems: pricedItems.length,
      scenarios: {
        economical: calcScenario("unitPriceEconomical"),
        standard: calcScenario("unitPriceStandard"),
        premium: calcScenario("unitPricePremium"),
      },
      categoryBreakdown,
      complianceSummary: {
        pass: items.filter(i => i.complianceStatus === "pass").length,
        warning: items.filter(i => i.complianceStatus === "warning").length,
        fail: items.filter(i => i.complianceStatus === "fail").length,
        pending: items.filter(i => i.complianceStatus === "pending").length,
      },
      reviewQueue: items.filter(i => i.needsReview).length,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get project summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/projects/:id/review-queue", async (req, res) => {
  const { id } = GetReviewQueueParams.parse(req.params);
  try {
    const items = await db.select().from(boqItemsTable)
      .where(eq(boqItemsTable.projectId, id));
    res.json(items.filter(i => i.needsReview || i.anomalyFlag));
  } catch (err) {
    req.log.error({ err }, "Failed to get review queue");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
