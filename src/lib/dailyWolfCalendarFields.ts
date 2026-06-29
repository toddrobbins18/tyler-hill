export type DailyContentCalendarField = {
  field: string;
  label: string;
  colorKey: string;
};

/** Timber Lake Camp — Tiger Times categories on Master Calendar. */
export const TIGER_TIMES_CALENDAR_FIELDS: DailyContentCalendarField[] = [
  { field: "laundry_info", label: "Laundry", colorKey: "TT: Laundry" },
  { field: "phone_calls_info", label: "Phone Calls", colorKey: "TT: Phone Calls" },
  { field: "outside_event", label: "Movie / Entertainment", colorKey: "TT: Movie / Entertainment" },
  { field: "staff_days_off", label: "Staff Days Off", colorKey: "TT: Staff Days Off" },
  { field: "od_notes", label: "OD Notes", colorKey: "TT: OD Notes" },
];

/** Timber Lake West — Daily Wolf fields on Master Calendar. */
export const DAILY_WOLF_WEST_CALENDAR_FIELDS: DailyContentCalendarField[] = [
  { field: "officer_of_day", label: "Super OD", colorKey: "DW: Super OD" },
  { field: "quote_of_the_day", label: "Quote of the Day", colorKey: "DW: Quote" },
  { field: "laundry_info", label: "Laundry", colorKey: "DW: Laundry" },
  { field: "phone_calls_info", label: "Phone Calls", colorKey: "DW: Phone Calls" },
  { field: "notes", label: "Daily Notes", colorKey: "DW: Notes" },
];

export function dailyContentFieldValue(entry: Record<string, unknown>, field: string): string {
  const raw = entry[field];
  return typeof raw === "string" ? raw.trim() : "";
}
