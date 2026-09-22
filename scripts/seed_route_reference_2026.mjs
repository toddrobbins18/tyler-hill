#!/usr/bin/env node
/**
 * Seed MapPoint 2026 reference data into route_reference_* warehouse tables.
 *
 * Usage (from tyler-hill/):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed_route_reference_2026.mjs
 *
 * Optional:
 *   COMPANY_SLUG=north-shore-day-camp REFERENCE_SEASON=2026
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY_SLUG = process.env.COMPANY_SLUG || "north-shore-day-camp";
const REFERENCE_SEASON = process.env.REFERENCE_SEASON || "2026";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const csvPath = path.join(ROOT, "data", "north_shore_mappoint_routes_2026.csv");
const geocodesPath = path.join(ROOT, "data", "north_shore_mappoint_geocodes_2026.json");

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        cols.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    cols.push(cur);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

function normKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function rowAddress(row) {
  if (row.address) return row.address.trim();
  const street = (row.street || "").trim();
  const city = (row.city || "").trim();
  const zip = (row.zip || "").trim();
  if (!street || !city) return "";
  return zip ? `${street}, ${city}, NY ${zip}` : `${street}, ${city}, NY`;
}

function isValidRow(row) {
  const name = (row.camper_name || "").trim();
  const address = rowAddress(row);
  return name.length >= 3 && address.length > 0 && /\d/.test(address);
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("slug", COMPANY_SLUG)
    .maybeSingle();

  if (companyError || !company) {
    console.error("Company not found:", COMPANY_SLUG, companyError?.message);
    process.exit(1);
  }

  const csvText = fs.readFileSync(csvPath, "utf8");
  const geocodes = JSON.parse(fs.readFileSync(geocodesPath, "utf8"));
  const rows = parseCsv(csvText).filter(isValidRow);

  const assignments = rows.map((row) => {
    const direction = (row.direction || "AM").toUpperCase();
    const address = rowAddress(row);
    const geo = geocodes[address.toLowerCase()] ?? null;
    return {
      company_id: company.id,
      reference_season: REFERENCE_SEASON,
      route_file: row.route_file,
      bus_number: parseInt(row.bus_number, 10),
      route_name: row.route_name,
      direction,
      stop_order: parseInt(row.stop_order, 10) || 0,
      camper_name: row.camper_name.trim(),
      camper_name_key: normKey(row.camper_name),
      street: row.street || "",
      city: row.city || "",
      zip: row.zip || "",
      address,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      geocode_provider: geo?.provider ?? null,
      bus_counselor: row.bus_counselor || "",
    };
  });

  const routeKeys = new Set(assignments.map((a) => `${a.route_file}|${a.bus_number}|${a.direction}`));
  const stats = {
    referenceSeason: REFERENCE_SEASON,
    assignmentCount: assignments.length,
    routeCount: routeKeys.size,
    busCount: new Set(assignments.map((a) => `${a.bus_number}|${a.direction}`)).size,
    amAssignmentCount: assignments.filter((a) => a.direction === "AM").length,
    pmAssignmentCount: assignments.filter((a) => a.direction === "PM").length,
    geocodedCount: assignments.filter((a) => a.lat != null).length,
    missingAddressCount: parseCsv(csvText).length - assignments.length,
  };

  console.log(`Company: ${company.name} (${company.slug})`);
  console.log(`Reference season: ${REFERENCE_SEASON}`);
  console.log(`Assignments: ${stats.assignmentCount}, routes: ${stats.routeCount}, geocoded: ${stats.geocodedCount}`);

  await supabase
    .from("route_reference_assignments")
    .delete()
    .eq("company_id", company.id)
    .eq("reference_season", REFERENCE_SEASON);

  await supabase
    .from("route_reference_imports")
    .delete()
    .eq("company_id", company.id)
    .eq("reference_season", REFERENCE_SEASON)
    .eq("source", "mappoint");

  const { data: importRow, error: importError } = await supabase
    .from("route_reference_imports")
    .insert({
      company_id: company.id,
      reference_season: REFERENCE_SEASON,
      source: "mappoint",
      label: `MapPoint ${REFERENCE_SEASON} (seed script)`,
      stats,
    })
    .select("id")
    .single();

  if (importError) {
    console.error("Import insert failed:", importError.message);
    process.exit(1);
  }

  const importId = importRow.id;
  const chunkSize = 200;
  for (let i = 0; i < assignments.length; i += chunkSize) {
    const chunk = assignments.slice(i, i + chunkSize).map((a) => ({
      ...a,
      import_id: importId,
    }));
    const { error } = await supabase.from("route_reference_assignments").insert(chunk);
    if (error) {
      console.error("Assignment insert failed:", error.message);
      process.exit(1);
    }
  }

  console.log(`Seeded import ${importId} with ${assignments.length} assignments.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
