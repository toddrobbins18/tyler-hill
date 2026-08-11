-- Sunshine Report: grants + multi-camp RLS + North Shore group seed
-- Run in Supabase SQL Editor (safe to re-run).
-- Fixes empty group tabs when viewing North Shore via camp switcher.

-- === 1. Grants (missing from original migration) ===
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sunshine_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sunshine_campers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sunshine_tag_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sunshine_reports TO authenticated;

GRANT ALL ON public.sunshine_groups TO service_role;
GRANT ALL ON public.sunshine_campers TO service_role;
GRANT ALL ON public.sunshine_tag_options TO service_role;
GRANT ALL ON public.sunshine_reports TO service_role;

-- === 2. Multi-camp RLS ===
CREATE OR REPLACE FUNCTION public.user_can_manage_sunshine_data(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR _company_id = public.get_user_company(_user_id)
    OR public.user_has_role_for_company(
      _user_id,
      _company_id,
      ARRAY['admin', 'staff', 'division_leader']::public.app_role[]
    );
$$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage sunshine_groups" ON public.sunshine_groups;
  DROP POLICY IF EXISTS "Users can manage sunshine_campers" ON public.sunshine_campers;
  DROP POLICY IF EXISTS "Users can manage sunshine_tag_options" ON public.sunshine_tag_options;
  DROP POLICY IF EXISTS "Users can manage sunshine_reports" ON public.sunshine_reports;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Users can manage sunshine_groups"
  ON public.sunshine_groups FOR ALL
  USING (public.user_can_manage_sunshine_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_sunshine_data(auth.uid(), company_id));

CREATE POLICY "Users can manage sunshine_campers"
  ON public.sunshine_campers FOR ALL
  USING (public.user_can_manage_sunshine_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_sunshine_data(auth.uid(), company_id));

CREATE POLICY "Users can manage sunshine_tag_options"
  ON public.sunshine_tag_options FOR ALL
  USING (public.user_can_manage_sunshine_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_sunshine_data(auth.uid(), company_id));

CREATE POLICY "Users can manage sunshine_reports"
  ON public.sunshine_reports FOR ALL
  USING (public.user_can_manage_sunshine_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_sunshine_data(auth.uid(), company_id));

-- === 3. Seed North Shore groups + tag options ===
DO $$
DECLARE
  ns_company_id uuid;
BEGIN
  SELECT id INTO ns_company_id FROM public.companies WHERE slug = 'north-shore-day-camp';

  IF ns_company_id IS NULL THEN
    RAISE NOTICE 'North Shore Day Camp not found — skipping seed';
    RETURN;
  END IF;

  INSERT INTO public.sunshine_groups (company_id, name, sort_order) VALUES
    (ns_company_id, 'Bunnies',   0),
    (ns_company_id, 'Ducklings', 1),
    (ns_company_id, 'Giraffes',  2),
    (ns_company_id, 'Koalas',    3),
    (ns_company_id, 'Pandas',    4)
  ON CONFLICT (company_id, name) DO UPDATE SET sort_order = EXCLUDED.sort_order;

  INSERT INTO public.sunshine_tag_options (company_id, category, label, color, sort_order)
  SELECT ns_company_id, t.category, t.label, t.color, t.sort_order
  FROM (VALUES
    ('sport',    'Soccer',           'blue',   0),
    ('sport',    'Basketball',       'orange', 1),
    ('sport',    'Tennis',           'green',  2),
    ('sport',    'Swimming',         'teal',   3),
    ('sport',    'Gymnastics',       'purple', 4),
    ('activity', 'Arts & Crafts',    'pink',   0),
    ('activity', 'Music',            'purple', 1),
    ('activity', 'Nature',           'green',  2),
    ('activity', 'Story Time',       'yellow', 3),
    ('activity', 'Playground',       'blue',   4),
    ('lunch',    'Ate well',         'green',  0),
    ('lunch',    'Ate some',         'yellow', 1),
    ('lunch',    'Picky eater',      'orange', 2),
    ('lunch',    'Allergy note',     'pink',   3)
  ) AS t(category, label, color, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sunshine_tag_options existing
    WHERE existing.company_id = ns_company_id
      AND existing.category = t.category
      AND existing.label = t.label
  );
END $$;

-- === Verify ===
SELECT g.name, g.sort_order
FROM public.sunshine_groups g
JOIN public.companies c ON c.id = g.company_id
WHERE c.slug = 'north-shore-day-camp'
ORDER BY g.sort_order;
