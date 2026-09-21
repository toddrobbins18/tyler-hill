import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ClipboardList, Printer, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { campTodayDateString } from "@/lib/parentPortalCutoff";
import { DAY_CAMP_ENROLLMENT_WEEKS } from "@/lib/enrolledWeeks";
import {
  buildMonFriEnrollmentWeeks,
  enrollmentWeekForDate,
  formatEnrollmentWeekLabel,
  formatEnrollmentWeekRange,
  mergeEnrollmentWeekCalendars,
  resolveEnrollmentWeekRow,
  groupRosterByTeam,
  isEnrollmentWeekCalendarComplete,
  loadEnrollmentWeekCalendar,
  saveEnrollmentWeekCalendar,
  type EnrollmentWeekCalendar,
  type EnrollmentWeekRow,
} from "@/lib/enrollmentWeekCalendar";
import { loadGroupRoster, type GroupRosterCamper } from "@/lib/transportGroupAttendance";
import { buildGroupBubbleSheetPdf } from "@/lib/transportBubbleSheetPdf";
import { TransportReportPreviewDialog, type TransportReportPreview } from "@/components/TransportReportPreviewDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const ALL_GROUPS = "__all__";

function emptyCalendarDraft(): EnrollmentWeekCalendar {
  return Array.from({ length: DAY_CAMP_ENROLLMENT_WEEKS }, (_, i) => ({
    weekNumber: i + 1,
    startDate: "",
    endDate: "",
  }));
}

function mergeCalendarDraft(existing: EnrollmentWeekCalendar): EnrollmentWeekCalendar {
  const draft = emptyCalendarDraft();
  for (const row of existing) {
    const idx = row.weekNumber - 1;
    if (idx >= 0 && idx < draft.length) draft[idx] = row;
  }
  return draft;
}

export default function GroupBubbleSheets() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeason();
  const companyId = currentCompany?.id;

  const [calendar, setCalendar] = useState<EnrollmentWeekCalendar>([]);
  const [calendarDraft, setCalendarDraft] = useState<EnrollmentWeekCalendar>(emptyCalendarDraft());
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [week1Start, setWeek1Start] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedGroup, setSelectedGroup] = useState(ALL_GROUPS);
  const [roster, setRoster] = useState<GroupRosterCamper[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [reportPreview, setReportPreview] = useState<TransportReportPreview | null>(null);

  const loadCalendar = useCallback(async () => {
    if (!companyId) return;
    setCalendarLoading(true);
    try {
      const loaded = await loadEnrollmentWeekCalendar(supabase, companyId, currentSeason);
      setCalendar(loaded);
      setCalendarDraft(mergeCalendarDraft(loaded));
      const today = campTodayDateString();
      const currentWeek = enrollmentWeekForDate(loaded, today);
      if (currentWeek != null) setSelectedWeek(currentWeek);
    } catch (err) {
      console.error("[GroupBubbleSheets] calendar load error:", err);
      toast({ title: "Failed to load enrollment week calendar", variant: "destructive" });
    } finally {
      setCalendarLoading(false);
    }
  }, [companyId, currentSeason, toast]);

  const loadRoster = useCallback(async () => {
    if (!companyId) return;
    setRosterLoading(true);
    try {
      const loaded = await loadGroupRoster(supabase, companyId, currentSeason, {
        enrollmentWeek: selectedWeek,
      });
      setRoster(loaded);
    } catch (err) {
      console.error("[GroupBubbleSheets] roster load error:", err);
      toast({ title: "Failed to load group roster", variant: "destructive" });
    } finally {
      setRosterLoading(false);
    }
  }, [companyId, currentSeason, selectedWeek, toast]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const rosterByGroup = useMemo(() => groupRosterByTeam(roster), [roster]);
  const groupNames = useMemo(() => rosterByGroup.map(([name]) => name), [rosterByGroup]);

  const displayCalendar = useMemo(
    () => mergeEnrollmentWeekCalendars(calendar, calendarDraft),
    [calendar, calendarDraft],
  );

  const selectedWeekDates = useMemo(
    () => resolveEnrollmentWeekRow(calendar, calendarDraft, selectedWeek),
    [calendar, calendarDraft, selectedWeek],
  );

  const handleCalendarRowChange = (weekNumber: number, field: keyof Pick<EnrollmentWeekRow, "startDate" | "endDate">, value: string) => {
    setCalendarDraft((prev) =>
      prev.map((row) => (row.weekNumber === weekNumber ? { ...row, [field]: value } : row)),
    );
  };

  const handleAutoFillWeeks = () => {
    if (!week1Start) {
      toast({ title: "Enter Week 1 start date", variant: "destructive" });
      return;
    }
    setCalendarDraft(buildMonFriEnrollmentWeeks(week1Start));
  };

  const handleSaveCalendar = async () => {
    if (!companyId) return;
    const valid = calendarDraft.filter((row) => row.startDate && row.endDate);
    if (!valid.length) {
      toast({ title: "Add at least one week with start and end dates", variant: "destructive" });
      return;
    }
    for (const row of valid) {
      if (row.endDate < row.startDate) {
        toast({
          title: `Week ${row.weekNumber} end date must be on or after start date`,
          variant: "destructive",
        });
        return;
      }
    }
    setCalendarSaving(true);
    const ok = await saveEnrollmentWeekCalendar(supabase, companyId, currentSeason, valid);
    setCalendarSaving(false);
    if (!ok) {
      toast({ title: "Could not save calendar", variant: "destructive" });
      return;
    }
    toast({ title: "Enrollment week calendar saved" });
    void loadCalendar();
  };

  const handlePrint = () => {
    const groupsSource =
      selectedGroup === ALL_GROUPS
        ? rosterByGroup
        : rosterByGroup.filter(([name]) => name === selectedGroup);

    const groups = groupsSource.map(([groupName, campers]) => ({
      groupName,
      campers: campers.map((c) => ({ name: c.name, detail: groupName })),
    }));

    const built = buildGroupBubbleSheetPdf({
      companyName: currentCompany?.name ?? "Day Camp",
      enrollmentWeek: selectedWeek,
      weekDateRange: selectedWeekDates.row
        ? formatEnrollmentWeekRange(selectedWeekDates.row)
        : undefined,
      groups,
    });

    if (!built) {
      toast({ title: "No campers to print for this week", variant: "destructive" });
      return;
    }

    setReportPreview({
      open: true,
      title: "Group Attendance Bubble Sheet",
      description: formatEnrollmentWeekLabel(selectedWeek, displayCalendar),
      kind: "pdf",
      blob: built.blob,
      filename: built.filename,
    });
  };

  const calendarReady = isEnrollmentWeekCalendarComplete(calendar);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="page-header flex items-center gap-2">
          <Users className="h-6 w-6" /> Group Bubble Sheets
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Print team attendance sheets filtered by enrollment week — only campers enrolled that week appear.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Enrollment Week Calendar
          </CardTitle>
          <CardDescription>
            Map enrollment weeks 1–8 to camp dates for season {currentSeason}. Required before printing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {calendarLoading ? (
            <p className="text-sm text-muted-foreground">Loading calendar…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label htmlFor="week1-start">Week 1 start (auto-fill Mon–Fri blocks)</Label>
                  <Input
                    id="week1-start"
                    type="date"
                    value={week1Start}
                    onChange={(e) => setWeek1Start(e.target.value)}
                    className="w-auto mt-1"
                  />
                </div>
                <Button type="button" variant="outline" onClick={handleAutoFillWeeks}>
                  Auto-fill 8 weeks
                </Button>
                <Button type="button" onClick={() => void handleSaveCalendar()} disabled={calendarSaving}>
                  {calendarSaving ? "Saving…" : "Save calendar"}
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {calendarDraft.map((row) => (
                  <div key={row.weekNumber} className="rounded-md border p-3 space-y-2">
                    <div className="font-medium text-sm">Week {row.weekNumber}</div>
                    <div>
                      <Label className="text-xs">Start</Label>
                      <Input
                        type="date"
                        value={row.startDate}
                        onChange={(e) => handleCalendarRowChange(row.weekNumber, "startDate", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">End</Label>
                      <Input
                        type="date"
                        value={row.endDate}
                        onChange={(e) => handleCalendarRowChange(row.weekNumber, "endDate", e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {calendarReady ? (
                <Badge variant="outline" className="border-emerald-500 text-emerald-700">
                  Calendar configured for this season
                </Badge>
              ) : (
                <p className="text-sm text-amber-700">
                  Configure all 8 weeks (or save partial calendar) before printing filtered rosters.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Print bubble sheets
          </CardTitle>
          <CardDescription>
            One section per team — same P/A bubble layout as bus attendance sheets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label>Enrollment week</Label>
              <Select
                value={String(selectedWeek)}
                onValueChange={(v) => setSelectedWeek(parseInt(v, 10))}
              >
                <SelectTrigger className="w-[220px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: DAY_CAMP_ENROLLMENT_WEEKS }, (_, i) => i + 1).map((week) => (
                    <SelectItem key={week} value={String(week)}>
                      {formatEnrollmentWeekLabel(week, displayCalendar)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Team / group</Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="w-[220px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_GROUPS}>All teams</SelectItem>
                  {groupNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handlePrint} disabled={rosterLoading || !roster.length}>
              <Printer className="mr-2 h-4 w-4" />
              Print bubble sheet
            </Button>
          </div>

          {selectedWeekDates.row ? (
            <p className="text-sm text-muted-foreground">
              Week {selectedWeek}: {formatEnrollmentWeekRange(selectedWeekDates.row)} · {roster.length} campers
              enrolled
              {selectedWeekDates.source === "draft" ? (
                <span className="text-amber-700">
                  {" "}
                  · dates entered above but not saved — click Save calendar to keep them
                </span>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-amber-700">
              No dates set for Week {selectedWeek} — add dates above and save, or roster will filter by CampMinder
              enrollment weeks only.
            </p>
          )}

          {rosterLoading ? (
            <p className="text-sm text-muted-foreground">Loading roster…</p>
          ) : !roster.length ? (
            <p className="text-sm text-muted-foreground">No campers enrolled for this week.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rosterByGroup.map(([groupName, campers]) => (
                <div key={groupName} className="rounded-md border p-3">
                  <p className="font-medium">{groupName}</p>
                  <p className="text-xs text-muted-foreground">{campers.length} campers</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TransportReportPreviewDialog
        preview={reportPreview}
        onOpenChange={(open) => setReportPreview((prev) => (prev ? { ...prev, open } : null))}
      />
    </motion.div>
  );
}
