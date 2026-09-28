import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { BarChart3, ClipboardList, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CAMP_TIMEZONE } from "@/lib/parentPortalCutoff";
import {
  buildAttendanceDetail,
  buildAttendanceSummary,
  buildSignInOutHistory,
  indexPunchesByDateForStaff,
  indexPunchesByStaffDate,
  listScheduledWorkDays,
  loadOwlTimeClosedDates,
  loadOwlTimeSeasonSettings,
  loadSeasonPunches,
  loadSeasonStaff,
  type OwlTimeSeasonSettings,
} from "@/lib/owlTimeAttendance";

type Props = {
  companyId: string;
  season: string;
  settingsVersion?: number;
};

function formatCampTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CAMP_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function statusBadge(status: "on_time" | "late" | "missing") {
  if (status === "on_time") {
    return <Badge className="bg-green-600">On Time</Badge>;
  }
  if (status === "late") {
    return <Badge variant="destructive">Late</Badge>;
  }
  return <Badge variant="secondary">Missing</Badge>;
}

export function OwlTimeReportsPanel({ companyId, season, settingsVersion = 0 }: Props) {
  const [settings, setSettings] = useState<OwlTimeSeasonSettings | null>(null);
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [loadedSettings, loadedClosed, loadedStaff] = await Promise.all([
      loadOwlTimeSeasonSettings(supabase, companyId, season),
      loadOwlTimeClosedDates(supabase, companyId, season),
      loadSeasonStaff(supabase, companyId, season),
    ]);

    setSettings(loadedSettings);
    setClosedDates(loadedClosed.map((d) => d.closed_date));
    setStaff(loadedStaff);
    setSelectedStaffId((prev) =>
      prev && loadedStaff.some((s) => s.id === prev) ? prev : loadedStaff[0]?.id ?? "",
    );
    setLoading(false);
  }, [companyId, season]);

  useEffect(() => {
    void refresh();
  }, [refresh, settingsVersion]);

  const scheduledDays = useMemo(() => {
    if (!settings) return [];
    return listScheduledWorkDays(settings.start_date, settings.end_date, closedDates);
  }, [settings, closedDates]);

  const [punches, setPunches] = useState<Awaited<ReturnType<typeof loadSeasonPunches>>>([]);

  useEffect(() => {
    if (!settings) return;
    void loadSeasonPunches(
      supabase,
      companyId,
      season,
      settings.start_date,
      settings.end_date,
    ).then(setPunches);
  }, [companyId, season, settings, settingsVersion]);

  const punchesByStaffDate = useMemo(() => indexPunchesByStaffDate(punches), [punches]);

  const summaryRows = useMemo(() => {
    if (!settings) return [];
    return buildAttendanceSummary(staff, scheduledDays, punchesByStaffDate, settings);
  }, [staff, scheduledDays, punchesByStaffDate, settings]);

  const selectedStaff = staff.find((s) => s.id === selectedStaffId);

  const detailRows = useMemo(() => {
    if (!settings || !selectedStaffId) return [];
    const byDate = indexPunchesByDateForStaff(punches, selectedStaffId);
    return buildAttendanceDetail(scheduledDays, byDate, settings.expected_sign_in_time);
  }, [settings, selectedStaffId, punches, scheduledDays]);

  const historyRows = useMemo(() => {
    if (!settings || !selectedStaffId) return [];
    const byDate = indexPunchesByDateForStaff(punches, selectedStaffId);
    return buildSignInOutHistory(scheduledDays, byDate, settings);
  }, [settings, selectedStaffId, punches, scheduledDays]);

  if (loading || !settings) {
    return <p className="text-sm text-muted-foreground p-4">Loading reports…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Season {season}: {format(parseISO(settings.start_date), "MMM d")} –{" "}
        {format(parseISO(settings.end_date), "MMM d, yyyy")} · {scheduledDays.length} work days ·
        on-time by {settings.expected_sign_in_time.slice(0, 5)}
      </p>

      <Tabs defaultValue="summary">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="summary" className="gap-1">
            <BarChart3 className="h-4 w-4" /> Summary
          </TabsTrigger>
          <TabsTrigger value="detail" className="gap-1">
            <ClipboardList className="h-4 w-4" /> Detail
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <History className="h-4 w-4" /> Sign-In/Out
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Summary</CardTitle>
              <CardDescription>All active staff for {season}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead className="text-right">Scheduled</TableHead>
                    <TableHead className="text-right">Signed In</TableHead>
                    <TableHead className="text-right">Missing</TableHead>
                    <TableHead className="text-right">Late</TableHead>
                    <TableHead className="text-right">On Time</TableHead>
                    <TableHead className="text-right">Attendance %</TableHead>
                    <TableHead className="text-right">Min Late</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-muted-foreground">
                        No staff in roster for this season.
                      </TableCell>
                    </TableRow>
                  ) : (
                    summaryRows.map((row) => (
                      <TableRow key={row.staffId}>
                        <TableCell className="font-medium">{row.staffName}</TableCell>
                        <TableCell className="text-right">{row.scheduledDays}</TableCell>
                        <TableCell className="text-right">{row.daysSignedIn}</TableCell>
                        <TableCell className="text-right">{row.daysMissing}</TableCell>
                        <TableCell className="text-right">{row.daysLate}</TableCell>
                        <TableCell className="text-right">{row.daysOnTime}</TableCell>
                        <TableCell className="text-right">{row.attendancePct}%</TableCell>
                        <TableCell className="text-right">{row.totalMinutesLate}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detail" className="mt-4 space-y-4">
          <div className="max-w-xs">
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Attendance Detail</CardTitle>
              <CardDescription>{selectedStaff?.name ?? "Staff"} — each camp day</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Sign-in</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailRows.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{format(parseISO(row.date), "EEE, MMM d")}</TableCell>
                      <TableCell>
                        {row.signedInAt ? formatCampTime(row.signedInAt) : "—"}
                      </TableCell>
                      <TableCell>
                        {statusBadge(row.status)}
                        {row.status === "late" && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            +{row.minutesLate} min
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          <div className="max-w-xs">
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Sign-In/Out History</CardTitle>
              <CardDescription>{selectedStaff?.name ?? "Staff"} — days with punches</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Sign-in</TableHead>
                    <TableHead>Sign-out</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead>Late?</TableHead>
                    <TableHead>Early?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        No sign-ins recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historyRows.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell>{format(parseISO(row.date), "EEE, MMM d")}</TableCell>
                        <TableCell>
                          {row.signedInAt ? formatCampTime(row.signedInAt) : "—"}
                        </TableCell>
                        <TableCell>
                          {row.signedOutAt ? formatCampTime(row.signedOutAt) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.totalHours != null ? row.totalHours.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell>{row.isLate ? `Yes (+${row.minutesLate}m)` : "No"}</TableCell>
                        <TableCell>{row.isEarlyDeparture ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
