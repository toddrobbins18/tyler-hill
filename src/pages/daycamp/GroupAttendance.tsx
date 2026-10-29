import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useCampOperationalDate } from "@/hooks/useCampOperationalDate";
import {
  defaultEnrollmentWeekForDate,
  formatEnrollmentWeekLabel,
  loadEnrollmentWeekCalendar,
  type EnrollmentWeekCalendar,
} from "@/lib/enrollmentWeekCalendar";
import {
  loadGroupAttendance,
  loadGroupRoster,
  saveGroupAttendance,
  type GroupAttendanceMap,
  type GroupAttendanceStatus,
  type GroupRosterCamper,
} from "@/lib/transportGroupAttendance";
import { FrontOfficeBackLink } from "@/components/daycamp/FrontOfficeBackLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_GROUPS = "__all__";

export default function GroupAttendance() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeason();
  const companyId = currentCompany?.id;
  const { operationalDateString } = useCampOperationalDate();

  const [attendanceDate, setAttendanceDate] = useState(operationalDateString);
  const [calendar, setCalendar] = useState<EnrollmentWeekCalendar>([]);
  const [roster, setRoster] = useState<GroupRosterCamper[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [attendance, setAttendance] = useState<GroupAttendanceMap>({});
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [groupFilter, setGroupFilter] = useState(ALL_GROUPS);
  const [search, setSearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const skipPersistRef = useRef(true);

  useEffect(() => {
    setAttendanceDate(operationalDateString);
  }, [operationalDateString]);

  const enrollmentWeek = useMemo(
    () => defaultEnrollmentWeekForDate(calendar, attendanceDate),
    [attendanceDate, calendar],
  );

  useEffect(() => {
    if (!companyId) return;
    void loadEnrollmentWeekCalendar(supabase, companyId, currentSeason).then(setCalendar);
  }, [companyId, currentSeason]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setRosterLoading(true);
    void loadGroupRoster(supabase, companyId, currentSeason, {
      enrollmentWeek: enrollmentWeek ?? undefined,
    }).then((rows) => {
      if (!cancelled) {
        setRoster(rows);
        setRosterLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, currentSeason, enrollmentWeek]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    skipPersistRef.current = true;
    setAttendanceLoading(true);
    void loadGroupAttendance(supabase, companyId, currentSeason, attendanceDate).then((loaded) => {
      if (!cancelled) {
        setAttendance(loaded.records);
        setAttendanceLoading(false);
        setSelectedKeys(new Set());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, currentSeason, attendanceDate]);

  useEffect(() => {
    if (!companyId || attendanceLoading) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    setSaveState("saving");
    const handle = setTimeout(() => {
      void (async () => {
        const { data: userRes } = await supabase.auth.getUser();
        const ok = await saveGroupAttendance(
          supabase,
          companyId,
          currentSeason,
          attendanceDate,
          attendance,
          { userId: userRes.user?.id ?? null },
        );
        setSaveState(ok ? "saved" : "idle");
      })();
    }, 300);
    return () => clearTimeout(handle);
  }, [attendance, companyId, currentSeason, attendanceDate, attendanceLoading]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 2000);
    return () => clearTimeout(t);
  }, [saveState]);

  const groupNames = useMemo(() => {
    const set = new Set(roster.map((c) => c.groupName));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [roster]);

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roster.filter((c) => {
      if (groupFilter !== ALL_GROUPS && c.groupName !== groupFilter) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.groupName.toLowerCase().includes(q);
    });
  }, [roster, groupFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, GroupRosterCamper[]>();
    for (const c of filteredRoster) {
      const list = map.get(c.groupName) ?? [];
      list.push(c);
      map.set(c.groupName, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRoster]);

  const visibleKeys = useMemo(() => filteredRoster.map((c) => c.key), [filteredRoster]);

  const toggleSelected = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedKeys(new Set(visibleKeys));
  }, [visibleKeys]);

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const applyStatusToKeys = useCallback((keys: string[], status: GroupAttendanceStatus) => {
    if (!keys.length) return;
    setAttendance((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = status;
      return next;
    });
  }, []);

  const applyToSelected = useCallback(
    (status: GroupAttendanceStatus) => {
      applyStatusToKeys([...selectedKeys], status);
      setSelectedKeys(new Set());
    },
    [applyStatusToKeys, selectedKeys],
  );

  const setOne = useCallback((key: string, status: GroupAttendanceStatus) => {
    setAttendance((prev) => ({ ...prev, [key]: status }));
  }, []);

  const weekLabel =
    enrollmentWeek != null ? formatEnrollmentWeekLabel(enrollmentWeek, calendar) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <FrontOfficeBackLink />
      <div>
        <h1 className="page-header flex items-center gap-2">
          <Users className="h-6 w-6" /> Group Attendance
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mark Present / Absent by camp group. Select multiple campers, then apply P or A in one tap.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="group-attendance-date" className="text-xs text-muted-foreground">
          Date
        </Label>
        <Input
          id="group-attendance-date"
          type="date"
          value={attendanceDate}
          onChange={(e) => setAttendanceDate(e.target.value || operationalDateString)}
          className="h-8 w-[140px] text-xs"
        />
        {weekLabel ? <Badge variant="outline" className="text-[10px]">{weekLabel}</Badge> : null}
        {(rosterLoading || attendanceLoading) && (
          <span className="text-[10px] text-muted-foreground">Loading…</span>
        )}
        {saveState === "saving" && <Badge variant="outline" className="text-[10px]">Saving…</Badge>}
        {saveState === "saved" && <Badge variant="secondary" className="text-[10px]">Saved</Badge>}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Bulk actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Group</Label>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_GROUPS}>All groups</SelectItem>
                  {groupNames.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[160px]">
              <Label className="text-xs">Search</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Camper or group…"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={selectAllVisible}>
              Select all shown ({visibleKeys.length})
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={clearSelection}>
              Clear selection
            </Button>
            <span className="text-xs text-muted-foreground">{selectedKeys.size} selected</span>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={selectedKeys.size === 0}
              onClick={() => applyToSelected("present")}
            >
              Mark selected Present
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8 text-xs"
              disabled={selectedKeys.size === 0}
              onClick={() => applyToSelected("absent")}
            >
              Mark selected Absent
            </Button>
          </div>
        </CardContent>
      </Card>

      {!rosterLoading && !filteredRoster.length ? (
        <p className="text-sm text-muted-foreground">No campers in roster for this date / enrollment week.</p>
      ) : null}

      <div className="space-y-4">
        {grouped.map(([groupName, campers]) => (
          <Card key={groupName}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{groupName}</CardTitle>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => applyStatusToKeys(campers.map((c) => c.key), "present")}
                >
                  All present in group
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {campers.map((c) => {
                const status = attendance[c.key];
                const checked = selectedKeys.has(c.key);
                return (
                  <div
                    key={c.key}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                      checked ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleSelected(c.key)}
                      aria-label={`Select ${c.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.name}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant={status === "present" ? "default" : "outline"}
                        className="h-7 px-2 text-[10px]"
                        onClick={() => setOne(c.key, "present")}
                      >
                        P
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={status === "absent" ? "destructive" : "outline"}
                        className="h-7 px-2 text-[10px]"
                        onClick={() => setOne(c.key, "absent")}
                      >
                        A
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
