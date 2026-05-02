/**
 * Agent 1 — KSA Market Price Comparator
 * Compares BOQ prices against KSA market DB, flags outliers, suggests corrections
 *
 * Agent 2 — Consistency & Compliance Validator
 * Validates pricing consistency, duplicate items, SASO compliance patterns
 */
import { db } from "@workspace/db";
import { boqItemsTable, projectsTable, priceReviewsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { lookupKsaPrice } from "./ksaMarketPrices.js";
import { logger } from "./logger.js";

type ReviewSeverity = "info" | "warning" | "critical";

// ── Agent 1: KSA Market Comparator ─────────────────────────────────────────
export async function runMarketPriceReview(projectId: number): Promise<{ total: number; critical: number; warnings: number }> {
  logger.info({ projectId }, "Agent 1: Starting KSA market price review");

  const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, projectId));
  const pricedItems = items.filter(i => i.unitPriceStandard && i.unitPriceStandard > 0);

  if (pricedItems.length === 0) return { total: 0, critical: 0, warnings: 0 };

  // Clear previous reviews from this agent
  await db.delete(priceReviewsTable)
    .where(eq(priceReviewsTable.projectId, projectId))
    .where(eq(priceReviewsTable.agentId, "market_comparator") as any);

  const reviews: Array<typeof priceReviewsTable.$inferInsert> = [];

  // Step 1: Database-driven comparison (fast, no API)
  for (const item of pricedItems) {
    const match = lookupKsaPrice(item.descriptionEn, item.categoryLevel1 || "");
    if (!match || !item.unitPriceStandard) continue;

    const itemPrice = item.unitPriceStandard;
    const mktMin = match.supplyMin * 0.85;
    const mktMax = match.supplyPremium * 2.0;
    const mktStd = match.supplyStd;
    const variance = itemPrice - mktStd;
    const variancePct = (variance / mktStd) * 100;

    let severity: ReviewSeverity = "info";
    let title = "";
    let titleAr = "";
    let description = "";
    let descriptionAr = "";
    let recommendation = "";
    let recommendationAr = "";

    if (itemPrice < mktMin * 0.5) {
      severity = "critical";
      title = "Price Critically Below Market";
      titleAr = "السعر أقل بكثير من السوق";
      description = `Unit price ${itemPrice.toFixed(0)} SAR is ${Math.abs(variancePct).toFixed(0)}% below market minimum (${mktMin.toFixed(0)} SAR). Risk of substandard materials or calculation error.`;
      descriptionAr = `سعر الوحدة ${itemPrice.toFixed(0)} ريال أقل بـ ${Math.abs(variancePct).toFixed(0)}% من الحد الأدنى للسوق (${mktMin.toFixed(0)} ريال). خطر مواد دون المستوى.`;
      recommendation = `Revise to SAR ${mktStd.toFixed(0)} (market standard) or verify scope reduction.`;
      recommendationAr = `راجع السعر إلى ${mktStd.toFixed(0)} ريال (معياري) أو تحقق من تخفيض النطاق.`;
    } else if (itemPrice > mktMax) {
      severity = variancePct > 80 ? "critical" : "warning";
      title = severity === "critical" ? "Price Extremely Above Market" : "Price Above Market Rate";
      titleAr = severity === "critical" ? "السعر مرتفع جداً عن السوق" : "السعر فوق معدل السوق";
      description = `Unit price ${itemPrice.toFixed(0)} SAR is ${variancePct.toFixed(0)}% above market maximum (${mktMax.toFixed(0)} SAR) for ${match.brands}.`;
      descriptionAr = `سعر الوحدة ${itemPrice.toFixed(0)} ريال أعلى بـ ${variancePct.toFixed(0)}% من السقف السوقي (${mktMax.toFixed(0)} ريال) للماركة ${match.brandAr}.`;
      recommendation = `Consider ${match.brands} at SAR ${mktStd.toFixed(0)} for standard scenario.`;
      recommendationAr = `استخدم ${match.brandAr} بسعر ${mktStd.toFixed(0)} ريال للسيناريو المعياري.`;
    } else if (Math.abs(variancePct) > 35) {
      severity = "warning";
      title = variancePct > 0 ? "Price Above Market Average" : "Price Below Market Average";
      titleAr = variancePct > 0 ? "السعر فوق متوسط السوق" : "السعر تحت متوسط السوق";
      description = `Unit price ${itemPrice.toFixed(0)} SAR deviates ${Math.abs(variancePct).toFixed(0)}% from market standard ${mktStd.toFixed(0)} SAR.`;
      descriptionAr = `سعر الوحدة يبتعد ${Math.abs(variancePct).toFixed(0)}% عن المعيار السوقي ${mktStd.toFixed(0)} ريال.`;
      recommendation = `Verify with ${match.brands}. Market range: ${mktMin.toFixed(0)}–${mktMax.toFixed(0)} SAR.`;
      recommendationAr = `تحقق مع ${match.brandAr}. نطاق السوق: ${mktMin.toFixed(0)} – ${mktMax.toFixed(0)} ريال.`;
    }

    if (title) {
      reviews.push({
        projectId,
        boqItemId: item.id,
        agentId: "market_comparator",
        agentName: "KSA Market Price Comparator",
        reviewType: "market_deviation",
        severity,
        status: "pending",
        title,
        titleAr,
        description,
        descriptionAr,
        currentValue: itemPrice,
        suggestedValue: mktStd,
        minMarketValue: mktMin,
        maxMarketValue: mktMax,
        variance,
        variancePercent: variancePct,
        recommendation,
        recommendationAr,
        metadata: { itemDesc: item.descriptionEn, category: item.categoryLevel1, brands: match.brands } as unknown as Record<string, unknown>,
      });
    }
  }

  // Step 2: AI-powered deeper analysis (batched)
  const BATCH = 30;
  const batches: typeof pricedItems[] = [];
  for (let i = 0; i < pricedItems.length; i += BATCH) batches.push(pricedItems.slice(i, i + BATCH));

  for (const batch of batches) {
    try {
      const compact = batch.map((item, idx) => ({
        i: idx,
        d: item.descriptionEn.slice(0, 100),
        c: item.categoryLevel1,
        u: item.unit,
        q: item.quantity,
        p: item.unitPriceStandard,
        pEco: item.unitPriceEconomical,
        pPrem: item.unitPricePremium,
      }));

      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        system: `You are an expert Saudi Arabia (KSA) electrical cost estimator doing a price audit. 
Review BOQ items for pricing issues: wrong units, implausible prices, missing scope, SASO issues.
Saudi market 2025 context. Return ONLY valid JSON array.`,
        messages: [{
          role: "user",
          content: `Audit these priced BOQ items for pricing anomalies. Flag only real issues (not minor deviations).

Items: ${JSON.stringify(compact)}

Return JSON array of ONLY items with issues (skip items that look correct):
[{
  "i": 0,
  "issue": "short description of issue",
  "issueAr": "وصف عربي مختصر",  
  "severity": "info|warning|critical",
  "suggestedPrice": 150,
  "reason": "explanation",
  "reasonAr": "التفسير بالعربي"
}]
Return [] if all items look correct.`
        }],
      });

      const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      const flags: Array<{
        i: number; issue: string; issueAr?: string;
        severity?: string; suggestedPrice?: number;
        reason?: string; reasonAr?: string;
      }> = JSON.parse(jsonMatch[0]);

      for (const flag of flags) {
        const item = batch[flag.i];
        if (!item) continue;
        const sev = (["info","warning","critical"].includes(flag.severity || "")) ? flag.severity as ReviewSeverity : "warning";
        reviews.push({
          projectId,
          boqItemId: item.id,
          agentId: "market_comparator",
          agentName: "KSA Market Price Comparator",
          reviewType: "ai_anomaly",
          severity: sev,
          status: "pending",
          title: flag.issue || "Pricing Anomaly Detected",
          titleAr: flag.issueAr,
          description: flag.reason || "",
          descriptionAr: flag.reasonAr,
          currentValue: item.unitPriceStandard,
          suggestedValue: flag.suggestedPrice || null,
          recommendation: flag.suggestedPrice ? `Suggested price: SAR ${flag.suggestedPrice}` : null,
          recommendationAr: flag.suggestedPrice ? `السعر المقترح: ${flag.suggestedPrice} ريال` : null,
        });
      }
    } catch (err) {
      logger.error({ err }, "Agent 1 AI batch failed");
    }
  }

  // Persist reviews
  if (reviews.length > 0) {
    await db.insert(priceReviewsTable).values(reviews);
  }

  // Update project review count
  const critCount = reviews.filter(r => r.severity === "critical").length;
  const warnCount = reviews.filter(r => r.severity === "warning").length;
  await db.update(projectsTable)
    .set({ reviewItems: reviews.length })
    .where(eq(projectsTable.id, projectId));

  logger.info({ projectId, total: reviews.length, critCount, warnCount }, "Agent 1 review complete");
  return { total: reviews.length, critical: critCount, warnings: warnCount };
}

// ── Agent 2: Consistency & Compliance Validator ───────────────────────────────
export async function runComplianceReview(projectId: number): Promise<{ total: number; issues: number }> {
  logger.info({ projectId }, "Agent 2: Starting compliance & consistency review");

  const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, projectId));
  const pricedItems = items.filter(i => i.unitPriceStandard && i.unitPriceStandard > 0);

  await db.delete(priceReviewsTable)
    .where(eq(priceReviewsTable.projectId, projectId))
    .where(eq(priceReviewsTable.agentId, "compliance_validator") as any);

  const reviews: Array<typeof priceReviewsTable.$inferInsert> = [];

  // Check 1: Duplicate descriptions
  const descMap = new Map<string, typeof pricedItems>();
  for (const item of pricedItems) {
    const key = item.descriptionEn.toLowerCase().trim().slice(0, 60);
    if (!descMap.has(key)) descMap.set(key, []);
    descMap.get(key)!.push(item);
  }
  for (const [desc, dupeItems] of descMap) {
    if (dupeItems.length < 2) continue;
    const prices = dupeItems.map(i => i.unitPriceStandard!);
    const maxP = Math.max(...prices), minP = Math.min(...prices);
    if ((maxP - minP) / maxP > 0.15) {
      reviews.push({
        projectId,
        agentId: "compliance_validator",
        agentName: "Consistency & Compliance Validator",
        reviewType: "duplicate_inconsistency",
        severity: "warning",
        status: "pending",
        title: `Inconsistent Pricing: Same Item, Different Prices`,
        titleAr: "تناقض في التسعير: نفس البند بأسعار مختلفة",
        description: `"${desc}" appears ${dupeItems.length} times with prices ranging ${minP.toFixed(0)}–${maxP.toFixed(0)} SAR (${((maxP-minP)/maxP*100).toFixed(0)}% spread).`,
        descriptionAr: `البند "${desc}" يظهر ${dupeItems.length} مرات بأسعار تتراوح ${minP.toFixed(0)}–${maxP.toFixed(0)} ريال.`,
        currentValue: maxP,
        suggestedValue: (maxP + minP) / 2,
        variance: maxP - minP,
        variancePercent: (maxP - minP) / maxP * 100,
        recommendation: "Standardize to a single price per unit across all occurrences.",
        recommendationAr: "وحّد السعر لنفس البند في جميع تكراراته.",
        metadata: { itemIds: dupeItems.map(i => i.id), prices } as unknown as Record<string, unknown>,
      });
    }
  }

  // Check 2: SASO compliance failures
  const failItems = pricedItems.filter(i => i.complianceStatus === "fail");
  for (const item of failItems) {
    reviews.push({
      projectId,
      boqItemId: item.id,
      agentId: "compliance_validator",
      agentName: "Consistency & Compliance Validator",
      reviewType: "saso_non_compliance",
      severity: "critical",
      status: "pending",
      title: "SASO Non-Compliance Detected",
      titleAr: "عدم الامتثال لمعايير SASO",
      description: `Item "${item.descriptionEn}" flagged as non-compliant. ${item.complianceNotes || ""}`,
      descriptionAr: `البند "${item.descriptionAr || item.descriptionEn}" غير مطابق لمعايير SASO. ${item.complianceNotes || ""}`,
      recommendation: "Replace with SASO-certified equivalent. Do not include non-compliant items in final BOQ.",
      recommendationAr: "استبدل بمنتج معتمد من SASO. لا تضمّن عناصر غير مطابقة في المقايسة النهائية.",
    });
  }

  // Check 3: Low confidence AI analysis (items needing review)
  const lowConf = pricedItems.filter(i => (i.confidenceScore || 100) < 60);
  if (lowConf.length > 0) {
    reviews.push({
      projectId,
      agentId: "compliance_validator",
      agentName: "Consistency & Compliance Validator",
      reviewType: "low_confidence",
      severity: "warning",
      status: "pending",
      title: `${lowConf.length} Items with Low AI Confidence`,
      titleAr: `${lowConf.length} بند بثقة ذكاء اصطناعي منخفضة`,
      description: `${lowConf.length} items have confidence score below 60%. These may need manual price verification from suppliers.`,
      descriptionAr: `${lowConf.length} بند بدرجة ثقة أقل من 60%. يستلزم هذا مراجعة يدوية من الموردين.`,
      recommendation: "Request supplier quotations for these items before finalizing the BOQ.",
      recommendationAr: "اطلب عروض أسعار من الموردين لهذه البنود قبل إقفال المقايسة.",
      metadata: { itemIds: lowConf.map(i => i.id), count: lowConf.length } as unknown as Record<string, unknown>,
    });
  }

  // Check 4: AI deeper consistency analysis
  if (pricedItems.length > 0) {
    try {
      const byCategory = new Map<string, { items: number; total: number; avg: number }>();
      for (const item of pricedItems) {
        const cat = item.categoryLevel1 || "General";
        const cur = byCategory.get(cat) || { items: 0, total: 0, avg: 0 };
        cur.items++; cur.total += item.unitPriceStandard!;
        cur.avg = cur.total / cur.items;
        byCategory.set(cat, cur);
      }

      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      const catSummary = Object.fromEntries(byCategory);
      const totals = {
        economical: pricedItems.reduce((s, i) => s + (i.totalEconomical || 0), 0),
        standard: pricedItems.reduce((s, i) => s + (i.totalStandard || 0), 0),
        premium: pricedItems.reduce((s, i) => s + (i.totalPremium || 0), 0),
      };

      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 2048,
        system: `You are an expert Saudi Arabia (KSA) electrical cost auditor. Analyze project BOQ pricing for consistency, gaps, and systemic issues. Return ONLY JSON.`,
        messages: [{
          role: "user",
          content: `Audit this electrical project BOQ pricing summary.

Project: ${project?.name || projectId}, Region: ${project?.region || "riyadh"}
Total items: ${pricedItems.length}
Category breakdown: ${JSON.stringify(catSummary)}
Totals: Eco ${totals.economical.toFixed(0)}, Std ${totals.standard.toFixed(0)}, Prem ${totals.premium.toFixed(0)} SAR
Eco/Std ratio: ${(totals.economical/totals.standard).toFixed(2)}, Prem/Std ratio: ${(totals.premium/totals.standard).toFixed(2)}
SASO compliance: pass=${pricedItems.filter(i=>i.complianceStatus==='pass').length}, warn=${pricedItems.filter(i=>i.complianceStatus==='warning').length}, fail=${pricedItems.filter(i=>i.complianceStatus==='fail').length}

Return JSON with systemwide issues found (max 5):
[{
  "title": "issue title",
  "titleAr": "العنوان بالعربي",
  "severity": "info|warning|critical",
  "description": "detailed description",
  "descriptionAr": "الوصف التفصيلي",
  "recommendation": "action to take",
  "recommendationAr": "الإجراء المقترح"
}]
Return [] if no systemic issues found.`
        }],
      });

      const text = msg.content[0].type === "text" ? msg.content[0].text : "[]";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const sysIssues: Array<{
          title: string; titleAr?: string; severity?: string;
          description: string; descriptionAr?: string;
          recommendation?: string; recommendationAr?: string;
        }> = JSON.parse(jsonMatch[0]);

        for (const issue of sysIssues) {
          const sev = (["info","warning","critical"].includes(issue.severity || "")) ? issue.severity as ReviewSeverity : "info";
          reviews.push({
            projectId,
            agentId: "compliance_validator",
            agentName: "Consistency & Compliance Validator",
            reviewType: "systemic_issue",
            severity: sev,
            status: "pending",
            title: issue.title,
            titleAr: issue.titleAr,
            description: issue.description,
            descriptionAr: issue.descriptionAr,
            recommendation: issue.recommendation,
            recommendationAr: issue.recommendationAr,
          });
        }
      }
    } catch (err) {
      logger.error({ err }, "Agent 2 AI analysis failed");
    }
  }

  if (reviews.length > 0) {
    await db.insert(priceReviewsTable).values(reviews);
  }

  logger.info({ projectId, total: reviews.length }, "Agent 2 review complete");
  return { total: reviews.length, issues: reviews.filter(r => r.severity !== "info").length };
}
