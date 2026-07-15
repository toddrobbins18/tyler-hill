import { z } from "zod";
import { toBirthdayIsoDate } from "./birthdayCalendar";
import { normalizeCsvPersonId } from "./csvPersonIdResolve";
import { pickCell, parseYesNo } from "./spreadsheetRowUtils";

/** Excel often stores IDs and text columns as numbers — coerce for Zod string fields. */
function coerceCsvString(value: unknown): string | null {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  return text || null;
}

function parseCsvAge(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

// Child validation schema - Only name and person_id are required
export const childSchema = z.object({
  name: z.string().trim().min(1, "First and Last Name are required").max(100, "Name must be less than 100 characters"),
  person_id: z.string().trim().min(1, "Person ID is required").max(50, "Person ID must be less than 50 characters"),
  age: z.number().int().min(0).max(18).nullable().optional(),
  grade: z.string().trim().max(50).nullable().optional(),
  group_name: z.string().trim().max(100).nullable().optional(),
  guardian_email: z.union([z.string().trim().email().max(255), z.literal("")]).nullable().optional(),
  guardian_phone: z.string().trim().max(20).nullable().optional(),
  emergency_contact: z.string().trim().max(255).nullable().optional(),
  allergies: z.string().trim().max(1000).nullable().optional(),
  medical_notes: z.string().trim().max(1000).nullable().optional(),
  category: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  division_id: z.string().uuid().nullable().optional(),
  leader_id: z.string().uuid().nullable().optional(),
  season: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  session: z.string().nullable().optional(),
  birthday_party_type: z.string().nullable().optional(),
  birthday_cake_meal: z.string().nullable().optional(),
  birthday_party_comments: z.string().nullable().optional(),
  birthday_group: z.string().nullable().optional(),
  birthday_cake_type: z.string().nullable().optional(),
  birthday_frosting_colors: z.array(z.string()).nullable().optional(),
  birthday_toppings: z.array(z.string()).nullable().optional(),
  birthday_cake_allergies: z.array(z.string()).nullable().optional(),
  birthday_cake_message: z.string().nullable().optional(),
  rfid: z.string().nullable().optional(),
});

// Staff validation schema - only name is truly required
export const staffSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  person_id: z.string().trim().max(50).optional().default(""),
  role: z.string().trim().max(100).optional().default("Staff"),
  department: z.string().trim().max(100).nullable().optional(),
  email: z.union([z.string().trim().email().max(255), z.literal("")]).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  hire_date: z.string().nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  leader_id: z.string().uuid().nullable().optional(),
  staff_type: z.enum(["general_counselor", "specialist", "support", "leadership", "both"]).nullable().optional(),
  season: z.string().nullable().optional(),
  session: z.string().nullable().optional(),
  allergies: z.string().nullable().optional(),
  rfid: z.string().nullable().optional(),
  tshirt_size: z.string().nullable().optional(),
  division_id: z.string().uuid().nullable().optional(),
});

// Award validation schema
export const awardSchema = z.object({
  title: z.string().min(1, "Title is required"),
  person_id: z.string().trim().optional().default(""),
  date: z.string().optional().default(""),
  category: z.string().optional(),
  description: z.string().optional(),
});

// Daily note validation schema
export const dailyNoteSchema = z.object({
  person_id: z.string().trim().optional().default(""),
  date: z.string().optional().default(""),
  mood: z.string().optional(),
  activities: z.string().optional(),
  meals: z.string().optional(),
  nap: z.string().optional(),
  notes: z.string().optional(),
});

// Trip validation schema
export const tripSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().optional().default("Trip"),
  date: z.string().optional().default(""),
  end_date: z.string().optional(),
  is_multi_day: z.boolean().optional().default(false),
  destination: z.string().optional(),
  departure_time: z.string().optional(),
  return_time: z.string().optional(),
  chaperone: z.string().optional(),
  capacity: z.number().optional(),
  status: z.string().optional(),
}).refine((data) => {
  if (data.is_multi_day && data.end_date && data.date) {
    return new Date(data.end_date) > new Date(data.date);
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["end_date"],
});

// Menu items validation schema
export const menuItemSchema = z.object({
  date: z.string().min(1, "Date is required"),
  meal_type: z.enum(["breakfast", "lunch", "snack", "dinner", "special_meal"], { 
    required_error: "Meal type is required",
    invalid_type_error: "Meal type must be breakfast, lunch, snack, dinner, or special_meal"
  }),
  items: z.string().min(1, "Menu items are required"),
  allergens: z.string().nullable().optional(),
  division_ids: z.array(z.string().uuid()).nullable().optional(),
});

// Incident report validation schema
export const incidentReportSchema = z.object({
  person_ids: z.array(z.string().trim()).default([]),
  date: z.string().optional().default(""),
  type: z.string().optional().default("General"),
  description: z.string().optional().default(""),
  severity: z.string().optional(),
  tags: z.array(z.string()).optional(),
  reported_by: z.string().optional(),
  reporter_person_id: z.string().optional(),
  status: z.string().optional(),
  season: z.string().optional(),
});

// Medication validation schema
export const medicationSchema = z.object({
  person_id: z.string().trim().min(1, "Person ID is required"),
  date: z.string().optional().default(""),
  medication_name: z.string().min(1, "Medication name is required"),
  dosage: z.string().trim().optional().nullable().default(""),
  scheduled_time: z.string().optional().default(""),
  notes: z.string().optional(),
  is_recurring: z.boolean().optional(),
  frequency: z.string().optional(),
  days_of_week: z.array(z.string()).optional(),
  end_date: z.string().nullable().optional(),
});

// Calendar event validation schema
export const calendarEventSchema = z.object({
  event_date: z.string().optional().default(""),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.string().optional().default("Event"),
  time: z.string().optional(),
  location: z.string().optional(),
});

// Sports calendar validation schema
export const sportsCalendarSchema = z.object({
  event_date: z.string().optional().default(""),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  sport_type: z.string().optional().default("General"),
  time: z.string().optional(),
  location: z.string().optional(),
  team: z.string().optional(),
  opponent: z.string().optional(),
});

// Daily Wolf Content validation schema
export const dailyWolfContentSchema = z.object({
  date: z.string().min(1, "Date is required"),
  officer_of_day: z.string().max(500).optional(),
  laundry_info: z.string().max(1000).optional(),
  phone_calls_info: z.string().max(1000).optional(),
  quote_of_the_day: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  season: z.string().optional(),
});

// Bunk staff assignment validation schema
export const bunkStaffSchema = z.object({
  person_id: z.string().min(1, "Person ID is required"),
  bunk_number: z.string().or(z.number()).transform(val => String(val)).optional(),
  bunk_name: z.string().optional(),
  is_primary: z.boolean().optional().default(false),
});

export function parseBunkStaffRow(row: Record<string, any>) {
  // Use a case-insensitive key lookup to make matching bulletproof
  const getVal = (...keys: string[]) => {
    const lowerKeys = keys.map(k => k.toLowerCase());
    for (const [key, value] of Object.entries(row)) {
      if (lowerKeys.includes(key.toLowerCase().trim())) {
        return value;
      }
    }
    return '';
  };

  let bunkNumberRaw = getVal('bunk_number', 'Bunk Number', 'bunk');
  let bunkNameRaw = getVal('bunk_name', 'Bunk Name');
  
  let isPrimary = getVal('is_primary', 'Is Primary', 'primary');
  isPrimary = ['true', 'yes', '1', 'primary'].includes(String(isPrimary).toLowerCase().trim());
  
  return {
    person_id: String(getVal('person_id', 'Person ID', 'PersonID', 'personid')).trim(),
    bunk_number: bunkNumberRaw,
    bunk_name: String(bunkNameRaw).trim() || undefined,
    is_primary: isPrimary,
  };
}

// Convert CSV row to typed object for children
export function parseChildRow(row: Record<string, any>): Record<string, unknown> | null {
  const division = coerceCsvString(row.Division || row.division)?.toLowerCase();
  if (division === "staff") return null;

  const firstName = coerceCsvString(row.first_name || row["First Name"] || row.firstname) || "";
  const lastName = coerceCsvString(row.last_name || row["Last Name"] || row.lastname) || "";
  const fullName = `${firstName} ${lastName}`.trim() || coerceCsvString(row.name) || "";

  const personId = normalizeCsvPersonId(
    row.person_id ?? row["Person ID"] ?? row.PersonID ?? row.personid,
  );

  let allergies =
    coerceCsvString(row.allergies || row.Allergies || row["All Allergies"] || row["All allergies"]) ??
    null;
  const epiPen = row["Epi Pen"] ?? row["Epi pen"] ?? row.epi_pen ?? row.EpiPen;
  if (epiPen != null && String(epiPen).trim() !== "") {
    const epiLabel =
      String(epiPen).trim().toLowerCase() === "yes"
        ? "Epi Pen: Yes"
        : String(epiPen).trim().toLowerCase() === "no"
          ? "Epi Pen: No"
          : `Epi Pen: ${String(epiPen).trim()}`;
    allergies = allergies ? `${allergies}; ${epiLabel}` : epiLabel;
  }

  return {
    name: fullName,
    person_id: personId,
    age: parseCsvAge(row.age ?? row.Age),
    grade: coerceCsvString(row.grade || row.Grade),
    group_name: coerceCsvString(row.group_name || row["Group Name"]),
    guardian_email: coerceCsvString(row.guardian_email || row["Guardian Email"]),
    guardian_phone: coerceCsvString(row.guardian_phone || row["Guardian Phone"]),
    emergency_contact: coerceCsvString(row.emergency_contact || row["Emergency Contact"]),
    allergies,
    medical_notes: coerceCsvString(row.medical_notes || row["Medical Notes"]),
  };
}

// Convert CSV row to typed object for staff
export function parseStaffRow(row: Record<string, any>) {
  const firstName = row.first_name || row['First Name'] || row.firstname || '';
  const lastName = row.last_name || row['Last Name'] || row.lastname || '';
  const fullName = `${firstName} ${lastName}`.trim() || row.name || row.Name || '';
  
  return {
    name: fullName,
    person_id: String(row.person_id || row['Person ID'] || row.PersonID || row.personid || '').trim(),
    role: row.role || row.Role || '',
    department: row.department || row.Department || null,
    email: row.email || row.Email || null,
    phone: row.phone || row.Phone || null,
    hire_date: row.hire_date || row['Hire Date'] || null,
    date_of_birth: toBirthdayIsoDate(
      row.date_of_birth ||
      row['Date of Birth'] ||
      row['Birth Date'] ||
      row.dob ||
      row.DOB ||
      null,
    ),
  };
}

// Award CSV parser
export function parseAwardRow(row: Record<string, any>) {
  return {
    title: String(row.title || row.Title || ''),
    person_id: String(row.person_id || row['Person ID'] || row.PersonID || row.personid || '').trim(),
    date: String(row.date || row.Date || ''),
    category: String(row.category || row.Category || ''),
    description: String(row.description || row.Description || ''),
  };
}

// Daily note CSV parser
export function parseDailyNoteRow(row: Record<string, any>) {
  return {
    person_id: String(row.person_id || row['Person ID'] || row.PersonID || row.personid || '').trim(),
    date: String(row.date || row.Date || ''),
    mood: String(row.mood || row.Mood || ''),
    activities: String(row.activities || row.Activities || ''),
    meals: String(row.meals || row.Meals || ''),
    nap: String(row.nap || row.Nap || ''),
    notes: String(row.notes || row.Notes || ''),
  };
}

export function parseTripRow(row: Record<string, any>) {
  const endDate = row.end_date || row['End Date'] || '';
  const startDate = row.date || row.Date || '';
  const isMultiDay = endDate && endDate !== startDate;
  
  return {
    name: String(row.name || row.Name || ''),
    type: String(row.type || row.Type || ''),
    date: String(startDate),
    end_date: endDate ? String(endDate) : undefined,
    is_multi_day: isMultiDay,
    destination: String(row.destination || row.Destination || ''),
    departure_time: String(row.departure_time || row['Departure Time'] || ''),
    return_time: String(row.return_time || row['Return Time'] || ''),
    chaperone: String(row.chaperone || row.Chaperone || ''),
    capacity: row.capacity || row.Capacity ? Number(row.capacity || row.Capacity) : undefined,
    status: String(row.status || row.Status || 'upcoming'),
  };
}

export function parseMenuItemRow(row: Record<string, any>) {
  return {
    date: String(row.date || row.Date || ''),
    meal_type: String(row.meal_type || row['Meal Type'] || row.meal || '').toLowerCase(),
    items: String(row.items || row.Items || row['Menu Items'] || ''),
    allergens: String(row.allergens || row.Allergens || '') || null,
  };
}

// Incident report CSV parser
export function parseIncidentReportRow(row: Record<string, any>) {
  const personIdString = String(row.person_id || row['Person ID'] || row.PersonID || row.person_ids || row['Person IDs'] || '').trim();
  const personIds = personIdString ? personIdString.split(',').map(id => id.trim()).filter(Boolean) : [];
  
  return {
    person_ids: personIds,
    date: String(row.date || row.Date || ''),
    type: String(row.type || row.Type || ''),
    description: String(row.description || row.Description || ''),
    severity: String(row.severity || row.Severity || ''),
    reported_by: String(row.reported_by || row['Reported By'] || ''),
    reporter_person_id: String(row.reporter_person_id || row['Reporter Person ID'] || '').trim() || undefined,
    status: String(row.status || row.Status || 'open'),
  };
}

// Medication CSV / Excel parser (CampMinder export compatible)
export function parseMedicationRow(row: Record<string, any>) {
  const recurringRaw = pickCell(
    row,
    "is_recurring",
    "Is Recurring",
    "Recurring (if daily or not)",
    "RECURRING",
    "Recurring",
  );
  const isRecurring = parseYesNo(recurringRaw);

  const daysRaw = pickCell(row, "days_of_week", "Days of Week", "DAYS OF WEEK");
  const frequencyRaw = pickCell(row, "frequency", "Frequency", "FREQUENCY");

  return {
    person_id: normalizeCsvPersonId(
      pickCell(row, "person_id", "Person ID", "PersonID", "personid", "Camper ID", "CamperID"),
    ),
    date: pickCell(row, "date", "Date", "START DATE", "Start Date", "start_date", "START DATE "),
    medication_name: pickCell(row, "medication_name", "Medication Name", "MEDICATION NAME", "Medication"),
    dosage: pickCell(row, "dosage", "Dosage", "DOSAGE") || null,
    scheduled_time: pickCell(
      row,
      "scheduled_time",
      "Scheduled Time",
      "SCHEDULED TIME",
      "Meal Time",
      "meal_time",
      "MEAL TIME",
      "Time",
      "time"
    ),
    notes: pickCell(row, "notes", "Notes", "NOTES"),
    is_recurring: isRecurring,
    frequency: frequencyRaw || "daily",
    days_of_week: daysRaw ? daysRaw.split(",").map((d) => d.trim()).filter(Boolean) : [],
    end_date: pickCell(row, "end_date", "End Date", "END DATE", "END DATE ") || null,
  };
}

export function parseCalendarEventRow(row: Record<string, any>) {
  return {
    event_date: String(row.event_date || row['Event Date'] || row.date || ''),
    title: String(row.title || row.Title || ''),
    description: String(row.description || row.Description || ''),
    type: String(row.type || row.Type || ''),
    time: String(row.time || row.Time || ''),
    location: String(row.location || row.Location || ''),
  };
}

export function parseSportsCalendarRow(row: Record<string, any>) {
  return {
    event_date: String(row.event_date || row['Event Date'] || row.date || ''),
    title: String(row.title || row.Title || ''),
    description: String(row.description || row.Description || ''),
    sport_type: String(row.sport_type || row['Sport Type'] || row.sport || ''),
    time: String(row.time || row.Time || ''),
    location: String(row.location || row.Location || ''),
    team: String(row.team || row.Team || ''),
    opponent: String(row.opponent || row.Opponent || ''),
  };
}

export function parseDailyWolfContentRow(row: Record<string, any>) {
  return {
    date: String(row.date || row.Date || ''),
    officer_of_day: String(row.officer_of_day || row['Officer of Day'] || row.OD || row.od || '') || undefined,
    laundry_info: String(row.laundry_info || row['Laundry Info'] || row.Laundry || '') || undefined,
    phone_calls_info: String(row.phone_calls_info || row['Phone Calls Info'] || row['Phone Calls'] || '') || undefined,
    quote_of_the_day: String(row.quote_of_the_day || row['Quote of the Day'] || row.Quote || '') || undefined,
    notes: String(row.notes || row.Notes || '') || undefined,
    season: String(row.season || row.Season || '') || undefined,
  };
}
