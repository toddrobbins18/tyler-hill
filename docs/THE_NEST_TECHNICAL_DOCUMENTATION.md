# 🏕️ The Nest - Technical Documentation

> **A Comprehensive Camp Management Platform**

---

## 📋 Table of Contents

1. [Executive Overview](#executive-overview)
2. [Platform Purpose & Vision](#platform-purpose--vision)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Core Modules](#core-modules)
6. [Database Schema](#database-schema)
7. [Authentication & Authorization](#authentication--authorization)
8. [External Integrations](#external-integrations)
9. [Edge Functions (Backend Services)](#edge-functions-backend-services)
10. [React Native Migration Guide](#react-native-migration-guide)
11. [Deployment & Infrastructure](#deployment--infrastructure)
12. [Appendix](#appendix)

---

## 🎯 Executive Overview

**The Nest** is a comprehensive, multi-tenant camp management platform designed to streamline operations for summer camps, day camps, and similar organizations. Built with modern web technologies, it provides a centralized hub for managing campers, staff, schedules, health records, transportation, and communications.

### Key Highlights

| Aspect | Description |
|--------|-------------|
| **Type** | Multi-tenant SaaS Platform |
| **Target Users** | Camp Administrators, Division Leaders, Staff, Health Center Personnel |
| **Primary Function** | End-to-end camp operations management |
| **Multi-Company Support** | Yes - Tyler Hill Camp, Timber Lake Camp, Timber Lake West |
| **Authentication** | Email-based with role-based access control (RBAC) |
| **Real-time Updates** | Yes - via Supabase Realtime subscriptions |

---

## 🌟 Platform Purpose & Vision

### Problem Statement

Summer camps face complex operational challenges:
- Managing hundreds of campers across multiple divisions
- Coordinating staff schedules and evaluations
- Tracking health center visits and medication administration
- Organizing transportation and field trips
- Communicating important updates to relevant personnel
- Ensuring regulatory compliance and incident documentation

### Solution

The Nest provides a unified platform that:

1. **Centralizes Data** - Single source of truth for all camp-related information
2. **Role-Based Access** - Ensures personnel only see relevant information
3. **Real-Time Updates** - Immediate synchronization across all users
4. **Season-Based Filtering** - Historical data preservation with current season focus
5. **Automated Notifications** - Scheduled and event-driven communications
6. **Integration Ready** - CampMinder sync, Microsoft 365 email integration

### Target Personas

| Persona | Role | Key Features Used |
|---------|------|-------------------|
| **Camp Director** | Super Admin | All features, company management, user approvals |
| **Division Leader** | Division-scoped access | Roster, evaluations, daily notes |
| **Counselor/Staff** | Staff role | Check-ins, daily notes, camper profiles |
| **Health Center** | Health Center role | Medication logs, admissions, appointments |
| **Specialist** | Activity-focused | Sports calendar, evaluations, academy |

---

## 🛠️ Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.1 | UI Framework |
| **TypeScript** | 5.x | Type Safety |
| **Vite** | 5.x | Build Tool & Dev Server |
| **Tailwind CSS** | 3.x | Utility-First Styling |
| **shadcn/ui** | Latest | UI Component Library |
| **TanStack Query** | 5.x | Data Fetching & Caching |
| **React Router DOM** | 6.x | Client-Side Routing |
| **Lucide React** | Latest | Icon Library |
| **Recharts** | 2.x | Data Visualization |
| **date-fns** | 3.x | Date Manipulation |
| **Zod** | 3.x | Schema Validation |
| **React Hook Form** | 7.x | Form Management |

### Backend

| Technology | Purpose |
|------------|---------|
| **Supabase** | Backend-as-a-Service (BaaS) |
| **PostgreSQL** | Relational Database |
| **Supabase Auth** | Authentication |
| **Supabase Realtime** | WebSocket Subscriptions |
| **Supabase Edge Functions** | Serverless Functions (Deno) |
| **Row Level Security (RLS)** | Data Access Control |

### Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT BROWSER                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              React + TypeScript App                  │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐ │    │
│  │  │ Pages   │  │Components│  │ Contexts & Hooks   │ │    │
│  │  └─────────┘  └─────────┘  └─────────────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE PLATFORM                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Auth       │  │  Database   │  │   Edge Functions    │ │
│  │  Service    │  │  PostgreSQL │  │   (Deno Runtime)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Realtime   │  │  Storage    │  │   Row Level         │ │
│  │  WebSockets │  │  Buckets    │  │   Security (RLS)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 EXTERNAL INTEGRATIONS                        │
│  ┌─────────────────┐        ┌────────────────────────────┐ │
│  │   CampMinder    │        │   Microsoft 365 (Email)    │ │
│  │   API Sync      │        │   Graph API Integration    │ │
│  └─────────────────┘        └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ System Architecture

### Directory Structure

```
src/
├── components/           # Reusable UI components
│   ├── admin/           # Admin-specific components
│   ├── dialogs/         # Modal dialogs (Add, Edit, View)
│   └── ui/              # shadcn/ui base components
├── contexts/            # React Context providers
│   ├── AuthContext.tsx  # Authentication state
│   ├── CompanyContext.tsx # Multi-tenant company state
│   └── SeasonContext.tsx  # Season filtering state
├── hooks/               # Custom React hooks
│   ├── usePermissions.ts # RBAC hook
│   └── useConflictDetection.ts
├── integrations/        # External service integrations
│   └── supabase/        # Supabase client & types
├── lib/                 # Utility functions
│   ├── utils.ts         # General utilities
│   ├── divisionUtils.ts # Division helpers
│   └── validationSchemas.ts # Zod schemas
├── pages/               # Route page components
│   ├── admin/           # Admin sub-pages
│   └── [40+ page files]
└── main.tsx             # Application entry point

supabase/
├── functions/           # Edge Functions (Deno)
│   ├── _shared/         # Shared utilities
│   │   ├── emailHelpers.ts
│   │   └── timingHelpers.ts
│   └── [20+ functions]
├── config.toml          # Supabase configuration
└── migrations/          # Database migrations
```

### Context Architecture

```
<QueryClientProvider>
  <BrowserRouter>
    <AuthProvider>              ← Authentication state
      <CompanyProvider>         ← Multi-tenant company state
        <SeasonProvider>        ← Season filtering
          <TooltipProvider>
            <AppContent />      ← Main application
          </TooltipProvider>
        </SeasonProvider>
      </CompanyProvider>
    </AuthProvider>
  </BrowserRouter>
</QueryClientProvider>
```

---

## 📦 Core Modules

### 1. Dashboard Module

**File:** `src/pages/Dashboard.tsx`

| Feature | Description |
|---------|-------------|
| Overview Stats | Total children, active routes, daily notes, weekly awards |
| Weather Widget | Real-time weather based on camp location |
| Today's Menu | Breakfast, lunch, snack, dinner display |
| Athletics Schedule | Current and upcoming sports events |
| Birthdays | Today's camper and staff birthdays |
| Health Center | Current admissions |
| Real-time Updates | WebSocket subscriptions for live data |

---

### 2. Camper Management Module

**Files:** `src/pages/Roster.tsx`, `src/pages/ChildProfile.tsx`

| Feature | Description |
|---------|-------------|
| Roster View | Filterable list of all campers by division, bunk, session |
| Profile Pages | Detailed camper information with tabs |
| Medical Info | Allergies, medical notes, emergency contacts |
| Awards & Achievements | Track camper accomplishments |
| Daily Notes | Historical notes from counselors |
| Incident History | Safety and behavioral records |
| Evaluations | Periodic camper assessments |

**Database Tables:**
- `children` - Core camper data
- `daily_notes` - Counselor observations
- `awards` - Achievement records
- `incident_children` - Incident associations
- `camper_reports` - Evaluation data

---

### 3. Staff Management Module

**Files:** `src/pages/Staff.tsx`, `src/pages/StaffProfile.tsx`

| Feature | Description |
|---------|-------------|
| Staff Directory | Searchable staff list with role/division filters |
| Profile Management | Detailed staff profiles |
| Evaluations | Staff performance assessments |
| Bunk Assignments | Staff-to-bunk mapping |
| OD Management | On-Duty tracking and scheduling |
| RFID Assignment | Bulk RFID tag assignment |

**Database Tables:**
- `staff` - Core staff data
- `staff_evaluations` - Performance records
- `bunk_staff` - Bunk assignments
- `evaluation_questions` - Assessment templates
- `evaluation_responses` - Assessment answers

---

### 4. Health Center Module

**Files:** `src/pages/Nurse.tsx`, `src/pages/Appointments.tsx`

| Feature | Description |
|---------|-------------|
| Medication Management | Schedule and track medication administration |
| Health Center Admissions | Check-in/check-out tracking |
| Appointment Scheduling | External medical appointments |
| Overdue Alerts | Automated medication reminders |
| Late Notes | Documentation for missed medications |

**Database Tables:**
- `medication_logs` - Medication schedules and administration
- `health_center_admissions` - Visit records
- `appointments` - External appointment scheduling

**Edge Functions:**
- `check-medication-alerts` - Overdue medication notifications
- `generate-daily-medications` - Daily schedule generation
- `send-health-center-notification` - Admission alerts
- `send-appointment-notification` - Appointment reminders

---

### 5. Scheduling & Calendar Module

**Files:** `src/pages/MasterCalendar.tsx`, `src/pages/SportsCalendar.tsx`, `src/pages/RainyDaySchedule.tsx`

| Feature | Description |
|---------|-------------|
| Master Calendar | All camp events in unified view |
| Sports Calendar | Athletic events and inter-camp games |
| Rainy Day Schedule | Contingency planning |
| Event Management | CRUD for all event types |
| Notifications | Event-triggered alerts |

**Database Tables:**
- `master_calendar` - General events
- `sports_calendar` - Athletic events
- `rainy_day_schedule` - Weather contingencies
- `special_events_activities` - Special programs

---

### 6. Transportation Module

**File:** `src/pages/Transportation.tsx`

| Feature | Description |
|---------|-------------|
| Trip Management | Create and manage trips |
| Attendance Tracking | Camper assignment to trips |
| Chaperone Assignment | Staff oversight |
| Notifications | Departure/arrival alerts |

**Database Tables:**
- `trips` - Trip records
- `trip_children` - Trip attendance

---

### 7. Food Service Module

**Files:** `src/pages/Menu.tsx`, `src/pages/SpecialMeals.tsx`

| Feature | Description |
|---------|-------------|
| Daily Menus | Meal planning and display |
| Allergen Tracking | Food allergy documentation |
| Special Meals | Dietary accommodation management |
| Birthday Parties | Cake and celebration planning |

**Database Tables:**
- `menu_items` - Daily meal entries
- `children` (birthday_* columns) - Birthday preferences

---

### 8. Communications Module

**Files:** `src/pages/Messages.tsx`, `src/pages/DailyWolfManagement.tsx`

| Feature | Description |
|---------|-------------|
| Internal Messaging | In-app notifications |
| Daily Wolf/News | Camp newsletter management |
| Bulk Email | Mass communication |
| Automated Emails | Event-driven notifications |

**Database Tables:**
- `messages` - In-app messages
- `daily_wolf_content` - Newsletter content
- `daily_wolf_documents` - PDF uploads
- `email_logs` - Sent email records
- `automated_email_config` - Notification settings

---

### 9. Incident & Safety Module

**File:** `src/pages/IncidentReports.tsx`

| Feature | Description |
|---------|-------------|
| Incident Logging | Document safety/behavioral events |
| Severity Tracking | Categorize incident severity |
| Multi-Child Association | Link multiple campers to incidents |
| Status Workflow | Open → Resolved tracking |
| Notifications | Automatic alerts to relevant staff |

**Database Tables:**
- `incident_reports` - Incident records
- `incident_children` - Child associations

---

### 10. Awards & Recognition Module

**File:** `src/pages/Awards.tsx`

| Feature | Description |
|---------|-------------|
| Award Management | Create and assign awards |
| Category Organization | Group awards by type |
| Camper History | Track achievements over time |
| Reports | Award statistics |

**Database Tables:**
- `awards` - Award records

---

### 11. Tutoring & Therapy Module

**File:** `src/pages/TutoringTherapy.tsx`

| Feature | Description |
|---------|-------------|
| Session Scheduling | Book tutoring/therapy sessions |
| Provider Management | Track external providers |
| Progress Notes | Session documentation |
| Notifications | Reminder alerts |

**Database Tables:**
- `tutoring_therapy_sessions` - Session records

---

### 12. Sports Academy Module

**File:** `src/pages/SportsAcademy.tsx`

| Feature | Description |
|---------|-------------|
| Program Management | Sports academy enrollment |
| Specialist Assignment | Coach/instructor mapping |
| Schedule Management | Training schedules |
| Progress Tracking | Skill development |

**Database Tables:**
- `sports_academy` - Enrollment records
- `specialist_sport_assignments` - Coach assignments

---

### 13. Administration Module

**Files:** `src/pages/Admin.tsx`, `src/pages/RolePermissions.tsx`, `src/pages/DivisionPermissions.tsx`

| Feature | Description |
|---------|-------------|
| User Management | Create, edit, delete users |
| Role Permissions | Configure menu access by role |
| Division Permissions | Scope users to specific divisions |
| User Approvals | New user registration workflow |
| Audit Logs | Track system changes |
| Data Import/Export | CSV operations |
| Company Settings | Multi-tenant configuration |

**Database Tables:**
- `profiles` - User profiles
- `role_permissions` - Menu access rules
- `division_permissions` - Division scoping
- `audit_logs` - Change tracking
- `companies` - Tenant configuration

---

### 14. Reporting Module

**File:** `src/pages/Reports.tsx`

| Feature | Description |
|---------|-------------|
| Camper Reports | Evaluations and assessments |
| Staff Reports | Performance reports |
| Incident Reports | Safety statistics |
| Export Options | PDF and CSV downloads |

---

## 🗄️ Database Schema

### Entity Relationship Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  companies  │────<│   profiles  │     │   seasons   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │     ┌─────────────┼─────────────┐
       │     │             │             │
       ▼     ▼             ▼             ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  divisions  │────<│  children   │     │    staff    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │     ┌─────────────┼─────────────┐     │
       │     │             │             │     │
       ▼     ▼             ▼             ▼     ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    bunks    │────<│ daily_notes │     │ bunk_staff  │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Core Tables

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `companies` | Multi-tenant organizations | Parent of all data |
| `profiles` | User accounts | Links to auth.users |
| `divisions` | Age/gender groups | Belongs to company |
| `bunks` | Housing units | Belongs to division |
| `children` | Camper records | Belongs to division, bunk |
| `staff` | Staff records | Belongs to company |

### Complete Table List (40+ Tables)

<details>
<summary>Click to expand full table list</summary>

- `activities_field_trips`
- `activities_field_trips_divisions`
- `appointments`
- `audit_logs`
- `automated_email_config`
- `awards`
- `bunk_staff`
- `bunks`
- `camper_evaluation_questions`
- `camper_reports`
- `children`
- `companies`
- `company_email_config`
- `daily_notes`
- `daily_wolf_content`
- `daily_wolf_documents`
- `division_permissions`
- `divisions`
- `email_logs`
- `evaluation_questions`
- `evaluation_responses`
- `events`
- `health_center_admissions`
- `incident_children`
- `incident_reports`
- `master_calendar`
- `medication_logs`
- `menu_items`
- `messages`
- `notification_logs`
- `profiles`
- `rainy_day_documents`
- `rainy_day_schedule`
- `role_permissions`
- `roster_template_children`
- `roster_templates`
- `schedule_conflicts`
- `scheduled_notifications`
- `special_events_activities`
- `specialist_sport_assignments`
- `sports_academy`
- `sports_calendar`
- `staff`
- `staff_evaluations`
- `trips`
- `trip_children`
- `tutoring_therapy_sessions`

</details>

---

## 🔐 Authentication & Authorization

### Authentication Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Sign Up    │────>│  Pending     │────>│   Approved   │
│   Form       │     │  Approval    │     │   User       │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Admin      │
                     │   Approves   │
                     └──────────────┘
```

### Role Hierarchy

| Role | Level | Access Scope |
|------|-------|--------------|
| `super_admin` | 1 | All companies, all data |
| `admin` | 2 | Single company, all divisions |
| `staff` | 3 | Single company, all divisions |
| `specialist` | 3 | Single company, all divisions |
| `health_center` | 3 | Single company, health data |
| `division_leader` | 4 | Assigned divisions only |
| `viewer` | 5 | Assigned divisions, read-only |

### Permission System

```typescript
// From src/hooks/usePermissions.ts
const fullDivisionAccessRoles: AppRole[] = [
  'admin', 
  'super_admin', 
  'specialist', 
  'staff', 
  'health_center'
];

// Division-scoped roles
const scopedRoles: AppRole[] = ['division_leader', 'viewer'];
```

### RLS (Row Level Security)

All tables have RLS policies ensuring:
- Users only see data for their company
- Division-scoped users only see their assigned divisions
- Super admins bypass all restrictions

---

## 🔌 External Integrations

### CampMinder Integration

**Purpose:** Sync camper and staff data from CampMinder API

**Edge Function:** `supabase/functions/sync-campminder/`

| Endpoint | Data Synced |
|----------|-------------|
| `/v2/organization/sessions/{id}/roster` | Campers |
| `/v2/organization/sessions/{id}/staff-list` | Staff |
| `/v2/organization/people/{id}` | Person details |

**Configuration:**
- API Key stored encrypted in `companies.campminder_api_key_encrypted`
- Subscription Key in `companies.campminder_subscription_key_encrypted`
- Sync enabled via `companies.campminder_sync_enabled`

### Microsoft 365 Email Integration

**Purpose:** Send emails via organization's M365 account

**Edge Function:** `supabase/functions/test-m365-connection/`

**Configuration (per company):**
- `company_email_config.m365_tenant_id`
- `company_email_config.m365_client_id`
- `company_email_config.m365_client_secret_encrypted`
- `company_email_config.m365_sender_email`

---

## ⚡ Edge Functions (Backend Services)

### Function Inventory

| Function | Purpose | Trigger |
|----------|---------|---------|
| `ai-chat` | AI assistant functionality | HTTP |
| `check-medication-alerts` | Overdue medication notifications | Scheduled |
| `create-user` | Admin user creation | HTTP |
| `delete-user` | User deletion with cleanup | HTTP |
| `detect-schedule-conflicts` | Calendar conflict detection | HTTP |
| `generate-daily-medications` | Daily medication schedules | Scheduled |
| `get-weather` | Weather API proxy | HTTP |
| `import-tyler-hill-data` | Tyler Hill data import | HTTP |
| `notify-transportation-events` | Trip notifications | HTTP |
| `process-scheduled-notifications` | Send queued notifications | Scheduled |
| `send-appointment-notification` | Appointment alerts | HTTP |
| `send-bulk-email` | Mass email sending | HTTP |
| `send-event-notifications` | Event reminders | HTTP |
| `send-health-center-notification` | Health alerts | HTTP |
| `send-incident-notification` | Incident reports | HTTP |
| `send-sports-academy-notification` | Sports alerts | HTTP |
| `send-tutoring-notification` | Tutoring reminders | HTTP |
| `send-user-approval-notification` | Approval requests | HTTP |
| `send-user-invitation` | User invites | HTTP |
| `sync-campminder` | CampMinder sync | Scheduled/HTTP |
| `test-campminder-connection` | API connectivity test | HTTP |
| `test-m365-connection` | M365 connectivity test | HTTP |

### Shared Utilities

**`supabase/functions/_shared/`**

- `emailHelpers.ts` - Email sending and recipient resolution
- `timingHelpers.ts` - Notification timing calculations

---

## 📱 React Native Migration Guide

### Overview

Converting The Nest to React Native requires significant architectural changes since React Native uses different primitives than web. Below is a comprehensive migration strategy.

### Phase 1: Assessment & Planning (2-4 weeks)

#### 1.1 Feature Prioritization

| Priority | Features | Complexity |
|----------|----------|------------|
| **P0** | Authentication, Dashboard, Roster | Medium |
| **P1** | Health Center, Daily Notes, Messaging | High |
| **P2** | Calendars, Transportation, Reports | High |
| **P3** | Admin features, Settings | Medium |

#### 1.2 Technology Selection

**Recommended Stack:**

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Framework** | React Native + Expo | Fastest development, OTA updates |
| **Navigation** | React Navigation 6 | Industry standard |
| **State** | TanStack Query + Zustand | Same as web for consistency |
| **UI Library** | NativeWind | Tailwind for React Native |
| **Forms** | React Hook Form | Same as web |
| **Backend** | Supabase (unchanged) | No migration needed |

**Alternative Approaches:**

| Approach | Pros | Cons |
|----------|------|------|
| **Expo (Managed)** | Easiest, OTA updates | Some native limitations |
| **Expo (Bare)** | Full native access | More setup |
| **React Native CLI** | Maximum control | Most complex |
| **Capacitor** | Minimal code changes | WebView performance |

### Phase 2: Project Setup (1-2 weeks)

#### 2.1 Initialize Project

```bash
# Create new Expo project
npx create-expo-app the-nest-mobile --template expo-template-blank-typescript

# Install core dependencies
cd the-nest-mobile
npx expo install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context
npx expo install @supabase/supabase-js
npx expo install @tanstack/react-query
npx expo install react-hook-form zod @hookform/resolvers
npx expo install nativewind tailwindcss

# For secure storage (auth tokens)
npx expo install expo-secure-store
```

#### 2.2 Project Structure

```
the-nest-mobile/
├── src/
│   ├── components/           # Shared components
│   │   ├── ui/              # Base UI components
│   │   └── features/        # Feature-specific
│   ├── screens/             # Screen components (replaces pages/)
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── roster/
│   │   └── ...
│   ├── navigation/          # Navigation configuration
│   │   ├── RootNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── MainNavigator.tsx
│   ├── hooks/               # Custom hooks (mostly reusable)
│   ├── contexts/            # Contexts (mostly reusable)
│   ├── services/            # API services
│   │   └── supabase.ts
│   ├── utils/               # Utilities (mostly reusable)
│   └── types/               # TypeScript types
├── app.json                 # Expo configuration
└── tailwind.config.js       # NativeWind config
```

### Phase 3: Core Migration (4-8 weeks)

#### 3.1 Supabase Client Migration

**Web (current):**
```typescript
// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

**React Native:**
```typescript
// src/services/supabase.ts
import 'react-native-url-polyfill/auto'
import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
```

#### 3.2 Navigation Setup

```typescript
// src/navigation/RootNavigator.tsx
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

const Stack = createNativeStackNavigator()

export function RootNavigator() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
```

#### 3.3 Component Migration Strategy

**Pattern: Web → React Native**

| Web Element | React Native Equivalent |
|-------------|------------------------|
| `<div>` | `<View>` |
| `<span>`, `<p>` | `<Text>` |
| `<button>` | `<TouchableOpacity>` or `<Pressable>` |
| `<input>` | `<TextInput>` |
| `<img>` | `<Image>` |
| `<a>` | `<TouchableOpacity>` + navigation |
| CSS classes | NativeWind classes or StyleSheet |
| `onClick` | `onPress` |

**Example Migration:**

**Web (Current):**
```tsx
// src/components/StatCard.tsx
<div className="p-4 rounded-lg bg-card border">
  <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
  <p className="text-2xl font-bold">{value}</p>
</div>
```

**React Native:**
```tsx
// src/components/StatCard.tsx
<View className="p-4 rounded-lg bg-card border border-border">
  <Text className="text-sm font-medium text-muted-foreground">{title}</Text>
  <Text className="text-2xl font-bold text-foreground">{value}</Text>
</View>
```

#### 3.4 Reusable Code (No Changes Needed)

These can be copied directly:
- `src/hooks/usePermissions.ts`
- `src/contexts/AuthContext.tsx` (minor async storage changes)
- `src/contexts/CompanyContext.tsx`
- `src/contexts/SeasonContext.tsx`
- `src/lib/utils.ts`
- `src/lib/divisionUtils.ts`
- `src/lib/validationSchemas.ts`
- All TypeScript types

### Phase 4: UI Component Library (2-4 weeks)

#### 4.1 Create Native UI Components

Replace shadcn/ui with native equivalents:

```typescript
// src/components/ui/button.tsx
import { Pressable, Text } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-md',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        destructive: 'bg-destructive',
        outline: 'border border-input bg-background',
        secondary: 'bg-secondary',
        ghost: '',
        link: '',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export function Button({ 
  children, 
  variant, 
  size, 
  onPress,
  ...props 
}: ButtonProps) {
  return (
    <Pressable 
      className={buttonVariants({ variant, size })}
      onPress={onPress}
      {...props}
    >
      <Text className="text-primary-foreground font-medium">
        {children}
      </Text>
    </Pressable>
  )
}
```

### Phase 5: Feature Implementation (8-12 weeks)

#### Implementation Order

1. **Authentication** (Week 1-2)
   - Login/Signup screens
   - Password reset flow
   - Session persistence

2. **Dashboard** (Week 2-3)
   - Stats cards
   - Today's menu
   - Birthdays
   - Weather widget

3. **Roster/Campers** (Week 3-5)
   - List view with search/filter
   - Camper profile screen
   - Tab navigation for profile sections

4. **Health Center** (Week 5-7)
   - Medication tracking
   - Admission management
   - Push notifications for reminders

5. **Messaging** (Week 7-8)
   - Message list
   - Message detail
   - Push notifications

6. **Calendars** (Week 8-10)
   - Master calendar
   - Sports calendar
   - Event creation

7. **Admin Features** (Week 10-12)
   - User management
   - Settings
   - Reports (simplified)

### Phase 6: Native Features (2-4 weeks)

#### 6.1 Push Notifications

```typescript
// src/services/notifications.ts
import * as Notifications from 'expo-notifications'
import { supabase } from './supabase'

export async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  const token = await Notifications.getExpoPushTokenAsync()
  
  // Store token in Supabase for the current user
  await supabase
    .from('profiles')
    .update({ push_token: token.data })
    .eq('id', user.id)
}
```

#### 6.2 Offline Support

```typescript
// src/hooks/useOfflineSync.ts
import NetInfo from '@react-native-community/netinfo'
import AsyncStorage from '@react-native-async-storage/async-storage'

export function useOfflineSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        // Sync pending changes
        syncPendingChanges()
      }
    })

    return unsubscribe
  }, [])
}
```

### Phase 7: Testing & Deployment (2-4 weeks)

#### 7.1 Testing Strategy

| Test Type | Tools |
|-----------|-------|
| Unit Tests | Jest + React Native Testing Library |
| Integration | Detox |
| E2E | Maestro |

#### 7.2 Deployment

**App Store (iOS):**
1. Enroll in Apple Developer Program ($99/year)
2. Configure app signing in Xcode
3. Submit via App Store Connect
4. Wait for review (1-7 days)

**Play Store (Android):**
1. Enroll in Google Play Console ($25 one-time)
2. Generate signed APK/AAB
3. Submit via Play Console
4. Wait for review (hours to days)

**OTA Updates (Expo):**
```bash
# Deploy JavaScript updates without store review
eas update --channel production
```

### Migration Timeline Summary

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Planning | 2-4 weeks | Tech decisions finalized |
| Setup | 1-2 weeks | Project scaffolded |
| Core Migration | 4-8 weeks | Auth + Navigation working |
| UI Library | 2-4 weeks | Component library complete |
| Features | 8-12 weeks | All features implemented |
| Native Features | 2-4 weeks | Push notifications, offline |
| Testing & Deploy | 2-4 weeks | App store submission |
| **Total** | **21-38 weeks** | **Production launch** |

### Alternative: Capacitor (Faster, Less Native)

If a faster timeline is needed with fewer native features:

```bash
# Add Capacitor to existing web project
npm install @capacitor/core @capacitor/cli
npx cap init "The Nest" "app.thenest.camp"
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
npm run build
npx cap sync
npx cap run ios
```

**Timeline:** 2-4 weeks for basic mobile app

**Trade-offs:**
- ✅ 95% code reuse
- ✅ Faster development
- ❌ WebView performance
- ❌ Less "native" feel
- ❌ Larger app size

---

## 🚀 Deployment & Infrastructure

### Current Deployment

| Component | Platform |
|-----------|----------|
| Frontend | Lovable (Preview + Production) |
| Backend | Supabase Cloud |
| Edge Functions | Supabase Edge |
| Database | Supabase PostgreSQL |

### URLs

- **Preview:** `https://6be716a0-9ab3-4d9c-b990-b02c1d909c93.lovableproject.com`
- **Production:** `https://tylerhill.lovable.app`

---

## 📎 Appendix

### A. Environment Variables

```env
VITE_SUPABASE_URL=https://gdcxtefbarvnrtvacqln.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[anon-key]
VITE_SUPABASE_PROJECT_ID=gdcxtefbarvnrtvacqln
```

### B. Key File References

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component with routing |
| `src/components/AppSidebar.tsx` | Navigation menu |
| `src/contexts/AuthContext.tsx` | Authentication state |
| `src/hooks/usePermissions.ts` | RBAC hook |
| `supabase/functions/_shared/` | Shared backend utilities |

### C. Useful Commands

```bash
# Development
npm run dev

# Build
npm run build

# Type checking
npm run typecheck

# Deploy edge functions
npx supabase functions deploy [function-name]
```

---

## 📞 Support

For questions about this documentation or the platform:
- Review the codebase at `/src`
- Check edge function logs in Supabase dashboard
- Consult the inline JSDoc comments throughout the code

---

*Document Version: 1.0*  
*Last Updated: January 2026*  
*Platform Version: The Nest v1.0*
