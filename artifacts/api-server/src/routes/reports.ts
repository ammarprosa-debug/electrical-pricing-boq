import { Router } from "express";
import * as XLSX from "xlsx";
import { db } from "@workspace/db";
import { boqItemsTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DownloadExcelReportParams, DownloadPdfReportParams } from "@workspace/api-zod";

const router = Router();

router.get("/projects/:id/report/excel", async (req, res) => {
  const { id } = DownloadExcelReportParams.parse(req.params);
  const scenario = (req.query.scenario as string) || "standard";
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, id));

    const priceKey = scenario === "economical" ? "unitPriceEconomical" : scenario === "premium" ? "unitPricePremium" : "unitPriceStandard";
    const totalKey = scenario === "economical" ? "totalEconomical" : scenario === "premium" ? "totalPremium" : "totalStandard";

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: BOQ Pricing (professional format) ──────────────────────────
    const boqHeaders = [
      "م\nBOQ#",
      "القسم\nSECTION",
      "الوصف\nDESCRIPTION",
      "الوحدة\nUNIT",
      "الكمية\nQTY",
      "التوريد (Q)\nSUPPLY (SAR)",
      "الهالك%\nWASTAGE%",
      "التركيب (S)\nINSTALL (SAR)",
      "الاكسسوارات (T)\nACCESS (SAR)",
      "سعر المخرج (P)\nOUTLET (SAR)",
      "اقتصادي\nECONOMICAL",
      "معياري\nSTANDARD",
      "متميز\nPREMIUM",
      "الإجمالي المعياري\nSTD TOTAL",
      "المورد الموصى به\nSUPPLIER",
      "مصنعية التركيب\nLABOR",
      "ضريبة VAT\nVAT 15%",
      "امتثال SASO",
      "مستوى الثقة",
      "ملاحظات\nNOTES",
    ];

    const boqRows: unknown[][] = [
      [`مقايسة أعمال الكهرباء | ${project.nameAr || project.name} | ${project.region?.toUpperCase()} | 2026`],
      [`OUTLET(P) = Supply(Q) × (1 + Wastage%) + Install(S) + Access(T) | VAT 15% | SASO Compliant`],
      [],
      boqHeaders,
    ];

    // Group by section
    const sections: Record<string, typeof items> = {};
    items.forEach(item => {
      const key = item.sectionName || item.categoryLevel1 || "General";
      if (!sections[key]) sections[key] = [];
      sections[key].push(item);
    });

    let rowNum = 1;
    for (const [section, secItems] of Object.entries(sections)) {
      // Section header row
      boqRows.push([`◈  ${section}`, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);

      for (const item of secItems) {
        const supply = item.supplyPrice || 0;
        const wastage = item.wastagePercent || 1;
        const install = item.installCost || 0;
        const access = item.accessCost || 0;
        const outlet = supply > 0 ? Math.ceil(supply * (1 + wastage / 100) + install + access) : (item[priceKey] || 0);

        boqRows.push([
          rowNum++,
          section,
          item.descriptionEn,
          item.unit,
          item.quantity,
          supply || "",
          supply > 0 ? `${wastage}%` : "",
          install || "",
          access || "",
          outlet || item[priceKey] || "",
          item.unitPriceEconomical || "",
          item.unitPriceStandard || "",
          item.unitPricePremium || "",
          item[totalKey] || 0,
          item.supplierName || "",
          item.laborCost || "",
          item.vatAmount || "",
          item.complianceStatus || "pending",
          item.confidenceScore ? `${item.confidenceScore}%` : "",
          item.notes || item.complianceNotes || "",
        ]);
      }

      // Section subtotal row
      const secTotal = secItems.reduce((s, i) => s + (i[totalKey] || 0), 0);
      boqRows.push(["", "", `إجمالي: ${section}`, "", "", "", "", "", "", "", "", "", "", secTotal, "", "", "", "", "", ""]);
      boqRows.push([]);
    }

    // Grand totals
    const grandTotal = items.reduce((s, i) => s + (i[totalKey] || 0), 0);
    const laborTotal = items.reduce((s, i) => s + (i.laborCost || 0), 0);
    const vatTotal = grandTotal * 0.15;
    const grandWithVat = grandTotal + vatTotal;

    boqRows.push([]);
    boqRows.push(["", "", "الإجمالي قبل VAT", "", "", "", "", "", "", "", "", "", "", grandTotal, "", laborTotal, "", "", "", ""]);
    boqRows.push(["", "", "ضريبة القيمة المضافة 15%", "", "", "", "", "", "", "", "", "", "", vatTotal, "", "", vatTotal, "", "", ""]);
    boqRows.push(["", "", "الإجمالي الكلي شامل VAT", "", "", "", "", "", "", "", "", "", "", grandWithVat, "", "", "", "", "", ""]);

    const wsBOQ = XLSX.utils.aoa_to_sheet(boqRows);

    // Column widths
    wsBOQ["!cols"] = [
      { wch: 6 }, { wch: 22 }, { wch: 45 }, { wch: 8 }, { wch: 8 },
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 },
      { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, wsBOQ, "BOQ Pricing");

    // ── Sheet 2: 3 Scenarios Summary ─────────────────────────────────────────
    const scenarioHeaders = [
      "م", "القسم", "الوصف", "الوحدة", "الكمية",
      "سعر اقتصادي", "إجمالي اقتصادي",
      "سعر معياري", "إجمالي معياري",
      "سعر متميز", "إجمالي متميز",
    ];
    const scenarioRows: unknown[][] = [
      [`مقارنة السيناريوهات الثلاثة | ${project.nameAr || project.name}`],
      [],
      scenarioHeaders,
      ...items.map((item, idx) => [
        idx + 1,
        item.sectionName || item.categoryLevel1 || "",
        item.descriptionEn,
        item.unit,
        item.quantity,
        item.unitPriceEconomical || 0,
        item.totalEconomical || 0,
        item.unitPriceStandard || 0,
        item.totalStandard || 0,
        item.unitPricePremium || 0,
        item.totalPremium || 0,
      ]),
      [],
      ["", "", "الإجمالي شامل VAT 15%", "", "",
        "",
        items.reduce((s, i) => s + (i.totalEconomical || 0), 0) * 1.15,
        "",
        items.reduce((s, i) => s + (i.totalStandard || 0), 0) * 1.15,
        "",
        items.reduce((s, i) => s + (i.totalPremium || 0), 0) * 1.15,
      ],
    ];
    const wsScenarios = XLSX.utils.aoa_to_sheet(scenarioRows);
    wsScenarios["!cols"] = [
      { wch: 5 }, { wch: 20 }, { wch: 45 }, { wch: 8 }, { wch: 8 },
      { wch: 13 }, { wch: 15 }, { wch: 13 }, { wch: 15 }, { wch: 13 }, { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, wsScenarios, "3 Scenarios");

    // ── Sheet 3: Install Rates Reference ─────────────────────────────────────
    const installRatesRows = [
      ["أسعار مقاول الباطن | Sub-Contractor Install Rates (KSA 2026 – SAR/unit)"],
      [],
      ["م", "الوصف / Description", "وحدة / Unit", "ملاحظات / Notes", "SAR/Unit"],
      [1, "تمديد كابل 10-16مم²", "م.ط", "Cable pulling + fixing", 10],
      [2, "تمديد كابل 25-35مم²", "م.ط", "Cable pulling + fixing", 15],
      [3, "تمديد كابل 50مم²", "م.ط", "", 18],
      [4, "تمديد كابل 70-95مم²", "م.ط", "", 25],
      [5, "تمديد كابل 120مم²", "م.ط", "", 30],
      [6, "تمديد كابل 150-185مم²", "م.ط", "", 50],
      [7, "تمديد كابل 240-300مم²", "م.ط", "", 55],
      [8, "تركيب لوحات صغيرة SMDBs/LDBs", "مقطوعية", "Small panels", 1000],
      [9, "تقفيل لوحة رئيسية MDB", "مقطوعية", "Main panels", 2200],
      [10, "تمديد كيبل تراي GI", "م.ط", "Cable tray installation", 35],
      [11, "تأسيس وتركيب كشافات إنارة", "عدد", "Avg branch 6m int / 12m ext", 130],
      [12, "تأسيس وتركيب أفياش 13A", "عدد", "Avg branch 11m", 110],
      [13, "تأسيس وتركيب فلور بوكس", "عدد", "Avg branch 15m (floor screed)", 230],
      [14, "تأسيس وتركيب قاطع مكيف", "عدد", "Avg branch 36m", 200],
      [15, "تمديد نقاط داتا/تليفون Cat6", "عدد", "Avg branch 33m", 120],
      [16, "تمديد نقاط سماعات PA", "عدد", "Avg branch 33m", 120],
      [17, "تمديد نقاط حريق FA (EMT)", "عدد", "Avg branch 8m", 120],
      [18, "تمديد نقاط كاميرات CCTV", "عدد", "Avg branch 33m", 120],
      [],
      ["ملاحظة: الأسعار أساس مناطق الرياض/جدة/الدمام 2026. قد تختلف في المناطق النائية بزيادة 10-20%"],
    ];
    const wsRates = XLSX.utils.aoa_to_sheet(installRatesRows);
    wsRates["!cols"] = [{ wch: 5 }, { wch: 35 }, { wch: 12 }, { wch: 30 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsRates, "Install Rates");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    const filename = `BOQ-${(project.nameAr || project.name).replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_")}-${scenario}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  } catch (err) {
    req.log.error({ err }, "Failed to generate Excel report");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/projects/:id/report/pdf", async (req, res) => {
  const { id } = DownloadPdfReportParams.parse(req.params);
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, id));

    const totalStd = items.reduce((s, i) => s + (i.totalStandard || 0), 0);
    const totalEco = items.reduce((s, i) => s + (i.totalEconomical || 0), 0);
    const totalPre = items.reduce((s, i) => s + (i.totalPremium || 0), 0);
    const laborTotal = items.reduce((s, i) => s + (i.laborCost || 0), 0);
    const vatStd = totalStd * 0.15;

    // Category breakdown
    const categories: Record<string, number> = {};
    items.forEach(i => {
      const cat = i.categoryLevel1 || "General";
      categories[cat] = (categories[cat] || 0) + (i.totalStandard || 0);
    });

    const compPass = items.filter(i => i.complianceStatus === 'pass').length;
    const compWarn = items.filter(i => i.complianceStatus === 'warning').length;
    const compFail = items.filter(i => i.complianceStatus === 'fail').length;

    const fmt = (n: number) => n.toLocaleString('en-SA', { maximumFractionDigits: 0 });

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>ملخص تنفيذي - ${project.nameAr || project.name}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 32px 40px; color: #1a202c; direction: rtl; font-size: 13px; background: #f8fafc; }
.header { background: linear-gradient(135deg, #1a3a5c, #2563eb); color: white; padding: 28px 32px; border-radius: 12px; margin-bottom: 24px; }
.header h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
.header .meta { font-size: 12px; opacity: 0.85; }
.section-title { font-size: 15px; font-weight: 700; color: #1a3a5c; border-right: 4px solid #f59e0b; padding-right: 10px; margin: 20px 0 12px; }
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
.card { background: white; border-radius: 10px; padding: 16px 18px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.card .label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
.card .value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
.card .sub { font-size: 10px; color: #9ca3af; margin-top: 2px; }
.eco { color: #059669; }
.std { color: #2563eb; }
.pre { color: #7c3aed; }
table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
th { background: #1a3a5c; color: white; padding: 10px 12px; font-size: 12px; text-align: right; }
td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
tr:last-child td { border-bottom: none; }
tr.section-row td { background: #f0f4ff; font-weight: 600; color: #1a3a5c; }
.number { font-variant-numeric: tabular-nums; font-family: monospace; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
.pass { background: #dcfce7; color: #166534; }
.warn { background: #fef3c7; color: #92400e; }
.fail { background: #fee2e2; color: #991b1b; }
.total-row td { background: #1a3a5c; color: white; font-weight: 700; font-size: 13px; }
.footer { margin-top: 24px; padding: 14px; background: white; border-radius: 8px; text-align: center; font-size: 11px; color: #9ca3af; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
</style></head>
<body>
<div class="header">
  <h1>ملخص تنفيذي | Executive Summary</h1>
  <div class="meta">${project.nameAr || project.name} &nbsp;|&nbsp; ${project.name} &nbsp;|&nbsp; المنطقة: ${(project.region || 'riyadh').toUpperCase()} &nbsp;|&nbsp; تاريخ: ${new Date().toLocaleDateString('ar-SA')} &nbsp;|&nbsp; ${items.length} بند</div>
</div>

<div class="section-title">مقارنة السيناريوهات الثلاثة (شامل VAT 15%)</div>
<div class="cards">
  <div class="card">
    <div class="label">السيناريو الاقتصادي</div>
    <div class="value eco">${fmt(totalEco * 1.15)}</div>
    <div class="sub">ريال سعودي | SAR</div>
  </div>
  <div class="card">
    <div class="label">السيناريو المعياري ★</div>
    <div class="value std">${fmt(totalStd + vatStd)}</div>
    <div class="sub">ريال سعودي | SAR</div>
  </div>
  <div class="card">
    <div class="label">السيناريو المتميز</div>
    <div class="value pre">${fmt(totalPre * 1.15)}</div>
    <div class="sub">ريال سعودي | SAR</div>
  </div>
</div>

<div class="section-title">تفصيل السيناريو المعياري</div>
<table>
  <tr><th>البند</th><th>المبلغ (SAR)</th></tr>
  <tr><td>إجمالي مواد التوريد</td><td class="number">${fmt(totalStd - laborTotal)}</td></tr>
  <tr><td>إجمالي مصنعية التركيب</td><td class="number">${fmt(laborTotal)}</td></tr>
  <tr><td>صافي قبل VAT</td><td class="number">${fmt(totalStd)}</td></tr>
  <tr><td>ضريبة القيمة المضافة 15%</td><td class="number">${fmt(vatStd)}</td></tr>
  <tr class="total-row"><td>الإجمالي الكلي شامل VAT</td><td class="number">${fmt(totalStd + vatStd)}</td></tr>
</table>

<div class="section-title" style="margin-top:20px">توزيع التكاليف حسب القسم (معياري)</div>
<table>
  <tr><th>القسم</th><th>الإجمالي (SAR)</th><th>النسبة</th></tr>
  ${Object.entries(categories).sort(([,a],[,b]) => b - a).map(([cat, total]) => `
  <tr><td>${cat}</td><td class="number">${fmt(total)}</td><td class="number">${((total / totalStd) * 100).toFixed(1)}%</td></tr>
  `).join('')}
  <tr class="total-row"><td>الإجمالي</td><td class="number">${fmt(totalStd)}</td><td>100%</td></tr>
</table>

<div class="section-title" style="margin-top:20px">امتثال معايير SASO & IEC</div>
<table>
  <tr><th>الحالة</th><th>العدد</th><th>النسبة</th></tr>
  <tr><td><span class="tag pass">✓ ممتثل</span></td><td class="number">${compPass}</td><td class="number">${((compPass / items.length) * 100).toFixed(0)}%</td></tr>
  <tr><td><span class="tag warn">⚠ تحذير</span></td><td class="number">${compWarn}</td><td class="number">${((compWarn / items.length) * 100).toFixed(0)}%</td></tr>
  <tr><td><span class="tag fail">✗ مرفوض</span></td><td class="number">${compFail}</td><td class="number">${((compFail / items.length) * 100).toFixed(0)}%</td></tr>
  <tr class="total-row"><td>الإجمالي</td><td class="number">${items.length}</td><td>100%</td></tr>
</table>

<div class="footer">
  تم إعداد هذا التقرير تلقائياً بواسطة نظام تسعير المقايسات الكهربائية بالذكاء الاصطناعي &nbsp;|&nbsp; 
  OUTLET(P) = Supply(Q) × (1 + Wastage%) + Install(S) + Access(T) &nbsp;|&nbsp;
  أسعار السوق السعودي 2026 &nbsp;|&nbsp; جميع الأسعار بالريال السعودي (SAR)
</div>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="Summary-${project.name}.html"`);
    res.send(html);
  } catch (err) {
    req.log.error({ err }, "Failed to generate PDF report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
