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
