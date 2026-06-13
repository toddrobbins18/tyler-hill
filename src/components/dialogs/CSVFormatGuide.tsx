import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";

interface CSVFormatGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormatDef {
  title: string;
  /** Names that must appear as column headers — required data for every row varies by schema; see notes. */
  columns: string;
  /** Extra header columns users may append (shown on a separate line when set). */
  optionalColumns?: string;
  example: string;
  notes: string;
  /** If set, only show for these company slugs */
  onlySlugs?: string[];
  /** If set, hide for these company slugs */
  excludeSlugs?: string[];
}

const ALL_FORMATS: Record<string, FormatDef> = {
  children: {
    title: "Children Roster",
    columns: "first_name, last_name, person_id",
    example: "John, Doe, P12345",
    notes: "Only these three columns are required."
  },
  staff: {
    title: "Staff Directory",
    columns: "first_name, last_name, person_id",
    example: "Jane, Smith, S98765",
    notes: "Only these three columns are required."
  },
  medication_logs: {
    title: "Medication Logs",
    columns: "person_id, medication_name (required). dosage optional.",
    optionalColumns:
      "SCHEDULED TIME / Meal Time, START DATE / date, END DATE, NOTES, RECURRING (YES/NO), FREQUENCY, days_of_week. CampMinder Excel columns (CHILD NAME, LAST NAME, DIVISION, DOB) are ignored — camper is matched by person_id. Upload .csv or .xlsx.",
    example: "15956699, Supplements, 1 package, BEFORE BREAKFAST, Give with food, YES, DAILY, (start), (end)",
    notes:
      "REQUIRED: person_id + medication_name on each row (must match a camper in your roster for the selected season). All other columns are optional — missing dosage, dates, or meal time is fine. Excel date serials (e.g. 46198) are converted automatically. Defaults: start = Jun 26 (or today after camp opens), end = Aug 12 for daily recurring meds.",
  },
  trips: {
    title: "Transportation/Trips",
    columns: "name, type, date, destination, departure_time, return_time, capacity, driver, chaperone, transportation_type, event_type, event_length, meal, status",
    example: "Zoo Trip, Field Trip, 2024-06-15, City Zoo, 09:00, 15:00, 30, John Driver, Jane Chaperone, Bus, Educational, Half Day, Packed Lunch, confirmed",
    notes: "REQUIRED: name. Type defaults to 'Trip' if not provided. All other fields are optional."
  },
  menu_items: {
    title: "Menu Items",
    columns: "date, meal_type, items, allergens",
    example: "2024-06-15, lunch, Chicken Nuggets; Fries; Apple Slices, Contains: Wheat; Soy",
    notes: "REQUIRED: date, meal_type, items. meal_type must be: breakfast, lunch, snack, dinner, or special_meal. special_meal division tags are added in the app UI, not CSV.",
  },
  awards: {
    title: "Awards",
    columns: "person_id, title, category, date, description",
    example: "P12345, Best Sportsmanship, Sports, 2024-06-15, Showed excellent teamwork during soccer",
    notes: "REQUIRED: title. person_id and date are recommended for matching. All other fields are optional."
  },
  daily_notes: {
    title: "Daily Notes",
    columns: "person_id, date, mood, activities, meals, nap, notes",
    example: "P12345, 2024-06-15, Happy, Arts and crafts; Swimming, Ate well, 1 hour, Great day overall",
    notes: "All fields are optional. person_id and date are recommended for proper record matching.",
    excludeSlugs: ["timber-lake-camp", "timber-lake-west"],
  },
  incident_reports: {
    title: "Incident Reports",
    columns: "person_id, date, type, severity, description, reported_by, reporter_person_id, status",
    example: "P12345, 2024-06-15, Minor Injury, Low, Scraped knee on playground, Jane Smith, S98765, resolved",
    notes: "All fields are optional. person_id, date, type, and description are recommended. For multiple children, use comma-separated person_ids."
  },
  bunk_staff: {
    title: "Bunk Staff Assignments",
    columns: "person_id, bunk_number, bunk_name, is_primary",
    example: "S98765, 12, Cabin A, true",
    notes: "REQUIRED: person_id, bunk_number. The person_id must match the staff member's Person ID."
  },
  master_calendar: {
    title: "Master Calendar",
    columns: "event_date, title, type, description, time, location",
    example: "2024-06-20, Swimming Day, Activity, Pool day for all divisions, 10:00, Main Pool",
    notes: "REQUIRED: title. event_date and type are recommended. All other fields are optional."
  },
  sports_calendar: {
    title: "Sports Calendar",
    columns: "event_date, title, sport_type, description, time, location, team, opponent",
    example: "2024-06-25, Championship Game, Basketball, Final game of season, 14:00, Main Court, Eagles, Hawks",
    notes: "REQUIRED: title. event_date and sport_type are recommended. All other fields are optional."
  },
  daily_wolf_content: {
    title: "Daily Wolf Content",
    columns: "date, officer_of_day, quote_of_the_day, laundry_info, phone_calls_info, notes",
    example: "2024-06-15, John Smith, Believe in yourself!, Laundry at 2pm for Bunk 5, Phone calls 6-7pm, Color War starts tomorrow!",
    notes: "REQUIRED: date. All other fields are optional text fields.",
    onlySlugs: ["timber-lake-west"],
  },
  activities_field_trips: {
    title: "Activities & Field Trips",
    columns: "title, activity_type, event_date, time, location, description, capacity, chaperone, home_away, depart_from_camp, depart_from_activity",
    example: "Zoo Trip, Field Trip, 2024-06-15, 09:00, City Zoo, Educational trip, 30, Jane Smith, Away, 08:30, 14:00",
    notes: "REQUIRED: title. activity_type and event_date are recommended. All other fields are optional."
  },
  sports_academy: {
    title: "Sports Academy",
    columns: "person_id, sport, session, enrollment_date, status, notes",
    example: "P12345, Basketball, Session 1, 2024-06-01, active, Advanced level",
    notes: "All fields are optional. person_id and sport are recommended for proper matching."
  },
  tutoring_therapy: {
    title: "Tutoring & Therapy",
    columns: "person_id, service_type, provider_name, schedule_day, schedule_time, duration_minutes, notes, status",
    example: "P12345, Tutoring, Dr. Smith, Monday, 10:00, 60, Math tutoring, active",
    notes: "All fields are optional. person_id and service_type are recommended for proper matching."
  },
  special_events_activities: {
    title: "Special Events & Activities",
    columns: "title, event_type, event_date, time_slot, start_time, end_time, location, description, chaperone",
    example: "Color War, Special Event, 2024-06-20, Morning, 09:00, 12:00, Main Field, Annual color war event, Jane Smith",
    notes: "REQUIRED: title. event_type, event_date, and time_slot are recommended. All other fields are optional."
  },
};

// Tab display labels
const TAB_LABELS: Record<string, string> = {
  children: "Children",
  staff: "Staff",
  medication_logs: "Medications",
  trips: "Trips",
  menu_items: "Menu",
  awards: "Awards",
  daily_notes: "Daily Notes",
  incident_reports: "Incidents",
  bunk_staff: "Bunk Staff",
  master_calendar: "Calendar",
  sports_calendar: "Sports",
  daily_wolf_content: "Daily Wolf",
  activities_field_trips: "Activities",
  sports_academy: "Sports Academy",
  tutoring_therapy: "Tutoring",
  special_events_activities: "Special Events",
};

export default function CSVFormatGuide({ open, onOpenChange }: CSVFormatGuideProps) {
  const { currentCompany } = useCompany();
  const slug = currentCompany?.slug;

  const filteredFormats = useMemo(() => {
    return Object.entries(ALL_FORMATS).filter(([, def]) => {
      if (def.onlySlugs && slug && !def.onlySlugs.includes(slug)) return false;
      if (def.excludeSlugs && slug && def.excludeSlugs.includes(slug)) return false;
      return true;
    });
  }, [slug]);

  const defaultTab = filteredFormats.length > 0 ? filteredFormats[0][0] : "children";

  // Split into rows of 4
  const tabRows: [string, FormatDef][][] = [];
  for (let i = 0; i < filteredFormats.length; i += 4) {
    tabRows.push(filteredFormats.slice(i, i + 4));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV Upload Format Guide
          </DialogTitle>
          <DialogDescription>
            Column aliases and roster rules vary by sheet — choose a tab below.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue={defaultTab} className="w-full">
          {tabRows.map((row, rowIdx) => (
            <TabsList key={rowIdx} className={`grid h-auto ${rowIdx > 0 ? 'mt-2' : ''}`} style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
              {row.map(([key]) => (
                <TabsTrigger key={key} value={key} className="text-xs">
                  {TAB_LABELS[key] || key}
                </TabsTrigger>
              ))}
            </TabsList>
          ))}

          {filteredFormats.map(([key, format]) => (
            <TabsContent key={key} value={key} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{format.title}</CardTitle>
                  <CardDescription>CSV format for {format.title.toLowerCase()} upload</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">
                      {format.optionalColumns
                        ? "Required column headers (first row)"
                        : "Required columns (first row)"}
                    </h4>
                    <code className="block p-3 bg-muted rounded text-xs overflow-x-auto whitespace-nowrap">
                      {format.columns}
                    </code>
                  </div>

                  {format.optionalColumns && (
                    <div>
                      <h4 className="font-semibold mb-2">Optional column headers — include only what you need</h4>
                      <code className="block p-3 bg-muted rounded text-xs overflow-x-auto whitespace-nowrap">
                        {format.optionalColumns}
                      </code>
                      <p className="text-xs text-muted-foreground mt-2">
                        Use a single header row: required columns first (left to right), then any optional columns.
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="font-semibold mb-2">Example Data Row:</h4>
                    <code className="block p-3 bg-muted rounded text-xs overflow-x-auto whitespace-nowrap">
                      {format.example}
                    </code>
                  </div>

                  {format.notes && (
                    <div className="bg-muted/60 border border-border p-3 rounded">
                      <p className="text-sm"><strong>Important Notes:</strong> {format.notes}</p>
                    </div>
                  )}

                  <div className="bg-muted/40 border border-border p-3 rounded">
                    <p className="text-sm"><strong>General Tips:</strong></p>
                    <ul className="text-xs mt-2 space-y-1 list-disc list-inside">
                      <li>Required vs optional columns <strong>differ by tab</strong> — use <strong>Important Notes</strong> above.</li>
                      <li>Templates that tie a row to a camper or staff member need a roster-matching identifier when that format requires it.</li>
                      <li>
                        First row = headers. For Medications, spreadsheet titles like{" "}
                        <code className="text-xs">Person ID</code>, <code className="text-xs">Medication Name</code>,{" "}
                        <code className="text-xs">Dosage</code> work the same as the snake_case names.
                      </li>
                      <li>Use commas to separate values</li>
                      <li>Use semicolons within text fields to separate multiple items</li>
                      <li>Leave fields empty for optional columns</li>
                      <li>Maximum 1000 rows per upload</li>
                      <li>Dates must be in YYYY-MM-DD format</li>
                      <li>Person IDs should match CampMinder or your roster system</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
