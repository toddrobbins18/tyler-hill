# North Shore Day Camp — Project README

**Camp:** North Shore Day Camp (`north-shore-day-camp`)  
**Platform:** The Nest (multi-tenant camp management system)  
**Repositories:**
- **Web:** `tyler-hill` (React + Vite + Supabase) — deployed at [thenest.camp](https://thenest.camp)
- **Mobile:** `Camp-Database-mobile-app` (React Native / Expo)

**Last updated:** August 12, 2026

This README summarizes everything completed for the North Shore Day Camp expansion inside The Nest. North Shore uses the same Nest shell, navigation, and multi-tenant architecture as Tyler Hill and Timber Lake — with additional **Day Camp** modules built for North Shore first.

---

## Table of contents

1. [Overview](#overview)
2. [What has been implemented](#what-has-been-implemented)
3. [Features & functionality (detail)](#features--functionality-detail)
4. [Important technical decisions](#important-technical-decisions)
5. [Project structure](#project-structure)
6. [Database & SQL scripts](#database--sql-scripts)
7. [What is still incomplete or pending](#what-is-still-incomplete-or-pending)
8. [Known issues, limitations & TODOs](#known-issues-limitations--todos)
9. [Local development & deployment](#local-development--deployment)
10. [Related documentation](#related-documentation)

---

## Overview

North Shore Day Camp was added to The Nest as a **day camp** company (`camp_type = day_camp`). Staff with access can switch to North Shore from the camp switcher, the same way they switch between Tyler Hill, Timber Lake Camp, and Timber Lake West.

The goal is **not** a separate app. North Shore keeps The Nest look and feel (sidebar, dashboard, permissions) and adds a **Day Camp** menu section for North Shore–specific modules (Sunshine Report, bus transport, swim, etc.).

**Design principle:** Overnight camps (Tyler Hill, Timber Lake) must remain unchanged. New North Shore features are scoped by `company_id` and, where needed, by camp slug so they do not overwrite other camps' data or UI.

---

## What has been implemented

### Foundation & platform

| Item | Web | Mobile |
|------|-----|--------|
| North Shore company record + slug | ✅ | ✅ |
| `camp_type` on companies (`day_camp` vs overnight) | ✅ | ✅ |
| Camp helpers (`isDayCampCompany`, `isNorthShoreDayCamp`, `northShoreBusTransportEnabled`) | ✅ | ✅ |
| Camp switcher (multi-company) | ✅ | ✅ |
| `CompanyContext` with `camp_type` + theme per camp | ✅ | ✅ |
| Multi-tenant RLS pattern (per module) | ✅ | ✅ |
| Day camp dashboard (search + camper count) | ✅ | ✅ |
| Role permissions wired for day camp menu IDs | ✅ | ✅ |

### Nest carryover modules (existing pages, company-scoped)

These reuse existing Nest pages and work for North Shore on **web + mobile**:

Activities & Field Trips · Appointments · Camper · Daily news · Dashboard · Incident Reports · Master Calendar · Menu · Messages · Rainy Day Schedule · Special Events · Staff · Reports · Admin Panel · Role Permissions · Division Permissions · User Approvals · Evaluation Questions · Specialist Sport Assignments

**Overnight camps only:** Tyler Hill / Timber Lake still use the original **Transportation** module at `/transportation` (field trips & sporting events list).

### New Day Camp features (North Shore)

| Feature | Web | Mobile | Persistence |
|---------|-----|--------|-------------|
| **Sunshine Report** | ✅ | ✅ | Supabase (groups, campers, tags, reports) |
| **Office Changes** | ✅ | ✅ | Supabase |
| **Swim Lessons** | ✅ | ✅ | Supabase |
| **Swim** (bracelets + level reports) | ✅ | ✅ | Mock/local state (POC parity with camp-hug-hub) |
| **Health Center / Nurse** | ✅ | ✅ | Supabase (day camp nurse records) |
| **Bunking** | ✅ | ✅ | Supabase |
| **Hiring** | ✅ | ✅ | Local storage (mock kanban board) |
| **Media** | ✅ | ✅ | Supabase + `camp-media` storage bucket |
| **Parent Portal** | ✅ | ✅ | Supabase (families, pickups, absences, authorized adults) |
| **Bus Transport** (routes, map, geocoding) | ✅ | ⏳ | Supabase `transport_boards` (see [Known issues](#known-issues-limitations--todos)) |
| **Global search** (name, phone, email, address) | ✅ | — | — |

### Bug fixes & polish

- Dashboard widget layout stabilized (no masonry jump)
- Sunshine Report RLS fixed for multi-camp / company switcher
- Sunshine groups & tag options seed script for North Shore
- Swim page horizontal scroll contained to table area (not full page)
- Transport map dialogs render above Leaflet (z-index CSS)
- Staff evaluation duplicate questions deduped
- Appointments enabled for all day camps
- Admin Panel gated per company (not global admin only)
- **Camp-specific transport:** New bus-route Transport is **North Shore only**; Tyler Hill and Timber Lake redirect to `/transportation`

---

## Features & functionality (detail)

### Sunshine Report
- Group tabs (Bunnies, Ducklings, Giraffes, Koalas, Pandas — seeded for North Shore)
- Camper rows with sport / activity / lunch tags
- End-of-day report generation
- Multi-tenant RLS via `user_can_manage_sunshine_data()`

### Office Changes
- Schedule change entry for transportation coordination
- Stored per `company_id`
- Email notification on submit: **not yet wired**

### Swim Lessons
- Lesson scheduling linked to campers
- Company-scoped Supabase tables

### Swim Program
- Bracelets tab + Level Reports tab
- UI matches camp-hug-hub POC; data is mock/local until Todd API or Supabase backing is added

### Health Center (Day Camp Nurse)
- Separate from overnight Nurse module
- Incident/treatment tracking per company

### Bunking
- Camper bunk assignment board with import/optimizer UI
- Supabase-backed boards per company

### Hiring
- Kanban-style staff hiring board
- Mock data + localStorage per company (no Supabase persistence yet)

### Media
- Photo upload, folders, tagging UI
- Supabase `media` table + `camp-media` storage bucket
- Face-scan UI present; AI tagging is mock/placeholder

### Parent Portal
- Parent auth (`/parents`) + portal dashboard (`/parents/portal`)
- Families, authorized pickup adults, pickup changes, absences
- Swim lesson requests / confirmations
- Multi-tenant schema with `parent` app role

### Bus Transport (North Shore only)
Migrated from `camp-hug-hub` with multi-tenant adaptations:

- **Route map** (Leaflet) with AM pickup / PM dropoff toggle
- **Route list** with bus cards, stop timelines, capacity tracking
- **Add Route** dialog (AM + PM runs)
- **Unplotted campers** tab with CSV import
- **Bulk address upload** with geocoding (OpenRouteService / Nominatim / Census)
- **Route optimization** preview
- **Turn-by-turn directions** export
- **Resident / Day Camp report** generators
- Data persisted to `transport_boards` keyed by `company_id`
- **Not shown** on Tyler Hill or Timber Lake — those camps keep `/transportation`

---

## Important technical decisions

### 1. Same Nest, not a separate app
North Shore uses The Nest sidebar (Main Menu + Day Camp section), permissions, and camp switcher. UI matches overnight camps; day camp modules live under `/day-camp/*` routes.

### 2. Multi-tenancy via `company_id`
Every new Supabase table includes `company_id`. RLS policies check the user's company or role for that company. Super admins can switch camps via `sessionStorage.viewing_company_id`.

### 3. Camp slug gating for Transport
The new bus-route Transport module is restricted to `north-shore-day-camp` via `northShoreBusTransportEnabled()`. Other camps:
- Sidebar: no "Transportation" link under Day Camp → `/day-camp/transport`
- Route guard: `/day-camp/transport` redirects to `/transportation`
- Component guard: `Transport.tsx` redirects if not North Shore

This prevents North Shore transport UI, routes, and default seed data from appearing on Tyler Hill or Timber Lake.

### 4. Source of truth for Transport UI
Bus transport UI/UX was copied from `camp-hug-hub` (`Transport.tsx`, `TransportRouteMap.tsx`) and adapted for multi-tenant Supabase persistence.

### 5. Leaflet for maps
Interactive route map uses **Leaflet** (`leaflet` + `@types/leaflet` npm packages). CSS z-index overrides ensure Radix dialogs appear above map panes.

### 6. Web + mobile parity (target)
Day camp features are intended to ship on both web and mobile. Transport bus routes on mobile are **not yet complete** (see pending).

### 7. Mock vs Supabase data
Some POC modules (Swim bracelets, Hiring kanban, parts of Media AI) use mock or local state until Todd's CampMinder API or full Supabase schemas are ready.

---

## Project structure

### Web (`tyler-hill`)

```
src/
├── App.tsx                          # Routes; company-scoped route remount on camp switch
├── components/
│   ├── AppSidebar.tsx               # Main Menu + Day Camp sections
│   ├── TransportRouteMap.tsx        # Leaflet map for bus routes
│   └── daycamp/
├── contexts/
│   ├── CompanyContext.tsx           # Camp switcher, theme, company_id
│   └── AuthContext.tsx
├── hooks/
│   └── useDayCampMenuVisibility.ts
├── lib/
│   ├── camps.ts                     # isNorthShoreDayCamp, northShoreBusTransportEnabled, etc.
│   └── dayCampMenu.ts               # Main Menu + Day Camp menu items
├── pages/
│   ├── Transportation.tsx           # Overnight camps: trips / field trips (unchanged)
│   ├── Media.tsx
│   ├── Hiring.tsx
│   ├── ParentAuth.tsx
│   ├── ParentPortal.tsx
│   ├── Bunking.tsx
│   └── daycamp/
│       ├── DayCampModulePage.tsx    # Router for /day-camp/:moduleId
│       ├── Transport.tsx            # North Shore bus routes (camp-gated)
│       ├── SunshineReport.tsx
│       ├── SwimProgram.tsx
│       ├── SwimLessons.tsx
│       ├── Nurse.tsx
│       └── OfficeTransportChanges.tsx
└── integrations/supabase/

supabase/
├── migrations/                      # Schema migrations (run in order)
└── scripts/                         # One-off fixes, seeds, enable scripts
```

### Mobile (`Camp-Database-mobile-app`)

```
src/
├── navigation/AppNavigator.tsx
├── constants/
│   ├── camps.ts
│   └── dayCampMenu.ts
├── screens/
│   ├── SunshineReportScreen.tsx
│   ├── MediaScreen.tsx
│   ├── ParentPortalScreen.tsx
│   ├── HiringScreen.tsx
│   ├── TransportScreen.tsx          # Overnight: trips list
│   └── TransportRouteScreen.tsx     # Web copy — NOT wired (Phase 2 pending)
└── contexts/CompanyContext.tsx
```

### Key routes (web)

| Route | Module | Camps |
|-------|--------|-------|
| `/day-camp/sunshine-report` | Sunshine Report | Day camps |
| `/day-camp/transport` | Bus routes + map | **North Shore only** |
| `/day-camp/swim` | Swim bracelets / levels | Day camps |
| `/day-camp/swim-lessons` | Swim lessons | Day camps |
| `/day-camp/nurse` | Health Center | Day camps |
| `/day-camp/office-changes` | Office Changes | Day camps |
| `/day-camp/bunking` | Bunking | Day camps |
| `/day-camp/hiring` | Hiring | Day camps |
| `/day-camp/media` | Media | Day camps |
| `/parents`, `/parents/portal` | Parent Portal | Day camps (permission-gated) |
| `/transportation` | Trips / field trips | Tyler Hill, Timber Lake, etc. |

---

## Database & SQL scripts

### Required foundation
| File | Purpose |
|------|---------|
| `supabase/migrations/20260731120000_north_shore_day_camp_foundation.sql` | Company, division, base setup |
| `supabase/scripts/setup_north_shore_day_camp_foundation.sql` | Same, for SQL Editor |

### Feature migrations
| Migration | Feature |
|-----------|---------|
| `20260805000000_sunshine_report_multi_tenant.sql` | Sunshine Report tables |
| `20260805000001_office_transport_changes.sql` | Office Changes |
| `20260805000002_bunking_boards.sql` | Bunking |
| `20260806000000_swim_lessons.sql` | Swim Lessons |
| `20260806000001_nurse_records.sql` | Day camp Nurse |
| `20260808000000_media.sql` | Media + storage bucket |
| `20260809000000_parent_portal.sql` | Parent Portal |
| `20260810000000_fix_sunshine_report_rls_multi_camp.sql` | Sunshine RLS + grants |

### Run-as-needed scripts
| Script | Purpose |
|--------|---------|
| `supabase/scripts/seed_sunshine_north_shore.sql` | Seed Sunshine groups + tags |
| `supabase/scripts/fix_sunshine_report_rls_multi_camp.sql` | Combined RLS fix + seed |
| `supabase/scripts/enable_media_north_shore.sql` | Enable Media permissions |
| `supabase/scripts/enable_parent_portal_north_shore.sql` | Enable Parent Portal permissions |
| `supabase/scripts/north_shore_phase_3_1` … `_3_5_enable_modules.sql` | Module permission enablement |

**Note:** `transport_boards` table migration exists in `camp-hug-hub` but has **not yet** been added to `tyler-hill/supabase/migrations`. Transport persistence will fail until that migration is created and applied.

---

## What is still incomplete or pending

### Features not built
- Phone call log on each camper profile
- Live dismissal dashboard for front office at pickup
- Automatic emails when office changes are entered
- Swim reports — approve and email parents
- Swim progress — email division leader
- Health Center — email division leader/directors when child sent home
- Full CampMinder API integration (Todd to provide per camp)

### Mobile
- **Bus Transport (Phase 2):** Native or WebView implementation of North Shore route map — not shipped; `TransportRouteScreen.tsx` is a web copy and not wired in navigation
- Mobile uses existing `TransportScreen.tsx` (trips list) for overnight-style transport

### Before go-live
- [ ] Run all Supabase migrations + seed scripts in production
- [ ] Add and apply `transport_boards` migration for tyler-hill
- [ ] Connect North Shore CampMinder and verify camper/staff data
- [ ] Assign North Shore users (division leaders, admin, etc.)
- [ ] End-to-end testing on web and mobile
- [ ] Confirm camp switcher loads correct transport module per camp
- [ ] Set go-live date

### Not in this phase
- Hampton & Southampton day camps
- Hiring / Media / Bunking full production backend (currently mock/local where noted)

---

## Known issues, limitations & TODOs

| Issue | Status | Notes |
|-------|--------|-------|
| `transport_boards` migration missing in tyler-hill | **TODO** | Transport save/load needs Supabase table + RLS from camp-hug-hub |
| Transport default seed data (38 buses, sample campers) | Limitation | Shows until company-specific board is saved in DB |
| Swim Program uses mock data | Limitation | No Supabase backing yet |
| Hiring uses localStorage | Limitation | Not synced across devices/users |
| Media AI face tagging | Placeholder | UI only |
| Office Changes email notifications | Not wired | Data saves; no auto-email |
| Sunshine Report on tyler-hill prod | Fixed in code | Requires `fix_sunshine_report_rls_multi_camp.sql` run in Supabase |
| Vercel redeploy of old commit | Ops | Redeploying failed commit `ea66658` fails (no leaflet). Use latest `main` (includes leaflet in package.json) |
| Role permission menu IDs | May need update | Legacy IDs (`swim-bracelets`) vs new (`swim`, `swim-lessons`) |
| Transport load effect | Minor | `useEffect` for board load should depend on `currentCompany.id` (North Shore only) |

---

## Local development & deployment

### Web

```sh
cd tyler-hill
npm install
npm run dev        # local dev server
npm run build      # production build (requires leaflet in package.json)
```

Deploy via Vercel from `main`. Ensure the deployment uses the **latest commit** (not a redeploy of an older failed build).

### Mobile

```sh
cd Camp-Database-mobile-app
npm install
npm start          # Expo
```

### Environment
- Supabase URL + anon key in `.env` (web and mobile)
- OpenRouteService or geocoding keys if testing Transport geocoding

---

## Related documentation

| Document | Location |
|----------|----------|
| Phase tracker (full roadmap) | `docs/DAY_CAMP_PHASES.md` |
| Completed work snapshot (Aug 8) | `docs/NORTH_SHORE_DAY_CAMP_COMPLETED.md` |
| Status summary | `docs/NORTH_SHORE_STATUS_REPORT.md` |
| Expansion plan | `docs/DAY_CAMP_EXPANSION_PLAN.md` |

---

## Progress summary

| Area | Approx. status |
|------|----------------|
| Foundation + UI shell | ✅ Complete |
| Nest carryover modules | ✅ Complete (web + mobile) |
| Day camp feature modules | ✅ ~85% (core built; emails/API pending) |
| Bus Transport (North Shore web) | ✅ UI complete; DB migration pending |
| Bus Transport (mobile) | ⏳ Not started |
| Go-live readiness | ⏳ Migrations, UAT, CampMinder sync pending |

**Overall:** roughly **75–80%** complete for North Shore v1 web; mobile transport and production database setup remain the main gaps before go-live.
