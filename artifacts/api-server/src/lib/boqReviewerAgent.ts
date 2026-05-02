/**
 * Agent 17 — BOQ Technical Reviewer
 * Reviews the formatted BOQ for quality, completeness, and technical accuracy.
 * Scores the document and generates professional review notes.
 */
import { db } from "@workspace/db";
import { boqItemsTable, boqDocumentsTable, priceReviewsTable, scopeGapsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { anthropic } from "@workspace/integrations-anthropic-ai";

interface ReviewIssue {
  severity: "critical" | "warning" | "info";
  category: string;
  issueEn: string;
  issueAr: string;
  recommendation: string;
  recommendationAr: string;
}

export async function runBoqReview(projectId: number): Promise<object> {
  logger.info({ projectId }, "Agent 17: BOQ Technical Reviewer starting");

  const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, projectId));
  const pricedItems = items.filter(i => i.unitPriceStandard && i.unitPriceStandard > 0);

  if (pricedItems.length === 0) return { error: "No priced items to review" };

  // Get existing reviews and gaps for context
  const existingReviews = await db.select().from(priceReviewsTable).where(eq(priceReviewsTable.projectId, projectId));
  const scopeGaps = await db.select().from(scopeGapsTable).where(eq(scopeGapsTable.projectId, projectId));

  const issues: ReviewIssue[] = [];
  let qualityScore = 100;

  // ── Check 1: Confidence scores ──────────────────────────────────────────
  const lowConfidence = pricedItems.filter(i => (i.confidenceScore || 0) < 0.7);
  if (lowConfidence.length > pricedItems.length * 0.2) {
    issues.push({
      severity: "warning",
      category: "Confidence",
      issueEn: `${lowConfidence.length} items (${Math.round(lowConfidence.length / pricedItems.length * 100)}%) have confidence below 70%.`,
      issueAr: `${lowConfidence.length} بند (${Math.round(lowConfidence.length / pricedItems.length * 100)}%) بثقة تسعير أقل من 70%`,
      recommendation: "Review and manually verify low-confidence items before submission.",
      recommendationAr: "مراجعة وتحقق يدوي من البنود منخفضة الثقة قبل التقديم.",
    });
    qualityScore -= 10;
  }

  // ── Check 2: SASO compliance ─────────────────────────────────────────────
  const sasoFail = pricedItems.filter(i => i.sasoCompliance === "fail");
  if (sasoFail.length > 0) {
    issues.push({
      severity: "critical",
      category: "SASO Compliance",
      issueEn: `${sasoFail.length} items fail SASO compliance requirements.`,
      issueAr: `${sasoFail.length} بند لا يستوفي متطلبات المعايير السعودية SASO.`,
      recommendation: "Replace non-compliant items with SASO-approved alternatives before BOQ submission.",
      recommendationAr: "استبدال البنود غير المتوافقة ببدائل معتمدة SASO قبل تقديم المقايسة.",
    });
    qualityScore -= 20;
  }

  // ── Check 3: Missing descriptions ────────────────────────────────────────
  const missingAr = pricedItems.filter(i => !i.descriptionAr || i.descriptionAr.trim().length < 5);
  if (missingAr.length > pricedItems.length * 0.3) {
    issues.push({
      severity: "warning",
      category: "Descriptions",
      issueEn: `${missingAr.length} items lack Arabic descriptions.`,
      issueAr: `${missingAr.length} بند بدون وصف عربي`,
      recommendation: "Add Arabic descriptions for bilingual BOQ compliance in KSA.",
      recommendationAr: "إضافة أوصاف عربية لاستيفاء متطلبات المقايسة ثنائية اللغة في السعودية.",
    });
    qualityScore -= 8;
  }

  // ── Check 4: Scope gaps unresolved ──────────────────────────────────────
  const criticalGaps = scopeGaps.filter(g => g.riskLevel === "critical");
  if (criticalGaps.length > 0) {
    issues.push({
      severity: "critical",
      category: "Scope Completeness",
      issueEn: `${criticalGaps.length} critical scope gaps identified (missing required systems).`,
      issueAr: `${criticalGaps.length} فجوة حرجة في نطاق العمل (أنظمة مطلوبة مفقودة)`,
      recommendation: "Add missing critical systems before BOQ finalization. Critical gaps may violate KSA/SEC requirements.",
      recommendationAr: "إضافة الأنظمة الحرجة المفقودة قبل اعتماد المقايسة. الفجوات الحرجة قد تخالف متطلبات SEC.",
    });
    qualityScore -= 15;
  }

  // ── Check 5: Price reviews pending ──────────────────────────────────────
  const pendingCritical = existingReviews.filter(r => r.severity === "critical" && r.status === "pending");
  if (pendingCritical.length > 0) {
    issues.push({
      severity: "critical",
      category: "Price Review",
      issueEn: `${pendingCritical.length} critical price review findings still pending resolution.`,
      issueAr: `${pendingCritical.length} ملاحظة حرجة في مراجعة الأسعار لم تُعالج بعد`,
      recommendation: "Resolve all critical price review findings before BOQ submission.",
      recommendationAr: "معالجة جميع الملاحظات الحرجة في مراجعة الأسعار قبل تقديم المقايسة.",
    });
    qualityScore -= 12;
  }

  // ── Check 6: Units completeness ──────────────────────────────────────────
  const noUnit = pricedItems.filter(i => !i.unit || i.unit.trim() === "");
  if (noUnit.length > 0) {
    issues.push({
      severity: "warning",
      category: "Units",
      issueEn: `${noUnit.length} items missing unit of measurement.`,
      issueAr: `${noUnit.length} بند بدون وحدة قياس`,
      recommendation: "Assign units to all items for professional BOQ format.",
      recommendationAr: "تحديد وحدة القياس لجميع البنود للحصول على مقايسة احترافية.",
    });
    qualityScore -= 5;
  }

  // ── Check 7: Zero-quantity items ─────────────────────────────────────────
  const zeroQty = items.filter(i => !i.quantity || i.quantity <= 0);
  if (zeroQty.length > 0) {
    issues.push({
      severity: "warning",
      category: "Quantities",
      issueEn: `${zeroQty.length} items have zero or missing quantities.`,
      issueAr: `${zeroQty.length} بند بكمية صفرية أو مفقودة`,
      recommendation: "Verify and correct all quantities.",
      recommendationAr: "التحقق من جميع الكميات وتصحيحها.",
    });
    qualityScore -= 5;
  }

  qualityScore = Math.max(0, Math.min(100, qualityScore));

  // ── AI Review Summary ─────────────────────────────────────────────────────
  let aiReviewNotesAr = "";
  try {
    const totalStd = pricedItems.reduce((s, i) => s + (i.totalPriceStandard || 0), 0);
    const cats = [...new Set(pricedItems.map(i => i.categoryLevel1).filter(Boolean))];

    const prompt = `You are a senior KSA electrical engineer reviewing a BOQ.

BOQ Summary:
- Total items: ${pricedItems.length}
- Total value: SAR ${Math.round(totalStd).toLocaleString()}
- Categories: ${cats.join(", ")}
- Quality score: ${qualityScore}/100
- Issues found: ${issues.length} (${issues.filter(i => i.severity === "critical").length} critical)

Write a professional review summary in Arabic (100-150 words) covering:
1. Overall quality assessment
2. Key strengths
3. Areas needing attention
4. Recommendation (approve/conditional/reject)

Be specific and professional.`;

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    aiReviewNotesAr = msg.content[0].type === "text" ? msg.content[0].text : "";
  } catch (e) {
    logger.warn({ err: e }, "Agent 17: AI review failed, using score-based summary");
    aiReviewNotesAr = qualityScore >= 85
      ? `مراجعة المقايسة: النتيجة الإجمالية ${qualityScore}/100 — ممتازة. المقايسة جاهزة للتقديم مع ملاحظات بسيطة. تم إعداد الوثيقة وفق المتطلبات المهنية للسوق السعودي.`
      : qualityScore >= 70
      ? `مراجعة المقايسة: النتيجة الإجمالية ${qualityScore}/100 — جيدة مع تحفظات. يُوصى بمعالجة الملاحظات الحرجة قبل التقديم النهائي.`
      : `مراجعة المقايسة: النتيجة الإجمالية ${qualityScore}/100 — تحتاج مراجعة. وُجدت ${issues.filter(i => i.severity === "critical").length} ملاحظات حرجة تستوجب المعالجة قبل التقديم.`;
  }

  // Determine review status
  const hasCritical = issues.some(i => i.severity === "critical");
  const reviewStatus = qualityScore >= 85 ? "approved" : qualityScore >= 65 ? "conditional" : "needs_revision";

  // Update BOQ document with review
  const docs = await db.select().from(boqDocumentsTable).where(eq(boqDocumentsTable.projectId, projectId));
  if (docs.length > 0) {
    await db.update(boqDocumentsTable).set({
      reviewStatus,
      reviewNotesAr: aiReviewNotesAr,
      qualityScore,
      issuesFound: issues,
      isApproved: reviewStatus === "approved",
      updatedAt: new Date(),
    }).where(eq(boqDocumentsTable.id, docs[0].id));
  }

  logger.info({ projectId, qualityScore, issues: issues.length, reviewStatus }, "Agent 17: BOQ Review complete");
  return {
    qualityScore,
    reviewStatus,
    totalIssues: issues.length,
    critical: issues.filter(i => i.severity === "critical").length,
    warnings: issues.filter(i => i.severity === "warning").length,
    issues,
    reviewNotesAr: aiReviewNotesAr,
  };
}
