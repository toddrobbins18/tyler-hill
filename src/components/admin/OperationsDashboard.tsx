import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Activity,
  Mail,
  RefreshCw,
  Database,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  Waves,
  Upload,
  XCircle,
  Loader2,
  ArrowUpRight,
  Inbox,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  type EmailLogRow,
  type SyncJobRow,
  emailStatusVariant,
  formatEmailTags,
  formatJobDuration,
  formatRelativeTime,
  formatSyncCounts,
  syncJobStep,
  syncJobSyncType,
  syncStatusVariant,
  isLiveSyncJob,
  isStaleSyncJob,
} from "@/lib/operationsDashboard";

type CompanyOpsMeta = {
  campminder_sync_enabled: boolean | null;
  campminder_last_sync_at: string | null;
};

type EmailConfigSummary = {
  is_configured: boolean | null;
  is_active: boolean | null;
  m365_sender_email: string | null;
  last_test_status: string | null;
  last_tested_at: string | null;
};

type DataSnapshot = {
  children: number;
  childrenWithEmail: number;
  staff: number;
  swimRecords: number;
};

type SenderProfile = {
  id: string;
  full_name: string | null;
  email: string;
};

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Activity;
  accent: string;
  loading?: boolean;
}) {
  return (
    <Card className="overflow-hidden border-border/60 bg-card/80 backdrop-blur-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold tracking-tight">{value}</p>
            )}
            <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>
          </div>
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", accent)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SyncStatusDot({ status }: { status: string }) {
  const s = status.toLowerCase();
  return (
    <span
      className={cn(
        "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background",
        s === "completed" && "bg-emerald-500",
        s === "running" && "bg-sky-500 animate-pulse",
        s === "pending" && "bg-amber-500 animate-pulse",
        s === "failed" && "bg-red-500",
        !["completed", "running", "pending", "failed"].includes(s) && "bg-muted-foreground",
      )}
    />
  );
}

function EmptyPanel({ icon: Icon, title, description }: { icon: typeof Inbox; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function OperationsDashboard() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyMeta, setCompanyMeta] = useState<CompanyOpsMeta | null>(null);
  const [emailConfig, setEmailConfig] = useState<EmailConfigSummary | null>(null);
  const [syncJobs, setSyncJobs] = useState<SyncJobRow[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogRow[]>([]);
  const [senders, setSenders] = useState<Map<string, SenderProfile>>(new Map());
  const [snapshot, setSnapshot] = useState<DataSnapshot | null>(null);

  const load = useCallback(async () => {
    if (!currentCompany?.id) {
      setLoading(false);
      setSyncJobs([]);
      setEmailLogs([]);
      setSnapshot(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const companyId = currentCompany.id;
      const season = currentSeason;

      const [
        companyRes,
        emailCfgRes,
        syncRes,
        childrenCountRes,
        childrenEmailRes,
        staffCountRes,
        swimCountRes,
        companyProfilesRes,
      ] = await Promise.all([
        supabase
          .from("companies")
          .select("campminder_sync_enabled, campminder_last_sync_at")
          .eq("id", companyId)
          .single(),
        supabase
          .from("company_email_config")
          .select("is_configured, is_active, m365_sender_email, last_test_status, last_tested_at")
          .eq("company_id", companyId)
          .maybeSingle(),
        supabase
          .from("sync_jobs")
          .select("*")
          .eq("company_id", companyId)
          .eq("entity_type", "campminder")
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("children")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("season", season),
        supabase
          .from("children")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("season", season)
          .not("guardian_email", "is", null),
        supabase
          .from("staff")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("season", season),
        supabase
          .from("swim_program_records")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("season", season),
        supabase.from("profiles").select("id, full_name, email").eq("company_id", companyId),
      ]);

      if (companyRes.error) throw companyRes.error;
      if (syncRes.error) throw syncRes.error;

      setCompanyMeta(companyRes.data);
      setEmailConfig(emailCfgRes.data ?? null);
      setSyncJobs((syncRes.data ?? []) as SyncJobRow[]);
      setSnapshot({
        children: childrenCountRes.count ?? 0,
        childrenWithEmail: childrenEmailRes.count ?? 0,
        staff: staffCountRes.count ?? 0,
        swimRecords: swimCountRes.count ?? 0,
      });

      const profileMap = new Map<string, SenderProfile>(
        (companyProfilesRes.data ?? []).map((p) => [p.id, p as SenderProfile]),
      );
      setSenders(profileMap);

      const senderIds = [...profileMap.keys()];
      let emailQuery = supabase
        .from("email_logs")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(50);

      if (senderIds.length > 0) {
        emailQuery = emailQuery.in("sent_by", senderIds);
      }

      const emailRes = await emailQuery;
      if (emailRes.error) throw emailRes.error;
      setEmailLogs((emailRes.data ?? []) as EmailLogRow[]);
    } catch (err) {
      console.error("[OperationsDashboard]", err);
      setError(err instanceof Error ? err.message : "Failed to load operations data");
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, currentSeason]);

  useEffect(() => {
    void load();
  }, [load]);

  const emailsLast7Days = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return emailLogs.filter((e) => e.sent_at && new Date(e.sent_at).getTime() >= cutoff).length;
  }, [emailLogs]);

  const liveSyncJob = syncJobs.find(isLiveSyncJob);
  const staleSyncJob = syncJobs.find(isStaleSyncJob);
  const failedJobs = syncJobs.filter((j) => j.error_message);
  const emailCoveragePct =
    snapshot && snapshot.children > 0
      ? Math.round((snapshot.childrenWithEmail / snapshot.children) * 100)
      : 0;

  const syncHealthy = companyMeta?.campminder_sync_enabled && !liveSyncJob && !staleSyncJob && failedJobs.length === 0;
  const emailHealthy = emailConfig?.is_configured && emailConfig?.is_active;

  if (!currentCompany) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-muted-foreground">
          Select a camp from the header to view operations.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <motion.div {...fadeUp} className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-background/60 backdrop-blur">
                <Activity className="mr-1 h-3 w-3" />
                Operations Center
              </Badge>
              <Badge variant="secondary">{currentSeason} season</Badge>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{currentCompany.name}</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Self-service view of CampMinder syncs, outbound email, and roster data — no Supabase digging required.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={cn(
                  syncHealthy
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
                )}
              >
                {liveSyncJob ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Auto-sync {liveSyncJob.status}
                  </>
                ) : staleSyncJob ? (
                  <>
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Stuck sync (not running)
                  </>
                ) : companyMeta?.campminder_sync_enabled ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    CampMinder on
                  </>
                ) : (
                  <>
                    <XCircle className="mr-1 h-3 w-3" />
                    CampMinder off
                  </>
                )}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  emailHealthy
                    ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400"
                    : "border-muted bg-muted/40 text-muted-foreground",
                )}
              >
                <Mail className="mr-1 h-3 w-3" />
                {emailHealthy ? "Email ready" : "Email not configured"}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" className="bg-background/70" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button asChild className="shadow-sm">
              <Link to="/admin?tab=import">
                <Upload className="h-4 w-4 mr-2" />
                Run CampMinder Sync
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>

      {error ? (
        <motion.div {...fadeUp}>
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Could not load operations data</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      {staleSyncJob ? (
        <motion.div {...fadeUp} transition={{ delay: 0.03 }}>
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="flex gap-3 p-4 text-sm">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  You didn&apos;t start this — it&apos;s a scheduled sync that got stuck
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Nest runs CampMinder automatically at <strong>6 AM / 6 PM</strong> ET (campers),{" "}
                  <strong>7 AM / 7 PM</strong> ET (staff). A job from{" "}
                  {staleSyncJob.created_at
                    ? format(new Date(staleSyncJob.created_at), "MMM d · h:mm a")
                    : "earlier"}{" "}
                  stalled on &ldquo;{syncJobStep(staleSyncJob)}&rdquo; and is still marked running in the database.
                  It is <strong>not</strong> actively syncing right now. Server cleanup marks these failed before the
                  next scheduled run.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      {/* Metric cards */}
      <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          loading={loading}
          label="Last CampMinder sync"
          value={
            companyMeta?.campminder_last_sync_at
              ? formatRelativeTime(companyMeta.campminder_last_sync_at)
              : "Never"
          }
          hint={
            companyMeta?.campminder_last_sync_at
              ? format(new Date(companyMeta.campminder_last_sync_at), "MMM d, yyyy · h:mm a")
              : "Run a sync from Data Import"
          }
          icon={Database}
          accent="bg-violet-500/15 text-violet-600 dark:text-violet-400"
        />
        <MetricCard
          loading={loading}
          label="Outbound email"
          value={`${emailsLast7Days}`}
          hint={`${emailLogs.length} recent sends · ${emailConfig?.m365_sender_email ?? "No M365 sender"}`}
          icon={Mail}
          accent="bg-sky-500/15 text-sky-600 dark:text-sky-400"
        />
        <MetricCard
          loading={loading}
          label="Campers"
          value={snapshot ? String(snapshot.children) : "—"}
          hint={`${snapshot?.childrenWithEmail ?? 0} parent emails (${emailCoveragePct}% coverage)`}
          icon={Users}
          accent="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
        />
        <MetricCard
          loading={loading}
          label="Swim records"
          value={snapshot ? String(snapshot.swimRecords) : "—"}
          hint={`${snapshot?.staff ?? 0} staff · ${currentSeason} season`}
          icon={Waves}
          accent="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
        />
      </motion.div>

      {/* Parent email coverage bar */}
      {!loading && snapshot && snapshot.children > 0 ? (
        <motion.div {...fadeUp} transition={{ delay: 0.08 }}>
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Parent email coverage</span>
                <span className="text-muted-foreground">
                  {snapshot.childrenWithEmail} / {snapshot.children} campers
                </span>
              </div>
              <Progress value={emailCoveragePct} className="h-2" />
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      {/* Tabbed detail panels */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
        <Tabs defaultValue="sync" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-3 h-10">
            <TabsTrigger value="sync" className="gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Sync
            </TabsTrigger>
            <TabsTrigger value="emails" className="gap-1.5">
              <Inbox className="h-3.5 w-3.5" />
              Emails
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sync">
            <Card className="border-border/60 overflow-hidden">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">CampMinder sync history</CardTitle>
                    <CardDescription>Latest 25 jobs · auto-sync runs twice daily Eastern</CardDescription>
                  </div>
                  {liveSyncJob ? (
                    <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" variant="outline">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Live auto-sync
                    </Badge>
                  ) : staleSyncJob ? (
                    <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30" variant="outline">
                      Stuck job
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : syncJobs.length === 0 ? (
                  <EmptyPanel
                    icon={Database}
                    title="No sync jobs yet"
                    description="Start a CampMinder sync from Data Import. Jobs will show up here within a few seconds."
                  />
                ) : (
                  <div className="divide-y max-h-[520px] overflow-y-auto">
                    {syncJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                      >
                        <SyncStatusDot status={isStaleSyncJob(job) ? "failed" : job.status} />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {isStaleSyncJob(job) ? (
                              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300">
                                stuck
                              </Badge>
                            ) : (
                              <Badge variant={syncStatusVariant(job.status)} className="capitalize">
                                {job.status}
                              </Badge>
                            )}
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {syncJobSyncType(job)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {job.created_at ? format(new Date(job.created_at), "MMM d · h:mm a") : "—"}
                            </span>
                            <span className="text-xs text-muted-foreground">· {formatJobDuration(job)}</span>
                          </div>
                          <p className="text-sm font-medium truncate">{syncJobStep(job)}</p>
                          <p className="text-xs text-muted-foreground">{formatSyncCounts(job.total_counts)}</p>
                          {job.error_message ? (
                            <p className="text-xs text-destructive bg-destructive/5 rounded-md px-2 py-1.5 mt-1">
                              {job.error_message}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emails">
            <Card className="border-border/60 overflow-hidden">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <CardTitle className="text-lg">Email send log</CardTitle>
                <CardDescription>Recent outbound mail from this camp&apos;s staff accounts</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                ) : emailLogs.length === 0 ? (
                  <EmptyPanel
                    icon={Inbox}
                    title="No emails logged yet"
                    description="When staff send parent emails (swim progress, templates, bulk), they'll appear here."
                  />
                ) : (
                  <div className="divide-y max-h-[520px] overflow-y-auto">
                    {emailLogs.map((log) => {
                      const sender = log.sent_by ? senders.get(log.sent_by) : null;
                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                        >
                          <div
                            className={cn(
                              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                              log.status === "sent"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : log.status === "failed"
                                  ? "bg-red-500/15 text-red-600 dark:text-red-400"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Mail className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium truncate max-w-[280px] sm:max-w-md" title={log.subject}>
                                {log.subject}
                              </p>
                              <Badge variant={emailStatusVariant(log.status)} className="capitalize shrink-0">
                                {log.status ?? "unknown"}
                              </Badge>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{log.sent_at ? formatRelativeTime(log.sent_at) : "—"}</span>
                              <span>{log.recipient_count} recipient{log.recipient_count !== 1 ? "s" : ""}</span>
                              <span>{sender?.full_name ?? sender?.email ?? "System"}</span>
                            </div>
                            {log.recipient_tags?.length ? (
                              <p className="mt-1.5 text-xs text-primary/80">{formatEmailTags(log.recipient_tags)}</p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    {currentSeason} snapshot
                  </CardTitle>
                  <CardDescription>Live counts for the selected season</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Campers", value: snapshot?.children, color: "text-emerald-600 dark:text-emerald-400" },
                    { label: "Parent emails", value: snapshot?.childrenWithEmail, color: "text-sky-600 dark:text-sky-400" },
                    { label: "Staff", value: snapshot?.staff, color: "text-violet-600 dark:text-violet-400" },
                    { label: "Swim records", value: snapshot?.swimRecords, color: "text-cyan-600 dark:text-cyan-400" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border bg-gradient-to-br from-muted/30 to-transparent p-4"
                    >
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className={cn("text-3xl font-bold mt-1 tabular-nums", item.color)}>
                        {loading ? "—" : (item.value ?? 0)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Email configuration
                  </CardTitle>
                  <CardDescription>Microsoft 365 sender for this camp</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : emailConfig?.is_configured ? (
                    <>
                      <div className="flex items-center gap-2">
                        {emailConfig.is_active ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" variant="outline">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
                            Configured but inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium break-all">{emailConfig.m365_sender_email}</p>
                      {emailConfig.last_tested_at ? (
                        <p className="text-xs text-muted-foreground">
                          Last test {formatRelativeTime(emailConfig.last_tested_at)} · {emailConfig.last_test_status}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed p-5 text-center">
                      <Mail className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">Not configured</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-3">
                        Set up M365 under Admin → Email Config (super admin)
                      </p>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/admin?tab=email-config">
                          Open Email Config
                          <ArrowUpRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4 border-border/60 bg-muted/10">
              <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <span>
                  CampMinder auto-sync: campers <strong>6 AM / 6 PM</strong> ET · staff <strong>7 AM / 7 PM</strong> ET ·
                  Owl Pay <strong>8 AM / 8 PM</strong> ET
                </span>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
