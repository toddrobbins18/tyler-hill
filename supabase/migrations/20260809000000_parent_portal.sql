-- Parent Portal: families, family_children, pickup_changes, absences, authorized_pickups
-- Multi-tenant (company_id) adaptation of camp-hug-hub parent portal schema

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';

CREATE TABLE IF NOT EXISTS public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  family_name text NOT NULL,
  primary_contact_name text,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.family_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, child_id)
);

CREATE TABLE IF NOT EXISTS public.pickup_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  camper_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  change_date date NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('early_pickup', 'late_stay', 'alternate_guardian', 'bus_change', 'other')),
  pickup_time time,
  pickup_person_name text,
  pickup_person_phone text,
  notes text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'acknowledged', 'completed', 'cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  camper_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  absence_date date NOT NULL,
  absence_type text NOT NULL CHECK (absence_type IN ('absent', 'late_arrival', 'leaving_early')),
  arrival_time time,
  reason text,
  notes text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'acknowledged', 'cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.authorized_pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  camper_id uuid REFERENCES public.children(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text,
  phone text,
  email text,
  photo_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_families_company ON public.families(company_id);
CREATE INDEX IF NOT EXISTS idx_families_user ON public.families(user_id);
CREATE INDEX IF NOT EXISTS idx_family_children_family ON public.family_children(family_id);
CREATE INDEX IF NOT EXISTS idx_pickup_changes_family ON public.pickup_changes(family_id);
CREATE INDEX IF NOT EXISTS idx_absences_family ON public.absences(family_id);
CREATE INDEX IF NOT EXISTS idx_authorized_pickups_family ON public.authorized_pickups(family_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_children TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_changes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authorized_pickups TO authenticated;

GRANT ALL ON public.families TO service_role;
GRANT ALL ON public.family_children TO service_role;
GRANT ALL ON public.pickup_changes TO service_role;
GRANT ALL ON public.absences TO service_role;
GRANT ALL ON public.authorized_pickups TO service_role;

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_pickups ENABLE ROW LEVEL SECURITY;

-- Families
DO $$ BEGIN DROP POLICY IF EXISTS "Parents manage own families" ON public.families; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Parents manage own families" ON public.families
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DO $$ BEGIN DROP POLICY IF EXISTS "Staff manage families by company" ON public.families; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Staff manage families by company" ON public.families
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company(auth.uid()))
  WITH CHECK (company_id = public.get_user_company(auth.uid()));

-- Family children
DO $$ BEGIN DROP POLICY IF EXISTS "Parents manage own family children" ON public.family_children; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Parents manage own family children" ON public.family_children
  FOR ALL TO authenticated
  USING (family_id IN (SELECT id FROM public.families WHERE user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT id FROM public.families WHERE user_id = auth.uid()));

DO $$ BEGIN DROP POLICY IF EXISTS "Staff manage family children by company" ON public.family_children; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Staff manage family children by company" ON public.family_children
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company(auth.uid()))
  WITH CHECK (company_id = public.get_user_company(auth.uid()));

-- Parents can view linked children
DO $$ BEGIN DROP POLICY IF EXISTS "Parents view linked children" ON public.children; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Parents view linked children" ON public.children
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT fc.child_id
      FROM public.family_children fc
      JOIN public.families f ON f.id = fc.family_id
      WHERE f.user_id = auth.uid()
    )
  );

-- Pickup changes
DO $$ BEGIN DROP POLICY IF EXISTS "Parents manage own pickup changes" ON public.pickup_changes; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Parents manage own pickup changes" ON public.pickup_changes
  FOR ALL TO authenticated
  USING (family_id IN (SELECT id FROM public.families WHERE user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT id FROM public.families WHERE user_id = auth.uid()));

DO $$ BEGIN DROP POLICY IF EXISTS "Staff manage pickup changes by company" ON public.pickup_changes; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Staff manage pickup changes by company" ON public.pickup_changes
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company(auth.uid()))
  WITH CHECK (company_id = public.get_user_company(auth.uid()));

-- Absences
DO $$ BEGIN DROP POLICY IF EXISTS "Parents manage own absences" ON public.absences; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Parents manage own absences" ON public.absences
  FOR ALL TO authenticated
  USING (family_id IN (SELECT id FROM public.families WHERE user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT id FROM public.families WHERE user_id = auth.uid()));

DO $$ BEGIN DROP POLICY IF EXISTS "Staff manage absences by company" ON public.absences; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Staff manage absences by company" ON public.absences
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company(auth.uid()))
  WITH CHECK (company_id = public.get_user_company(auth.uid()));

-- Authorized pickups
DO $$ BEGIN DROP POLICY IF EXISTS "Parents manage own authorized pickups" ON public.authorized_pickups; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Parents manage own authorized pickups" ON public.authorized_pickups
  FOR ALL TO authenticated
  USING (family_id IN (SELECT id FROM public.families WHERE user_id = auth.uid()))
  WITH CHECK (family_id IN (SELECT id FROM public.families WHERE user_id = auth.uid()));

DO $$ BEGIN DROP POLICY IF EXISTS "Staff manage authorized pickups by company" ON public.authorized_pickups; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Staff manage authorized pickups by company" ON public.authorized_pickups
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company(auth.uid()))
  WITH CHECK (company_id = public.get_user_company(auth.uid()));

-- Swim lessons: parents view/confirm for their campers
DO $$ BEGIN DROP POLICY IF EXISTS "Parents view family swim lessons" ON public.swim_lessons; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Parents view family swim lessons" ON public.swim_lessons
  FOR SELECT TO authenticated
  USING (
    camper_id IN (
      SELECT fc.child_id
      FROM public.family_children fc
      JOIN public.families f ON f.id = fc.family_id
      WHERE f.user_id = auth.uid()
    )
  );

DO $$ BEGIN DROP POLICY IF EXISTS "Parents confirm family swim lessons" ON public.swim_lessons; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Parents confirm family swim lessons" ON public.swim_lessons
  FOR UPDATE TO authenticated
  USING (
    camper_id IN (
      SELECT fc.child_id
      FROM public.family_children fc
      JOIN public.families f ON f.id = fc.family_id
      WHERE f.user_id = auth.uid()
    )
  )
  WITH CHECK (
    camper_id IN (
      SELECT fc.child_id
      FROM public.family_children fc
      JOIN public.families f ON f.id = fc.family_id
      WHERE f.user_id = auth.uid()
    )
  );

-- Triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_families_updated_at') THEN
    CREATE TRIGGER trg_families_updated_at BEFORE UPDATE ON public.families
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pickup_changes_updated_at') THEN
    CREATE TRIGGER trg_pickup_changes_updated_at BEFORE UPDATE ON public.pickup_changes
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_absences_updated_at') THEN
    CREATE TRIGGER trg_absences_updated_at BEFORE UPDATE ON public.absences
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_authorized_pickups_updated_at') THEN
    CREATE TRIGGER trg_authorized_pickups_updated_at BEFORE UPDATE ON public.authorized_pickups
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Register parent account (multi-tenant)
CREATE OR REPLACE FUNCTION public.register_parent_account(
  _company_id uuid,
  _family_name text,
  _primary_contact_name text DEFAULT NULL,
  _phone text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _family_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Company is required';
  END IF;

  INSERT INTO public.user_roles (user_id, role, company_id)
  SELECT _uid, 'parent', _company_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _uid AND company_id = _company_id
  );

  SELECT id INTO _family_id FROM public.families WHERE user_id = _uid AND company_id = _company_id LIMIT 1;
  IF _family_id IS NULL THEN
    INSERT INTO public.families (company_id, user_id, family_name, primary_contact_name, phone, email)
    VALUES (
      _company_id,
      _uid,
      COALESCE(NULLIF(trim(_family_name), ''), 'My Family'),
      _primary_contact_name,
      _phone,
      (SELECT email FROM auth.users WHERE id = _uid)
    )
    RETURNING id INTO _family_id;
  END IF;

  RETURN _family_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_parent_account(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_parent_account(uuid, text, text, text) TO authenticated;

COMMENT ON TABLE public.families IS 'Parent portal family accounts linked to auth users per company';
