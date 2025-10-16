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
      columns: "first_name, last_name, person_id, age, grade, gender, guardian_phone, guardian_email, medical_notes, allergies, division_id, leader_id, emergency_contact, status, season",
      example: "John, Doe, P12345, 10, 5, Male, 555-1234, parent@email.com, None, Peanuts, <division_id>, <leader_id>, Jane Doe 555-5678, active, Summer 2024",
      notes: "REQUIRED: first_name, last_name, and person_id. All other fields are optional. division_id and leader_id must be valid UUIDs from divisions and staff tables if provided"
    },
    staff: {
      title: "Staff Directory",
      columns: "name, email, phone, role, department, hire_date, leader_id, status, season",
      example: "Jane Smith, jane@camp.com, 555-9876, Counselor, Activities, 2024-01-15, <leader_id>, active, Summer 2024",
      notes: "leader_id must be a valid UUID from staff table. hire_date format: YYYY-MM-DD"
    },
    medication_logs: {
      title: "Medication Logs",
      columns: "child_id, medication_name, dosage, meal_time, date, notes, is_recurring, frequency, days_of_week, end_date",
      example: "<child_id>, Tylenol, 5ml, Before Breakfast, 2024-01-15, Take with food, false, daily, , ",
      notes: "child_id must be valid UUID. meal_time options: Before Breakfast, After Breakfast, Before Lunch, After Lunch, Before Dinner, After Dinner, Bedtime. date format: YYYY-MM-DD"
    },
    trips: {
      title: "Transportation/Trips",
      columns: "name, type, date, destination, departure_time, return_time, capacity, driver, chaperone, transportation_type, event_type, event_length, meal, status",
      example: "Zoo Trip, Field Trip, 2024-06-15, City Zoo, 09:00, 15:00, 30, John Driver, Jane Chaperone, Bus, Educational, Half Day, Packed Lunch, confirmed",
      notes: "date format: YYYY-MM-DD. type options: Field Trip, Sports Event, Other"
    },
    menu_items: {
      title: "Menu Items",
      columns: "date, meal_type, items, allergens",
      example: "2024-06-15, Lunch, Chicken Nuggets\\, Fries\\, Apple Slices, Contains: Wheat\\, Soy",
      notes: "date format: YYYY-MM-DD. meal_type options: Breakfast, Lunch, Snack, Dinner. Use backslash before commas within items/allergens"
    },
    awards: {
      title: "Awards",
      columns: "child_id, title, category, date, description",
      example: "<child_id>, Best Sportsmanship, Sports, 2024-06-15, Showed excellent teamwork during soccer",
      notes: "child_id must be valid UUID. date format: YYYY-MM-DD"
    },
    daily_notes: {
      title: "Daily Notes",
      columns: "child_id, date, mood, activities, meals, nap, notes, created_by",
      example: "<child_id>, 2024-06-15, Happy, Arts and crafts\\, Swimming, Ate well, 1 hour, Great day overall, <staff_id>",
      notes: "child_id and created_by must be valid UUIDs. date format: YYYY-MM-DD. Use backslash before commas within text fields"
    },
    incident_reports: {
      title: "Incident Reports",
      columns: "child_id, date, type, severity, description, reported_by, status",
      example: "<child_id>, 2024-06-15, Minor Injury, Low, Scraped knee on playground, Jane Smith, resolved",
      notes: "child_id must be valid UUID. date format: YYYY-MM-DD. type options: Injury, Illness, Behavioral, Other"
    },
    master_calendar: {
      title: "Master Calendar",
      columns: "event_date, title, type, description, time, location, division_id, created_by",
      example: "2024-06-20, Swimming Day, Activity, Pool day for all divisions, 10:00, Main Pool, <division_id>, <staff_id>",
      notes: "event_date format: YYYY-MM-DD. division_id and created_by must be valid UUIDs or leave empty"
    },
    sports_calendar: {
      title: "Sports Calendar",
      columns: "event_date, title, sport_type, description, time, location, team, opponent, division_id, created_by",
      example: "2024-06-25, Championship Game, Basketball, Final game of season, 14:00, Main Court, Eagles, Hawks, <division_id>, <staff_id>",
      notes: "event_date format: YYYY-MM-DD. sport_type options: Baseball, Basketball, Dance, Football, Golf, Gymnastics, Hockey, Lacrosse, Soccer, Softball, Tennis, Volleyball, Waterfront. division_id and created_by can be empty"
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
          <TabsList className="grid grid-cols-5 h-auto">
            <TabsTrigger value="children" className="text-xs">Children</TabsTrigger>
            <TabsTrigger value="staff" className="text-xs">Staff</TabsTrigger>
            <TabsTrigger value="medication_logs" className="text-xs">Medications</TabsTrigger>
            <TabsTrigger value="trips" className="text-xs">Trips</TabsTrigger>
            <TabsTrigger value="menu_items" className="text-xs">Menu</TabsTrigger>
          </TabsList>
          <TabsList className="grid grid-cols-5 h-auto mt-2">
            <TabsTrigger value="awards" className="text-xs">Awards</TabsTrigger>
            <TabsTrigger value="daily_notes" className="text-xs">Daily Notes</TabsTrigger>
            <TabsTrigger value="incident_reports" className="text-xs">Incidents</TabsTrigger>
            <TabsTrigger value="master_calendar" className="text-xs">Calendar</TabsTrigger>
            <TabsTrigger value="sports_calendar" className="text-xs">Sports</TabsTrigger>
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
                      <li>First row must contain column names exactly as shown</li>
                      <li>Use commas to separate values</li>
                      <li>Use backslash before commas within text fields (e.g., "Item 1\, Item 2")</li>
                      <li>Leave fields empty for optional columns</li>
                      <li>Maximum 1000 rows per upload</li>
                      <li>Dates must be in YYYY-MM-DD format</li>
                      <li>UUIDs can be obtained from the backend for existing records</li>
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