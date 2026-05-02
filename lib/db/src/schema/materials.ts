import { pgTable, serial, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const materialsTable = pgTable("materials", {
  id: serial("id").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar"),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  unit: text("unit").notNull(),
  priceEconomical: real("price_economical").notNull(),
  priceStandard: real("price_standard").notNull(),
  pricePremium: real("price_premium").notNull(),
  sasoApproved: boolean("saso_approved").default(false),
  sasoNumber: text("saso_number"),
  brand: text("brand"),
  specs: text("specs"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const insertMaterialSchema = createInsertSchema(materialsTable).omit({ id: true });
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materialsTable.$inferSelect;
