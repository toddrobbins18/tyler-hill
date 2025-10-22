import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import JSONFormatGuide from "./dialogs/JSONFormatGuide";
import { 
  childSchema, staffSchema, awardSchema, dailyNoteSchema, tripSchema, menuItemSchema,
  incidentReportSchema, medicationSchema, calendarEventSchema, sportsCalendarSchema
} from "@/lib/validationSchemas";
import { z } from "zod";

interface JSONUploaderProps {
  tableName: string;
  onUploadComplete?: () => void;
}

export default function JSONUploader({ tableName, onUploadComplete }: JSONUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error("Please upload a JSON file");
      return;
    }

    setUploading(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        toast.error("JSON file must contain an array of objects");
        setUploading(false);
        return;
      }

      if (data.length === 0) {
        toast.error("JSON file is empty");
        setUploading(false);
        return;
      }

      // Limit to 1000 records to prevent DoS
      if (data.length > 1000) {
        toast.error("JSON file too large. Maximum 1000 records allowed.");
        setUploading(false);
        return;
      }

      // Select appropriate schema based on table
      let schema;
      
      if (tableName === 'children') {
        schema = childSchema;
      } else if (tableName === 'staff') {
        schema = staffSchema;
      } else if (tableName === 'awards') {
        schema = awardSchema;
      } else if (tableName === 'daily_notes') {
        schema = dailyNoteSchema;
      } else if (tableName === 'trips') {
        schema = tripSchema;
      } else if (tableName === 'menu_items') {
        schema = menuItemSchema;
      } else if (tableName === 'incident_reports') {
        schema = incidentReportSchema;
      } else if (tableName === 'medication_logs') {
        schema = medicationSchema;
      } else if (tableName === 'master_calendar') {
        schema = calendarEventSchema;
      } else if (tableName === 'sports_calendar') {
        schema = sportsCalendarSchema;
      } else {
        toast.error(`Unsupported table: ${tableName}`);
        setUploading(false);
        return;
      }

      // Validate each record
      const validatedRows: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        try {
          const validated = schema.parse(data[i]);
          validatedRows.push(validated);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(`Record ${i + 1}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(", ")}`);
          } else {
            errors.push(`Record ${i + 1}: Invalid data format`);
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
      if (error instanceof SyntaxError) {
        toast.error("Invalid JSON format. Please check your file.");
      } else {
        console.error('Upload error:', error);
        toast.error("Failed to upload JSON. Please check the format and try again.");
      }
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
          accept=".json"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
          id={`json-upload-${tableName}`}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowGuide(true)}
          title="View JSON Format Guide"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => document.getElementById(`json-upload-${tableName}`)?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload JSON"}
        </Button>
      </div>
      <JSONFormatGuide open={showGuide} onOpenChange={setShowGuide} />
    </>
  );
}

export { JSONUploader };
