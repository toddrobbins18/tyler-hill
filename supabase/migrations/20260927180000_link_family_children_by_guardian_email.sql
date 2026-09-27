-- Auto-link campers to a parent family by guardian email (+ siblings with same P1 name/phone).

CREATE OR REPLACE FUNCTION public.link_family_children_by_guardian_email(_family_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _email text;
  _linked int := 0;
  _more int := 0;
BEGIN
  SELECT f.company_id, lower(trim(f.email))
  INTO _company_id, _email
  FROM public.families f
  WHERE f.id = _family_id;

  IF _company_id IS NULL THEN
    RETURN 0;
  END IF;

  IF _email IS NOT NULL AND _email <> '' THEN
    WITH inserted AS (
      INSERT INTO public.family_children (company_id, family_id, child_id)
      SELECT DISTINCT c.company_id, _family_id, c.id
      FROM public.children c
      WHERE c.company_id = _company_id
        AND coalesce(c.status, 'active') <> 'inactive'
        AND lower(trim(c.guardian_email)) = _email
      ON CONFLICT (family_id, child_id) DO NOTHING
      RETURNING 1
    )
    SELECT count(*)::int INTO _linked FROM inserted;
  END IF;

  -- Siblings: same P1 name + phone as a child already linked to this family.
  WITH linked_guardians AS (
    SELECT DISTINCT
      lower(trim(c.guardian_name)) AS gname,
      regexp_replace(coalesce(c.guardian_phone, ''), '[^0-9]', '', 'g') AS gphone
    FROM public.family_children fc
    JOIN public.children c ON c.id = fc.child_id
    WHERE fc.family_id = _family_id
      AND trim(coalesce(c.guardian_name, '')) <> ''
      AND trim(coalesce(c.guardian_phone, '')) <> ''
  ),
  inserted AS (
    INSERT INTO public.family_children (company_id, family_id, child_id)
    SELECT DISTINCT c.company_id, _family_id, c.id
    FROM public.children c
    JOIN linked_guardians lg
      ON lower(trim(c.guardian_name)) = lg.gname
     AND regexp_replace(coalesce(c.guardian_phone, ''), '[^0-9]', '', 'g') = lg.gphone
    WHERE c.company_id = _company_id
      AND coalesce(c.status, 'active') <> 'inactive'
      AND NOT EXISTS (
        SELECT 1
        FROM public.family_children fc2
        WHERE fc2.family_id = _family_id
          AND fc2.child_id = c.id
      )
    ON CONFLICT (family_id, child_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO _more FROM inserted;

  RETURN _linked + _more;
END;
$$;

REVOKE ALL ON FUNCTION public.link_family_children_by_guardian_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_family_children_by_guardian_email(uuid) TO authenticated;

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

  PERFORM public.link_family_children_by_guardian_email(_family_id);

  RETURN _family_id;
END;
$$;
