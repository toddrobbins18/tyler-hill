import { useState, useEffect } from "react";
import { Upload, FileJson, AlertCircle, CheckCircle2, RefreshCw, Clock, Building2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface ImportResults {
  campersImported: number;
  campersSkipped: number;
  awardsCreated: number;
  awardsSkipped: number;
  errors: string[];
}

interface CampMinderSyncResult {
  campers?: { imported: number; updated: number; errors: string[] };
  staff?: { imported: number; updated: number; errors: string[] };
  divisions?: { imported: number; updated: number; errors: string[] };
  sessions?: { imported: number; updated: number; errors: string[] };
}

interface CompanyWithCampMinder {
  id: string;
  name: string;
  campminder_sync_enabled: boolean | null;
  campminder_last_sync_at: string | null;
}

export default function CampDataImporter() {
  const { currentCompany, isSuperAdmin } = useCompany();
  
  // CampMinder sync state
  const [companies, setCompanies] = useState<CompanyWithCampMinder[]>([]);
  const [syncingCompanyId, setSyncingCompanyId] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, CampMinderSyncResult>>({});
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  
  // Manual JSON import state (for current company)
  const [campersFile, setCampersFile] = useState<File | null>(null);
  const [awardsFile, setAwardsFile] = useState<File | null>(null);
  const [campersData, setCampersData] = useState<any[] | null>(null);
  const [awardsData, setAwardsData] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    fetchCompanies();
  }, [isSuperAdmin, currentCompany]);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      let query = supabase
        .from('companies')
        .select('id, name, campminder_sync_enabled, campminder_last_sync_at')
        .eq('is_active', true)
        .order('name');

      // If not super admin, only show current company
      if (!isSuperAdmin && currentCompany) {
        query = query.eq('id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to load companies');
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleCampMinderSync = async (companyId: string, companyName: string) => {
    setSyncingCompanyId(companyId);
    setSyncResults(prev => ({ ...prev, [companyId]: {} }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      toast.info(`Starting CampMinder sync for ${companyName}...`);

      const response = await supabase.functions.invoke('sync-campminder', {
        body: {
          company_id: companyId,
          season_id: 2026,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Sync failed');
      }

      const result = response.data;
      
      if (!result.success) {
        throw new Error(result.error || 'Sync failed');
      }

      // Extract results for this company
      const companyResults = result.results?.[0] || {};
      setSyncResults(prev => ({
        ...prev,
        [companyId]: {
          campers: companyResults.campers,
          staff: companyResults.staff,
          divisions: companyResults.divisions,
          sessions: companyResults.sessions,
        }
      }));

      // Refresh companies to get updated last_sync timestamp
      await fetchCompanies();
      toast.success(`CampMinder sync completed for ${companyName}!`);
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error(`Sync failed for ${companyName}: ${error.message}`);
    } finally {
      setSyncingCompanyId(null);
    }
  };

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
      toast.success(`Loaded ${data.length} awards loaded`);
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

  const renderSyncResultBadge = (result: { imported: number; updated: number; errors: string[] } | undefined, label: string) => {
    if (!result) return null;
    const hasErrors = result.errors && result.errors.length > 0;
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{label}:</span>
        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
          +{result.imported} new
        </Badge>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
          {result.updated} updated
        </Badge>
        {hasErrors && (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            {result.errors.length} errors
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* CampMinder Sync Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            CampMinder Sync
          </CardTitle>
          <CardDescription>
            Sync campers, staff, divisions, and sessions from CampMinder API for the 2026 season.
            Auto-sync runs every hour for all configured camps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingCompanies ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : companies.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No companies found.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {companies.map((company) => (
                <div key={company.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <h4 className="font-medium">{company.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {company.campminder_last_sync_at ? (
                            <span>Last synced: {format(new Date(company.campminder_last_sync_at), 'MMM d, yyyy h:mm a')}</span>
                          ) : (
                            <span>Never synced</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {company.campminder_sync_enabled ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Configured
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Configured
                        </Badge>
                      )}
                      <Button
                        onClick={() => handleCampMinderSync(company.id, company.name)}
                        disabled={!company.campminder_sync_enabled || syncingCompanyId !== null}
                        size="sm"
                      >
                        {syncingCompanyId === company.id ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Sync Now
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Sync Results */}
                  {syncResults[company.id] && Object.keys(syncResults[company.id]).length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <p className="text-sm font-medium">Sync Results:</p>
                      {renderSyncResultBadge(syncResults[company.id].divisions, 'Divisions')}
                      {renderSyncResultBadge(syncResults[company.id].campers, 'Campers')}
                      {renderSyncResultBadge(syncResults[company.id].staff, 'Staff')}
                      {renderSyncResultBadge(syncResults[company.id].sessions, 'Sessions')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Manual JSON Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Manual JSON Import
          </CardTitle>
          <CardDescription>
            Import campers and awards data from JSON files for the 2026 season.
            Awards will retain their original years while being linked to 2026 season records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Campers File (campers.json)
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
                Awards File (awards.json)
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
                    <li>{campersData.length} campers in file</li>
                    <li>Optimized batch processing (50 campers at a time)</li>
                    <li>Existing person_ids will be automatically skipped</li>
                    <li>Awards will be bulk-imported after campers</li>
                    <li>All data will be set to season 2026</li>
                    <li>Award dates will retain their original years</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    Tip: You can safely re-run this import to complete any missing records.
                  </p>
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
              {importing ? "Importing..." : importResults ? "Re-run Import" : "Start Import"}
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
            <li>CampMinder sync runs automatically every hour for all configured camps</li>
            <li>The import process uses person_id to link historical data across seasons</li>
            <li>When a camper returns in future seasons with the same person_id, all their historical awards will be visible</li>
            <li>Duplicate person_ids within the same season will be skipped</li>
            <li>Award dates reflect the original year earned</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
