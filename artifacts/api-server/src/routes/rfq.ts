import { Router } from "express";
import * as XLSX from "xlsx";
import { db } from "@workspace/db";
import { boqItemsTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetProjectParams } from "@workspace/api-zod";
import { lookupKsaPrice, getBrandsByCategory, isInstallationItem, normalizeUnit, KSA_MARKET_PRICES } from "../lib/ksaMarketPrices.js";

const router = Router();

// ── Arabic description mapping for common categories ─────────────────────────
const ARABIC_CAT: Record<string, string> = {
  "Cables & Wiring": "كابلات وأسلاك",
  "Conduits & Trunking": "مواسير وقنوات كابلات",
  "Wiring Devices": "مفاتيح ومقابس",
  "Lighting": "إضاءة",
  "Protection Devices": "أجهزة حماية",
  "Panels & Distribution": "لوحات التوزيع",
  "Earthing & Bonding": "تأريض وربط",
  "Fire Alarm": "إنذار الحريق",
  "Public Address": "الإذاعة والإخلاء",
  "CCTV & Security": "كاميرات المراقبة",
  "Access Control": "التحكم بالدخول",
  "BMS & Automation": "BMS والتشغيل الآلي",
  "Data & Network": "شبكات البيانات",
  "Power Systems": "أنظمة الطاقة",
  "Transformers": "المحولات الكهربائية",
  "Medical Systems": "الأنظمة الطبية",
  "Clock Systems": "أنظمة المواقيت",
  "AV & Signage": "الشاشات والإعلانات",
  "General Electrical": "أعمال كهربائية عامة",
};

// ── Arabic description from DB item ─────────────────────────────────────────
function buildArabicNote(item: { descriptionEn: string; descriptionAr?: string | null; categoryLevel1?: string | null; sectionName?: string | null }): string {
  if (item.descriptionAr) return item.descriptionAr;
  // Lookup from market DB
  const match = lookupKsaPrice(item.descriptionEn, item.categoryLevel1 || "");
  if (match?.descAr) return match.descAr;
  // Category fallback
  const catAr = ARABIC_CAT[item.categoryLevel1 || ""] || "بند كهربائي";
  return catAr;
}

// ── Main RFQ report endpoint ─────────────────────────────────────────────────
router.get("/projects/:id/report/rfq", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const discipline = (req.query.discipline as string) || "all";

  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) { res.status(404).json({ error: "Not found" }); return; }

    let items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, id));
    if (discipline !== "all") {
      items = items.filter(i => (i.discipline || "General") === discipline);
    }

    const supplyItems = items.filter(i => i.unitPriceStandard || i.supplyPrice);
    if (supplyItems.length === 0) {
      res.status(400).json({ error: "No priced items found for RFQ" });
      return;
    }

    const wb = XLSX.utils.book_new();
    const issueDate = new Date().toLocaleDateString("ar-SA-u-nu-latn");
    const validDate = new Date(Date.now() + 30 * 86400000).toLocaleDateString("ar-SA-u-nu-latn");

    // ── Cover Sheet ──────────────────────────────────────────────────────────
    const coverRows = [
      [`طلب عروض أسعار – Request for Quotation (RFQ)`],
      [],
      [`المشروع / Project:`, project.nameAr || project.name],
      [`الاسم الإنجليزي:`, project.name],
      [`المنطقة / Region:`, (project.region || "riyadh").toUpperCase()],
      [`التخصص / Discipline:`, discipline === "all" ? "جميع التخصصات" : discipline],
      [`تاريخ الإصدار / Issue Date:`, issueDate],
      [`صالح حتى / Valid Until:`, validDate],
      [`إجمالي البنود / Total Items:`, supplyItems.length],
      [],
      [`تعليمات المورد – Supplier Instructions:`],
      [`• يرجى تعبئة أسعار التوريد فقط (Unit Price SAR) — التركيب ليس مطلوباً`],
      [`• Please fill Supply Price ONLY (Unit Price SAR) — installation NOT required`],
      [`• الأسعار بالريال السعودي شاملة التوصيل إلى موقع المشروع`],
      [`• Prices in SAR, inclusive of delivery to project site`],
      [`• يجب تحديد الماركة وبلد المنشأ لكل بند / Brand & Country of Origin required per item`],
      [`• LS. = مبلغ مقطوع (Lump Sum) — NO. = عدد (Each/Piece) — m = متر طولي`],
      [`• صلاحية العرض 30 يوم / Validity: 30 days from issue date`],
      [`• المطابقة لمعايير SASO إلزامية / SASO compliance is mandatory`],
    ];
    const wsCover = XLSX.utils.aoa_to_sheet(coverRows);
    wsCover["!cols"] = [{ wch: 40 }, { wch: 65 }];
    XLSX.utils.book_append_sheet(wb, wsCover, "Cover | غلاف");

    // ── Full Material List Sheet (normalized RFQ format per SKILL.md) ────────
    const RFQ_COLS = [
      "م\nLine Item No.",
      "الوصف\nDescription of Goods / Services",
      "الماركة\nBrand",
      "وحدة\nUnit",
      "الكمية\nQty",
      "سعر الوحدة (SAR)\nUnit Price (SAR)",
      "الإجمالي (SAR)\nTotal Price (SAR)",
      "تاريخ التسليم\nAvailability Date",
      "ملاحظات (بالعربي)",
    ];

    const allRows: unknown[][] = [
      [`قائمة المواد الكاملة – Full Material List | ${project.nameAr || project.name}`],
      [`OUTLET(P) = Supply(Q) × (1+Wastage%) + Install(S) + Access(T) | هذا RFQ للتوريد فقط — التركيب منفصل`],
      [`التخصص: ${discipline === "all" ? "جميع التخصصات" : discipline} | إجمالي البنود: ${supplyItems.length}`],
      [],
      RFQ_COLS,
    ];

    let rowNum = 1;
    for (const item of supplyItems) {
      const match = lookupKsaPrice(item.descriptionEn, item.categoryLevel1 || "");
      const brandInfo = match
        ? { brands: match.brands, brandAr: match.brandAr }
        : isInstallationItem(item.descriptionEn)
          ? { brands: "System Integrator (Contractor)", brandAr: "متعهد تركيب" }
          : getBrandsByCategory(item.categoryLevel1);

      const refSupply = item.supplyPrice
        || (match ? match.supplyStd : null)
        || (item.unitPriceStandard ? Math.round(item.unitPriceStandard * 0.72) : null);

      allRows.push([
        rowNum++,
        item.descriptionEn,
        brandInfo.brands,
        normalizeUnit(item.unit),
        item.quantity,
        "",                      // Unit Price — blank for supplier
        "",                      // Total — blank for supplier
        "",                      // Availability date — blank for supplier
        buildArabicNote(item),
      ]);
    }

    // Reference totals as comment row
    const refTotal = supplyItems.reduce((s, i) => s + (i.supplyPrice || 0) * i.quantity, 0);
    if (refTotal > 0) {
      allRows.push([]);
      allRows.push(["", "الإجمالي المرجعي / Reference Total (for guidance only)", "", "", "", refTotal.toLocaleString() + " SAR", "", "", "مرجعي فقط – يُعبأ من المورد"]);
    }

    const wsAll = XLSX.utils.aoa_to_sheet(allRows);
    wsAll["!cols"] = [{ wch: 6 }, { wch: 50 }, { wch: 28 }, { wch: 8 }, { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, wsAll, "All Items | كل البنود");

    // ── Per-Supplier Sheets ──────────────────────────────────────────────────
    const supplierGroups: Record<string, typeof supplyItems> = {};
    for (const item of supplyItems) {
      const primarySupplier = (item.supplierName || "")
        .split(/[/,|،]/).map(s => s.trim()).filter(Boolean)[0] || "غير محدد";
      if (!supplierGroups[primarySupplier]) supplierGroups[primarySupplier] = [];
      supplierGroups[primarySupplier].push(item);
    }

    for (const [supplier, sItems] of Object.entries(supplierGroups)) {
      const sheetName = supplier.replace(/[\\/*?[\]:]/g, "_").slice(0, 28);
      const sRows: unknown[][] = [
        [`طلب عرض سعر – RFQ للمورد: ${supplier}`],
        [`المشروع: ${project.nameAr || project.name} | المنطقة: ${(project.region || "").toUpperCase()} | التاريخ: ${issueDate}`],
        [`عدد البنود: ${sItems.length} | صالح حتى: ${validDate}`],
        [`تعليمات: يُرجى تعبئة خانتَي "سعر الوحدة" و"تاريخ التسليم" فقط`],
        [],
        RFQ_COLS,
      ];

      let sNum = 1;
      for (const item of sItems) {
        const match = lookupKsaPrice(item.descriptionEn, item.categoryLevel1 || "");
        const brandInfo = match
          ? { brands: match.brands, brandAr: match.brandAr }
          : isInstallationItem(item.descriptionEn)
            ? { brands: "System Integrator (Contractor)", brandAr: "متعهد تركيب" }
            : getBrandsByCategory(item.categoryLevel1);

        sRows.push([
          sNum++,
          item.descriptionEn,
          brandInfo.brands,
          normalizeUnit(item.unit),
          item.quantity,
          "",   // Unit Price — supplier fills
          "",   // Total — supplier fills
          "",   // Availability — supplier fills
          buildArabicNote(item),
        ]);
      }

      sRows.push([]);
      sRows.push(["", "", "", "", "", "", "", "", ""]);
      sRows.push(["توقيع المورد / Supplier Signature:", "", "", "اسم المفوض / Authorized Name:", "", "", "التاريخ / Date:", "", ""]);
      sRows.push(["الختم / Stamp:", "", "", "الهاتف / Tel:", "", "", "الإيميل / Email:", "", ""]);

      const wsS = XLSX.utils.aoa_to_sheet(sRows);
      wsS["!cols"] = [{ wch: 6 }, { wch: 50 }, { wch: 28 }, { wch: 8 }, { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(wb, wsS, sheetName);
    }

    // ── Per-Discipline Summary ───────────────────────────────────────────────
    const disciplines = [...new Set(supplyItems.map(i => i.discipline || "General"))];
    const discRows: unknown[][] = [
      [`ملخص التخصصات – Discipline Summary`],
      [],
      ["التخصص / Discipline", "عدد البنود / Items", "إجمالي مرجعي (SAR) / Ref. Total", "نسبة / %"],
    ];
    const grandRef = supplyItems.reduce((s, i) => s + (i.supplyPrice || 0) * i.quantity, 0);
    for (const disc of disciplines) {
      const dItems = supplyItems.filter(i => (i.discipline || "General") === disc);
      const dTotal = dItems.reduce((s, i) => s + (i.supplyPrice || 0) * i.quantity, 0);
      discRows.push([disc, dItems.length, dTotal, grandRef > 0 ? `${((dTotal / grandRef) * 100).toFixed(1)}%` : "–"]);
    }
    discRows.push([], ["الإجمالي / Total", supplyItems.length, grandRef, "100%"]);
    const wsDisc = XLSX.utils.aoa_to_sheet(discRows);
    wsDisc["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 28 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsDisc, "Discipline Summary");

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const fname = `RFQ-${(project.nameAr || project.name).replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_").slice(0, 40)}-${discipline}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fname)}"`);
    res.send(buf);
  } catch (err) {
    req.log.error({ err }, "Failed to generate RFQ");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Disciplines count for a project ─────────────────────────────────────────
router.get("/projects/:id/disciplines", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, id));
    const counts: Record<string, { count: number; priced: number; total: number }> = {};
    for (const item of items) {
      const d = item.discipline || "General";
      if (!counts[d]) counts[d] = { count: 0, priced: 0, total: 0 };
      counts[d].count++;
      if (item.unitPriceStandard) { counts[d].priced++; counts[d].total += (item.totalStandard || 0); }
    }
    res.json(counts);
  } catch (err) {
    req.log.error({ err }, "Failed to get disciplines");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Split project by discipline into sub-projects ────────────────────────────
router.post("/projects/:id/split-by-discipline", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) { res.status(404).json({ error: "Not found" }); return; }

    const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, id));

    // Group items by discipline
    const disciplineGroups: Record<string, typeof items> = {};
    for (const item of items) {
      const d = item.discipline || "General";
      if (!disciplineGroups[d]) disciplineGroups[d] = [];
      disciplineGroups[d].push(item);
    }

    const disciplines = Object.keys(disciplineGroups);
    if (disciplines.length <= 1) {
      res.status(400).json({ error: "المقايسة تحتوي على تخصص واحد فقط ولا تحتاج فصل" });
      return;
    }

    const createdProjects: Array<{ id: number; name: string; discipline: string; itemCount: number }> = [];

    for (const discipline of disciplines) {
      const discItems = disciplineGroups[discipline];
      if (discItems.length === 0) continue;

      // Create sub-project
      const subName = `${project.name} – ${discipline}`;
      const subNameAr = `${project.nameAr || project.name} – ${discipline}`;

      const [subProject] = await db.insert(projectsTable).values({
        name: subName,
        nameAr: subNameAr,
        region: project.region,
        status: project.status === "completed" || project.status === "reviewing" ? "reviewing" : "draft",
        totalItems: discItems.length,
        pricedItems: discItems.filter(i => i.unitPriceStandard).length,
        reviewItems: discItems.filter(i => i.needsReview).length,
      }).returning();

      // Copy items to sub-project
      const insertPayload = discItems.map(item => {
        const { id: _id, createdAt: _c, updatedAt: _u, projectId: _p, ...rest } = item;
        return { ...rest, projectId: subProject.id };
      });

      await db.insert(boqItemsTable).values(insertPayload);
      createdProjects.push({ id: subProject.id, name: subName, discipline, itemCount: discItems.length });
    }

    res.json({
      success: true,
      message: `تم إنشاء ${createdProjects.length} مشاريع فرعية`,
      projects: createdProjects,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to split project");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── KSA Market Prices reference list ────────────────────────────────────────
router.get("/market-prices", async (req, res) => {
  const category = req.query.category as string | undefined;
  const search = (req.query.search as string || "").toLowerCase();
  let list = KSA_MARKET_PRICES;
  if (category) list = list.filter(i => i.category === category);
  if (search) list = list.filter(i => i.descAr.includes(search) || i.keywords.some(k => k.includes(search)));
  res.json(list.map(i => ({
    keywords: i.keywords.slice(0, 2),
    unit: i.unit,
    supplyMin: i.supplyMin,
    supplyStd: i.supplyStd,
    supplyPremium: i.supplyPremium,
    brands: i.brands,
    brandAr: i.brandAr,
    descAr: i.descAr,
    category: i.category,
  })));
});

export default router;
