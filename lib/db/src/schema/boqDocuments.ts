import { pgTable, serial, integer, text, real, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const boqDocumentsTable = pgTable("boq_documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull().default("formatted_boq"),
  scenario: text("scenario").notNull().default("standard"),
  version: integer("version").notNull().default(1),
  titleEn: text("title_en"),
  titleAr: text("title_ar"),
  clientName: text("client_name"),
  projectLocation: text("project_location"),
  issueDate: text("issue_date"),
  preparedBy: text("prepared_by").default("Goval BOQ System"),
  sections: jsonb("sections"),
  summary: jsonb("summary"),
  totalBeforeVat: real("total_before_vat"),
  vatAmount: real("vat_amount"),
  totalWithVat: real("total_with_vat"),
  economicalTotal: real("economical_total"),
  premiumTotal: real("premium_total"),
  technicalNotes: text("technical_notes"),
  technicalNotesAr: text("technical_notes_ar"),
  termsAndConditions: text("terms_and_conditions"),
  termsAndConditionsAr: text("terms_and_conditions_ar"),
  reviewStatus: text("review_status").default("draft"),
  reviewNotes: text("review_notes"),
  reviewNotesAr: text("review_notes_ar"),
  qualityScore: real("quality_score"),
  issuesFound: jsonb("issues_found"),
  isApproved: boolean("is_approved").default(false),
  htmlContent: text("html_content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BoqDocument = typeof boqDocumentsTable.$inferSelect;
