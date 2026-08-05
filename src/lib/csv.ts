// Minimal CSV parser + helpers. Handles quoted fields with commas and escaped quotes.
export function parseCSV(text: string): Record<string, string>[] {
  const rows = parseCSVRows(text.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
      return obj;
    });
}

function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += ch;
    }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

export function pickFirst(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(row).find((rk) => rk.toLowerCase() === k.toLowerCase());
    if (found && row[found]) return row[found];
  }
  return "";
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
