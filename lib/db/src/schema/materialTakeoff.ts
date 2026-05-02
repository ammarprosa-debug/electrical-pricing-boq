import { pgTable, serial, integer, text, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const materialTakeoffTable = pgTable("material_takeoff", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  boqItemId: integer("boq_item_id").notNull(),
  parentBoqDesc: text("parent_boq_desc").notNull(),
  lineNo: integer("line_no").notNull().default(1),
  subItemCode: text("sub_item_code"),
  descriptionEn: text("description_en").notNull(),
  descriptionAr: text("description_ar"),
  category: text("category"),
  brand: text("brand"),
  brandAr: text("brand_ar"),
  unit: text("unit").notNull().default("NO."),
  quantity: real("quantity").notNull().default(1),
  wastagePercent: real("wastage_percent").default(0),
  unitPriceMin: real("unit_price_min"),
  unitPriceStd: real("unit_price_std"),
  unitPricePremium: real("unit_price_premium"),
  totalPriceStd: real("total_price_std"),
  isLabor: boolean("is_labor").default(false),
  isAccessory: boolean("is_accessory").default(false),
  isMajor: boolean("is_major").default(false),
  specs: jsonb("specs"),
  notes: text("notes"),
  notesAr: text("notes_ar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMaterialTakeoffSchema = createInsertSchema(materialTakeoffTable)
  .omit({ id: true, createdAt: true });
export type InsertMaterialTakeoff = z.infer<typeof insertMaterialTakeoffSchema>;
export type MaterialTakeoff = typeof materialTakeoffTable.$inferSelect;
