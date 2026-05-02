/**
 * Agent 9 — Alternative Materials Advisor
 * Finds cheaper SASO-compliant equivalents for each priced BOQ item
 * Uses KSA market DB first, then AI for items not in DB
 */
import { db } from "@workspace/db";
import { boqItemsTable, alternativesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { lookupKsaPrice } from "./ksaMarketPrices.js";
import { logger } from "./logger.js";
import { batchProcess } from "@workspace/integrations-anthropic-ai/batch";

// Known cheaper alternatives in KSA market
const KSA_ALTERNATIVES: Record<string, Array<{
  brand: string; brandAr: string; spec: string; specAr: string;
  savingsPct: number; sasoApproved: boolean; availability: string;
}>> = {
  "schneider": [
    { brand: "Hager", brandAr: "هاجر", spec: "IEC 60898 certified, same rating", specAr: "معتمد IEC 60898، نفس المعايير", savingsPct: 18, sasoApproved: true, availability: "Riyadh/Jeddah/Dammam distributors" },
    { brand: "Legrand", brandAr: "ليجراند", spec: "IEC 60898, same rating, SASO approved", specAr: "IEC 60898، نفس المعايير، معتمد SASO", savingsPct: 12, sasoApproved: true, availability: "Major KSA cities" },
  ],
  "abb": [
    { brand: "Hager", brandAr: "هاجر", spec: "Same specification, IEC certified", specAr: "نفس المواصفات، معتمد IEC", savingsPct: 20, sasoApproved: true, availability: "KSA distributors" },
    { brand: "Eaton (Moeller)", brandAr: "إيتون (مولر)", spec: "Same rating, IEC 60898", specAr: "نفس المعايير، IEC 60898", savingsPct: 15, sasoApproved: true, availability: "Major KSA cities" },
  ],
  "prysmian": [
    { brand: "Saudi Cable Company", brandAr: "شركة كابل السعودية", spec: "IEC 60502, same cross-section, locally manufactured", specAr: "IEC 60502، نفس المقطع، محلي الصنع", savingsPct: 22, sasoApproved: true, availability: "All KSA regions" },
    { brand: "Nexans", brandAr: "نيكسانس", spec: "IEC 60502 certified, European quality", specAr: "معتمد IEC 60502، جودة أوروبية", savingsPct: 10, sasoApproved: true, availability: "KSA via Al-Fanar" },
  ],
  "nexans": [
    { brand: "Saudi Cable Company", brandAr: "شركة كابل السعودية", spec: "IEC 60502, same cross-section", specAr: "IEC 60502، نفس المقطع", savingsPct: 20, sasoApproved: true, availability: "All KSA regions" },
  ],
  "philips": [
    { brand: "Havells", brandAr: "هافيلز", spec: "Same lumen output, same color temperature, SASO Energy class", specAr: "نفس الإضاءة، درجة حرارة اللون، فئة الطاقة SASO", savingsPct: 25, sasoApproved: true, availability: "KSA distributors" },
    { brand: "Osram", brandAr: "أوسرام", spec: "Same specification, European brand", specAr: "نفس المواصفات، ماركة أوروبية", savingsPct: 12, sasoApproved: true, availability: "Major KSA cities" },
  ],
};

export interface AlternativesResult {
  projectId: number;
  itemsAnalyzed: number;
  itemsWithAlternatives: number;
  totalPotentialSavingSar: number;
  totalPotentialSavingPct: number;
}

export async function runAlternativesAnalysis(
  projectId: number,
  maxItems = 50
): Promise<AlternativesResult> {
  logger.info({ projectId }, "Agent 9: Starting alternatives analysis");

  const items = await db.select().from(boqItemsTable)
    .where(eq(boqItemsTable.projectId, projectId));

  const pricedItems = items
    .filter(i => i.unitPriceStandard && i.unitPriceStandard > 0)
    .sort((a, b) => (b.totalStandard || 0) - (a.totalStandard || 0)) // High-value first
    .slice(0, maxItems);

  if (pricedItems.length === 0) {
    return { projectId, itemsAnalyzed: 0, itemsWithAlternatives: 0, totalPotentialSavingSar: 0, totalPotentialSavingPct: 0 };
  }

  // Clear previous alternatives
  for (const item of pricedItems) {
    await db.delete(alternativesTable).where(eq(alternativesTable.boqItemId, item.id));
  }

  let itemsWithAlts = 0;
  let totalSaving = 0;
  const totalCost = pricedItems.reduce((s, i) => s + (i.totalStandard || 0), 0);

  // Step 1: DB-driven alternatives from KSA market + brand matching
  const needsAI: typeof pricedItems = [];

  for (const item of pricedItems) {
    const descLower = item.descriptionEn.toLowerCase();
    const alternatives: typeof alternativesTable.$inferInsert[] = [];

    // Check KSA market for cheaper equivalents
    const ksaMatch = lookupKsaPrice(item.descriptionEn, item.categoryLevel1 || "");
    const origPrice = item.unitPriceStandard!;

    if (ksaMatch && ksaMatch.supplyMin < ksaMatch.supplyStd * 0.7) {
      // There's a significantly cheaper option in the KSA DB
      const saving = origPrice - ksaMatch.supplyMin;
      const savingPct = (saving / origPrice) * 100;
      if (savingPct > 10) {
        alternatives.push({
          projectId, boqItemId: item.id, rank: 1,
          brand: "Economy / Local Brand",
          brandAr: "اقتصادي / ماركة محلية",
          spec: `${item.descriptionEn} — economical grade, SASO-compliant minimum spec`,
          specAr: `${item.descriptionAr || item.descriptionEn} — درجة اقتصادية، الحد الأدنى المطابق لـ SASO`,
          unitPriceSar: ksaMatch.supplyMin,
          originalPriceSar: origPrice,
          savingsPct: savingPct,
          savingsSar: saving * item.quantity,
          sasoApproved: true,
          iecCompliant: true,
          availability: "KSA market",
          notes: `KSA market minimum price for this specification`,
          notesAr: `الحد الأدنى لأسعار السوق السعودي لهذه المواصفات`,
        });
      }
    }

    // Check brand-specific alternatives
    let brandMatched = false;
    for (const [brand, alts] of Object.entries(KSA_ALTERNATIVES)) {
      if (!descLower.includes(brand)) continue;
      brandMatched = true;
      for (let rank = 0; rank < Math.min(alts.length, 2); rank++) {
        const alt = alts[rank];
        const altPrice = origPrice * (1 - alt.savingsPct / 100);
        alternatives.push({
          projectId, boqItemId: item.id, rank: rank + 2,
          brand: alt.brand, brandAr: alt.brandAr,
          spec: alt.spec, specAr: alt.specAr,
          unitPriceSar: altPrice,
          originalPriceSar: origPrice,
          savingsPct: alt.savingsPct,
          savingsSar: (origPrice - altPrice) * item.quantity,
          sasoApproved: alt.sasoApproved,
          iecCompliant: true,
          availability: alt.availability,
        });
      }
    }

    if (alternatives.length > 0) {
      await db.insert(alternativesTable).values(alternatives);
      const bestSaving = alternatives.reduce((max, a) => Math.max(max, a.savingsSar || 0), 0);
      totalSaving += bestSaving;
      itemsWithAlts++;
    } else if (!brandMatched && (item.totalStandard || 0) > 5000) {
      // High-value items without alternatives — queue for AI
      needsAI.push(item);
    }
  }

  // Step 2: AI analysis for high-value items without DB alternatives
  if (needsAI.length > 0) {
    const BATCH = 6;
    const batches: typeof needsAI[] = [];
    for (let i = 0; i < needsAI.length; i += BATCH) batches.push(needsAI.slice(i, i + BATCH));

    await batchProcess(
      batches,
      async (batch) => {
        const compact = batch.map((item, idx) => ({
          i: idx,
          id: item.id,
          d: item.descriptionEn.slice(0, 120),
          u: item.unit,
          p: item.unitPriceStandard,
          cat: item.categoryLevel1,
        }));

        try {
          const msg = await anthropic.messages.create({
            model: "claude-haiku-4-5",
            max_tokens: 3000,
            system: `You are a procurement specialist in Saudi Arabia. Find cheaper SASO-compliant alternatives available in the KSA market.
Only suggest alternatives that are genuinely available from Saudi distributors. Return ONLY JSON.`,
            messages: [{
              role: "user",
              content: `Find up to 2 cheaper SASO-compliant alternatives for each item. Focus on items where ≥10% saving is realistic.

Items: ${JSON.stringify(compact)}

Return JSON array:
[{
  "i": 0,
  "id": 123,
  "alts": [
    {
      "rank": 1,
      "brand": "Alternative Brand",
      "brandAr": "الماركة البديلة",
      "spec": "full spec description",
      "specAr": "وصف المواصفات",
      "unitPriceSar": 38.5,
      "savingsPct": 16.5,
      "sasoApproved": true,
      "availability": "Available via Al-Fanar / Alessa Industries"
    }
  ]
}]
Return [] for items where no good alternatives exist.`,
            }],
          });

          const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
          const match = text.match(/\[[\s\S]*\]/);
          if (!match) return;

          const results: Array<{
            i: number; id: number;
            alts: Array<{
              rank: number; brand: string; brandAr?: string;
              spec: string; specAr?: string;
              unitPriceSar: number; savingsPct: number;
              sasoApproved?: boolean; availability?: string;
            }>;
          }> = JSON.parse(match[0]);

          for (const result of results) {
            const item = batch[result.i];
            if (!item || !result.alts?.length) continue;

            const rows: typeof alternativesTable.$inferInsert[] = result.alts
              .filter(a => a.savingsPct >= 10 && a.unitPriceSar > 0)
              .map(a => ({
                projectId, boqItemId: item.id,
                rank: a.rank,
                brand: a.brand, brandAr: a.brandAr || "",
                spec: a.spec, specAr: a.specAr || "",
                unitPriceSar: a.unitPriceSar,
                originalPriceSar: item.unitPriceStandard,
                savingsPct: a.savingsPct,
                savingsSar: (item.unitPriceStandard! - a.unitPriceSar) * item.quantity,
                sasoApproved: a.sasoApproved !== false,
                iecCompliant: true,
                availability: a.availability || "KSA market",
              }));

            if (rows.length > 0) {
              await db.insert(alternativesTable).values(rows);
              const bestSaving = rows.reduce((max, r) => Math.max(max, r.savingsSar || 0), 0);
              totalSaving += bestSaving;
              itemsWithAlts++;
            }
          }
        } catch (err) {
          logger.warn({ err }, "Agent 9 AI batch failed");
        }
      },
      { concurrency: 2, retries: 1 }
    );
  }

  const result: AlternativesResult = {
    projectId,
    itemsAnalyzed: pricedItems.length,
    itemsWithAlternatives: itemsWithAlts,
    totalPotentialSavingSar: Math.round(totalSaving),
    totalPotentialSavingPct: totalCost > 0 ? Math.round((totalSaving / totalCost) * 1000) / 10 : 0,
  };

  logger.info({ projectId, ...result }, "Agent 9 alternatives analysis complete");
  return result;
}
