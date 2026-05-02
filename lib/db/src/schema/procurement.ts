import { pgTable, serial, integer, text, real, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const procurementTable = pgTable("procurement", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  supplierName: text("supplier_name").notNull(),
  supplierNameAr: text("supplier_name_ar"),
  category: text("category").notNull(),
  itemCount: integer("item_count").notNull().default(0),
  totalSupplySar: real("total_supply_sar").notNull().default(0),
  bulkDiscountPct: real("bulk_discount_pct"),
  bulkDiscountSar: real("bulk_discount_sar"),
  leadTimeDays: integer("lead_time_days"),
  paymentTerms: text("payment_terms"),
  localAvailability: boolean("local_availability").default(true),
  importRequired: boolean("import_required").default(false),
  items: jsonb("items"),
  contactInfo: text("contact_info"),
  recommendationAr: text("recommendation_ar"),
  priority: text("priority").default("normal"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const procurementSummaryTable = pgTable("procurement_summary", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  totalSupplierCount: integer("total_supplier_count"),
  totalSupplySar: real("total_supply_sar"),
  totalBulkSavingsSar: real("total_bulk_savings_sar"),
  localPct: real("local_pct"),
  importPct: real("import_pct"),
  criticalLeadItems: jsonb("critical_lead_items"),
  procurementPlan: text("procurement_plan"),
  procurementPlanAr: text("procurement_plan_ar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Procurement = typeof procurementTable.$inferSelect;
export type ProcurementSummary = typeof procurementSummaryTable.$inferSelect;
