import { z } from "zod";

// Child validation schema
export const childSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
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

// Convert CSV row to typed object for children
export function parseChildRow(row: Record<string, any>) {
  return {
    name: row.name,
    age: row.age ? parseInt(row.age, 10) : null,
    grade: row.grade || null,
    group_name: row.group_name || null,
    guardian_email: row.guardian_email || null,
    guardian_phone: row.guardian_phone || null,
    emergency_contact: row.emergency_contact || null,
    allergies: row.allergies || null,
    medical_notes: row.medical_notes || null,
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
