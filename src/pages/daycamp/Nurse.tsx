import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";

type NurseRecord = {
  id: string;
  date: string | null;
  camper_name: string | null;
  reason: string | null;
  reason_other: string | null;
  treatment: string | null;
  treatment_other: string | null;
  location_of_incident: string | null;
  group_name: string | null;
  counselor: string | null;
  nurse_name: string | null;
  sent_home: boolean | null;
  called_home: boolean | null;
  notes: string | null;
  created_at: string;
};

function DateCell({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const d = value ? new Date(value + "T00:00:00") : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("h-8 w-full justify-start font-normal", !value && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
          {value ? format(d!, "MM/dd/yy") : "—"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={d ?? new Date()}
          defaultMonth={d ?? new Date()}
          onSelect={(picked) => picked && onChange(format(picked, "yyyy-MM-dd"))}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function TextCell({ value, onCommit, placeholder }: { value: string | null; onCommit: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <Input
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== (value ?? "") && onCommit(v)}
      className="h-8 border-transparent bg-transparent hover:border-input focus:border-input"
    />
  );
}

export default function Nurse() {
  const { currentCompany } = useCompany();
  const [records, setRecords] = useState<NurseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!currentCompany) return;
    setLoading(true);
    const { data: r, error } = await supabase.from("nurse_records").select("*").eq("company_id", currentCompany.id).order("date", { ascending: false });
    if (error) toast.error(error.message);
    setRecords((r as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentCompany]);

  const updateRecord = async (id: string, patch: Partial<NurseRecord>) => {
    if (!currentCompany) return;
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("nurse_records").update(patch).eq("id", id).eq("company_id", currentCompany.id);
    if (error) toast.error(error.message);
  };

  const addRecord = async () => {
    if (!currentCompany) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("nurse_records")
      .insert({ company_id: currentCompany.id, date: today })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setRecords((prev) => [data as any, ...prev]);
  };

  const deleteRecord = async (id: string) => {
    if (!currentCompany) return;
    setRecords((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("nurse_records").delete().eq("id", id).eq("company_id", currentCompany.id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Nurse Dashboard</h1>
        <p className="text-muted-foreground">Track incidents and treatments.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Incident &amp; Treatment Records</CardTitle>
          <Button size="sm" onClick={addRecord}><Plus className="mr-1 h-4 w-4" />Add record</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-40">Camper</TableHead>
                <TableHead>Reason (other)</TableHead>
                <TableHead>Treatment (other)</TableHead>
                <TableHead>Location of Incident</TableHead>
                <TableHead>Group Name</TableHead>
                <TableHead>Counselor</TableHead>
                <TableHead>Nurse</TableHead>
                <TableHead className="text-center w-20">Sent Home</TableHead>
                <TableHead className="text-center w-20">Called Home</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : records.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No records yet.</TableCell></TableRow>
              ) : records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><DateCell value={r.date} onChange={(v) => updateRecord(r.id, { date: v })} /></TableCell>
                  <TableCell><TextCell value={r.camper_name} onCommit={(v) => updateRecord(r.id, { camper_name: v })} /></TableCell>
                  <TableCell><TextCell value={r.reason_other} onCommit={(v) => updateRecord(r.id, { reason_other: v })} /></TableCell>
                  <TableCell><TextCell value={r.treatment_other} onCommit={(v) => updateRecord(r.id, { treatment_other: v })} /></TableCell>
                  <TableCell><TextCell value={r.location_of_incident} onCommit={(v) => updateRecord(r.id, { location_of_incident: v })} /></TableCell>
                  <TableCell><TextCell value={r.group_name} onCommit={(v) => updateRecord(r.id, { group_name: v })} /></TableCell>
                  <TableCell><TextCell value={r.counselor} onCommit={(v) => updateRecord(r.id, { counselor: v })} /></TableCell>
                  <TableCell><TextCell value={r.nurse_name} onCommit={(v) => updateRecord(r.id, { nurse_name: v })} /></TableCell>
                  <TableCell className="text-center">
                    <Checkbox checked={!!r.sent_home} onCheckedChange={(c) => updateRecord(r.id, { sent_home: !!c })} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox checked={!!r.called_home} onCheckedChange={(c) => updateRecord(r.id, { called_home: !!c })} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteRecord(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
