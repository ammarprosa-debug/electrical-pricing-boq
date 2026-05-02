/**
 * Agent 3 — Material Sub-Components Breakdown
 * Breaks each BOQ item into constituent materials with quantities
 *
 * Agent 4 — Detailed BOM with KSA Prices
 * Full Bill of Materials per item, enriched with KSA market prices & brands
 */
import { db } from "@workspace/db";
import { boqItemsTable, materialTakeoffTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { lookupKsaPrice, normalizeUnit, getBrandsByCategory } from "./ksaMarketPrices.js";
import { logger } from "./logger.js";
import { batchProcess } from "@workspace/integrations-anthropic-ai/batch";

// ── Agent 3: Material Sub-Components Breakdown ────────────────────────────────
export async function runMaterialTakeoff(projectId: number, itemIds?: number[]): Promise<{ processed: number; subItems: number }> {
  logger.info({ projectId, itemIds: itemIds?.length }, "Agent 3: Starting material sub-components takeoff");

  let items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, projectId));
  if (itemIds && itemIds.length > 0) {
    items = items.filter(i => itemIds.includes(i.id));
  } else {
    items = items.filter(i => i.unitPriceStandard && i.unitPriceStandard > 0);
  }

  if (items.length === 0) return { processed: 0, subItems: 0 };

  // Clear previous takeoff for these items
  for (const item of items) {
    await db.delete(materialTakeoffTable).where(eq(materialTakeoffTable.boqItemId, item.id));
  }

  const BATCH_SIZE = 8;
  const batches: typeof items[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) batches.push(items.slice(i, i + BATCH_SIZE));

  let totalSubItems = 0;

  await batchProcess(
    batches,
    async (batch) => {
      const compact = batch.map((item, idx) => ({
        i: idx,
        id: item.id,
        d: item.descriptionEn.slice(0, 150),
        u: item.unit,
        q: item.quantity,
        c: item.categoryLevel1,
        sec: item.sectionName?.slice(0, 80),
        p: item.unitPriceStandard,
        disc: item.discipline,
      }));

      try {
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 8192,
          system: `You are an expert Saudi Arabia electrical/MEP materials quantity surveyor. 
Break down each BOQ item into its constituent sub-materials and labor components, exactly as would appear in a professional Material Takeoff (MTO) or Bill of Materials (BOM).
Be detailed and realistic. Saudi market 2025. Return ONLY valid JSON.`,
          messages: [{
            role: "user",
            content: `Break down these BOQ items into sub-components. For each item produce a list of actual materials needed to supply and install it.

BOQ Items:
${JSON.stringify(compact, null, 2)}

Return JSON array where each entry matches a BOQ item:
[{
  "i": 0,
  "id": 123,
  "subItems": [
    {
      "lineNo": 1,
      "code": "CABLE-6MM-3C",
      "descEn": "3-Core 6mm² XLPE/PVC Cable (Saudi Cable / Nexans)",
      "descAr": "كابل ثلاثي 6 مم² XLPE/PVC",
      "cat": "Cables & Wiring",
      "brand": "Saudi Cable / Nexans",
      "unit": "m",
      "qty": 1.05,
      "wastage": 5,
      "priceMin": 8.5,
      "priceStd": 14.0,
      "pricePrem": 20.0,
      "isMajor": true,
      "isLabor": false,
      "isAccessory": false,
      "notes": "Include 5% wastage for cuts",
      "notesAr": "يشمل 5% هدر"
    },
    {
      "lineNo": 2,
      "code": "CONDUIT-20",
      "descEn": "20mm PVC Conduit",
      "descAr": "ماسورة PVC 20 مم",
      "cat": "Conduits & Trunking",
      "brand": "Legrand / Generic",
      "unit": "m",
      "qty": 1.1,
      "wastage": 8,
      "priceMin": 1.8,
      "priceStd": 2.8,
      "pricePrem": 4.5,
      "isMajor": false,
      "isLabor": false,
      "isAccessory": true,
      "notes": "Per meter of cable run",
      "notesAr": "لكل متر كابل"
    },
    {
      "lineNo": 3,
      "code": "LABOR-CABLE",
      "descEn": "Cable Installation Labor",
      "descAr": "عمالة تركيب الكابل",
      "cat": "Labor",
      "brand": "Sub-Contractor",
      "unit": "m",
      "qty": 1.0,
      "wastage": 0,
      "priceMin": 8.0,
      "priceStd": 12.0,
      "pricePrem": 18.0,
      "isMajor": false,
      "isLabor": true,
      "isAccessory": false,
      "notes": "KSA sub-contractor rate per meter",
      "notesAr": "سعر المقاول من الباطن بالسوق السعودي"
    }
  ]
}]

Rules:
- Include ALL materials: cable, conduit, boxes, glands, labels, lugs, connectors
- Include labor separately (isLabor:true) 
- Include accessories (glands, ties, clips) as isAccessory:true
- qty should be per unit of the parent BOQ item
- Prices in SAR for KSA market 2025
- For panels: include enclosure, busbars, MCBs, wiring, terminals, labels
- For lighting: include fitting, lamp, backbox, connector
- For sockets: include socket, backbox, cable, conduit
- For fire alarm items: include device, base, cable segment, conduit
- isMajor=true for the primary material (most expensive)`
          }],
        });

        const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return;

        const results: Array<{
          i: number;
          id: number;
          subItems: Array<{
            lineNo: number;
            code?: string;
            descEn: string;
            descAr?: string;
            cat?: string;
            brand?: string;
            unit: string;
            qty: number;
            wastage?: number;
            priceMin?: number;
            priceStd?: number;
            pricePrem?: number;
            isMajor?: boolean;
            isLabor?: boolean;
            isAccessory?: boolean;
            notes?: string;
            notesAr?: string;
          }>;
        }> = JSON.parse(jsonMatch[0]);

        for (const result of results) {
          const boqItem = batch[result.i];
          if (!boqItem || !result.subItems?.length) continue;

          const insertRows: typeof materialTakeoffTable.$inferInsert[] = result.subItems.map(sub => {
            const ksaMatch = lookupKsaPrice(sub.descEn, sub.cat || "");
            const brandInfo = sub.brand ? { brands: sub.brand, brandAr: "" } : getBrandsByCategory(sub.cat);
            const baseQty = sub.qty * boqItem.quantity;

            return {
              projectId,
              boqItemId: boqItem.id,
              parentBoqDesc: boqItem.descriptionEn.slice(0, 200),
              lineNo: sub.lineNo,
              subItemCode: sub.code,
              descriptionEn: sub.descEn,
              descriptionAr: sub.descAr,
              category: sub.cat,
              brand: sub.brand || brandInfo.brands,
              brandAr: ksaMatch?.brandAr || brandInfo.brandAr,
              unit: normalizeUnit(sub.unit),
              quantity: Math.round(baseQty * 100) / 100,
              wastagePercent: sub.wastage || 0,
              unitPriceMin: sub.priceMin || ksaMatch?.supplyMin || null,
              unitPriceStd: sub.priceStd || ksaMatch?.supplyStd || null,
              unitPricePremium: sub.pricePrem || ksaMatch?.supplyPremium || null,
              totalPriceStd: sub.priceStd ? Math.round(sub.priceStd * baseQty * 100) / 100 : null,
              isLabor: sub.isLabor || false,
              isAccessory: sub.isAccessory || false,
              isMajor: sub.isMajor || false,
              notes: sub.notes,
              notesAr: sub.notesAr,
            };
          });

          if (insertRows.length > 0) {
            await db.insert(materialTakeoffTable).values(insertRows);
            totalSubItems += insertRows.length;
          }
        }
      } catch (err) {
        logger.error({ err }, "Agent 3 batch failed");
      }
    },
    { concurrency: 2, retries: 2 }
  );

  logger.info({ projectId, processed: items.length, subItems: totalSubItems }, "Agent 3 takeoff complete");
  return { processed: items.length, subItems: totalSubItems };
}

// ── Agent 4: BOM Enrichment & KSA Price Augmentation ────────────────────────
export async function runBomEnrichment(projectId: number): Promise<{ enriched: number }> {
  logger.info({ projectId }, "Agent 4: Starting BOM enrichment");

  const takeoffItems = await db.select()
    .from(materialTakeoffTable)
    .where(eq(materialTakeoffTable.projectId, projectId));

  if (takeoffItems.length === 0) return { enriched: 0 };

  let enriched = 0;
  const BATCH = 40;

  for (let i = 0; i < takeoffItems.length; i += BATCH) {
    const batch = takeoffItems.slice(i, i + BATCH);

    for (const ti of batch) {
      if (ti.unitPriceStd) continue; // already has price
      const match = lookupKsaPrice(ti.descriptionEn, ti.category || "");
      if (!match) continue;

      await db.update(materialTakeoffTable)
        .set({
          unitPriceMin: match.supplyMin,
          unitPriceStd: match.supplyStd,
          unitPricePremium: match.supplyPremium,
          totalPriceStd: Math.round(match.supplyStd * ti.quantity * 100) / 100,
          brand: ti.brand || match.brands,
          brandAr: ti.brandAr || match.brandAr,
        })
        .where(eq(materialTakeoffTable.id, ti.id));

      enriched++;
    }
  }

  logger.info({ projectId, enriched }, "Agent 4 BOM enrichment complete");
  return { enriched };
}
