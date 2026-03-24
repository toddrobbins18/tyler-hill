import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useToast } from "@/hooks/use-toast";
import { Search, DollarSign, Plus, Minus } from "lucide-react";

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
  const [selectedCamper, setSelectedCamper] = useState<CamperBalance | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();
  const { toast } = useToast();

  useEffect(() => { fetchCampers(); }, [currentCompany, selectedSeason]);

  const fetchCampers = async () => {
    if (!currentCompany?.id) return;
    const { data, error } = await supabase
      .from("children")
      .select("id, name, owl_pay_balance, person_id")
      .eq("company_id", currentCompany.id)
      .neq("status", "inactive")
      .order("name");
    if (error) { toast({ title: "Error loading campers", variant: "destructive" }); return; }
    setCampers((data as any) || []);
    setLoading(false);
  };

  const adjustBalance = async (type: "add" | "subtract") => {
    if (!selectedCamper || !adjustAmount) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }

    const newBalance = type === "add"
      ? selectedCamper.owl_pay_balance + amount
      : selectedCamper.owl_pay_balance - amount;

    const { error } = await supabase
      .from("children")
      .update({ owl_pay_balance: newBalance } as any)
      .eq("id", selectedCamper.id);

    if (error) { toast({ title: "Error updating balance", variant: "destructive" }); return; }
    toast({ title: `Balance ${type === "add" ? "added" : "deducted"}: $${amount.toFixed(2)}` });
    setAdjustAmount("");
    setDialogOpen(false);
    setSelectedCamper(null);
    fetchCampers();
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
                  <TableHead className="w-32">Actions</TableHead>
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
                    <TableCell>
                      <Dialog open={dialogOpen && selectedCamper?.id === camper.id} onOpenChange={(open) => {
                        setDialogOpen(open);
                        if (open) setSelectedCamper(camper);
                        else { setSelectedCamper(null); setAdjustAmount(""); }
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" onClick={() => setSelectedCamper(camper)}>
                            <DollarSign className="h-3 w-3 mr-1" /> Adjust
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Adjust Balance - {camper.name}</DialogTitle></DialogHeader>
                          <div className="space-y-4">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Current Balance</p>
                              <p className="text-3xl font-bold text-primary">${Number(camper.owl_pay_balance).toFixed(2)}</p>
                            </div>
                            <div className="space-y-2">
                              <Label>Amount ($)</Label>
                              <Input type="number" step="0.01" min="0" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="0.00" />
                            </div>
                            <div className="flex gap-2">
                              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => adjustBalance("add")}>
                                <Plus className="h-4 w-4 mr-1" /> Add Funds
                              </Button>
                              <Button className="flex-1" variant="destructive" onClick={() => adjustBalance("subtract")}>
                                <Minus className="h-4 w-4 mr-1" /> Deduct
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
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
