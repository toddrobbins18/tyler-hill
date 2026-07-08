# Incident Reports RLS — Step-by-Step Fix

Todd-approved rules:
- **Admin** → view + manage all incidents at their camp
- **Division Leader / Viewer** → view + add for their division/campers only
- **Staff** → no incidents access
- **No cross-camp access**

## Run in Supabase SQL Editor in this order

| Step | File | What it does |
|------|------|--------------|
| **1** | `01_backup_before_fix.sql` | Save output — your rollback safety net |
| **2** | `02_apply_fix_admin_dl_only.sql` | Apply the fix |
| **2b** | `02b_fix_user_roles_company_id.sql` | Only if Step 2 failed on duplicate key at the end |
| **2c** | `02c_ensure_incident_functions.sql` | Only if Step 3 says a function does not exist |
| **2d** | `02d_apply_incident_policies_only.sql` | **If DL/admin get RLS on INSERT** (functions ok, policies missing) |
| **3** | `03_verify_after_fix.sql` | Confirm everything passes |
| **4** | `04_rollback.sql` | Only if something went wrong |

## Pass criteria (Step 3)

- Query **3D** returns **0 rows** (staff blocked)
- Query **3C** all admins show `can_manage = true`
- Query **3E** division leaders: `can_create = true`, `can_view_all = false`
- Query **3G** `other_camp_ok = false`

## If Deanna/Landon are Staff

Per Todd, they should **not** use Incidents. Step 3F showing all `false` is correct.

If they should use Incidents, change their role to **Admin** or **Division Leader** in the admin user screen — do not re-enable Staff access.
