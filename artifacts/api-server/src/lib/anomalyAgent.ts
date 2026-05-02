/**
 * Agent 5 — Anomaly Detection (IQR Statistical Method)
 * Detects price outliers, duplicate items, unit mismatches, zero prices
 * Pure statistics — no AI API calls needed. Fast and deterministic.
 */
import { db } from "@workspace/db";
import { boqItemsTable, priceReviewsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

type AnomalyType =
  | "PRICE_TOO_HIGH"
  | "PRICE_TOO_LOW"
  | "DUPLICATE_ITEM"
  | "UNIT_MISMATCH"
  | "ZERO_PRICE"
  | "QUANTITY_OUTLIER"
  | "IMPOSSIBLE_UNIT_PRICE"
  | "INCONSISTENT_SCENARIO";

interface AnomalyResult {
  total: number;
  errors: number;
  warnings: number;
  anomalies: Array<{
    itemId: number;
    type: AnomalyType;
    severity: "warning" | "critical";
    detail: string;
    detailAr: string;
    currentValue?: number;
    expectedRange?: [number, number];
  }>;
}

// Unit price per category expected ranges (SAR) — for sanity checking
const CATEGORY_PRICE_FLOORS: Record<string, number> = {
  "Cables & Wiring": 1.5,
  "Conduits & Trunking": 0.5,
  "Wiring Devices": 5,
  "Lighting": 20,
  "Panels & Distribution": 200,
  "Fire Alarm": 30,
  "CCTV & Security": 40,
  "Data & Network": 10,
  "Earthing & Lightning": 15,
};

const UNIT_MISMATCH_PATTERNS: Array<{ category: string; wrongUnits: string[]; rightUnit: string }> = [
  { category: "Cables & Wiring", wrongUnits: ["roll", "coil", "drum", "NO."], rightUnit: "m" },
  { category: "Conduits & Trunking", wrongUnits: ["NO.", "PC", "pcs"], rightUnit: "m" },
  { category: "Wiring Devices", wrongUnits: ["m", "lot", "LS"], rightUnit: "NO." },
  { category: "Lighting", wrongUnits: ["m", "lot"], rightUnit: "NO." },
];

function calcIQR(values: number[]): { q1: number; q3: number; iqr: number; lower: number; upper: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  return { q1, q3, iqr, lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

export async function runAnomalyDetection(projectId: number): Promise<AnomalyResult> {
  logger.info({ projectId }, "Agent 5: Starting anomaly detection (IQR)");

  const items = await db.select().from(boqItemsTable)
    .where(eq(boqItemsTable.projectId, projectId));

  const pricedItems = items.filter(i => i.unitPriceStandard && i.unitPriceStandard > 0);
  if (pricedItems.length === 0) return { total: 0, errors: 0, warnings: 0, anomalies: [] };

  // Clear previous anomaly reviews from this agent
  await db.delete(priceReviewsTable)
    .where(eq(priceReviewsTable.projectId, projectId))
    .where(eq(priceReviewsTable.agentId, "anomaly_detector") as any);

  const anomalies: AnomalyResult["anomalies"] = [];

  // ── Check 1: IQR Outliers per category ────────────────────────────────────
  const byCategory = new Map<string, typeof pricedItems>();
  for (const item of pricedItems) {
    const cat = item.categoryLevel1 || "General";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(item);
  }

  for (const [cat, catItems] of byCategory) {
    if (catItems.length < 4) continue; // Need enough items for IQR to be meaningful
    const prices = catItems.map(i => i.unitPriceStandard!);
    const { lower, upper, q1, q3 } = calcIQR(prices);
    const safeUpper = Math.max(upper, q3 * 3); // Extra tolerance for wide-range categories

    for (const item of catItems) {
      const p = item.unitPriceStandard!;
      // Check for 10x outlier (likely data entry error — roll price instead of per meter)
      if (p > q3 * 10 && prices.length > 3) {
        anomalies.push({
          itemId: item.id, type: "PRICE_TOO_HIGH", severity: "critical",
          detail: `Unit price SAR ${p.toFixed(0)} is ${(p/q3).toFixed(0)}x above category median ${q3.toFixed(0)} — possible roll/drum price entered instead of per-unit price.`,
          detailAr: `سعر الوحدة ${p.toFixed(0)} ريال هو ${(p/q3).toFixed(0)}x فوق متوسط الفئة ${q3.toFixed(0)} — احتمال إدخال سعر بكرة/طبلة بدلاً من سعر الوحدة.`,
          currentValue: p, expectedRange: [lower, safeUpper],
        });
      } else if (p > safeUpper && prices.length > 3) {
        anomalies.push({
          itemId: item.id, type: "PRICE_TOO_HIGH", severity: "warning",
          detail: `Unit price SAR ${p.toFixed(0)} exceeds IQR upper fence SAR ${safeUpper.toFixed(0)} for category "${cat}" (${((p - safeUpper) / safeUpper * 100).toFixed(0)}% above upper bound).`,
          detailAr: `سعر الوحدة ${p.toFixed(0)} ريال يتجاوز الحد الأعلى IQR ${safeUpper.toFixed(0)} ريال للفئة "${cat}".`,
          currentValue: p, expectedRange: [lower, safeUpper],
        });
      } else if (lower > 0 && p < lower * 0.5 && prices.length > 3) {
        anomalies.push({
          itemId: item.id, type: "PRICE_TOO_LOW", severity: "warning",
          detail: `Unit price SAR ${p.toFixed(0)} is below IQR lower fence SAR ${lower.toFixed(0)} for category "${cat}". Possible under-pricing or scope reduction.`,
          detailAr: `سعر الوحدة ${p.toFixed(0)} ريال تحت الحد الأدنى IQR ${lower.toFixed(0)} ريال للفئة "${cat}". احتمال تسعير غير كافٍ.`,
          currentValue: p, expectedRange: [lower, safeUpper],
        });
      }
    }
  }

  // ── Check 2: Zero / missing prices ────────────────────────────────────────
  const unpricedItems = items.filter(i => !i.unitPriceStandard || i.unitPriceStandard === 0);
  for (const item of unpricedItems) {
    if (item.status === "pending") {
      anomalies.push({
        itemId: item.id, type: "ZERO_PRICE", severity: "critical",
        detail: `Item "${item.descriptionEn.slice(0, 80)}" has no unit price assigned after pricing run.`,
        detailAr: `البند "${item.descriptionAr?.slice(0, 80) || item.descriptionEn.slice(0, 80)}" لا يوجد له سعر بعد التسعير.`,
      });
    }
  }

  // ── Check 3: Duplicate items with different prices ─────────────────────────
  const descMap = new Map<string, typeof pricedItems>();
  for (const item of pricedItems) {
    const key = item.descriptionEn.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 70);
    if (!descMap.has(key)) descMap.set(key, []);
    descMap.get(key)!.push(item);
  }
  for (const [, dupes] of descMap) {
    if (dupes.length < 2) continue;
    const prices = dupes.map(i => i.unitPriceStandard!);
    const maxP = Math.max(...prices), minP = Math.min(...prices);
    if ((maxP - minP) / maxP > 0.2) {
      for (const item of dupes) {
        anomalies.push({
          itemId: item.id, type: "DUPLICATE_ITEM", severity: "warning",
          detail: `Duplicate item in BOQ with inconsistent pricing (${dupes.length} occurrences, prices: SAR ${minP.toFixed(0)}–${maxP.toFixed(0)}, spread ${((maxP-minP)/maxP*100).toFixed(0)}%).`,
          detailAr: `بند مكرر في المقايسة بأسعار متناقضة (${dupes.length} تكرار، نطاق الأسعار: ${minP.toFixed(0)}–${maxP.toFixed(0)} ريال).`,
          currentValue: maxP, expectedRange: [minP, minP],
        });
      }
    }
  }

  // ── Check 4: Unit mismatches ───────────────────────────────────────────────
  for (const item of pricedItems) {
    const cat = item.categoryLevel1 || "";
    const unitPattern = UNIT_MISMATCH_PATTERNS.find(p => p.category === cat);
    if (!unitPattern) continue;
    const itemUnit = (item.unit || "").toLowerCase();
    if (unitPattern.wrongUnits.some(w => itemUnit === w.toLowerCase())) {
      anomalies.push({
        itemId: item.id, type: "UNIT_MISMATCH", severity: "warning",
        detail: `Unit "${item.unit}" for category "${cat}" looks incorrect. Expected "${unitPattern.rightUnit}". Price may be entered per ${item.unit} rather than per ${unitPattern.rightUnit}.`,
        detailAr: `وحدة "${item.unit}" للفئة "${cat}" تبدو غير صحيحة. المتوقع "${unitPattern.rightUnit}". السعر قد يكون مدخلاً بالـ ${item.unit} وليس بالـ ${unitPattern.rightUnit}.`,
      });
    }
  }

  // ── Check 5: Impossible unit prices (floor check) ─────────────────────────
  for (const item of pricedItems) {
    const cat = item.categoryLevel1 || "";
    const floor = CATEGORY_PRICE_FLOORS[cat];
    if (!floor) continue;
    const p = item.unitPriceStandard!;
    if (p < floor * 0.3) {
      anomalies.push({
        itemId: item.id, type: "IMPOSSIBLE_UNIT_PRICE", severity: "critical",
        detail: `Unit price SAR ${p.toFixed(2)} for category "${cat}" is below physical cost floor (minimum expected: SAR ${floor.toFixed(0)}). Likely a calculation or data entry error.`,
        detailAr: `سعر الوحدة ${p.toFixed(2)} ريال للفئة "${cat}" أقل من الحد المادي الأدنى (المتوقع كحد أدنى: ${floor.toFixed(0)} ريال). خطأ محتمل في البيانات.`,
        currentValue: p, expectedRange: [floor, floor * 10],
      });
    }
  }

  // ── Check 6: Eco/Premium scenario consistency ──────────────────────────────
  for (const item of pricedItems) {
    if (!item.unitPriceEconomical || !item.unitPricePremium) continue;
    const std = item.unitPriceStandard!;
    const ecoRatio = item.unitPriceEconomical / std;
    const premRatio = item.unitPricePremium / std;
    if (ecoRatio > 1.05) {
      anomalies.push({
        itemId: item.id, type: "INCONSISTENT_SCENARIO", severity: "warning",
        detail: `Economical price (SAR ${item.unitPriceEconomical.toFixed(0)}) is higher than standard (SAR ${std.toFixed(0)}). Economical should be lower.`,
        detailAr: `سعر السيناريو الاقتصادي (${item.unitPriceEconomical.toFixed(0)} ريال) أعلى من المعياري (${std.toFixed(0)} ريال). يجب أن يكون الاقتصادي أقل.`,
        currentValue: item.unitPriceEconomical,
      });
    }
    if (premRatio < 0.95) {
      anomalies.push({
        itemId: item.id, type: "INCONSISTENT_SCENARIO", severity: "warning",
        detail: `Premium price (SAR ${item.unitPricePremium.toFixed(0)}) is lower than standard (SAR ${std.toFixed(0)}). Premium should be higher.`,
        detailAr: `سعر السيناريو المتميز (${item.unitPricePremium.toFixed(0)} ريال) أقل من المعياري (${std.toFixed(0)} ريال). يجب أن يكون المتميز أعلى.`,
        currentValue: item.unitPricePremium,
      });
    }
  }

  // ── Persist as price reviews ───────────────────────────────────────────────
  // Deduplicate by itemId+type
  const seen = new Set<string>();
  const unique = anomalies.filter(a => {
    const key = `${a.itemId}:${a.type}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  if (unique.length > 0) {
    await db.insert(priceReviewsTable).values(
      unique.map(a => ({
        projectId,
        boqItemId: a.itemId,
        agentId: "anomaly_detector",
        agentName: "Anomaly Detection Agent",
        reviewType: a.type.toLowerCase(),
        severity: a.severity === "critical" ? "critical" as const : "warning" as const,
        status: "pending" as const,
        title: a.type.replace(/_/g, " "),
        titleAr: { PRICE_TOO_HIGH: "سعر مرتفع شاذ", PRICE_TOO_LOW: "سعر منخفض شاذ", DUPLICATE_ITEM: "بند مكرر", UNIT_MISMATCH: "عدم تطابق الوحدة", ZERO_PRICE: "سعر صفري", QUANTITY_OUTLIER: "كمية شاذة", IMPOSSIBLE_UNIT_PRICE: "سعر مستحيل", INCONSISTENT_SCENARIO: "تناقض سيناريوهات" }[a.type],
        description: a.detail,
        descriptionAr: a.detailAr,
        currentValue: a.currentValue,
        minMarketValue: a.expectedRange?.[0],
        maxMarketValue: a.expectedRange?.[1],
      }))
    );
  }

  // Also update boq_items anomaly flags
  for (const a of unique.filter(x => x.severity === "critical")) {
    await db.update(boqItemsTable).set({
      anomalyFlag: true,
      anomalyReason: a.detail.slice(0, 300),
      needsReview: true,
    }).where(eq(boqItemsTable.id, a.itemId));
  }

  const result: AnomalyResult = {
    total: unique.length,
    errors: unique.filter(a => a.severity === "critical").length,
    warnings: unique.filter(a => a.severity === "warning").length,
    anomalies: unique,
  };

  logger.info({ projectId, ...result }, "Agent 5 anomaly detection complete");
  return result;
}
