/**
 * Agent 6 — Commodity Risk Analyzer
 * Calculates copper/aluminum/steel exposure, contingency recommendations,
 * and overall project risk profile
 */
import { db } from "@workspace/db";
import { boqItemsTable, projectRiskTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

// Commodity content as % of material cost
const COMMODITY_CONTENT: Record<string, { cu?: number; al?: number; steel?: number }> = {
  "Cables & Wiring": { cu: 0.55 },
  "Panels & Distribution": { cu: 0.15, steel: 0.25 },
  "Earthing & Lightning": { cu: 0.70 },
  "Conduits & Trunking": { steel: 0.40 },
  "Transformers": { cu: 0.30, al: 0.10, steel: 0.25 },
  "Motors & Drives": { cu: 0.25, steel: 0.30 },
  "Busbar & Busduct": { cu: 0.65 },
};

const RISK_THRESHOLDS = [
  { level: "low",      minPct: 0,  maxPct: 15, contingency: 0.03 },
  { level: "medium",   minPct: 15, maxPct: 30, contingency: 0.07 },
  { level: "high",     minPct: 30, maxPct: 50, contingency: 0.12 },
  { level: "critical", minPct: 50, maxPct: 100, contingency: 0.18 },
];

type RiskLevel = "low" | "medium" | "high" | "critical";

interface ItemRisk {
  id: number;
  desc: string;
  category: string;
  totalSar: number;
  commodityExposureSar: number;
  commodityExposurePct: number;
  dominantCommodity: "copper" | "aluminum" | "steel" | "none";
  riskLevel: RiskLevel;
}

interface RiskResult {
  riskLevel: RiskLevel;
  totalProjectCost: number;
  commodityExposureSar: number;
  commodityExposurePct: number;
  contingencySar: number;
  contingencyPct: number;
  copperSar: number;
  aluminumSar: number;
  steelSar: number;
  itemsAtRisk: ItemRisk[];
  categoryBreakdown: Record<string, { totalSar: number; exposureSar: number; exposurePct: number }>;
}

export async function runRiskAnalysis(projectId: number): Promise<RiskResult> {
  logger.info({ projectId }, "Agent 6: Starting commodity risk analysis");

  const items = await db.select().from(boqItemsTable)
    .where(eq(boqItemsTable.projectId, projectId));
  const pricedItems = items.filter(i => i.totalStandard && i.totalStandard > 0);

  if (pricedItems.length === 0) {
    return {
      riskLevel: "low", totalProjectCost: 0, commodityExposureSar: 0,
      commodityExposurePct: 0, contingencySar: 0, contingencyPct: 0,
      copperSar: 0, aluminumSar: 0, steelSar: 0, itemsAtRisk: [], categoryBreakdown: {},
    };
  }

  const totalProjectCost = pricedItems.reduce((s, i) => s + (i.totalStandard || 0), 0);
  let totalCu = 0, totalAl = 0, totalSteel = 0;
  const itemsAtRisk: ItemRisk[] = [];
  const catBreakdown: RiskResult["categoryBreakdown"] = {};

  for (const item of pricedItems) {
    const cat = item.categoryLevel1 || "General";
    const commodity = COMMODITY_CONTENT[cat];
    const itemCost = item.totalStandard || 0;
    const materialCost = item.supplyPrice ? item.supplyPrice * item.quantity : itemCost * 0.65;

    if (!catBreakdown[cat]) catBreakdown[cat] = { totalSar: 0, exposureSar: 0, exposurePct: 0 };
    catBreakdown[cat].totalSar += itemCost;

    if (!commodity) continue;
    const cuExp = (commodity.cu || 0) * materialCost;
    const alExp = (commodity.al || 0) * materialCost;
    const steelExp = (commodity.steel || 0) * materialCost;
    const totalExp = cuExp + alExp + steelExp;

    totalCu += cuExp;
    totalAl += alExp;
    totalSteel += steelExp;
    catBreakdown[cat].exposureSar += totalExp;

    const expPct = (totalExp / itemCost) * 100;
    if (expPct > 10) {
      const dom = cuExp >= alExp && cuExp >= steelExp ? "copper"
        : alExp >= steelExp ? "aluminum" : "steel";
      const threshold = RISK_THRESHOLDS.find(t => expPct >= t.minPct && expPct < t.maxPct) || RISK_THRESHOLDS[0];
      itemsAtRisk.push({
        id: item.id,
        desc: item.descriptionEn.slice(0, 100),
        category: cat,
        totalSar: itemCost,
        commodityExposureSar: totalExp,
        commodityExposurePct: expPct,
        dominantCommodity: dom,
        riskLevel: threshold.level as RiskLevel,
      });
    }
  }

  // Finalize category breakdown percentages
  for (const cat of Object.keys(catBreakdown)) {
    const c = catBreakdown[cat];
    c.exposurePct = c.totalSar > 0 ? (c.exposureSar / c.totalSar) * 100 : 0;
  }

  const totalExposure = totalCu + totalAl + totalSteel;
  const exposurePct = (totalExposure / totalProjectCost) * 100;
  const threshold = RISK_THRESHOLDS.slice().reverse()
    .find(t => exposurePct >= t.minPct) || RISK_THRESHOLDS[0];
  const contingencyPct = threshold.contingency;
  const contingencySar = totalProjectCost * contingencyPct;

  const result: RiskResult = {
    riskLevel: threshold.level as RiskLevel,
    totalProjectCost,
    commodityExposureSar: totalExposure,
    commodityExposurePct: exposurePct,
    contingencySar,
    contingencyPct: contingencyPct * 100,
    copperSar: totalCu,
    aluminumSar: totalAl,
    steelSar: totalSteel,
    itemsAtRisk: itemsAtRisk.sort((a, b) => b.commodityExposureSar - a.commodityExposureSar).slice(0, 20),
    categoryBreakdown: catBreakdown,
  };

  // Upsert into DB
  const existing = await db.select({ id: projectRiskTable.id }).from(projectRiskTable)
    .where(eq(projectRiskTable.projectId, projectId));

  const row = {
    projectId,
    overallRiskLevel: result.riskLevel,
    totalProjectCost: result.totalProjectCost,
    commodityExposureSar: result.commodityExposureSar,
    commodityExposurePct: result.commodityExposurePct,
    recommendedContingencySar: result.contingencySar,
    recommendedContingencyPct: result.contingencyPct,
    copperExposureSar: totalCu,
    aluminumExposureSar: totalAl,
    steelExposureSar: totalSteel,
    itemsAtRisk: result.itemsAtRisk as unknown as Record<string, unknown>[],
    categoryBreakdown: catBreakdown as unknown as Record<string, unknown>,
    anomalyCount: 0,
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    await db.update(projectRiskTable).set(row).where(eq(projectRiskTable.projectId, projectId));
  } else {
    await db.insert(projectRiskTable).values(row);
  }

  logger.info({ projectId, riskLevel: result.riskLevel, exposurePct: exposurePct.toFixed(1) }, "Agent 6 risk analysis complete");
  return result;
}
