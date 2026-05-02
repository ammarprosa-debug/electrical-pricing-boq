/**
 * Agent 14 — Subcontractor BOQ Split
 * Identifies which BOQ items are suitable for subcontracting vs. main contractor work.
 * Pure logic based on trade categories and KSA construction norms.
 */
import { db } from "@workspace/db";
import { boqItemsTable, subcontractorSplitTable, subcontractorSummaryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

const SUBCONTRACT_RULES: Record<string, {
  isSubcontract: boolean;
  type: string;
  typeAr: string;
  reasonEn: string;
  reasonAr: string;
  requirements: string;
  requirementsAr: string;
  riskLevel: "low" | "medium" | "high";
}> = {
  "Fire Alarm": {
    isSubcontract: true,
    type: "Specialist Fire Alarm Contractor",
    typeAr: "مقاول متخصص في أنظمة الإنذار",
    reasonEn: "Fire alarm systems require Civil Defense licensed contractors in KSA. Must be approved by Saudi Civil Defense (الدفاع المدني).",
    reasonAr: "أنظمة الإنذار تستلزم مقاولاً مرخصاً من الدفاع المدني السعودي.",
    requirements: "Civil Defense License + NFPA 72 experience + SEC registration",
    requirementsAr: "ترخيص الدفاع المدني + خبرة NFPA 72 + تسجيل SEC",
    riskLevel: "medium",
  },
  "CCTV & Security": {
    isSubcontract: true,
    type: "Security Systems Subcontractor",
    typeAr: "مقاول متخصص في أنظمة الأمن",
    reasonEn: "CCTV and security systems typically subcontracted to licensed security systems integrators.",
    reasonAr: "أنظمة المراقبة والأمن تُسند عادةً لمتكاملين متخصصين ومرخصين.",
    requirements: "SASO certification + Security license from Ministry of Interior",
    requirementsAr: "شهادة SASO + ترخيص أمني من وزارة الداخلية",
    riskLevel: "low",
  },
  "Data & Network": {
    isSubcontract: true,
    type: "Structured Cabling Subcontractor",
    typeAr: "مقاول متخصص في الكابلات المنظمة",
    reasonEn: "Structured cabling and data networks best handled by certified Panduit/Systimax partners.",
    reasonAr: "الكابلات المنظمة وشبكات البيانات الأفضل إسنادها لشركاء معتمدين من باندويت/سيستيماكس.",
    requirements: "Panduit/Systimax/CommScope certification + warranty obligation",
    requirementsAr: "شهادة اعتماد من باندويت/سيستيماكس + التزام الضمان",
    riskLevel: "low",
  },
  "Transformers": {
    isSubcontract: true,
    type: "SEC Approved HV Contractor",
    typeAr: "مقاول جهد عالي معتمد من SEC",
    reasonEn: "High voltage transformers and HV equipment require SEC-approved HV contractors.",
    reasonAr: "المحولات والمعدات عالية الجهد تستلزم مقاولاً معتمداً من شركة كهرباء السعودية.",
    requirements: "SEC HV Contractor License (Category A/B) + SEC approval",
    requirementsAr: "ترخيص مقاول جهد عالي من SEC (فئة أ/ب) + موافقة SEC",
    riskLevel: "high",
  },
  "Power Systems": {
    isSubcontract: false,
    type: "Main Contractor",
    typeAr: "المقاول الرئيسي",
    reasonEn: "UPS, generators and backup power handled by main contractor for coordination with main panels.",
    reasonAr: "UPS والمولدات تُنجز من المقاول الرئيسي لضمان التنسيق مع اللوحات الرئيسية.",
    requirements: "Manufacturer authorization for UPS/Generator commissioning",
    requirementsAr: "تفويض المصنع لتشغيل UPS والمولدات",
    riskLevel: "medium",
  },
  "Cables & Wiring": {
    isSubcontract: false,
    type: "Main Contractor",
    typeAr: "المقاول الرئيسي",
    reasonEn: "Main cabling by main contractor for quality control and warranty responsibility.",
    reasonAr: "الكابلات الرئيسية من مسؤولية المقاول الرئيسي لضمان الجودة والضمان.",
    requirements: "Qualified electricians (SIBC/CITB certified preferred)",
    requirementsAr: "كهربائيون مؤهلون (يُفضل شهادة SIBC/CITB)",
    riskLevel: "low",
  },
  "Panels & Distribution": {
    isSubcontract: false,
    type: "Main Contractor",
    typeAr: "المقاول الرئيسي",
    reasonEn: "Panels by main contractor — subcontract panel fabrication only if required.",
    reasonAr: "اللوحات من المقاول الرئيسي — إسناد تصنيع اللوحات فقط عند الحاجة.",
    requirements: "IEC 61439 panel inspection + type testing documents",
    requirementsAr: "فحص اللوحات وفق IEC 61439 + وثائق الاختبار",
    riskLevel: "low",
  },
  "Lighting": {
    isSubcontract: false,
    type: "Main Contractor",
    typeAr: "المقاول الرئيسي",
    reasonEn: "Lighting installation by main contractor for warranty and performance guarantee.",
    reasonAr: "تركيب الإضاءة من المقاول الرئيسي لضمان الأداء والضمان.",
    requirements: "Lux level measurement and photometric verification on handover",
    requirementsAr: "قياس مستوى الإضاءة (lux) والتحقق البصري عند التسليم",
    riskLevel: "low",
  },
  "Earthing & Bonding": {
    isSubcontract: false,
    type: "Main Contractor",
    typeAr: "المقاول الرئيسي",
    reasonEn: "Earthing and bonding by main contractor — critical for safety and warranty.",
    reasonAr: "أنظمة التأريض والترابط من المقاول الرئيسي — حرجة من ناحية السلامة.",
    requirements: "Earth resistance test ≤1Ω (SEC requirement) + test certificates",
    requirementsAr: "مقاومة التأريض ≤1 أوم (شرط SEC) + شهادات الاختبار",
    riskLevel: "low",
  },
};

export async function runSubcontractorSplit(projectId: number): Promise<object> {
  logger.info({ projectId }, "Agent 14: Subcontractor split starting");

  const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, projectId));

  // Group by category
  const catGroups: Record<string, { items: typeof items; totalSar: number }> = {};
  for (const item of items) {
    if (!item.totalPriceStandard) continue;
    const cat = item.categoryLevel1 || "General";
    if (!catGroups[cat]) catGroups[cat] = { items: [], totalSar: 0 };
    catGroups[cat].items.push(item);
    catGroups[cat].totalSar += item.totalPriceStandard;
  }

  const totalProjectCost = Object.values(catGroups).reduce((s, g) => s + g.totalSar, 0);

  await db.delete(subcontractorSplitTable).where(eq(subcontractorSplitTable.projectId, projectId));
  await db.delete(subcontractorSummaryTable).where(eq(subcontractorSummaryTable.projectId, projectId));

  let subcontractorTotal = 0;
  let mainContractorTotal = 0;
  let subCount = 0;
  let specialistCount = 0;

  for (const [cat, group] of Object.entries(catGroups)) {
    const rule = SUBCONTRACT_RULES[cat] || {
      isSubcontract: false,
      type: "Main Contractor",
      typeAr: "المقاول الرئيسي",
      reasonEn: "Standard electrical work by main contractor.",
      reasonAr: "أعمال كهربائية معيارية من المقاول الرئيسي.",
      requirements: "Licensed electricians",
      requirementsAr: "كهربائيون مرخصون",
      riskLevel: "low" as const,
    };

    await db.insert(subcontractorSplitTable).values({
      projectId,
      tradeCategory: cat,
      tradeCategoryAr: { "Cables & Wiring": "كابلات وأسلاك", "Conduits & Trunking": "مواسير وأدراج", "Wiring Devices": "مفاتيح ومقابس", "Lighting": "إضاءة", "Panels & Distribution": "لوحات توزيع", "Protection Devices": "أجهزة حماية", "Earthing & Bonding": "تأريض وترابط", "Fire Alarm": "إنذار حريق", "CCTV & Security": "مراقبة وأمن", "Data & Network": "شبكات وبيانات", "Power Systems": "أنظمة طاقة", "Transformers": "محولات" }[cat] || cat,
      isSubcontract: rule.isSubcontract,
      subcontractorType: rule.type,
      subcontractorTypeAr: rule.typeAr,
      scopeDescription: `${cat} — ${group.items.length} items, SAR ${Math.round(group.totalSar).toLocaleString()}`,
      scopeDescriptionAr: `${cat} — ${group.items.length} بند، ${Math.round(group.totalSar).toLocaleString()} ريال`,
      estimatedValueSar: Math.round(group.totalSar),
      valuePct: Math.round((group.totalSar / totalProjectCost) * 1000) / 10,
      boqItemIds: group.items.map(i => i.id),
      reasonEn: rule.reasonEn,
      reasonAr: rule.reasonAr,
      subcontractorRequirements: rule.requirements,
      subcontractorRequirementsAr: rule.requirementsAr,
      riskLevel: rule.riskLevel,
    });

    if (rule.isSubcontract) {
      subcontractorTotal += group.totalSar;
      subCount++;
      if (cat === "Fire Alarm" || cat === "Transformers") specialistCount++;
    } else {
      mainContractorTotal += group.totalSar;
    }
  }

  const [summaryRow] = await db.insert(subcontractorSummaryTable).values({
    projectId,
    mainContractorValueSar: Math.round(mainContractorTotal),
    mainContractorPct: Math.round((mainContractorTotal / totalProjectCost) * 100),
    subcontractorTotalSar: Math.round(subcontractorTotal),
    subcontractorPct: Math.round((subcontractorTotal / totalProjectCost) * 100),
    subcontractorCount: subCount,
    specialistSubsCount: specialistCount,
    strategyAr: `المقاول الرئيسي: ${Math.round(mainContractorTotal).toLocaleString()} ريال (${Math.round((mainContractorTotal / totalProjectCost) * 100)}%). مقاولو الباطن: ${Math.round(subcontractorTotal).toLocaleString()} ريال (${Math.round((subcontractorTotal / totalProjectCost) * 100)}%) — ${subCount} تخصص، منها ${specialistCount} متخصص يستلزم تراخيص خاصة.`,
    strategyEn: `Main contractor: SAR ${Math.round(mainContractorTotal).toLocaleString()} (${Math.round((mainContractorTotal / totalProjectCost) * 100)}%). Subcontracted: SAR ${Math.round(subcontractorTotal).toLocaleString()} (${Math.round((subcontractorTotal / totalProjectCost) * 100)}%) — ${subCount} trades, ${specialistCount} requiring specialist licenses.`,
  }).returning();

  logger.info({ projectId, subCount, subcontractorTotal }, "Agent 14: Subcontractor split complete");
  return { summary: summaryRow, subcontractorCount: subCount };
}
