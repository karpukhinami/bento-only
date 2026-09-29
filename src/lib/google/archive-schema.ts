import type { BipolarFeedbackValue, ImageFeedbackRating } from "@/lib/image-feedback-types";

export type GenTrigger = "initial" | "regen_image" | "regen_after_edit";

/** Column indices (1-based) — must match docs/google-sheet-columns.txt */
export const SHEET_COL = {
  session_id: 1,
  created_at: 2,
  version: 3,
  drive_link: 4,
  gen_trigger: 5,
  subject: 6,
  class: 7,
  topic: 8,
  added_content: 9,
  style: 10,
  profile: 11,
  rating: 12,
  feedback_sent: 13,
  color: 14,
  composition: 15,
  artefacts: 16,
  text: 17,
  illustration: 18,
  comment: 19,
  analysis_model: 20,
  brief_model: 21,
  image_model: 22,
  folder_link: 23,
  image_id: 24,
} as const;

export const SHEET_COLUMN_COUNT = 24;

export function encodeRating(rating: ImageFeedbackRating | null | undefined): string {
  if (rating === "like") return "1";
  if (rating === "dislike") return "0";
  return "";
}

export function encodeBipolar(value: BipolarFeedbackValue | undefined): string {
  if (value === "left") return "1";
  if (value === "right") return "0";
  return "-";
}

export function encodeIllustration(
  showRow: boolean,
  value: BipolarFeedbackValue | undefined,
): string {
  if (!showRow) return "";
  if (value === "left") return "1";
  if (value === "right") return "0";
  return "-";
}

export interface ArchiveGenerationFields {
  sessionId: string;
  createdAt: string;
  version: number;
  driveLink: string;
  genTrigger: GenTrigger;
  subject: string;
  className: string;
  topic: string;
  addedContent: boolean;
  style: string;
  profile: string;
  analysisModel: string;
  briefModel: string;
  imageModel: string;
  folderLink: string;
  imageId: string;
}

export function buildInitialSheetRow(fields: ArchiveGenerationFields): string[] {
  const row = new Array<string>(SHEET_COLUMN_COUNT).fill("");
  row[SHEET_COL.session_id - 1] = fields.sessionId;
  row[SHEET_COL.created_at - 1] = fields.createdAt;
  row[SHEET_COL.version - 1] = String(fields.version);
  row[SHEET_COL.drive_link - 1] = fields.driveLink;
  row[SHEET_COL.gen_trigger - 1] = fields.genTrigger;
  row[SHEET_COL.subject - 1] = fields.subject;
  row[SHEET_COL.class - 1] = fields.className;
  row[SHEET_COL.topic - 1] = fields.topic;
  row[SHEET_COL.added_content - 1] = fields.addedContent ? "1" : "0";
  row[SHEET_COL.style - 1] = fields.style;
  row[SHEET_COL.profile - 1] = fields.profile;
  row[SHEET_COL.analysis_model - 1] = fields.analysisModel;
  row[SHEET_COL.brief_model - 1] = fields.briefModel;
  row[SHEET_COL.image_model - 1] = fields.imageModel;
  row[SHEET_COL.folder_link - 1] = fields.folderLink;
  row[SHEET_COL.image_id - 1] = fields.imageId;
  return row;
}

export interface FeedbackUpdateFields {
  rating: ImageFeedbackRating;
  feedbackSent: 0 | 1;
  color: BipolarFeedbackValue;
  composition: BipolarFeedbackValue;
  artefacts: BipolarFeedbackValue;
  text: BipolarFeedbackValue;
  illustration: BipolarFeedbackValue | undefined;
  showIllustrationsRow: boolean;
  comment: string;
}

export function buildFeedbackSheetValues(fields: FeedbackUpdateFields): string[] {
  return [
    encodeRating(fields.rating),
    String(fields.feedbackSent),
    encodeBipolar(fields.color),
    encodeBipolar(fields.composition),
    encodeBipolar(fields.artefacts),
    encodeBipolar(fields.text),
    encodeIllustration(fields.showIllustrationsRow, fields.illustration),
    fields.comment.trim(),
  ];
}

export function parseSheetRowFromUpdatedRange(updatedRange: string | null | undefined): number | null {
  if (!updatedRange) return null;
  const match = updatedRange.match(/![A-Z]+(\d+)/i);
  if (!match) return null;
  const row = Number.parseInt(match[1], 10);
  return Number.isFinite(row) ? row : null;
}

export interface SimpleImageArchiveMeta {
  sheetRow: number;
  driveFileId: string;
  driveLink: string;
  folderLink: string;
}
