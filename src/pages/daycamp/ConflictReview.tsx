import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useCampOperationalDate } from "@/hooks/useCampOperationalDate";
import { useToast } from "@/hooks/use-toast";
import { FrontOfficeBackLink } from "@/components/daycamp/FrontOfficeBackLink";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  reviewPaperAttendance,
  weekdayBubbleIndex,
  type ChangeSheetAttendanceSource,
  type PaperAbsentCamper,
  type PaperAttendanceListKind,
} from "@/lib/paperAttendance";
import { loadRgbaFromBrowserFile } from "@/lib/paperAttendanceImage";
import { analyzePaperAttendanceImage, omrRowsToAbsentFlags } from "@/lib/paperAttendanceOmr";
import {
  loadChangeSheetAttendanceSource,
  loadPaperAttendance,
  saveChangeSheetAttendanceSource,
  savePaperAttendanceSheet,
} from "@/lib/paperAttendanceStore";
import { campersOnRoute } from "@/lib/transportBusAttendance";
import { loadGroupRoster, type GroupRosterCamper } from "@/lib/transportGroupAttendance";
import { PARENT_TRANSPORT_CHANGE_SHEET_BUS } from "@/lib/transportParentTransport";
import {
  normalizeTransportBoardForSeason,
  type TransportRouteMeta,
  type TransportRouteStop,
} from "@/lib/transportRoster";
import { ROUTE_COLORS } from "@/lib/transportRunBoard";

type RosterMark = { id: string; name: string; absent: boolean };

export default function ConflictReview() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeason();
  const companyId = currentCompany?.id;
  const { operationalDateString } = useCampOperationalDate();

  const [sheetDate, setSheetDate] = useState(operationalDateString);
  const [listKind, setListKind] = useState<PaperAttendanceListKind>("bus");
  const [sheetLabel, setSheetLabel] = useState("");
  const [routeMeta, setRouteMeta] = useState<TransportRouteMeta[]>([]);
  const [coreStops, setCoreStops] = useState<Record<number, TransportRouteStop[]>>({});
  const [parentTransportCampers, setParentTransportCampers] = useState<{ routeId: number | null; name: string }[]>(
    [],
  );
  const [groupRoster, setGroupRoster] = useState<GroupRosterCamper[]>([]);
  const [marks, setMarks] = useState<RosterMark[]>([]);
  const [scanWarning, setScanWarning] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busAbsents, setBusAbsents] = useState<PaperAbsentCamper[]>([]);
  const [groupAbsents, setGroupAbsents] = useState<PaperAbsentCamper[]>([]);
  const [attendanceSource, setAttendanceSource] = useState<ChangeSheetAttendanceSource>("paperless");

  useEffect(() => {
    setSheetDate(operationalDateString);
  }, [operationalDateString]);

  const weekdayIndex = weekdayBubbleIndex(sheetDate);
  const review = useMemo(
    () => reviewPaperAttendance(busAbsents, groupAbsents),
    [busAbsents, groupAbsents],
  );

  const busOptions = useMemo(() => {
    const buses = routeMeta.map((r) => r.bus);
    if (parentTransportCampers.length) buses.push(PARENT_TRANSPORT_CHANGE_SHEET_BUS);
    return [...new Set(buses)];
  }, [parentTransportCampers.length, routeMeta]);

  const groupOptions = useMemo(() => {
    return [...new Set(groupRoster.map((c) => c.groupName))].sort((a, b) => a.localeCompare(b));
  }, [groupRoster]);

  const sheetOptions = listKind === "bus" ? busOptions : groupOptions;

  const loadBoard = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("transport_boards")
      .select("data")
      .eq("company_id", companyId)
      .eq("season", currentSeason)
      .maybeSingle();
    if (!data?.data || typeof data.data !== "object") {
      setRouteMeta([]);
      setCoreStops({});
      setParentTransportCampers([]);
      return;
    }
    const normalized = await normalizeTransportBoardForSeason(
      supabase,
      companyId,
      currentSeason,
      data.data as never,
    );
    setRouteMeta(
      (normalized.routeMeta ?? []).map((r, i) => ({
        ...r,
        id: Number(r.id),
        color: r.color || ROUTE_COLORS[i % ROUTE_COLORS.length],
      })),
    );
    const stops: Record<number, TransportRouteStop[]> = {};
    for (const [k, v] of Object.entries(normalized.coreStops ?? {})) {
      stops[Number(k)] = v as TransportRouteStop[];
    }
    setCoreStops(stops);
    setParentTransportCampers(
      (normalized.parentTransportCampers ?? []).map((c) => ({
        routeId: c.routeId ?? null,
        name: c.name,
      })),
    );
  }, [companyId, currentSeason]);

  const loadLists = useCallback(async () => {
    if (!companyId) return;
    const [paper, source] = await Promise.all([
      loadPaperAttendance(supabase, companyId, currentSeason, sheetDate),
      loadChangeSheetAttendanceSource(supabase, companyId, currentSeason),
    ]);
    setBusAbsents(paper.bus);
    setGroupAbsents(paper.group);
    setAttendanceSource(source);
  }, [companyId, currentSeason, sheetDate]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!companyId) return;
    void loadGroupRoster(supabase, companyId, currentSeason).then(setGroupRoster);
  }, [companyId, currentSeason]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (!sheetOptions.length) {
      setSheetLabel("");
      return;
    }
    if (!sheetOptions.includes(sheetLabel)) setSheetLabel(sheetOptions[0]);
  }, [sheetLabel, sheetOptions]);

  const rosterForSheet = useCallback((): RosterMark[] => {
    if (!sheetLabel) return [];
    if (listKind === "group") {
      return groupRoster
        .filter((c) => c.groupName === sheetLabel)
        .map((c) => ({ id: c.id, name: c.name, absent: false }));
    }
    if (sheetLabel === PARENT_TRANSPORT_CHANGE_SHEET_BUS) {
      return parentTransportCampers.map((c, i) => ({
        id: `pt-${i}-${c.name}`,
        name: c.name,
        absent: false,
      }));
    }
    const route = routeMeta.find((r) => r.bus === sheetLabel);
    if (!route) return [];
    return campersOnRoute(route.id, coreStops[route.id] ?? []).map((c) => ({
      id: c.key,
      name: c.name,
      absent: false,
    }));
  }, [coreStops, groupRoster, listKind, parentTransportCampers, routeMeta, sheetLabel]);

  useEffect(() => {
    setMarks(rosterForSheet());
    setScanWarning(null);
  }, [rosterForSheet]);

  const handleScan = async (file: File | undefined) => {
    if (!file) return;
    if (weekdayIndex == null) {
      toast({ title: "Pick a weekday", description: "Bus and group sheets are Monday–Friday.", variant: "destructive" });
      return;
    }
    if (!marks.length) {
      toast({ title: "Pick a sheet", description: "Choose the bus or group that matches this page.", variant: "destructive" });
      return;
    }
    setScanning(true);
    try {
      const image = await loadRgbaFromBrowserFile(file);
      const result = analyzePaperAttendanceImage(image, {
        kind: listKind,
        weekdayIndex,
        camperCount: marks.length,
      });
      const flags = new Map(omrRowsToAbsentFlags(result.rows, listKind).map((row) => [row.camperIndex, row.absent]));
      setMarks((prev) => prev.map((row, index) => ({ ...row, absent: flags.get(index) === true })));
      setScanWarning(result.warning ?? null);
      toast({ title: "Scan read", description: "Check the names, then save to the bus or group list." });
    } catch (err) {
      toast({
        title: "Could not read that file",
        description: err instanceof Error ? err.message : "Use a JPG or PNG of the page.",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  const saveSheet = async () => {
    if (!companyId || !sheetLabel) return;
    setSaving(true);
    try {
      const absents = marks
        .filter((row) => row.absent)
        .map((row) => ({ camperId: row.id, camperName: row.name, sheetLabel }));
      const ok = await savePaperAttendanceSheet(supabase, {
        companyId,
        season: currentSeason,
        attendanceDate: sheetDate,
        listKind,
        sheetLabel,
        absents,
        userId: user?.id ?? null,
      });
      if (!ok) {
        toast({ title: "Save failed", variant: "destructive" });
        return;
      }
      toast({ title: `Saved ${listKind === "bus" ? "bus" : "group"} list` });
      await loadLists();
    } finally {
      setSaving(false);
    }
  };

  const setSource = async (source: ChangeSheetAttendanceSource) => {
    setAttendanceSource(source);
    if (!companyId) return;
    const ok = await saveChangeSheetAttendanceSource(supabase, companyId, currentSeason, source);
    if (!ok) {
      toast({
        title: "Could not save the change-sheet toggle",
        description: "Open Transportation once so the board exists, then try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <FrontOfficeBackLink />
      <div>
        <h1 className="page-header flex items-center gap-2">
          <ScanLine className="h-6 w-6" /> Conflict Review
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scan Old School bus and group sheets. Names on both lists are really absent. One-sided marks stay here and
          are not pushed to change sheets.{" "}
          <Link to="/day-camp/change-sheets" className="text-primary underline-offset-2 hover:underline">
            Master Change Sheet
          </Link>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="conflict-review-date" className="text-xs text-muted-foreground">
          Date
        </Label>
        <Input
          id="conflict-review-date"
          type="date"
          value={sheetDate}
          onChange={(e) => setSheetDate(e.target.value || operationalDateString)}
          className="h-8 w-[140px] text-xs"
        />
        {weekdayIndex == null ? (
          <Badge variant="outline" className="text-[10px]">
            Weekend — no bubbles
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][weekdayIndex]} column
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Change sheet absents</CardTitle>
          <CardDescription>
            Paperless uses Bus Attendance. Paper scan uses only names confirmed on both lists below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={attendanceSource === "paperless" ? "default" : "outline"}
            onClick={() => void setSource("paperless")}
          >
            Paperless
          </Button>
          <Button
            size="sm"
            variant={attendanceSource === "paper_scan" ? "default" : "outline"}
            onClick={() => void setSource("paper_scan")}
          >
            Paper scan
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Scan a sheet</CardTitle>
          <CardDescription>
            Print new bus rosters so barcodes print. Fill a bubble only when the camper is absent. Check the names
            before saving — this does not write paperless attendance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={listKind === "bus" ? "default" : "outline"} onClick={() => setListKind("bus")}>
              Bus roster
            </Button>
            <Button
              size="sm"
              variant={listKind === "group" ? "default" : "outline"}
              onClick={() => setListKind("group")}
            >
              Group report
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{listKind === "bus" ? "Bus" : "Group"}</Label>
              <Select value={sheetLabel} onValueChange={setSheetLabel}>
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  <SelectValue placeholder="Select sheet" />
                </SelectTrigger>
                <SelectContent>
                  {sheetOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Photo of the page</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="h-8 max-w-[260px] text-xs"
                disabled={scanning || !marks.length}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void handleScan(file);
                }}
              />
            </div>
            <Button size="sm" onClick={() => void saveSheet()} disabled={saving || !sheetLabel}>
              {saving ? "Saving…" : `Save ${listKind} list`}
            </Button>
          </div>
          {scanWarning ? <p className="text-xs text-amber-700">{scanWarning}</p> : null}
          <div className="max-h-[320px] overflow-auto rounded-md border divide-y">
            {marks.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No campers on this sheet.</p>
            ) : (
              marks.map((row, index) => (
                <label key={`${row.id}-${index}`} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <Checkbox
                    checked={row.absent}
                    onCheckedChange={(v) =>
                      setMarks((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, absent: v === true } : item)),
                      )
                    }
                  />
                  <span className={row.absent ? "font-medium" : ""}>{row.name}</span>
                  {row.absent ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Absent
                    </Badge>
                  ) : null}
                </label>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bus list</CardTitle>
            <CardDescription>{busAbsents.length} absent from scanned bus rosters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {busAbsents.length === 0 ? (
              <p className="text-muted-foreground">None yet.</p>
            ) : (
              busAbsents.map((row) => (
                <div key={`bus-${row.camperName}`} className="flex justify-between gap-2">
                  <span>{row.camperName}</span>
                  <span className="text-xs text-muted-foreground">{row.sheetLabel}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Group list</CardTitle>
            <CardDescription>{groupAbsents.length} absent from scanned group reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {groupAbsents.length === 0 ? (
              <p className="text-muted-foreground">None yet.</p>
            ) : (
              groupAbsents.map((row) => (
                <div key={`group-${row.camperName}`} className="flex justify-between gap-2">
                  <span>{row.camperName}</span>
                  <span className="text-xs text-muted-foreground">{row.sheetLabel}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Confirmed absent</CardTitle>
            <CardDescription>On both lists — these can feed change sheets when Paper scan is on</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {review.confirmed.length === 0 ? (
              <p className="text-muted-foreground">No matches yet.</p>
            ) : (
              review.confirmed.map((row) => (
                <div key={`ok-${row.camperName}`}>{row.camperName}</div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conflicts</CardTitle>
            <CardDescription>Only one list marked them — leave these here</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {review.busOnly.length === 0 && review.groupOnly.length === 0 ? (
              <p className="text-muted-foreground">No conflicts.</p>
            ) : (
              <>
                {review.busOnly.map((row) => (
                  <div key={`bo-${row.camperName}`} className="flex justify-between gap-2">
                    <span>{row.camperName}</span>
                    <Badge variant="outline" className="text-[10px]">
                      Bus only
                    </Badge>
                  </div>
                ))}
                {review.groupOnly.map((row) => (
                  <div key={`go-${row.camperName}`} className="flex justify-between gap-2">
                    <span>{row.camperName}</span>
                    <Badge variant="outline" className="text-[10px]">
                      Group only
                    </Badge>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
