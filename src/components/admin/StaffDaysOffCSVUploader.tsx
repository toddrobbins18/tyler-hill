import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parseSpreadsheetFile, isSpreadsheetFileName } from "@/lib/spreadsheetImport";
import {
  importStaffDaysOffSchedule,
  STAFF_DAYS_OFF_CSV_TEMPLATE,
  type StaffDaysOffCsvUploadResult,
} from "@/lib/staffDaysOffCsvImport";

interface StaffDaysOffCSVUploaderProps {
  onUploadComplete?: () => void;
}

export default function StaffDaysOffCSVUploader({ onUploadComplete }: StaffDaysOffCSVUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<StaffDaysOffCsvUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentCompany } = useCompany();
  const { selectedSeason: currentSeason } = useSeason();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentCompany?.id) return;

    if (!isSpreadsheetFileName(file.name)) {
      toast.error("Please upload a CSV or Excel file (.csv, .xlsx, .xls)");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const { rows } = await parseSpreadsheetFile(file);
      if (rows.length === 0) {
        toast.error("File is empty or has no data rows");
        return;
      }

      const uploadResult = await importStaffDaysOffSchedule(supabase, {
        companyId: currentCompany.id,
        season: currentSeason,
        rows,
      });

      setResult(uploadResult);

      if (uploadResult.success > 0) {
        toast.success(`Imported ${uploadResult.success} day/night off row(s)`);
        onUploadComplete?.();
      }
      if (uploadResult.failed > 0) {
        toast.error(`${uploadResult.failed} row(s) failed`);
      }
    } catch (error) {
      console.error("Staff days off upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([STAFF_DAYS_OFF_CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff_days_off_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 className="font-medium">Upload Day & Night Off Schedule</h4>
            <p className="text-sm text-muted-foreground">
              Bulk-import staff day offs and night offs by Person ID and date
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="staff-days-off-csv-upload"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Upload File"}
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md space-y-2">
          <p className="font-medium">File columns</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Person ID</strong> — staff CampMinder Person ID (required)</li>
            <li><strong>Date</strong> — YYYY-MM-DD or M/D/YYYY (required)</li>
            <li><strong>Day Off</strong> — yes/no for full day off</li>
            <li><strong>Night Off</strong> — yes/no for night off only (or with day off)</li>
            <li><strong>Notes</strong> — optional</li>
          </ul>
          <p>
            Day off and night off are independent. Example: day off on Wednesday with night offs on
            Friday, Monday, and Tuesday — one row per date.
          </p>
        </div>
      </div>

      {result && (
        <div className="space-y-2">
          {result.success > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                {result.success} schedule row(s) imported or updated.
              </AlertDescription>
            </Alert>
          )}

          {result.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{result.failed} Failed</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 max-h-40 overflow-y-auto">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i} className="text-xs">{err}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="text-xs">...and {result.errors.length - 10} more errors</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
