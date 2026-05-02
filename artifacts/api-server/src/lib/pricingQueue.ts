import { db } from "@workspace/db";
import { boqItemsTable, projectsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { batchProcess } from "@workspace/integrations-anthropic-ai/batch";
import { logger } from "./logger.js";

type PricingJob = {
  projectId: number;
  scenarios: string[];
  running: boolean;
};

const jobs = new Map<number, PricingJob>();

const SAUDI_LABOR_RATES: Record<string, number> = {
  "Cables & Wiring": 8,
  "Panels & Distribution": 25,
  "Lighting": 15,
  "Wiring Devices": 5,
  "Conduits & Trunking": 6,
  "Protection Devices": 10,
  "Earthing & Bonding": 12,
  "Power Systems": 30,
  "Transformers": 50,
  "Motors & Drives": 20,
  "General Electrical": 10,
};

export async function startPricingJob(projectId: number, scenarios: string[]) {
  if (jobs.get(projectId)?.running) return;

  const job: PricingJob = { projectId, scenarios, running: true };
  jobs.set(projectId, job);

  await db.update(projectsTable).set({ status: "pricing" }).where(eq(projectsTable.id, projectId));

  runPricingInBackground(job).catch(err => {
    logger.error({ err, projectId }, "Pricing job failed");
  });
}

async function runPricingInBackground(job: PricingJob) {
  const { projectId } = job;
  try {
    const items = await db.select().from(boqItemsTable)
      .where(eq(boqItemsTable.projectId, projectId));

    if (items.length === 0) {
      await db.update(projectsTable).set({ status: "completed" }).where(eq(projectsTable.id, projectId));
      return;
    }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    const region = project?.region || "riyadh";

    const BATCH_SIZE = 20;
    const batches: typeof items[] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push(items.slice(i, i + BATCH_SIZE));
    }

    let pricedCount = 0;
    await batchProcess(
      batches,
      async (batch) => {
        const prices = await priceItemBatch(batch, region);
        for (let i = 0; i < batch.length; i++) {
          const item = batch[i];
          const price = prices[i];
          if (!price) continue;

          const laborCostPerUnit = SAUDI_LABOR_RATES[item.categoryLevel1 || "General Electrical"] || 10;
          const laborCost = laborCostPerUnit * item.quantity;

          await db.update(boqItemsTable).set({
            unitPriceEconomical: price.economical,
            unitPriceStandard: price.standard,
            unitPricePremium: price.premium,
            totalEconomical: price.economical * item.quantity,
            totalStandard: price.standard * item.quantity,
            totalPremium: price.premium * item.quantity,
            laborCost,
            vatAmount: (price.standard * item.quantity + laborCost) * 0.15,
            confidenceScore: price.confidence,
            complianceStatus: price.compliance as any,
            complianceNotes: price.complianceNotes,
            pricingSource: price.source as any,
            alternativeMaterial: price.alternative,
            alternativeSaving: price.alternativeSaving,
            needsReview: price.confidence < 70 || price.compliance === "fail",
            status: "priced",
            updatedAt: new Date(),
          }).where(eq(boqItemsTable.id, item.id));

          pricedCount++;
        }
        await db.update(projectsTable).set({ pricedItems: pricedCount }).where(eq(projectsTable.id, projectId));
      },
      { concurrency: 2, retries: 3 }
    );

    const allItems = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, projectId));
    const reviewCount = allItems.filter(i => i.needsReview).length;
    const totals = calcTotals(allItems);

    await db.update(projectsTable).set({
      status: reviewCount > 0 ? "reviewing" : "completed",
      pricedItems: allItems.filter(i => i.status !== "pending").length,
      reviewItems: reviewCount,
      totalEconomical: totals.economical,
      totalStandard: totals.standard,
      totalPremium: totals.premium,
    }).where(eq(projectsTable.id, projectId));

  } catch (err) {
    logger.error({ err, projectId }, "Pricing failed");
    await db.update(projectsTable).set({ status: "failed" }).where(eq(projectsTable.id, projectId));
  } finally {
    jobs.delete(projectId);
  }
}

function calcTotals(items: typeof boqItemsTable.$inferSelect[]) {
  return {
    economical: items.reduce((s, i) => s + ((i.unitPriceEconomical || 0) * i.quantity), 0),
    standard: items.reduce((s, i) => s + ((i.unitPriceStandard || 0) * i.quantity), 0),
    premium: items.reduce((s, i) => s + ((i.unitPricePremium || 0) * i.quantity), 0),
  };
}

async function priceItemBatch(
  items: typeof boqItemsTable.$inferSelect[],
  region: string
): Promise<Array<{
  economical: number;
  standard: number;
  premium: number;
  confidence: number;
  compliance: string;
  complianceNotes: string;
  source: string;
  alternative?: string;
  alternativeSaving?: number;
}>> {
  const compactItems = items.map((item, idx) => ({
    i: idx,
    d: item.descriptionEn.slice(0, 100),
    u: item.unit,
    q: item.quantity,
    c: item.categoryLevel1,
  }));

  const systemPrompt = `You are an electrical materials pricing expert for Saudi Arabia (${region} region). VAT=15%. Price in SAR. Return ONLY valid JSON array.`;

  const userPrompt = `Price these electrical BOQ items for Saudi market. For each item return 3 scenarios (economical/standard/premium unit prices in SAR), confidence (0-100), SASO compliance (pass/warning/fail), brief compliance notes, and alternative material if >20% cheaper exists.

Items: ${JSON.stringify(compactItems)}

Return JSON array with same indices:
[{"i":0,"eco":0,"std":0,"pre":0,"conf":85,"comp":"pass","compNotes":"IEC compliant","alt":null,"altSav":null}]`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found in response");

    const parsed: Array<{
      i: number;
      eco: number;
      std: number;
      pre: number;
      conf: number;
      comp: string;
      compNotes: string;
      alt?: string;
      altSav?: number;
    }> = JSON.parse(jsonMatch[0]);

    return items.map((_, idx) => {
      const p = parsed.find(x => x.i === idx);
      if (!p) return { economical: 0, standard: 0, premium: 0, confidence: 0, compliance: "pending", complianceNotes: "Failed to price", source: "ai_haiku" };
      return {
        economical: p.eco || 0,
        standard: p.std || 0,
        premium: p.pre || 0,
        confidence: p.conf || 50,
        compliance: p.comp || "pending",
        complianceNotes: p.compNotes || "",
        source: "ai_haiku",
        alternative: p.alt || undefined,
        alternativeSaving: p.altSav || undefined,
      };
    });
  } catch (err) {
    logger.error({ err }, "AI pricing batch failed");
    return items.map(() => ({ economical: 0, standard: 0, premium: 0, confidence: 0, compliance: "pending", complianceNotes: "Failed to price", source: "ai_haiku" }));
  }
}

export const pricingQueue = { startPricingJob };
