/**
 * Agent 10 — Labor Cost Optimizer
 * Calculates detailed labor breakdown: trades, crew mix, daily rates by KSA region
 * Pure calculation — no AI needed. Uses NFPA/IEC standard labor productivity rates.
 */
import { db } from "@workspace/db";
import { boqItemsTable, laborCostsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

const REGIONAL_RATES = {
  Riyadh:  { electrician: 320, helper: 180, foreman: 480, supervisor: 750 },
  Jeddah:  { electrician: 335, helper: 190, foreman: 500, supervisor: 780 },
  Dammam:  { electrician: 350, helper: 200, foreman: 520, supervisor: 800 },
  Makkah:  { electrician: 340, helper: 195, foreman: 510, supervisor: 790 },
  Madinah: { electrician: 330, helper: 185, foreman: 495, supervisor: 760 },
  Abha:    { electrician: 310, helper: 170, foreman: 465, supervisor: 720 },
};

// Productivity: hours per unit for install tasks
const INSTALL_PRODUCTIVITY: Record<string, { electricianHrs: number; helperHrs: number; unit: string }> = {
  "Cables & Wiring":       { electricianHrs: 0.08,  helperHrs: 0.04,  unit: "m" },
  "Conduits & Trunking":   { electricianHrs: 0.12,  helperHrs: 0.06,  unit: "m" },
  "Wiring Devices":        { electricianHrs: 0.5,   helperHrs: 0.25,  unit: "NO." },
  "Lighting":              { electricianHrs: 0.75,  helperHrs: 0.35,  unit: "NO." },
  "Panels & Distribution": { electricianHrs: 8.0,   helperHrs: 4.0,   unit: "NO." },
  "Protection Devices":    { electricianHrs: 0.5,   helperHrs: 0.2,   unit: "NO." },
  "Earthing & Bonding":    { electricianHrs: 1.5,   helperHrs: 0.75,  unit: "NO." },
  "Fire Alarm":            { electricianHrs: 1.0,   helperHrs: 0.5,   unit: "NO." },
  "CCTV & Security":       { electricianHrs: 1.2,   helperHrs: 0.6,   unit: "NO." },
  "Data & Network":        { electricianHrs: 0.75,  helperHrs: 0.3,   unit: "NO." },
  "Power Systems":         { electricianHrs: 16.0,  helperHrs: 8.0,   unit: "NO." },
  "Transformers":          { electricianHrs: 40.0,  helperHrs: 20.0,  unit: "NO." },
};

const HOURS_PER_DAY = 8;
const OVERTIME_FACTOR = 0.15;
const SAFETY_FACTOR = 0.05;
const TOOLS_CONSUMABLES_FACTOR = 0.03;
const FOREMAN_RATIO = 0.1;   // 1 foreman per 10 workers
const SUPERVISOR_RATIO = 0.05;

export async function runLaborOptimizer(projectId: number, region = "Riyadh"): Promise<object> {
  logger.info({ projectId, region }, "Agent 10: Labor Cost Optimizer starting");

  const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, projectId));
  const rates = REGIONAL_RATES[region as keyof typeof REGIONAL_RATES] || REGIONAL_RATES.Riyadh;

  let totalElectricianHrs = 0;
  let totalHelperHrs = 0;
  const laborByCategory: Record<string, { electricianHrs: number; helperHrs: number; costSar: number }> = {};

  for (const item of items) {
    if (!item.quantity || !item.categoryLevel1) continue;
    const prod = INSTALL_PRODUCTIVITY[item.categoryLevel1];
    if (!prod) continue;

    const elecHrs = prod.electricianHrs * item.quantity;
    const helpHrs = prod.helperHrs * item.quantity;
    totalElectricianHrs += elecHrs;
    totalHelperHrs += helpHrs;

    const cat = item.categoryLevel1;
    if (!laborByCategory[cat]) laborByCategory[cat] = { electricianHrs: 0, helperHrs: 0, costSar: 0 };
    laborByCategory[cat].electricianHrs += elecHrs;
    laborByCategory[cat].helperHrs += helpHrs;
    const catCost = (elecHrs / HOURS_PER_DAY) * rates.electrician + (helpHrs / HOURS_PER_DAY) * rates.helper;
    laborByCategory[cat].costSar += catCost;
  }

  const electricianDays = totalElectricianHrs / HOURS_PER_DAY;
  const helperDays = totalHelperHrs / HOURS_PER_DAY;
  const totalWorkDays = electricianDays + helperDays;
  const foremanDays = totalWorkDays * FOREMAN_RATIO;
  const supervisorDays = totalWorkDays * SUPERVISOR_RATIO;

  const baseLabor =
    electricianDays * rates.electrician +
    helperDays * rates.helper +
    foremanDays * rates.foreman +
    supervisorDays * rates.supervisor;

  const overtimeEstimateSar = baseLabor * OVERTIME_FACTOR;
  const safetyAllowanceSar = baseLabor * SAFETY_FACTOR;
  const toolsConsumablesSar = baseLabor * TOOLS_CONSUMABLES_FACTOR;
  const grandTotalLaborSar = baseLabor + overtimeEstimateSar + safetyAllowanceSar + toolsConsumablesSar;

  const projectCost = items.reduce((s, i) => s + (i.totalPriceStandard || 0), 0);
  const totalLaborPct = projectCost > 0 ? (grandTotalLaborSar / projectCost) * 100 : 0;

  const recommendations = [
    electricianDays > 500 ? "Consider direct-hire electricians vs sub-contract for projects >500 man-days to save 15–20%." : null,
    totalLaborPct < 8 ? "Labor ratio is low (<8%) — verify all install items are included in BOQ." : null,
    totalLaborPct > 25 ? "Labor ratio is high (>25%) — review scope for value engineering opportunities." : null,
    region === "Makkah" || region === "Madinah" ? "Makkah/Madinah zone: Labour-only KSA nationals may be required for certain trades." : null,
  ].filter(Boolean);

  const recommendationsAr = [
    electricianDays > 500 ? "للمشاريع فوق 500 يوم عمل — الاستئجار المباشر للكهربائيين يوفر 15-20% مقارنة بالتعاقد الخارجي." : null,
    totalLaborPct < 8 ? "نسبة العمالة منخفضة (<8%) — تحقق من إدراج جميع بنود التركيب في المقايسة." : null,
    totalLaborPct > 25 ? "نسبة العمالة مرتفعة (>25%) — راجع النطاق لإيجاد فرص هندسة القيمة." : null,
    region === "Makkah" || region === "Madinah" ? "منطقة مكة المكرمة/المدينة المنورة: قد يُشترط توظيف كوادر سعودية لبعض المهن." : null,
  ].filter(Boolean).join(" | ");

  // Delete previous and insert new
  await db.delete(laborCostsTable).where(eq(laborCostsTable.projectId, projectId));
  const [row] = await db.insert(laborCostsTable).values({
    projectId, region,
    totalLaborSar: baseLabor,
    totalLaborPct: Math.round(totalLaborPct * 10) / 10,
    electricianDays: Math.ceil(electricianDays),
    helperDays: Math.ceil(helperDays),
    foremanDays: Math.ceil(foremanDays),
    supervisorDays: Math.ceil(supervisorDays),
    dailyRateElectrician: rates.electrician,
    dailyRateHelper: rates.helper,
    dailyRateForeman: rates.foreman,
    dailyRateSupervisor: rates.supervisor,
    laborByCategory,
    recommendations,
    recommendationsAr,
    overtimeEstimateSar: Math.round(overtimeEstimateSar),
    safetyAllowanceSar: Math.round(safetyAllowanceSar),
    toolsConsumablesSar: Math.round(toolsConsumablesSar),
    grandTotalLaborSar: Math.round(grandTotalLaborSar),
  }).returning();

  logger.info({ projectId, grandTotalLaborSar, region }, "Agent 10: Labor optimization complete");
  return row;
}
