import { useRef, useState } from "react";
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
import { parseSpreadsheetFile, isSpreadsheetFileName } from "@/lib/spreadsheetImport";
import { sanitizeMedicationLogRowForInsert } from "@/lib/medicationCsvImport";
import {
  CSV_REPLACE_CLEAR_TABLES,
  type CsvImportMode,
  syncChildrenFromCsv,
  syncStaffFromCsv,
} from "@/lib/csvRosterSync";
import {
  describeMissingChildPersonIds,
  normalizeCsvPersonId,
  personIdResolutionHint,
  resolveChildPersonIdsBatched,
} from "@/lib/csvPersonIdResolve";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CSVUploaderProps {
  tableName: string;
  onUploadComplete?: () => void;
}

// Tables that require person_id resolution to child UUIDs
const CHILD_PERSON_ID_TABLES = ['awards', 'daily_notes', 'incident_reports', 'medication_logs'];
// Tables that require person_id resolution to staff UUIDs
const STAFF_PERSON_ID_TABLES = ['staff'];

const ROSTER_TABLES = new Set(["children", "staff"]);

export default function CSVUploader({ tableName, onUploadComplete }: CSVUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [importMode, setImportMode] = useState<CsvImportMode>("merge");
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [pendingRows, setPendingRows] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();

  const showImportMode = ROSTER_TABLES.has(tableName) || CSV_REPLACE_CLEAR_TABLES.has(tableName);
  const isRosterTable = ROSTER_TABLES.has(tableName);

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelPendingImport = () => {
    setShowModeDialog(false);
    setPendingRows(null);
    setImportMode("merge");
    resetFileInput();
  };

  /** Match roster row for selected season (unique per company+person_id+season). */
  const resolveChildPersonIds = async (
    personIds: string[],
    season: string,
    includeInactive = false,
  ): Promise<Map<string, string>> => {
    if (!currentCompany?.id) return new Map();
    return resolveChildPersonIdsBatched(supabase, currentCompany.id, season, personIds, {
      includeInactive,
    });
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

  const executeImport = async (validatedRows: any[], mode: CsvImportMode) => {
      // --- CHILDREN / STAFF: merge or replace roster ---
      if (tableName === "children") {
        if (!currentCompany?.id) {
          toast.error("No company selected");
          return;
        }
        const result = await syncChildrenFromCsv(supabase, validatedRows, {
          companyId: currentCompany.id,
          season: selectedSeason,
          mode,
        });
        if ("error" in result) throw new Error(result.error);
        toast.success(result.message);
        onUploadComplete?.();
        return;
      }

      if (tableName === "staff") {
        if (!currentCompany?.id) {
          toast.error("No company selected");
          return;
        }
        const result = await syncStaffFromCsv(supabase, validatedRows, {
          companyId: currentCompany.id,
          season: selectedSeason,
          mode,
        });
        if ("error" in result) throw new Error(result.error);
        toast.success(result.message);
        onUploadComplete?.();
        return;
      }

      // Resolve person_ids to UUIDs for tables that need it
      let childPersonIdMap = new Map<string, string>();
      let staffPersonIdMap = new Map<string, string>();

      if (CHILD_PERSON_ID_TABLES.includes(tableName)) {
        // Extract all person_ids from validated rows
        const personIds = new Set<string>();
        validatedRows.forEach((row) => {
          if (row.person_id) personIds.add(normalizeCsvPersonId(row.person_id));
          if (row.person_ids)
            row.person_ids.forEach((id: string) => personIds.add(normalizeCsvPersonId(id)));
        });
        const includeInactive =
          tableName === "medication_logs" ||
          tableName === "daily_notes" ||
          tableName === "awards" ||
          tableName === "incident_reports";
        childPersonIdMap = await resolveChildPersonIds(
          Array.from(personIds).filter(Boolean),
          selectedSeason,
          includeInactive,
        );

        // Validate all person_ids were found
        const missingIds: string[] = [];
        validatedRows.forEach((row, i) => {
          const pid = normalizeCsvPersonId(row.person_id);
          if (pid && !childPersonIdMap.has(pid)) {
            missingIds.push(pid);
          }
          if (row.person_ids) {
            row.person_ids.forEach((id: string) => {
              const personId = normalizeCsvPersonId(id);
              if (personId && !childPersonIdMap.has(personId)) {
                missingIds.push(personId);
              }
            });
          }
        });
        
        if (missingIds.length > 0) {
          const uniqueMissing = Array.from(new Set(missingIds));
          const details = currentCompany?.id
            ? await describeMissingChildPersonIds(
                supabase,
                currentCompany.id,
                selectedSeason,
                uniqueMissing,
              )
            : uniqueMissing.map((pid) => `Person ID "${pid}" not found`);
          toast.error(
            `Person ID errors:\n${details.slice(0, 5).join("\n")}${details.length > 5 ? `\n...and ${details.length - 5} more` : ""}${personIdResolutionHint(selectedSeason)}`,
          );
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
            const pid = normalizeCsvPersonId(row.person_id);
            baseRow.child_id = childPersonIdMap.get(pid);
            delete baseRow.person_id;
          }
          if (row.person_ids) {
            baseRow.child_ids = row.person_ids
              .map((id: string) => childPersonIdMap.get(normalizeCsvPersonId(id)))
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

      const rowsToInsert =
        tableName === "medication_logs"
          ? rowsWithCompany.map((row) => {
              const copy = { ...row } as Record<string, unknown>;
              sanitizeMedicationLogRowForInsert(copy, selectedSeason);
              return copy;
            })
          : rowsWithCompany;

      if (mode === "replace" && CSV_REPLACE_CLEAR_TABLES.has(tableName) && currentCompany?.id) {
        const { error: clearError } = await supabase
          .from(tableName as any)
          .delete()
          .eq("company_id", currentCompany.id)
          .eq("season", selectedSeason);
        if (clearError) throw clearError;
      }

      const { error } = await supabase.from(tableName as any).insert(rowsToInsert as any);

      if (error) throw error;

      toast.success(`Successfully uploaded ${validatedRows.length} records`);
      onUploadComplete?.();
  };

  const handleConfirmImport = async () => {
    if (!pendingRows) return;
    setShowModeDialog(false);
    setUploading(true);
    try {
      await executeImport(pendingRows, importMode);
    } catch (error) {
      console.error('Upload error:', error);
      const msg =
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "";
      toast.error(
        msg ? `Upload failed: ${msg}` : "Failed to upload file. Please check the format and try again.",
      );
    } finally {
      setUploading(false);
      setPendingRows(null);
      setImportMode("merge");
      resetFileInput();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isSpreadsheetFileName(file.name)) {
      toast.error("Please upload a CSV or Excel file (.csv, .xlsx, .xls)");
      return;
    }

    setUploading(true);

    try {
      const { rows: rawRows } = await parseSpreadsheetFile(file);

      if (rawRows.length === 0) {
        toast.error("Spreadsheet is empty");
        setUploading(false);
        return;
      }

      if (rawRows.length > 1000) {
        toast.error("File too large. Maximum 1000 data rows allowed.");
        setUploading(false);
        return;
      }

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
            if (!pid && !med) continue;
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
        toast.error("No data rows to import. For medications, each row needs at least person_id and medication_name.");
        setUploading(false);
        resetFileInput();
        return;
      }

      if (showImportMode) {
        setPendingRows(validatedRows);
        setImportMode("merge");
        setShowModeDialog(true);
        setUploading(false);
        return;
      }

      await executeImport(validatedRows, "merge");
    } catch (error) {
      console.error('Upload error:', error);
      const msg =
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string"
          ? (error as { message: string }).message
          : "";
      toast.error(
        msg ? `Upload failed: ${msg}` : "Failed to upload file. Please check the format and try again.",
      );
    } finally {
      setUploading(false);
      resetFileInput();
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload CSV / Excel"}
        </Button>
      </div>

      <Dialog
        open={showModeDialog}
        onOpenChange={(open) => {
          if (!open) cancelPendingImport();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>How should this file be imported?</DialogTitle>
          </DialogHeader>
          <RadioGroup
            value={importMode}
            onValueChange={(value) => setImportMode(value as CsvImportMode)}
            className="gap-3 text-sm"
          >
            <div className="flex items-start gap-2 rounded-md border p-3">
              <RadioGroupItem value="merge" id={`${tableName}-csv-merge`} className="mt-0.5" />
              <Label htmlFor={`${tableName}-csv-merge`} className="font-normal leading-snug cursor-pointer">
                <span className="font-medium">Add / update</span>
                {isRosterTable
                  ? " — keep existing records; add new rows and update matches"
                  : " — append new rows (existing records stay)"}
              </Label>
            </div>
            <div className="flex items-start gap-2 rounded-md border p-3">
              <RadioGroupItem value="replace" id={`${tableName}-csv-replace`} className="mt-0.5" />
              <Label htmlFor={`${tableName}-csv-replace`} className="font-normal leading-snug cursor-pointer">
                <span className="font-medium">Replace all</span>
                {isRosterTable
                  ? " — CSV becomes the full roster; anyone not in the file is marked inactive"
                  : " — clear this season’s existing records for this camp, then import the file"}
              </Label>
            </div>
          </RadioGroup>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={cancelPendingImport}>
              Cancel
            </Button>
            <Button onClick={() => void handleConfirmImport()} disabled={uploading}>
              {uploading ? "Uploading..." : "Import CSV"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CSVFormatGuide open={showGuide} onOpenChange={setShowGuide} />
    </>
  );
}

export { CSVUploader };
