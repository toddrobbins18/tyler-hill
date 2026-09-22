import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Bus,
  CheckCircle2,
  ClipboardList,
  Clock,
  Radio,
  Truck,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useCampOperationalDate } from "@/hooks/useCampOperationalDate";
import {
  ABSENCE_TYPE_LABELS,
  approveDismissalAbsence,
  approveDismissalNurse,
  approveDismissalPickup,
  approveDismissalSwim,
  DISMISSAL_REALTIME_TABLES,
  fetchDismissalDashboard,
  PICKUP_CHANGE_LABELS,
  toggleOfficeChangeDone,
  type DismissalDashboardData,
} from "@/lib/dismissalDashboard";
import { northShoreBusTransportEnabled } from "@/lib/camps";
import { getFrontOfficeTransportMenuItems } from "@/lib/dayCampMenu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function FrontOfficeDashboard() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const { now, operationalDate, operationalDateString } = useCampOperationalDate();
  const [selectedDate, setSelectedDate] = useState(operationalDateString);
  const [data, setData] = useState<DismissalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    setSelectedDate(operationalDateString);
  }, [operationalDateString]);
  const showTransport = northShoreBusTransportEnabled(currentCompany);
  const frontOfficeTransportLinks = useMemo(
    () => (currentCompany ? getFrontOfficeTransportMenuItems(currentCompany) : []),
    [currentCompany],
  );

  const load = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const next = await fetchDismissalDashboard(
        supabase,
        currentCompany.id,
        currentSeason,
        selectedDate,
      );
      setData(next);
    } catch (err) {
      console.error("[FrontOfficeDashboard] load error:", err);
      toast.error("Failed to load dismissal dashboard");
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, currentSeason, selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!currentCompany?.id) return;

    const channel = supabase.channel(`front-office-${currentCompany.id}`);
    for (const table of DISMISSAL_REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `company_id=eq.${currentCompany.id}` },
        () => {
          void load();
        },
      );
    }

    channel.subscribe((status) => {
      setLive(status === "SUBSCRIBED");
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, load]);

  const pendingTodayCount = useMemo(() => {
    if (!data) return 0;
    return (
      data.pendingPickups.length +
      data.pendingAbsences.length +
      data.pendingNurse.length +
      data.pendingSwim.length
    );
  }, [data]);

  const openOfficeCount = useMemo(
    () => data?.officeChanges.filter((r) => !r.done).length ?? 0,
    [data],
  );

  const handleApprovePickup = async (id: string) => {
    const { error } = await approveDismissalPickup(supabase, id);
    if (error) toast.error(error.message);
    else {
      toast.success("Pickup approved — will appear on change sheets");
      void load();
    }
  };

  const handleApproveAbsence = async (id: string) => {
    const { error } = await approveDismissalAbsence(supabase, id);
    if (error) toast.error(error.message);
    else {
      toast.success("Absence approved");
      void load();
    }
  };

  const handleApproveNurse = async (id: string) => {
    const { error } = await approveDismissalNurse(supabase, id);
    if (error) toast.error(error.message);
    else {
      toast.success("Nurse sent-home approved — will appear on change sheets");
      void load();
    }
  };

  const handleApproveSwim = async (id: string) => {
    const { error } = await approveDismissalSwim(supabase, id);
    if (error) toast.error(error.message);
    else {
      toast.success("Swim lesson approved — will appear on change sheets");
      void load();
    }
  };

  const handleToggleOffice = async (id: string, done: boolean) => {
    const { error } = await toggleOfficeChangeDone(supabase, id, done);
    if (error) toast.error(error.message);
    else void load();
  };

  const formattedDate = operationalDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Front Office</h1>
            <Badge
              variant="outline"
              className={live ? "border-emerald-500 text-emerald-700 gap-1" : "text-muted-foreground gap-1"}
            >
              <Radio className={`h-3 w-3 ${live ? "text-emerald-500 animate-pulse" : ""}`} />
              {live ? "Live" : "Connecting…"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Real-time dismissal control — parent and office changes for {currentCompany?.name}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>{formattedDate}</p>
          <p className="font-semibold text-foreground">{formattedTime}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-auto"
        />
        <Button variant="outline" size="sm" onClick={() => setSelectedDate(operationalDateString)}>
          Today
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={pendingTodayCount > 0 ? "border-amber-300 bg-amber-50/40" : ""}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{pendingTodayCount}</div>
            <p className="text-xs text-muted-foreground">Needs approval today</p>
            {(data?.allPendingCount ?? 0) > pendingTodayCount ? (
              <p className="text-xs text-amber-700 mt-1">
                +{(data?.allPendingCount ?? 0) - pendingTodayCount} pending other dates
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{openOfficeCount}</div>
            <p className="text-xs text-muted-foreground">Open office changes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {(data?.approvedPickups.length ?? 0) +
                (data?.approvedAbsences.length ?? 0) +
                (data?.approvedNurse.length ?? 0) +
                (data?.approvedSwim.length ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">Approved for {selectedDate}</p>
          </CardContent>
        </Card>
        {showTransport ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{data?.routeCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Routes · AM {data?.busAmSubmitted ? "✓" : "—"} · PM {data?.busPmSubmitted ? "✓" : "—"}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {showTransport && frontOfficeTransportLinks.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {frontOfficeTransportLinks.map((item) => (
            <Button key={item.menuId} variant="outline" size="sm" asChild>
              <Link to={item.url}>
                <item.icon className="mr-2 h-4 w-4" />
                {item.title}
              </Link>
            </Button>
          ))}
          <Button variant="outline" size="sm" asChild>
            <Link to="/day-camp/office-changes">+ Log office change</Link>
          </Button>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Incoming — needs approval
              </CardTitle>
              <CardDescription>
                Parent submissions for {format(new Date(`${selectedDate}T12:00:00`), "MMM d, yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!data?.pendingPickups.length &&
              !data?.pendingAbsences.length &&
              !data?.pendingNurse.length &&
              !data?.pendingSwim.length ? (
                <p className="text-sm text-muted-foreground">No pending changes for this date.</p>
              ) : null}
              {data?.pendingPickups.map((p) => (
                <div key={p.id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{p.camperName}</p>
                      <p className="text-xs text-amber-800">Pickup · {PICKUP_CHANGE_LABELS[p.change_type] ?? p.change_type}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.familyName}
                        {p.pickup_time ? ` · ${p.pickup_time}` : ""}
                        {p.pickup_person_name ? ` · ${p.pickup_person_name}` : ""}
                      </p>
                      {p.notes ? <p className="text-xs italic mt-1">{p.notes}</p> : null}
                    </div>
                    <Button size="sm" onClick={() => void handleApprovePickup(p.id)}>
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
              {data?.pendingAbsences.map((a) => (
                <div key={a.id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{a.camperName}</p>
                      <p className="text-xs text-amber-800">
                        Absence · {ABSENCE_TYPE_LABELS[a.absence_type] ?? a.absence_type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {a.familyName}
                        {a.arrival_time ? ` · Arrives ${a.arrival_time}` : ""}
                        {a.reason ? ` · ${a.reason}` : ""}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => void handleApproveAbsence(a.id)}>
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
              {data?.pendingNurse.map((n) => (
                <div key={n.id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{n.camper_name}</p>
                      <p className="text-xs text-amber-800">Nurse · Sent home</p>
                      {n.reason ? <p className="text-sm text-muted-foreground">{n.reason}</p> : null}
                    </div>
                    <Button size="sm" onClick={() => void handleApproveNurse(n.id)}>
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
              {data?.pendingSwim.map((s) => (
                <div key={s.id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{s.camperName}</p>
                      <p className="text-xs text-amber-800">Swim lesson · Parent confirmed</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(s.scheduled_at), "MMM d · h:mm a")}
                        {s.instructor ? ` · ${s.instructor}` : ""}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => void handleApproveSwim(s.id)}>
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Office changes today</CardTitle>
                <CardDescription>Phone / walk-in updates from the front desk</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {!data?.officeChanges.length ? (
                  <p className="text-sm text-muted-foreground">No office changes logged for this date.</p>
                ) : (
                  data.officeChanges.map((row) => (
                    <div key={row.id} className="flex items-start gap-3 rounded-md border p-3">
                      <Checkbox
                        checked={row.done}
                        onCheckedChange={(checked) => void handleToggleOffice(row.id, Boolean(checked))}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${row.done ? "line-through text-muted-foreground" : ""}`}>
                          {row.camper_name}
                          {row.group_division ? ` · ${row.group_division}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">{row.note}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base text-emerald-800">Approved today</CardTitle>
                <CardDescription>Ready for transport and dismissal paperwork</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {!data?.approvedPickups.length &&
                !data?.approvedAbsences.length &&
                !data?.approvedNurse.length &&
                !data?.approvedSwim.length ? (
                  <p className="text-sm text-muted-foreground">Nothing approved yet for this date.</p>
                ) : null}
                {data?.approvedPickups.map((p) => (
                  <div key={p.id} className="text-sm rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                    <span className="font-medium">{p.camperName}</span>
                    {" — "}
                    {PICKUP_CHANGE_LABELS[p.change_type] ?? p.change_type}
                  </div>
                ))}
                {data?.approvedAbsences.map((a) => (
                  <div key={a.id} className="text-sm rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                    <span className="font-medium">{a.camperName}</span>
                    {" — "}
                    {ABSENCE_TYPE_LABELS[a.absence_type] ?? a.absence_type}
                  </div>
                ))}
                {data?.approvedNurse.map((n) => (
                  <div key={n.id} className="text-sm rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                    <span className="font-medium">{n.camper_name}</span>
                    {" — Nurse sent home"}
                  </div>
                ))}
                {data?.approvedSwim.map((s) => (
                  <div key={s.id} className="text-sm rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                    <span className="font-medium">{s.camperName}</span>
                    {" — Swim lesson (no bus)"}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
