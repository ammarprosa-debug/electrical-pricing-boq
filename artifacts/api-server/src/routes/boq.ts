import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db } from "@workspace/db";
import { boqItemsTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UploadBoqFileParams, UpdateBoqItemParams, UpdateBoqItemBody, ListBoqItemsParams } from "@workspace/api-zod";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Discipline detection mapping ─────────────────────────────────────────────
const DISCIPLINE_MAP: Array<{ keywords: string[]; label: string }> = [
  { keywords: ["electrical", "كهرباء", "elec", "power", "قوى", "لوحات", "كابلات"], label: "Electrical" },
  { keywords: ["low current", "تيار خفيف", "lc ", "lowcurrent", "ict", "security", "cctv", "fire", "pa ", "data", "clock", "matv", "bms", "knx", "automation", "signage", "access control"], label: "Low Current" },
  { keywords: ["fire alarm", "fa ", "حريق", "إنذار", "alarm"], label: "Fire Alarm" },
  { keywords: ["bms", "building management", "knx", "automation", "إدارة مباني"], label: "BMS" },
  { keywords: ["medical gas", "غاز طبي", "medical", "طبي", "gas outlet", "bed head"], label: "Medical Gases" },
  { keywords: ["mechanical", "ميكانيكا", "hvac", "plumbing", "سباكة", "تكييف"], label: "Mechanical" },
  { keywords: ["civil", "architectural", "معماري", "مدني", "structure"], label: "Civil & Arch" },
  { keywords: ["general", "عام", "miscellaneous", "متنوع", "preliminary", "provisional"], label: "General" },
];

function detectDiscipline(sheetName: string, sectionName?: string): string {
  const text = `${sheetName} ${sectionName || ""}`.toLowerCase();
  for (const d of DISCIPLINE_MAP) {
    if (d.keywords.some(k => text.includes(k))) return d.label;
  }
  return "General";
}

function isSkipSheet(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("summary") || n.includes("ملخص") || n.includes("outlet_breakdown") ||
    n.includes("install_rate") || n === "cover" || n === "index" || n === "contents";
}

router.get("/projects/:id/boq", async (req, res) => {
  const { id } = ListBoqItemsParams.parse(req.params);
  try {
    const items = await db.select().from(boqItemsTable).where(eq(boqItemsTable.projectId, id));
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list BOQ items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/projects/:id/upload", upload.single("file"), async (req, res) => {
  const { id } = UploadBoqFileParams.parse(req.params);
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    await db.update(projectsTable).set({ status: "parsing" }).where(eq(projectsTable.id, id));

    const parsedItems = await parseBoqFile(req.file);
    const errors: string[] = [];
    if (parsedItems.length === 0) errors.push("No items could be extracted from the file");

    await db.delete(boqItemsTable).where(eq(boqItemsTable.projectId, id));
    if (parsedItems.length > 0) {
      await db.insert(boqItemsTable).values(parsedItems.map((item, idx) => ({
        projectId: id,
        itemNumber: item.itemNumber || `${idx + 1}`,
        descriptionEn: item.description,
        descriptionAr: item.descriptionAr || null,
        unit: item.unit || "No",
        quantity: item.quantity || 1,
        discipline: item.discipline || "General",
        categoryLevel1: item.section ? normalizeSectionToCategory(item.section) : classifyItem(item.description),
        sectionName: item.section || null,
        supplierName: item.supplier || null,
        supplyPrice: item.supplyPrice || null,
        wastagePercent: item.wastagePercent || null,
        installCost: item.installCost || null,
        accessCost: item.accessCost || null,
        unitPriceStandard: item.unitPrice || null,
        totalStandard: item.unitPrice && item.quantity ? item.unitPrice * item.quantity : null,
        notes: item.notes || null,
      })));
    }

    // Count disciplines detected
    const disciplines = [...new Set(parsedItems.map(i => i.discipline).filter(Boolean))];

    await db.update(projectsTable).set({
      status: parsedItems.length > 0 ? "draft" : "failed",
      totalItems: parsedItems.length,
      pricedItems: 0,
    }).where(eq(projectsTable.id, id));

    res.json({
      success: true,
      itemsFound: parsedItems.length,
      disciplines,
      message: `تم استخراج ${parsedItems.length} بند من ${disciplines.length} تخصص: ${disciplines.join("، ")}`,
      parseErrors: errors,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to upload BOQ file");
    await db.update(projectsTable).set({ status: "failed" }).where(eq(projectsTable.id, id));
    res.status(500).json({ error: "Failed to parse file" });
  }
});

router.put("/boq/:itemId", async (req, res) => {
  const { itemId } = UpdateBoqItemParams.parse(req.params);
  const parsed = UpdateBoqItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    if (parsed.data.unitPriceStandard !== undefined) {
      const [item] = await db.select().from(boqItemsTable).where(eq(boqItemsTable.id, itemId));
      if (item) {
        updates.totalStandard = parsed.data.unitPriceStandard * item.quantity;
        updates.pricingSource = "manual";
      }
    }
    const [updated] = await db.update(boqItemsTable).set(updates).where(eq(boqItemsTable.id, itemId)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update BOQ item");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Parsed item shape ────────────────────────────────────────────────────────
interface ParsedItem {
  itemNumber?: string;
  description: string;
  descriptionAr?: string;
  unit?: string;
  quantity?: number;
  discipline?: string;
  section?: string;
  supplier?: string;
  supplyPrice?: number;
  wastagePercent?: number;
  installCost?: number;
  accessCost?: number;
  unitPrice?: number;
  notes?: string;
}

// ─── Main parser dispatcher ───────────────────────────────────────────────────
async function parseBoqFile(file: Express.Multer.File): Promise<ParsedItem[]> {
  const filename = file.originalname.toLowerCase();
  if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) return parseXlsx(file.buffer);
  if (filename.endsWith(".csv")) return parseCsv(file.buffer.toString("utf-8"));
  if (filename.endsWith(".json")) {
    try {
      const data = JSON.parse(file.buffer.toString("utf-8"));
      if (Array.isArray(data)) return data;
    } catch { /* fall through */ }
  }
  return parseCsv(file.buffer.toString("utf-8"));
}

// ─── XLSX Parser ─────────────────────────────────────────────────────────────
function parseXlsx(buffer: Buffer): ParsedItem[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const results: ParsedItem[] = [];

  const dataSheets = wb.SheetNames.filter(n => !isSkipSheet(n));

  for (const sheetName of dataSheets) {
    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
    const sheetDiscipline = detectDiscipline(sheetName);
    const sheetItems = parseXlsxSheet(rows, sheetName, sheetDiscipline);
    results.push(...sheetItems);
  }

  return results;
}

function parseXlsxSheet(rows: unknown[][], sheetName: string, defaultDiscipline: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  let headerRowIdx = -1;
  let colMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map(c => String(c).toLowerCase().trim());
    const score =
      (row.some(c => c.includes("desc") || c.includes("وصف") || c.includes("بيان")) ? 2 : 0) +
      (row.some(c => c.includes("qty") || c.includes("كمية") || c.includes("quant")) ? 2 : 0) +
      (row.some(c => c.includes("unit") || c.includes("وحدة")) ? 1 : 0) +
      (row.some(c => c.includes("item") || c.includes("رقم") || c.includes("م\n")) ? 1 : 0);
    if (score >= 3) { headerRowIdx = i; colMap = buildColMap(rows[i]); break; }
  }

  if (headerRowIdx === -1) {
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const row = rows[i].map(c => String(c));
      if (row.some(c => c.includes("وصف البند") || c.includes("الكمية") || c.includes("الوحدة"))) {
        headerRowIdx = i; colMap = buildColMap(rows[i]); break;
      }
    }
  }
  if (headerRowIdx === -1) return [];

  let currentSection = sheetName;
  let currentDiscipline = defaultDiscipline;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === "" || c === null || c === undefined)) continue;

    const nonEmpty = row.filter(c => c !== "" && c !== null);
    if (nonEmpty.length <= 2 && nonEmpty.length >= 1) {
      const cellText = String(nonEmpty[0]).replace(/^[◄◈►▶▷●○•\s]+/, "").trim();
      if (!cellText.match(/^\d/) && cellText.length > 3 && !cellText.match(/^[\d.]+$/)) {
        currentSection = cellText;
        // Re-detect discipline from section name
        const detected = detectDiscipline("", currentSection);
        if (detected !== "General") currentDiscipline = detected;
        continue;
      }
    }

    const item = extractRowItem(row, colMap, currentSection);
    if (item) {
      item.discipline = currentDiscipline;
      items.push(item);
    }
  }

  return items;
}

function buildColMap(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((cell, idx) => {
    const h = String(cell).toLowerCase().replace(/\r\n/g, " ").trim();
    if (h.match(/^(item\s*no|#|م$|رقم|no\.?$)/)) map.itemNo = idx;
    if ((h.includes("description") || h.includes("بيان")) && !h.includes("ar") && !h.includes("عربي") && map.desc === undefined) map.desc = idx;
    if ((h.includes("وصف") || h.includes("بيان العمل")) && map.desc === undefined) map.desc = idx;
    if (h.match(/^(qty|quantity|كمية|الكمية)$/)) map.qty = idx;
    if (h.match(/^(unit|uom|وحدة|الوحدة)$/)) map.unit = idx;
    if (h.includes("supplier") || h.includes("مورد") || h.includes("الموردون")) map.supplier = idx;
    if ((h.includes("unit rate") || h.includes("unit price") || h === "rate") && map.unitPrice === undefined) map.unitPrice = idx;
    if (h.match(/^(amount|إجمالي|المبلغ|total)$/)) map.amount = idx;
    if (h.includes("supply") && (h.includes("(q)") || h.includes("توريد"))) map.supplyQ = idx;
    if (h.includes("wastage") || h.includes("هالك")) map.wastageR = idx;
    if (h.includes("install") && (h.includes("(s)") || h.includes("تركيب"))) map.installS = idx;
    if (h.includes("access") && h.includes("(t)")) map.accessT = idx;
    if (h.includes("outlet") || h === "best" || h.includes("unit pri")) map.outlet = idx;
    if (h.includes("note") || h.includes("ملاحظ")) map.notes = idx;
    if ((h.includes("وصف") || h === "description ar") && map.desc !== undefined && map.descAr === undefined) map.descAr = idx;
  });
  return map;
}

function extractRowItem(row: unknown[], colMap: Record<string, number>, currentSection: string): ParsedItem | null {
  const get = (key: string): string => {
    if (colMap[key] === undefined) return "";
    return String(row[colMap[key]] ?? "").trim();
  };
  const getNum = (key: string): number | undefined => {
    const v = get(key); if (!v) return undefined;
    const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? undefined : n;
  };

  let description = get("desc");
  if (!description) {
    for (const idx of [1, 2]) {
      const v = String(row[idx] ?? "").trim();
      if (v && v.length > 3) { description = v; break; }
    }
  }
  if (!description || description.length < 2) return null;
  if (description.toLowerCase().match(/^(total|subtotal|الإجمالي|المجموع|grand total|note:|notes:)/i)) return null;

  let itemNumber = get("itemNo");
  if (!itemNumber) {
    const c0 = String(row[0] ?? "").trim();
    if (c0 && c0.match(/^[\d.]+(-\d+)?$/)) itemNumber = c0;
  }

  const qty = getNum("qty") || 1;
  const unit = get("unit") || "No";
  const supplier = get("supplier") || undefined;
  const notes = get("notes") || undefined;

  const supplyQ = getNum("supplyQ");
  const wastageR = getNum("wastageR");
  const installS = getNum("installS");
  const accessT = getNum("accessT");
  const outlet = getNum("outlet");
  let unitPrice = getNum("unitPrice") || outlet;

  if (!unitPrice && supplyQ !== undefined) {
    const wastage = wastageR !== undefined ? (wastageR > 1 ? wastageR / 100 : wastageR) : 0.01;
    unitPrice = supplyQ * (1 + wastage) + (installS || 0) + (accessT || 0);
  }
  if (!unitPrice && colMap.amount !== undefined) {
    const amt = getNum("amount");
    if (amt && qty > 0) unitPrice = amt / qty;
  }

  return {
    itemNumber: itemNumber || undefined,
    description,
    descriptionAr: get("descAr") || undefined,
    unit,
    quantity: qty,
    section: currentSection,
    supplier,
    supplyPrice: supplyQ,
    wastagePercent: wastageR !== undefined ? (wastageR > 1 ? wastageR : wastageR * 100) : undefined,
    installCost: installS,
    accessCost: accessT,
    unitPrice,
    notes,
  };
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

function parseCsv(content: string): ParsedItem[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map(h => h.toLowerCase().replace(/['"]/g, "").trim());

  const findIdx = (priority: string[]) => {
    for (const key of priority) {
      const idx = headers.findIndex(h => h === key || h.includes(key));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const descIdx = findIdx(["description", "desc", "item description", "وصف", "بيان العمل", "البند", "الوصف"]);
  const descArIdx = findIdx(["description ar", "arabic description", "الوصف العربي"]);
  const qtyIdx = findIdx(["quantity", "qty", "الكمية", "كمية"]);
  const unitIdx = findIdx(["unit", "uom", "الوحدة", "وحدة"]);
  const numIdx = findIdx(["no", "no.", "#", "item no", "item number", "رقم", "م"]);
  const supplierIdx = findIdx(["supplier", "suppliers", "مورد", "الموردون"]);
  const priceIdx = findIdx(["unit rate", "unit price", "rate", "سعر الوحدة"]);
  const amountIdx = findIdx(["amount", "total", "المبلغ", "الإجمالي"]);
  const disciplineIdx = findIdx(["discipline", "تخصص", "section type"]);

  const effectiveDescIdx = descIdx > 0 ? descIdx : (descIdx === 0 && headers.length > 1 ? 1 : descIdx >= 0 ? descIdx : 1);
  const results: ParsedItem[] = [];

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const description = cols[effectiveDescIdx] || "";
    if (!description || description.length < 2) continue;
    if (description.toLowerCase().match(/^(description|desc|وصف|total|الإجمالي)$/)) continue;

    const rawQty = qtyIdx >= 0 ? cols[qtyIdx] : "";
    const qty = rawQty ? parseFloat(rawQty.replace(/[^0-9.]/g, "")) : NaN;
    const rawPrice = priceIdx >= 0 ? cols[priceIdx] : "";
    const unitPrice = rawPrice ? parseFloat(rawPrice.replace(/[^0-9.]/g, "")) : undefined;
    const rawAmount = amountIdx >= 0 ? cols[amountIdx] : "";
    const amount = rawAmount ? parseFloat(rawAmount.replace(/[^0-9.]/g, "")) : undefined;
    const effectiveQty = !isNaN(qty) && qty > 0 ? qty : 1;
    const effectivePrice = unitPrice || (amount && effectiveQty > 0 ? amount / effectiveQty : undefined);
    const discText = disciplineIdx >= 0 ? cols[disciplineIdx] : "";

    results.push({
      itemNumber: numIdx >= 0 ? cols[numIdx] : undefined,
      description,
      descriptionAr: descArIdx >= 0 && cols[descArIdx]?.length > 1 ? cols[descArIdx] : undefined,
      unit: unitIdx >= 0 ? cols[unitIdx] || "No" : "No",
      quantity: effectiveQty,
      discipline: discText ? detectDiscipline(discText) : detectDiscipline("", description),
      supplier: supplierIdx >= 0 ? cols[supplierIdx] || undefined : undefined,
      unitPrice: effectivePrice,
    });
  }
  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeSectionToCategory(section: string): string {
  const s = section.toLowerCase();
  if (s.includes("لوحة") || s.includes("distribution") || s.includes("panel") || s.includes("mdb") || s.includes("db ") || s.includes("switchgear")) return "Panels & Distribution";
  if (s.includes("كابل") || s.includes("cable") || s.includes("wire") || s.includes("conductor") || s.includes("أسلاك")) return "Cables & Wiring";
  if (s.includes("إنارة") || s.includes("lighting") || s.includes("light") || s.includes("lamp") || s.includes("luminaire") || s.includes("إضاءة")) return "Lighting";
  if (s.includes("مفتاح") || s.includes("بريزة") || s.includes("socket") || s.includes("switch") || s.includes("outlet") || s.includes("مخرج")) return "Wiring Devices";
  if (s.includes("ماسورة") || s.includes("conduit") || s.includes("trunking") || s.includes("tray") || s.includes("duct")) return "Conduits & Trunking";
  if (s.includes("قاطع") || s.includes("breaker") || s.includes("mcb") || s.includes("protection")) return "Protection Devices";
  if (s.includes("تأريض") || s.includes("earthing") || s.includes("grounding")) return "Earthing & Bonding";
  if (s.includes("حريق") || s.includes("fire") || s.includes("alarm") || s.includes("fa ")) return "Fire Alarm";
  if (s.includes("pa ") || s.includes("إذاعة") || s.includes("public address") || s.includes("evacuation")) return "Public Address";
  if (s.includes("cctv") || s.includes("كاميرا") || s.includes("security") || s.includes("مراقبة")) return "CCTV & Security";
  if (s.includes("bms") || s.includes("كنترول") || s.includes("automation") || s.includes("knx")) return "BMS & Automation";
  if (s.includes("data") || s.includes("داتا") || s.includes("network") || s.includes("شبكة")) return "Data & Network";
  if (s.includes("ups") || s.includes("generator") || s.includes("مولد")) return "Power Systems";
  if (s.includes("transformer") || s.includes("محول")) return "Transformers";
  if (s.includes("motor") || s.includes("محرك") || s.includes("pump")) return "Motors & Drives";
  if (s.includes("medical") || s.includes("طبي") || s.includes("bed head")) return "Medical Systems";
  if (s.includes("matv") || s.includes("tv") || s.includes("signage") || s.includes("لافتات")) return "AV & Signage";
  if (s.includes("clock") || s.includes("ساعة")) return "Clock Systems";
  if (s.includes("access control") || s.includes("دخول")) return "Access Control";
  return classifyItem(section);
}

function classifyItem(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes("cable") || desc.includes("كابل") || desc.includes("wire") || desc.includes("conductor")) return "Cables & Wiring";
  if (desc.includes("panel") || desc.includes("mdb") || desc.includes("db ") || desc.includes("distribution") || desc.includes("لوحة")) return "Panels & Distribution";
  if (desc.includes("light") || desc.includes("lamp") || desc.includes("fixture") || desc.includes("إضاءة") || desc.includes("luminaire") || desc.includes("إنارة")) return "Lighting";
  if (desc.includes("socket") || desc.includes("outlet") || desc.includes("plug") || desc.includes("مقبس") || desc.includes("بريزة")) return "Wiring Devices";
  if (desc.includes("conduit") || desc.includes("trunking") || desc.includes("duct") || desc.includes("tray") || desc.includes("ماسورة")) return "Conduits & Trunking";
  if (desc.includes("breaker") || desc.includes("mcb") || desc.includes("mccb") || desc.includes("rcd") || desc.includes("قاطع")) return "Protection Devices";
  if (desc.includes("earthing") || desc.includes("grounding") || desc.includes("تأريض")) return "Earthing & Bonding";
  if (desc.includes("fire") || desc.includes("alarm") || desc.includes("detector") || desc.includes("حريق")) return "Fire Alarm";
  if (desc.includes("pa ") || desc.includes("speaker") || desc.includes("سماعة") || desc.includes("إذاعة")) return "Public Address";
  if (desc.includes("cctv") || desc.includes("camera") || desc.includes("كاميرا")) return "CCTV & Security";
  if (desc.includes("ups") || desc.includes("battery") || desc.includes("generator") || desc.includes("بطارية")) return "Power Systems";
  if (desc.includes("transformer") || desc.includes("محول")) return "Transformers";
  if (desc.includes("motor") || desc.includes("pump") || desc.includes("fan") || desc.includes("محرك")) return "Motors & Drives";
  if (desc.includes("bms") || desc.includes("knx") || desc.includes("automation")) return "BMS & Automation";
  if (desc.includes("data") || desc.includes("cat6") || desc.includes("network")) return "Data & Network";
  if (desc.includes("medical") || desc.includes("gas outlet") || desc.includes("bed head")) return "Medical Systems";
  return "General Electrical";
}

export default router;
