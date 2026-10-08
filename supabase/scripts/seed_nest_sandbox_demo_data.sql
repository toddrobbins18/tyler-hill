-- Nest training sandbox — demo roster + transport board (fake data only).
-- Run in Supabase SQL Editor AFTER setup_nest_sandbox_day_camp.sql.
-- Safe to re-run: deletes prior SB-* demo rows for this camp/season only.
-- Regenerate: node scripts/generate_nest_sandbox_seed.mjs

DO $$
DECLARE
  sb_id uuid;
  div_id uuid;
  target_season text := '2027';
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
    (sb_id, '2027', 'SB-2027-001', 'Jordan Demo 1', 'active', div_id, '17 Shore Rd, Port Washington, NY 11050', 'K', 5, 'Male', 'Full Summer', 'parent.alpha@nest-demo.example', 'Alex Alpha', '5165551001'),
    (sb_id, '2027', 'SB-2027-002', 'Casey Demo 2', 'active', div_id, '24 Bayview Ave, Roslyn, NY 11576', '1', 6, 'Female', 'Full Summer', 'parent.alpha@nest-demo.example', 'Alex Alpha', '5165551001'),
    (sb_id, '2027', 'SB-2027-003', 'Riley Demo 3', 'active', div_id, '31 Harbor Rd, Roslyn Heights, NY 11577', '2', 7, 'Male', 'Full Summer', 'parent.alpha@nest-demo.example', 'Alex Alpha', '5165551001'),
    (sb_id, '2027', 'SB-2027-004', 'Avery Demo 4', 'active', div_id, '38 Sandy Hollow Rd, Manhasset, NY 11030', '3', 8, 'Female', 'Full Summer', 'parent.beta@nest-demo.example', 'Blake Beta', '5165551002'),
    (sb_id, '2027', 'SB-2027-005', 'Quinn Demo 5', 'active', div_id, '45 Main St, Port Washington, NY 11050', '4', 9, 'Male', 'Full Summer', 'parent.beta@nest-demo.example', 'Blake Beta', '5165551002'),
    (sb_id, '2027', 'SB-2027-006', 'Morgan Demo 6', 'active', div_id, '52 Willow Tree Rd, Roslyn, NY 11576', '5', 10, 'Female', 'Full Summer', 'parent.beta@nest-demo.example', 'Blake Beta', '5165551002'),
    (sb_id, '2027', 'SB-2027-007', 'Parker Demo 7', 'active', div_id, '59 Mineola Ave, Roslyn Heights, NY 11577', '6', 11, 'Male', 'Full Summer', 'parent.gamma@nest-demo.example', 'Casey Gamma', '5165551003'),
    (sb_id, '2027', 'SB-2027-008', 'Reese Demo 8', 'active', div_id, '66 Port Washington Blvd, Manhasset, NY 11030', '7', 12, 'Female', 'Full Summer', 'parent.gamma@nest-demo.example', 'Casey Gamma', '5165551003'),
    (sb_id, '2027', 'SB-2027-009', 'Skyler Demo 9', 'active', div_id, '73 Soundview Dr, Port Washington, NY 11050', '8', 13, 'Male', 'Week 1', 'parent+sb-2027-009@example.com', 'Demo Parent SB-2027-009', NULL),
    (sb_id, '2027', 'SB-2027-010', 'Dakota Demo 10', 'active', div_id, '80 Ocean Ave, Roslyn, NY 11576', 'K', 14, 'Female', 'Week 2', 'parent+sb-2027-010@example.com', 'Demo Parent SB-2027-010', NULL),
    (sb_id, '2027', 'SB-2027-011', 'Jamie Demo 11', 'active', div_id, '87 Bryant Ave, Roslyn Heights, NY 11577', '1', 5, 'Male', 'Week 3', 'parent+sb-2027-011@example.com', 'Demo Parent SB-2027-011', NULL),
    (sb_id, '2027', 'SB-2027-012', 'Alex Demo 12', 'active', div_id, '94 Warner Ave, Manhasset, NY 11030', '2', 6, 'Female', 'Week 4', 'parent+sb-2027-012@example.com', 'Demo Parent SB-2027-012', NULL),
    (sb_id, '2027', 'SB-2027-013', 'Sam Demo 13', 'active', div_id, '101 Middle Neck Rd, Port Washington, NY 11050', '3', 7, 'Male', 'Week 5', 'parent+sb-2027-013@example.com', 'Demo Parent SB-2027-013', NULL),
    (sb_id, '2027', 'SB-2027-014', 'Taylor Demo 14', 'active', div_id, '108 Northern Blvd, Roslyn, NY 11576', '4', 8, 'Female', 'Week 6', 'parent+sb-2027-014@example.com', 'Demo Parent SB-2027-014', NULL),
    (sb_id, '2027', 'SB-2027-015', 'Cameron Demo 15', 'active', div_id, '115 Roslyn Rd, Roslyn Heights, NY 11577', '5', 9, 'Male', 'Week 7', 'parent+sb-2027-015@example.com', 'Demo Parent SB-2027-015', NULL),
    (sb_id, '2027', 'SB-2027-016', 'Drew Demo 16', 'active', div_id, '122 Old Northern Blvd, Manhasset, NY 11030', '6', 10, 'Female', 'Week 8', 'parent+sb-2027-016@example.com', 'Demo Parent SB-2027-016', NULL),
    (sb_id, '2027', 'SB-2027-017', 'Blake Demo 17', 'active', div_id, '129 Glen Cove Rd, Port Washington, NY 11050', '7', 11, 'Male', 'Week 1', 'parent+sb-2027-017@example.com', 'Demo Parent SB-2027-017', NULL),
    (sb_id, '2027', 'SB-2027-018', 'Hayden Demo 18', 'active', div_id, '136 Cedar Swamp Rd, Roslyn, NY 11576', '8', 12, 'Female', 'Week 2', 'parent+sb-2027-018@example.com', 'Demo Parent SB-2027-018', NULL),
    (sb_id, '2027', 'SB-2027-019', 'Logan Demo 19', 'active', div_id, '143 Peach St, Roslyn Heights, NY 11577', 'K', 13, 'Male', 'Week 3', 'parent+sb-2027-019@example.com', 'Demo Parent SB-2027-019', NULL),
    (sb_id, '2027', 'SB-2027-020', 'Rowan Demo 20', 'active', div_id, '150 Locust Ln, Manhasset, NY 11030', '1', 14, 'Female', 'Week 4', 'parent+sb-2027-020@example.com', 'Demo Parent SB-2027-020', NULL),
    (sb_id, '2027', 'SB-2027-021', 'Jordan Sample 21', 'active', div_id, '157 Shore Rd, Port Washington, NY 11050', '2', 5, 'Male', 'Week 5', 'parent+sb-2027-021@example.com', 'Demo Parent SB-2027-021', NULL),
    (sb_id, '2027', 'SB-2027-022', 'Casey Sample 22', 'active', div_id, '164 Bayview Ave, Roslyn, NY 11576', '3', 6, 'Female', 'Week 6', 'parent+sb-2027-022@example.com', 'Demo Parent SB-2027-022', NULL),
    (sb_id, '2027', 'SB-2027-023', 'Riley Sample 23', 'active', div_id, '171 Harbor Rd, Roslyn Heights, NY 11577', '4', 7, 'Male', 'Week 7', 'parent+sb-2027-023@example.com', 'Demo Parent SB-2027-023', NULL),
    (sb_id, '2027', 'SB-2027-024', 'Avery Sample 24', 'active', div_id, '178 Sandy Hollow Rd, Manhasset, NY 11030', '5', 8, 'Female', 'Week 8', 'parent+sb-2027-024@example.com', 'Demo Parent SB-2027-024', NULL),
    (sb_id, '2027', 'SB-2027-025', 'Quinn Sample 25', 'active', div_id, '185 Main St, Port Washington, NY 11050', '6', 9, 'Male', 'Week 1', 'parent+sb-2027-025@example.com', 'Demo Parent SB-2027-025', NULL),
    (sb_id, '2027', 'SB-2027-026', 'Morgan Sample 26', 'active', div_id, '12 Willow Tree Rd, Roslyn, NY 11576', '7', 10, 'Female', 'Week 2', 'parent+sb-2027-026@example.com', 'Demo Parent SB-2027-026', NULL),
    (sb_id, '2027', 'SB-2027-027', 'Parker Sample 27', 'active', div_id, '19 Mineola Ave, Roslyn Heights, NY 11577', '8', 11, 'Male', 'Week 3', 'parent+sb-2027-027@example.com', 'Demo Parent SB-2027-027', NULL),
    (sb_id, '2027', 'SB-2027-028', 'Reese Sample 28', 'active', div_id, '26 Port Washington Blvd, Manhasset, NY 11030', 'K', 12, 'Female', 'Week 4', 'parent+sb-2027-028@example.com', 'Demo Parent SB-2027-028', NULL),
    (sb_id, '2027', 'SB-2027-029', 'Skyler Sample 29', 'active', div_id, '33 Soundview Dr, Port Washington, NY 11050', '1', 13, 'Male', 'Week 5', 'parent+sb-2027-029@example.com', 'Demo Parent SB-2027-029', NULL),
    (sb_id, '2027', 'SB-2027-030', 'Dakota Sample 30', 'active', div_id, '40 Ocean Ave, Roslyn, NY 11576', '2', 14, 'Female', 'Week 6', 'parent+sb-2027-030@example.com', 'Demo Parent SB-2027-030', NULL),
    (sb_id, '2027', 'SB-2027-031', 'Jamie Sample 31', 'active', div_id, '47 Bryant Ave, Roslyn Heights, NY 11577', '3', 5, 'Male', 'Week 7', 'parent+sb-2027-031@example.com', 'Demo Parent SB-2027-031', NULL),
    (sb_id, '2027', 'SB-2027-032', 'Alex Sample 32', 'active', div_id, '54 Warner Ave, Manhasset, NY 11030', '4', 6, 'Female', 'Week 8', 'parent+sb-2027-032@example.com', 'Demo Parent SB-2027-032', NULL),
    (sb_id, '2027', 'SB-2027-033', 'Sam Sample 33', 'active', div_id, '61 Middle Neck Rd, Port Washington, NY 11050', '5', 7, 'Male', 'Week 1', 'parent+sb-2027-033@example.com', 'Demo Parent SB-2027-033', NULL),
    (sb_id, '2027', 'SB-2027-034', 'Taylor Sample 34', 'active', div_id, '68 Northern Blvd, Roslyn, NY 11576', '6', 8, 'Female', 'Week 2', 'parent+sb-2027-034@example.com', 'Demo Parent SB-2027-034', NULL),
    (sb_id, '2027', 'SB-2027-035', 'Cameron Sample 35', 'active', div_id, '75 Roslyn Rd, Roslyn Heights, NY 11577', '7', 9, 'Male', 'Week 3', 'parent+sb-2027-035@example.com', 'Demo Parent SB-2027-035', NULL),
    (sb_id, '2027', 'SB-2027-036', 'Drew Sample 36', 'active', div_id, '82 Old Northern Blvd, Manhasset, NY 11030', '8', 10, 'Female', 'Week 4', 'parent+sb-2027-036@example.com', 'Demo Parent SB-2027-036', NULL),
    (sb_id, '2027', 'SB-2027-037', 'Blake Sample 37', 'active', div_id, '89 Glen Cove Rd, Port Washington, NY 11050', 'K', 11, 'Male', 'Week 5', 'parent+sb-2027-037@example.com', 'Demo Parent SB-2027-037', NULL),
    (sb_id, '2027', 'SB-2027-038', 'Hayden Sample 38', 'active', div_id, '96 Cedar Swamp Rd, Roslyn, NY 11576', '1', 12, 'Female', 'Week 6', 'parent+sb-2027-038@example.com', 'Demo Parent SB-2027-038', NULL),
    (sb_id, '2027', 'SB-2027-039', 'Logan Sample 39', 'active', div_id, '103 Peach St, Roslyn Heights, NY 11577', '2', 13, 'Male', 'Week 7', 'parent+sb-2027-039@example.com', 'Demo Parent SB-2027-039', NULL),
    (sb_id, '2027', 'SB-2027-040', 'Rowan Sample 40', 'active', div_id, '110 Locust Ln, Manhasset, NY 11030', '3', 14, 'Female', 'Week 8', 'parent+sb-2027-040@example.com', 'Demo Parent SB-2027-040', NULL),
    (sb_id, '2027', 'SB-2027-041', 'Jordan Practice 41', 'active', div_id, '117 Shore Rd, Port Washington, NY 11050', '4', 5, 'Male', 'Week 1', 'parent+sb-2027-041@example.com', 'Demo Parent SB-2027-041', NULL),
    (sb_id, '2027', 'SB-2027-042', 'Casey Practice 42', 'active', div_id, '124 Bayview Ave, Roslyn, NY 11576', '5', 6, 'Female', 'Week 2', 'parent+sb-2027-042@example.com', 'Demo Parent SB-2027-042', NULL),
    (sb_id, '2027', 'SB-2027-043', 'Riley Practice 43', 'active', div_id, '131 Harbor Rd, Roslyn Heights, NY 11577', '6', 7, 'Male', 'Week 3', 'parent+sb-2027-043@example.com', 'Demo Parent SB-2027-043', NULL),
    (sb_id, '2027', 'SB-2027-044', 'Avery Practice 44', 'active', div_id, '138 Sandy Hollow Rd, Manhasset, NY 11030', '7', 8, 'Female', 'Week 4', 'parent+sb-2027-044@example.com', 'Demo Parent SB-2027-044', NULL),
    (sb_id, '2027', 'SB-2027-045', 'Quinn Practice 45', 'active', div_id, '145 Main St, Port Washington, NY 11050', '8', 9, 'Male', 'Week 5', 'parent+sb-2027-045@example.com', 'Demo Parent SB-2027-045', NULL),
    (sb_id, '2027', 'SB-2027-046', 'Morgan Practice 46', 'active', div_id, '152 Willow Tree Rd, Roslyn, NY 11576', 'K', 10, 'Female', 'Week 6', 'parent+sb-2027-046@example.com', 'Demo Parent SB-2027-046', NULL),
    (sb_id, '2027', 'SB-2027-047', 'Parker Practice 47', 'active', div_id, '159 Mineola Ave, Roslyn Heights, NY 11577', '1', 11, 'Male', 'Week 7', 'parent+sb-2027-047@example.com', 'Demo Parent SB-2027-047', NULL),
    (sb_id, '2027', 'SB-2027-048', 'Reese Practice 48', 'active', div_id, '166 Port Washington Blvd, Manhasset, NY 11030', '2', 12, 'Female', 'Week 8', 'parent+sb-2027-048@example.com', 'Demo Parent SB-2027-048', NULL),
    (sb_id, '2027', 'SB-2027-049', 'Skyler Practice 49', 'active', div_id, '173 Soundview Dr, Port Washington, NY 11050', '3', 13, 'Male', 'Week 1', 'parent+sb-2027-049@example.com', 'Demo Parent SB-2027-049', NULL),
    (sb_id, '2027', 'SB-2027-050', 'Dakota Practice 50', 'active', div_id, '180 Ocean Ave, Roslyn, NY 11576', '4', 14, 'Female', 'Week 2', 'parent+sb-2027-050@example.com', 'Demo Parent SB-2027-050', NULL);

  INSERT INTO public.staff (
    company_id, season, person_id, name, role, status, email
  ) VALUES
    (sb_id, '2027', 'SB-STAFF-001', 'Alex Coach Demo', 'Counselor', 'active', 'alex.counselor@example.com'),
    (sb_id, '2027', 'SB-STAFF-002', 'Blake Lead Demo', 'Division Leader', 'active', 'blake.divisionleader@example.com'),
    (sb_id, '2027', 'SB-STAFF-003', 'Casey Swim Demo', 'Specialist', 'active', 'casey.specialist@example.com'),
    (sb_id, '2027', 'SB-STAFF-004', 'Drew Transport Demo', 'Bus Counselor', 'active', 'drew.buscounselor@example.com'),
    (sb_id, '2027', 'SB-STAFF-005', 'Emery Office Demo', 'Office', 'active', 'emery.office@example.com'),
    (sb_id, '2027', 'SB-STAFF-006', 'Finn Nurse Demo', 'Nurse', 'active', 'finn.nurse@example.com'),
    (sb_id, '2027', 'SB-STAFF-007', 'Gray Media Demo', 'Media', 'active', 'gray.media@example.com'),
    (sb_id, '2027', 'SB-STAFF-008', 'Harper Hire Demo', 'Counselor', 'active', 'harper.counselor@example.com');

  INSERT INTO public.sunshine_groups (company_id, name, sort_order, season)
  VALUES
    (sb_id, 'Bunnies',   0, target_season),
    (sb_id, 'Ducklings', 1, target_season),
    (sb_id, 'Giraffes',  2, target_season),
    (sb_id, 'Koalas',    3, target_season),
    (sb_id, 'Pandas',    4, target_season)
  ON CONFLICT (company_id, name, season) DO UPDATE SET sort_order = EXCLUDED.sort_order;

  INSERT INTO public.transport_boards (company_id, season, data, updated_at)
  VALUES (sb_id, target_season, '{"coreStops":{"1":[{"name":"Jordan Demo stop","address":"17 Shore Rd, Port Washington, NY 11050","lat":40.8117,"lng":-73.7107,"pickupTime":"6:15 AM","passengers":2,"camperNames":["Jordan Demo 1","Casey Demo 2"]},{"name":"Riley Demo stop","address":"31 Harbor Rd, Roslyn Heights, NY 11577","lat":40.778,"lng":-73.6475,"pickupTime":"7:20 AM","passengers":2,"camperNames":["Riley Demo 3","Avery Demo 4"]},{"name":"Quinn Demo stop","address":"45 Main St, Port Washington, NY 11050","lat":40.8197,"lng":-73.7007,"pickupTime":"8:25 AM","passengers":2,"camperNames":["Quinn Demo 5","Morgan Demo 6"]},{"name":"Parker Demo stop","address":"59 Mineola Ave, Roslyn Heights, NY 11577","lat":40.786,"lng":-73.6375,"pickupTime":"9:30 AM","passengers":2,"camperNames":["Parker Demo 7","Reese Demo 8"]},{"name":"Skyler Demo stop","address":"73 Soundview Dr, Port Washington, NY 11050","lat":40.8277,"lng":-73.6907,"pickupTime":"10:35 AM","passengers":2,"camperNames":["Skyler Demo 9","Dakota Demo 10"]}],"2":[{"name":"Jamie Demo stop","address":"87 Bryant Ave, Roslyn Heights, NY 11577","lat":40.794,"lng":-73.6275,"pickupTime":"6:15 AM","passengers":2,"camperNames":["Jamie Demo 11","Alex Demo 12"]},{"name":"Sam Demo stop","address":"101 Middle Neck Rd, Port Washington, NY 11050","lat":40.8357,"lng":-73.7132,"pickupTime":"7:20 AM","passengers":2,"camperNames":["Sam Demo 13","Taylor Demo 14"]},{"name":"Cameron Demo stop","address":"115 Roslyn Rd, Roslyn Heights, NY 11577","lat":40.802,"lng":-73.65,"pickupTime":"8:25 AM","passengers":2,"camperNames":["Cameron Demo 15","Drew Demo 16"]},{"name":"Blake Demo stop","address":"129 Glen Cove Rd, Port Washington, NY 11050","lat":40.8097,"lng":-73.7032,"pickupTime":"9:30 AM","passengers":2,"camperNames":["Blake Demo 17","Hayden Demo 18"]},{"name":"Logan Demo stop","address":"143 Peach St, Roslyn Heights, NY 11577","lat":40.776,"lng":-73.64,"pickupTime":"10:35 AM","passengers":2,"camperNames":["Logan Demo 19","Rowan Demo 20"]}],"3":[{"name":"Jordan Sample stop","address":"157 Shore Rd, Port Washington, NY 11050","lat":40.8177,"lng":-73.6932,"pickupTime":"6:15 AM","passengers":2,"camperNames":["Jordan Sample 21","Casey Sample 22"]},{"name":"Riley Sample stop","address":"171 Harbor Rd, Roslyn Heights, NY 11577","lat":40.784,"lng":-73.63,"pickupTime":"7:20 AM","passengers":2,"camperNames":["Riley Sample 23","Avery Sample 24"]},{"name":"Quinn Sample stop","address":"185 Main St, Port Washington, NY 11050","lat":40.8257,"lng":-73.6832,"pickupTime":"8:25 AM","passengers":2,"camperNames":["Quinn Sample 25","Morgan Sample 26"]},{"name":"Parker Sample stop","address":"19 Mineola Ave, Roslyn Heights, NY 11577","lat":40.792,"lng":-73.6525,"pickupTime":"9:30 AM","passengers":2,"camperNames":["Parker Sample 27","Reese Sample 28"]},{"name":"Skyler Sample stop","address":"33 Soundview Dr, Port Washington, NY 11050","lat":40.8337,"lng":-73.7057,"pickupTime":"10:35 AM","passengers":2,"camperNames":["Skyler Sample 29","Dakota Sample 30"]}],"4":[{"name":"Jamie Sample stop","address":"47 Bryant Ave, Roslyn Heights, NY 11577","lat":40.8,"lng":-73.6425,"pickupTime":"6:15 AM","passengers":2,"camperNames":["Jamie Sample 31","Alex Sample 32"]},{"name":"Sam Sample stop","address":"61 Middle Neck Rd, Port Washington, NY 11050","lat":40.8417,"lng":-73.6957,"pickupTime":"7:20 AM","passengers":2,"camperNames":["Sam Sample 33","Taylor Sample 34"]},{"name":"Cameron Sample stop","address":"75 Roslyn Rd, Roslyn Heights, NY 11577","lat":40.774,"lng":-73.6325,"pickupTime":"8:25 AM","passengers":2,"camperNames":["Cameron Sample 35","Drew Sample 36"]},{"name":"Blake Sample stop","address":"89 Glen Cove Rd, Port Washington, NY 11050","lat":40.8157,"lng":-73.6857,"pickupTime":"9:30 AM","passengers":2,"camperNames":["Blake Sample 37","Hayden Sample 38"]},{"name":"Logan Sample stop","address":"103 Peach St, Roslyn Heights, NY 11577","lat":40.782,"lng":-73.655,"pickupTime":"10:35 AM","passengers":2,"camperNames":["Logan Sample 39","Rowan Sample 40"]}]},"routeMeta":[{"id":1,"name":"Bus 1 Route","bus":"Bus 1","departure":"7:00 AM","status":"Confirmed","color":"#3eb8a0","capacity":22},{"id":2,"name":"Bus 2 Route","bus":"Bus 2","departure":"7:00 AM","status":"Confirmed","color":"#4a9eff","capacity":22},{"id":3,"name":"Bus 3 Route","bus":"Bus 3","departure":"7:00 AM","status":"Confirmed","color":"#f59e0b","capacity":22},{"id":4,"name":"Bus 4 Route","bus":"Bus 4","departure":"7:00 AM","status":"Confirmed","color":"#ef4444","capacity":22}],"unplottedCampers":[{"id":341,"name":"Jordan Practice 41","address":"117 Shore Rd, Port Washington, NY 11050","lat":40.8237,"lng":-73.7082,"age":5,"session":"Week 1"},{"id":342,"name":"Casey Practice 42","address":"124 Bayview Ave, Roslyn, NY 11576","lat":40.7998,"lng":-73.6585,"age":6,"session":"Week 2"},{"id":343,"name":"Riley Practice 43","address":"131 Harbor Rd, Roslyn Heights, NY 11577","lat":40.79,"lng":-73.645,"age":7,"session":"Week 3"},{"id":344,"name":"Avery Practice 44","address":"138 Sandy Hollow Rd, Manhasset, NY 11030","lat":40.801,"lng":-73.7015,"age":8,"session":"Week 4"},{"id":345,"name":"Quinn Practice 45","address":"145 Main St, Port Washington, NY 11050","lat":40.8317,"lng":-73.6982,"age":9,"session":"Week 5"},{"id":346,"name":"Morgan Practice 46","address":"152 Willow Tree Rd, Roslyn, NY 11576","lat":40.8078,"lng":-73.6485,"age":10,"session":"Week 6"},{"id":347,"name":"Parker Practice 47","address":"159 Mineola Ave, Roslyn Heights, NY 11577","lat":40.798,"lng":-73.635,"age":11,"session":"Week 7"},{"id":348,"name":"Reese Practice 48","address":"166 Port Washington Blvd, Manhasset, NY 11030","lat":40.809,"lng":-73.6915,"age":12,"session":"Week 8"},{"id":349,"name":"Skyler Practice 49","address":"173 Soundview Dr, Port Washington, NY 11050","lat":40.8397,"lng":-73.6882,"age":13,"session":"Week 1"},{"id":350,"name":"Dakota Practice 50","address":"180 Ocean Ave, Roslyn, NY 11576","lat":40.8158,"lng":-73.6385,"age":14,"session":"Week 2"}],"parentTransportCampers":[],"settings":{"stopPickupMinutes":2,"stopPickupEnabled":true},"routesConfigured":true,"routesSeason":"2027","routesSource":"manual","routesDraftMode":false,"routesConfirmed":true}'::jsonb, now());

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
