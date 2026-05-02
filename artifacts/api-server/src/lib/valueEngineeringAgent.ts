/**
 * Agent 12 — Value Engineering Agent
 * Identifies over-specified items and cost reduction opportunities.
 * Hybrid: pure-logic + optional AI for recommendations.
 */
import { db } from "@workspace/db";
import { boqItemsTable, valueEngineeringTable, veProjectSummaryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { anthropic } from "@workspace/integrations-anthropic-ai";

interface VeFinding {
  boqItemId?: number;
  category: string;
  finding: string;
  findingAr: string;
  currentSpecEn: string;
  currentSpecAr: string;
  proposedSpecEn: string;
  proposedSpecAr: string;
  currentCostSar: number;
  proposedCostSar: number;
  savingsSar: number;
  savingsPct: number;
  impactLevel: "high" | "medium" | "low";
  riskLevel: "high" | "medium" | "low";
  recommendationAr: string;
  sasoCompliant: "yes" | "conditional" | "no";
}

// VE rule-based checks
const VE_RULES: Array<{
  match: (desc: string, cat: string, price: number, qty: number) => boolean;
  generate: (item: { descriptionEn: string; totalPriceStandard: number; quantity: number; categoryLevel1: string }) => VeFinding;
}> = [
  // Premium lighting where standard suffices for utility spaces
  {
    match: (desc, cat, price) => cat === "Lighting" && price > 300 && desc.toLowerCase().includes("downlight"),
    generate: (item) => ({
      category: item.categoryLevel1,
      boqItemId: undefined,
      finding: "Premium downlight specified where standard LED would meet SASO/IEC requirements.",
      findingAr: "تم تحديد داونلايت متميز بينما LED معياري يلبي متطلبات SASO/IEC.",
      currentSpecEn: item.descriptionEn.slice(0, 100),
      currentSpecAr: "داونلايت متميز",
      proposedSpecEn: "Standard LED Downlight 9W/12W — SASO certified",
      proposedSpecAr: "داونلايت LED معياري 9-12 واط — معتمد SASO",
      currentCostSar: item.totalPriceStandard,
      proposedCostSar: item.totalPriceStandard * 0.55,
      savingsSar: item.totalPriceStandard * 0.45,
      savingsPct: 45,
      impactLevel: "medium",
      riskLevel: "low",
      recommendationAr: "استخدام داونلايت LED معتمد SASO بدلاً من الفئة المتميزة لتوفير 45% في تكلفة الإضاءة",
      sasoCompliant: "yes",
    }),
  },
  // Oversized cable for short runs
  {
    match: (desc, cat, price, qty) => cat === "Cables & Wiring" && qty < 30 && price > 100,
    generate: (item) => ({
      category: item.categoryLevel1,
      boqItemId: undefined,
      finding: "Large cross-section cable for short run — consider voltage drop calculation before downgrading.",
      findingAr: "كابل كبير المقطع لمسافة قصيرة — يُنصح بمراجعة حساب هبوط الجهد قبل تقليل المقطع.",
      currentSpecEn: item.descriptionEn.slice(0, 100),
      currentSpecAr: "كابل كبير المقطع",
      proposedSpecEn: "Review voltage drop calculation — possible cable size reduction with derating factors",
      proposedSpecAr: "مراجعة حساب هبوط الجهد — إمكانية تصغير المقطع مع تطبيق معاملات التخفيض",
      currentCostSar: item.totalPriceStandard,
      proposedCostSar: item.totalPriceStandard * 0.75,
      savingsSar: item.totalPriceStandard * 0.25,
      savingsPct: 25,
      impactLevel: "medium",
      riskLevel: "medium",
      recommendationAr: "إجراء حساب هبوط الجهد — خفض مقطع الكابل قد يوفر 25% مع الالتزام بـ IEC 60364",
      sasoCompliant: "conditional",
    }),
  },
  // High-spec panels for small sub-distributions
  {
    match: (desc, cat, price) => cat === "Panels & Distribution" && price > 15000 && (desc.toLowerCase().includes("sub") || desc.toLowerCase().includes("local") || desc.toLowerCase().includes("فرعية")),
    generate: (item) => ({
      category: item.categoryLevel1,
      boqItemId: undefined,
      finding: "High-specification sub-distribution board — standard IEC 61439 panel may suffice.",
      findingAr: "لوحة توزيع فرعية عالية المواصفات — لوحة IEC 61439 معيارية قد تكون كافية.",
      currentSpecEn: item.descriptionEn.slice(0, 100),
      currentSpecAr: "لوحة توزيع فرعية متميزة",
      proposedSpecEn: "Standard IEC 61439-1 Sub-DB with type-tested busbars",
      proposedSpecAr: "لوحة توزيع فرعية معيارية IEC 61439-1 مع باصبار مختبر",
      currentCostSar: item.totalPriceStandard,
      proposedCostSar: item.totalPriceStandard * 0.65,
      savingsSar: item.totalPriceStandard * 0.35,
      savingsPct: 35,
      impactLevel: "high",
      riskLevel: "low",
      recommendationAr: "تغيير مواصفات اللوحة إلى IEC 61439-1 معيارية مع ضمان type-tested للتوفير 35%",
      sasoCompliant: "yes",
    }),
  },
];

export async function runValueEngineering(projectId: number): Promise<object> {
  logger.info({ projectId }, "Agent 12: Value Engineering starting");

  const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, projectId));
  const pricedItems = items.filter(i => i.unitPriceStandard && i.totalPriceStandard && i.totalPriceStandard > 0);

  const findings: VeFinding[] = [];

  // Apply rule-based checks
  for (const item of pricedItems) {
    for (const rule of VE_RULES) {
      if (rule.match(item.descriptionEn, item.categoryLevel1 || "", item.unitPriceStandard || 0, item.quantity)) {
        const f = rule.generate(item);
        f.boqItemId = item.id;
        findings.push(f);
        break;
      }
    }
  }

  // AI enhancement for top findings
  const top10 = pricedItems
    .sort((a, b) => (b.totalPriceStandard || 0) - (a.totalPriceStandard || 0))
    .slice(0, 10);

  try {
    const prompt = `You are a value engineering expert for KSA electrical projects. Analyze these top-cost BOQ items and identify over-specifications or alternatives.

Items (JSON):
${JSON.stringify(top10.map(i => ({ desc: i.descriptionEn, category: i.categoryLevel1, unitPrice: i.unitPriceStandard, qty: i.quantity, total: i.totalPriceStandard })), null, 2)}

Return JSON array of up to 5 VE findings. Each finding:
{
  "boqItemDesc": "...",
  "findingAr": "...(Arabic)...",
  "proposedSpecAr": "...(Arabic)...",
  "savingsPct": 15,
  "riskLevel": "low|medium|high",
  "recommendationAr": "...(Arabic)..."
}
Only return valid JSON array.`;

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const aiFindings = JSON.parse(jsonMatch[0]) as Array<{
        boqItemDesc: string; findingAr: string; proposedSpecAr: string;
        savingsPct: number; riskLevel: string; recommendationAr: string;
      }>;
      for (const af of aiFindings.slice(0, 5)) {
        const matchItem = top10.find(i => i.descriptionEn.toLowerCase().includes(af.boqItemDesc?.toLowerCase()?.slice(0, 30) || "XXXXXX"));
        findings.push({
          boqItemId: matchItem?.id,
          category: matchItem?.categoryLevel1 || "General",
          finding: af.findingAr,
          findingAr: af.findingAr,
          currentSpecEn: matchItem?.descriptionEn?.slice(0, 100) || af.boqItemDesc,
          currentSpecAr: matchItem?.descriptionAr?.slice(0, 100) || af.boqItemDesc,
          proposedSpecEn: af.proposedSpecAr,
          proposedSpecAr: af.proposedSpecAr,
          currentCostSar: matchItem?.totalPriceStandard || 0,
          proposedCostSar: (matchItem?.totalPriceStandard || 0) * (1 - af.savingsPct / 100),
          savingsSar: (matchItem?.totalPriceStandard || 0) * af.savingsPct / 100,
          savingsPct: af.savingsPct,
          impactLevel: af.savingsPct > 20 ? "high" : af.savingsPct > 10 ? "medium" : "low",
          riskLevel: (af.riskLevel as "high" | "medium" | "low") || "low",
          recommendationAr: af.recommendationAr,
          sasoCompliant: af.riskLevel === "high" ? "conditional" : "yes",
        });
      }
    }
  } catch (e) {
    logger.warn({ err: e }, "Agent 12: AI enhancement failed, using rule-based only");
  }

  // Persist
  await db.delete(valueEngineeringTable).where(eq(valueEngineeringTable.projectId, projectId));
  await db.delete(veProjectSummaryTable).where(eq(veProjectSummaryTable.projectId, projectId));

  if (findings.length > 0) {
    await db.insert(valueEngineeringTable).values(
      findings.map(f => ({
        projectId,
        boqItemId: f.boqItemId || null,
        category: f.category,
        finding: f.finding,
        findingAr: f.findingAr,
        currentSpecEn: f.currentSpecEn,
        currentSpecAr: f.currentSpecAr,
        proposedSpecEn: f.proposedSpecEn,
        proposedSpecAr: f.proposedSpecAr,
        currentCostSar: Math.round(f.currentCostSar),
        proposedCostSar: Math.round(f.proposedCostSar),
        savingsSar: Math.round(f.savingsSar),
        savingsPct: Math.round(f.savingsPct * 10) / 10,
        impactLevel: f.impactLevel,
        riskLevel: f.riskLevel,
        recommendation: f.recommendationAr,
        recommendationAr: f.recommendationAr,
        sasoCompliant: f.sasoCompliant,
      }))
    );
  }

  const totalSavings = findings.reduce((s, f) => s + f.savingsSar, 0);
  const highImpact = findings.filter(f => f.impactLevel === "high").length;
  const lowRisk = findings.filter(f => f.riskLevel === "low").length;
  const recommendedSavings = findings.filter(f => f.riskLevel !== "high").reduce((s, f) => s + f.savingsSar, 0);

  const [summary] = await db.insert(veProjectSummaryTable).values({
    projectId,
    totalFindings: findings.length,
    totalPotentialSavingsSar: Math.round(totalSavings),
    highImpactCount: highImpact,
    lowRiskCount: lowRisk,
    recommendedSavingsSar: Math.round(recommendedSavings),
    overallRecommendationAr: `وُجدت ${findings.length} فرصة لهندسة القيمة بتوفير إجمالي محتمل ${Math.round(totalSavings).toLocaleString()} ريال (${highImpact} عالي الأثر، ${lowRisk} منخفض المخاطر). التوفير الموصى به: ${Math.round(recommendedSavings).toLocaleString()} ريال.`,
    overallRecommendation: `${findings.length} VE opportunities found. Total potential savings: SAR ${Math.round(totalSavings).toLocaleString()} (${highImpact} high-impact, ${lowRisk} low-risk). Recommended savings: SAR ${Math.round(recommendedSavings).toLocaleString()}.`,
  }).returning();

  logger.info({ projectId, findings: findings.length, totalSavings }, "Agent 12: Value Engineering complete");
  return { summary, findings: findings.length, totalSavings: Math.round(totalSavings) };
}
