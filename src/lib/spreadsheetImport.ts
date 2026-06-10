import * as XLSX from "xlsx";
import { parseCsvDocument } from "@/lib/csvLine";
import { normalizeRowKeys } from "@/lib/spreadsheetRowUtils";

const SPREADSHEET_EXTENSIONS = [".csv", ".txt", ".xlsx", ".xls"];

export function isSpreadsheetFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return SPREADSHEET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function recordsToObjects(records: string[][]): Record<string, unknown>[] {
  if (records.length === 0) return [];

  const headers = records[0].map((h) => h.replace(/^"|"$/g, "").trim());
  return records.slice(1).map((values) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      const v = values[index];
      obj[header] = v != null && String(v).length > 0 ? String(v).trim() : null;
    });
    return normalizeRowKeys(obj);
  });
}

/** Parse CSV text or Excel binary into row objects (first sheet for Excel). */
export async function parseSpreadsheetFile(
  file: File,
): Promise<{ rows: Record<string, unknown>[]; fileName: string }> {
  const fileName = file.name;
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = await file.text();
    const records = parseCsvDocument(text);
    return { rows: recordsToObjects(records), fileName };
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: false, raw: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return { rows: [], fileName };
    }
    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: true,
    });
    return {
      rows: json.map((row) => normalizeRowKeys(row)),
      fileName,
    };
  }

  throw new Error("Unsupported file type. Use .csv, .xlsx, or .xls");
}
