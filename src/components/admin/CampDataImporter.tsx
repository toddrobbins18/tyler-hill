import { useState, useEffect, useRef, useMemo } from "react";
import { Upload, FileJson, AlertCircle, CheckCircle2, RefreshCw, Clock, Building2, XCircle, Mail, MapPin, CalendarDays } from "lucide-react";
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
import { DEFAULT_SEASON } from "@/lib/seasonConstants";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { isNorthShoreDayCamp } from "@/lib/camps";
import OperationLivePanel from "@/components/admin/OperationLivePanel";
import { useSyncJobMonitor } from "@/hooks/useSyncJobMonitor";
import { syncJobTitle, type OperationStep } from "@/lib/operationLiveLog";

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
  slug: string;
  campminder_sync_enabled: boolean | null;
  campminder_last_sync_at: string | null;
}

type CampMinderSyncLivePanel = {
  visible: boolean;
  companyName: string;
  syncType: string;
  jobId: string | null;
  overlaySteps: OperationStep[] | null;
};

type CampMinderSyncKind = "full" | "staff" | "campers" | "addresses" | "enrollment_weeks";

export default function CampDataImporter() {
  const { currentCompany, isSuperAdmin } = useCompany();
  const { currentSeason } = useSeasonContext();
  
  // CampMinder sync state
  const [companies, setCompanies] = useState<CompanyWithCampMinder[]>([]);
  const [activeSync, setActiveSync] = useState<{ companyId: string; kind: CampMinderSyncKind } | null>(null);
  const syncBusy = activeSync !== null;
  const isSyncButtonActive = (companyId: string, kind: CampMinderSyncKind) =>
    activeSync?.companyId === companyId && activeSync?.kind === kind;
  const [syncLivePanel, setSyncLivePanel] = useState<CampMinderSyncLivePanel | null>(null);
  const syncFinishedRef = useRef(false);
  const [backfillingSlug, setBackfillingSlug] = useState<string | null>(null);
  const [backfillOperation, setBackfillOperation] = useState<{ companyName: string; steps: OperationStep[] } | null>(
    null,
  );
  const [dismissedBackfill, setDismissedBackfill] = useState(false);
  const syncMonitor = useSyncJobMonitor(syncLivePanel?.jobId ?? null);

  const syncLiveSteps = useMemo((): OperationStep[] => {
    if (!syncLivePanel?.visible) return [];
    if (syncLivePanel.jobId && syncMonitor.steps.length > 0) return syncMonitor.steps;
    if (syncLivePanel.overlaySteps?.length) return syncLivePanel.overlaySteps;
    return [
      {
        id: "kickoff",
        label: `Starting ${syncLivePanel.syncType}…`,
        status: "running",
      },
    ];
  }, [syncLivePanel, syncMonitor.steps]);

  const syncLiveActive =
    syncBusy ||
    syncMonitor.isLive ||
    (syncLivePanel?.overlaySteps?.some((s) => s.status === "running") ?? false);
  
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
  const [importSeason, setImportSeason] = useState<string>("2025");

  useEffect(() => {
    fetchCompanies();
  }, [isSuperAdmin, currentCompany]);

  useEffect(() => {
    if (!syncLivePanel?.jobId || !syncMonitor.isDone || syncFinishedRef.current) return;
    syncFinishedRef.current = true;
    setActiveSync(null);
    void fetchCompanies();

    if (syncMonitor.job?.status?.toLowerCase() === "completed") {
      toast.success(`CampMinder sync finished for ${syncLivePanel.companyName}`);
    } else {
      toast.error(
        syncMonitor.error ??
          syncMonitor.job?.error_message ??
          `Sync failed for ${syncLivePanel.companyName}`,
      );
    }
  }, [syncMonitor.isDone, syncMonitor.job, syncMonitor.error, syncLivePanel?.jobId, syncLivePanel?.companyName]);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      let query = supabase
        .from('companies')
        .select('id, name, slug, campminder_sync_enabled, campminder_last_sync_at')
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

  const handleGuardianEmailBackfill = async (companySlug: string, companyName: string) => {
    setBackfillingSlug(companySlug);
    setDismissedBackfill(false);
    const seasons = ["2027", "2026"];
    let hadAuthFailure = false;
    let totalUpdated = 0;

    const updateBackfillSteps = (steps: OperationStep[]) => {
      setBackfillOperation({ companyName, steps });
    };

    updateBackfillSteps([{ id: "connect", label: "Connecting to CampMinder", status: "running" }]);

    try {
      for (const season of seasons) {
        let remaining = 1;
        let runs = 0;

        updateBackfillSteps([
          { id: "connect", label: "Connecting to CampMinder", status: "done" },
          {
            id: `season-${season}`,
            label: `Fetching parent emails · season ${season}`,
            status: "running",
            detail: `${totalUpdated} updated so far`,
          },
        ]);

        while (remaining > 0 && runs < 40) {
          runs++;
          const { data, error } = await supabase.functions.invoke("populate-guardian-emails", {
            body: { company: companySlug, season, batch_size: 25 },
          });

          if (error) throw error;

          const row = data?.results?.[0] ?? {};
          remaining = row.remaining ?? remaining;
          totalUpdated += row.updated ?? 0;

          updateBackfillSteps([
            { id: "connect", label: "Connecting to CampMinder", status: "done" },
            {
              id: `season-${season}`,
              label: `Fetching parent emails · season ${season}`,
              status: "running",
              detail: `${totalUpdated} updated · ${remaining} remaining`,
            },
          ]);

          if (row.reason?.includes("Auth failed")) {
            hadAuthFailure = true;
            updateBackfillSteps([
              { id: "connect", label: "Connecting to CampMinder", status: "done" },
              {
                id: `season-${season}`,
                label: `Fetching parent emails · season ${season}`,
                status: "error",
                detail: "CampMinder auth failed — wait 30s and try again",
              },
            ]);
            toast.error(`${season}: CampMinder auth failed — wait 30s and click Parent emails again.`);
            break;
          }
          if (row.status === "complete" || remaining === 0) break;
          await new Promise((r) => setTimeout(r, 5000));
        }
      }

      if (!hadAuthFailure) {
        updateBackfillSteps([
          { id: "connect", label: "Connecting to CampMinder", status: "done" },
          { id: "2027", label: "Season 2027 parent emails", status: "done" },
          { id: "2026", label: "Season 2026 parent emails", status: "done" },
          {
            id: "done",
            label: "Parent email backfill complete",
            status: "done",
            detail: `${totalUpdated} emails updated`,
          },
        ]);
        toast.success(`Parent email backfill done (${totalUpdated} updated).`);
      } else {
        toast.message(`${totalUpdated} parent emails saved. Click Parent emails again to continue.`, { duration: 6000 });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Backfill failed";
      updateBackfillSteps([
        { id: "connect", label: "Connecting to CampMinder", status: "done" },
        { id: "error", label: "Backfill failed", status: "error", detail: message },
      ]);
      toast.error(message);
    } finally {
      setBackfillingSlug(null);
    }
  };

  const handleCampMinderSync = async (
    companyId: string,
    companyName: string,
    syncType: CampMinderSyncKind = 'full',
  ) => {
    setActiveSync({ companyId, kind: syncType });
    setSyncResults(prev => ({ ...prev, [companyId]: {} }));
    syncFinishedRef.current = false;

    const syncLabel = syncType === 'full' ? 'full sync' : `${syncType.replace(/_/g, ' ')} sync`;
    setSyncLivePanel({
      visible: true,
      companyName,
      syncType: syncLabel,
      jobId: null,
      overlaySteps: [{ id: "connect", label: "Connecting to CampMinder…", status: "running" }],
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      toast.info(`${syncLabel} started for ${companyName}`);

      setSyncLivePanel((prev) =>
        prev
          ? {
              ...prev,
              overlaySteps: [{ id: "queue", label: "Queueing sync job…", status: "running" }],
            }
          : prev,
      );

      const syncSeason = currentSeason || DEFAULT_SEASON;
      const response = await supabase.functions.invoke('sync-campminder', {
        body: {
          company_id: companyId,
          season_id: syncSeason,
          sync_type: syncType,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Sync failed');
      }

      const result = response.data;
      
      if (!result.success) {
        throw new Error(result.error || 'Sync failed');
      }

      const companyResults =
        (result.results as Array<{ company_id?: string; job_id?: string; status?: string; message?: string }> | undefined)?.find(
          (row) => row.company_id === companyId,
        ) ?? result.results?.[0] ?? {};
      const jobId = companyResults.job_id as string | undefined;
      const resultStatus = String(companyResults.status ?? "").toLowerCase();

      if (resultStatus === "skipped") {
        const detail = companyResults.message ?? "Another sync of this type is already running.";
        setSyncLivePanel({
          visible: true,
          companyName,
          syncType: syncLabel,
          jobId: null,
          overlaySteps: [{ id: "skipped", label: "Sync skipped", status: "error", detail }],
        });
        setActiveSync(null);
        toast.warning(detail);
        return;
      }

      if (jobId) {
        setSyncLivePanel({
          visible: true,
          companyName,
          syncType: syncLabel,
          jobId,
          overlaySteps: [{ id: "live", label: "Sync running — live updates below…", status: "running" }],
        });
      } else {
        setSyncLivePanel({
          visible: true,
          companyName,
          syncType: syncLabel,
          jobId: null,
          overlaySteps: [{ id: "done", label: "Sync finished", status: "done", detail: companyResults.message }],
        });
        setSyncResults(prev => ({
          ...prev,
          [companyId]: {
            campers: companyResults.campers,
            staff: companyResults.staff,
            divisions: companyResults.divisions,
            sessions: companyResults.sessions,
          },
        }));
        setActiveSync(null);
        await fetchCompanies();
        toast.success(`${syncLabel} completed for ${companyName}.`);
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      const message = error.message ?? "Sync failed";
      toast.error(`Sync failed for ${companyName}: ${message}`);
      setActiveSync(null);
      setSyncLivePanel({
        visible: true,
        companyName,
        syncType: syncLabel,
        jobId: null,
        overlaySteps: [{ id: "error", label: "Sync failed", status: "error", detail: message }],
      });
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
          season: importSeason,
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

  const campMinderLiveLogPanel =
    syncLivePanel?.visible && syncLiveSteps.length > 0 ? (
      <OperationLivePanel
        title={syncMonitor.job ? syncJobTitle(syncMonitor.job) : `CampMinder · ${syncLivePanel.syncType}`}
        subtitle={`Live progress · ${syncLivePanel.companyName}`}
        steps={syncLiveSteps}
        active={syncLiveActive}
        onDismiss={
          syncLiveActive
            ? undefined
            : () => setSyncLivePanel(null)
        }
        className="shadow-lg bg-background/95 backdrop-blur-sm"
      />
    ) : null;

  return (
    <div className="space-y-6">
      {campMinderLiveLogPanel ? (
        <div className="fixed bottom-4 left-4 z-50 w-[min(100vw-2rem,22rem)] sm:left-6 pointer-events-auto">
          {campMinderLiveLogPanel}
        </div>
      ) : null}
      {/* CampMinder Sync Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            CampMinder Sync
          </CardTitle>
          <CardDescription>
            Sync campers, staff, divisions, and sessions from CampMinder for season {currentSeason || DEFAULT_SEASON}.
            Automatic sync (Eastern): addresses <strong>4 AM</strong>, enrollment weeks <strong>5 AM</strong>, campers <strong>6 AM / 6 PM</strong>, staff <strong>7 AM / 7 PM</strong>, Owl Pay <strong>8 AM / 8 PM</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {backfillOperation && !dismissedBackfill ? (
            <OperationLivePanel
              title="Parent email backfill"
              subtitle={backfillOperation.companyName}
              steps={backfillOperation.steps}
              active={backfillingSlug !== null}
              onDismiss={() => setDismissedBackfill(true)}
            />
          ) : null}
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
                    <div className="flex items-center gap-2">
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
                        onClick={() => handleCampMinderSync(company.id, company.name, 'campers')}
                        disabled={!company.campminder_sync_enabled || syncBusy}
                        size="sm"
                        variant="outline"
                        title="Sync only enrolled campers (use for large rosters like Tyler Hill)"
                      >
                        {isSyncButtonActive(company.id, "campers") ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          "Campers Only"
                        )}
                      </Button>
                      <Button
                        onClick={() => handleCampMinderSync(company.id, company.name, 'staff')}
                        disabled={!company.campminder_sync_enabled || syncBusy}
                        size="sm"
                        variant="outline"
                        title="Sync only staff members (faster)"
                      >
                        {isSyncButtonActive(company.id, "staff") ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          "Staff Only"
                        )}
                      </Button>
                      <Button
                        onClick={() => handleCampMinderSync(company.id, company.name, 'full')}
                        disabled={!company.campminder_sync_enabled || syncBusy}
                        size="sm"
                      >
                        {isSyncButtonActive(company.id, "full") ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Full Sync
                          </>
                        )}
                      </Button>
                      {isNorthShoreDayCamp(company.slug) && (
                        <>
                          <Button
                            onClick={() => handleCampMinderSync(company.id, company.name, 'addresses')}
                            disabled={!company.campminder_sync_enabled || backfillingSlug !== null || syncBusy}
                            size="sm"
                            variant="secondary"
                            title="Fetch household addresses from CampMinder for Transport"
                          >
                            {isSyncButtonActive(company.id, "addresses") ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Syncing…
                              </>
                            ) : (
                              <>
                                <MapPin className="h-4 w-4 mr-2" />
                                Addresses
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => handleCampMinderSync(company.id, company.name, 'enrollment_weeks')}
                            disabled={!company.campminder_sync_enabled || backfillingSlug !== null || syncBusy}
                            size="sm"
                            variant="secondary"
                            title="Refresh session labels and enrolled_weeks from CampMinder (bubble sheets)"
                          >
                            {isSyncButtonActive(company.id, "enrollment_weeks") ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Syncing…
                              </>
                            ) : (
                              <>
                                <CalendarDays className="h-4 w-4 mr-2" />
                                Weeks
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => handleGuardianEmailBackfill(company.slug, company.name)}
                            disabled={!company.campminder_sync_enabled || backfillingSlug !== null || syncBusy}
                            size="sm"
                            variant="secondary"
                            title="Fetch parent emails from CampMinder (2027 + 2026)"
                          >
                            {backfillingSlug === company.slug ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Backfilling…
                              </>
                            ) : (
                              <>
                                <Mail className="h-4 w-4 mr-2" />
                                Parent emails
                              </>
                            )}
                          </Button>
                        </>
                      )}
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
            Import campers and awards data from JSON files.
            Awards will retain their original years while being linked to the selected season records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Season Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Import Season</label>
            <select
              value={importSeason}
              onChange={(e) => setImportSeason(e.target.value)}
              className="w-full p-2 border rounded-md bg-background"
              disabled={importing}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
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
                    <li>All data will be set to season {importSeason}</li>
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
            <li>CampMinder sync (Eastern): addresses 4 AM, enrollment weeks 5 AM, campers 6 AM/PM, staff 7 AM/PM, Owl Pay 8 AM/PM</li>
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
