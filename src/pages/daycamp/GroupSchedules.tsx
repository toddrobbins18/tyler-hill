import { useEffect, useMemo, useState } from "react";
import { CalendarClock, MapPin, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useCampOperationalDate } from "@/hooks/useCampOperationalDate";
import {
  campWeekForScheduleLookup,
  loadEnrollmentWeekCalendar,
  type EnrollmentWeekCalendar,
} from "@/lib/enrollmentWeekCalendar";
import { campTimeHHmmFromIso } from "@/lib/campTime";
import { campProgramStartDate } from "@/lib/medicationStartDate";
import {
  SCHEDULE_DAY_LABELS,
  activeScheduleRotationWeek,
  areaLabel,
  campWeekNumber,
  dayOfWeekFromYmd,
  formatMinutes12,
  groupScheduleSlotFromRow,
  minutesToPgTime,
  hhmmToMinutes,
  sameScheduleLabel,
  scheduleAreaOptions,
  scheduleGroupName,
  scheduleLocationForSave,
  slotMatchesArea,
  slotsAtTime,
  weeklyScheduleTemplateCsv,
  type GroupScheduleDraft,
  type GroupScheduleSlot,
} from "@/lib/groupSchedule";
import { readScheduleFile, scanGroupScheduleSheets } from "@/lib/groupScheduleScan";
import { loadGroupRoster, type GroupRosterCamper } from "@/lib/transportGroupAttendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ALL = "all";

type UploadRow = {
  id: string;
  file_name: string;
  applies_on: string | null;
  created_at: string;
};

const SCHEDULE_SLOT_PAGE = 1000;

function periodLabel(slot: GroupScheduleDraft): string {
  return `${formatMinutes12(slot.startMinutes)}–${formatMinutes12(slot.endMinutes)}`;
}

function dayLabel(slot: GroupScheduleDraft): string {
  const day = slot.appliesOn
    ? slot.appliesOn
    : slot.dayOfWeek == null
      ? "—"
      : (SCHEDULE_DAY_LABELS[slot.dayOfWeek] ?? "—");
  if (slot.rotationWeek === 1 || slot.rotationWeek === 2) return `${day} · Week ${slot.rotationWeek}`;
  return day;
}

export default function GroupSchedules() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeason();
  const { operationalDateString } = useCampOperationalDate();
  const companyId = currentCompany?.id;

  const [lookupDate, setLookupDate] = useState(operationalDateString);
  const [lookupTime, setLookupTime] = useState(() => campTimeHHmmFromIso(new Date().toISOString()));
  const [groupFilter, setGroupFilter] = useState(ALL);
  const [areaFilter, setAreaFilter] = useState(ALL);
  const [slots, setSlots] = useState<GroupScheduleSlot[]>([]);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<GroupRosterCamper[]>([]);
  const [calendar, setCalendar] = useState<EnrollmentWeekCalendar>([]);

  const [preview, setPreview] = useState<GroupScheduleDraft[]>([]);
  const [previewName, setPreviewName] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overrideDate, setOverrideDate] = useState("");

  useEffect(() => {
    setLookupDate(operationalDateString);
  }, [operationalDateString]);

  useEffect(() => {
    if (!companyId) return;
    void loadEnrollmentWeekCalendar(supabase, companyId, currentSeason).then(setCalendar);
  }, [companyId, currentSeason]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const campWeek = campWeekForScheduleLookup(
      calendar,
      lookupDate,
      campProgramStartDate(currentSeason),
      campWeekNumber,
    );
    void loadGroupRoster(supabase, companyId, currentSeason, {
      enrollmentWeek: campWeek ?? undefined,
    }).then((rows) => {
      if (!cancelled) setRoster(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, currentSeason, calendar, lookupDate]);

  const loadSchedules = async () => {
    if (!companyId) return;
    setLoading(true);
    const slotSelect =
      "id, upload_id, group_name, day_of_week, applies_on, start_time, end_time, activity, location";
    const uploadRes = await supabase
      .from("group_schedule_uploads")
      .select("id, file_name, applies_on, created_at")
      .eq("company_id", companyId)
      .eq("season", currentSeason)
      .order("created_at", { ascending: false });

    const loaded: GroupScheduleSlot[] = [];
    if (!uploadRes.error) {
      for (let offset = 0; ; offset += SCHEDULE_SLOT_PAGE) {
        const slotRes = await supabase
          .from("group_schedule_slots")
          .select(slotSelect)
          .eq("company_id", companyId)
          .eq("season", currentSeason)
          .order("id")
          .range(offset, offset + SCHEDULE_SLOT_PAGE - 1);
        if (slotRes.error) {
          console.error(slotRes.error);
          toast.error("Could not load schedules. Apply the schedules database migration if this is a new install.");
          setSlots([]);
          setUploads([]);
          setLoading(false);
          return;
        }
        const page = slotRes.data ?? [];
        loaded.push(...page.map(groupScheduleSlotFromRow));
        if (page.length < SCHEDULE_SLOT_PAGE) break;
      }
    }

    if (uploadRes.error) {
      console.error(uploadRes.error);
      toast.error("Could not load schedules. Apply the schedules database migration if this is a new install.");
      setSlots([]);
      setUploads([]);
    } else {
      setSlots(loaded);
      setUploads(uploadRes.data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadSchedules();
  }, [companyId, currentSeason]);

  const minutes = hhmmToMinutes(lookupTime) ?? 0;
  const campWeek = useMemo(
    () =>
      lookupDate
        ? campWeekForScheduleLookup(
            calendar,
            lookupDate,
            campProgramStartDate(currentSeason),
            campWeekNumber,
          )
        : null,
    [calendar, lookupDate, currentSeason],
  );
  const rotationWeek = useMemo(
    () => activeScheduleRotationWeek(slots, campWeek),
    [slots, campWeek],
  );
  const atTime = useMemo(
    () => (lookupDate ? slotsAtTime(slots, lookupDate, minutes, rotationWeek) : []),
    [slots, lookupDate, minutes, rotationWeek],
  );
  const visible = useMemo(
    () =>
      atTime.filter((slot) => {
        if (groupFilter !== ALL && !sameScheduleLabel(slot.groupName, groupFilter)) return false;
        if (areaFilter !== ALL && !slotMatchesArea(slot, areaFilter)) return false;
        return true;
      }),
    [atTime, groupFilter, areaFilter],
  );

  const campersByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const camper of roster) {
      const key = scheduleGroupName(camper.groupName).toLowerCase();
      const names = map.get(key) ?? [];
      names.push(camper.name);
      map.set(key, names);
    }
    for (const names of map.values()) names.sort((a, b) => a.localeCompare(b));
    return map;
  }, [roster]);

  const groupOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const slot of slots) {
      const name = scheduleGroupName(slot.groupName);
      names.set(name.toLowerCase(), name);
    }
    for (const camper of roster) {
      if (camper.groupName === "Unassigned") continue;
      const name = scheduleGroupName(camper.groupName);
      names.set(name.toLowerCase(), name);
    }
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }, [slots, roster]);

  const areaOptions = useMemo(() => scheduleAreaOptions(slots), [slots]);
  const lookupDay = lookupDate ? SCHEDULE_DAY_LABELS[dayOfWeekFromYmd(lookupDate)] : "";

  const previewDays = useMemo(() => new Set(preview.map((slot) => slot.dayOfWeek)), [preview]);
  const canUseOneDay =
    preview.length > 0 && preview.every((slot) => !slot.appliesOn) && previewDays.size === 1;

  const onFile = async (file: File | null) => {
    if (!file) return;
    setScanning(true);
    setOverrideDate("");
    try {
      const sheets = await readScheduleFile(file);
      const scanned = scanGroupScheduleSheets(sheets);
      setPreview(scanned.slots);
      setWarnings(scanned.warnings);
      setPreviewName(file.name);
      if (scanned.slots.length === 0) {
        toast.error("No periods were found in that file.");
      } else {
        toast.success(`Scanned ${scanned.slots.length} periods from ${file.name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not read that file.";
      toast.error(message);
    } finally {
      setScanning(false);
    }
  };

  const savePreview = async () => {
    if (!companyId || preview.length === 0) return;
    let rows = preview;
    if (overrideDate) {
      if (!canUseOneDay) {
        toast.error("A one-day change only works when the file is a single weekday.");
        return;
      }
      const day = dayOfWeekFromYmd(overrideDate);
      rows = preview.map((slot) => ({ ...slot, appliesOn: overrideDate, dayOfWeek: day }));
    }

    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const weekly = rows.filter((slot) => !slot.appliesOn);
      const byDate = new Map<string, GroupScheduleDraft[]>();
      for (const slot of rows) {
        if (!slot.appliesOn) continue;
        const list = byDate.get(slot.appliesOn) ?? [];
        list.push(slot);
        byDate.set(slot.appliesOn, list);
      }

      if (weekly.length > 0) {
        const { error } = await supabase
          .from("group_schedule_uploads")
          .delete()
          .eq("company_id", companyId)
          .eq("season", currentSeason)
          .is("applies_on", null);
        if (error) throw error;
      }
      for (const date of byDate.keys()) {
        const { error } = await supabase
          .from("group_schedule_uploads")
          .delete()
          .eq("company_id", companyId)
          .eq("season", currentSeason)
          .eq("applies_on", date);
        if (error) throw error;
      }

      const batches: { appliesOn: string | null; rows: GroupScheduleDraft[] }[] = [];
      if (weekly.length > 0) batches.push({ appliesOn: null, rows: weekly });
      for (const [date, datedRows] of byDate) batches.push({ appliesOn: date, rows: datedRows });

      for (const batch of batches) {
        const { data: upload, error: uploadError } = await supabase
          .from("group_schedule_uploads")
          .insert({
            company_id: companyId,
            season: currentSeason,
            file_name: previewName || "Schedule",
            applies_on: batch.appliesOn,
            created_by: userRes.user?.id ?? null,
          })
          .select("id")
          .single();
        if (uploadError || !upload) throw uploadError ?? new Error("Upload was not saved");

        try {
          for (let index = 0; index < batch.rows.length; index += 400) {
            const chunk = batch.rows.slice(index, index + 400).map((slot) => ({
              upload_id: upload.id,
              company_id: companyId,
              season: currentSeason,
              group_name: slot.groupName,
              day_of_week: slot.dayOfWeek,
              applies_on: slot.appliesOn,
              start_time: minutesToPgTime(slot.startMinutes),
              end_time: minutesToPgTime(slot.endMinutes),
              activity: slot.activity,
              location: scheduleLocationForSave(slot),
            }));
            const { error: slotError } = await supabase.from("group_schedule_slots").insert(chunk);
            if (slotError) throw slotError;
          }
        } catch (slotError) {
          await supabase.from("group_schedule_uploads").delete().eq("id", upload.id);
          throw slotError;
        }
      }

      toast.success("Schedule saved");
      setPreview([]);
      setWarnings([]);
      setPreviewName("");
      setOverrideDate("");
      await loadSchedules();
    } catch (error) {
      console.error(error);
      toast.error("Could not save the schedule");
    } finally {
      setSaving(false);
    }
  };

  const deleteUpload = async (upload: UploadRow) => {
    const label = upload.applies_on ? `the ${upload.applies_on} schedule` : "the weekly schedule";
    if (!confirm(`Delete ${label} from ${upload.file_name}?`)) return;
    const { error } = await supabase.from("group_schedule_uploads").delete().eq("id", upload.id);
    if (error) {
      toast.error("Could not delete that schedule");
      return;
    }
    toast.success("Schedule deleted");
    await loadSchedules();
  };

  const downloadTemplate = () => {
    const blob = new Blob([weeklyScheduleTemplateCsv()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "group-schedule-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const focusedGroup = groupFilter !== ALL ? visible[0] : null;
  const lookupIsBroad = groupFilter === ALL && areaFilter === ALL;
  const showCamperNames = !lookupIsBroad;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header flex items-center gap-2">
          <CalendarClock className="h-6 w-6" /> Schedules
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a group schedule spreadsheet. Pick a time to see where a group is, or who is at an activity area.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Where is everyone?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="schedule-date" className="text-xs text-muted-foreground">
                Date
              </Label>
              <Input
                id="schedule-date"
                type="date"
                value={lookupDate}
                onChange={(event) => setLookupDate(event.target.value)}
                className="h-8 w-[150px] text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="schedule-time" className="text-xs text-muted-foreground">
                Time
              </Label>
              <Input
                id="schedule-time"
                type="time"
                value={lookupTime}
                onChange={(event) => setLookupTime(event.target.value)}
                className="h-8 w-[120px] text-xs"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setLookupDate(operationalDateString);
                setLookupTime(campTimeHHmmFromIso(new Date().toISOString()));
              }}
            >
              Now
            </Button>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Group</Label>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All groups</SelectItem>
                  {groupOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Activity area</Label>
              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="All areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All areas</SelectItem>
                  {areaOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lookupDay ? <Badge variant="outline">{lookupDay}</Badge> : null}
            {campWeek ? (
              <Badge variant="outline">
                Camp week {campWeek}
                {rotationWeek ? ` · schedule week ${rotationWeek}` : ""}
              </Badge>
            ) : null}
            {loading ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
          </div>

          {slots.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              No schedule is saved for this season yet. Upload one below.
            </p>
          ) : null}

          {groupFilter !== ALL ? (
            <p className="text-sm">
              <span className="font-medium">{groupFilter}</span>{" "}
              {visible.length === 1 && focusedGroup ? (
                <>
                  is at <span className="font-medium">{areaLabel(focusedGroup)}</span>
                  {focusedGroup.location && focusedGroup.activity !== focusedGroup.location
                    ? ` for ${focusedGroup.activity}`
                    : ""}{" "}
                  ({periodLabel(focusedGroup)}
                  {rotationWeek ? `, schedule week ${rotationWeek}` : ""}).
                </>
              ) : visible.length === 0 ? (
                <>has nothing scheduled at this time.</>
              ) : (
                <>has {visible.length} activities at this time.</>
              )}
            </p>
          ) : null}

          {visible.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {visible.length} {visible.length === 1 ? "group" : "groups"} at this time.
                {lookupIsBroad ? " Pick a group or activity area to see campers." : null}
              </p>
              <div className="max-h-[min(22rem,50vh)] overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_hsl(var(--border))]">
                    <TableRow>
                      <TableHead className="h-9">Group</TableHead>
                      <TableHead className="h-9">Activity</TableHead>
                      <TableHead className="h-9">Area</TableHead>
                      <TableHead className="h-9">Period</TableHead>
                      {showCamperNames ? <TableHead className="h-9">Campers</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((slot) => {
                      const names = campersByGroup.get(scheduleGroupName(slot.groupName).toLowerCase()) ?? [];
                      return (
                        <TableRow key={slot.id} className="text-sm">
                          <TableCell className="py-2 font-medium">{slot.groupName}</TableCell>
                          <TableCell className="py-2">{slot.activity}</TableCell>
                          <TableCell className="py-2">{areaLabel(slot)}</TableCell>
                          <TableCell className="py-2 whitespace-nowrap">{periodLabel(slot)}</TableCell>
                          {showCamperNames ? (
                            <TableCell className="py-2 max-w-[280px] text-xs text-muted-foreground">
                              {names.length === 0 ? (
                                "No campers on the roster"
                              ) : (
                                <span className="inline-flex items-start gap-1">
                                  <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                  <span className="line-clamp-3" title={names.join(", ")}>
                                    {names.length} · {names.join(", ")}
                                  </span>
                                </span>
                              )}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : slots.length > 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is scheduled for that time and filter.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Upload a schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Excel or CSV. The scanner reads a period list (Group, Day, Start, End, Activity, Location), a grid with
            days across the top and one sheet per group, or a grid with groups or times across the top. A cell like
            “Swim at Pool” stores the activity and the area separately.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept=".csv,.txt,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="max-w-sm text-xs"
              disabled={scanning}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void onFile(file);
                event.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              Download template
            </Button>
            {scanning ? <span className="text-xs text-muted-foreground">Scanning…</span> : null}
          </div>

          {warnings.length > 0 ? (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4 space-y-1">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          {preview.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  {preview.length} periods from <span className="font-medium">{previewName}</span>
                </p>
                <Button type="button" size="sm" disabled={saving} onClick={() => void savePreview()}>
                  {saving ? "Saving…" : "Save schedule"}
                </Button>
              </div>
              {canUseOneDay ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="schedule-override" className="text-xs text-muted-foreground">
                      One-day change (optional)
                    </Label>
                    <Input
                      id="schedule-override"
                      type="date"
                      value={overrideDate}
                      onChange={(event) => setOverrideDate(event.target.value)}
                      className="h-8 w-[150px] text-xs"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pb-1">
                    Leave this empty to replace the weekly schedule. A date replaces only that day.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Saving replaces the current weekly schedule. Rows tied to a date replace that day only.
                </p>
              )}
              <div className="max-h-[360px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((slot, index) => (
                      <TableRow key={`${slot.groupName}-${slot.dayOfWeek}-${slot.startMinutes}-${index}`}>
                        <TableCell>{slot.groupName}</TableCell>
                        <TableCell>{dayLabel(slot)}</TableCell>
                        <TableCell className="whitespace-nowrap">{periodLabel(slot)}</TableCell>
                        <TableCell>{slot.activity}</TableCell>
                        <TableCell>{areaLabel(slot)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${slot.groupName} ${slot.activity}`}
                            onClick={() => setPreview((current) => current.filter((_, row) => row !== index))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {uploads.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Saved schedules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {uploads.map((upload) => {
              const count = slots.filter((slot) => slot.uploadId === upload.id).length;
              return (
                <div key={upload.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <span className="font-medium">{upload.file_name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {upload.applies_on ? upload.applies_on : "Weekly"} · {count} periods
                    </span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void deleteUpload(upload)}>
                    Delete
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
