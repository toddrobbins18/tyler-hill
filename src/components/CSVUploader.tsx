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

  // Resolve person_id to child UUID
  const resolveChildPersonIds = async (personIds: string[]): Promise<Map<string, string>> => {
    if (!currentCompany?.id || personIds.length === 0) return new Map();
    
    const { data } = await supabase
      .from('children')
      .select('id, person_id')
      .eq('company_id', currentCompany.id)
      .in('person_id', personIds);
    
    const mapping = new Map<string, string>();
    (data || []).forEach(child => {
      if (child.person_id) mapping.set(child.person_id, child.id);
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

  const markDroppedCampersInactive = async () => {
    if (droppedCampers.length === 0) return;
    
    const ids = droppedCampers.map(c => c.id);
    const { error } = await supabase
      .from('children')
      .update({ status: 'inactive' } as any)
      .in('id', ids);
    
    if (error) {
      console.error('Error marking dropped campers:', error);
      toast.error('Failed to mark dropped campers as inactive');
    } else {
      toast.success(`${droppedCampers.length} dropped camper(s) marked as inactive`);
    }
    setDroppedCampers([]);
    setShowDroppedDialog(false);
    onUploadComplete?.();
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
        validatedRows.forEach(row => {
          if (row.person_id) personIds.add(row.person_id);
          if (row.person_ids) row.person_ids.forEach((id: string) => personIds.add(id));
        });
        childPersonIdMap = await resolveChildPersonIds(Array.from(personIds));
        
        // Validate all person_ids were found
        const missingIds: string[] = [];
        validatedRows.forEach((row, i) => {
          if (row.person_id && !childPersonIdMap.has(row.person_id)) {
            missingIds.push(`Row ${i + 2}: Person ID "${row.person_id}" not found`);
          }
          if (row.person_ids) {
            row.person_ids.forEach((id: string) => {
              if (!childPersonIdMap.has(id)) {
                missingIds.push(`Row ${i + 2}: Person ID "${id}" not found`);
              }
            });
          }
        });
        
        if (missingIds.length > 0) {
          toast.error(`Person ID errors:\n${missingIds.slice(0, 5).join("\n")}${missingIds.length > 5 ? `\n...and ${missingIds.length - 5} more` : ""}`);
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
            baseRow.child_id = childPersonIdMap.get(row.person_id);
            delete baseRow.person_id;
          }
          if (row.person_ids) {
            baseRow.child_ids = row.person_ids.map((id: string) => childPersonIdMap.get(id)).filter(Boolean);
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

      {/* Dropped Campers Confirmation Dialog */}
      <AlertDialog open={showDroppedDialog} onOpenChange={setShowDroppedDialog}>
        <AlertDialogContent className="max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Dropped Campers Detected</AlertDialogTitle>
            <AlertDialogDescription>
              The following {droppedCampers.length} camper(s) were not found in the uploaded CSV and may have dropped from enrollment. Would you like to mark them as inactive?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
            {droppedCampers.map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground text-xs">{c.person_id}</span>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDroppedCampers([]); setShowDroppedDialog(false); }}>
              Keep Active
            </AlertDialogCancel>
            <AlertDialogAction onClick={markDroppedCampersInactive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Mark as Inactive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { CSVUploader };
