import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface CSVFormatGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CSVFormatGuide({ open, onOpenChange }: CSVFormatGuideProps) {
  const formats = {
    children: {
      title: "Children Roster",
      columns: "first_name, last_name, person_id, age, grade, gender, guardian_phone, guardian_email, medical_notes, allergies, emergency_contact, status, season",
      example: "John, Doe, P12345, 10, 5, Male, 555-1234, parent@email.com, None, Peanuts, Jane Doe 555-5678, active, Summer 2024",
      notes: "REQUIRED: first_name, last_name, and person_id. The person_id is essential for matching records and must be unique for each child."
    },
    staff: {
      title: "Staff Directory",
      columns: "first_name, last_name, person_id, email, phone, role, department, hire_date, status, season",
      example: "Jane, Smith, S98765, jane@camp.com, 555-9876, Counselor, Activities, 2024-01-15, active, Summer 2024",
      notes: "REQUIRED: first_name (or name), last_name, person_id, and role. The person_id must match CampMinder Person ID for proper syncing."
    },
    medication_logs: {
      title: "Medication Logs",
      columns: "person_id, medication_name, dosage, scheduled_time, date, notes, is_recurring, frequency, days_of_week, end_date",
      example: "P12345, Tylenol, 5ml, 08:00, 2024-01-15, Take with food, false, daily, , ",
      notes: "REQUIRED: person_id, medication_name, scheduled_time, date. The person_id must match the child's Person ID in the roster."
    },
    trips: {
      title: "Transportation/Trips",
      columns: "name, type, date, destination, departure_time, return_time, capacity, driver, chaperone, transportation_type, event_type, event_length, meal, status",
      example: "Zoo Trip, Field Trip, 2024-06-15, City Zoo, 09:00, 15:00, 30, John Driver, Jane Chaperone, Bus, Educational, Half Day, Packed Lunch, confirmed",
      notes: "REQUIRED: name, type, date. Other fields are optional."
    },
    menu_items: {
      title: "Menu Items",
      columns: "date, meal_type, items, allergens",
      example: "2024-06-15, lunch, Chicken Nuggets; Fries; Apple Slices, Contains: Wheat; Soy",
      notes: "REQUIRED: date, meal_type, items. meal_type must be: breakfast, lunch, snack, or dinner."
    },
    awards: {
      title: "Awards",
      columns: "person_id, title, category, date, description",
      example: "P12345, Best Sportsmanship, Sports, 2024-06-15, Showed excellent teamwork during soccer",
      notes: "REQUIRED: person_id, title, date. The person_id must match the child's Person ID in the roster."
    },
    daily_notes: {
      title: "Daily Notes",
      columns: "person_id, date, mood, activities, meals, nap, notes",
      example: "P12345, 2024-06-15, Happy, Arts and crafts; Swimming, Ate well, 1 hour, Great day overall",
      notes: "REQUIRED: person_id, date. The person_id must match the child's Person ID in the roster."
    },
    incident_reports: {
      title: "Incident Reports",
      columns: "person_id, date, type, severity, description, reported_by, reporter_person_id, status",
      example: "P12345, 2024-06-15, Minor Injury, Low, Scraped knee on playground, Jane Smith, S98765, resolved",
      notes: "REQUIRED: person_id, date, type, description. For multiple children, use comma-separated person_ids."
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
      notes: "REQUIRED: event_date, title, type."
    },
    sports_calendar: {
      title: "Sports Calendar",
      columns: "event_date, title, sport_type, description, time, location, team, opponent",
      example: "2024-06-25, Championship Game, Basketball, Final game of season, 14:00, Main Court, Eagles, Hawks",
      notes: "REQUIRED: event_date, title, sport_type."
    },
    daily_wolf_content: {
      title: "Daily Wolf Content",
      columns: "date, officer_of_day, quote_of_the_day, laundry_info, phone_calls_info, notes",
      example: "2024-06-15, John Smith, Believe in yourself!, Laundry at 2pm for Bunk 5, Phone calls 6-7pm, Color War starts tomorrow!",
      notes: "REQUIRED: date. All other fields are optional text fields."
    },
    activities_field_trips: {
      title: "Activities & Field Trips",
      columns: "title, activity_type, event_date, time, location, description, capacity, chaperone, home_away, depart_from_camp, depart_from_activity",
      example: "Zoo Trip, Field Trip, 2024-06-15, 09:00, City Zoo, Educational trip, 30, Jane Smith, Away, 08:30, 14:00",
      notes: "REQUIRED: title, activity_type, event_date. activity_type examples: Field Trip, On-Campus, Special Event."
    },
    sports_academy: {
      title: "Sports Academy",
      columns: "person_id, sport, session, enrollment_date, status, notes",
      example: "P12345, Basketball, Session 1, 2024-06-01, active, Advanced level",
      notes: "REQUIRED: person_id, sport. The person_id must match the child's Person ID in the roster."
    },
    tutoring_therapy: {
      title: "Tutoring & Therapy",
      columns: "person_id, service_type, provider_name, schedule_day, schedule_time, duration_minutes, notes, status",
      example: "P12345, Tutoring, Dr. Smith, Monday, 10:00, 60, Math tutoring, active",
      notes: "REQUIRED: person_id, service_type. The person_id must match the child's Person ID in the roster."
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV Upload Format Guide
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="children" className="w-full">
          <TabsList className="grid grid-cols-4 h-auto">
            <TabsTrigger value="children" className="text-xs">Children</TabsTrigger>
            <TabsTrigger value="staff" className="text-xs">Staff</TabsTrigger>
            <TabsTrigger value="medication_logs" className="text-xs">Medications</TabsTrigger>
            <TabsTrigger value="trips" className="text-xs">Trips</TabsTrigger>
          </TabsList>
          <TabsList className="grid grid-cols-4 h-auto mt-2">
            <TabsTrigger value="menu_items" className="text-xs">Menu</TabsTrigger>
            <TabsTrigger value="awards" className="text-xs">Awards</TabsTrigger>
            <TabsTrigger value="daily_notes" className="text-xs">Daily Notes</TabsTrigger>
            <TabsTrigger value="incident_reports" className="text-xs">Incidents</TabsTrigger>
          </TabsList>
          <TabsList className="grid grid-cols-4 h-auto mt-2">
            <TabsTrigger value="bunk_staff" className="text-xs">Bunk Staff</TabsTrigger>
            <TabsTrigger value="master_calendar" className="text-xs">Calendar</TabsTrigger>
            <TabsTrigger value="sports_calendar" className="text-xs">Sports</TabsTrigger>
            <TabsTrigger value="daily_wolf_content" className="text-xs">Daily Wolf</TabsTrigger>
          </TabsList>
          <TabsList className="grid grid-cols-3 h-auto mt-2">
            <TabsTrigger value="activities_field_trips" className="text-xs">Activities</TabsTrigger>
            <TabsTrigger value="sports_academy" className="text-xs">Sports Academy</TabsTrigger>
            <TabsTrigger value="tutoring_therapy" className="text-xs">Tutoring</TabsTrigger>
          </TabsList>

          {Object.entries(formats).map(([key, format]) => (
            <TabsContent key={key} value={key} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{format.title}</CardTitle>
                  <CardDescription>CSV format for {format.title.toLowerCase()} upload</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Required Columns (first row):</h4>
                    <code className="block p-3 bg-muted rounded text-xs overflow-x-auto whitespace-nowrap">
                      {format.columns}
                    </code>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Example Data Row:</h4>
                    <code className="block p-3 bg-muted rounded text-xs overflow-x-auto whitespace-nowrap">
                      {format.example}
                    </code>
                  </div>

                  {format.notes && (
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded">
                      <p className="text-sm"><strong>Important Notes:</strong> {format.notes}</p>
                    </div>
                  )}

                  <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded">
                    <p className="text-sm"><strong>General Tips:</strong></p>
                    <ul className="text-xs mt-2 space-y-1 list-disc list-inside">
                      <li><strong>Person ID is required</strong> for all records that reference people (children, staff)</li>
                      <li>First row must contain column names exactly as shown</li>
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