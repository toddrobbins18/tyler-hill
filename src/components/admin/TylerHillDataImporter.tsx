import { useState } from "react";
import { Upload, FileJson, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface ImportResults {
  campersImported: number;
  campersSkipped: number;
  awardsCreated: number;
  awardsSkipped: number;
  errors: string[];
}

export default function TylerHillDataImporter() {
  const { currentCompany } = useCompany();
  const [campersFile, setCampersFile] = useState<File | null>(null);
  const [awardsFile, setAwardsFile] = useState<File | null>(null);
  const [campersData, setCampersData] = useState<any[] | null>(null);
  const [awardsData, setAwardsData] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleCampersFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCampersFile(file);
    setValidationError(null);
    setImportResults(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) {
        setValidationError("Campers file must contain an array of camper objects");
        setCampersData(null);
        return;
      }

      setCampersData(data);
      toast.success(`Loaded ${data.length} campers from file`);
    } catch (error: any) {
      setValidationError(`Failed to parse campers file: ${error.message}`);
      setCampersData(null);
    }
  };

  const handleAwardsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAwardsFile(file);
    setValidationError(null);
    setImportResults(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) {
        setValidationError("Awards file must contain an array of award objects");
        setAwardsData(null);
        return;
      }

      setAwardsData(data);
      toast.success(`Loaded ${data.length} awards from file`);
    } catch (error: any) {
      setValidationError(`Failed to parse awards file: ${error.message}`);
      setAwardsData(null);
    }
  };

  const handleImport = async () => {
    if (!campersData || !awardsData || !currentCompany) {
      toast.error("Please upload both files before importing");
      return;
    }

    setImporting(true);
    setImportProgress(10);
    setImportResults(null);
    setValidationError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      setImportProgress(20);

      const response = await supabase.functions.invoke('import-tyler-hill-data', {
        body: {
          campersData,
          awardsData,
          companyId: currentCompany.id,
        },
      });

      setImportProgress(90);

      if (response.error) {
        throw new Error(response.error.message || 'Import failed');
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Import failed');
      }

      setImportProgress(100);
      setImportResults(response.data.results);
      toast.success("Import completed successfully!");
    } catch (error: any) {
      console.error("Import error:", error);
      setValidationError(error.message || "Import failed");
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const canImport = campersData && awardsData && !importing && currentCompany;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tyler Hill Camp Data Import</CardTitle>
          <CardDescription>
            Import campers and awards data from JSON files for the 2025 season.
            Awards will retain their original years while being linked to 2025 season records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Campers File (campers-3.json)
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('campers-file')?.click()}
                  className="w-full"
                  disabled={importing}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {campersFile ? campersFile.name : "Select File"}
                </Button>
                <input
                  id="campers-file"
                  type="file"
                  accept=".json"
                  onChange={handleCampersFileChange}
                  className="hidden"
                  disabled={importing}
                />
                {campersData && (
                  <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                )}
              </div>
              {campersData && (
                <p className="text-xs text-muted-foreground">
                  {campersData.length} campers loaded
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Awards File (awards-3.json)
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('awards-file')?.click()}
                  className="w-full"
                  disabled={importing}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {awardsFile ? awardsFile.name : "Select File"}
                </Button>
                <input
                  id="awards-file"
                  type="file"
                  accept=".json"
                  onChange={handleAwardsFileChange}
                  className="hidden"
                  disabled={importing}
                />
                {awardsData && (
                  <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                )}
              </div>
              {awardsData && (
                <p className="text-xs text-muted-foreground">
                  {awardsData.length} awards loaded
                </p>
              )}
            </div>
          </div>

          {/* Preview Section */}
          {campersData && awardsData && !importing && !importResults && (
            <Alert>
              <FileJson className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Ready to import:</p>
                  <ul className="text-sm list-disc list-inside space-y-1">
                    <li>{campersData.length} campers will be imported</li>
                    <li>Awards will be linked to campers based on winner_ids</li>
                    <li>All data will be set to season 2025</li>
                    <li>Award dates will retain their original years (2014-2025)</li>
                    <li>Duplicate person_ids will be skipped</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Progress Section */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Importing data...</span>
                <span className="text-muted-foreground">{importProgress}%</span>
              </div>
              <Progress value={importProgress} />
            </div>
          )}

          {/* Validation Error */}
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* Import Results */}
          {importResults && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Import completed!</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Campers Imported:</p>
                      <p className="font-semibold text-success">{importResults.campersImported}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Campers Skipped:</p>
                      <p className="font-semibold">{importResults.campersSkipped}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Awards Created:</p>
                      <p className="font-semibold text-success">{importResults.awardsCreated}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Awards Skipped:</p>
                      <p className="font-semibold">{importResults.awardsSkipped}</p>
                    </div>
                  </div>
                  {importResults.errors.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="font-medium text-destructive mb-2">
                        Errors ({importResults.errors.length}):
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {importResults.errors.slice(0, 10).map((error, idx) => (
                          <p key={idx} className="text-xs text-muted-foreground">
                            • {error}
                          </p>
                        ))}
                        {importResults.errors.length > 10 && (
                          <p className="text-xs text-muted-foreground italic">
                            ... and {importResults.errors.length - 10} more errors
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Import Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleImport}
              disabled={!canImport}
              size="lg"
            >
              {importing ? "Importing..." : "Start Import"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Important Notes */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-2">Important Notes:</p>
          <ul className="text-sm list-disc list-inside space-y-1">
            <li>This import is designed for Tyler Hill Camp 2025 season data</li>
            <li>The import process uses person_id from the JSON files to link historical data</li>
            <li>When a camper returns in future seasons with the same person_id, all their historical awards will be visible</li>
            <li>Duplicate person_ids within the same season will be skipped</li>
            <li>Award dates reflect the original year earned (e.g., 2019 awards will show 2019-07-01)</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
