/**
 * Agent 15 — Materials Price Manager (AI-Powered)
 * Manages the materials database: updates prices based on market signals,
 * adds missing materials, and generates market insights.
 */
import { db } from "@workspace/db";
import { materialsTable, materialPriceHistoryTable, materialUpdateJobsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const KSA_MARKET_SIGNALS_2025 = {
  copper_change_pct: 8.5,
  aluminum_change_pct: 5.2,
  steel_change_pct: 3.8,
  usd_sar_rate: 3.75,
  inflation_ksa_pct: 2.1,
  notes: "Q2 2025: Copper prices elevated due to EV demand. SEC tariff revisions pending.",
};

export async function runMaterialsPriceUpdate(forceRefreshAll = false): Promise<object> {
  logger.info({ forceRefreshAll }, "Agent 15: Materials Price Manager starting");

  // Create a job record
  const [job] = await db.insert(materialUpdateJobsTable).values({
    status: "running",
    startedAt: new Date(),
  }).returning();

  try {
    const materials = await db.select().from(materialsTable);
    let updatedCount = 0;
    let totalReviewed = 0;

    // Step 1: Apply market-signal-based adjustments
    const staleThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const staleMaterials = forceRefreshAll
      ? materials
      : materials.filter(m => !m.lastUpdated || m.lastUpdated < staleThreshold);

    for (const mat of staleMaterials) {
      totalReviewed++;
      let factor = 1 + KSA_MARKET_SIGNALS_2025.inflation_ksa_pct / 100;

      // Category-specific adjustments
      if (mat.category === "Cables & Wiring") {
        factor = 1 + (KSA_MARKET_SIGNALS_2025.copper_change_pct / 100) * 0.7;
      } else if (mat.category === "Conduits & Trunking") {
        factor = 1 + (KSA_MARKET_SIGNALS_2025.steel_change_pct / 100) * 0.5;
      } else if (mat.category === "Panels & Distribution") {
        factor = 1 + (KSA_MARKET_SIGNALS_2025.copper_change_pct / 100) * 0.4;
      }

      const newEcon = Math.round(mat.priceEconomical * factor * 100) / 100;
      const newStd  = Math.round(mat.priceStandard  * factor * 100) / 100;
      const newPrem = Math.round(mat.pricePremium   * factor * 100) / 100;

      if (Math.abs(newStd - mat.priceStandard) / mat.priceStandard > 0.005) {
        // Save history
        await db.insert(materialPriceHistoryTable).values({
          materialId: mat.id,
          priceEconomical: mat.priceEconomical,
          priceStandard: mat.priceStandard,
          pricePremium: mat.pricePremium,
          changePct: Math.round((factor - 1) * 1000) / 10,
          changeReason: `Market signal update Q2-2025: ${mat.category} adjustment (copper +${KSA_MARKET_SIGNALS_2025.copper_change_pct}%, inflation +${KSA_MARKET_SIGNALS_2025.inflation_ksa_pct}%)`,
          changeReasonAr: `تحديث إشارة السوق Q2-2025: تعديل ${mat.category} (نحاس +${KSA_MARKET_SIGNALS_2025.copper_change_pct}%، تضخم +${KSA_MARKET_SIGNALS_2025.inflation_ksa_pct}%)`,
          marketCondition: "copper_elevated",
          source: "ai_agent_15",
        });

        await db.update(materialsTable).set({
          priceEconomical: newEcon,
          priceStandard: newStd,
          pricePremium: newPrem,
          lastUpdated: new Date(),
        }).where(eq(materialsTable.id, mat.id));

        updatedCount++;
      }
    }

    // Step 2: AI analysis for market insights and new material suggestions
    let marketInsights: object = {};
    try {
      const catSummary = materials.reduce((acc: Record<string, { count: number; avgPrice: number }>, m) => {
        if (!acc[m.category]) acc[m.category] = { count: 0, avgPrice: 0 };
        acc[m.category].count++;
        acc[m.category].avgPrice = (acc[m.category].avgPrice * (acc[m.category].count - 1) + m.priceStandard) / acc[m.category].count;
        return acc;
      }, {});

      const aiPrompt = `You are a KSA electrical materials market analyst. Based on Q2 2025 market signals:
- Copper: +${KSA_MARKET_SIGNALS_2025.copper_change_pct}%
- Aluminum: +${KSA_MARKET_SIGNALS_2025.aluminum_change_pct}%
- Steel: +${KSA_MARKET_SIGNALS_2025.steel_change_pct}%
- KSA Inflation: +${KSA_MARKET_SIGNALS_2025.inflation_ksa_pct}%
- SEC tariff revisions pending Q3 2025

Current DB categories: ${Object.keys(catSummary).join(", ")}

Provide market insights in JSON:
{
  "overallOutlook": "string (Arabic)",
  "hotCategories": ["cat1", "cat2"],
  "riskWarnings": ["warning1 in Arabic", "warning2"],
  "buyingAdvice": "string (Arabic)",
  "priceOutlook3Months": "up|stable|down",
  "suggestedNewMaterials": [
    {"nameEn": "...", "nameAr": "...", "category": "...", "unit": "...", "priceStdSAR": 0, "reason": "..."}
  ]
}
Return only valid JSON.`;

      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1200,
        messages: [{ role: "user", content: aiPrompt }],
      });

      const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const insights = JSON.parse(jsonMatch[0]);
        marketInsights = insights;

        // Auto-add suggested new materials
        const suggested = insights.suggestedNewMaterials as Array<{
          nameEn: string; nameAr: string; category: string; unit: string; priceStdSAR: number; reason: string;
        }> | undefined;

        if (suggested?.length) {
          for (const nm of suggested.slice(0, 5)) {
            const exists = materials.some(m =>
              m.nameEn.toLowerCase().includes(nm.nameEn?.toLowerCase()?.slice(0, 15) || "XXXXXX")
            );
            if (!exists && nm.nameEn && nm.priceStdSAR > 0) {
              await db.insert(materialsTable).values({
                nameEn: nm.nameEn,
                nameAr: nm.nameAr || nm.nameEn,
                category: nm.category || "General",
                unit: nm.unit || "NO.",
                priceEconomical: Math.round(nm.priceStdSAR * 0.75 * 100) / 100,
                priceStandard: Math.round(nm.priceStdSAR * 100) / 100,
                pricePremium: Math.round(nm.priceStdSAR * 1.45 * 100) / 100,
                sasoApproved: true,
                brand: "Multiple / متعدد",
                specs: nm.reason,
                lastUpdated: new Date(),
              });
            }
          }
        }
      }
    } catch (e) {
      logger.warn({ err: e }, "Agent 15: AI market analysis failed");
      marketInsights = { overallOutlook: "تعذر جلب تحليل السوق من AI — تم تحديث الأسعار بإشارات السوق الأساسية.", priceOutlook3Months: "up" };
    }

    // Update job as complete
    await db.update(materialUpdateJobsTable).set({
      status: "completed",
      updatedCount,
      totalReviewed,
      marketInsights,
      summaryAr: `تم مراجعة ${totalReviewed} مادة وتحديث ${updatedCount} منها بناءً على إشارات سوق Q2-2025`,
      summary: `Reviewed ${totalReviewed} materials, updated ${updatedCount} based on Q2-2025 market signals`,
      completedAt: new Date(),
    }).where(eq(materialUpdateJobsTable.id, job.id));

    logger.info({ updatedCount, totalReviewed }, "Agent 15: Materials price update complete");
    return { jobId: job.id, updatedCount, totalReviewed, marketInsights };

  } catch (err) {
    await db.update(materialUpdateJobsTable).set({ status: "failed", completedAt: new Date() })
      .where(eq(materialUpdateJobsTable.id, job.id));
    throw err;
  }
}

export async function getLatestMaterialUpdateJob() {
  const jobs = await db.select().from(materialUpdateJobsTable)
    .orderBy(sql`started_at DESC`).limit(1);
  return jobs[0] || null;
}
