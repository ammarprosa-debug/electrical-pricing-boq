import { pgTable, serial, integer, text, real, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const subcontractorSplitTable = pgTable("subcontractor_split", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  tradeCategory: text("trade_category").notNull(),
  tradeCategoryAr: text("trade_category_ar"),
  isSubcontract: boolean("is_subcontract").notNull().default(false),
  subcontractorType: text("subcontractor_type"),
  subcontractorTypeAr: text("subcontractor_type_ar"),
  scopeDescription: text("scope_description"),
  scopeDescriptionAr: text("scope_description_ar"),
  estimatedValueSar: real("estimated_value_sar"),
  valuePct: real("value_pct"),
  boqItemIds: jsonb("boq_item_ids"),
  reasonEn: text("reason_en"),
  reasonAr: text("reason_ar"),
  subcontractorRequirements: text("subcontractor_requirements"),
  subcontractorRequirementsAr: text("subcontractor_requirements_ar"),
  riskLevel: text("risk_level").default("low"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subcontractorSummaryTable = pgTable("subcontractor_summary", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  mainContractorValueSar: real("main_contractor_value_sar"),
  mainContractorPct: real("main_contractor_pct"),
  subcontractorTotalSar: real("subcontractor_total_sar"),
  subcontractorPct: real("subcontractor_pct"),
  subcontractorCount: integer("subcontractor_count"),
  specialistSubsCount: integer("specialist_subs_count"),
  strategyEn: text("strategy_en"),
  strategyAr: text("strategy_ar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SubcontractorSplit = typeof subcontractorSplitTable.$inferSelect;
export type SubcontractorSummary = typeof subcontractorSummaryTable.$inferSelect;
