#!/usr/bin/env node
/** Regenerate supabase/scripts/seed_nest_sandbox_demo_data.sql — fake roster + transport only. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "../supabase/scripts/seed_nest_sandbox_demo_data.sql");

const season = "2027";
const bases = [
  { city: "Port Washington", zip: "11050", lat: 40.8257, lng: -73.6982 },
  { city: "Roslyn", zip: "11576", lat: 40.7998, lng: -73.6510 },
  { city: "Roslyn Heights", zip: "11577", lat: 40.788, lng: -73.64 },
  { city: "Manhasset", zip: "11030", lat: 40.797, lng: -73.699 },
];
const streets = [
  "Shore Rd", "Bayview Ave", "Harbor Rd", "Sandy Hollow Rd", "Main St",
  "Willow Tree Rd", "Mineola Ave", "Port Washington Blvd", "Soundview Dr", "Ocean Ave",
  "Bryant Ave", "Warner Ave", "Middle Neck Rd", "Northern Blvd", "Roslyn Rd",
  "Old Northern Blvd", "Glen Cove Rd", "Cedar Swamp Rd", "Peach St", "Locust Ln",
];
const first = [
  "Jordan", "Casey", "Riley", "Avery", "Quinn", "Morgan", "Parker", "Reese", "Skyler", "Dakota",
  "Jamie", "Alex", "Sam", "Taylor", "Cameron", "Drew", "Blake", "Hayden", "Logan", "Rowan",
];
const last = ["Demo", "Sample", "Practice", "Trainer", "Sandbox"];

const campers = [];
for (let i = 1; i <= 50; i++) {
  const b = bases[(i - 1) % bases.length];
  const st = streets[(i - 1) % streets.length];
  const num = 10 + ((i * 7) % 180);
  const lat = +(b.lat + ((i % 17) - 8) * 0.002).toFixed(6);
  const lng = +(b.lng + ((i % 13) - 6) * 0.0025).toFixed(6);
  const fn = first[(i - 1) % first.length];
  const ln = last[Math.floor((i - 1) / first.length) % last.length];
  const week = ((i - 1) % 8) + 1;
  const session = i <= 8 ? "Full Summer" : `Week ${week}`;
  let guardianEmail;
  let guardianName;
  let guardianPhone;
  if (i <= 3) {
    guardianEmail = "parent.alpha@nest-demo.example";
    guardianName = "Alex Alpha";
    guardianPhone = "5165551001";
  } else if (i <= 6) {
    guardianEmail = "parent.beta@nest-demo.example";
    guardianName = "Blake Beta";
    guardianPhone = "5165551002";
  } else if (i <= 8) {
    guardianEmail = "parent.gamma@nest-demo.example";
    guardianName = "Casey Gamma";
    guardianPhone = "5165551003";
  } else {
    const pid = `SB-2027-${String(i).padStart(3, "0")}`;
    guardianEmail = `parent+${pid.toLowerCase()}@example.com`;
    guardianName = `Demo Parent ${pid}`;
    guardianPhone = null;
  }

  campers.push({
    person_id: `SB-2027-${String(i).padStart(3, "0")}`,
    name: `${fn} ${ln} ${i}`,
    address: `${num} ${st}, ${b.city}, NY ${b.zip}`,
    lat,
    lng,
    session,
    grade: ["K", "1", "2", "3", "4", "5", "6", "7", "8"][(i - 1) % 9],
    age: 5 + ((i - 1) % 10),
    gender: i % 2 === 0 ? "Female" : "Male",
    unplottedId: 300 + i,
    guardianEmail,
    guardianName,
    guardianPhone,
  });
}

const ROUTE_COLORS = ["#3eb8a0", "#4a9eff", "#f59e0b", "#ef4444"];
const routeMeta = [1, 2, 3, 4].map((id, idx) => ({
  id,
  name: `Bus ${id} Route`,
  bus: `Bus ${id}`,
  departure: "7:00 AM",
  status: "Confirmed",
  color: ROUTE_COLORS[idx],
  capacity: 22,
}));

const coreStops = {};
for (let r = 1; r <= 4; r++) coreStops[r] = [];

for (let routeId = 1; routeId <= 4; routeId++) {
  const start = (routeId - 1) * 10;
  for (let s = 0; s < 5; s++) {
    const c1 = campers[start + s * 2];
    const c2 = campers[start + s * 2 + 1];
    coreStops[routeId].push({
      name: `${c1.name.split(" ").slice(0, 2).join(" ")} stop`,
      address: c1.address,
      lat: c1.lat,
      lng: c1.lng,
      pickupTime: `${6 + s}:${String(15 + s * 5).padStart(2, "0")} AM`,
      passengers: 2,
      camperNames: [c1.name, c2.name],
    });
  }
}

const unplotted = campers.slice(40).map((c) => ({
  id: c.unplottedId,
  name: c.name,
  address: c.address,
  lat: c.lat,
  lng: c.lng,
  age: c.age,
  session: c.session,
}));

const board = {
  coreStops,
  routeMeta,
  unplottedCampers: unplotted,
  parentTransportCampers: [],
  settings: { stopPickupMinutes: 2, stopPickupEnabled: true },
  routesConfigured: true,
  routesSeason: season,
  routesSource: "manual",
  routesDraftMode: false,
  routesConfirmed: true,
};

const esc = (s) => s.replace(/'/g, "''");
const camperValues = campers
  .map((c) => {
    const phoneSql = c.guardianPhone ? `'${c.guardianPhone}'` : "NULL";
    return `(sb_id, '${season}', '${esc(c.person_id)}', '${esc(c.name)}', 'active', div_id, '${esc(c.address)}', '${c.grade}', ${c.age}, '${c.gender}', '${esc(c.session)}', '${esc(c.guardianEmail)}', '${esc(c.guardianName)}', ${phoneSql})`;
  })
  .join(",\n    ");

const staffNames = [
  ["SB-STAFF-001", "Alex Coach Demo", "Counselor"],
  ["SB-STAFF-002", "Blake Lead Demo", "Division Leader"],
  ["SB-STAFF-003", "Casey Swim Demo", "Specialist"],
  ["SB-STAFF-004", "Drew Transport Demo", "Bus Counselor"],
  ["SB-STAFF-005", "Emery Office Demo", "Office"],
  ["SB-STAFF-006", "Finn Nurse Demo", "Nurse"],
  ["SB-STAFF-007", "Gray Media Demo", "Media"],
  ["SB-STAFF-008", "Harper Hire Demo", "Counselor"],
];
const staffValues = staffNames
  .map(
    ([pid, name, role]) =>
      `(sb_id, '${season}', '${pid}', '${esc(name)}', '${role}', 'active', '${name.split(" ")[0].toLowerCase()}.${role.replace(/\s+/g, "").toLowerCase()}@example.com')`,
  )
  .join(",\n    ");

const boardJson = JSON.stringify(board).replace(/'/g, "''");

const sql = `-- Nest training sandbox — demo roster + transport board (fake data only).
-- Run in Supabase SQL Editor AFTER setup_nest_sandbox_day_camp.sql.
-- Safe to re-run: deletes prior SB-* demo rows for this camp/season only.
-- Regenerate: node scripts/generate_nest_sandbox_seed.mjs

DO $$
DECLARE
  sb_id uuid;
  div_id uuid;
  target_season text := '${season}';
BEGIN
  SELECT id INTO sb_id FROM public.companies WHERE slug = 'nest-sandbox-day-camp';
  SELECT id INTO div_id FROM public.divisions
    WHERE company_id = sb_id AND name = 'Demo Division' LIMIT 1;

  IF sb_id IS NULL THEN
    RAISE EXCEPTION 'Sandbox company missing — run setup_nest_sandbox_day_camp.sql first';
  END IF;
  IF div_id IS NULL THEN
    RAISE EXCEPTION 'Demo Division missing — run setup_nest_sandbox_day_camp.sql first';
  END IF;

  DELETE FROM public.transport_boards tb
  WHERE tb.company_id = sb_id AND tb.season = target_season;
  DELETE FROM public.children ch
  WHERE ch.company_id = sb_id AND ch.season = target_season AND ch.person_id LIKE 'SB-2027-%';
  DELETE FROM public.staff st
  WHERE st.company_id = sb_id AND st.season = target_season AND st.person_id LIKE 'SB-STAFF-%';

  INSERT INTO public.children (
    company_id, season, person_id, name, status, division_id,
    home_address, grade, age, gender, session, guardian_email, guardian_name, guardian_phone
  ) VALUES
    ${camperValues};

  INSERT INTO public.staff (
    company_id, season, person_id, name, role, status, email
  ) VALUES
    ${staffValues};

  INSERT INTO public.sunshine_groups (company_id, name, sort_order, season)
  VALUES
    (sb_id, 'Bunnies',   0, target_season),
    (sb_id, 'Ducklings', 1, target_season),
    (sb_id, 'Giraffes',  2, target_season),
    (sb_id, 'Koalas',    3, target_season),
    (sb_id, 'Pandas',    4, target_season)
  ON CONFLICT (company_id, name, season) DO UPDATE SET sort_order = EXCLUDED.sort_order;

  INSERT INTO public.transport_boards (company_id, season, data, updated_at)
  VALUES (sb_id, target_season, '${boardJson}'::jsonb, now());

  RAISE NOTICE 'Sandbox demo seed complete: 50 campers, 8 staff, transport board season %', target_season;
END $$;

SELECT c.slug, ch.season, COUNT(*) AS demo_campers
FROM public.children ch
JOIN public.companies c ON c.id = ch.company_id
WHERE c.slug = 'nest-sandbox-day-camp' AND ch.person_id LIKE 'SB-2027-%'
GROUP BY c.slug, ch.season;

SELECT c.slug, s.season, COUNT(*) AS demo_staff
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE c.slug = 'nest-sandbox-day-camp' AND s.person_id LIKE 'SB-STAFF-%'
GROUP BY c.slug, s.season;

SELECT tb.season, tb.updated_at,
  jsonb_array_length(COALESCE(tb.data->'routeMeta', '[]'::jsonb)) AS routes,
  jsonb_array_length(COALESCE(tb.data->'unplottedCampers', '[]'::jsonb)) AS unplotted
FROM public.transport_boards tb
JOIN public.companies c ON c.id = tb.company_id
WHERE c.slug = 'nest-sandbox-day-camp';
`;

fs.writeFileSync(outPath, sql);
console.log("Wrote", outPath);
