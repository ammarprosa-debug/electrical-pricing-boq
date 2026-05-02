import { Router } from "express";
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

    const csvRows = [
      ["Item No", "Description (EN)", "Description (AR)", "Unit", "Qty", "Unit Price (SAR)", "Total (SAR)", "Labor (SAR)", "VAT (SAR)", "Confidence", "Compliance"],
      ...items.map(i => [
        i.itemNumber || "",
        i.descriptionEn,
        i.descriptionAr || "",
        i.unit,
        i.quantity,
        i[priceKey] || 0,
        i[totalKey] || 0,
        i.laborCost || 0,
        i.vatAmount || 0,
        i.confidenceScore || 0,
        i.complianceStatus || "pending",
      ]),
      [],
      ["", "", "", "", "TOTAL", "", items.reduce((s, i) => s + (i[totalKey] || 0), 0), "", ""],
    ];

    const csv = csvRows.map(r => r.join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="BOQ-${project.name}-${scenario}.csv"`);
    res.send(csv);
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

    const total = items.reduce((s, i) => s + (i.totalStandard || 0), 0);
    const vat = total * 0.15;
    const grandTotal = total + vat;

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><style>
body { font-family: Arial, sans-serif; margin: 40px; direction: rtl; }
h1 { color: #1a3a5c; border-bottom: 3px solid #f59e0b; padding-bottom: 10px; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th { background: #1a3a5c; color: white; padding: 10px; }
td { padding: 8px; border: 1px solid #e5e7eb; }
.total { font-weight: bold; font-size: 1.2em; color: #1a3a5c; }
</style></head>
<body>
<h1>ملخص تنفيذي - ${project.nameAr || project.name}</h1>
<p><strong>المنطقة:</strong> ${project.region} | <strong>تاريخ التقرير:</strong> ${new Date().toLocaleDateString("ar-SA")}</p>
<h2>ملخص التكاليف</h2>
<table>
<tr><th>البند</th><th>المبلغ (ريال)</th></tr>
<tr><td>إجمالي المواد (معيار)</td><td>${total.toFixed(2)}</td></tr>
<tr><td>ضريبة القيمة المضافة (15%)</td><td>${vat.toFixed(2)}</td></tr>
<tr class="total"><td>الإجمالي الكلي</td><td>${grandTotal.toFixed(2)}</td></tr>
</table>
<h2>3 سيناريوهات التسعير</h2>
<table>
<tr><th>السيناريو</th><th>الإجمالي (ريال)</th></tr>
<tr><td>اقتصادي</td><td>${(items.reduce((s,i)=>s+(i.totalEconomical||0),0)*1.15).toFixed(2)}</td></tr>
<tr><td>معياري</td><td>${grandTotal.toFixed(2)}</td></tr>
<tr><td>متميز</td><td>${(items.reduce((s,i)=>s+(i.totalPremium||0),0)*1.15).toFixed(2)}</td></tr>
</table>
<p>إجمالي البنود: ${items.length} | بنود مسعرة: ${items.filter(i=>i.unitPriceStandard).length}</p>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="Executive-Summary-${project.name}.html"`);
    res.send(html);
  } catch (err) {
    req.log.error({ err }, "Failed to generate PDF report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
