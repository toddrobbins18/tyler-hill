/**
 * RFC 4180–style CSV parsing: commas/quotes/newlines inside double-quoted fields.
 * Matches behavior expected when Notes cells contain literal line breaks.
 */
export function parseCsvDocument(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }

    if (c === "\r") {
      if (text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i++;
      continue;
    }

    if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i++;
      continue;
    }

    field += c;
    i++;
  }

  row.push(field);
  rows.push(row);

  while (rows.length > 1) {
    const last = rows[rows.length - 1];
    if (last.every((cell) => cell === "")) {
      rows.pop();
    } else {
      break;
    }
  }

  return rows;
}
