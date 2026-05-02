/**
 * Agent 11 — Procurement & Supplier Grouping
 * Groups BOQ items by supplier/brand, calculates bulk discounts, identifies long-lead items.
 * Pure logic — no AI needed.
 */
import { db } from "@workspace/db";
import { boqItemsTable, procurementTable, procurementSummaryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

interface SupplierGroup {
  supplierName: string;
  supplierNameAr: string;
  category: string;
  items: Array<{ id: number; desc: string; qty: number; unitPrice: number; total: number }>;
  totalSupplySar: number;
  bulkDiscountPct: number;
  leadTimeDays: number;
  importRequired: boolean;
  localAvailability: boolean;
}

// Supplier catalog: brand → supplier info
const SUPPLIER_MAP: Record<string, { supplier: string; supplierAr: string; leadDays: number; local: boolean; import: boolean }> = {
  "schneider":  { supplier: "Schneider Electric KSA", supplierAr: "شنايدر إلكتريك السعودية", leadDays: 14, local: true, import: false },
  "abb":        { supplier: "ABB Saudi Arabia", supplierAr: "ABB السعودية", leadDays: 21, local: true, import: false },
  "legrand":    { supplier: "Legrand KSA", supplierAr: "ليجراند السعودية", leadDays: 14, local: true, import: false },
  "philips":    { supplier: "Signify (Philips) KSA", supplierAr: "سيجنيفاي فيليبس السعودية", leadDays: 10, local: true, import: false },
  "siemens":    { supplier: "Siemens KSA", supplierAr: "سيمنز السعودية", leadDays: 30, local: true, import: false },
  "hager":      { supplier: "Hager Middle East", supplierAr: "هاجر الشرق الأوسط", leadDays: 21, local: false, import: true },
  "prysmian":   { supplier: "Prysmian / Saudi Cable", supplierAr: "برايسميان / كابل سعودي", leadDays: 7, local: true, import: false },
  "nexans":     { supplier: "Nexans (Saudi Cable)", supplierAr: "نيكسانس / كابل سعودي", leadDays: 7, local: true, import: false },
  "saudi cable":{ supplier: "Saudi Cable Company", supplierAr: "شركة كابل سعودي", leadDays: 5, local: true, import: false },
  "honeywell":  { supplier: "Honeywell KSA", supplierAr: "هانيويل السعودية", leadDays: 30, local: true, import: false },
  "siemens fire":{ supplier: "Siemens Building Tech", supplierAr: "سيمنز تقنيات البناء", leadDays: 45, local: false, import: true },
  "hochiki":    { supplier: "Hochiki Middle East", supplierAr: "هوشيكي الشرق الأوسط", leadDays: 21, local: false, import: true },
  "osram":      { supplier: "Osram / Ledvance KSA", supplierAr: "أوسرام / ليدفانس", leadDays: 14, local: true, import: false },
  "cummins":    { supplier: "Cummins Power KSA", supplierAr: "كامنز للطاقة السعودية", leadDays: 60, local: true, import: true },
  "apc":        { supplier: "APC by Schneider", supplierAr: "APC شنايدر", leadDays: 21, local: true, import: false },
  "generic":    { supplier: "Local Trading Companies", supplierAr: "شركات التجارة المحلية", leadDays: 3, local: true, import: false },
  "default":    { supplier: "Local Distributor", supplierAr: "موزع محلي", leadDays: 7, local: true, import: false },
};

function identifySupplier(brand?: string | null, category?: string | null): typeof SUPPLIER_MAP[string] {
  if (!brand) return SUPPLIER_MAP.default;
  const b = brand.toLowerCase();
  for (const [key, val] of Object.entries(SUPPLIER_MAP)) {
    if (b.includes(key)) return val;
  }
  return SUPPLIER_MAP.default;
}

function getBulkDiscount(totalSar: number): number {
  if (totalSar >= 500000) return 12;
  if (totalSar >= 200000) return 8;
  if (totalSar >= 100000) return 5;
  if (totalSar >= 50000)  return 3;
  if (totalSar >= 20000)  return 2;
  return 0;
}

const CATEGORY_SUPPLIER_MAP: Record<string, string> = {
  "Cables & Wiring": "Saudi Cable Company",
  "Panels & Distribution": "Schneider Electric KSA",
  "Lighting": "Signify (Philips) KSA",
  "Fire Alarm": "Hochiki Middle East",
  "CCTV & Security": "Hikvision / Axis Distributor",
  "Data & Network": "FINOSEL / Panduit Distributor",
};

export async function runProcurementPlanning(projectId: number): Promise<object> {
  logger.info({ projectId }, "Agent 11: Procurement planning starting");

  const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, projectId));
  const pricedItems = items.filter(i => i.unitPriceStandard && i.unitPriceStandard > 0 && i.totalPriceStandard);

  // Group by supplier
  const groups = new Map<string, SupplierGroup>();

  for (const item of pricedItems) {
    const supplierInfo = identifySupplier(item.brand, item.categoryLevel1);
    const key = `${supplierInfo.supplier}::${item.categoryLevel1 || "General"}`;

    if (!groups.has(key)) {
      groups.set(key, {
        supplierName: supplierInfo.supplier,
        supplierNameAr: supplierInfo.supplierAr,
        category: item.categoryLevel1 || "General",
        items: [],
        totalSupplySar: 0,
        bulkDiscountPct: 0,
        leadTimeDays: supplierInfo.leadDays,
        importRequired: supplierInfo.import,
        localAvailability: supplierInfo.local,
      });
    }

    const g = groups.get(key)!;
    const supplyOnly = (item.totalPriceStandard || 0) * 0.65; // ~65% of total is supply
    g.items.push({ id: item.id, desc: item.descriptionEn.slice(0, 100), qty: item.quantity, unitPrice: item.unitPriceStandard || 0, total: item.totalPriceStandard || 0 });
    g.totalSupplySar += supplyOnly;
  }

  // Calculate bulk discounts
  for (const [, g] of groups) {
    g.bulkDiscountPct = getBulkDiscount(g.totalSupplySar);
  }

  // Persist
  await db.delete(procurementTable).where(eq(procurementTable.projectId, projectId));
  await db.delete(procurementSummaryTable).where(eq(procurementSummaryTable.projectId, projectId));

  const groupArr = Array.from(groups.values());
  const totalSupplySar = groupArr.reduce((s, g) => s + g.totalSupplySar, 0);
  const totalBulkSavings = groupArr.reduce((s, g) => s + g.totalSupplySar * g.bulkDiscountPct / 100, 0);
  const localPct = groupArr.filter(g => g.localAvailability).reduce((s, g) => s + g.totalSupplySar, 0) / Math.max(totalSupplySar, 1) * 100;
  const importItems = groupArr.filter(g => g.importRequired);

  for (const g of groupArr) {
    await db.insert(procurementTable).values({
      projectId,
      supplierName: g.supplierName,
      supplierNameAr: g.supplierNameAr,
      category: g.category,
      itemCount: g.items.length,
      totalSupplySar: Math.round(g.totalSupplySar),
      bulkDiscountPct: g.bulkDiscountPct,
      bulkDiscountSar: Math.round(g.totalSupplySar * g.bulkDiscountPct / 100),
      leadTimeDays: g.leadTimeDays,
      localAvailability: g.localAvailability,
      importRequired: g.importRequired,
      items: g.items.slice(0, 20),
      paymentTerms: g.totalSupplySar > 100000 ? "30% advance, 40% delivery, 30% completion" : "50% advance, 50% delivery",
      recommendationAr: g.bulkDiscountPct > 0
        ? `طلب خصم نقدي ${g.bulkDiscountPct}% عند طلب إجمالي ${Math.round(g.totalSupplySar).toLocaleString()} ريال من ${g.supplierNameAr}`
        : `التنسيق مع ${g.supplierNameAr} لضمان توفر المواد في الوقت المحدد`,
      priority: g.leadTimeDays > 30 ? "high" : g.leadTimeDays > 14 ? "normal" : "low",
    });
  }

  const [summary] = await db.insert(procurementSummaryTable).values({
    projectId,
    totalSupplierCount: groupArr.length,
    totalSupplySar: Math.round(totalSupplySar),
    totalBulkSavingsSar: Math.round(totalBulkSavings),
    localPct: Math.round(localPct),
    importPct: Math.round(100 - localPct),
    criticalLeadItems: importItems.map(g => ({ supplier: g.supplierName, category: g.category, leadDays: g.leadTimeDays })),
    procurementPlanAr: `خطة الشراء: ${groupArr.length} مورد رئيسي، توفير محتمل بالشراء بالجملة ${Math.round(totalBulkSavings).toLocaleString()} ريال. ${importItems.length > 0 ? `تنبيه: ${importItems.length} مورد يحتاج استيراد — يجب بدء الطلب مبكراً.` : "معظم المواد متوفرة محلياً."}`,
    procurementPlan: `Procurement: ${groupArr.length} suppliers identified. Bulk discount opportunity: SAR ${Math.round(totalBulkSavings).toLocaleString()}. ${importItems.length > 0 ? `${importItems.length} import items require early ordering.` : "Most items locally available."}`,
  }).returning();

  logger.info({ projectId, supplierCount: groupArr.length, totalBulkSavings }, "Agent 11 procurement planning complete");
  return { summary, groups: groupArr.length };
}
