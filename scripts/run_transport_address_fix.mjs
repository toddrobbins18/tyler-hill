#!/usr/bin/env node
/**
 * Bulk-fix transport_boards route/unplotted addresses from children.home_address.
 * Requires DATABASE_URL or SUPABASE_DB_URL (postgres connection string) in .env
 *
 * Usage: node scripts/run_transport_address_fix.mjs [--dry-run]
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");

function loadEnv() {
  const envPath = join(__dirname, "..", ".env");
  try {
    return Object.fromEntries(
      readFileSync(envPath, "utf8")
        .split("\n")
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}

const FIX_SQL = `
WITH params AS (
  SELECT c.id AS company_id, '2027'::text AS season
  FROM companies c WHERE c.slug = 'north-shore-day-camp'
),
child_roster AS (
  SELECT
    lower(trim(ch.name)) AS name_key,
    trim(ch.home_address) AS home_address,
    lower(trim(regexp_replace(trim(ch.home_address), '\\\\s+', ' ', 'g'))) AS home_key
  FROM children ch
  JOIN params p ON p.company_id = ch.company_id AND ch.season = p.season
  WHERE ch.status IS DISTINCT FROM 'inactive'
    AND ch.home_address IS NOT NULL AND trim(ch.home_address) <> ''
),
target AS (
  SELECT tb.company_id, tb.season, tb.data
  FROM transport_boards tb
  JOIN params p ON p.company_id = tb.company_id AND tb.season = p.season
),
new_core AS (
  SELECT
    t.company_id,
    t.season,
    COALESCE(
      jsonb_object_agg(
        r.route_id,
        (
          SELECT COALESCE(
            jsonb_agg(
              CASE
                WHEN fix.new_address IS NOT NULL THEN
                  elem || jsonb_build_object('address', fix.new_address, 'lat', 0, 'lng', 0)
                ELSE elem
              END
            ),
            '[]'::jsonb
          )
          FROM jsonb_array_elements(r.stops) AS elem
          LEFT JOIN LATERAL (
            SELECT cr.home_address AS new_address
            FROM child_roster cr
            WHERE (
              cr.name_key = lower(trim(elem->>'name'))
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(COALESCE(elem->'camperNames', '[]'::jsonb)) AS rn(name)
                WHERE lower(trim(rn.name)) = cr.name_key
              )
            )
            AND lower(trim(regexp_replace(trim(COALESCE(elem->>'address', '')), '\\\\s+', ' ', 'g')))
                IS DISTINCT FROM cr.home_key
            ORDER BY CASE WHEN cr.name_key = lower(trim(elem->>'name')) THEN 0 ELSE 1 END
            LIMIT 1
          ) fix ON true
        )
      ),
      COALESCE(t.data->'coreStops', '{}'::jsonb)
    ) AS core_stops
  FROM target t
  CROSS JOIN LATERAL jsonb_each(COALESCE(t.data->'coreStops', '{}'::jsonb)) AS r(route_id, stops)
  GROUP BY t.company_id, t.season, t.data
),
new_unplotted AS (
  SELECT
    t.company_id,
    t.season,
    COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN cr.home_address IS NOT NULL
              AND lower(trim(regexp_replace(trim(COALESCE(u->>'address', '')), '\\\\s+', ' ', 'g')))
                  IS DISTINCT FROM cr.home_key
            THEN u || jsonb_build_object('address', cr.home_address, 'lat', 0, 'lng', 0)
            ELSE u
          END
        )
        FROM jsonb_array_elements(COALESCE(t.data->'unplottedCampers', '[]'::jsonb)) AS u
        LEFT JOIN child_roster cr ON cr.name_key = lower(trim(u->>'name'))
      ),
      COALESCE(t.data->'unplottedCampers', '[]'::jsonb)
    ) AS unplotted
  FROM target t
)
UPDATE transport_boards tb
SET
  data = jsonb_set(
    jsonb_set(tb.data, '{coreStops}', nc.core_stops, true),
    '{unplottedCampers}',
    nu.unplotted,
    true
  ),
  updated_at = now()
FROM new_core nc
JOIN new_unplotted nu ON nu.company_id = nc.company_id AND nu.season = nc.season
WHERE tb.company_id = nc.company_id AND tb.season = nc.season
RETURNING tb.company_id, tb.season, tb.updated_at;
`;

async function main() {
  const env = loadEnv();
  const dbUrl = env.DATABASE_URL || env.SUPABASE_DB_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    console.log("No DATABASE_URL in .env — run section 3) FIX in Supabase SQL Editor instead:");
    console.log("  supabase/scripts/transport_address_audit_and_fix_ns_2027.sql");
    process.exit(1);
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("Install pg: npm install pg");
    process.exit(1);
  }

  const client = new pg.default.Client({ connectionString: dbUrl });
  await client.connect();

  if (dryRun) {
    console.log("Dry run — would execute bulk address fix UPDATE");
    await client.end();
    return;
  }

  const res = await client.query(FIX_SQL);
  console.log("Fix applied:", res.rowCount, "board(s) updated");
  if (res.rows?.[0]) console.log(res.rows[0]);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
