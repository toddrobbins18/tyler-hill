import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/hooks/usePermissions";
import HealthCenterDayCampPanel from "@/components/health/HealthCenterDayCampPanel";

export default function Nurse() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const { getDivisionFilter, permissionsLoading } = usePermissions();
  const { toast } = useToast();

  const [children, setChildren] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChildren = useCallback(async () => {
    if (!currentCompany?.id) {
      setChildren([]);
      return;
    }

    const divisionFilter = getDivisionFilter();
    let query = supabase
      .from("children")
      .select(`
        id,
        name,
        group_name,
        division:divisions(id, name),
        leader:leader_id(id, name)
      `)
      .eq("status", "active")
      .eq("season", currentSeason)
      .eq("company_id", currentCompany.id);

    if (divisionFilter !== null && divisionFilter.length > 0) {
      query = query.in("division_id", divisionFilter);
    }

    const { data, error } = await query.order("name");
    if (error) {
      console.error("Error fetching children:", error);
      toast({ title: "Error loading campers", variant: "destructive" });
      setChildren([]);
      return;
    }
    setChildren(data ?? []);
  }, [currentCompany?.id, currentSeason, getDivisionFilter, toast]);

  const fetchStaff = useCallback(async () => {
    if (!currentCompany?.id) {
      setStaff([]);
      return;
    }

    const { data, error } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("status", "active")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .order("name");

    if (error) {
      console.error("Error fetching staff:", error);
      setStaff([]);
      return;
    }
    setStaff(data ?? []);
  }, [currentCompany?.id, currentSeason]);

  const fetchVisits = useCallback(async () => {
    if (!currentCompany?.id) {
      setVisits([]);
      return;
    }

    const { data, error } = await supabase
      .from("health_center_admissions")
      .select(`
        id,
        admitted_at,
        reason,
        treatment,
        incident_location,
        group_name,
        counselor_name,
        nurse_name,
        sent_home,
        called_home,
        notes,
        child_id,
        staff_id,
        children!fk_health_center_admissions_child_id ( id, name, division_id ),
        staff ( id, name )
      `)
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .not("checked_out_at", "is", null)
      .order("admitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching visits:", error);
      toast({ title: "Error loading visit log", variant: "destructive" });
      setVisits([]);
      return;
    }

    const divisionFilter = getDivisionFilter();
    if (divisionFilter !== null && divisionFilter.length > 0) {
      setVisits(
        (data ?? []).filter((row) => {
          if (!row.child_id) return true;
          return (
            row.children?.division_id &&
            divisionFilter.includes(row.children.division_id)
          );
        }),
      );
      return;
    }

    setVisits(data ?? []);
  }, [currentCompany?.id, currentSeason, getDivisionFilter, toast]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchChildren(), fetchStaff(), fetchVisits()]);
    setLoading(false);
  }, [fetchChildren, fetchStaff, fetchVisits]);

  useEffect(() => {
    if (permissionsLoading) return;
    void loadAll();
  }, [loadAll, permissionsLoading]);

  useEffect(() => {
    if (permissionsLoading || !currentCompany?.id) return;

    const channel = supabase
      .channel("day-camp-health-visits")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "health_center_admissions" },
        () => {
          void fetchVisits();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, permissionsLoading, fetchVisits]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Health Center</h1>
        <p className="text-muted-foreground">
          Log visits and track incidents — linked to camper and staff profiles.
        </p>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Loading…</p>
      ) : (
        <HealthCenterDayCampPanel
          children={children}
          staff={staff}
          visits={visits}
          onVisitLogged={() => {
            void fetchVisits();
          }}
        />
      )}
    </div>
  );
}
