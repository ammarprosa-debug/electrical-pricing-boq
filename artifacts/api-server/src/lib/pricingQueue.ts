import { db } from "@workspace/db";
import { boqItemsTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { batchProcess } from "@workspace/integrations-anthropic-ai/batch";
import { logger } from "./logger.js";

type PricingJob = {
  projectId: number;
  scenarios: string[];
  running: boolean;
};

const jobs = new Map<number, PricingJob>();

// Sub-contractor install rates (SAR/unit) from real KSA market data
const INSTALL_RATES: Record<string, number> = {
  "cable_10mm": 10, "cable_16mm": 10, "cable_25mm": 15, "cable_35mm": 15,
  "cable_50mm": 18, "cable_70mm": 25, "cable_95mm": 25, "cable_120mm": 30,
  "cable_150mm": 50, "cable_185mm": 50, "cable_240mm": 50, "cable_300mm": 55,
  "panel_small": 1000, "panel_main": 2200, "cable_tray": 35,
  "lighting": 130, "socket": 110, "floor_box": 230, "ac_isolator": 200,
  "data_point": 120, "speaker_point": 120, "fire_point": 120, "camera_point": 120,
  "default": 80,
};

const ACCESS_RATES: Record<string, number> = {
  "Panels & Distribution": 500,
  "Cables & Wiring": 65,
  "Lighting": 80,
  "Wiring Devices": 130,
  "Conduits & Trunking": 40,
  "Protection Devices": 50,
  "Earthing & Bonding": 60,
  "Fire Alarm": 50,
  "Public Address": 50,
  "CCTV & Security": 60,
  "BMS & Automation": 100,
  "Data & Network": 50,
  "Power Systems": 300,
  "Medical Systems": 150,
  "AV & Signage": 100,
  "General Electrical": 65,
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

          // If the BOQ already has a unit price (from uploaded file), use it as Standard
          // and compute Eco/Premium as variants
          const hasExistingPrice = item.unitPriceStandard && item.unitPriceStandard > 0;

          const stdSupply = price.supplyQ || price.standard * 0.75;
          const wastage = price.wastageR || 0.01;
          const install = price.installS || getInstallRate(item.categoryLevel1 || "General Electrical", item.descriptionEn);
          const access = price.accessT || ACCESS_RATES[item.categoryLevel1 || "General Electrical"] || 65;

          // OUTLET formula: Supply × (1 + Wastage%) + Install + Access
          const outletStd = stdSupply * (1 + wastage) + install + access;
          const unitPriceStd = hasExistingPrice ? item.unitPriceStandard! : Math.ceil(outletStd);
          const unitPriceEco = Math.ceil(unitPriceStd * (price.ecoFactor || 0.78));
          const unitPricePre = Math.ceil(unitPriceStd * (price.preFactor || 1.32));

          const laborCost = install * item.quantity;
          const vatAmount = (unitPriceStd * item.quantity + laborCost) * 0.15;

          await db.update(boqItemsTable).set({
            unitPriceEconomical: unitPriceEco,
            unitPriceStandard: unitPriceStd,
            unitPricePremium: unitPricePre,
            totalEconomical: unitPriceEco * item.quantity,
            totalStandard: unitPriceStd * item.quantity,
            totalPremium: unitPricePre * item.quantity,
            laborCost,
            vatAmount,
            supplyPrice: stdSupply,
            wastagePercent: wastage * 100,
            installCost: install,
            accessCost: access,
            supplierName: price.supplier || item.supplierName || null,
            confidenceScore: price.confidence,
            complianceStatus: price.compliance as any,
            complianceNotes: price.complianceNotes,
            pricingSource: "ai_haiku",
            alternativeMaterial: price.alternative || null,
            alternativeSaving: price.alternativeSaving || null,
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

function getInstallRate(category: string, description: string): number {
  const desc = description.toLowerCase();
  if (desc.includes("150mm") || desc.includes("185mm") || desc.includes("240mm") || desc.includes("300mm")) return INSTALL_RATES.cable_150mm;
  if (desc.includes("95mm")) return INSTALL_RATES.cable_95mm;
  if (desc.includes("70mm")) return INSTALL_RATES.cable_70mm;
  if (desc.includes("50mm")) return INSTALL_RATES.cable_50mm;
  if (desc.includes("35mm")) return INSTALL_RATES.cable_35mm;
  if (desc.includes("25mm")) return INSTALL_RATES.cable_25mm;
  if (category === "Cables & Wiring") return INSTALL_RATES.cable_16mm;
  if (category === "Panels & Distribution") {
    if (desc.includes("main") || desc.includes("mdb") || desc.includes("رئيسية")) return INSTALL_RATES.panel_main;
    return INSTALL_RATES.panel_small;
  }
  if (category === "Lighting") return INSTALL_RATES.lighting;
  if (category === "Wiring Devices") return INSTALL_RATES.socket;
  if (category === "Fire Alarm") return INSTALL_RATES.fire_point;
  if (category === "CCTV & Security") return INSTALL_RATES.camera_point;
  if (category === "Data & Network") return INSTALL_RATES.data_point;
  if (category === "Public Address") return INSTALL_RATES.speaker_point;
  return INSTALL_RATES.default;
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
  supplyQ: number;
  wastageR: number;
  installS: number;
  accessT: number;
  standard: number;
  ecoFactor: number;
  preFactor: number;
  confidence: number;
  compliance: string;
  complianceNotes: string;
  supplier: string;
  alternative?: string;
  alternativeSaving?: number;
}>> {
  const compactItems = items.map((item, idx) => ({
    i: idx,
    d: item.descriptionEn.slice(0, 120),
    u: item.unit,
    q: item.quantity,
    c: item.categoryLevel1,
    sec: item.sectionName?.slice(0, 60) || null,
    knownPrice: item.unitPriceStandard || null,
    knownSupplier: item.supplierName || null,
  }));

  const systemPrompt = `You are a senior electrical estimator for Saudi Arabia (${region} region), 2026 market rates. 
Use the professional OUTLET pricing formula: OUTLET(P) = Supply(Q) × (1 + Wastage%) + Install(S) + Access(T)
- Supply(Q): material cost only (SAR/unit), ex-store
- Wastage: typically 1-3% for cables, 0% for equipment  
- Install(S): sub-contractor labor per unit (use KSA sub-con rates)
- Access(T): accessories/consumables per unit
Saudi VAT = 15%. SASO compliance is mandatory. Return ONLY valid JSON array, no markdown.`;

  const userPrompt = `Price these Saudi electrical BOQ items. For each item provide the OUTLET breakdown and 3 scenarios.

Items: ${JSON.stringify(compactItems)}

Return JSON array (same length, same indices):
[{
  "i": 0,
  "supplyQ": 45.5,
  "wastageR": 0.01,
  "installS": 110,
  "accessT": 130,
  "std": 290,
  "ecoFactor": 0.78,
  "preFactor": 1.32,
  "conf": 88,
  "comp": "pass",
  "compNotes": "IEC 60898 compliant, SASO approved",
  "supplier": "Schneider Electric / ABB",
  "alt": null,
  "altSav": null
}]

Rules:
- supplyQ = material cost only (SAR/unit)
- wastageR = fraction (0.01 = 1%)
- installS = KSA sub-contractor install rate (SAR/unit)
- accessT = accessories cost (conduits, glands, boxes etc.) (SAR/unit)
- std = final unit price (= supplyQ*(1+wastageR) + installS + accessT), rounded up
- ecoFactor = economical ratio vs standard (typically 0.72-0.82, use cheaper brands)
- preFactor = premium ratio vs standard (typically 1.25-1.45, use top brands)
- comp = "pass" | "warning" | "fail"
- supplier = recommended Saudi market supplier(s) for standard scenario
- alt = alternative cheaper brand if >15% saving possible (or null)
- altSav = percentage saving as number (not string, e.g. 22 not "22%") or null`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in response");

    const parsed: Array<{
      i: number;
      supplyQ?: unknown;
      wastageR?: unknown;
      installS?: unknown;
      accessT?: unknown;
      std?: unknown;
      ecoFactor?: unknown;
      preFactor?: unknown;
      conf?: unknown;
      comp?: unknown;
      compNotes?: string;
      supplier?: string;
      alt?: string | null;
      altSav?: unknown;
    }> = JSON.parse(jsonMatch[0]);

    const parseNum = (v: unknown, fallback = 0): number => {
      if (v == null) return fallback;
      if (typeof v === "number") return v;
      const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
      return isNaN(n) ? fallback : n;
    };
    const parseCompliance = (v: unknown): string => {
      const s = String(v || "").toLowerCase();
      if (s.includes("fail")) return "fail";
      if (s.includes("warn")) return "warning";
      return "pass";
    };

    return items.map((_, idx) => {
      const p = parsed.find(x => x.i === idx);
      if (!p) return {
        supplyQ: 0, wastageR: 0.01, installS: 0, accessT: 0,
        standard: 0, ecoFactor: 0.78, preFactor: 1.32,
        confidence: 0, compliance: "pending", complianceNotes: "Failed to price",
        supplier: "",
      };
      const supplyQ = parseNum(p.supplyQ);
      const wastageR = parseNum(p.wastageR, 0.01);
      const installS = parseNum(p.installS);
      const accessT = parseNum(p.accessT);
      const std = parseNum(p.std) || Math.ceil(supplyQ * (1 + wastageR) + installS + accessT);
      const altSav = p.altSav != null ? parseNum(p.altSav) : undefined;

      return {
        supplyQ,
        wastageR,
        installS,
        accessT,
        standard: std,
        ecoFactor: parseNum(p.ecoFactor, 0.78),
        preFactor: parseNum(p.preFactor, 1.32),
        confidence: parseNum(p.conf, 50),
        compliance: parseCompliance(p.comp),
        complianceNotes: String(p.compNotes || "").slice(0, 500),
        supplier: String(p.supplier || "").slice(0, 200),
        alternative: p.alt ? String(p.alt).slice(0, 200) : undefined,
        alternativeSaving: altSav != null && !isNaN(altSav) ? altSav : undefined,
      };
    });
  } catch (err) {
    logger.error({ err }, "AI pricing batch failed");
    return items.map(() => ({
      supplyQ: 0, wastageR: 0.01, installS: 0, accessT: 0,
      standard: 0, ecoFactor: 0.78, preFactor: 1.32,
      confidence: 0, compliance: "pending", complianceNotes: "Pricing failed",
      supplier: "",
    }));
  }
}

export const pricingQueue = { startPricingJob };
