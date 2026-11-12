import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  formatPaperScanChecklist,
  reviewPaperAttendance,
  weekdayBubbleIndex,
  type ChangeSheetAttendanceSource,
  type PaperAbsentCamper,
  type PaperAttendanceListKind,
} from "@/lib/paperAttendance";
import { loadRgbaPagesFromBrowserFiles } from "@/lib/paperAttendanceImage";
import { processPaperAttendancePages } from "@/lib/paperAttendanceScan";
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
  const [scanChecklist, setScanChecklist] = useState<{
    scannedLabels: string[];
    missingLabels: string[];
    unreadPages: Array<{ sourceName: string; reason: string }>;
  } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busAbsents, setBusAbsents] = useState<PaperAbsentCamper[]>([]);
  const [groupAbsents, setGroupAbsents] = useState<PaperAbsentCamper[]>([]);
  const [attendanceSource, setAttendanceSource] = useState<ChangeSheetAttendanceSource>("paperless");
  const pendingScanAbsents = useRef<Set<string> | null>(null);

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

  const rosterForLabel = useCallback(
    (label: string): RosterMark[] => {
      if (!label) return [];
      if (listKind === "group") {
        return groupRoster
          .filter((c) => c.groupName === label)
          .map((c) => ({ id: c.id, name: c.name, absent: false }));
      }
      if (label === PARENT_TRANSPORT_CHANGE_SHEET_BUS) {
        return parentTransportCampers.map((c, i) => ({
          id: `pt-${i}-${c.name}`,
          name: c.name,
          absent: false,
        }));
      }
      const route = routeMeta.find((r) => r.bus === label);
      if (!route) return [];
      return campersOnRoute(route.id, coreStops[route.id] ?? []).map((c) => ({
        id: c.key,
        name: c.name,
        absent: false,
      }));
    },
    [coreStops, groupRoster, listKind, parentTransportCampers, routeMeta],
  );

  const rosterForSheet = useCallback((): RosterMark[] => rosterForLabel(sheetLabel), [rosterForLabel, sheetLabel]);

  useEffect(() => {
    const base = rosterForSheet();
    const pending = pendingScanAbsents.current;
    pendingScanAbsents.current = null;
    setMarks(
      pending ? base.map((row) => ({ ...row, absent: pending.has(row.name) })) : base,
    );
    if (!pending) setScanWarning(null);
  }, [rosterForSheet]);

  const handleScan = async (files: FileList | File[] | undefined) => {
    const list = files ? [...files] : [];
    if (!list.length) return;
    if (weekdayIndex == null) {
      toast({ title: "Pick a weekday", description: "Bus and group sheets are Monday–Friday.", variant: "destructive" });
      return;
    }
    if (!sheetOptions.length) {
      toast({
        title: `No ${listKind} sheets`,
        description: listKind === "bus" ? "Open Transportation so buses are on the board." : "No groups in this season.",
        variant: "destructive",
      });
      return;
    }
    setScanning(true);
    try {
      const pages = await loadRgbaPagesFromBrowserFiles(list);
      const batch = processPaperAttendancePages(pages, {
        kind: listKind,
        weekdayIndex,
        expectedLabels: sheetOptions,
        rosterForLabel,
        fallbackLabel: pages.length === 1 ? sheetLabel : null,
      });
      if (!companyId) {
        toast({ title: "Not signed in to a camp", variant: "destructive" });
        return;
      }
      for (const sheet of batch.sheets) {
        const ok = await savePaperAttendanceSheet(supabase, {
          companyId,
          season: currentSeason,
          attendanceDate: sheetDate,
          listKind,
          sheetLabel: sheet.label,
          absents: sheet.absents,
          userId: user?.id ?? null,
        });
        if (!ok) {
          toast({ title: `Could not save ${sheet.label}`, variant: "destructive" });
        }
      }
      setScanChecklist({
        scannedLabels: batch.scannedLabels,
        missingLabels: batch.missingLabels,
        unreadPages: batch.unreadPages,
      });
      setScanWarning(batch.sheets.find((sheet) => sheet.warning)?.warning ?? null);
      if (batch.sheets.length === 1) {
        const sheet = batch.sheets[0];
        const absents = new Set(sheet.absents.map((row) => row.camperName));
        if (sheet.label === sheetLabel) {
          setMarks(rosterForLabel(sheet.label).map((row) => ({ ...row, absent: absents.has(row.name) })));
        } else {
          pendingScanAbsents.current = absents;
          setSheetLabel(sheet.label);
        }
      }
      await loadLists();
      toast({
        title: batch.missingLabels.length ? "Scan finished — sheets missing" : "Scan saved",
        description: formatPaperScanChecklist({
          kind: listKind,
          scannedLabels: batch.scannedLabels,
          missingLabels: batch.missingLabels,
          unreadPages: batch.unreadPages,
        }),
        variant: batch.sheets.length ? "default" : "destructive",
      });
    } catch (err) {
      toast({
        title: "Could not read that file",
        description: err instanceof Error ? err.message : "Use a JPG, PNG, or copier PDF of the pages.",
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
          Each camper row barcode is that child&apos;s CampMinder ID. The header barcode is the bus or group. Upload
          one file of every bus sheet, or every group sheet. Names on both lists are really absent.{" "}
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
          <CardTitle className="text-base">Scan all sheets</CardTitle>
          <CardDescription>
            One PDF or photos of every bus roster, or every group report. Header barcodes pick the bus or group.
            Fill a bubble only when the camper is absent. This does not write paperless attendance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={listKind === "bus" ? "default" : "outline"}
              onClick={() => {
                setListKind("bus");
                setScanChecklist(null);
              }}
            >
              Bus roster
            </Button>
            <Button
              size="sm"
              variant={listKind === "group" ? "default" : "outline"}
              onClick={() => {
                setListKind("group");
                setScanChecklist(null);
              }}
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
              <Label className="text-xs">
                {listKind === "bus" ? "All bus sheets" : "All group sheets"} (PDF or photos)
              </Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                className="h-8 max-w-[280px] text-xs"
                disabled={scanning || !sheetOptions.length}
                onChange={(e) => {
                  const files = e.target.files ? [...e.target.files] : [];
                  e.target.value = "";
                  void handleScan(files);
                }}
              />
            </div>
            <Button size="sm" onClick={() => void saveSheet()} disabled={saving || !sheetLabel}>
              {saving ? "Saving…" : `Save ${listKind} list`}
            </Button>
          </div>
          {scanWarning ? <p className="text-xs text-amber-700">{scanWarning}</p> : null}
          {scanChecklist ? (
            <div className="rounded-md border p-3 space-y-2 text-sm">
              <p>
                Read {scanChecklist.scannedLabels.length} of {sheetOptions.length} {listKind} sheets.
              </p>
              {scanChecklist.missingLabels.length ? (
                <div>
                  <p className="text-xs font-medium text-amber-800 mb-1">Missing after this scan</p>
                  <div className="flex flex-wrap gap-1">
                    {scanChecklist.missingLabels.map((label) => (
                      <Badge key={label} variant="outline" className="text-[10px]">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : scanChecklist.scannedLabels.length ? (
                <p className="text-xs text-muted-foreground">Every {listKind} sheet is in.</p>
              ) : null}
              {scanChecklist.unreadPages.length ? (
                <div className="text-xs text-amber-800 space-y-0.5">
                  {scanChecklist.unreadPages.map((page) => (
                    <p key={page.sourceName}>
                      {page.sourceName}: {page.reason}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
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
