import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useToast } from "@/hooks/use-toast";
import { Search, DollarSign } from "lucide-react";
import { getOwlPayBalanceTone, OWL_PAY_MAX_OVERDRAFT } from "@/lib/owlPayBalanceUtils";

interface CamperBalance {
  id: string;
  name: string;
  owl_pay_balance: number;
  person_id: string | null;
}

interface StaffSpend {
  id: string;
  name: string;
  person_id: string | null;
  total_spent: number;
}

type BalanceAudience = "campers" | "staff";

const OwlPayBalanceManagement = () => {
  const [campers, setCampers] = useState<CamperBalance[]>([]);
  const [staffRows, setStaffRows] = useState<StaffSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [audience, setAudience] = useState<BalanceAudience>("campers");
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();
  const { toast } = useToast();

  const fetchCampers = useCallback(async () => {
    if (!currentCompany?.id || !selectedSeason) return;
    const { data, error } = await supabase
      .from("children")
      .select("id, name, owl_pay_balance, person_id")
      .eq("company_id", currentCompany.id)
      .eq("season", selectedSeason)
      .neq("status", "inactive")
      .order("name");
    if (error) {
      toast({ title: "Error loading campers", variant: "destructive" });
      return;
    }
    setCampers((data as any) || []);
    setLoading(false);
  }, [currentCompany?.id, selectedSeason, toast]);

  const fetchStaffSpend = useCallback(async () => {
    if (!currentCompany?.id || !selectedSeason) return;
    const [{ data: staffList, error: staffErr }, { data: txs, error: txErr }] = await Promise.all([
      supabase
        .from("staff")
        .select("id, name, person_id")
        .eq("company_id", currentCompany.id)
        .eq("season", selectedSeason)
        .neq("status", "inactive")
        .order("name"),
      supabase
        .from("owl_pay_transactions" as any)
        .select("staff_id, amount")
        .eq("company_id", currentCompany.id)
        .eq("transaction_type", "purchase")
        .not("staff_id", "is", null),
    ]);

    if (staffErr) {
      toast({ title: "Error loading staff", variant: "destructive" });
      return;
    }
    if (txErr) {
      toast({ title: "Error loading staff purchases", variant: "destructive" });
      return;
    }

    const spentByStaff = new Map<string, number>();
    for (const tx of txs || []) {
      const sid = (tx as any).staff_id as string;
      if (!sid) continue;
      spentByStaff.set(sid, (spentByStaff.get(sid) || 0) + Number((tx as any).amount || 0));
    }

    const rows: StaffSpend[] = (staffList || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      person_id: s.person_id,
      total_spent: spentByStaff.get(s.id) || 0,
    }));
    setStaffRows(rows);
    setLoading(false);
  }, [currentCompany?.id, selectedSeason, toast]);

  const refresh = useCallback(() => {
    setLoading(true);
    if (audience === "campers") fetchCampers();
    else fetchStaffSpend();
  }, [audience, fetchCampers, fetchStaffSpend]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!currentCompany?.id || !selectedSeason) return;
    const channel = supabase
      .channel(`owlpay-web-balances-${currentCompany.id}-${selectedSeason}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "children", filter: `company_id=eq.${currentCompany.id}` },
        () => audience === "campers" && fetchCampers()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff", filter: `company_id=eq.${currentCompany.id}` },
        () => audience === "staff" && fetchStaffSpend()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "owl_pay_transactions", filter: `company_id=eq.${currentCompany.id}` },
        () => audience === "staff" && fetchStaffSpend()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, selectedSeason, audience, fetchCampers, fetchStaffSpend]);

  const filteredCampers = campers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.person_id || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStaff = staffRows.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.person_id || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCamperBalance = campers.reduce((sum, c) => sum + Number(c.owl_pay_balance), 0);
  const totalStaffSpend = staffRows.reduce((sum, s) => sum + s.total_spent, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">View:</span>
          <Button variant={audience === "campers" ? "default" : "outline"} size="sm" onClick={() => setAudience("campers")}>
            Campers
          </Button>
          <Button variant={audience === "staff" ? "default" : "outline"} size="sm" onClick={() => setAudience("staff")}>
            Staff
          </Button>
        </div>
      </div>

      {audience === "campers" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total campers</p>
              <p className="text-2xl font-bold text-primary">{campers.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total balance</p>
              <p className="text-2xl font-bold text-green-600">${totalCamperBalance.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Avg balance</p>
              <p className="text-2xl font-bold text-primary">
                ${campers.length > 0 ? (totalCamperBalance / campers.length).toFixed(2) : "0.00"}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total staff</p>
              <p className="text-2xl font-bold text-primary">{staffRows.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total POS spend</p>
              <p className="text-2xl font-bold text-green-600">${totalStaffSpend.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Avg spend per staff</p>
              <p className="text-2xl font-bold text-primary">
                ${staffRows.length > 0 ? (totalStaffSpend / staffRows.length).toFixed(2) : "0.00"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              {audience === "campers" ? "Camper balances" : "Staff POS totals"}
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={audience === "campers" ? "Search campers..." : "Search staff..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {audience === "campers"
              ? `Full balance = CampMinder deposits minus canteen spend. New POS purchases stop at −$${OWL_PAY_MAX_OVERDRAFT} credit limit.`
              : "Staff purchases use running POS totals (sum of OwlPay purchase rows); prepaid balances apply to campers."}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Loading...</p>
          ) : audience === "campers" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Person ID</TableHead>
                  <TableHead>Full balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampers.map((camper) => {
                  const balance = Number(camper.owl_pay_balance);
                  const tone = getOwlPayBalanceTone(balance);
                  return (
                  <TableRow key={camper.id}>
                    <TableCell className="font-medium">{camper.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{camper.person_id || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          tone === "negative" || tone === "low"
                            ? "bg-destructive text-destructive-foreground"
                            : tone === "medium"
                              ? "bg-yellow-500 text-white"
                              : "bg-green-500 text-white"
                        }
                      >
                        ${balance.toFixed(2)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Person ID</TableHead>
                  <TableHead>Total POS spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.person_id || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.total_spent > 0 ? "default" : "secondary"}>${s.total_spent.toFixed(2)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OwlPayBalanceManagement;
