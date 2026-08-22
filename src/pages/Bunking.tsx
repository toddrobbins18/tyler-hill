import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock, Unlock, BarChart3, Users, GripVertical, X, Upload, Download, UserPlus, Home, Trash2, Pencil, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { parseCSV, pickFirst, readFileAsText } from "@/lib/csv";
import { optimizeCabins, type OptCamper } from "@/lib/bunking-optimizer";
import { fetchBunkingCampersFromRoster } from "@/lib/bunkingRoster";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";

type Camper = { id: string; name: string; town?: string; gender?: string; division?: string; requests?: string[]; disrequests?: string[] };

type Cabin = {
  id: string;
  name: string;
  capacity: number;
  campers: Camper[];
  gender?: string;
  ageGroup?: string;
};

const COED_DIVISIONS = ["nursery", "pre-k", "prek", "pre k"];
const BUNKING_STORAGE_KEY = "camp-hub-bunking-boards";

function isCamper(value: unknown): value is Camper {
  if (!value || typeof value !== "object") return false;
  const camper = value as Partial<Camper>;
  return typeof camper.id === "string" && typeof camper.name === "string";
}

function isCabin(value: unknown): value is Cabin {
  if (!value || typeof value !== "object") return false;
  const cabin = value as Partial<Cabin>;
  return (
    typeof cabin.id === "string" &&
    typeof cabin.name === "string" &&
    typeof cabin.capacity === "number" &&
    Array.isArray(cabin.campers) &&
    cabin.campers.every(isCamper)
  );
}

function loadSavedCabins(): Cabin[] {
  return [];
}

function splitList(s: string): string[] {
  return s.split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
}

export default function Bunking() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [cabins, setCabins] = useState<Cabin[]>(loadSavedCabins);
  const [hydrated, setHydrated] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterCount, setRosterCount] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [dragItem, setDragItem] = useState<{ camperId: string; fromCabinId: string } | null>(null);
  const [dragOverCabin, setDragOverCabin] = useState<string | null>(null);
  const [addCabinOpen, setAddCabinOpen] = useState(false);
  const [addCamperOpen, setAddCamperOpen] = useState(false);
  const [editCabinId, setEditCabinId] = useState<string | null>(null);
  const [newCabin, setNewCabin] = useState({ name: "", capacity: 8, gender: "", ageGroup: "" });
  const [newCamper, setNewCamper] = useState({ name: "", cabinId: "" });
  const [pendingImport, setPendingImport] = useState<OptCamper[] | null>(null);
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [optimizeCapacity, setOptimizeCapacity] = useState(8);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCamper, setSelectedCamper] = useState<{ camper: Camper; cabinName: string } | null>(null);

  // Track the latest data we've written so realtime echoes don't loop.
  const lastWrittenRef = useRef<string>("");

  // Load shared board on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !currentCompany) {
        setHydrated(true);
        return;
      }
      const { data, error } = await supabase
        .from("bunking_boards")
        .select("data")
        .eq("company_id", currentCompany.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Failed to load bunking board:", error);
        toast.error("Couldn't load shared board — using local copy.");
      } else if (data?.data && Array.isArray(data.data) && (data.data as unknown[]).every(isCabin)) {
        const next = data.data as unknown as Cabin[];
        lastWrittenRef.current = JSON.stringify(next);
        setCabins(next);
      } else if (!data) {
        setCabins([]);
      }
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [user, currentCompany]);

  useEffect(() => {
    if (!currentCompany?.id || !currentSeason) {
      setRosterCount(null);
      return;
    }
    let cancelled = false;
    fetchBunkingCampersFromRoster(currentCompany.id, currentSeason)
      .then((campers) => {
        if (!cancelled) setRosterCount(campers.length);
      })
      .catch(() => {
        if (!cancelled) setRosterCount(null);
      });
    return () => { cancelled = true; };
  }, [currentCompany?.id, currentSeason]);

  // Realtime: subscribe to shared board changes from other users
  useEffect(() => {
    if (!user || !currentCompany) return;
    const channel = supabase
      .channel("bunking_boards_shared")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bunking_boards", filter: `company_id=eq.${currentCompany.id}` },
        (payload) => {
          const newRow = (payload.new ?? {}) as { data?: unknown };
          if (!newRow.data || !Array.isArray(newRow.data)) return;
          if (!(newRow.data as unknown[]).every(isCabin)) return;
          const incoming = JSON.stringify(newRow.data);
          if (incoming === lastWrittenRef.current) return; // our own write
          lastWrittenRef.current = incoming;
          setCabins(newRow.data as unknown as Cabin[]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, currentCompany]);

  // Persist locally + to shared board (after hydration)
  useEffect(() => {
    if (!currentCompany) return;
    window.localStorage.setItem(`${BUNKING_STORAGE_KEY}-${currentCompany.id}`, JSON.stringify(cabins));
    if (!hydrated || !user) return;
    const serialized = JSON.stringify(cabins);
    if (serialized === lastWrittenRef.current) return;
    const t = setTimeout(async () => {
      lastWrittenRef.current = serialized;
      const { error } = await supabase
        .from("bunking_boards")
        .upsert(
          { company_id: currentCompany.id, data: cabins as unknown as never, updated_by: user.id },
          { onConflict: "company_id" }
        );
      if (error) console.error("Failed to save bunking board:", error);
    }, 600);
    return () => clearTimeout(t);
  }, [cabins, hydrated, user, currentCompany]);

  const handleSaveCabin = () => {
    if (!newCabin.name.trim()) { toast.error("Cabin name required."); return; }
    const capacity = Math.max(1, Number(newCabin.capacity) || 8);
    if (editCabinId) {
      setCabins((prev) => prev.map((c) => c.id === editCabinId ? {
        ...c, name: newCabin.name.trim(), capacity,
        gender: newCabin.gender || undefined, ageGroup: newCabin.ageGroup || undefined,
      } : c));
      toast.success("Cabin updated.");
    } else {
      const id = `cabin-${Date.now()}`;
      setCabins((prev) => [...prev, {
        id, name: newCabin.name.trim(), capacity,
        gender: newCabin.gender || undefined, ageGroup: newCabin.ageGroup || undefined, campers: [],
      }]);
      toast.success("Cabin added.");
    }
    setAddCabinOpen(false);
    setEditCabinId(null);
    setNewCabin({ name: "", capacity: 8, gender: "", ageGroup: "" });
  };

  const openEditCabin = (cabin: Cabin) => {
    setEditCabinId(cabin.id);
    setNewCabin({
      name: cabin.name, capacity: cabin.capacity,
      gender: cabin.gender || "", ageGroup: cabin.ageGroup || "",
    });
    setAddCabinOpen(true);
  };

  const handleAddCamper = () => {
    if (!newCamper.name.trim() || !newCamper.cabinId) { toast.error("Name and cabin are required."); return; }
    const cabin = cabins.find((c) => c.id === newCamper.cabinId);
    if (!cabin) return;
    if (cabin.campers.length >= cabin.capacity) { toast.error("That cabin is full."); return; }
    const id = `c-${Date.now()}`;
    setCabins((prev) => prev.map((c) => c.id === newCamper.cabinId
      ? { ...c, campers: [...c.campers, { id, name: newCamper.name.trim() }] }
      : c));
    setAddCamperOpen(false);
    setNewCamper({ name: "", cabinId: "" });
    toast.success("Camper added.");
  };

  const handleDeleteCabin = (id: string, name: string) => {
    if (!confirm(`Delete cabin "${name}"? Any assigned campers will be removed.`)) return;
    setCabins((prev) => prev.filter((c) => c.id !== id));
    toast.success("Cabin deleted.");
  };

  const handleLoadFromRoster = async () => {
    if (!currentCompany?.id) return;
    setLoadingRoster(true);
    try {
      const campers = await fetchBunkingCampersFromRoster(currentCompany.id, currentSeason);
      if (!campers.length) {
        toast.error(`No active campers found for ${currentSeason}.`);
        return;
      }
      setRosterCount(campers.length);
      setPendingImport(campers);
      setOptimizeOpen(true);
      toast.success(`Loaded ${campers.length} campers from ${currentSeason} roster.`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(`Could not load roster: ${message}`);
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleCSVImport = async (file: File) => {
    try {
      const text = await readFileAsText(file);
      const rows = parseCSV(text);
      if (!rows.length) { toast.error("CSV is empty."); return; }
      const parsed: OptCamper[] = [];
      let skipped = 0;
      let hasCabinCol = false;
      let cabinUpdates: { name: string; cabin: string }[] = [];
      rows.forEach((r, idx) => {
        const fullName = pickFirst(r, ["name", "camper", "full name", "child", "camper name"]).trim();
        const first = pickFirst(r, ["first name", "first", "firstname", "given name"]).trim();
        const last = pickFirst(r, ["last name", "last", "lastname", "surname", "family name"]).trim();
        const name = fullName || [first, last].filter(Boolean).join(" ").trim();
        if (!name) { skipped++; return; }
        const cabinName = pickFirst(r, ["cabin", "cabin name"]).trim();
        if (cabinName) { hasCabinCol = true; cabinUpdates.push({ name, cabin: cabinName }); }
        parsed.push({
          id: `c-${Date.now()}-${idx}`,
          name,
          division: pickFirst(r, ["division", "group", "age group", "grade"]).trim(),
          town: pickFirst(r, ["town", "city", "hometown", "village", "primary childhood homecity", "home city", "primary city"]).trim(),
          gender: pickFirst(r, ["gender", "sex"]).trim(),
          requests: splitList(pickFirst(r, ["requests", "request", "friends", "with", "share group with", "share with"])),
          disrequests: splitList(pickFirst(r, ["disrequests", "do not pair", "do_not_pair", "avoid", "not with", "do not share group with", "do not share with"])),
        });
      });

      // If they explicitly listed cabins, honor that (legacy behavior).
      if (hasCabinCol && parsed.every((p) => !p.division && !p.town && !p.requests?.length)) {
        let added = 0, createdCabins = 0;
        const updates = cabins.map((c) => ({ ...c, campers: [...c.campers] }));
        const updatesByName = new Map(updates.map((c) => [c.name.toLowerCase(), c]));
        for (const row of cabinUpdates) {
          let cabin = updatesByName.get(row.cabin.toLowerCase());
          if (!cabin) {
            cabin = { id: `cabin-${Date.now()}-${createdCabins}`, name: row.cabin, capacity: 8, campers: [] };
            updates.push(cabin);
            updatesByName.set(row.cabin.toLowerCase(), cabin);
            createdCabins++;
          }
          if (cabin.campers.length >= cabin.capacity) { skipped++; continue; }
          cabin.campers.push({ id: `c-${Date.now()}-${added}`, name: row.name });
          added++;
        }
        setCabins([...updates]);
        toast.success(`Imported ${added} camper${added === 1 ? "" : "s"}` +
          (createdCabins ? `, created ${createdCabins} cabin${createdCabins === 1 ? "" : "s"}` : "") +
          (skipped ? `, skipped ${skipped}` : "") + ".");
        return;
      }

      // Otherwise queue for the optimizer. We DON'T clear existing cabins here —
      // the optimizer itself reuses cabin shells and only replaces them when it runs.
      setPendingImport(parsed);
      setOptimizeOpen(true);
      if (skipped) toast.message(`Loaded ${parsed.length} campers (${skipped} skipped — missing name).`);
      else toast.message(`Loaded ${parsed.length} campers — ready to optimize.`);
    } catch (e: any) {
      toast.error("Import error: " + (e?.message || String(e)));
    }
  };

  const handleRunOptimize = () => {
    if (!pendingImport?.length) { toast.error("No campers loaded."); return; }
    const detailById = new Map(pendingImport.map((c) => [c.id, c]));
    const { cabins: optCabins } = optimizeCabins(pendingImport, {
      defaultCapacity: Math.max(1, Number(optimizeCapacity) || 8),
      coedDivisions: COED_DIVISIONS,
    });
    if (!optCabins.length) { toast.error("Optimizer produced no cabins."); return; }

    const enrich = (cm: { id: string; name: string }) => {
      const d = detailById.get(cm.id);
      return d
        ? { id: cm.id, name: cm.name, town: d.town, gender: d.gender, division: d.division, requests: d.requests, disrequests: d.disrequests }
        : { id: cm.id, name: cm.name };
    };

    // Reuse existing (now-empty) cabins where possible — match by division+gender.
    // Only create new cabins when we run out of matching shells.
    const existing = cabins.map((c) => ({ ...c, campers: [] as Camper[] }));
    const used = new Set<string>();
    const final: typeof existing = [];
    let createdCount = 0;

    optCabins.forEach((opt) => {
      const match = existing.find((ex) =>
        !used.has(ex.id) &&
        (ex.ageGroup || "").toLowerCase() === (opt.ageGroup || "").toLowerCase() &&
        (ex.gender || "").toLowerCase() === (opt.gender || "").toLowerCase()
      );
      if (match) {
        used.add(match.id);
        final.push({
          ...match,
          capacity: Math.max(match.capacity, opt.capacity),
          campers: opt.campers.map(enrich),
        });
      } else {
        createdCount++;
        final.push({
          id: opt.id,
          name: opt.name,
          capacity: opt.capacity,
          gender: opt.gender,
          ageGroup: opt.ageGroup,
          campers: opt.campers.map(enrich),
        });
      }
    });

    // Keep any remaining unused existing cabins (empty shells) so the user's layout survives.
    existing.forEach((ex) => { if (!used.has(ex.id)) final.push(ex); });

    setCabins(final);
    setOptimizeOpen(false);
    setPendingImport(null);
    const placed = optCabins.reduce((s, c) => s + c.campers.length, 0);
    toast.success(
      `Placed ${placed} camper${placed === 1 ? "" : "s"} across ${optCabins.length} cabin${optCabins.length === 1 ? "" : "s"}` +
      (createdCount ? ` (added ${createdCount} new).` : ".")
    );
  };

  const handleDownloadTemplate = () => {
    const csv =
      "name,division,town,gender,requests,disrequests\n" +
      "Emma J.,Pre-K,Glen Cove,Girl,\"Mia T., Sophia C.\",\n" +
      "Mia T.,Pre-K,Glen Cove,Girl,Emma J.,\n" +
      "Liam P.,3rd Grade,Roslyn,Boy,Noah W.,Lucas A.\n" +
      "Noah W.,3rd Grade,Roslyn,Boy,Liam P.,\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "bunking-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const totalCapacity = cabins.reduce((s, c) => s + c.capacity, 0);
  const totalAssigned = cabins.reduce((s, c) => s + c.campers.length, 0);
  const utilizationPct = totalCapacity ? Math.round((totalAssigned / totalCapacity) * 100) : 0;

  const handleDragStart = (camperId: string, fromCabinId: string) => {
    if (locked) return;
    setDragItem({ camperId, fromCabinId });
  };

  const handleDragOver = (e: React.DragEvent, cabinId: string) => {
    e.preventDefault();
    setDragOverCabin(cabinId);
  };

  const handleDrop = (toCabinId: string) => {
    if (!dragItem || locked) return;
    const { camperId, fromCabinId } = dragItem;
    if (fromCabinId === toCabinId) { setDragItem(null); setDragOverCabin(null); return; }

    setCabins((prev) => {
      const fromCabin = prev.find((c) => c.id === fromCabinId);
      const toCabin = prev.find((c) => c.id === toCabinId);
      if (!fromCabin || !toCabin) return prev;
      if (toCabin.campers.length >= toCabin.capacity) return prev;

      const camper = fromCabin.campers.find((c) => c.id === camperId);
      if (!camper) return prev;

      return prev.map((cabin) => {
        if (cabin.id === fromCabinId) return { ...cabin, campers: cabin.campers.filter((c) => c.id !== camperId) };
        if (cabin.id === toCabinId) return { ...cabin, campers: [...cabin.campers, camper] };
        return cabin;
      });
    });
    setDragItem(null);
    setDragOverCabin(null);
  };

  const removeCamper = (cabinId: string, camperId: string) => {
    if (locked) return;
    setCabins((prev) =>
      prev.map((c) => c.id === cabinId ? { ...c, campers: c.campers.filter((cm) => cm.id !== camperId) } : c)
    );
  };

  if (!currentCompany) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bunking Boards</h1>
          <p className="text-muted-foreground mt-1">
            Group campers into cabins — season {currentSeason}
            {rosterCount != null ? ` · ${rosterCount} on roster` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="default"
            size="sm"
            onClick={handleLoadFromRoster}
            disabled={loadingRoster || locked}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingRoster ? "animate-spin" : ""}`} />
            Load from Roster
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCSVImport(f);
              if (e.target) e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setEditCabinId(null); setNewCabin({ name: "", capacity: 8, gender: "", ageGroup: "" }); setAddCabinOpen(true); }} className="gap-1.5 text-xs">
            <Home className="h-3.5 w-3.5" /> Add Cabin
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setOptimizeCapacity(8); setPendingImport(cabins.flatMap((c) => c.campers.map((cm) => ({ id: cm.id, name: cm.name, division: c.ageGroup, gender: cm.gender, town: cm.town, requests: cm.requests, disrequests: cm.disrequests })))); setOptimizeOpen(true); }} className="gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" /> Auto-Optimize
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setNewCamper({ name: "", cabinId: cabins[0]?.id ?? "" }); setAddCamperOpen(true); }} className="gap-1.5 text-xs">
            <UserPlus className="h-3.5 w-3.5" /> Add Camper
          </Button>
          <Button
            variant={locked ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setLocked(!locked)}
          >
            {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            {locked ? "Board Locked" : "Lock Board"}
          </Button>
        </div>
      </div>

      {/* Utilization Analytics */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="overflow-hidden border-border/50 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{totalAssigned}</p>
                <p className="text-xs text-muted-foreground">Campers Assigned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/50 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2"><BarChart3 className="h-5 w-5 text-blue-500" /></div>
              <div>
                <p className="text-2xl font-bold">{totalCapacity}</p>
                <p className="text-xs text-muted-foreground">Total Capacity</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/50 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2"><BarChart3 className="h-5 w-5 text-green-500" /></div>
              <div>
                <p className="text-2xl font-bold">{utilizationPct}%</p>
                <p className="text-xs text-muted-foreground">Utilization Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/50 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/10 p-2"><Users className="h-5 w-5 text-yellow-600" /></div>
              <div>
                <p className="text-2xl font-bold">{totalCapacity - totalAssigned}</p>
                <p className="text-xs text-muted-foreground">Open Spots</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cabin boards */}
      {cabins.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <Users className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-medium">No cabins yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Click <strong>Load from Roster</strong> to pull {currentSeason} campers from North Shore, then run the optimizer.
              Or add cabins manually / import a CSV.
            </p>
            <Button onClick={handleLoadFromRoster} disabled={loadingRoster} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loadingRoster ? "animate-spin" : ""}`} />
              Load from Roster
            </Button>
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cabins.map((cabin) => {
          const pct = Math.round((cabin.campers.length / cabin.capacity) * 100);
          const isFull = cabin.campers.length >= cabin.capacity;
          const isDragOver = dragOverCabin === cabin.id && !isFull;

          return (
            <Card
              key={cabin.id}
              className={`transition-all ${isDragOver ? "ring-2 ring-primary shadow-lg" : ""} ${locked ? "opacity-90" : ""}`}
              onDragOver={(e) => handleDragOver(e, cabin.id)}
              onDragLeave={() => setDragOverCabin(null)}
              onDrop={() => handleDrop(cabin.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm">{cabin.name}</CardTitle>
                    <div className="flex gap-1.5 mt-1">
                      {cabin.gender && <Badge variant="secondary" className="text-[10px]">{cabin.gender}</Badge>}
                      {cabin.ageGroup && <Badge variant="secondary" className="text-[10px]">Ages {cabin.ageGroup}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant="secondary"
                      className={
                        isFull ? "bg-yellow-500/10 text-yellow-600" :
                        cabin.campers.length === 0 ? "bg-muted text-muted-foreground" :
                        "bg-green-500/10 text-green-600"
                      }
                    >
                      {cabin.campers.length}/{cabin.capacity}
                    </Badge>
                    {!locked && (
                      <>
                        <button
                          onClick={() => openEditCabin(cabin)}
                          className="text-muted-foreground hover:text-primary p-1"
                          title="Edit cabin"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteCabin(cabin.id, cabin.name)}
                          className="text-muted-foreground hover:text-destructive p-1"
                          title="Delete cabin"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 min-h-[60px]">
                  {cabin.campers.map((camper) => (
                    <div
                      key={camper.id}
                      draggable={!locked}
                      onDragStart={() => handleDragStart(camper.id, cabin.id)}
                      className={`flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm ${
                        locked ? "" : "cursor-grab active:cursor-grabbing hover:shadow-sm"
                      } transition-shadow`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedCamper({ camper, cabinName: cabin.name })}
                        className="flex items-center gap-2 text-left flex-1 min-w-0 hover:text-primary transition-colors"
                        title="View camper details"
                      >
                        {!locked && <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary shrink-0">
                          {camper.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <span className="truncate">{camper.name}</span>
                      </button>
                      {!locked && (
                        <button onClick={() => removeCamper(cabin.id, camper.id)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {/* Empty slots */}
                  {Array.from({ length: cabin.capacity - cabin.campers.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground text-center">
                      {locked ? "—" : "Drop camper here"}
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <Progress value={pct} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}

      {/* Add Cabin dialog */}
      <Dialog open={addCabinOpen} onOpenChange={setAddCabinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCabinId ? "Edit Cabin" : "Add Cabin"}</DialogTitle>
            <DialogDescription>{editCabinId ? "Update this cabin's name, capacity, and grouping." : "Create a new cabin for camper assignments."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="cabin-name">Cabin Name</Label>
              <Input id="cabin-name" autoFocus value={newCabin.name} onChange={(e) => setNewCabin({ ...newCabin, name: e.target.value })} placeholder="e.g. Cabin G — Willow" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cabin-capacity">Capacity</Label>
                <Input id="cabin-capacity" type="number" min={1} value={newCabin.capacity} onChange={(e) => setNewCabin({ ...newCabin, capacity: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={newCabin.gender} onValueChange={(v) => setNewCabin({ ...newCabin, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Girls">Girls</SelectItem>
                    <SelectItem value="Boys">Boys</SelectItem>
                    <SelectItem value="Co-ed">Co-ed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="cabin-age">Age Group <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="cabin-age" value={newCabin.ageGroup} onChange={(e) => setNewCabin({ ...newCabin, ageGroup: e.target.value })} placeholder="e.g. 10-12" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCabinOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCabin}>{editCabinId ? "Save Changes" : "Add Cabin"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Camper dialog */}
      <Dialog open={addCamperOpen} onOpenChange={setAddCamperOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Camper</DialogTitle>
            <DialogDescription>Add a camper directly to a cabin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="bk-camper-name">Camper Name</Label>
              <Input id="bk-camper-name" autoFocus value={newCamper.name} onChange={(e) => setNewCamper({ ...newCamper, name: e.target.value })} placeholder="e.g. Sarah K." />
            </div>
            <div>
              <Label>Cabin</Label>
              <Select value={newCamper.cabinId} onValueChange={(v) => setNewCamper({ ...newCamper, cabinId: v })}>
                <SelectTrigger><SelectValue placeholder="Select a cabin" /></SelectTrigger>
                <SelectContent>
                  {cabins.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={c.campers.length >= c.capacity}>
                      {c.name} ({c.campers.length}/{c.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCamperOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCamper}>Add Camper</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Optimize dialog */}
      <Dialog open={optimizeOpen} onOpenChange={(o) => { setOptimizeOpen(o); if (!o) setPendingImport(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auto-Optimize Cabins</DialogTitle>
            <DialogDescription>
              Loaded {pendingImport?.length ?? 0} campers. We'll group by <strong>town first</strong>, then mutual requests, then single requests, while honoring do-not-pair rules. Nursery & Pre-K stay co-ed; everyone else splits by gender.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="opt-cap">Default cabin capacity</Label>
              <Input id="opt-cap" type="number" min={1} max={30} value={optimizeCapacity}
                onChange={(e) => setOptimizeCapacity(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">
                We'll spin up as many cabins per division as needed. You can rename/edit any cabin afterward.
              </p>
            </div>
            {pendingImport && pendingImport.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1 max-h-32 overflow-auto">
                <div className="font-medium text-foreground">Preview</div>
                <div>Divisions: {[...new Set(pendingImport.map((c) => c.division || "—"))].join(", ")}</div>
                <div>Towns: {[...new Set(pendingImport.map((c) => c.town || "—"))].slice(0, 8).join(", ")}{pendingImport.length > 8 ? "…" : ""}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOptimizeOpen(false); setPendingImport(null); }}>Cancel</Button>
            <Button onClick={handleRunOptimize} className="gap-1.5">
              <Sparkles className="h-4 w-4" /> Run Optimizer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camper detail dialog */}
      <Dialog open={!!selectedCamper} onOpenChange={(o) => !o && setSelectedCamper(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {selectedCamper?.camper.name.split(" ").map((n) => n[0]).join("")}
              </div>
              {selectedCamper?.camper.name}
            </DialogTitle>
            <DialogDescription>
              Currently in <strong>{selectedCamper?.cabinName}</strong>
            </DialogDescription>
          </DialogHeader>
          {selectedCamper && (
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Division</p>
                  <p className="font-medium">{selectedCamper.camper.division || <span className="text-muted-foreground">—</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Town</p>
                  <p className="font-medium">{selectedCamper.camper.town || <span className="text-muted-foreground">—</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gender</p>
                  <p className="font-medium">{selectedCamper.camper.gender || <span className="text-muted-foreground">—</span>}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Requests (wants to bunk with)</p>
                {selectedCamper.camper.requests?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCamper.camper.requests.map((r, i) => (
                      <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">{r}</Badge>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground italic">None listed</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Do-not-pair</p>
                {selectedCamper.camper.disrequests?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCamper.camper.disrequests.map((r, i) => (
                      <Badge key={i} variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">{r}</Badge>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground italic">None listed</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCamper(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}