# The Nest — Day Camp Expansion Plan (Camp by Camp)

**Status:** Planning / awaiting Todd sign-off  
**Last updated:** July 29, 2026  
**Author:** Ansar (for Todd Robbins)

---

## Executive summary

The Nest will expand to support **three new day camps** on the **same platform** (`thenest.camp`) — not a separate application.

| Camp | Type | Experience |
|------|------|------------|
| Tyler Hill Camp | Overnight | Current Nest — **no change** |
| Timber Lake Camp | Overnight | Current Nest — **no change** |
| Timber Lake West | Overnight | Current Nest — **no change** |
| North Shore Day Camp | Day | **New** — Nest carryover + CampHub-style modules |
| Hampton Country Day Camp | Day | **New** — same as North Shore (shared layout) |
| Southampton Camp & Club | Day | **New** — same as North Shore (shared layout) |

**Day camp formula:**

```
Day camp experience = Todd's Nest carryover modules (Set 1)
                    + CampHub / Day Camp modules from screenshot (Set 2)
                    + Health Center (new nurse features)
                    + All Admin items
```

All three day camps share **one UI layout**. Only branding (name, logo, theme) and data differ per camp.

---

## Platform architecture

```
Camp switcher (The Nest)
├── Tyler Hill Camp          → Overnight experience (current Nest)
├── Timber Lake Camp         → Overnight experience (current Nest)
├── Timber Lake West         → Overnight experience (current Nest)
├── North Shore Day Camp     → Day camp experience (CampHub-style)
├── Hampton Country Day Camp → Day camp experience (CampHub-style)
└── Southampton Camp & Club  → Day camp experience (CampHub-style)
```

When a user selects a camp, the app shows:

- **Overnight camps** — existing sidebar, dashboard, and camp-specific items (Owl Pay, Daily Wolf, Tiger Times, OD Management, etc.)
- **Day camps** — CampHub-style dashboard + Operations menu + Nest carryover modules + Admin

---

## Shared foundation (build once)

Complete before any day camp goes live:

1. **Camp type on `companies`** — e.g. `overnight` vs `day_camp` (drives menu + dashboard)
2. **Create 3 new companies** — slugs, logos, theme colors, seasons
3. **Multi-camp RLS** — same pattern as OD, reports, roster (data isolated per camp)
4. **Role permissions** — day-camp menu IDs + Health Center permissions per camp
5. **Camp switcher** — all 6 camps visible to authorized users
6. **Mobile app** (if in scope) — camp-type routing for day vs overnight

### Proposed day camp slugs

| Camp | Proposed slug |
|------|---------------|
| North Shore Day Camp | `north-shore-day-camp` |
| Hampton Country Day Camp | `hampton-country-day-camp` |
| Southampton Camp & Club | `southampton-camp-club` |

---

## Camp 1 — Tyler Hill Camp (overnight)

**Status:** Live today — **no day-camp work unless Todd requests it.**

### Dashboard

- Current supervisor dashboard (Three Day Outlook, widgets, etc.)

### Main menu (unchanged)

| Module | Notes |
|--------|--------|
| Sports Calendar | Tyler Hill label |
| Camper | |
| Dashboard | |
| Master Calendar | |
| Menu | |
| Rainy Day Schedule | |
| Special Events & Evening Activities | |
| Staff | |
| Tutoring & Therapy | |
| Activities & Field Trips | |
| Messages | |
| Transportation | |
| OD Management | Overnight-only |
| Appointments | |
| Special Meals | |
| **Owl Pay** | Tyler Hill only |
| Daily News | Tyler Hill label |
| Reports | |
| Nurse | Current module (until Health Center rolls to TH) |
| Awards | |
| Incident Reports | |
| Sports Academy + Calendar | |
| Roster Templates | |

### Administration

- Admin Panel
- Evaluation Questions
- Role Permissions
- Division Permissions
- Specialist Sport Assignments
- Company Management

### Plan

| Phase | Action |
|-------|--------|
| Now | Continue fixes (OD, reports, meds, etc.) |
| Day-camp project | **Do not change** UI unless shared backend (RLS, Health Center) |
| Later (optional) | Migrate Nurse → Health Center when ready |

---

## Camp 2 — Timber Lake Camp (overnight)

**Status:** Live today — **unchanged during day-camp rollout.**

### Dashboard

- Current Nest dashboard

### Main menu (unchanged)

| Module | Notes |
|--------|--------|
| Sports Calendar | |
| Camper, Dashboard, Calendar, Menu, Rainy Day, Staff, etc. | Shared overnight set |
| **Daily Schedule** | Timber Lake only |
| **Tiger Times** | Timber Lake only |
| **Elective Sign-Up** | Timber Lake only |
| Daily Notes | Timber Lake label (not "Daily News") |
| OD Management | |
| Nurse, Reports, Incidents, etc. | |

### Plan

| Phase | Action |
|-------|--------|
| Now | Ongoing ops + data (med logs, divisions, etc.) |
| Day-camp project | No UI changes |
| Later | Health Center migration if Todd wants parity |

---

## Camp 3 — Timber Lake West (overnight)

**Status:** Live today — **unchanged during day-camp rollout.**

### Dashboard

- Current Nest dashboard

### Main menu (unchanged)

| Module | Notes |
|--------|--------|
| **Athletics** | TL West label (not "Sports Calendar") |
| **Special Events** | TL West label (no "Evening Activities") |
| **Daily Wolf Printable** | TL West only |
| **Daily Wolf Management** | TL West only |
| OD Management | Recently loaded (Jack schedule) |
| Nurse, Camper, Staff, etc. | Shared overnight set |

### Plan

| Phase | Action |
|-------|--------|
| Now | Deploy pending OD support-bunk + outlook fixes; Todd UAT |
| Day-camp project | No UI changes |
| Later | Health Center if requested |

---

## Camps 4, 5, 6 — Day camps (identical feature set)

North Shore, Hampton Country, and Southampton use the **same code and layout**. Only branding, divisions, routes, and data differ.

| | North Shore | Hampton Country | Southampton |
|--|-------------|-----------------|-------------|
| Dashboard | CampHub-style | CampHub-style | CampHub-style |
| Modules | Same list below | Same list below | Same list below |
| Go-live order | Todd to confirm | Todd to confirm | Todd to confirm |

---

### Day camp dashboard (CampHub screenshot)

Default home when any day camp is selected:

- Welcome message + current date
- Global search (name, phone, email, address)
- **Total campers** stat card
- Quick-action cards:
  - Sunshine Report — "Daily camper tracking sheet"
  - Bunking — "Assign campers to cabins"
  - Transport — "Manage routes and pickups"
  - Media — "Browse photos and videos"

*(Optional later: add Swim, Office Changes, etc. as dashboard cards.)*

---

### Section A — Operations (CampHub / screenshot — **new build**)

From Nest 2.0, Airtable POC, and CampHub preview:

| Module | Purpose | Source |
|--------|---------|--------|
| Sunshine Report | Daily camper tracking sheet | Airtable POC / Nest 2.0 |
| Bunking | Assign campers to groups/cabins | POC |
| Transport | Routes, pickups, buses | POC (+ may relate to existing Transportation) |
| Office Changes | Schedule/assignment changes | POC |
| Media | Photos & videos | POC |
| Swim | Pool schedule / assignments | POC |
| Swim Lessons | Lesson tracking | POC |
| Hiring | Staff hiring workflow | POC / Nest 2.0 |
| Parent Portal | Parent-facing tools | POC / Nest 2.0 |

---

### Section B — Nest carryover (Todd's list — **reuse existing pages**)

| Module | Notes |
|--------|--------|
| Dashboard | Day-camp version (CampHub-style above) |
| Camper | Existing roster — day-camp divisions/bunks |
| Staff | Existing staff module |
| Messages | Existing |
| Master Calendar | Existing |
| Menu | Existing |
| Daily news | Existing notes module (day-camp label) |
| Activities & Field Trips | Existing |
| Special Events | Existing |
| Rainy Day Schedule | Existing |
| Appointments | Existing |
| Incident Reports | Existing |
| **Health Center** | **New** nurse features — not legacy Nurse as-is |
| Reports | Existing reporting where relevant |

---

### Section C — Administration (all admin items)

| Module | Notes |
|--------|--------|
| Admin Panel | Users, divisions, settings |
| Role Permissions | Per camp |
| Division Permissions | Per camp |
| Evaluation Questions | If day camps use evaluations |
| Company Management | Super admin |
| Other admin tools | Same as Nest today |

---

### Not included on day camps (unless Todd adds later)

| Module | Why excluded |
|--------|----------------|
| OD Management | Overnight staff nights off |
| Owl Pay | Tyler Hill only today |
| Daily Wolf / Tiger Times | Overnight publications |
| Elective Sign-Up | Overnight |
| Sports Academy | Overnight-focused today |
| Legacy Nurse (old flow) | Replaced by Health Center |

---

## Per day camp — setup checklist

Repeat for **North Shore**, **Hampton Country**, and **Southampton**:

### Phase 0 — Company setup

- [ ] Create company record (name, slug, logo, theme color)
- [ ] Set `camp_type = day_camp`
- [ ] Create season(s)
- [ ] Create divisions / age groups
- [ ] Create bunks / groups structure
- [ ] Assign admin users + role permissions

### Phase 1 — Data

- [ ] Import campers (CampMinder / CSV)
- [ ] Import staff
- [ ] Import bus routes / transport (if available)
- [ ] Health records → Health Center
- [ ] Verify RLS (users only see their camp)

### Phase 2 — Bucket A (Nest modules live)

- [ ] Camper, Staff, Messages, Calendar, Menu
- [ ] Daily news, Activities, Special Events, Rainy Day
- [ ] Appointments, Incidents, Reports
- [ ] Health Center (not old Nurse)
- [ ] Admin fully configured

### Phase 3 — Bucket B (Day camp modules)

Suggested build order (confirm with Todd):

| Priority | Module | Depends on |
|----------|--------|------------|
| P1 | Sunshine Report | Campers + divisions |
| P1 | Bunking | Campers + bunks |
| P1 | Transport | Routes + campers |
| P2 | Office Changes | Staff + schedules |
| P2 | Media | Storage / CDN |
| P2 | Swim + Swim Lessons | Schedules |
| P3 | Hiring | Staff module |
| P3 | Parent Portal | Auth + camper linkage |

### Phase 4 — Go-live

- [ ] UAT with camp director
- [ ] Staff training
- [ ] Pilot week
- [ ] Full season cutover

---

## Master rollout timeline (suggested)

| Stage | Duration (estimate) | Deliverable |
|-------|---------------------|-------------|
| **0. Scope sign-off** | 1–2 weeks | Todd confirms module list, priorities, Health Center spec, go-live camp order |
| **1. Foundation** | 2–3 weeks | 3 companies, camp type, menu engine, RLS, permissions |
| **2. Bucket A — all 3 day camps** | 3–4 weeks | Nest carryover + Health Center + day-camp dashboard shell |
| **3. Bucket B — P1** | 4–6 weeks | Sunshine, Bunking, Transport (+ Media if P1) |
| **4. Bucket B — P2/P3** | 6–8 weeks | Swim, Office Changes, Hiring, Parent Portal |
| **5. Data + go-live** | Per camp | Camp 1 pilot → Camp 2 → Camp 3 |

**Overnight camps (TH, TLC, TLW):** No timeline impact except shared backend work.

---

## Feature matrix — all camps

| Feature | Tyler Hill | Timber Lake | TL West | North Shore | Hampton | Southampton |
|---------|:----------:|:-----------:|:-------:|:-----------:|:-------:|:-----------:|
| Overnight Nest UI | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| CampHub day-camp UI | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Nest carryover (Todd list) | ✅ (current) | ✅ (current) | ✅ (current) | ✅ | ✅ | ✅ |
| CampHub Operations menu | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Health Center (new) | Later | Later | Later | ✅ | ✅ | ✅ |
| OD Management | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Owl Pay | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Daily Wolf / Tiger Times | ❌ | Tiger | Wolf | ❌ | ❌ | ❌ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Two buckets of work (Todd's email)

### Bucket A — Bring over existing Nest modules

- Activities & Field Trips
- Appointments
- Camper
- Daily news
- Dashboard (day-camp version for day camps)
- Incident Reports
- Master Calendar
- Menu
- Messages
- Rainy Day Schedule
- Special Events
- Staff
- **Nurse → Health Center** (new features; rename OK)
- All Admin items

### Bucket B — New Day Camp menu (Nest 2.0 + Airtable POC + CampHub)

- Sunshine Report
- Bunking
- Transport
- Office Changes
- Media
- Swim
- Swim Lessons
- Hiring
- Parent Portal

Built into the platform under a **Day Camp / Operations** section in the sidebar.

---

## Decisions needed from Todd

1. **Go-live order** — which day camp first? (North Shore vs Hampton vs Southampton)
2. **Phase 1 must-haves** — minimum modules required for opening day
3. **Health Center spec** — exact feature list for day camps
4. **Transport** — new CampHub module vs extend existing Transportation
5. **Parent Portal** — phase 1 or later?
6. **Camp-specific differences** — same feature set for all three at launch, or exceptions?
7. **Sidebar layout** — Day Camp section + full Nest carryover list, or day-camp-only menu like screenshot?

---

## One-line summary per camp

| Camp | Summary |
|------|---------|
| **Tyler Hill** | Keep current Nest; no day-camp UI. |
| **Timber Lake** | Keep current Nest; no day-camp UI. |
| **Timber Lake West** | Keep current Nest; no day-camp UI. |
| **North Shore** | New day camp — Nest carryover + CampHub modules + Health Center. |
| **Hampton Country** | Same as North Shore; own branding and data. |
| **Southampton** | Same as North Shore; own branding and data. |

---

## Related references

- CampHub preview (Lovable POC) — day camp dashboard and Operations sidebar
- Todd email — July 2026 direction for next phase
- Existing multi-camp patterns — `src/lib/camps.ts`, `AppSidebar.tsx`, company RLS migrations

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Product owner | Todd Robbins | | ☐ |
| Development | Ansar | | ☐ |
