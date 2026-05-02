import { pgTable, serial, integer, text, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectRiskTable = pgTable("project_risk", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().unique(),
  overallRiskLevel: text("overall_risk_level").notNull().default("medium"),
  totalProjectCost: real("total_project_cost"),
  commodityExposureSar: real("commodity_exposure_sar"),
  commodityExposurePct: real("commodity_exposure_pct"),
  recommendedContingencySar: real("recommended_contingency_sar"),
  recommendedContingencyPct: real("recommended_contingency_pct"),
  copperExposureSar: real("copper_exposure_sar"),
  aluminumExposureSar: real("aluminum_exposure_sar"),
  steelExposureSar: real("steel_exposure_sar"),
  itemsAtRisk: jsonb("items_at_risk"),
  categoryBreakdown: jsonb("category_breakdown"),
  anomalyCount: integer("anomaly_count").default(0),
  anomalyCritical: integer("anomaly_critical").default(0),
  scopeGapCount: integer("scope_gap_count").default(0),
  scopeGapEstimatedCost: real("scope_gap_estimated_cost"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectRiskSchema = createInsertSchema(projectRiskTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProjectRisk = z.infer<typeof insertProjectRiskSchema>;
export type ProjectRisk = typeof projectRiskTable.$inferSelect;
