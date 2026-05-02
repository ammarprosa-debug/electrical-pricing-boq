import { pgTable, serial, integer, text, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const projectTimelineTable = pgTable("project_timeline", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  totalDurationDays: integer("total_duration_days"),
  totalDurationWeeks: integer("total_duration_weeks"),
  phases: jsonb("phases"),
  criticalPath: jsonb("critical_path"),
  milestones: jsonb("milestones"),
  resourcePeakWeek: integer("resource_peak_week"),
  resourcePeakWorkers: integer("resource_peak_workers"),
  estimatedStartDate: text("estimated_start_date"),
  estimatedEndDate: text("estimated_end_date"),
  notes: text("notes"),
  notesAr: text("notes_ar"),
  assumptions: text("assumptions"),
  assumptionsAr: text("assumptions_ar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const timelinePhasesTable = pgTable("timeline_phases", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  timelineId: integer("timeline_id"),
  phaseNumber: integer("phase_number").notNull(),
  phaseNameEn: text("phase_name_en").notNull(),
  phaseNameAr: text("phase_name_ar").notNull(),
  startWeek: integer("start_week").notNull(),
  endWeek: integer("end_week").notNull(),
  durationWeeks: integer("duration_weeks").notNull(),
  laborCount: integer("labor_count"),
  costSar: real("cost_sar"),
  costPct: real("cost_pct"),
  categories: jsonb("categories"),
  deliverables: jsonb("deliverables"),
  deliverablesAr: text("deliverables_ar"),
  prerequisites: text("prerequisites"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ProjectTimeline = typeof projectTimelineTable.$inferSelect;
export type TimelinePhase = typeof timelinePhasesTable.$inferSelect;
