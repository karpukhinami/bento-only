import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google/auth";
import {
  buildFeedbackSheetValues,
  buildInitialSheetRow,
  parseSheetRowFromUpdatedRange,
  SHEET_COL,
  type ArchiveGenerationFields,
  type FeedbackUpdateFields,
} from "@/lib/google/archive-schema";

let cachedSheetName: { spreadsheetId: string; name: string } | null = null;

/** A1 prefix with quoted sheet title (handles «Лист1», spaces, etc.). */
function sheetRange(sheetTitle: string, cells: string): string {
  const escaped = sheetTitle.replace(/'/g, "''");
  return `'${escaped}'!${cells}`;
}

async function resolveSheetName(auth: OAuth2Client): Promise<string> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID?.trim();
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID missing");

  const configured = process.env.GOOGLE_SHEET_NAME?.trim();
  if (
    cachedSheetName?.spreadsheetId === spreadsheetId &&
    (!configured || cachedSheetName.name === configured)
  ) {
    return cachedSheetName.name;
  }

  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });

  const titles =
    meta.data.sheets
      ?.map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t)) ?? [];

  if (titles.length === 0) {
    throw new Error("Google Таблица не содержит листов");
  }

  let name: string;
  if (configured) {
    if (!titles.includes(configured)) {
      throw new Error(
        `Лист «${configured}» не найден. Доступные листы: ${titles.join(", ")}. Проверьте GOOGLE_SHEET_NAME на Render.`,
      );
    }
    name = configured;
  } else {
    name = titles[0];
  }

  cachedSheetName = { spreadsheetId, name };
  return name;
}

function columnLetter(index1Based: number): string {
  let n = index1Based;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function appendGenerationRow(
  fields: ArchiveGenerationFields,
): Promise<{ sheetRow: number }> {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const name = await resolveSheetName(auth);
  const row = buildInitialSheetRow(fields);

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: sheetRange(name, "A:A"),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  const sheetRow = parseSheetRowFromUpdatedRange(res.data.updates?.updatedRange);
  if (!sheetRow) throw new Error("Could not determine appended sheet row");

  return { sheetRow };
}

export async function findSheetRowByImageId(imageId: string): Promise<number | null> {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const name = await resolveSheetName(auth);
  const col = columnLetter(SHEET_COL.image_id);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: sheetRange(name, `${col}:${col}`),
  });

  const rows = res.data.values ?? [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.[0]?.trim() === imageId) return i + 1;
  }
  return null;
}

export async function updateFeedbackRow(
  sheetRow: number,
  fields: FeedbackUpdateFields,
): Promise<void> {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const name = await resolveSheetName(auth);
  const startCol = columnLetter(SHEET_COL.rating);
  const endCol = columnLetter(SHEET_COL.comment);
  const values = buildFeedbackSheetValues(fields);

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: sheetRange(name, `${startCol}${sheetRow}:${endCol}${sheetRow}`),
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}
