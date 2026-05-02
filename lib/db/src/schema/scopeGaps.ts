import { pgTable, serial, integer, text, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gapRiskEnum = pgEnum("gap_risk", ["low", "medium", "high", "critical"]);

export const scopeGapsTable = pgTable("scope_gaps", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  system: text("system").notNull(),
  systemAr: text("system_ar"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  riskLevel: gapRiskEnum("risk_level").notNull().default("medium"),
  estimatedCostMin: real("estimated_cost_min"),
  estimatedCostMax: real("estimated_cost_max"),
  recommendation: text("recommendation"),
  recommendationAr: text("recommendation_ar"),
  boqSection: text("boq_section"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScopeGapSchema = createInsertSchema(scopeGapsTable).omit({ id: true, createdAt: true });
export type InsertScopeGap = z.infer<typeof insertScopeGapSchema>;
export type ScopeGap = typeof scopeGapsTable.$inferSelect;
