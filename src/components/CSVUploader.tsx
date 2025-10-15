import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CSVFormatGuide from "./dialogs/CSVFormatGuide";
import { 
  childSchema, staffSchema, awardSchema, dailyNoteSchema, tripSchema, menuItemSchema,
  incidentReportSchema, medicationSchema, calendarEventSchema, sportsCalendarSchema,
  parseChildRow, parseStaffRow, parseAwardRow, parseDailyNoteRow, parseTripRow, parseMenuItemRow,
  parseIncidentReportRow, parseMedicationRow, parseCalendarEventRow, parseSportsCalendarRow
} from "@/lib/validationSchemas";
import { z } from "zod";

interface CSVUploaderProps {
  tableName: string;
  onUploadComplete?: () => void;
}

export default function CSVUploader({ tableName, onUploadComplete }: CSVUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }

    setUploading(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        toast.error("CSV file is empty");
        setUploading(false);
        return;
      }

      // Limit CSV to 1000 rows to prevent DoS
      if (lines.length > 1001) {
        toast.error("CSV file too large. Maximum 1000 rows allowed.");
        setUploading(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const rawRows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj: Record<string, any> = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] || null;
        });
        return obj;
      });

      // Select appropriate schema and parser based on table
      let schema;
      let parser;
      
      if (tableName === 'children') {
        schema = childSchema;
        parser = parseChildRow;
      } else if (tableName === 'staff') {
        schema = staffSchema;
        parser = parseStaffRow;
      } else if (tableName === 'awards') {
        schema = awardSchema;
        parser = parseAwardRow;
      } else if (tableName === 'daily_notes') {
        schema = dailyNoteSchema;
        parser = parseDailyNoteRow;
      } else if (tableName === 'trips') {
        schema = tripSchema;
        parser = parseTripRow;
      } else if (tableName === 'menu_items') {
        schema = menuItemSchema;
        parser = parseMenuItemRow;
      } else if (tableName === 'incident_reports') {
        schema = incidentReportSchema;
        parser = parseIncidentReportRow;
      } else if (tableName === 'medication_logs') {
        schema = medicationSchema;
        parser = parseMedicationRow;
      } else if (tableName === 'master_calendar') {
        schema = calendarEventSchema;
        parser = parseCalendarEventRow;
      } else if (tableName === 'sports_calendar') {
        schema = sportsCalendarSchema;
        parser = parseSportsCalendarRow;
      } else {
        toast.error(`Unsupported table: ${tableName}`);
        setUploading(false);
        return;
      }

      // Validate and parse each row
      const validatedRows: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < rawRows.length; i++) {
        try {
          const parsed = parser(rawRows[i]);
          const validated = schema.parse(parsed);
          validatedRows.push(validated);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(`Row ${i + 2}: ${error.errors.map(e => e.message).join(", ")}`);
          } else {
            errors.push(`Row ${i + 2}: Invalid data format`);
          }
        }
      }

      if (errors.length > 0) {
        toast.error(`Validation failed:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n...and ${errors.length - 5} more errors` : ""}`);
        setUploading(false);
        return;
      }

      const { error } = await supabase.from(tableName as any).insert(validatedRows as any);

      if (error) throw error;

      toast.success(`Successfully uploaded ${validatedRows.length} records`);
      onUploadComplete?.();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to upload CSV. Please check the format and try again.");
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
          id={`csv-upload-${tableName}`}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowGuide(true)}
          title="View CSV Format Guide"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => document.getElementById(`csv-upload-${tableName}`)?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload CSV"}
        </Button>
      </div>
      <CSVFormatGuide open={showGuide} onOpenChange={setShowGuide} />
    </>
  );
}

export { CSVUploader };
