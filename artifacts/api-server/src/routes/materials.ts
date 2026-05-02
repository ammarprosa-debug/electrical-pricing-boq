import { Router } from "express";
import { db } from "@workspace/db";
import { materialsTable } from "@workspace/db";
import { ilike, or, eq } from "drizzle-orm";
import { ListMaterialsQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/materials", async (req, res) => {
  const { category, search } = ListMaterialsQueryParams.parse(req.query);
  try {
    let query = db.select().from(materialsTable);
    if (search) {
      query = query.where(
        or(
          ilike(materialsTable.nameEn, `%${search}%`),
          ilike(materialsTable.nameAr, `%${search}%`)
        )
      ) as typeof query;
    } else if (category) {
      query = query.where(eq(materialsTable.category, category)) as typeof query;
    }
    const results = await query.limit(100);
    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Failed to list materials");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
