import { pgTable, serial, integer, text, real, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const complianceStatusEnum = pgEnum("compliance_status", ["pass", "warning", "fail", "pending"]);
export const boqItemStatusEnum = pgEnum("boq_item_status", ["pending", "priced", "reviewed", "approved"]);
export const pricingSourceEnum = pgEnum("pricing_source", ["database", "ai_haiku", "ai_sonnet", "manual", "cache"]);

export const boqItemsTable = pgTable("boq_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  itemNumber: text("item_number"),
  descriptionEn: text("description_en").notNull(),
  descriptionAr: text("description_ar"),
  unit: text("unit").notNull(),
  quantity: real("quantity").notNull().default(1),
  categoryLevel1: text("category_level_1"),
  categoryLevel2: text("category_level_2"),
  categoryLevel3: text("category_level_3"),
  specs: jsonb("specs"),
  unitPriceEconomical: real("unit_price_economical"),
  unitPriceStandard: real("unit_price_standard"),
  unitPricePremium: real("unit_price_premium"),
  totalEconomical: real("total_economical"),
  totalStandard: real("total_standard"),
  totalPremium: real("total_premium"),
  laborCost: real("labor_cost"),
  vatAmount: real("vat_amount"),
  confidenceScore: real("confidence_score"),
  complianceStatus: complianceStatusEnum("compliance_status").default("pending"),
  complianceNotes: text("compliance_notes"),
  anomalyFlag: boolean("anomaly_flag").default(false),
  anomalyReason: text("anomaly_reason"),
  needsReview: boolean("needs_review").default(false),
  pricingSource: pricingSourceEnum("pricing_source"),
  alternativeMaterial: text("alternative_material"),
  alternativeSaving: real("alternative_saving"),
  sectionName: text("section_name"),
  supplierName: text("supplier_name"),
  supplyPrice: real("supply_price"),
  wastagePercent: real("wastage_percent"),
  installCost: real("install_cost"),
  accessCost: real("access_cost"),
  notes: text("notes"),
  status: boqItemStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBoqItemSchema = createInsertSchema(boqItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBoqItem = z.infer<typeof insertBoqItemSchema>;
export type BoqItem = typeof boqItemsTable.$inferSelect;
