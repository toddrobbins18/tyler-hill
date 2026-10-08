-- Nest Training Sandbox — staff test accounts for Messages
--
-- "Invalid login credentials" = no Auth user yet. The SQL below does NOT set passwords.
--
-- OPTION A (recommended): tyler-hill/.env add SUPABASE_SERVICE_ROLE_KEY, then:
--   npm run sandbox:create-staff-test-users
--
-- OPTION B — Supabase Dashboard (qjbkvnzeejbqxbcbskdu or your project):
--   1. Authentication → Users → Add user → Create new user
--   2. For each row below: email + password NestSandbox2027! → enable "Auto Confirm User"
--   3. Run this entire SQL script to attach profile + staff role to sandbox camp
--
-- | Email                           | Display name          |
-- | staff.alpha@nest-demo.example   | Sam Sandbox Staff     |
-- | staff.beta@nest-demo.example    | Jordan Sandbox Staff  |
--
-- Password (both): NestSandbox2027!

DO $$
DECLARE
  sb_id uuid;
  rec record;
BEGIN
  SELECT id INTO sb_id FROM public.companies WHERE slug = 'nest-sandbox-day-camp';
  IF sb_id IS NULL THEN
    RAISE EXCEPTION 'Run setup_nest_sandbox_day_camp.sql first';
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('staff.alpha@nest-demo.example', 'Sam Sandbox Staff'),
      ('staff.beta@nest-demo.example', 'Jordan Sandbox Staff')
    ) AS t(email, full_name)
  LOOP
    DECLARE
      uid uuid;
    BEGIN
      SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(rec.email);
      IF uid IS NULL THEN
        RAISE NOTICE 'SKIP % — create this user in Authentication → Users first', rec.email;
        CONTINUE;
      END IF;

      INSERT INTO public.profiles (id, email, full_name, approved, company_id)
      VALUES (uid, rec.email, rec.full_name, true, sb_id)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        approved = true,
        company_id = sb_id;

      INSERT INTO public.user_roles (user_id, company_id, role)
      VALUES (uid, sb_id, 'staff')
      ON CONFLICT (user_id, company_id) DO UPDATE SET role = EXCLUDED.role;

      RAISE NOTICE 'Linked % (%) to sandbox', rec.full_name, rec.email;
    END;
  END LOOP;
END $$;

-- Verify (expect 2 rows after Auth users exist)
SELECT p.id, p.full_name, p.email, ur.role
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.company_id = c.id
WHERE c.slug = 'nest-sandbox-day-camp'
  AND p.email IN (
    'staff.alpha@nest-demo.example',
    'staff.beta@nest-demo.example'
  )
ORDER BY p.email;
