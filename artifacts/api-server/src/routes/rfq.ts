import { Router } from "express";
import * as XLSX from "xlsx";
import { db } from "@workspace/db";
import { boqItemsTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetProjectParams } from "@workspace/api-zod";

const router = Router();

const DISCIPLINE_COLORS: Record<string, string> = {
  "Electrical": "1a3a5c",
  "Low Current": "1e4d2b",
  "Fire Alarm": "8b0000",
  "BMS": "4a0080",
  "Medical Gases": "004d66",
  "Mechanical": "4d2600",
  "General": "2c2c2c",
};

router.get("/projects/:id/report/rfq", async (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const discipline = (req.query.discipline as string) || "all";

  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) { res.status(404).json({ error: "Not found" }); return; }

    let items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, id));

    // Filter by discipline if requested
    if (discipline !== "all") {
      items = items.filter(i => (i.discipline || "General") === discipline);
    }

    // Only supply items (have supplyPrice or are equipment)
    const supplyItems = items.filter(i => i.unitPriceStandard || i.supplyPrice);

    if (supplyItems.length === 0) {
      res.status(400).json({ error: "No priced items found for RFQ" });
      return;
    }

    const wb = XLSX.utils.book_new();

    // ── Cover Sheet ───────────────────────────────────────────────────────────
    const coverRows = [
      [`طلب عروض أسعار | REQUEST FOR QUOTATION (RFQ)`],
      [],
      [`المشروع / Project:`, project.nameAr || project.name],
      [`الاسم الإنجليزي / English Name:`, project.name],
      [`المنطقة / Region:`, (project.region || "riyadh").toUpperCase()],
      [`التخصص / Discipline:`, discipline === "all" ? "جميع التخصصات / All Disciplines" : discipline],
      [`تاريخ الإصدار / Issue Date:`, new Date().toLocaleDateString("ar-SA")],
      [`صالح حتى / Valid Until:`, new Date(Date.now() + 30 * 86400000).toLocaleDateString("ar-SA")],
      [`إجمالي البنود / Total Items:`, supplyItems.length],
      [],
      [`تعليمات / Instructions:`],
      [`• يرجى تعبئة أسعار التوريد فقط (Supply Price) بدون تركيب`],
      [`• Please fill supply prices ONLY (excluding installation)`],
      [`• الأسعار بالريال السعودي شاملة التوصيل موقع المشروع`],
      [`• Prices in SAR, inclusive of delivery to project site`],
      [`• يجب ذكر الماركة والمصدر لكل بند`],
      [`• Brand and country of origin must be specified per item`],
      [`• صلاحية العرض 30 يوم من تاريخ الإصدار`],
      [`• Quotation validity: 30 days from issue date`],
      [`• المطابقة لمعايير SASO إلزامية`],
      [`• SASO compliance is mandatory`],
    ];
    const wsCover = XLSX.utils.aoa_to_sheet(coverRows);
    wsCover["!cols"] = [{ wch: 35 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsCover, "Cover | غلاف");

    // ── Full Material List ───────────────────────────────────────────────────
    const allHeaders = [
      "م\n#",
      "التخصص\nDiscipline",
      "القسم\nSection",
      "الوصف\nDescription",
      "المواصفة\nSpec / Model",
      "الوحدة\nUnit",
      "الكمية\nQty",
      "المورد المقترح\nSuggested Supplier",
      "سعر التوريد المرجعي\nRef. Supply Price (SAR)",
      "إجمالي مرجعي\nRef. Total (SAR)",
      "سعر المورد المقدم\nSupplier's Price (SAR)",
      "الإجمالي\nTotal (SAR)",
      "الماركة\nBrand",
      "بلد المنشأ\nCountry of Origin",
      "ضمان\nWarranty",
      "ملاحظات\nNotes",
    ];

    const allRows: unknown[][] = [
      [`قائمة المواد الكاملة | FULL MATERIAL LIST – ${project.nameAr || project.name}`],
      [`OUTLET formula: OUTLET(P) = Supply(Q) × (1+Wastage%) + Install(S) + Access(T) | هذا RFQ للتوريد فقط`],
      [],
      allHeaders,
    ];

    let rowNum = 1;
    for (const item of supplyItems) {
      allRows.push([
        rowNum++,
        item.discipline || "General",
        item.sectionName || item.categoryLevel1 || "",
        item.descriptionEn,
        item.notes?.slice(0, 60) || "",
        item.unit,
        item.quantity,
        item.supplierName || "",
        item.supplyPrice || (item.unitPriceStandard ? Math.round(item.unitPriceStandard * 0.75) : ""),
        item.supplyPrice ? Math.round(item.supplyPrice * item.quantity) : "",
        "",
        "",
        "",
        "KSA / International",
        "1 Year",
        item.complianceNotes?.slice(0, 60) || "",
      ]);
    }

    // Grand reference total
    const refTotal = supplyItems.reduce((s, i) => s + (i.supplyPrice || 0) * i.quantity, 0);
    allRows.push([]);
    allRows.push(["", "", "", "إجمالي أسعار التوريد المرجعية | Reference Supply Total", "", "", "", "", "", refTotal, "", "", "", "", "", ""]);

    const wsAll = XLSX.utils.aoa_to_sheet(allRows);
    wsAll["!cols"] = [
      { wch: 5 }, { wch: 14 }, { wch: 22 }, { wch: 45 }, { wch: 25 },
      { wch: 8 }, { wch: 8 }, { wch: 25 }, { wch: 20 }, { wch: 15 },
      { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsAll, "All Items | كل البنود");

    // ── Per-Supplier Sheets ──────────────────────────────────────────────────
    // Group by supplier (normalize supplier names)
    const supplierGroups: Record<string, typeof supplyItems> = {};
    for (const item of supplyItems) {
      const suppliers = (item.supplierName || "").split(/[/,|،]/).map(s => s.trim()).filter(Boolean);
      const primarySupplier = suppliers[0] || "غير محدد / Unspecified";
      if (!supplierGroups[primarySupplier]) supplierGroups[primarySupplier] = [];
      supplierGroups[primarySupplier].push(item);
    }

    for (const [supplier, sItems] of Object.entries(supplierGroups)) {
      const sheetName = supplier.replace(/[\\/*?[\]:]/g, "_").slice(0, 28);
      const supplierHeaders = [
        "م\n#",
        "التخصص\nDiscipline",
        "الوصف\nDescription",
        "المواصفة\nSpec",
        "الوحدة\nUnit",
        "الكمية\nQty",
        "سعر التوريد المرجعي\nRef. Supply (SAR/unit)",
        "إجمالي مرجعي\nRef. Total (SAR)",
        "سعر المورد\nYour Price (SAR/unit)",
        "إجمالي المورد\nYour Total (SAR)",
        "الماركة المقترحة\nBrand",
        "بلد المنشأ\nOrigin",
        "مدة التسليم\nLead Time",
        "ضمان\nWarranty",
        "ملاحظات\nNotes",
      ];

      const supplierRefTotal = sItems.reduce((s, i) => s + (i.supplyPrice || 0) * i.quantity, 0);

      const sRows: unknown[][] = [
        [`طلب عرض سعر | RFQ – ${supplier}`],
        [`المشروع: ${project.nameAr || project.name} | المنطقة: ${project.region?.toUpperCase()} | التاريخ: ${new Date().toLocaleDateString("ar-SA")}`],
        [`إجمالي البنود: ${sItems.length} | الإجمالي المرجعي: ${supplierRefTotal.toLocaleString()} SAR`],
        [],
        supplierHeaders,
        ...sItems.map((item, i) => [
          i + 1,
          item.discipline || "General",
          item.descriptionEn,
          item.notes?.slice(0, 50) || "",
          item.unit,
          item.quantity,
          item.supplyPrice || "",
          item.supplyPrice ? Math.round(item.supplyPrice * item.quantity) : "",
          "",
          "",
          supplier,
          "KSA / International",
          "4-8 Weeks",
          "1 Year",
          "",
        ]),
        [],
        ["", "", "الإجمالي المرجعي | Reference Total", "", "", "", "", supplierRefTotal, "", "", "", "", "", "", ""],
        [],
        ["توقيع المورد | Supplier Signature:", ""],
        ["اسم المفوض | Authorized Name:", ""],
        ["التاريخ | Date:", ""],
        ["الختم | Stamp:", ""],
      ];

      const wsSupplier = XLSX.utils.aoa_to_sheet(sRows);
      wsSupplier["!cols"] = [
        { wch: 5 }, { wch: 14 }, { wch: 45 }, { wch: 25 },
        { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 18 },
        { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 25 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSupplier, sheetName);
    }

    // ── Per-Discipline Summary Sheet ─────────────────────────────────────────
    const disciplines = [...new Set(supplyItems.map(i => i.discipline || "General"))];
    const discSummaryRows: unknown[][] = [
      [`ملخص التخصصات | Discipline Summary`],
      [],
      ["التخصص / Discipline", "عدد البنود / Items", "إجمالي التوريد المرجعي (SAR) / Ref. Supply Total", "نسبة / %"],
    ];

    const grandRefTotal = supplyItems.reduce((s, i) => s + (i.supplyPrice || 0) * i.quantity, 0);
    for (const disc of disciplines) {
      const discItems = supplyItems.filter(i => (i.discipline || "General") === disc);
      const discTotal = discItems.reduce((s, i) => s + (i.supplyPrice || 0) * i.quantity, 0);
      discSummaryRows.push([
        disc,
        discItems.length,
        discTotal,
        grandRefTotal > 0 ? `${((discTotal / grandRefTotal) * 100).toFixed(1)}%` : "0%",
      ]);
    }
    discSummaryRows.push([]);
    discSummaryRows.push(["الإجمالي / Total", supplyItems.length, grandRefTotal, "100%"]);

    const wsDiscSummary = XLSX.utils.aoa_to_sheet(discSummaryRows);
    wsDiscSummary["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 32 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsDiscSummary, "Discipline Summary");

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const fname = `RFQ-${(project.nameAr || project.name).replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_")}-${discipline}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    res.send(buf);
  } catch (err) {
    req.log.error({ err }, "Failed to generate RFQ");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Return list of disciplines + counts for a project
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

export default router;
