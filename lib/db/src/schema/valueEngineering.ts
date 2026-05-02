import { pgTable, serial, integer, text, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const valueEngineeringTable = pgTable("value_engineering", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  boqItemId: integer("boq_item_id"),
  category: text("category"),
  finding: text("finding").notNull(),
  findingAr: text("finding_ar"),
  currentSpecEn: text("current_spec_en"),
  currentSpecAr: text("current_spec_ar"),
  proposedSpecEn: text("proposed_spec_en"),
  proposedSpecAr: text("proposed_spec_ar"),
  currentCostSar: real("current_cost_sar"),
  proposedCostSar: real("proposed_cost_sar"),
  savingsSar: real("savings_sar"),
  savingsPct: real("savings_pct"),
  impactLevel: text("impact_level").default("low"),
  riskLevel: text("risk_level").default("low"),
  recommendation: text("recommendation"),
  recommendationAr: text("recommendation_ar"),
  sasoCompliant: text("saso_compliant").default("yes"),
  status: text("status").default("proposed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const veProjectSummaryTable = pgTable("ve_project_summary", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  totalFindings: integer("total_findings").default(0),
  totalPotentialSavingsSar: real("total_potential_savings_sar").default(0),
  highImpactCount: integer("high_impact_count").default(0),
  lowRiskCount: integer("low_risk_count").default(0),
  recommendedSavingsSar: real("recommended_savings_sar").default(0),
  overallRecommendation: text("overall_recommendation"),
  overallRecommendationAr: text("overall_recommendation_ar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ValueEngineering = typeof valueEngineeringTable.$inferSelect;
export type VeProjectSummary = typeof veProjectSummaryTable.$inferSelect;
