-- Timber Lake West OD schedule load — Jack Heitner confirmed list (Jul 2026)
-- Run AFTER fix_od_management_rls_multi_camp.sql
--
-- Patterns (JS getDay: 0=Sun … 6=Sat):
--   Monday off    → day off Mon; night off Sun, Mon, Wed, Thu
--   Tuesday off   → day off Tue; night off Mon, Tue, Thu, Fri
--   Wednesday off → day off Wed; night off Sun, Tue, Wed, Fri
--   Highlighted   → same day off; night off Sun, Tue, Wed, Thu
--
-- Season dates: 2026-06-01 through 2026-08-31 (matches OD app repeat-week range)

BEGIN;

CREATE TEMP TABLE tlw_jack_schedule (
  full_name text NOT NULL,
  day_off_dow int NOT NULL CHECK (day_off_dow BETWEEN 1 AND 3),
  highlighted boolean NOT NULL DEFAULT false
) ON COMMIT DROP;

INSERT INTO tlw_jack_schedule (full_name, day_off_dow, highlighted) VALUES
  -- Boys — Monday
  ('Alvaro Portillo Zamora', 1, false),
  ('Jorge Navarro De Alfonso', 1, false),
  ('Jaime Ferrer', 1, false),
  ('Dylan Silverman', 1, false),
  ('Max Vila', 1, false),
  ('Lucas Kim', 1, false),
  ('Aziz Barrie', 1, false),
  ('Jayson Humphreys', 1, false),
  ('Will Bailey', 1, false),
  ('Dylan Mucatel', 1, false),
  ('Jacobo Navarro De Alfonso', 1, false),
  ('Chance Nelms', 1, false),
  ('Enrique Jimenez Araujo', 1, false),
  ('Ignacio Bacete', 1, false),
  ('Callum O''Brien', 1, false),
  -- Boys — Tuesday
  ('David Lord', 2, false),
  ('Simon Greville', 2, false),
  ('Joshua Collis', 2, false),
  ('Owen Green', 2, false),
  ('Diego Morales Gonzalez', 2, false),
  ('Ciaran Myers', 2, false),
  ('Kieran Robinson', 2, false),
  ('Oliver Morcom', 2, false),
  ('Hamish Derrick', 2, false),
  ('Zach Lines', 2, false),
  ('Joshua Patane', 2, false),
  ('Max Clarke', 2, false),
  ('Sam Powell', 2, false),
  ('James Parker', 2, false),
  ('Rhys Elston', 2, false),
  ('Alex Kurjakovic', 2, false),
  ('Max Thompson', 2, false),
  ('Brent Morris', 2, false),
  -- Boys — Wednesday
  ('Mason Taylor', 3, false),
  ('Dafydd James', 3, false),
  ('Sacha Wacks', 3, true),
  ('Charlie Boyles', 3, false),
  ('Sebastian McLaughlin', 3, false),
  ('Lucas Klein', 3, true),
  ('Anthony O''Flynn', 3, false),
  ('Ronnie Pesochinsky', 3, true),
  ('Sebastian Soler', 3, false),
  ('Alejandro Fernandez', 3, false),
  ('Aaron Gelfand', 3, true),
  ('Samuel Hartley', 3, false),
  ('Joshua Vickers Finnerty', 3, false),
  ('Matthew Ben', 3, true),
  ('Diego Cuenca Sinisterra', 3, false),
  ('Stephen Morgan', 3, false),
  ('Eduardo Baz', 3, false),
  ('Zac Greez', 3, true),
  ('Jesse Mansbridge', 3, false),
  ('Hugo Ramos', 3, false),
  ('Zak Dalall', 3, false),
  ('Tyson Chen', 3, false),
  ('Philipp Bock', 3, false),
  ('Michael Logan', 3, false),
  ('Adrian Del Rio', 3, false),
  ('Kasim Rana', 3, false),
  ('Shaun Rafferty', 3, false),
  -- Girls — Monday
  ('Miriam Escoto', 1, false),
  ('Davi Fishman', 1, false),
  ('Jimena Bores Leal del Ojo', 1, false),
  ('Ella Curran', 1, false),
  ('Sarah Weissman', 1, false),
  ('Remi Shapiro', 1, false),
  ('Abigail Hylan', 1, false),
  ('Charlotte Lucas', 1, false),
  ('Alyssa Denness', 1, false),
  ('Alicia Ferrer', 1, false),
  ('Leona Aronov', 1, false),
  ('Caryn Ben', 1, false),
  ('Julia Laura Koster Mendoza', 1, false),
  -- Girls — Tuesday
  ('Nia Elson', 2, false),
  ('Olivia Ringstead', 2, false),
  ('Mia Zandstra', 2, false),
  ('Inga-eve Beanland', 2, false),
  ('Hettie Bates', 2, false),
  ('Lois Collett', 2, false),
  ('Lia Wierstra', 2, false),
  ('Alexia Martin', 2, false),
  ('Tyler Drought', 2, false),
  ('Tilly Webb', 2, false),
  ('Anna Clough', 2, false),
  ('Grace McBride', 2, false),
  ('Ciara Dignum', 2, false),
  ('Milly Thompson', 2, false),
  ('Ellie Hicks', 2, false),
  ('Riley Morris', 2, false),
  ('Lucy Facchinello', 2, false),
  ('Aviv Spivak', 2, false),
  ('Evie Moon', 2, false),
  ('Eleanor Thomas', 2, false),
  -- Girls — Wednesday
  ('Caitlin Lowry', 3, false),
  ('Skylar Rand', 3, true),
  ('Jemima Sisson', 3, false),
  ('Kiki Pentecost', 3, false),
  ('Emma Shaw', 3, false),
  ('Abbie Marshall-Foster', 3, false),
  ('Jadzia Bryant', 3, false),
  ('Kiera White', 3, false),
  ('Amaya Echevarrieta', 3, false),
  ('Riley Goldstein', 3, true),
  ('Lila Duff', 3, false),
  ('Lily Stewart', 3, false),
  ('Maddie Greenberg', 3, true),
  ('Kylie Stein', 3, true),
  ('Phoebe Jarvis', 3, false),
  ('Jennifer Chapman', 3, false),
  ('Lennox Trivax', 3, true),
  ('Sydney Weiss', 3, true),
  ('Emma Douglas', 3, false),
  ('Riley James', 3, true),
  ('Erica Hackett', 3, false),
  ('Julia Platzman', 3, true),
  ('Sydney Wagenheim', 3, true),
  ('Milla Seale', 3, false),
  ('Mia Kavanagh', 3, false),
  ('Alicia Seccafien', 3, false),
  ('Kate Weir', 3, false),
  ('Silvia Perez Ramos', 3, false),
  ('Kayla Robertson', 3, false),
  ('Molly Boom', 3, false),
  ('Zarah Gates', 3, false);

CREATE TEMP TABLE tlw_name_aliases (
  jack_name text PRIMARY KEY,
  db_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO tlw_name_aliases (jack_name, db_name) VALUES
  ('Chance Nelms', 'Chandler Nelms'),
  ('Adrian Del Rio', 'Adrián Del Rio Osuna'),
  ('Anthony O''Flynn', 'Anthony OFlynn'),
  ('Callum O''Brien', 'Callum O''Brien'),
  ('Kayla Robertson', 'Michaela Robertson'),
  ('Kiera White', 'Keira White'),
  ('Maddie Greenberg', 'Madeline Greenberg'),
  ('Milly Thompson', 'Amelia Thompson');

CREATE TEMP TABLE tlw_matched_schedule (
  jack_name text NOT NULL,
  staff_id uuid NOT NULL,
  db_name text NOT NULL,
  day_off_dow int NOT NULL,
  highlighted boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO tlw_matched_schedule (jack_name, staff_id, db_name, day_off_dow, highlighted)
SELECT
  j.full_name,
  s.id,
  s.name,
  j.day_off_dow,
  j.highlighted
FROM tlw_jack_schedule j
LEFT JOIN tlw_name_aliases a ON a.jack_name = j.full_name
JOIN public.companies c ON c.slug = 'timber-lake-west'
JOIN LATERAL (
  SELECT st.id, st.name
  FROM public.staff st
  WHERE st.company_id = c.id
    AND st.season = '2026'
    AND COALESCE(LOWER(st.status), 'active') NOT IN ('inactive')
    AND (
      lower(regexp_replace(regexp_replace(st.name, '[''’]', '', 'g'), '\s+', ' ', 'g'))
        = lower(regexp_replace(regexp_replace(j.full_name, '[''’]', '', 'g'), '\s+', ' ', 'g'))
      OR (
        a.db_name IS NOT NULL
        AND lower(regexp_replace(regexp_replace(st.name, '[''’]', '', 'g'), '\s+', ' ', 'g'))
          = lower(regexp_replace(regexp_replace(a.db_name, '[''’]', '', 'g'), '\s+', ' ', 'g'))
      )
      OR (
        split_part(lower(st.name), ' ', array_length(string_to_array(trim(st.name), ' '), 1))
          = split_part(lower(j.full_name), ' ', array_length(string_to_array(trim(j.full_name), ' '), 1))
        AND split_part(lower(st.name), ' ', 1) LIKE split_part(lower(j.full_name), ' ', 1) || '%'
      )
    )
  ORDER BY
    CASE
      WHEN lower(regexp_replace(st.name, '\s+', ' ', 'g')) = lower(regexp_replace(j.full_name, '\s+', ' ', 'g')) THEN 0
      WHEN a.db_name IS NOT NULL
        AND lower(regexp_replace(st.name, '\s+', ' ', 'g')) = lower(regexp_replace(a.db_name, '\s+', ' ', 'g')) THEN 1
      ELSE 2
    END,
    st.name
  LIMIT 1
) s ON true
WHERE s.id IS NOT NULL;

-- Preview unmatched before mutating (shown in results; script continues if all matched)
DO $$
DECLARE
  missing_count int;
BEGIN
  SELECT COUNT(*)
  INTO missing_count
  FROM tlw_jack_schedule j
  LEFT JOIN tlw_matched_schedule m ON m.jack_name = j.full_name
  WHERE m.staff_id IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'TLW OD load aborted: % staff name(s) not matched. Run diagnose_timber_lake_west_od_schedule.sql first.', missing_count;
  END IF;
END $$;

-- Replace all TL West 2026 OD schedule rows with Jack's confirmed list.
DELETE FROM public.staff_days_off sdo
USING public.companies c
WHERE c.id = sdo.company_id
  AND c.slug = 'timber-lake-west'
  AND sdo.season = '2026';

INSERT INTO public.staff_days_off (
  company_id,
  staff_id,
  season,
  date,
  is_day_off,
  is_night_off,
  notes
)
SELECT
  c.id AS company_id,
  m.staff_id,
  '2026' AS season,
  d.day::date AS date,
  CASE WHEN extract(dow FROM d.day) = m.day_off_dow THEN true ELSE false END AS is_day_off,
  true AS is_night_off,
  CASE
    WHEN extract(dow FROM d.day) = m.day_off_dow AND m.highlighted THEN 'TLW highlighted day off'
    WHEN extract(dow FROM d.day) = m.day_off_dow THEN
      CASE m.day_off_dow WHEN 1 THEN 'Monday day off' WHEN 2 THEN 'Tuesday day off' ELSE 'Wednesday day off' END
    WHEN m.highlighted THEN 'TLW highlighted night off'
    ELSE 'Night off'
  END AS notes
FROM tlw_matched_schedule m
JOIN public.companies c ON c.slug = 'timber-lake-west'
CROSS JOIN generate_series('2026-06-01'::date, '2026-08-31'::date, interval '1 day') AS d(day)
WHERE extract(dow FROM d.day) = ANY (
  CASE
    WHEN m.highlighted THEN ARRAY[0, 2, 3, 4]::int[]
    WHEN m.day_off_dow = 1 THEN ARRAY[0, 1, 3, 4]::int[]
    WHEN m.day_off_dow = 2 THEN ARRAY[1, 2, 4, 5]::int[]
    ELSE ARRAY[0, 2, 3, 5]::int[]
  END
);

COMMIT;

-- Verify
SELECT
  'matched_staff' AS metric,
  COUNT(*)::text AS value
FROM (
  SELECT DISTINCT staff_id FROM public.staff_days_off sdo
  JOIN public.companies c ON c.id = sdo.company_id
  WHERE c.slug = 'timber-lake-west' AND sdo.season = '2026'
) x
UNION ALL
SELECT 'total_rows', COUNT(*)::text
FROM public.staff_days_off sdo
JOIN public.companies c ON c.id = sdo.company_id
WHERE c.slug = 'timber-lake-west' AND sdo.season = '2026';

SELECT
  s.name,
  COUNT(*) FILTER (WHERE sdo.is_day_off) AS day_off_dates,
  COUNT(*) FILTER (WHERE sdo.is_night_off) AS night_off_dates
FROM public.staff_days_off sdo
JOIN public.staff s ON s.id = sdo.staff_id
JOIN public.companies c ON c.id = sdo.company_id
WHERE c.slug = 'timber-lake-west'
  AND sdo.season = '2026'
  AND s.name IN ('Sacha Wacks', 'Skylar Rand', 'David Lord', 'Chandler Nelms', 'Zachary Greez')
GROUP BY s.name
ORDER BY s.name;
