import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { boqItemsTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UploadBoqFileParams, UpdateBoqItemParams, UpdateBoqItemBody, ListBoqItemsParams } from "@workspace/api-zod";
import { pricingQueue } from "../lib/pricingQueue.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

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
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    await db.update(projectsTable).set({ status: "parsing" }).where(eq(projectsTable.id, id));

    const parsedItems = await parseBoqFile(req.file);
    const errors: string[] = [];

    if (parsedItems.length === 0) {
      errors.push("No items could be extracted from the file");
    }

    await db.delete(boqItemsTable).where(eq(boqItemsTable.projectId, id));
    if (parsedItems.length > 0) {
      await db.insert(boqItemsTable).values(parsedItems.map((item, idx) => ({
        projectId: id,
        itemNumber: item.itemNumber || `${idx + 1}`,
        descriptionEn: item.description,
        descriptionAr: (item as any).descriptionAr || null,
        unit: item.unit || "No",
        quantity: item.quantity || 1,
        categoryLevel1: classifyItem(item.description),
      })));
    }

    await db.update(projectsTable).set({
      status: "draft",
      totalItems: parsedItems.length,
      pricedItems: 0,
    }).where(eq(projectsTable.id, id));

    res.json({ success: true, itemsFound: parsedItems.length, message: `Successfully parsed ${parsedItems.length} items`, parseErrors: errors });
  } catch (err) {
    req.log.error({ err }, "Failed to upload BOQ file");
    await db.update(projectsTable).set({ status: "failed" }).where(eq(projectsTable.id, id));
    res.status(500).json({ error: "Failed to parse file" });
  }
});

router.put("/boq/:itemId", async (req, res) => {
  const { itemId } = UpdateBoqItemParams.parse(req.params);
  const parsed = UpdateBoqItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    if (parsed.data.unitPriceStandard !== undefined) {
      const [item] = await db.select().from(boqItemsTable).where(eq(boqItemsTable.id, itemId));
      if (item) {
        updates.totalStandard = (parsed.data.unitPriceStandard) * item.quantity;
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

async function parseBoqFile(file: Express.Multer.File): Promise<{ itemNumber?: string; description: string; unit?: string; quantity?: number }[]> {
  const filename = file.originalname.toLowerCase();
  const content = file.buffer.toString("utf-8");

  if (filename.endsWith(".csv")) {
    return parseCsv(content);
  } else if (filename.endsWith(".json")) {
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data)) return data;
    } catch { /* fall through */ }
  }

  const lines = content.split("\n").filter(l => l.trim().length > 10);
  const items: { description: string; unit?: string; quantity?: number }[] = [];
  for (const line of lines.slice(0, 200)) {
    const parts = line.split(/[,;\t|]+/);
    if (parts.length >= 2) {
      const desc = parts.find(p => p.trim().length > 5);
      if (desc && !desc.toLowerCase().includes("description") && !desc.toLowerCase().includes("item")) {
        const qty = parts.map(p => parseFloat(p.replace(/[^0-9.]/g, ""))).find(n => !isNaN(n) && n > 0 && n < 100000);
        items.push({ description: desc.trim(), quantity: qty || 1 });
      }
    }
  }
  return items;
}

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

function parseCsv(content: string): { itemNumber?: string; description: string; descriptionAr?: string; unit?: string; quantity?: number }[] {
  // Normalize line endings
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map(h => h.toLowerCase().replace(/['"]/g, "").trim());

  // Priority order: prefer explicit "description" / "وصف" / "بيان" over generic "item"
  const descPriority = ["description", "desc", "item description", "work description", "وصف", "بيان العمل", "البند", "الوصف"];
  const descArPriority = ["description ar", "arabic description", "الوصف العربي", "وصف عربي", "description arabic"];
  const qtyPriority = ["quantity", "qty", "الكمية", "كمية"];
  const unitPriority = ["unit", "uom", "الوحدة", "وحدة"];
  const numPriority = ["no", "no.", "#", "item no", "item number", "رقم", "م"];

  const findIdx = (priority: string[]) => {
    for (const key of priority) {
      const idx = headers.findIndex(h => h === key || h.includes(key));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const descIdx = findIdx(descPriority);
  const descArIdx = findIdx(descArPriority);
  const qtyIdx = findIdx(qtyPriority);
  const unitIdx = findIdx(unitPriority);
  const numIdx = findIdx(numPriority);

  // Fallback: use column 1 (index 1) as description if nothing matched or matched col 0 only
  const effectiveDescIdx = descIdx > 0 ? descIdx : (descIdx === 0 && headers.length > 1 ? 1 : descIdx);

  const results: { itemNumber?: string; description: string; descriptionAr?: string; unit?: string; quantity?: number }[] = [];

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const description = (effectiveDescIdx >= 0 ? cols[effectiveDescIdx] : cols[1] || cols[0]) || "";
    // Skip header-like rows or empty descriptions
    if (!description || description.length < 2) continue;
    if (description.toLowerCase().match(/^(description|desc|item|وصف|بيان)$/)) continue;

    const descAr = descArIdx >= 0 ? cols[descArIdx] : undefined;
    const rawQty = qtyIdx >= 0 ? cols[qtyIdx] : undefined;
    const qty = rawQty ? parseFloat(rawQty.replace(/[^0-9.]/g, "")) : NaN;

    results.push({
      itemNumber: numIdx >= 0 ? cols[numIdx] : undefined,
      description,
      descriptionAr: descAr && descAr.length > 1 ? descAr : undefined,
      unit: unitIdx >= 0 ? cols[unitIdx] || "No" : "No",
      quantity: !isNaN(qty) && qty > 0 ? qty : 1,
    });
  }
  return results;
}

function classifyItem(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes("cable") || desc.includes("كابل") || desc.includes("wire") || desc.includes("conductor")) return "Cables & Wiring";
  if (desc.includes("panel") || desc.includes("mdb") || desc.includes("db ") || desc.includes("distribution") || desc.includes("لوحة")) return "Panels & Distribution";
  if (desc.includes("light") || desc.includes("lamp") || desc.includes("fixture") || desc.includes("إضاءة") || desc.includes("luminaire")) return "Lighting";
  if (desc.includes("socket") || desc.includes("outlet") || desc.includes("plug") || desc.includes("مقبس")) return "Wiring Devices";
  if (desc.includes("conduit") || desc.includes("trunking") || desc.includes("duct") || desc.includes("tray")) return "Conduits & Trunking";
  if (desc.includes("breaker") || desc.includes("mcb") || desc.includes("mccb") || desc.includes("rcd") || desc.includes("قاطع")) return "Protection Devices";
  if (desc.includes("earthing") || desc.includes("grounding") || desc.includes("earth rod") || desc.includes("تأريض")) return "Earthing & Bonding";
  if (desc.includes("ups") || desc.includes("battery") || desc.includes("generator") || desc.includes("بطارية")) return "Power Systems";
  if (desc.includes("transformer") || desc.includes("محول")) return "Transformers";
  if (desc.includes("motor") || desc.includes("pump") || desc.includes("fan") || desc.includes("محرك")) return "Motors & Drives";
  return "General Electrical";
}

export { pricingQueue };
export default router;
