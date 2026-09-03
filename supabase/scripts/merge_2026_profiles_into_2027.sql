-- Merge 2026 profile fields into EXISTING 2027 camper/staff rows (same person_id).
-- Does NOT create 2027 roster — run CampMinder sync (season 2027) for enrolled/hired lists.
-- Does NOT copy group, division, bunk, session, or sunshine daily data.
--
-- Safe to re-run.

BEGIN;

-- ----- STAFF: profile fields only -----
UPDATE public.staff s27
SET
  allergies = COALESCE(NULLIF(trim(s27.allergies), ''), s26.allergies),
  gender = COALESCE(s27.gender, s26.gender),
  date_of_birth = COALESCE(s27.date_of_birth, s26.date_of_birth),
  phone = COALESCE(NULLIF(trim(s27.phone), ''), s26.phone),
  rfid = COALESCE(NULLIF(trim(s27.rfid), ''), s26.rfid),
  photo_url = COALESCE(NULLIF(trim(s27.photo_url), ''), s26.photo_url),
  tshirt_size = COALESCE(NULLIF(trim(s27.tshirt_size), ''), s26.tshirt_size),
  updated_at = now()
FROM public.staff s26
WHERE s27.company_id = s26.company_id
  AND s27.season = '2027'
  AND s26.season = '2026'
  AND s27.person_id IS NOT NULL
  AND s26.person_id = s27.person_id;

-- ----- CHILDREN: profile fields only (operational fields stay blank until CM sync) -----
UPDATE public.children ch27
SET
  guardian_email = COALESCE(NULLIF(trim(ch27.guardian_email), ''), ch26.guardian_email),
  guardian_phone = COALESCE(NULLIF(trim(ch27.guardian_phone), ''), ch26.guardian_phone),
  guardian_name = COALESCE(NULLIF(trim(ch27.guardian_name), ''), ch26.guardian_name),
  guardian_name_p2 = COALESCE(NULLIF(trim(ch27.guardian_name_p2), ''), ch26.guardian_name_p2),
  allergies = COALESCE(NULLIF(trim(ch27.allergies), ''), ch26.allergies),
  medical_notes = COALESCE(NULLIF(trim(ch27.medical_notes), ''), ch26.medical_notes),
  emergency_contact = COALESCE(NULLIF(trim(ch27.emergency_contact), ''), ch26.emergency_contact),
  gender = COALESCE(ch27.gender, ch26.gender),
  date_of_birth = COALESCE(ch27.date_of_birth, ch26.date_of_birth),
  grade = COALESCE(NULLIF(trim(ch27.grade), ''), ch26.grade),
  rfid = COALESCE(NULLIF(trim(ch27.rfid), ''), ch26.rfid),
  photo_url = COALESCE(NULLIF(trim(ch27.photo_url), ''), ch26.photo_url),
  tshirt_size = COALESCE(NULLIF(trim(ch27.tshirt_size), ''), ch26.tshirt_size),
  updated_at = now()
FROM public.children ch26
WHERE ch27.company_id = ch26.company_id
  AND ch27.season = '2027'
  AND ch26.season = '2026'
  AND ch27.person_id IS NOT NULL
  AND ch26.person_id = ch27.person_id;

COMMIT;

-- After this: run CampMinder sync with season 2027 (Campers Only, then Staff Only).
