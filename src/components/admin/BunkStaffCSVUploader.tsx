import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { bunkStaffSchema, parseBunkStaffRow } from "@/lib/validationSchemas";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface BunkStaffCSVUploaderProps {
  onUploadComplete?: () => void;
}

interface UploadResult {
  success: number;
  failed: number;
  errors: string[];
  created: { personId: string; bunkNumber: number }[];
}

export default function BunkStaffCSVUploader({ onUploadComplete }: BunkStaffCSVUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const { currentCompany } = useCompany();
  const { selectedSeason: currentSeason } = useSeason();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentCompany?.id) return;

    if (!file.name.endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        toast.error("CSV file is empty");
        setUploading(false);
        return;
      }

      if (lines.length > 501) {
        toast.error("CSV file too large. Maximum 500 rows allowed.");
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

      // Fetch all staff and bunks for lookup
      const [staffRes, bunksRes] = await Promise.all([
        supabase
          .from("staff")
          .select("id, name, person_id")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason),
        supabase
          .from("bunks")
          .select("id, bunk_number, bunk_name")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .eq("is_active", true)
      ]);

      const staffList = staffRes.data || [];
      const bunksList = bunksRes.data || [];

      // Create maps for lookup - use person_id as the primary key
      const staffByPersonId = new Map<string, string>();
      for (const s of staffList) {
        if (s.person_id) {
          staffByPersonId.set(s.person_id.toLowerCase().trim(), s.id);
        }
      }
      
      const bunkByNumber = new Map<number, string>();
      for (const b of bunksList) {
        bunkByNumber.set(b.bunk_number, b.id);
      }

      // Parse and validate each row
      const uploadResult: UploadResult = {
        success: 0,
        failed: 0,
        errors: [],
        created: []
      };

      for (let i = 0; i < rawRows.length; i++) {
        try {
          const parsed = parseBunkStaffRow(rawRows[i]);
          const validated = bunkStaffSchema.parse(parsed);
          
          // Find staff by person_id (case-insensitive)
          const staffId = staffByPersonId.get(validated.person_id.toLowerCase());
          if (!staffId) {
            uploadResult.failed++;
            uploadResult.errors.push(`Row ${i + 2}: Staff with Person ID "${validated.person_id}" not found`);
            continue;
          }

          // Find bunk by number
          const bunkId = bunkByNumber.get(validated.bunk_number);
          if (!bunkId) {
            uploadResult.failed++;
            uploadResult.errors.push(`Row ${i + 2}: Bunk #${validated.bunk_number} not found`);
            continue;
          }

          // Check if assignment already exists
          const { data: existing } = await supabase
            .from("bunk_staff")
            .select("id")
            .eq("company_id", currentCompany.id)
            .eq("season", currentSeason)
            .eq("staff_id", staffId)
            .eq("bunk_id", bunkId)
            .maybeSingle();

          if (existing) {
            // Update existing
            await supabase
              .from("bunk_staff")
              .update({ is_primary: validated.is_primary || false })
              .eq("id", existing.id);
          } else {
            // Insert new
            const { error } = await supabase
              .from("bunk_staff")
              .insert({
                company_id: currentCompany.id,
                season: currentSeason,
                staff_id: staffId,
                bunk_id: bunkId,
                is_primary: validated.is_primary || false
              });

            if (error) throw error;
          }

          uploadResult.success++;
          uploadResult.created.push({
            personId: validated.person_id,
            bunkNumber: validated.bunk_number
          });

        } catch (error) {
          uploadResult.failed++;
          if (error instanceof z.ZodError) {
            uploadResult.errors.push(`Row ${i + 2}: ${error.errors.map(e => e.message).join(", ")}`);
          } else {
            uploadResult.errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      setResult(uploadResult);

      if (uploadResult.success > 0) {
        toast.success(`Successfully assigned ${uploadResult.success} staff to bunks`);
        onUploadComplete?.();
      }
      
      if (uploadResult.failed > 0) {
        toast.error(`${uploadResult.failed} assignments failed`);
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to upload CSV. Please check the format and try again.");
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const downloadTemplate = () => {
    const csv = `Person ID,Bunk Number,Is Primary
12345,1,true
67890,2,false
11111,1,false`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bunk_staff_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Upload Bunk Assignments</h4>
            <p className="text-sm text-muted-foreground">
              Upload a CSV file to assign staff to bunks in bulk
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="bunk-staff-csv-upload"
            />
            <Button
              onClick={() => document.getElementById('bunk-staff-csv-upload')?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Upload CSV"}
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
          <p className="font-medium mb-1">CSV Format:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Person ID</strong> - The CampMinder Person ID (required for matching)</li>
            <li><strong>Bunk Number</strong> - The bunk number (must exist)</li>
            <li><strong>Is Primary</strong> - Optional: true/false, yes/no, or 1/0</li>
          </ul>
        </div>
      </div>

      {result && (
        <div className="space-y-2">
          {result.success > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                {result.success} staff successfully assigned to bunks.
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
