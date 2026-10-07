# Camp Management Meeting Plan

**Source:** Full Camp Management Meeting transcript (Todd + dev)  
**Recorded context:** October 2026  
**Purpose:** Keep priorities, requests, and status in one place so context is not lost between sessions.

Speaker labels in the original transcript (Speaker 1 / Speaker 2) are organizational only — not verified identities. In practice, **Speaker 1 = Todd (camp owner)**, **Speaker 2 = dev (Nest builder)**.

---

## Meeting summary (discussion points)

### 1. Transport / routing “brain” (main topic)

- Todd wants the system to **remember how 2026 routes were built** and apply similar logic in **2027, 2028**, etc.
- When a **new camper** enrolls on a street that already has kids (e.g. “Glue St”), the system should put them on the **same bus** or a **nearby stop** — not reinvent the route.
- Routes should stay within a **tight geographic range**. Example: if Bus 1 was on three nearby streets, it should not also pick up one far-away street.
- Later, Todd will upload routes from **two other camps**; the system should learn those patterns too (multi-camp “brain”).
- **Current state (at meeting):** Basic use of 2026 routes + new campers exists. **Full AI / ML “brain” was not implemented yet.**
- **2026 MapPoint data must be complete and accurate** — every camper, every address. This is the **training dataset** for route learning.
- Dev suggested building route AI on a **separate test page first** (outside main Nest transport UI), then injecting into the map once predictions are accurate. Todd agreed.
- **CampMinder sync is heavy:** ~1 API call per camper (e.g. 1000 campers ≈ 1000 calls). Roster can look empty for 1–2 minutes then refill — app feels slow. Optimize sync separately from routing brain.
- **Timing:** Not urgent in October. **Matters April–June** before transport season.
- Todd’s **top priorities:** **Messaging** and **AI / smart routing**.

### 2. Process / who drives product direction

- Todd will have **more time all year** on his property to test and refine.
- **North Shore = Todd’s vision** — division leader feedback should not redirect the product randomly.
- Other two camps may differ slightly (partners, same company).
- Goal: **less wasted testing time** — builds should be **accurate and useful**, not endless back-and-forth.

### 3. Swim — bracelets & levels

- Todd had the **wrong Airtable base/sheet** (e.g. “Swim 225” vs **“Swim Bracelets 2026”**) — dropdown options did not match Nest.
- Todd **resent email / access** to the correct sheet during the meeting.
- **Swim bracelet choice options** should match Airtable in Nest (Division Leader, Current Bracelet, proctors, test notes, etc.).
- **Swim level reports (separate topic from bracelets):**
  - Each **Red Cross level** has its **own sheet** in Airtable (Level 1, 2, 3, …).
  - Parents get **automated emails** today (ugly Airtable automation — “Dear family…” + attachment).
  - Todd wants: email includes the **correct level sheet** with **checkmarks** for skills achieved (2A1, 2A2, 2B1, etc.).
  - Email design can stay simple for now; **Sunshine / prettier templates later**.

### 4. Parent portal

- Todd **redesigned the parent portal** — cleaner, simpler, more fun.
- Dev reviewed and liked it (login flow, less clutter).
- **North Shore dashboard** needs a **background image** like the other three camps — Todd will **send a photo** to use.

### 5. Admin / operations logs

- Todd wants a **self-service screen** (no Supabase queries, no asking dev every time) to see:
  - Did **CampMinder sync** run? What was pulled?
  - Were **emails sent**?
  - What **data was collected**?
- Should live under **Admin** somewhere.

### 6. Other (not in this transcript but related)

- **Face Finder / Azure AI Face** (CampMinder-style): separate discussion — feasible but 6–12 weeks for v1; gallery-first hybrid recommended. See team notes / SMS to Todd.

---

## Todd request list (action items)

| # | Request | Priority (Todd) | Status | Notes |
|---|---------|-----------------|--------|-------|
| 1 | **Route “brain”** — learn 2026 patterns; 2027+ same-street → same bus; tight geography | **High** (Apr–Jun) | **Partial** | `historicalRouteLearning.ts`, “Place Using Prior Routes”, `build2026MappointRouteTemplate` exist. Full AI brain + multi-camp not done. |
| 2 | **2026 MapPoint dataset complete & accurate** | **High** | **Ongoing** | Todd must verify no missing campers/addresses. Code consumes bundled/historical data. |
| 3 | **Separate route-AI test page** (test outside Nest, then inject) | Medium | **Not done** | Agreed in meeting; avoids messy/heavy main transport tab during experiments. |
| 4 | **CampMinder sync performance** (N API calls, empty roster flash) | Medium | **Not done / partial** | Known issue; batch/cache strategy needed. |
| 5 | **Messaging module** | **Very high** | **In progress** | `Messages.tsx` exists; Todd called this “very important.” |
| 6 | **Swim bracelet Airtable options in Nest** | Medium | **Done** | Division leaders, bracelets, proctors, test notes, Note Field, bulk assign (`swimProgram.ts`, `SwimProgram.tsx`). |
| 7 | **Swim level parent emails** — level-specific sheet + skill checkmarks in attachment | Medium | **Not done** | Levels tracked in Nest; email automation + PDF/sheet with checkmarks not built. |
| 8 | **Parent portal — Todd’s redesign** | Medium | **Partial** | Review/implement latest Todd design; dev liked direction. |
| 9 | **North Shore dashboard background image** | Low | **Not done** | Waiting on image from Todd. |
| 10 | **Admin ops logs** (sync, email, data) | Medium | **Partial** | `Admin.tsx`, `AuditLog`, `email_logs` table exist; not a full Todd-style operations dashboard. |
| 11 | **Other two camps’ routes → system learns** | Future | **Not done** | After NS 2026 dataset is solid. |
| 12 | **Correct Airtable access — Swim Bracelets 2026** | — | **Done (meeting)** | Todd resent access during call. |

---

## Priority order (Todd)

1. **Messaging**
2. **AI / smart routing** (deadline: before transport season, Apr–Jun)
3. Everything else — important but not “today” (swim emails, admin logs, portal polish, background)

---

## Technical pointers (Nest codebase)

| Topic | Key files / areas |
|-------|-------------------|
| Historical route learning | `src/lib/historicalRouteLearning.ts`, `src/lib/transportRoster.ts` |
| Transport UI | `src/pages/daycamp/Transport.tsx` |
| Swim bracelets | `src/lib/swimProgram.ts`, `src/pages/daycamp/SwimProgram.tsx` |
| Swim levels / reports | `SwimProgram.tsx` (level report views), no email+checkmark flow yet |
| Messaging | `src/pages/Messages.tsx` |
| Parent portal | `src/pages/ParentPortal.tsx`, `ParentAuth.tsx`, `src/lib/parentPortalTheme.ts` |
| Admin / logs | `src/pages/Admin.tsx`, `src/components/admin/AuditLog.tsx`, `email_logs` in Supabase types |
| Profile / camp photos | `src/components/ProfilePhotoUpload.tsx`, `profile-photos` storage bucket |

---

## Suggested next steps (when resuming work)

1. **Messaging** — confirm Todd’s open issues; ship highest-pain fixes first.
2. **Routing** — validate 2026 MapPoint completeness with Todd; extend `historicalRouteLearning` or build isolated test page (#3).
3. **Swim emails** — spec level-1/2/3… attachment template with checkmarks (#7).
4. **Admin logs** — single “Operations” tab: last sync, email send log, errors (#10).
5. **Portal** — apply Todd background when image arrives (#9).

---

## Changelog (update this file when status changes)

| Date | Update |
|------|--------|
| 2026-10-07 | Initial doc from Camp Management Meeting transcript + codebase status check. Swim bracelet Airtable options marked done. Transport map routing sync fixes in progress (separate session). |
| 2026-10-07 | Swim Bracelets: added 4th & 5th test columns (proctor, date, note) to match Airtable Swim Bracelets 2026. |

---

*Update the **Status** column and **Changelog** when items are completed so future sessions do not lose context.*
