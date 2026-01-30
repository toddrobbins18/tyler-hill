import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert 24-hour time to 12-hour format with AM/PM
export function formatTime12Hour(time24: string): string {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// Convert 12-hour time with AM/PM to 24-hour format
export function formatTime24Hour(time12: string): string {
  if (!time12) return '';
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return time12;
  
  let [, hours, minutes, ampm] = match;
  let hour = parseInt(hours, 10);
  
  if (ampm.toUpperCase() === 'PM' && hour !== 12) {
    hour += 12;
  } else if (ampm.toUpperCase() === 'AM' && hour === 12) {
    hour = 0;
  }
  
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
}

/**
 * Parse a date string (YYYY-MM-DD) into a Date object without timezone shifting.
 * This prevents the common issue where dates are interpreted as UTC and shift 
 * to the previous/next day when displayed in local time.
 * 
 * @param dateString - A date string in YYYY-MM-DD format
 * @returns A Date object representing midnight local time on that date
 */
export function parseLocalDate(dateString: string): Date {
  if (!dateString) return new Date();
  return new Date(dateString + 'T00:00:00');
}

/**
 * Format a date string for display, handling timezone correctly.
 * 
 * @param dateString - A date string in YYYY-MM-DD format
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatLocalDate(dateString: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return '';
  const defaultOptions: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  };
  return parseLocalDate(dateString).toLocaleDateString('en-US', options || defaultOptions);
}

/**
 * Format a date as MM/DD/YYYY for consistent US date display
 */
export function formatDateUS(dateString: string): string {
  if (!dateString) return '';
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('en-US', { 
    month: '2-digit', 
    day: '2-digit', 
    year: 'numeric' 
  });
}
