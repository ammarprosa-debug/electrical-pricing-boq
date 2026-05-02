/**
 * Agent 13 — Project Timeline Estimator
 * Estimates project duration, phases, resource peaks based on BOQ scope.
 * Pure calculation based on trade productivity and KSA project norms.
 */
import { db } from "@workspace/db";
import { boqItemsTable, projectTimelineTable, timelinePhasesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

// Weeks to complete each category (per SAR 1M of work)
const CAT_WEEKS_PER_MILLION: Record<string, number> = {
  "Cables & Wiring":       3.5,
  "Conduits & Trunking":   4.0,
  "Wiring Devices":        2.0,
  "Lighting":              2.5,
  "Panels & Distribution": 5.0,
  "Protection Devices":    1.5,
  "Earthing & Bonding":    2.0,
  "Fire Alarm":            4.5,
  "CCTV & Security":       3.5,
  "Data & Network":        3.0,
  "Power Systems":         6.0,
  "Transformers":          8.0,
};

interface Phase {
  phaseNumber: number;
  phaseNameEn: string;
  phaseNameAr: string;
  startWeek: number;
  endWeek: number;
  durationWeeks: number;
  laborCount: number;
  costSar: number;
  costPct: number;
  categories: string[];
  deliverablesAr: string;
}

export async function runTimelineEstimation(projectId: number): Promise<object> {
  logger.info({ projectId }, "Agent 13: Timeline estimation starting");

  const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, projectId));
  const pricedItems = items.filter(i => i.totalPriceStandard && i.totalPriceStandard > 0);

  if (pricedItems.length === 0) return { error: "No priced items found" };

  // Aggregate cost by category
  const catCost: Record<string, number> = {};
  for (const item of pricedItems) {
    const cat = item.categoryLevel1 || "General";
    catCost[cat] = (catCost[cat] || 0) + (item.totalPriceStandard || 0);
  }

  const totalCost = Object.values(catCost).reduce((s, v) => s + v, 0);

  // Calculate duration per category
  let maxWeeks = 0;
  const catDurations: Record<string, number> = {};
  for (const [cat, cost] of Object.entries(catCost)) {
    const weeksPerMillion = CAT_WEEKS_PER_MILLION[cat] || 3;
    const weeks = Math.max(1, Math.ceil((cost / 1_000_000) * weeksPerMillion));
    catDurations[cat] = weeks;
    if (weeks > maxWeeks) maxWeeks = weeks;
  }

  // Build phases
  const phases: Phase[] = [
    {
      phaseNumber: 1,
      phaseNameEn: "Mobilization & Temporary Installations",
      phaseNameAr: "التعبئة والتركيبات المؤقتة",
      startWeek: 1, endWeek: 2, durationWeeks: 2,
      laborCount: 5, costSar: totalCost * 0.03, costPct: 3,
      categories: ["General"],
      deliverablesAr: "إعداد الموقع، الطاقة المؤقتة، مستودع المواد، سياج الموقع",
    },
    {
      phaseNumber: 2,
      phaseNameEn: "Conduit & Cable Tray Installation",
      phaseNameAr: "تركيب المواسير وأدراج الكابلات",
      startWeek: 2, endWeek: Math.max(4, Math.ceil(maxWeeks * 0.25) + 2), durationWeeks: Math.max(2, Math.ceil(maxWeeks * 0.25)),
      laborCount: Math.max(6, Math.ceil(totalCost / 500000) * 2),
      costSar: totalCost * 0.15, costPct: 15,
      categories: ["Conduits & Trunking", "Earthing & Bonding"],
      deliverablesAr: "جميع مواسير PVC والفولاذية، أدراج الكابلات وسلالمها، نظام التأريض",
    },
    {
      phaseNumber: 3,
      phaseNameEn: "Main Cabling Works",
      phaseNameAr: "أعمال الكابلات الرئيسية",
      startWeek: Math.ceil(maxWeeks * 0.2), endWeek: Math.ceil(maxWeeks * 0.65),
      durationWeeks: Math.max(3, Math.ceil(maxWeeks * 0.45)),
      laborCount: Math.max(10, Math.ceil(totalCost / 300000) * 3),
      costSar: totalCost * 0.28, costPct: 28,
      categories: ["Cables & Wiring", "Data & Network", "Fire Alarm"],
      deliverablesAr: "كابلات الطاقة الرئيسية، كابلات البيانات والألياف الضوئية، كابلات إنذار الحريق وكاميرات المراقبة",
    },
    {
      phaseNumber: 4,
      phaseNameEn: "Panel & Equipment Installation",
      phaseNameAr: "تركيب اللوحات والمعدات",
      startWeek: Math.ceil(maxWeeks * 0.45), endWeek: Math.ceil(maxWeeks * 0.75),
      durationWeeks: Math.max(2, Math.ceil(maxWeeks * 0.3)),
      laborCount: Math.max(8, Math.ceil(totalCost / 400000) * 2),
      costSar: totalCost * 0.22, costPct: 22,
      categories: ["Panels & Distribution", "Protection Devices", "Power Systems"],
      deliverablesAr: "لوحات التوزيع الرئيسية والفرعية، قواطع الحماية، UPS والمولدات",
    },
    {
      phaseNumber: 5,
      phaseNameEn: "Devices, Lighting & Fit-Out",
      phaseNameAr: "المفاتيح والإضاءة والتشطيب",
      startWeek: Math.ceil(maxWeeks * 0.6), endWeek: Math.ceil(maxWeeks * 0.9),
      durationWeeks: Math.max(2, Math.ceil(maxWeeks * 0.3)),
      laborCount: Math.max(8, Math.ceil(totalCost / 350000) * 2),
      costSar: totalCost * 0.20, costPct: 20,
      categories: ["Wiring Devices", "Lighting", "CCTV & Security"],
      deliverablesAr: "مفاتيح الإضاءة والمقابس، وحدات الإضاءة، كاميرات المراقبة وأجهزة الإنذار",
    },
    {
      phaseNumber: 6,
      phaseNameEn: "Testing, Commissioning & Handover",
      phaseNameAr: "الاختبار والتشغيل والتسليم",
      startWeek: Math.ceil(maxWeeks * 0.85), endWeek: maxWeeks + 2,
      durationWeeks: Math.max(2, Math.ceil(maxWeeks * 0.15) + 2),
      laborCount: Math.max(5, Math.ceil(totalCost / 600000) * 2),
      costSar: totalCost * 0.12, costPct: 12,
      categories: ["Testing & Commissioning"],
      deliverablesAr: "اختبار جميع الدوائر الكهربائية، قياسات التأريض والعزل، تشغيل الأنظمة، توثيق التسليم As-Built",
    },
  ];

  const totalDurationWeeks = maxWeeks + 2;
  const totalDurationDays = totalDurationWeeks * 5;
  const resourcePeakWorkers = Math.max(...phases.map(p => p.laborCount));
  const resourcePeakWeek = phases.find(p => p.laborCount === resourcePeakWorkers)?.startWeek || 3;

  // Persist
  await db.delete(projectTimelineTable).where(eq(projectTimelineTable.projectId, projectId));
  await db.delete(timelinePhasesTable).where(eq(timelinePhasesTable.projectId, projectId));

  const [timeline] = await db.insert(projectTimelineTable).values({
    projectId,
    totalDurationDays,
    totalDurationWeeks,
    phases: phases.map(p => ({ ...p, costSar: Math.round(p.costSar) })),
    milestones: [
      { week: 2, milestone: "Site Mobilization Complete", milestoneAr: "اكتمال التعبئة" },
      { week: Math.ceil(totalDurationWeeks * 0.5), milestone: "50% Cabling Complete", milestoneAr: "50% من الكابلات مكتمل" },
      { week: Math.ceil(totalDurationWeeks * 0.75), milestone: "Panels Energized", milestoneAr: "تشغيل اللوحات" },
      { week: totalDurationWeeks, milestone: "Final Handover", milestoneAr: "التسليم النهائي" },
    ],
    resourcePeakWeek,
    resourcePeakWorkers,
    notesAr: `المدة الإجمالية المقدرة: ${totalDurationWeeks} أسبوع (${totalDurationDays} يوم عمل). ذروة العمالة: ${resourcePeakWorkers} عامل في الأسبوع ${resourcePeakWeek}.`,
    assumptionsAr: "يفترض عمل 5 أيام/أسبوع، 8 ساعات/يوم. لا تشمل أعمال الحفر أو البناء. يستلزم استلام المواد في الوقت المحدد.",
  }).returning();

  for (const phase of phases) {
    await db.insert(timelinePhasesTable).values({
      projectId,
      timelineId: timeline.id,
      phaseNumber: phase.phaseNumber,
      phaseNameEn: phase.phaseNameEn,
      phaseNameAr: phase.phaseNameAr,
      startWeek: phase.startWeek,
      endWeek: phase.endWeek,
      durationWeeks: phase.durationWeeks,
      laborCount: phase.laborCount,
      costSar: Math.round(phase.costSar),
      costPct: phase.costPct,
      categories: phase.categories,
      deliverablesAr: phase.deliverablesAr,
    });
  }

  logger.info({ projectId, totalDurationWeeks, phases: phases.length }, "Agent 13: Timeline estimation complete");
  return { timeline, phases: phases.length, totalDurationWeeks };
}
