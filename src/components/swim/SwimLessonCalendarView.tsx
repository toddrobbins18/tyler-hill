import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CalendarDays, Users } from "lucide-react";
import { campDateStringInSeason } from "@/lib/campSeasonDate";
import {
  loadEnrollmentWeekCalendar,
  type EnrollmentWeekCalendar,
} from "@/lib/enrollmentWeekCalendar";
import {
  resolveSwimLessonWeekCalendar,
  swimLessonWeekOptions,
} from "@/lib/swimLessonSchedule";
import { fetchSwimLessonInstructorOptions } from "@/lib/swimLessonInstructors";
import {
  SWIM_CALENDAR_TIME_COLUMNS,
  availableInstructorsForSlot,
  defaultSwimCalendarWeekNumber,
  groupLessonsBySwimSlot,
  instructorSlotStatus,
  monFriDatesForEnrollmentWeek,
  swimSlotKey,
  type SwimCalendarLesson,
} from "@/lib/swimLessonCalendar";
import { swimLessonStatusLabel } from "@/lib/swimLessonApproval";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type CalendarSubView = "slots" | "instructors";

type Props = {
  companyId: string;
  season: string;
  lessons: SwimCalendarLesson[];
};

export function SwimLessonCalendarView({ companyId, season, lessons }: Props) {
  const [weekCalendar, setWeekCalendar] = useState<EnrollmentWeekCalendar>([]);
  const [weekNumber, setWeekNumber] = useState(1);
  const [instructorOptions, setInstructorOptions] = useState<string[]>([]);
  const [subView, setSubView] = useState<CalendarSubView>("slots");

  const resolvedCalendar = useMemo(
    () => resolveSwimLessonWeekCalendar(weekCalendar, season),
    [weekCalendar, season],
  );

  const weekOptions = useMemo(() => swimLessonWeekOptions(resolvedCalendar), [resolvedCalendar]);

  useEffect(() => {
    void loadEnrollmentWeekCalendar(supabase, companyId, season).then(setWeekCalendar);
    void fetchSwimLessonInstructorOptions(supabase, companyId, season).then(setInstructorOptions);
  }, [companyId, season]);

  useEffect(() => {
    const today = campDateStringInSeason(season);
    setWeekNumber(defaultSwimCalendarWeekNumber(resolvedCalendar, today));
  }, [resolvedCalendar, season]);

  const weekDays = useMemo(
    () => monFriDatesForEnrollmentWeek(resolvedCalendar, weekNumber),
    [resolvedCalendar, weekNumber],
  );

  const slotMap = useMemo(() => groupLessonsBySwimSlot(lessons), [lessons]);

  const weekRangeLabel = weekOptions.find((w) => w.weekNumber === weekNumber)?.range ?? "";

  const shiftWeek = (delta: number) => {
    setWeekNumber((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > weekOptions.length) return weekOptions.length;
      return next;
    });
  };

  const slotColumns = SWIM_CALENDAR_TIME_COLUMNS;

  const instructorColumns = useMemo(() => {
    const cols: { dateYmd: string; timeHHmm: string; header: string }[] = [];
    for (const day of weekDays) {
      for (const time of slotColumns) {
        cols.push({
          dateYmd: day.ymd,
          timeHHmm: time.value,
          header: `${day.weekdayShort} ${time.label.replace(" ", "")}`,
        });
      }
    }
    return cols;
  }, [weekDays, slotColumns]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Lesson calendar
            </CardTitle>
            <CardDescription>
              Booked slots and which instructors are still open at 3:45 PM and 4:15 PM.
            </CardDescription>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            value={subView}
            onValueChange={(v) => v && setSubView(v as CalendarSubView)}
            className="justify-start rounded-lg border border-border bg-muted/60 p-1 shadow-sm"
          >
            <ToggleGroupItem
              value="slots"
              aria-label="By time slot"
              className="gap-1.5 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
            >
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="text-xs font-medium sm:text-sm">By day</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="instructors"
              aria-label="By instructor"
              className="gap-1.5 px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
            >
              <Users className="h-4 w-4 shrink-0" />
              <span className="text-xs font-medium sm:text-sm">By instructor</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button type="button" variant="outline" size="icon" onClick={() => shiftWeek(-1)} disabled={weekNumber <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <select
            value={weekNumber}
            onChange={(e) => setWeekNumber(Number(e.target.value))}
            className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm min-w-[140px]"
          >
            {weekOptions.map((w) => (
              <option key={w.weekNumber} value={w.weekNumber}>
                {w.label} — {w.range}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => shiftWeek(1)}
            disabled={weekNumber >= weekOptions.length}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekRangeLabel ? (
            <span className="text-xs text-muted-foreground">{weekRangeLabel}</span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {weekDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Set enrollment week dates in admin so the calendar can show Mon–Fri for this week.
          </p>
        ) : subView === "slots" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-3 text-left font-medium text-muted-foreground w-[100px]">Day</th>
                  {slotColumns.map((col) => (
                    <th key={col.value} className="py-2 px-2 text-left font-medium">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekDays.map((day) => (
                  <tr key={day.ymd} className="border-b border-border/50 align-top">
                    <td className="py-3 pr-3 font-medium">{day.label}</td>
                    {slotColumns.map((col) => {
                      const slotLessons = slotMap.get(swimSlotKey(day.ymd, col.value)) ?? [];
                      const open = availableInstructorsForSlot(instructorOptions, slotLessons);
                      return (
                        <td key={col.value} className="py-3 px-2">
                          <div className="space-y-2 min-h-[4rem]">
                            {slotLessons.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No bookings</p>
                            ) : (
                              slotLessons.map((l) => (
                                <div
                                  key={l.id}
                                  className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-xs"
                                >
                                  <div className="font-medium">{l.camperName}</div>
                                  <div className="text-muted-foreground">
                                    {l.instructor ?? "No instructor"} ·{" "}
                                    {swimLessonStatusLabel(l.status)}
                                  </div>
                                </div>
                              ))
                            )}
                            <div className="text-[11px] leading-snug">
                              <span className="text-muted-foreground">Available: </span>
                              {instructorOptions.length === 0 ? (
                                <span className="text-muted-foreground">Add instructors when scheduling</span>
                              ) : open.length === 0 ? (
                                <span className="text-amber-700 dark:text-amber-400">None — all booked</span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-400">{open.join(", ")}</span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : instructorOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No instructors yet — assign staff or type a name when booking a lesson.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 z-10 bg-card py-2 pr-3 text-left font-medium min-w-[120px]">
                    Instructor
                  </th>
                  {instructorColumns.map((col) => (
                    <th
                      key={`${col.dateYmd}-${col.timeHHmm}`}
                      className="py-2 px-1 text-center font-medium text-[10px] leading-tight max-w-[72px]"
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {instructorOptions.map((name) => (
                  <tr key={name} className="border-b border-border/50">
                    <td className="sticky left-0 z-10 bg-card py-2 pr-3 font-medium whitespace-nowrap">
                      {name}
                    </td>
                    {instructorColumns.map((col) => {
                      const status = instructorSlotStatus(
                        name,
                        col.dateYmd,
                        col.timeHHmm,
                        slotMap,
                      );
                      return (
                        <td key={`${name}-${col.dateYmd}-${col.timeHHmm}`} className="py-1 px-1 text-center">
                          {status.available ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1 py-0 h-6 font-normal border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
                              )}
                            >
                              Open
                            </Badge>
                          ) : (
                            <span
                              className="inline-block max-w-[68px] truncate text-[10px] text-muted-foreground"
                              title={status.lesson?.camperName}
                            >
                              {status.lesson?.camperName ?? "Busy"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
