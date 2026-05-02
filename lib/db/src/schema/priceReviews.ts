import { pgTable, serial, integer, text, real, boolean, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reviewSeverityEnum = pgEnum("review_severity", ["info", "warning", "critical"]);
export const reviewStatusEnum = pgEnum("review_status", ["pending", "accepted", "rejected", "auto_fixed"]);

export const priceReviewsTable = pgTable("price_reviews", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  boqItemId: integer("boq_item_id"),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  reviewType: text("review_type").notNull(),
  severity: reviewSeverityEnum("severity").notNull().default("info"),
  status: reviewStatusEnum("status").notNull().default("pending"),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  currentValue: real("current_value"),
  suggestedValue: real("suggested_value"),
  minMarketValue: real("min_market_value"),
  maxMarketValue: real("max_market_value"),
  variance: real("variance"),
  variancePercent: real("variance_percent"),
  recommendation: text("recommendation"),
  recommendationAr: text("recommendation_ar"),
  autoFixApplied: boolean("auto_fix_applied").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPriceReviewSchema = createInsertSchema(priceReviewsTable)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPriceReview = z.infer<typeof insertPriceReviewSchema>;
export type PriceReview = typeof priceReviewsTable.$inferSelect;
