#!/usr/bin/env node
/**
 * Generate SQL to backfill children.home_address from bundled 2026 MapPoint CSVs.
 * Run: node scripts/generate-mappoint-address-backfill.mjs > supabase/scripts/generated_mappoint_address_updates.sql
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function escSql(value) {
  return String(value).replace(/'/g, "''");
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) {
        cols.push(cur);
        cur = "";
      } else cur += ch;
    }
    cols.push(cur);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").replace(/^"|"$/g, "").trim();
    });
    return row;
  });
}

function normKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function expandMappointCamperNames(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (!trimmed.includes("&") && !trimmed.includes(",")) return [trimmed];
  const segments = trimmed.split(/\s*,\s*|\s*&\s/).map((p) => p.trim()).filter(Boolean);
  if (segments.length <= 1) return [trimmed];
  let sharedLastName = "";
  for (let i = segments.length - 1; i >= 0; i--) {
    const tokens = segments[i].split(/\s+/);
    if (tokens.length >= 2) {
      sharedLastName = tokens.slice(1).join(" ");
      break;
    }
  }
  const out = [];
  for (const segment of segments) {
    const tokens = segment.split(/\s+/);
    if (tokens.length >= 2) out.push(segment);
    else if (sharedLastName) out.push(`${segment} ${sharedLastName}`);
    else out.push(segment);
  }
  return [...new Set(out.map((n) => n.trim()))].filter(Boolean);
}

function registerHint(hints, rawName, address) {
  const addr = address.trim();
  if (!addr || !/\d/.test(addr)) return;
  for (const name of expandMappointCamperNames(rawName)) {
    const key = normKey(name);
    if (key && !hints.has(key)) hints.set(key, addr);
  }
}

const routesCsv = fs.readFileSync(path.join(root, "data/north_shore_mappoint_routes_2026.csv"), "utf8");
const addressesCsv = fs.readFileSync(path.join(root, "data/north_shore_mappoint_addresses_2026.csv"), "utf8");

const hints = new Map();

for (const row of parseCSV(routesCsv)) {
  if ((row.direction || "AM").toUpperCase() !== "AM") continue;
  const address =
    row.address?.trim() ||
    [row.street, row.city, row.zip ? `NY ${row.zip}` : ""].filter(Boolean).join(", ");
  registerHint(hints, row.camper_name || "", address);
}

for (const row of parseCSV(addressesCsv)) {
  const address =
    row.address?.trim() ||
    [row.street, row.city, row.zip ? `NY ${row.zip}` : ""].filter(Boolean).join(", ");
  registerHint(hints, row.name || "", address);
}

const entries = [...hints.entries()].sort(([a], [b]) => a.localeCompare(b));

console.log("-- AUTO-GENERATED from 2026 MapPoint CSVs. Do not edit by hand.");
console.log("-- Backfills NS 2027 children.home_address where blank, matched by camper name.");
console.log("BEGIN;\n");

console.log(`CREATE TEMP TABLE mappoint_address_hints (
  name_key text PRIMARY KEY,
  address text NOT NULL
) ON COMMIT DROP;\n`);

const chunkSize = 80;
for (let i = 0; i < entries.length; i += chunkSize) {
  const chunk = entries.slice(i, i + chunkSize);
  const values = chunk
    .map(([nameKey, address]) => `  ('${escSql(nameKey)}', '${escSql(address)}')`)
    .join(",\n");
  console.log(`INSERT INTO mappoint_address_hints (name_key, address) VALUES\n${values};\n`);
}

console.log(`UPDATE public.children c
SET home_address = h.address, updated_at = now()
FROM mappoint_address_hints h
JOIN public.companies co ON co.slug = 'north-shore-day-camp'
WHERE c.company_id = co.id
  AND c.season = '2027'
  AND (c.home_address IS NULL OR trim(c.home_address) = '')
  AND lower(trim(regexp_replace(c.name, '\\s+', ' ', 'g'))) = h.name_key;

SELECT
  COUNT(*) FILTER (WHERE NULLIF(trim(home_address), '') IS NOT NULL) AS with_address,
  COUNT(*) FILTER (WHERE NULLIF(trim(home_address), '') IS NULL) AS still_missing
FROM public.children c
JOIN public.companies co ON co.id = c.company_id
WHERE co.slug = 'north-shore-day-camp' AND c.season = '2027';

COMMIT;
`);

console.error(`Generated ${entries.length} name→address hints`);
