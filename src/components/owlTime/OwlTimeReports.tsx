import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { BarChart3, ClipboardList, Download, Filter, History, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  buildAttendanceDetail,
  buildAttendanceSummary,
  buildDailyRollCall,
  buildSignInOutHistory,
  exportDailyRollCallCsv,
  exportDetailCsv,
  exportHistoryCsv,
  exportSummaryCsv,
  formatOwlTimeCampClock,
  indexPunchesByDateForStaff,
  indexPunchesByStaffDate,
  listScheduledWorkDays,
  loadOwlTimeClosedDates,
  loadOwlTimeSeasonSettings,
  loadSeasonPunches,
  loadSeasonStaff,
  resolveReportDays,
  type DayAttendanceStatus,
  type OwlTimeReportDateMode,
  type OwlTimeSeasonSettings,
} from "@/lib/owlTimeAttendance";

type Props = {
  companyId: string;
  season: string;
  settingsVersion?: number;
};

type StatusFilter = "all" | DayAttendanceStatus;

function statusBadge(status: DayAttendanceStatus) {
  if (status === "on_time") {
    return <Badge className="bg-green-600">On Time</Badge>;
  }
  if (status === "late") {
    return <Badge variant="destructive">Late</Badge>;
  }
  return <Badge variant="secondary">Missing</Badge>;
}

function dateLabelForExport(mode: OwlTimeReportDateMode, rangeFrom: string, rangeTo: string, singleDay: string): string {
  if (mode === "day") return singleDay;
  if (mode === "range") return `${rangeFrom}_to_${rangeTo}`;
  return "full-season";
}

export function OwlTimeReportsPanel({ companyId, season, settingsVersion = 0 }: Props) {
  const [settings, setSettings] = useState<OwlTimeSeasonSettings | null>(null);
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [dateMode, setDateMode] = useState<OwlTimeReportDateMode>("season");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [singleDay, setSingleDay] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [summaryStaffFilter, setSummaryStaffFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("summary");

  useEffect(() => {
    if (dateMode === "day") {
      setActiveTab("daily");
    } else if (activeTab === "daily") {
      setActiveTab("summary");
    }
  }, [dateMode, activeTab]);

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
    setRangeFrom(loadedSettings.start_date);
    setRangeTo(loadedSettings.end_date);
    setSingleDay(loadedSettings.start_date);
    setLoading(false);
  }, [companyId, season]);

  useEffect(() => {
    void refresh();
  }, [refresh, settingsVersion]);

  const allScheduledDays = useMemo(() => {
    if (!settings) return [];
    return listScheduledWorkDays(settings.start_date, settings.end_date, closedDates);
  }, [settings, closedDates]);

  const filteredDays = useMemo(
    () => resolveReportDays(allScheduledDays, dateMode, rangeFrom, rangeTo, singleDay),
    [allScheduledDays, dateMode, rangeFrom, rangeTo, singleDay],
  );

  const exportDateLabel = dateLabelForExport(dateMode, rangeFrom, rangeTo, singleDay);

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
    const rows = buildAttendanceSummary(staff, filteredDays, punchesByStaffDate, settings);
    if (summaryStaffFilter === "all") return rows;
    return rows.filter((row) => row.staffId === summaryStaffFilter);
  }, [staff, filteredDays, punchesByStaffDate, settings, summaryStaffFilter]);

  const dailyRollCallRows = useMemo(() => {
    if (!settings || dateMode !== "day" || !singleDay) return [];
    return buildDailyRollCall(staff, singleDay, punchesByStaffDate, settings.expected_sign_in_time);
  }, [staff, dateMode, singleDay, punchesByStaffDate, settings]);

  const filteredDailyRollCallRows = useMemo(() => {
    if (statusFilter === "all") return dailyRollCallRows;
    return dailyRollCallRows.filter((row) => row.status === statusFilter);
  }, [dailyRollCallRows, statusFilter]);

  const selectedStaff = staff.find((s) => s.id === selectedStaffId);

  const detailRows = useMemo(() => {
    if (!settings || !selectedStaffId) return [];
    const byDate = indexPunchesByDateForStaff(punches, selectedStaffId);
    return buildAttendanceDetail(filteredDays, byDate, settings.expected_sign_in_time);
  }, [settings, selectedStaffId, punches, filteredDays]);

  const filteredDetailRows = useMemo(() => {
    if (statusFilter === "all") return detailRows;
    return detailRows.filter((row) => row.status === statusFilter);
  }, [detailRows, statusFilter]);

  const historyRows = useMemo(() => {
    if (!settings || !selectedStaffId) return [];
    const byDate = indexPunchesByDateForStaff(punches, selectedStaffId);
    return buildSignInOutHistory(filteredDays, byDate, settings);
  }, [settings, selectedStaffId, punches, filteredDays]);

  const filterDescription = useMemo(() => {
    if (dateMode === "season") return "Full season";
    if (dateMode === "day" && singleDay) {
      return format(parseISO(singleDay), "EEEE, MMM d, yyyy");
    }
    if (rangeFrom && rangeTo) {
      return `${format(parseISO(rangeFrom), "MMM d")} – ${format(parseISO(rangeTo), "MMM d, yyyy")}`;
    }
    return "Custom range";
  }, [dateMode, singleDay, rangeFrom, rangeTo]);

  if (loading || !settings) {
    return <p className="text-sm text-muted-foreground p-4">Loading reports…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Season {season}: {format(parseISO(settings.start_date), "MMM d")} –{" "}
        {format(parseISO(settings.end_date), "MMM d, yyyy")} · {allScheduledDays.length} work days ·
        on-time by {settings.expected_sign_in_time.slice(0, 5)}
      </p>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
          <CardDescription>
            Showing {filteredDays.length} work day{filteredDays.length !== 1 ? "s" : ""} · {filterDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="owl-date-mode">Date filter</Label>
            <Select value={dateMode} onValueChange={(v) => setDateMode(v as OwlTimeReportDateMode)}>
              <SelectTrigger id="owl-date-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="season">Full season</SelectItem>
                <SelectItem value="range">Date range</SelectItem>
                <SelectItem value="day">Single day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dateMode === "range" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="owl-from">From</Label>
                <Input
                  id="owl-from"
                  type="date"
                  min={settings.start_date}
                  max={settings.end_date}
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owl-to">To</Label>
                <Input
                  id="owl-to"
                  type="date"
                  min={settings.start_date}
                  max={settings.end_date}
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                />
              </div>
            </>
          )}

          {dateMode === "day" && (
            <div className="space-y-2">
              <Label htmlFor="owl-day">Day</Label>
              <Input
                id="owl-day"
                type="date"
                min={settings.start_date}
                max={settings.end_date}
                value={singleDay}
                onChange={(e) => setSingleDay(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="owl-status">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger id="owl-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="on_time">On time only</SelectItem>
                <SelectItem value="late">Late only</SelectItem>
                <SelectItem value="missing">Missing only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          {dateMode === "day" && (
            <TabsTrigger value="daily" className="gap-1">
              <Users className="h-4 w-4" /> By Day
            </TabsTrigger>
          )}
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

        {dateMode === "day" && (
          <TabsContent value="daily" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Daily Roll Call</CardTitle>
                  <CardDescription>
                    All staff for {filterDescription}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filteredDailyRollCallRows.length === 0}
                  onClick={() => exportDailyRollCallCsv(filteredDailyRollCallRows, season, singleDay)}
                >
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Sign-in</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDailyRollCallRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground">
                          {allScheduledDays.includes(singleDay)
                            ? "No staff match this filter."
                            : "Selected date is not a scheduled work day."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDailyRollCallRows.map((row) => (
                        <TableRow key={row.staffId}>
                          <TableCell className="font-medium">{row.staffName}</TableCell>
                          <TableCell>
                            {row.signedInAt ? formatOwlTimeCampClock(row.signedInAt) : "—"}
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
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="summary" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="max-w-xs flex-1">
              <Label htmlFor="owl-summary-staff" className="mb-2 block">Staff</Label>
              <Select value={summaryStaffFilter} onValueChange={setSummaryStaffFilter}>
                <SelectTrigger id="owl-summary-staff">
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Attendance Summary</CardTitle>
                <CardDescription>{filterDescription} · {season}</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={summaryRows.length === 0}
                onClick={() => exportSummaryCsv(summaryRows, season, exportDateLabel)}
              >
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
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
            <Label htmlFor="owl-detail-staff" className="mb-2 block">Staff</Label>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger id="owl-detail-staff">
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
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Attendance Detail</CardTitle>
                <CardDescription>
                  {selectedStaff?.name ?? "Staff"} · {filterDescription}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={filteredDetailRows.length === 0}
                onClick={() =>
                  exportDetailCsv(
                    filteredDetailRows,
                    selectedStaff?.name ?? "Staff",
                    season,
                    exportDateLabel,
                  )
                }
              >
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
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
                  {filteredDetailRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        No days match this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDetailRows.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell>{format(parseISO(row.date), "EEE, MMM d")}</TableCell>
                        <TableCell>
                          {row.signedInAt ? formatOwlTimeCampClock(row.signedInAt) : "—"}
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
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          <div className="max-w-xs">
            <Label htmlFor="owl-history-staff" className="mb-2 block">Staff</Label>
            <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
              <SelectTrigger id="owl-history-staff">
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
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Sign-In/Out History</CardTitle>
                <CardDescription>
                  {selectedStaff?.name ?? "Staff"} · {filterDescription}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={historyRows.length === 0}
                onClick={() =>
                  exportHistoryCsv(
                    historyRows,
                    selectedStaff?.name ?? "Staff",
                    season,
                    exportDateLabel,
                  )
                }
              >
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
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
                        No sign-ins recorded for this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historyRows.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell>{format(parseISO(row.date), "EEE, MMM d")}</TableCell>
                        <TableCell>
                          {row.signedInAt ? formatOwlTimeCampClock(row.signedInAt) : "—"}
                        </TableCell>
                        <TableCell>
                          {row.signedOutAt ? formatOwlTimeCampClock(row.signedOutAt) : "—"}
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
