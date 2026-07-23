-- Auto-generated from 2026 Food Allergies (with IDs) final.xlsx
-- Run once in Supabase SQL Editor for Tyler Hill (tyler-hill-camp).
-- Restores children.allergies / staff.allergies cleared by CampMinder sync.
-- Safe to re-run: overwrites allergies for listed person_ids only.

BEGIN;

CREATE TEMP TABLE allergy_import_2026 (
  person_id text PRIMARY KEY,
  allergies text NOT NULL
) ON COMMIT DROP;

INSERT INTO allergy_import_2026 (person_id, allergies) VALUES
  ('20405300', 'Peanuts (EpiPen: Yes)'),
  ('10125729', 'Artificial Sweeteners'),
  ('16458836', 'Gluten (EpiPen: Yes)'),
  ('15837097', 'Peanuts, Sesame, Sunflower seeds (EpiPen: Yes)'),
  ('17410524', 'Pecans, Almonds, Shellfish (EpiPen: Yes)'),
  ('13062222', 'Peanuts, Almonds, Pecans, Tree Nuts, Sesame (EpiPen: Yes)'),
  ('14294467', 'Gluten, Milk'),
  ('15783185', 'Gluten'),
  ('12109874', 'Peanuts, Hazelnut'),
  ('9665062', 'Some fruit skins'),
  ('8379836', 'Peas, Chickpeas'),
  ('9625024', 'Lactose Intolerant'),
  ('11056817', 'Wheat'),
  ('8794525', 'Milk'),
  ('8175237', 'Eggs, Milk'),
  ('18993838', 'Peanuts (EpiPen: Yes)'),
  ('18938010', 'Almonds (EpiPen: Yes)'),
  ('12603837', 'Oral Allergy Syndrome to Stone Fruit'),
  ('13783819', 'Lactose Intolerant'),
  ('14347711', 'Gluten'),
  ('13743890', 'Peanuts (EpiPen: Yes)'),
  ('14279481', 'Pineapple'),
  ('14555512', 'Lactose Intolerant'),
  ('14307421', 'Walnuts, Cashews, Pistachios'),
  ('15787477', 'Gluten'),
  ('15443219', 'Cashews (EpiPen: Yes)'),
  ('14280085', 'Gluten'),
  ('14493237', 'Gluten'),
  ('13871078', 'Gluten'),
  ('11335960', 'Gluten'),
  ('13284555', 'Gluten'),
  ('14321880', 'Peanuts, Tree Nuts (EpiPen: Yes)'),
  ('11225759', 'Peanuts (EpiPen: Yes)'),
  ('12985808', 'Pecans (EpiPen: Yes)'),
  ('12197898', 'Walnuts'),
  ('13062221', 'Peanuts, Pecans, Cashew Nut (EpiPen: Yes)'),
  ('14368164', 'Egg (EpiPen: Yes)'),
  ('12521075', 'Gluten (EpiPen: Yes)'),
  ('13334127', 'Walnuts (EpiPen: Yes)'),
  ('12109875', 'Gluten'),
  ('13957066', 'Pears'),
  ('13669602', 'Peanuts (EpiPen: Yes)'),
  ('8794528', 'Almonds, Milk (EpiPen: Yes)'),
  ('12511772', 'Gluten'),
  ('15425858', 'All nuts except hazelnut'),
  ('14941266', 'Pollen'),
  ('14739758', 'Tree Nut (EpiPen: Yes)'),
  ('17335110', 'Pistachios ,Cashews (EpiPen: Yes)'),
  ('17718364', 'DAIRY , Almonds (EpiPen: Yes)'),
  ('14469091', 'Fruit'),
  ('11673978', 'Sesame (EpiPen: Yes)'),
  ('2688302', 'Gluten'),
  ('21320267', 'Gluten'),
  ('2089868', 'Gluten'),
  ('20742284', 'Banana'),
  ('16419371', 'Vegetarian'),
  ('19310193', 'Gluten'),
  ('20333588', 'Gluten'),
  ('17278738', 'Dairy'),
  ('13995328', 'Gluten'),
  ('20691986', 'Pork'),
  ('15352114', 'Dairy'),
  ('21151173', 'Dairy'),
  ('20764986', 'Gluten'),
  ('16877836', 'Gluten'),
  ('3357862', 'Gluten'),
  ('17293033', 'Gluten'),
  ('13591891', 'Gluten'),
  ('20472578', 'Gluten'),
  ('14216557', 'Gluten'),
  ('9690696', 'Pork'),
  ('3569997', 'Gluten'),
  ('21235064', 'Gluten'),
  ('11974301', 'Pistachios, Cashews (EpiPen: Yes)'),
  ('11775405', 'Lactose Intolerant'),
  ('12217951', 'Gluten'),
  ('13320347', 'Cashews, Pistachios (EpiPen: Yes)'),
  ('12707897', 'Smoked salmon'),
  ('11992737', 'Seafood'),
  ('11624413', 'Fruit'),
  ('9638132', 'Peanuts, Almonds, Pecans'),
  ('11487598', 'Pecans, All tree nuts'),
  ('12158292', 'uncooked Dairy, ALL TREENUTS, uncooked eggs (EpiPen: Yes)'),
  ('13327229', 'Gluten'),
  ('11673977', 'Peanuts, Gluten (EpiPen: Yes)'),
  ('12286195', 'Walnut, cashews'),
  ('19835909', 'Peanuts, Almonds (EpiPen: Yes)'),
  ('11012530', 'Sesame, Tree nuts, Peanuts, Almonds, coconut, Gluten (EpiPen: Yes)'),
  ('10970715', 'Lactose Intolerant'),
  ('10680976', 'Cashew,pistachio'),
  ('9599471', 'Gluten, Lactose Intolerant'),
  ('17047986', 'Fruit'),
  ('18914389', 'Fruit'),
  ('18851178', 'Gluten'),
  ('10067145', 'Fruit'),
  ('17719986', 'Peanuts (EpiPen: Yes)'),
  ('19667615', 'Gluten'),
  ('18924754', 'Almonds (EpiPen: Yes)'),
  ('18018229', 'Fruit'),
  ('20173929', 'Gluten');

-- Preview matches before update
SELECT 'children matches' AS check, count(*) AS rows_to_update
FROM public.children ch
JOIN allergy_import_2026 ai ON public.normalize_person_id_for_match(ch.person_id) = public.normalize_person_id_for_match(ai.person_id)
JOIN public.companies c ON c.id = ch.company_id
WHERE c.slug = 'tyler-hill-camp' AND ch.season = '2026';

SELECT 'staff matches' AS check, count(*) AS rows_to_update
FROM public.staff s
JOIN allergy_import_2026 ai ON public.normalize_person_id_for_match(s.person_id) = public.normalize_person_id_for_match(ai.person_id)
JOIN public.companies c ON c.id = s.company_id
WHERE c.slug = 'tyler-hill-camp' AND s.season = '2026';

-- Update active 2026 campers
UPDATE public.children ch
SET allergies = ai.allergies, updated_at = now()
FROM allergy_import_2026 ai, public.companies c
WHERE ch.company_id = c.id
  AND c.slug = 'tyler-hill-camp'
  AND ch.season = '2026'
  AND COALESCE(ch.status, 'active') <> 'inactive'
  AND public.normalize_person_id_for_match(ch.person_id) = public.normalize_person_id_for_match(ai.person_id);

-- Update active 2026 staff
UPDATE public.staff s
SET allergies = ai.allergies, updated_at = now()
FROM allergy_import_2026 ai, public.companies c
WHERE s.company_id = c.id
  AND c.slug = 'tyler-hill-camp'
  AND s.season = '2026'
  AND COALESCE(s.status, 'active') <> 'inactive'
  AND public.normalize_person_id_for_match(s.person_id) = public.normalize_person_id_for_match(ai.person_id);

-- Verify
SELECT
  count(*) FILTER (WHERE ch.allergies IS NOT NULL AND btrim(ch.allergies) <> '') AS campers_with_allergies,
  count(*) AS active_campers_2026
FROM public.children ch
JOIN public.companies c ON c.id = ch.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND ch.season = '2026'
  AND COALESCE(ch.status, 'active') <> 'inactive';

SELECT
  count(*) FILTER (WHERE s.allergies IS NOT NULL AND btrim(s.allergies) <> '') AS staff_with_allergies,
  count(*) AS active_staff_2026
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND s.season = '2026'
  AND COALESCE(s.status, 'active') <> 'inactive';

COMMIT;
