import { pgTable, serial, text, integer, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectStatusEnum = pgEnum("project_status", ["draft", "parsing", "pricing", "reviewing", "completed", "failed"]);
export const regionEnum = pgEnum("region", ["riyadh", "jeddah", "dammam", "other"]);

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  status: projectStatusEnum("status").notNull().default("draft"),
  region: regionEnum("region").notNull().default("riyadh"),
  totalItems: integer("total_items").notNull().default(0),
  pricedItems: integer("priced_items").notNull().default(0),
  reviewItems: integer("review_items").notNull().default(0),
  totalEconomical: real("total_economical"),
  totalStandard: real("total_standard"),
  totalPremium: real("total_premium"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
