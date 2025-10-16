import { z } from "zod";

// Child validation schema - Only First Name, Last Name, and Person ID are required
export const childSchema = z.object({
  name: z.string().trim().min(1, "First and Last Name are required").max(100, "Name must be less than 100 characters"),
  person_id: z.string().trim().min(1, "Person ID is required").max(50, "Person ID must be less than 50 characters"),
  age: z.number().int().min(0, "Age must be positive").max(18, "Age must be 18 or less").nullable().optional(),
  grade: z.string().trim().max(50, "Grade must be less than 50 characters").nullable().optional(),
  group_name: z.string().trim().max(100, "Group name must be less than 100 characters").nullable().optional(),
  guardian_email: z.union([z.string().trim().email("Invalid email address").max(255), z.literal("")]).nullable().optional(),
  guardian_phone: z.string().trim().max(20, "Phone must be less than 20 characters").nullable().optional(),
  emergency_contact: z.string().trim().max(255, "Emergency contact must be less than 255 characters").nullable().optional(),
  allergies: z.string().trim().max(1000, "Allergies must be less than 1000 characters").nullable().optional(),
  medical_notes: z.string().trim().max(1000, "Medical notes must be less than 1000 characters").nullable().optional(),
});

// Staff validation schema
export const staffSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  role: z.string().trim().min(1, "Role is required").max(100, "Role must be less than 100 characters"),
  department: z.string().trim().max(100, "Department must be less than 100 characters").nullable().optional(),
  email: z.union([z.string().trim().email("Invalid email address").max(255), z.literal("")]).nullable().optional(),
  phone: z.string().trim().max(20, "Phone must be less than 20 characters").nullable().optional(),
  hire_date: z.string().nullable().optional(),
});

// Award validation schema
export const awardSchema = z.object({
  title: z.string().min(1, "Title is required"),
  child_id: z.string().uuid("Invalid child ID"),
  date: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
});

// Daily note validation schema
export const dailyNoteSchema = z.object({
  child_id: z.string().uuid("Invalid child ID"),
  date: z.string(),
  mood: z.string().optional(),
  activities: z.string().optional(),
  meals: z.string().optional(),
  nap: z.string().optional(),
  notes: z.string().optional(),
});

// Trip validation schema
export const tripSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  date: z.string(),
  destination: z.string().optional(),
  departure_time: z.string().optional(),
  return_time: z.string().optional(),
  chaperone: z.string().optional(),
  capacity: z.number().optional(),
  status: z.string().optional(),
});

// Menu items validation schema
export const menuItemSchema = z.object({
  date: z.string().min(1, "Date is required"),
  meal_type: z.enum(["breakfast", "lunch", "snack", "dinner"], { 
    required_error: "Meal type is required",
    invalid_type_error: "Meal type must be breakfast, lunch, snack, or dinner"
  }),
  items: z.string().min(1, "Menu items are required"),
  allergens: z.string().nullable().optional(),
});

// Incident report validation schema
export const incidentReportSchema = z.object({
  child_id: z.string().uuid("Invalid child ID"),
  date: z.string().min(1, "Date is required"),
  type: z.string().min(1, "Type is required"),
  description: z.string().min(1, "Description is required"),
  severity: z.string().optional(),
  reported_by: z.string().optional(),
  status: z.string().optional(),
});

// Medication validation schema
export const medicationSchema = z.object({
  child_id: z.string().uuid("Invalid child ID"),
  date: z.string().min(1, "Date is required"),
  medication_name: z.string().min(1, "Medication name is required"),
  dosage: z.string().optional(),
  scheduled_time: z.string().min(1, "Scheduled time is required"),
  notes: z.string().optional(),
  is_recurring: z.boolean().optional(),
  frequency: z.string().optional(),
  days_of_week: z.array(z.string()).optional(),
  end_date: z.string().nullable().optional(),
});

// Calendar event validation schema
export const calendarEventSchema = z.object({
  event_date: z.string().min(1, "Date is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.string().min(1, "Type is required"),
  time: z.string().optional(),
  location: z.string().optional(),
});

// Sports calendar validation schema
export const sportsCalendarSchema = z.object({
  event_date: z.string().min(1, "Date is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  sport_type: z.string().min(1, "Sport type is required"),
  time: z.string().optional(),
  location: z.string().optional(),
  team: z.string().optional(),
  opponent: z.string().optional(),
});

// Convert CSV row to typed object for children
export function parseChildRow(row: Record<string, any>) {
  // Construct full name from first and last name
  const firstName = row.first_name || row['First Name'] || row.firstname || '';
  const lastName = row.last_name || row['Last Name'] || row.lastname || '';
  const fullName = `${firstName} ${lastName}`.trim() || row.name || '';
  
  return {
    name: fullName,
    person_id: row.person_id || row['Person ID'] || row.PersonID || row.personid || '',
    age: row.age || row.Age ? parseInt(row.age || row.Age, 10) : null,
    grade: row.grade || row.Grade || null,
    group_name: row.group_name || row['Group Name'] || null,
    guardian_email: row.guardian_email || row['Guardian Email'] || null,
    guardian_phone: row.guardian_phone || row['Guardian Phone'] || null,
    emergency_contact: row.emergency_contact || row['Emergency Contact'] || null,
    allergies: row.allergies || row.Allergies || null,
    medical_notes: row.medical_notes || row['Medical Notes'] || null,
  };
}

// Convert CSV row to typed object for staff
export function parseStaffRow(row: Record<string, any>) {
  return {
    name: row.name,
    role: row.role,
    department: row.department || null,
    email: row.email || null,
    phone: row.phone || null,
    hire_date: row.hire_date || null,
  };
}

export function parseAwardRow(row: Record<string, any>) {
  return {
    title: String(row.title || row.Title || ''),
    child_id: String(row.child_id || row['Child ID'] || ''),
    date: String(row.date || row.Date || ''),
    category: String(row.category || row.Category || ''),
    description: String(row.description || row.Description || ''),
  };
}

export function parseDailyNoteRow(row: Record<string, any>) {
  return {
    child_id: String(row.child_id || row['Child ID'] || ''),
    date: String(row.date || row.Date || ''),
    mood: String(row.mood || row.Mood || ''),
    activities: String(row.activities || row.Activities || ''),
    meals: String(row.meals || row.Meals || ''),
    nap: String(row.nap || row.Nap || ''),
    notes: String(row.notes || row.Notes || ''),
  };
}

export function parseTripRow(row: Record<string, any>) {
  return {
    name: String(row.name || row.Name || ''),
    type: String(row.type || row.Type || ''),
    date: String(row.date || row.Date || ''),
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

export function parseIncidentReportRow(row: Record<string, any>) {
  return {
    child_id: String(row.child_id || row['Child ID'] || ''),
    date: String(row.date || row.Date || ''),
    type: String(row.type || row.Type || ''),
    description: String(row.description || row.Description || ''),
    severity: String(row.severity || row.Severity || ''),
    reported_by: String(row.reported_by || row['Reported By'] || ''),
    status: String(row.status || row.Status || 'open'),
  };
}

export function parseMedicationRow(row: Record<string, any>) {
  return {
    child_id: String(row.child_id || row['Child ID'] || ''),
    date: String(row.date || row.Date || ''),
    medication_name: String(row.medication_name || row['Medication Name'] || ''),
    dosage: String(row.dosage || row.Dosage || ''),
    scheduled_time: String(row.scheduled_time || row['Scheduled Time'] || ''),
    notes: String(row.notes || row.Notes || ''),
    is_recurring: Boolean(row.is_recurring || row['Is Recurring'] || false),
    frequency: String(row.frequency || row.Frequency || 'daily'),
    days_of_week: row.days_of_week ? String(row.days_of_week).split(',') : [],
    end_date: String(row.end_date || row['End Date'] || '') || null,
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
