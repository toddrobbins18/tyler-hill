/** Case-insensitive header lookup for CSV / Excel rows. */
export function pickCell(row: Record<string, unknown>, ...aliases: string[]): string {
  const normalized = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    normalized.set(key.trim().toLowerCase(), value);
  }

  for (const alias of aliases) {
    const v = normalized.get(alias.trim().toLowerCase());
    if (v != null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }

  for (const alias of aliases) {
    const v = row[alias];
    if (v != null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }

  return "";
}

export function parseYesNo(value: string): boolean {
  return ["true", "yes", "1", "y"].includes(value.trim().toLowerCase());
}

/** Trim object keys (Excel headers often have trailing spaces). */
export function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.trim()] = value;
  }
  return out;
}
