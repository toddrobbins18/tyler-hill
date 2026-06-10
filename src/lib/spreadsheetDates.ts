/** Convert Excel serial (1900 date system) to YYYY-MM-DD. */
export function excelSerialToYmd(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const d = new Date(epoch + Math.round(serial) * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Normalize spreadsheet / CSV date cells: ISO, US, Excel serial numbers, or empty.
 */
export function normalizeSpreadsheetDate(value: unknown): string | null {
  if (value == null) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 30000 && value < 60000) {
      return excelSerialToYmd(value);
    }
    return null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const serial = Number(raw);
  if (/^\d{4,5}(\.\d+)?$/.test(raw) && Number.isFinite(serial) && serial > 30000 && serial < 60000) {
    return excelSerialToYmd(Math.round(serial));
  }

  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const mm = us[1].padStart(2, "0");
    const dd = us[2].padStart(2, "0");
    return `${us[3]}-${mm}-${dd}`;
  }

  return null;
}
