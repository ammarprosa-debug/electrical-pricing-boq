import { pgTable, serial, integer, text, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const laborCostsTable = pgTable("labor_costs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  region: text("region").notNull().default("Riyadh"),
  totalLaborSar: real("total_labor_sar"),
  totalLaborPct: real("total_labor_pct"),
  electricianDays: real("electrician_days"),
  helperDays: real("helper_days"),
  foremanDays: real("foreman_days"),
  supervisorDays: real("supervisor_days"),
  dailyRateElectrician: real("daily_rate_electrician"),
  dailyRateHelper: real("daily_rate_helper"),
  dailyRateForeman: real("daily_rate_foreman"),
  dailyRateSupervisor: real("daily_rate_supervisor"),
  laborByCategory: jsonb("labor_by_category"),
  recommendations: jsonb("recommendations"),
  recommendationsAr: text("recommendations_ar"),
  overtimeEstimateSar: real("overtime_estimate_sar"),
  safetyAllowanceSar: real("safety_allowance_sar"),
  toolsConsumablesSar: real("tools_consumables_sar"),
  grandTotalLaborSar: real("grand_total_labor_sar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type LaborCosts = typeof laborCostsTable.$inferSelect;
