/** Pull printable strings out of a PDF so we can search for bus / group titles. */

function decodePdfLiteral(bytes: Uint8Array, start: number): { text: string; next: number } {
  let i = start;
  let out = "";
  let depth = 1;
  while (i < bytes.length && depth > 0) {
    const ch = bytes[i];
    if (ch === 0x5c && i + 1 < bytes.length) {
      const n = bytes[i + 1];
      if (n >= 0x30 && n <= 0x37) {
        let oct = "";
        let k = i + 1;
        while (k < bytes.length && oct.length < 3 && bytes[k] >= 0x30 && bytes[k] <= 0x37) {
          oct += String.fromCharCode(bytes[k]);
          k += 1;
        }
        out += String.fromCharCode(parseInt(oct, 8));
        i = k;
        continue;
      }
      if (n === 0x6e) out += "\n";
      else if (n === 0x72) out += "\r";
      else if (n === 0x74) out += "\t";
      else if (n !== 0x0a && n !== 0x0d) out += String.fromCharCode(n);
      i += 2;
      continue;
    }
    if (ch === 0x28) depth += 1;
    if (ch === 0x29) {
      depth -= 1;
      i += 1;
      if (depth === 0) break;
      out += ")";
      continue;
    }
    out += String.fromCharCode(ch);
    i += 1;
  }
  return { text: out, next: i };
}

function decodePdfHexString(raw: string): string {
  const hex = raw.replace(/[^0-9A-Fa-f]/g, "");
  if (hex.length < 4) return "";
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2).padEnd(2, "0"), 16));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return out;
  }
  return String.fromCharCode(...bytes);
}

/** Concatenate PDF literal / hex strings — enough to find Nest bus and group titles. */
export function extractPdfLiteralStrings(buf: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < buf.length; i += 1) {
    if (buf[i] === 0x28) {
      const { text, next } = decodePdfLiteral(buf, i + 1);
      i = next - 1;
      if (text.trim().length >= 2) parts.push(text);
      continue;
    }
    if (buf[i] === 0x3c) {
      let j = i + 1;
      let hex = "";
      while (j < buf.length && buf[j] !== 0x3e) {
        hex += String.fromCharCode(buf[j]);
        j += 1;
        if (hex.length > 400) break;
      }
      if (j < buf.length && buf[j] === 0x3e && /^[0-9A-Fa-f\s]+$/.test(hex) && hex.replace(/\s/g, "").length >= 8) {
        const decoded = decodePdfHexString(hex);
        if (decoded.trim().length >= 2) parts.push(decoded);
        i = j;
      }
    }
  }
  return parts.join(" ");
}
