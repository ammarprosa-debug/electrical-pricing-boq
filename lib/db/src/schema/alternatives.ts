import { pgTable, serial, integer, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const alternativesTable = pgTable("alternatives", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  boqItemId: integer("boq_item_id").notNull(),
  rank: integer("rank").notNull().default(1),
  brand: text("brand").notNull(),
  brandAr: text("brand_ar"),
  spec: text("spec").notNull(),
  specAr: text("spec_ar"),
  unitPriceSar: real("unit_price_sar").notNull(),
  originalPriceSar: real("original_price_sar"),
  savingsPct: real("savings_pct"),
  savingsSar: real("savings_sar"),
  sasoApproved: boolean("saso_approved").default(true),
  iecCompliant: boolean("iec_compliant").default(true),
  availability: text("availability"),
  notes: text("notes"),
  notesAr: text("notes_ar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAlternativeSchema = createInsertSchema(alternativesTable).omit({ id: true, createdAt: true });
export type InsertAlternative = z.infer<typeof insertAlternativeSchema>;
export type Alternative = typeof alternativesTable.$inferSelect;
