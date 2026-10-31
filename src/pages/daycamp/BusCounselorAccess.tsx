import { useCallback, useEffect, useMemo, useState } from "react";
import { Bus, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useCampOperationalDate } from "@/hooks/useCampOperationalDate";
import { useAuth } from "@/contexts/AuthContext";
import { loadTransportBusLabels } from "@/lib/transportBusLabels";
import { FrontOfficeBackLink } from "@/components/daycamp/FrontOfficeBackLink";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type NestUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  bus_attendance_only: boolean;
  assigned_transport_bus: string | null;
};

export default function BusCounselorAccess() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeason();
  const { operationalDateString } = useCampOperationalDate();
  const { hasPagePermission, isSuperAdmin, userRole } = useAuth();
  const companyId = currentCompany?.id;

  const canManage = useMemo(
    () =>
      isSuperAdmin ||
      userRole === "admin" ||
      (companyId ? hasPagePermission(companyId, "transport-admin") : false),
    [isSuperAdmin, userRole, companyId, hasPagePermission],
  );

  const [users, setUsers] = useState<NestUserRow[]>([]);
  const [busLabels, setBusLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draftBus, setDraftBus] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [profilesResult, buses] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, bus_attendance_only, assigned_transport_bus")
        .eq("company_id", companyId)
        .eq("approved", true)
        .order("full_name"),
      loadTransportBusLabels(supabase, companyId, currentSeason, operationalDateString),
    ]);

    if (profilesResult.error) {
      toast.error(profilesResult.error.message);
      setLoading(false);
      return;
    }

    const rows = (profilesResult.data ?? []) as NestUserRow[];
    setUsers(rows);
    setBusLabels(buses.length ? buses : ["Bus 1", "Bus 2", "Bus 3", "Bus 4", "Bus 5"]);
    const busDraft: Record<string, string> = {};
    for (const row of rows) {
      if (row.assigned_transport_bus) busDraft[row.id] = row.assigned_transport_bus;
    }
    setDraftBus(busDraft);
    setLoading(false);
  }, [companyId, currentSeason, operationalDateString]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveAccess = async (userId: string, busAttendanceOnly: boolean, assignedBus: string) => {
    setSavingId(userId);
    const { error } = await supabase.rpc("set_bus_counselor_access", {
      _user_id: userId,
      _bus_attendance_only: busAttendanceOnly,
      _assigned_bus: assignedBus,
    });
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(busAttendanceOnly ? "Bus counselor access saved" : "Full Nest access restored");
    await load();
  };

  const handleToggle = async (row: NestUserRow, enabled: boolean) => {
    if (enabled) {
      const bus = draftBus[row.id]?.trim();
      if (!bus) {
        toast.error("Choose a bus first");
        return;
      }
      await saveAccess(row.id, true, bus);
      return;
    }
    await saveAccess(row.id, false, "");
  };

  const handleBusChange = async (row: NestUserRow, bus: string) => {
    setDraftBus((prev) => ({ ...prev, [row.id]: bus }));
    if (row.bus_attendance_only) {
      await saveAccess(row.id, true, bus);
    }
  };

  if (!canManage) {
    return (
      <div className="space-y-4 p-6">
        <FrontOfficeBackLink />
        <p className="text-sm text-muted-foreground">Transport Admin access is required to manage bus counselors.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FrontOfficeBackLink />
      <div>
        <h1 className="page-header flex items-center gap-2">
          <ClipboardList className="h-6 w-6" /> Bus counselor access
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Turn on <strong>Bus attendance only</strong> for a Nest login and assign their bus. They will only see Bus
          Attendance and Bus Check-Ins for that bus. Staff with admin or transport manager roles are not limited.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bus className="h-4 w-4" /> Approved Nest users — {currentCompany?.name}
          </CardTitle>
          <CardDescription>
            Counselors may need to sign out and back in after you change access. Buses listed from today&apos;s run board.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approved users for this camp yet.</p>
          ) : (
            users.map((row) => {
              const busy = savingId === row.id;
              const busValue = draftBus[row.id] ?? row.assigned_transport_bus ?? "";
              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.full_name || "No name"}</p>
                    <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                    {row.bus_attendance_only ? (
                      <Badge variant="secondary" className="mt-2 text-[10px]">
                        Bus attendance only · {row.assigned_transport_bus}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Assigned bus</Label>
                      <Select
                        value={busValue || undefined}
                        onValueChange={(v) => void handleBusChange(row, v)}
                        disabled={busy}
                      >
                        <SelectTrigger className="h-9 w-[140px] text-xs">
                          <SelectValue placeholder="Select bus" />
                        </SelectTrigger>
                        <SelectContent>
                          {busLabels.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pb-0.5">
                      <Switch
                        id={`bus-only-${row.id}`}
                        checked={row.bus_attendance_only}
                        disabled={busy}
                        onCheckedChange={(v) => void handleToggle(row, v)}
                      />
                      <Label htmlFor={`bus-only-${row.id}`} className="text-xs whitespace-nowrap">
                        Bus attendance only
                      </Label>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
