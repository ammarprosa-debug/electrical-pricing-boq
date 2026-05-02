import { pgTable, serial, integer, text, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { materialsTable } from "./materials";

export const materialPriceHistoryTable = pgTable("material_price_history", {
  id: serial("id").primaryKey(),
  materialId: integer("material_id").notNull().references(() => materialsTable.id, { onDelete: "cascade" }),
  priceEconomical: real("price_economical").notNull(),
  priceStandard: real("price_standard").notNull(),
  pricePremium: real("price_premium").notNull(),
  changePct: real("change_pct"),
  changeReason: text("change_reason"),
  changeReasonAr: text("change_reason_ar"),
  marketCondition: text("market_condition"),
  source: text("source").default("ai_agent"),
  updatedBy: text("updated_by").default("Agent 15"),
  metadata: jsonb("metadata"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export const materialUpdateJobsTable = pgTable("material_update_jobs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("pending"),
  updatedCount: integer("updated_count").default(0),
  addedCount: integer("added_count").default(0),
  totalReviewed: integer("total_reviewed").default(0),
  summary: text("summary"),
  summaryAr: text("summary_ar"),
  marketInsights: jsonb("market_insights"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type MaterialPriceHistory = typeof materialPriceHistoryTable.$inferSelect;
export type MaterialUpdateJob = typeof materialUpdateJobsTable.$inferSelect;
