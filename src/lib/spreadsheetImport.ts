import * as XLSX from "xlsx";
import { parseCsvDocument } from "@/lib/csvLine";
import { normalizeRowKeys } from "@/lib/spreadsheetRowUtils";

const SPREADSHEET_EXTENSIONS = [".csv", ".txt", ".xlsx", ".xls"];

export function isSpreadsheetFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return SPREADSHEET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Serialize parsed spreadsheet rows back to CSV text (for legacy CSV-only upload paths). */
export function spreadsheetRowsToCsvText(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          return escapeCsvCell(value == null ? "" : String(value).trim());
        })
        .join(","),
    ),
  ];
  return lines.join("\n");
}

/** Load CSV or Excel file as string-keyed row objects (compatible with parseCSV consumers). */
export async function loadSpreadsheetRowsFromFile(
  file: File,
): Promise<Record<string, string>[]> {
  if (!isSpreadsheetFileName(file.name)) {
    throw new Error("Please upload a CSV or Excel file (.csv, .xlsx, .xls)");
  }
  const { rows } = await parseSpreadsheetFile(file);
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = value == null ? "" : String(value).trim();
    }
    return out;
  });
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
export function parseSpreadsheetFile(
  file: File,
): Promise<{ rows: Record<string, unknown>[]; fileName: string }> {
  return new Promise((resolve, reject) => {
    const fileName = file.name;
    const lower = fileName.toLowerCase();

    if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        
        // Scan for the first real row with headers
        let lines = text.split(/\r?\n/);
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(10, lines.length); i++) {
          const lower = lines[i].toLowerCase();
          // Avoid matching the 'bunk_staff_template' row
          if (lower.includes('template')) continue;
          
          if (lower.includes('person id') || 
              lower.includes('personid') ||
              lower.includes('bunk number') || 
              lower.includes('bunk name') ||
              lower.includes('day of') ||
              lower.includes('day off') ||
              lower.includes('night off') ||
              lower.includes('is primary') ||
              lower.includes('first name') ||
              lower.includes('last name') ||
              (lower.includes('date') && !lower.includes('template')) ||
              lower.includes('time') ||
              lower.includes('rfid')) {
            headerRowIndex = i;
            break;
          }
        }
        
        // Join the remaining text from the header row onwards
        const relevantText = lines.slice(headerRowIndex).join('\n');
        const records = parseCsvDocument(relevantText);
        resolve({ rows: recordsToObjects(records), fileName });
      };
      reader.onerror = () => reject(new Error("Failed to read CSV file"));
      reader.readAsText(file);
      return;
    }

    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: "array", cellDates: false, raw: true });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) {
          return resolve({ rows: [], fileName });
        }
        const sheet = wb.Sheets[sheetName];
        
        // Find the actual data range, skipping title rows
        const range = XLSX.utils.decode_range(sheet['!ref'] || "A1:A1");
        let headerRowIndex = range.s.r;
        
        // Look through first 10 rows for headers
        for (let r = range.s.r; r <= Math.min(range.s.r + 10, range.e.r); r++) {
          let hasHeaders = false;
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[XLSX.utils.encode_cell({r, c})];
            if (cell && cell.v) {
              const val = String(cell.v).toLowerCase();
              if (val.includes('template')) continue;
              
              if (val.includes('person id') || 
                  val.includes('personid') ||
                  val.includes('bunk number') || 
                  val.includes('bunk name') ||
                  val.includes('day of') ||
                  val.includes('day off') ||
                  val.includes('night off') ||
                  val.includes('is primary') ||
                  val.includes('first name') ||
                  val.includes('last name') ||
                  val.includes('date') ||
                  val.includes('time') ||
                  val.includes('rfid')) {
                hasHeaders = true;
                break;
              }
            }
          }
          if (hasHeaders) {
            headerRowIndex = r;
            break;
          }
        }
        
        // Adjust the range to start from the detected header row
        const newRange = { ...range, s: { ...range.s, r: headerRowIndex } };
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: null,
          raw: true,
          range: newRange
        });
        resolve({
          rows: json.map((row) => normalizeRowKeys(row)),
          fileName,
        });
      };
      reader.onerror = () => reject(new Error("Failed to read Excel file"));
      reader.readAsArrayBuffer(file);
      return;
    }

    reject(new Error("Unsupported file type. Use .csv, .xlsx, or .xls"));
  });
}
