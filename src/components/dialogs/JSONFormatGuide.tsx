import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface JSONFormatGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function JSONFormatGuide({ open, onOpenChange }: JSONFormatGuideProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>JSON Upload Format Guide</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload data in JSON format. Your file should contain an array of objects, with each object representing one record.
            Maximum 1000 records per file.
          </p>

          <Tabs defaultValue="children" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="children">Children</TabsTrigger>
              <TabsTrigger value="staff">Staff</TabsTrigger>
              <TabsTrigger value="awards">Awards</TabsTrigger>
              <TabsTrigger value="notes">Daily Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="children" className="space-y-2">
              <h3 className="font-semibold">Children JSON Format</h3>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`[
  {
    "name": "John Doe",
    "age": 12,
    "grade": "6th",
    "gender": "Male",
    "guardian_phone": "555-0123",
    "guardian_email": "parent@example.com",
    "allergies": "Peanuts",
    "medical_notes": "Requires EpiPen",
    "emergency_contact": "Jane Doe - 555-0124",
    "group_name": "Eagles",
    "status": "active",
    "category": "Regular",
    "season": "2026",
    "person_id": "12345"
  }
]`}
              </pre>
              <p className="text-xs text-muted-foreground">
                <strong>Required:</strong> name<br/>
                <strong>Optional:</strong> age, grade, gender, guardian_phone, guardian_email, allergies, medical_notes, emergency_contact, group_name, status, category, season, person_id
              </p>
            </TabsContent>

            <TabsContent value="staff" className="space-y-2">
              <h3 className="font-semibold">Staff JSON Format</h3>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`[
  {
    "name": "Jane Smith",
    "role": "Counselor",
    "department": "Recreation",
    "email": "jane@example.com",
    "phone": "555-0125",
    "hire_date": "2024-01-15",
    "status": "active",
    "season": "2026"
  }
]`}
              </pre>
              <p className="text-xs text-muted-foreground">
                <strong>Required:</strong> name, role<br/>
                <strong>Optional:</strong> department, email, phone, hire_date, status, season
              </p>
            </TabsContent>

            <TabsContent value="awards" className="space-y-2">
              <h3 className="font-semibold">Awards JSON Format</h3>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`[
  {
    "title": "Best Camper",
    "description": "Awarded for outstanding behavior",
    "date": "2024-07-15",
    "category": "Behavior",
    "season": "2026"
  }
]`}
              </pre>
              <p className="text-xs text-muted-foreground">
                <strong>Required:</strong> title, date<br/>
                <strong>Optional:</strong> description, category, season
              </p>
            </TabsContent>

            <TabsContent value="notes" className="space-y-2">
              <h3 className="font-semibold">Daily Notes JSON Format</h3>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`[
  {
    "date": "2024-07-15",
    "activities": "Swimming, Arts & Crafts",
    "meals": "Ate well",
    "nap": "Slept for 1 hour",
    "mood": "Happy",
    "notes": "Great day overall",
    "season": "2026"
  }
]`}
              </pre>
              <p className="text-xs text-muted-foreground">
                <strong>Required:</strong> date<br/>
                <strong>Optional:</strong> activities, meals, nap, mood, notes, season
              </p>
            </TabsContent>
          </Tabs>

          <div className="space-y-2 text-sm">
            <h4 className="font-semibold">Benefits of JSON Format:</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Better support for arrays (meal_options, schedule_periods)</li>
              <li>No issues with commas in values</li>
              <li>More structured and readable</li>
              <li>Easier validation and error messages</li>
              <li>Native support for nested data</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
