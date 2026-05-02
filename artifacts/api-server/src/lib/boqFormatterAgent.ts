/**
 * Agent 16 — BOQ Document Formatter
 * Creates a professional, structured BOQ document from priced items.
 * Generates sections, subtotals, cover info, and HTML output.
 */
import { db } from "@workspace/db";
import { boqItemsTable, projectsTable, boqDocumentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { anthropic } from "@workspace/integrations-anthropic-ai";

interface BoqSection {
  sectionNumber: string;
  titleEn: string;
  titleAr: string;
  items: Array<{
    itemNo: string;
    descriptionEn: string;
    descriptionAr: string;
    unit: string;
    quantity: number;
    unitPriceEcon: number;
    unitPriceStd: number;
    unitPricePrem: number;
    totalEcon: number;
    totalStd: number;
    totalPrem: number;
    sasoStatus: string;
    confidence: number;
  }>;
  subtotalEcon: number;
  subtotalStd: number;
  subtotalPrem: number;
}

export async function runBoqFormatter(projectId: number, scenario: "standard" | "economical" | "premium" = "standard"): Promise<object> {
  logger.info({ projectId, scenario }, "Agent 16: BOQ Formatter starting");

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw new Error(`Project ${projectId} not found`);

  const items = await db.select().from(boqItemsTable)
    .where(eq(boqItemsTable.projectId, projectId));

  const pricedItems = items.filter(i => i.unitPriceStandard && i.unitPriceStandard > 0);

  // Group by section (category)
  const sectionMap = new Map<string, typeof pricedItems>();
  const sectionOrder = ["Cables & Wiring", "Conduits & Trunking", "Wiring Devices", "Lighting",
    "Panels & Distribution", "Protection Devices", "Earthing & Bonding", "Fire Alarm",
    "CCTV & Security", "Data & Network", "Power Systems", "Transformers", "General"];

  for (const item of pricedItems) {
    const cat = item.categoryLevel1 || "General";
    if (!sectionMap.has(cat)) sectionMap.set(cat, []);
    sectionMap.get(cat)!.push(item);
  }

  const sectionTitleMap: Record<string, { en: string; ar: string }> = {
    "Cables & Wiring":       { en: "Cables & Wiring Works",         ar: "أعمال الكابلات والأسلاك" },
    "Conduits & Trunking":   { en: "Conduits, Trunking & Cable Trays", ar: "أعمال المواسير والأدراج وسلالم الكابلات" },
    "Wiring Devices":        { en: "Wiring Devices & Accessories",   ar: "أجهزة الأسلاك والملحقات" },
    "Lighting":              { en: "Lighting Works",                 ar: "أعمال الإضاءة" },
    "Panels & Distribution": { en: "Panels & Distribution Boards",   ar: "اللوحات الكهربائية وأجهزة التوزيع" },
    "Protection Devices":    { en: "Protection & Control Devices",   ar: "أجهزة الحماية والتحكم" },
    "Earthing & Bonding":    { en: "Earthing & Bonding System",      ar: "منظومة التأريض والترابط" },
    "Fire Alarm":            { en: "Fire Alarm & Detection System",  ar: "نظام الإنذار والكشف عن الحريق" },
    "CCTV & Security":       { en: "CCTV & Security Systems",        ar: "نظام المراقبة والأمن" },
    "Data & Network":        { en: "Data, Network & Comms",          ar: "الشبكات والبيانات والاتصالات" },
    "Power Systems":         { en: "Power Systems & UPS",            ar: "أنظمة الطاقة واللاانقطاعية" },
    "Transformers":          { en: "HV/LV Transformers & Switchgear", ar: "محولات الجهد العالي/المنخفض والمفاتيح" },
    "General":               { en: "General & Miscellaneous Works",  ar: "أعمال عامة ومتنوعة" },
  };

  const sections: BoqSection[] = [];
  let secNum = 1;

  for (const cat of sectionOrder) {
    const catItems = sectionMap.get(cat);
    if (!catItems || catItems.length === 0) continue;

    const formattedItems = catItems.map((item, idx) => ({
      itemNo: `${secNum}.${idx + 1}`,
      descriptionEn: item.descriptionEn,
      descriptionAr: item.descriptionAr || item.descriptionEn,
      unit: item.unit || "NO.",
      quantity: item.quantity,
      unitPriceEcon: item.unitPriceEconomical || Math.round((item.unitPriceStandard || 0) * 0.78),
      unitPriceStd: item.unitPriceStandard || 0,
      unitPricePrem: item.unitPricePremium || Math.round((item.unitPriceStandard || 0) * 1.32),
      totalEcon: item.totalPriceEconomical || Math.round((item.totalPriceStandard || 0) * 0.78),
      totalStd: item.totalPriceStandard || 0,
      totalPrem: item.totalPricePremium || Math.round((item.totalPriceStandard || 0) * 1.32),
      sasoStatus: item.sasoCompliance || "pending",
      confidence: Math.round((item.confidenceScore || 0.75) * 100),
    }));

    const section: BoqSection = {
      sectionNumber: String(secNum),
      titleEn: sectionTitleMap[cat]?.en || cat,
      titleAr: sectionTitleMap[cat]?.ar || cat,
      items: formattedItems,
      subtotalEcon: formattedItems.reduce((s, i) => s + i.totalEcon, 0),
      subtotalStd: formattedItems.reduce((s, i) => s + i.totalStd, 0),
      subtotalPrem: formattedItems.reduce((s, i) => s + i.totalPrem, 0),
    };

    sections.push(section);
    secNum++;
  }

  // Totals
  const totalBeforeVat = sections.reduce((s, sec) => s + sec.subtotalStd, 0);
  const vatAmount = Math.round(totalBeforeVat * 0.15);
  const totalWithVat = totalBeforeVat + vatAmount;
  const economicalTotal = sections.reduce((s, sec) => s + sec.subtotalEcon, 0);
  const premiumTotal = sections.reduce((s, sec) => s + sec.subtotalPrem, 0);

  // AI technical notes
  let technicalNotesAr = "";
  try {
    const prompt = `Write professional technical notes in Arabic for a KSA electrical project BOQ.
Project: ${project.name}
Total: SAR ${totalBeforeVat.toLocaleString()}
Sections: ${sections.map(s => s.titleAr).join(", ")}

Write 5-7 professional technical notes covering:
1. Standards compliance (SASO, SEC, IEC, NFPA)
2. Material specifications and brands
3. Installation requirements
4. Testing and commissioning
5. Warranty and documentation

Format as numbered Arabic paragraphs. Max 300 words.`;

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    technicalNotesAr = msg.content[0].type === "text" ? msg.content[0].text : "";
  } catch (e) {
    logger.warn({ err: e }, "Agent 16: AI technical notes failed, using defaults");
    technicalNotesAr = `1. تلتزم جميع المواد بمتطلبات هيئة الاتصالات وتقنية المعلومات والمعايير السعودية SASO.
2. يجب أن تكون جميع الكابلات والأسلاك معتمدة من شركة كابل سعودي أو ما يعادلها.
3. تنفذ جميع أعمال التركيب وفق كود IEC 60364 ومتطلبات شركة كهرباء السعودية (SEC).
4. يتضمن هذا العرض ضمان لمدة سنة على المواد والتركيب.
5. جميع الأسعار بالريال السعودي بدون ضريبة القيمة المضافة (15%).
6. تُجرى اختبارات العزل والاستمرارية والتأريض عند التسليم وتُقدم شهادات الاختبار.`;
  }

  // Generate HTML
  const htmlContent = generateBoqHtml(project.name, sections, {
    totalBeforeVat, vatAmount, totalWithVat, economicalTotal, premiumTotal,
    technicalNotesAr, scenario,
  });

  // Persist
  await db.delete(boqDocumentsTable).where(eq(boqDocumentsTable.projectId, projectId));
  const [doc] = await db.insert(boqDocumentsTable).values({
    projectId,
    documentType: "formatted_boq",
    scenario,
    version: 1,
    titleAr: `مقايسة مشروع: ${project.name}`,
    titleEn: `BOQ: ${project.name}`,
    clientName: project.clientName || "—",
    projectLocation: project.location || "المملكة العربية السعودية",
    issueDate: new Date().toLocaleDateString("en-SA"),
    sections,
    summary: { totalSections: sections.length, totalItems: pricedItems.length, totalBeforeVat, vatAmount, totalWithVat },
    totalBeforeVat,
    vatAmount,
    totalWithVat,
    economicalTotal,
    premiumTotal,
    technicalNotesAr,
    termsAndConditionsAr: "1. صالحية العرض 30 يوماً من تاريخ الإصدار.\n2. يُشمل السعر التوريد والتركيب والاختبار والتشغيل.\n3. ضريبة القيمة المضافة 15% على الإجمالي.\n4. شروط الدفع: 30% عند التوقيع، 40% عند التسليم الجزئي، 30% عند التسليم النهائي.",
    reviewStatus: "draft",
    htmlContent,
  }).returning();

  logger.info({ projectId, sections: sections.length, totalWithVat }, "Agent 16: BOQ Formatter complete");
  return { documentId: doc.id, sections: sections.length, items: pricedItems.length, totalWithVat };
}

function generateBoqHtml(
  projectName: string,
  sections: BoqSection[],
  totals: { totalBeforeVat: number; vatAmount: number; totalWithVat: number; economicalTotal: number; premiumTotal: number; technicalNotesAr: string; scenario: string }
): string {
  const fmt = (n: number) => n.toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = new Date().toLocaleDateString("ar-SA-u-ca-gregory", { year: "numeric", month: "long", day: "numeric" });

  const sectionsHtml = sections.map(sec => `
    <div class="section">
      <h3 class="section-header">القسم ${sec.sectionNumber}: ${sec.titleAr}<br><span class="en">Section ${sec.sectionNumber}: ${sec.titleEn}</span></h3>
      <table>
        <thead>
          <tr>
            <th style="width:60px">رقم البند</th>
            <th>الوصف / Description</th>
            <th style="width:60px">الوحدة</th>
            <th style="width:80px">الكمية</th>
            <th style="width:110px">سعر الوحدة (ريال)</th>
            <th style="width:120px">الإجمالي (ريال)</th>
            <th style="width:70px">SASO</th>
          </tr>
        </thead>
        <tbody>
          ${sec.items.map(item => `
            <tr>
              <td class="center mono">${item.itemNo}</td>
              <td>
                <div class="desc-ar">${item.descriptionAr}</div>
                <div class="desc-en">${item.descriptionEn}</div>
              </td>
              <td class="center">${item.unit}</td>
              <td class="right mono">${item.quantity.toLocaleString()}</td>
              <td class="right mono">${fmt(item.unitPriceStd)}</td>
              <td class="right mono bold">${fmt(item.totalStd)}</td>
              <td class="center"><span class="badge ${item.sasoStatus === 'pass' ? 'badge-pass' : item.sasoStatus === 'fail' ? 'badge-fail' : 'badge-warn'}">${item.sasoStatus === 'pass' ? '✓' : item.sasoStatus === 'fail' ? '✗' : '~'}</span></td>
            </tr>
          `).join("")}
          <tr class="subtotal-row">
            <td colspan="5" class="right bold">مجموع القسم ${sec.sectionNumber}: ${sec.titleAr}</td>
            <td class="right mono bold">${fmt(sec.subtotalStd)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>مقايسة: ${projectName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f5f5f5; color: #1a1a2e; font-size: 13px; }
  .cover { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: white; padding: 60px 48px; page-break-after: always; }
  .cover-logo { font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #e94560; margin-bottom: 40px; }
  .cover-title-ar { font-size: 36px; font-weight: 700; margin-bottom: 8px; }
  .cover-title-en { font-size: 20px; opacity: 0.8; margin-bottom: 40px; }
  .cover-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 40px; }
  .cover-meta-item label { font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px; }
  .cover-meta-item .val { font-size: 16px; font-weight: 600; margin-top: 4px; }
  .cover-totals { margin-top: 50px; background: rgba(255,255,255,0.08); border-radius: 12px; padding: 24px; }
  .cover-totals-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 16px; }
  .tot-box { text-align: center; }
  .tot-box .scenario { font-size: 10px; opacity: 0.7; text-transform: uppercase; letter-spacing: 1px; }
  .tot-box .amount { font-size: 22px; font-weight: 800; margin-top: 6px; }
  .tot-box.highlight .amount { color: #ffd700; font-size: 26px; }
  .page { background: white; margin: 20px auto; max-width: 1100px; padding: 32px 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .section { margin-bottom: 32px; }
  .section-header { background: #0f3460; color: white; padding: 10px 16px; border-radius: 6px; font-size: 14px; font-weight: 700; margin-bottom: 8px; }
  .section-header .en { font-size: 11px; font-weight: 400; opacity: 0.8; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f0f4ff; padding: 8px 10px; text-align: right; border: 1px solid #d0d8f0; font-weight: 600; color: #334; }
  td { padding: 7px 10px; border: 1px solid #e8ecf4; vertical-align: top; }
  tr:nth-child(even) td { background: #fafbff; }
  .desc-ar { font-weight: 500; }
  .desc-en { font-size: 10px; color: #666; margin-top: 2px; }
  .right { text-align: right; }
  .center { text-align: center; }
  .mono { font-family: 'Courier New', monospace; }
  .bold { font-weight: 700; }
  .subtotal-row td { background: #eff3ff !important; font-weight: 700; color: #0f3460; border-top: 2px solid #0f3460; }
  .badge { display: inline-block; width: 20px; height: 20px; border-radius: 50%; font-size: 11px; font-weight: 700; line-height: 20px; text-align: center; }
  .badge-pass { background: #d4edda; color: #155724; }
  .badge-fail { background: #f8d7da; color: #721c24; }
  .badge-warn { background: #fff3cd; color: #856404; }
  .grand-total-box { background: linear-gradient(135deg, #0f3460, #16213e); color: white; border-radius: 12px; padding: 28px 36px; margin: 32px 0; }
  .grand-total-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
  .gt-item label { font-size: 11px; opacity: 0.7; }
  .gt-item .gt-val { font-size: 18px; font-weight: 700; margin-top: 4px; color: #ffd700; }
  .gt-item.highlight .gt-val { font-size: 26px; }
  .notes-box { border: 1px solid #d0d8f0; border-radius: 8px; padding: 20px 24px; margin-top: 24px; background: #fafbff; }
  .notes-box h4 { color: #0f3460; margin-bottom: 12px; font-size: 14px; }
  .notes-box p { line-height: 1.8; color: #444; white-space: pre-line; }
  .terms-box { border: 1px solid #ffe0b2; border-radius: 8px; padding: 20px 24px; margin-top: 16px; background: #fff8f0; }
  .terms-box h4 { color: #e65100; margin-bottom: 12px; }
  .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e0e0e0; color: #888; font-size: 11px; }
  .scenario-comparison { background: #f8faff; border: 1px solid #d0d8f0; border-radius: 10px; padding: 20px; margin: 24px 0; }
  .sc-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 12px; }
  .sc-item { text-align: center; padding: 16px; border-radius: 8px; }
  .sc-item.econ { background: #e8f5e9; }
  .sc-item.std { background: #e3f2fd; border: 2px solid #1565c0; }
  .sc-item.prem { background: #fce4ec; }
  .sc-item .sc-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #555; }
  .sc-item .sc-val { font-size: 20px; font-weight: 800; margin-top: 6px; }
  .sc-item.econ .sc-val { color: #2e7d32; }
  .sc-item.std .sc-val { color: #1565c0; }
  .sc-item.prem .sc-val { color: #ad1457; }
  @media print {
    body { background: white; }
    .page { box-shadow: none; margin: 0; padding: 20px; }
    .cover { page-break-after: always; }
    .section { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover">
  <div class="cover-logo">⚡ GOVAL BOQ</div>
  <div class="cover-title-ar">مقايسة أعمال كهربائية</div>
  <div class="cover-title-en">Electrical Works — Bill of Quantities (BOQ)</div>
  <div style="font-size:22px; font-weight:700; margin-top:16px; color:#e0e0ff;">${projectName}</div>
  
  <div class="cover-meta">
    <div class="cover-meta-item"><label>تاريخ الإصدار / Issue Date</label><div class="val">${today}</div></div>
    <div class="cover-meta-item"><label>معد من قِبَل / Prepared By</label><div class="val">Goval BOQ AI System</div></div>
    <div class="cover-meta-item"><label>عدد الأقسام / Sections</label><div class="val">${sections.length} قسم</div></div>
    <div class="cover-meta-item"><label>إجمالي البنود / Total Items</label><div class="val">${sections.reduce((s, sec) => s + sec.items.length, 0)} بند</div></div>
  </div>
  
  <div class="cover-totals">
    <div style="font-size:13px; opacity:0.8; margin-bottom:8px;">ملخص التكاليف — Cost Summary</div>
    <div class="cover-totals-grid">
      <div class="tot-box"><div class="scenario">اقتصادي / Economical</div><div class="amount">${Math.round(totals.economicalTotal).toLocaleString()} ر.س</div></div>
      <div class="tot-box highlight"><div class="scenario">⭐ معياري / Standard</div><div class="amount">${Math.round(totals.totalBeforeVat).toLocaleString()} ر.س</div></div>
      <div class="tot-box"><div class="scenario">متميز / Premium</div><div class="amount">${Math.round(totals.premiumTotal).toLocaleString()} ر.س</div></div>
    </div>
  </div>
</div>

<!-- BOQ CONTENT -->
<div class="page">
  
  <!-- Scenario Comparison -->
  <div class="scenario-comparison">
    <h3 style="color:#1a1a2e; margin-bottom:4px;">مقارنة السيناريوهات — Scenario Comparison</h3>
    <p style="font-size:11px; color:#666; margin-bottom:12px;">جميع الأسعار بالريال السعودي · All prices in SAR · بدون ضريبة القيمة المضافة</p>
    <div class="sc-grid">
      <div class="sc-item econ"><div class="sc-label">🟢 اقتصادي Economical</div><div class="sc-val">${Math.round(totals.economicalTotal).toLocaleString()}</div><div style="font-size:10px; color:#666; margin-top:4px;">+ ضريبة ${Math.round(totals.economicalTotal * 0.15).toLocaleString()}</div></div>
      <div class="sc-item std"><div class="sc-label">⭐ معياري Standard (المرجع)</div><div class="sc-val">${Math.round(totals.totalBeforeVat).toLocaleString()}</div><div style="font-size:10px; color:#666; margin-top:4px;">+ ضريبة ${Math.round(totals.vatAmount).toLocaleString()}</div></div>
      <div class="sc-item prem"><div class="sc-label">💎 متميز Premium</div><div class="sc-val">${Math.round(totals.premiumTotal).toLocaleString()}</div><div style="font-size:10px; color:#666; margin-top:4px;">+ ضريبة ${Math.round(totals.premiumTotal * 0.15).toLocaleString()}</div></div>
    </div>
  </div>

  ${sectionsHtml}

  <!-- Grand Total -->
  <div class="grand-total-box">
    <h3 style="margin-bottom:20px; font-size:18px;">الإجمالي الكلي — Grand Total (Standard Scenario)</h3>
    <div class="grand-total-grid">
      <div class="gt-item"><label>إجمالي قبل الضريبة</label><div class="gt-val">${fmt(totals.totalBeforeVat)} ر.س</div></div>
      <div class="gt-item"><label>ضريبة القيمة المضافة 15%</label><div class="gt-val">${fmt(totals.vatAmount)} ر.س</div></div>
      <div class="gt-item highlight"><label>الإجمالي شامل الضريبة ✦</label><div class="gt-val">${fmt(totals.totalWithVat)} ر.س</div></div>
    </div>
  </div>

  <!-- Technical Notes -->
  <div class="notes-box">
    <h4>ملاحظات فنية — Technical Notes</h4>
    <p>${totals.technicalNotesAr}</p>
  </div>

  <!-- Terms -->
  <div class="terms-box">
    <h4>الشروط والأحكام العامة</h4>
    <p style="line-height:1.9; color:#555;">
1. صالحية العرض 30 يوماً من تاريخ الإصدار.<br>
2. يُشمل السعر التوريد والتركيب والاختبار والتشغيل ما لم يُشر لخلاف ذلك.<br>
3. ضريبة القيمة المضافة 15% مضافة على الإجمالي وفق نظام ضريبة القيمة المضافة السعودي.<br>
4. شروط الدفع: 30% عند التوقيع، 40% عند التسليم الجزئي، 30% عند التسليم النهائي.<br>
5. يخضع المشروع لمتطلبات شركة كهرباء السعودية (SEC) والمعايير السعودية SASO.<br>
6. أي كميات إضافية أو تعديلات في النطاق تستوجب تسعيراً إضافياً متفقاً عليه.
    </p>
  </div>

  <div class="footer">
    تم إعداد هذه المقايسة بواسطة نظام Goval BOQ — الذكاء الاصطناعي للتسعير الكهربائي · ${today}<br>
    Generated by Goval BOQ AI System · All prices in SAR · Valid for 30 days from issue date
  </div>
</div>

</body>
</html>`;
}
