import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useToast } from "@/hooks/use-toast";
import { Search, DollarSign } from "lucide-react";

interface CamperBalance {
  id: string;
  name: string;
  owl_pay_balance: number;
  person_id: string;
}

const OwlPayBalanceManagement = () => {
  const [campers, setCampers] = useState<CamperBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();
  const { toast } = useToast();

  useEffect(() => { fetchCampers(); }, [currentCompany, selectedSeason]);

  const fetchCampers = async () => {
    if (!currentCompany?.id || !selectedSeason) return;
    const { data, error } = await supabase
      .from("children")
      .select("id, name, owl_pay_balance, person_id")
      .eq("company_id", currentCompany.id)
      .eq("season", selectedSeason)
      .neq("status", "inactive")
      .order("name");
    if (error) { toast({ title: "Error loading campers", variant: "destructive" }); return; }
    setCampers((data as any) || []);
    setLoading(false);
  };

  const filtered = campers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.person_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalBalance = campers.reduce((sum, c) => sum + Number(c.owl_pay_balance), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Campers</p><p className="text-2xl font-bold text-primary">{campers.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Balance</p><p className="text-2xl font-bold text-green-600">${totalBalance.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Avg Balance</p><p className="text-2xl font-bold text-primary">${campers.length > 0 ? (totalBalance / campers.length).toFixed(2) : "0.00"}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Camper Balances</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search campers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Balances are managed via the API and reflect data from the enrollment system.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Person ID</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((camper) => (
                  <TableRow key={camper.id}>
                    <TableCell className="font-medium">{camper.name}</TableCell>
                    <TableCell><Badge variant="outline">{camper.person_id}</Badge></TableCell>
                    <TableCell>
                      <Badge className={camper.owl_pay_balance < 5 ? "bg-destructive text-destructive-foreground" : camper.owl_pay_balance < 15 ? "bg-yellow-500 text-white" : "bg-green-500 text-white"}>
                        ${Number(camper.owl_pay_balance).toFixed(2)}
                      </Badge>
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
