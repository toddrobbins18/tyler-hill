import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CSVFormatGuide from "./dialogs/CSVFormatGuide";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { 
  childSchema, staffSchema, awardSchema, dailyNoteSchema, tripSchema, menuItemSchema,
  incidentReportSchema, medicationSchema, calendarEventSchema, sportsCalendarSchema, dailyWolfContentSchema,
  parseChildRow, parseStaffRow, parseAwardRow, parseDailyNoteRow, parseTripRow, parseMenuItemRow,
  parseIncidentReportRow, parseMedicationRow, parseCalendarEventRow, parseSportsCalendarRow, parseDailyWolfContentRow
} from "@/lib/validationSchemas";
import { z } from "zod";
import { parseCsvDocument } from "@/lib/csvLine";

interface CSVUploaderProps {
  tableName: string;
  onUploadComplete?: () => void;
}

// Tables that require person_id resolution to child UUIDs
const CHILD_PERSON_ID_TABLES = ['awards', 'daily_notes', 'incident_reports', 'medication_logs'];
// Tables that require person_id resolution to staff UUIDs
const STAFF_PERSON_ID_TABLES = ['staff'];

export default function CSVUploader({ tableName, onUploadComplete }: CSVUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();

  /** Match roster row for selected season (unique per company+person_id+season). */
  const resolveChildPersonIds = async (
    personIds: string[],
    season: string,
  ): Promise<Map<string, string>> => {
    if (!currentCompany?.id || personIds.length === 0) return new Map();

    const { data } = await supabase
      .from("children")
      .select("id, person_id")
      .eq("company_id", currentCompany.id)
      .eq("season", season)
      .neq("status", "inactive")
      .in("person_id", personIds);

    const mapping = new Map<string, string>();
    (data || []).forEach((child) => {
      if (child.person_id != null && child.person_id !== "") {
        mapping.set(String(child.person_id).trim(), child.id);
      }
    });
    return mapping;
  };

  // Resolve person_id to staff UUID (for staff table, this is for updating existing records)
  const resolveStaffPersonIds = async (personIds: string[]): Promise<Map<string, string>> => {
    if (!currentCompany?.id || personIds.length === 0) return new Map();
    
    const { data } = await supabase
      .from('staff')
      .select('id, person_id')
      .eq('company_id', currentCompany.id)
      .in('person_id', personIds);
    
    const mapping = new Map<string, string>();
    (data || []).forEach(staff => {
      if (staff.person_id) mapping.set(staff.person_id, staff.id);
    });
    return mapping;
  };

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
      const records = parseCsvDocument(text);

      if (records.length === 0) {
        toast.error("CSV file is empty");
        setUploading(false);
        return;
      }

      // Limit logical rows (header + data) to prevent DoS
      if (records.length > 1001) {
        toast.error("CSV file too large. Maximum 1000 data rows allowed.");
        setUploading(false);
        return;
      }

      const headers = records[0].map((h) => h.replace(/^"|"$/g, "").trim());
      const rawRows = records.slice(1).map((values) => {
        const obj: Record<string, any> = {};
        headers.forEach((header, index) => {
          const v = values[index];
          obj[header] = v != null && String(v).length > 0 ? String(v).trim() : null;
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
      } else if (tableName === 'daily_wolf_content') {
        schema = dailyWolfContentSchema;
        parser = parseDailyWolfContentRow;
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
          if (tableName === "medication_logs") {
            const pid = String(parsed.person_id ?? "").trim();
            const med = String(parsed.medication_name ?? "").trim();
            const dose = String(parsed.dosage ?? "").trim();
            if (!pid && !med && !dose) continue;
          }
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

      if (validatedRows.length === 0) {
        toast.error("No data rows to import. Add rows with the required columns (for medications: person_id, medication_name, dosage).");
        setUploading(false);
        event.target.value = "";
        return;
      }

      // --- CHILDREN: Upsert by person_id + detect dropped campers ---
      if (tableName === 'children') {
        const csvPersonIds = new Set(validatedRows.map(r => r.person_id).filter(Boolean));

        // Fetch all existing active children for this company + season
        const { data: existingChildren } = await supabase
          .from('children')
          .select('id, name, person_id, status')
          .eq('company_id', currentCompany?.id)
          .eq('season', selectedSeason)
          .neq('status', 'inactive');

        const existingMap = new Map<string, { id: string; name: string; person_id: string }>();
        (existingChildren || []).forEach(child => {
          if (child.person_id) existingMap.set(child.person_id, child);
        });

        // Split into updates and inserts
        const toUpdate: any[] = [];
        const toInsert: any[] = [];

        for (const row of validatedRows) {
          const rowData: any = {
            ...row,
            company_id: currentCompany?.id,
            season: selectedSeason,
            status: 'active',
          };

          if (row.person_id && existingMap.has(row.person_id)) {
            // Update existing
            toUpdate.push({ existingId: existingMap.get(row.person_id)!.id, data: rowData });
          } else {
            // New camper
            toInsert.push(rowData);
          }
        }

        // Perform inserts
        if (toInsert.length > 0) {
          const { error: insertError } = await supabase.from('children').insert(toInsert as any);
          if (insertError) throw insertError;
        }

        // Perform updates
        let updateErrors = 0;
        for (const item of toUpdate) {
          const { existingId, data } = item;
          delete data.person_id; // Don't overwrite person_id
          const { error: updateError } = await supabase
            .from('children')
            .update(data as any)
            .eq('id', existingId);
          if (updateError) updateErrors++;
        }

        // Auto-mark dropped campers as inactive (like staff sync)
        const dropped = (existingChildren || []).filter(
          child => child.person_id && !csvPersonIds.has(child.person_id) && child.status !== 'inactive'
        );

        if (dropped.length > 0) {
          const droppedIds = dropped.map(c => c.id);
          const { error: dropError } = await supabase
            .from('children')
            .update({ status: 'inactive' } as any)
            .in('id', droppedIds);
          
          if (dropError) {
            console.error('Error marking dropped campers:', dropError);
          }
        }

        const summary = [];
        if (toInsert.length > 0) summary.push(`${toInsert.length} added`);
        if (toUpdate.length > 0) summary.push(`${toUpdate.length} updated`);
        if (dropped.length > 0) summary.push(`${dropped.length} dropped`);
        if (updateErrors > 0) summary.push(`${updateErrors} update errors`);
        toast.success(`Camper sync complete: ${summary.join(', ')}`);

        onUploadComplete?.();
        setUploading(false);
        event.target.value = '';
        return;
      }

      // Resolve person_ids to UUIDs for tables that need it
      let childPersonIdMap = new Map<string, string>();
      let staffPersonIdMap = new Map<string, string>();

      if (CHILD_PERSON_ID_TABLES.includes(tableName)) {
        // Extract all person_ids from validated rows
        const personIds = new Set<string>();
        validatedRows.forEach((row) => {
          if (row.person_id) personIds.add(String(row.person_id).trim());
          if (row.person_ids)
            row.person_ids.forEach((id: string) => personIds.add(String(id).trim()));
        });
        childPersonIdMap = await resolveChildPersonIds(
          Array.from(personIds).filter(Boolean),
          selectedSeason,
        );

        // Validate all person_ids were found
        const missingIds: string[] = [];
        validatedRows.forEach((row, i) => {
          const pid =
            typeof row.person_id === "string" ? row.person_id.trim() : String(row.person_id ?? "").trim();
          if (pid && !childPersonIdMap.has(pid)) {
            missingIds.push(`Row ${i + 2}: Person ID "${pid}" not found`);
          }
          if (row.person_ids) {
            row.person_ids.forEach((id: string) => {
              const pid = String(id).trim();
              if (pid && !childPersonIdMap.has(pid)) {
                missingIds.push(`Row ${i + 2}: Person ID "${pid}" not found`);
              }
            });
          }
        });
        
        if (missingIds.length > 0) {
          const hint =
            "\n\nEach Person ID must match an active camper in your roster for the selected season " +
            `(${selectedSeason}) in Settings. Sync/import the roster first, fix any wrong IDs in the spreadsheet, ` +
            "or pick the season those campers belong to.";
          toast.error(
            `Person ID errors:\n${missingIds.slice(0, 5).join("\n")}${missingIds.length > 5 ? `\n...and ${missingIds.length - 5} more` : ""}${hint}`,
          );
          setUploading(false);
          return;
        }
      }

      // Add company_id and resolve person_ids to UUIDs
      const rowsWithCompany = validatedRows.map(row => {
        const baseRow: any = {
          ...row,
          company_id: currentCompany?.id,
          season: selectedSeason,
        };

        // Resolve person_id to child_id for child-related tables
        if (CHILD_PERSON_ID_TABLES.includes(tableName)) {
          if (row.person_id) {
            const pid = String(row.person_id).trim();
            baseRow.child_id = childPersonIdMap.get(pid);
            delete baseRow.person_id;
          }
          if (row.person_ids) {
            baseRow.child_ids = row.person_ids
              .map((id: string) => childPersonIdMap.get(String(id).trim()))
              .filter(Boolean);
            delete baseRow.person_ids;
          }
          if (row.reporter_person_id && staffPersonIdMap.has(row.reporter_person_id)) {
            baseRow.reporter_id = staffPersonIdMap.get(row.reporter_person_id);
            delete baseRow.reporter_person_id;
          }
        }
        
        return baseRow;
      });

      const { error } = await supabase.from(tableName as any).insert(rowsWithCompany as any);

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
