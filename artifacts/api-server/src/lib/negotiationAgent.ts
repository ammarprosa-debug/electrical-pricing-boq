/**
 * Agent 8 — Negotiation Strategy Advisor
 * Analyzes BOQ margins, identifies flexible vs fixed-cost items,
 * recommends bid price, discount floor, and payment milestones
 */
import { db } from "@workspace/db";
import { boqItemsTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "./logger.js";

// Category-level margin targets (profit margin %)
const CATEGORY_MARGINS: Record<string, { typical: number; flexible: boolean }> = {
  "Cables & Wiring":        { typical: 10, flexible: false },  // commodity, fixed cost
  "Conduits & Trunking":    { typical: 12, flexible: false },
  "Panels & Distribution":  { typical: 20, flexible: true },   // high margin, negotiable
  "Lighting":               { typical: 22, flexible: true },
  "Wiring Devices":         { typical: 18, flexible: true },
  "Fire Alarm":             { typical: 15, flexible: false },  // safety, less flex
  "CCTV & Security":        { typical: 20, flexible: true },
  "Data & Network":         { typical: 18, flexible: true },
  "Earthing & Lightning":   { typical: 12, flexible: false },
  "General":                { typical: 15, flexible: true },
};

export interface NegotiationResult {
  recommendedBidSar: number;
  safeLowerFloorSar: number;
  maxDiscountPct: number;
  overallMarginPct: number;
  highFlexCategories: string[];
  fixedCostCategories: string[];
  paymentMilestones: Array<{ phase: string; phaseAr: string; pct: number; trigger: string; triggerAr: string }>;
  bidStrategy: string;
  bidStrategyAr: string;
  keyNegotiationPoints: string[];
  keyNegotiationPointsAr: string[];
  competitorUndercut: { likelySar: number; likelyPct: number; riskLevel: string };
}

export async function runNegotiationAnalysis(projectId: number): Promise<NegotiationResult> {
  logger.info({ projectId }, "Agent 8: Starting negotiation strategy analysis");

  const items = await db.select().from(boqItemsTable)
    .where(eq(boqItemsTable.projectId, projectId));
  const [project] = await db.select().from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  const pricedItems = items.filter(i => i.totalStandard && i.totalStandard > 0);
  if (pricedItems.length === 0) {
    throw new Error("No priced items found for negotiation analysis");
  }

  const totalCost = pricedItems.reduce((s, i) => s + (i.totalStandard || 0), 0);

  // Build category breakdown
  const catMap: Record<string, { cost: number; margin: typeof CATEGORY_MARGINS[string] }> = {};
  for (const item of pricedItems) {
    const cat = item.categoryLevel1 || "General";
    const marginInfo = CATEGORY_MARGINS[cat] || CATEGORY_MARGINS["General"];
    if (!catMap[cat]) catMap[cat] = { cost: 0, margin: marginInfo };
    catMap[cat].cost += item.totalStandard || 0;
  }

  const highFlexCategories = Object.entries(catMap)
    .filter(([, v]) => v.margin.flexible && v.cost / totalCost > 0.05)
    .sort(([, a], [, b]) => b.cost - a.cost)
    .map(([cat]) => cat);

  const fixedCostCategories = Object.entries(catMap)
    .filter(([, v]) => !v.margin.flexible && v.cost / totalCost > 0.05)
    .map(([cat]) => cat);

  // Weighted average margin
  const totalMarginValue = Object.entries(catMap).reduce((s, [, v]) => s + v.cost * v.margin.typical / 100, 0);
  const overallMarginPct = (totalMarginValue / totalCost) * 100;

  const materialOnlyEstimate = totalCost / (1 + overallMarginPct / 100);
  const recommendedBidSar = totalCost; // Standard is the starting bid
  const safeLowerFloorSar = materialOnlyEstimate * 1.05; // 5% above material cost
  const maxDiscountPct = ((recommendedBidSar - safeLowerFloorSar) / recommendedBidSar) * 100;

  // Competitor undercutting estimate (based on region)
  const region = project?.region || "riyadh";
  const competitorUndercut = {
    likelyPct: region === "riyadh" ? 8 : region === "jeddah" ? 10 : 7,
    likelySar: 0,
    riskLevel: overallMarginPct < 12 ? "HIGH" : overallMarginPct < 18 ? "MEDIUM" : "LOW",
  };
  competitorUndercut.likelySar = totalCost * (competitorUndercut.likelyPct / 100);

  // Payment milestones based on project size
  const isLargeProject = totalCost > 500000;
  const paymentMilestones = [
    { phase: "Mobilization & Contract Signing", phaseAr: "التعبئة وتوقيع العقد", pct: 10, trigger: "Contract signed + performance bond", triggerAr: "توقيع العقد + ضمان الأداء" },
    { phase: "Material Delivery on Site", phaseAr: "تسليم المواد للموقع", pct: isLargeProject ? 25 : 30, trigger: "Major materials delivered and verified on site", triggerAr: "تسليم المواد الرئيسية وتحققها في الموقع" },
    { phase: "First Fix Complete", phaseAr: "اكتمال أعمال التمديد الخام", pct: 30, trigger: "Conduit, cable, and first-fix works complete", triggerAr: "اكتمال أعمال المواسير والكابلات والتمديدات الخام" },
    { phase: "Testing & Commissioning", phaseAr: "الاختبار والتشغيل", pct: 20, trigger: "All systems tested and signed off by engineer", triggerAr: "اختبار جميع الأنظمة وتوقيع المهندس" },
    { phase: "Final Handover & Retention", phaseAr: "التسليم النهائي والضمان", pct: isLargeProject ? 15 : 10, trigger: "Practical completion certificate issued", triggerAr: "إصدار شهادة الإنجاز العملي" },
  ];

  // AI-powered strategic advice
  const catSummary = Object.entries(catMap)
    .map(([cat, v]) => ({ cat, costSar: Math.round(v.cost), pct: Math.round(v.cost / totalCost * 100), margin: v.margin.typical, flex: v.margin.flexible }))
    .sort((a, b) => b.costSar - a.costSar);

  let bidStrategy = `Standard pricing at SAR ${totalCost.toLocaleString()}. Flexible categories (${highFlexCategories.slice(0, 3).join(", ")}) offer ${maxDiscountPct.toFixed(0)}% headroom. Fixed-cost categories (${fixedCostCategories.slice(0, 2).join(", ")}) should not be reduced.`;
  let bidStrategyAr = `التسعير المعياري بـ ${totalCost.toLocaleString()} ريال. الفئات المرنة تمنح هامش ${maxDiscountPct.toFixed(0)}%.`;
  let keyNegotiationPoints: string[] = [];
  let keyNegotiationPointsAr: string[] = [];

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      system: `You are a senior electrical contractor in Saudi Arabia advising on bid strategy and negotiation. Give practical, concise advice. Return ONLY valid JSON.`,
      messages: [{
        role: "user",
        content: `Provide bid strategy for this electrical project:

Project: ${project?.name || projectId}, Region: ${region}
Total BOQ value: SAR ${totalCost.toLocaleString("en")}
Estimated margin: ${overallMarginPct.toFixed(1)}%
Category breakdown: ${JSON.stringify(catSummary.slice(0, 8))}
Competitor undercut risk: ${competitorUndercut.riskLevel}
Flexible categories: ${highFlexCategories.join(", ")}
Fixed-cost categories: ${fixedCostCategories.join(", ")}

Return JSON:
{
  "bidStrategy": "2-3 sentence strategy in English",
  "bidStrategyAr": "2-3 جملة الاستراتيجية بالعربي",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4"],
  "keyPointsAr": ["النقطة 1", "النقطة 2", "النقطة 3", "النقطة 4"]
}`,
      }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      bidStrategy = parsed.bidStrategy || bidStrategy;
      bidStrategyAr = parsed.bidStrategyAr || bidStrategyAr;
      keyNegotiationPoints = parsed.keyPoints || [];
      keyNegotiationPointsAr = parsed.keyPointsAr || [];
    }
  } catch (err) {
    logger.warn({ err }, "Agent 8 AI advice failed");
  }

  const result: NegotiationResult = {
    recommendedBidSar: Math.round(totalCost),
    safeLowerFloorSar: Math.round(safeLowerFloorSar),
    maxDiscountPct: Math.round(maxDiscountPct * 10) / 10,
    overallMarginPct: Math.round(overallMarginPct * 10) / 10,
    highFlexCategories,
    fixedCostCategories,
    paymentMilestones,
    bidStrategy,
    bidStrategyAr,
    keyNegotiationPoints,
    keyNegotiationPointsAr,
    competitorUndercut,
  };

  logger.info({ projectId, maxDiscountPct: result.maxDiscountPct }, "Agent 8 negotiation analysis complete");
  return result;
}
