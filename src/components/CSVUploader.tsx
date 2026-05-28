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
import { parseCsvDocument } from "@/lib/csvLine";
import { STANDARD_MEAL_SCHEDULE_HHMM } from "@/lib/medicationBedtimeOptions";
import {
  applyDailyMedicationDefaults,
  campProgramEndDate,
  mergeMedicationsForDate,
  childMatchesGenderFilter,
  type MedicationLogRow,
} from "@/lib/medicationSchedule";
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

/** Map CSV Meal Time uppercase labels → DB constraint values (`valid_meal_times`). */
const CSV_MEAL_SLOT_TO_LABEL: Record<string, string> = {
  "BEFORE BREAKFAST": "Before Breakfast",
  "AFTER BREAKFAST": "After Breakfast",
  "BEFORE LUNCH": "Before Lunch",
  "AFTER LUNCH": "After Lunch",
  "BEFORE DINNER": "Before Dinner",
  "AFTER DINNER": "After Dinner",
  BEDTIME: "Bedtime",
  BED: "Bedtime",
};

const WEEKDAY_ALIASES: Record<string, string> = {
  SUNDAY: "Sunday",
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
};

function localDateYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Postgres DATE/TIME reject `""`. CSV meds rows often omit `date` → Zod defaulted to "".
 * `scheduled_time` is parsed from Meal Time ("BEFORE BREAKFAST") but the DB expects TIME HH:mm + `meal_time` text[].
 */
function normalizeDateStringOrNull(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // Accept ISO/calendar forms we use in DB inserts.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Accept common spreadsheet date style: MM/DD/YYYY.
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const mm = us[1].padStart(2, "0");
    const dd = us[2].padStart(2, "0");
    return `${us[3]}-${mm}-${dd}`;
  }

  // Anything else (e.g. "image.png") is invalid for DATE.
  return null;
}

function normalizeMedicationFrequencyValue(raw: unknown): string | null {
  const v = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!v) return null;
  if (["DAILY", "EVERY DAY", "EVERYDAY", "QD"].includes(v)) return "daily";
  if (["WEEKLY", "EVERY WEEK"].includes(v)) return "weekly";
  if (["CUSTOM", "MONTHLY", "EVERY MONTH"].includes(v)) return "custom";
  if (["AS NEEDED", "PRN"].includes(v)) return null;
  if (WEEKDAY_ALIASES[v]) return "weekly";
  return null;
}

function normalizeMedicationDaysOfWeek(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = raw
    .map((d) => WEEKDAY_ALIASES[String(d ?? "").trim().toUpperCase()] ?? null)
    .filter((d): d is string => Boolean(d));
  return Array.from(new Set(out));
}

function sanitizeMedicationLogRowForInsert(row: Record<string, unknown>, season: string): void {
  const normalizedDate = normalizeDateStringOrNull(row.date);
  row.date = normalizedDate || defaultMedicationStartDate(season);

  row.end_date = normalizeDateStringOrNull(row.end_date);

  const normalizedFrequency = normalizeMedicationFrequencyValue(row.frequency);
  row.frequency = normalizedFrequency;
  row.days_of_week = normalizeMedicationDaysOfWeek(row.days_of_week);
  if (!row.is_recurring && !normalizedFrequency) {
    row.days_of_week = [];
  }

  const rawSlot = String(row.scheduled_time ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const upper = rawSlot.toUpperCase();
  const isAsNeeded =
    !upper ||
    upper.includes("AS NEEDED") ||
    upper === "PRN";

  if (isAsNeeded) {
    row.scheduled_time = null;
    row.meal_time = null;
    return;
  }

  const label = CSV_MEAL_SLOT_TO_LABEL[upper];
  if (!label) {
    row.scheduled_time = null;
    row.meal_time = null;
    return;
  }

  row.meal_time = [label];
  if (label === "Bedtime") {
    row.scheduled_time = "21:00";
  } else {
    row.scheduled_time =
      STANDARD_MEAL_SCHEDULE_HHMM[label as keyof typeof STANDARD_MEAL_SCHEDULE_HHMM] ?? "12:00";
  }

  applyDailyMedicationDefaults(row, season);
}

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
        msg ? `Upload failed: ${msg}` : "Failed to upload CSV. Please check the format and try again.",
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
        msg ? `Upload failed: ${msg}` : "Failed to upload CSV. Please check the format and try again.",
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
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload CSV"}
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
