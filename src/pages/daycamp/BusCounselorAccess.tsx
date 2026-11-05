import { useCallback, useEffect, useMemo, useState } from "react";
import { Bus, ClipboardList, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useCampOperationalDate } from "@/hooks/useCampOperationalDate";
import { useAuth } from "@/contexts/AuthContext";
import { loadTransportBusLabels } from "@/lib/transportBusLabels";
import { loadGroupRoster } from "@/lib/transportGroupAttendance";
import { FrontOfficeBackLink } from "@/components/daycamp/FrontOfficeBackLink";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  group_attendance_only: boolean;
  assigned_groups: string[];
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
  const [groupNames, setGroupNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draftBus, setDraftBus] = useState<Record<string, string>>({});
  const [draftGroups, setDraftGroups] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [profilesResult, buses, roster] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, bus_attendance_only, assigned_transport_bus, group_attendance_only, assigned_groups",
        )
        .eq("company_id", companyId)
        .eq("approved", true)
        .order("full_name"),
      loadTransportBusLabels(supabase, companyId, currentSeason, operationalDateString),
      loadGroupRoster(supabase, companyId, currentSeason),
    ]);

    if (profilesResult.error) {
      toast.error(profilesResult.error.message);
      setLoading(false);
      return;
    }

    const rows = ((profilesResult.data ?? []) as NestUserRow[]).map((row) => ({
      ...row,
      group_attendance_only: !!row.group_attendance_only,
      assigned_groups: (row.assigned_groups ?? []).map((name) => name.trim()).filter(Boolean),
    }));
    setUsers(rows);
    setBusLabels(buses.length ? buses : ["Bus 1", "Bus 2", "Bus 3", "Bus 4", "Bus 5"]);
    const names = [...new Set(roster.map((camper) => camper.groupName).filter((name) => name && name !== "Unassigned"))].sort(
      (a, b) => a.localeCompare(b),
    );
    setGroupNames(names);
    const busDraft: Record<string, string> = {};
    const groupDraft: Record<string, string[]> = {};
    for (const row of rows) {
      if (row.assigned_transport_bus) busDraft[row.id] = row.assigned_transport_bus;
      groupDraft[row.id] = row.assigned_groups;
    }
    setDraftBus(busDraft);
    setDraftGroups(groupDraft);
    setLoading(false);
  }, [companyId, currentSeason, operationalDateString]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveBusAccess = async (userId: string, busAttendanceOnly: boolean, assignedBus: string) => {
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
    toast.success(busAttendanceOnly ? "Bus counselor access saved" : "Full bus access restored");
    await load();
  };

  const saveGroupAccess = async (userId: string, groupAttendanceOnly: boolean, assigned: string[]) => {
    setSavingId(userId);
    const { error } = await supabase.rpc("set_group_counselor_access", {
      _user_id: userId,
      _group_attendance_only: groupAttendanceOnly,
      _assigned_groups: assigned,
    });
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(groupAttendanceOnly ? "Group counselor access saved" : "Full group access restored");
    await load();
  };

  const handleBusToggle = async (row: NestUserRow, enabled: boolean) => {
    if (enabled) {
      const bus = draftBus[row.id]?.trim();
      if (!bus) {
        toast.error("Choose a bus first");
        return;
      }
      await saveBusAccess(row.id, true, bus);
      return;
    }
    await saveBusAccess(row.id, false, "");
  };

  const handleBusChange = async (row: NestUserRow, bus: string) => {
    setDraftBus((prev) => ({ ...prev, [row.id]: bus }));
    if (row.bus_attendance_only) {
      await saveBusAccess(row.id, true, bus);
    }
  };

  const handleGroupToggle = async (row: NestUserRow, enabled: boolean) => {
    const selected = draftGroups[row.id] ?? row.assigned_groups;
    if (enabled) {
      if (!selected.length) {
        toast.error("Choose at least one group first");
        return;
      }
      await saveGroupAccess(row.id, true, selected);
      return;
    }
    await saveGroupAccess(row.id, false, []);
  };

  const handleGroupChecked = async (row: NestUserRow, groupName: string, checked: boolean) => {
    const current = draftGroups[row.id] ?? row.assigned_groups;
    const next = checked
      ? [...current.filter((name) => name !== groupName), groupName]
      : current.filter((name) => name !== groupName);
    setDraftGroups((prev) => ({ ...prev, [row.id]: next }));
    if (row.group_attendance_only) {
      if (!next.length) {
        toast.error("Keep at least one group selected");
        return;
      }
      await saveGroupAccess(row.id, true, next);
    }
  };

  if (!canManage) {
    return (
      <div className="space-y-4 p-6">
        <FrontOfficeBackLink />
        <p className="text-sm text-muted-foreground">Transport Admin access is required to manage counselor access.</p>
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
          Limit a Nest login to paperless tools. Bus attendance only shows Bus Attendance and Bus Check-Ins for one bus.
          Group attendance only shows Group Attendance for the groups you check. Staff with admin or transport manager
          roles are not limited.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bus className="h-4 w-4" /> Approved Nest users — {currentCompany?.name}
          </CardTitle>
          <CardDescription>
            Counselors may need to sign out and back in after you change access. Buses listed from today&apos;s run board.
            Groups listed from this season&apos;s roster.
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
              const selectedGroups = draftGroups[row.id] ?? row.assigned_groups;
              return (
                <div key={row.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{row.full_name || "No name"}</p>
                      <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {row.bus_attendance_only ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Bus attendance only · {row.assigned_transport_bus}
                          </Badge>
                        ) : null}
                        {row.group_attendance_only ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Group attendance only · {row.assigned_groups.join(", ")}
                          </Badge>
                        ) : null}
                      </div>
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
                          onCheckedChange={(v) => void handleBusToggle(row, v)}
                        />
                        <Label htmlFor={`bus-only-${row.id}`} className="text-xs whitespace-nowrap">
                          Bus attendance only
                        </Label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-md bg-muted/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> Assigned groups
                      </Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`group-only-${row.id}`}
                          checked={row.group_attendance_only}
                          disabled={busy}
                          onCheckedChange={(v) => void handleGroupToggle(row, v)}
                        />
                        <Label htmlFor={`group-only-${row.id}`} className="text-xs whitespace-nowrap">
                          Group attendance only
                        </Label>
                      </div>
                    </div>
                    {groupNames.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No camp groups on this season roster yet.</p>
                    ) : (
                      <div className="flex max-h-36 flex-wrap gap-x-3 gap-y-2 overflow-y-auto">
                        {groupNames.map((name) => {
                          const checked = selectedGroups.includes(name);
                          return (
                            <label key={name} className="flex items-center gap-1.5 text-xs">
                              <Checkbox
                                checked={checked}
                                disabled={busy}
                                onCheckedChange={(value) => void handleGroupChecked(row, name, value === true)}
                              />
                              {name}
                            </label>
                          );
                        })}
                      </div>
                    )}
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
