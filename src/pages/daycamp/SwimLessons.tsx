import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Waves, Plus, Trash2, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import SearchableChildSelect from "@/components/SearchableChildSelect";

type Camper = { id: string; name: string; guardian_email: string | null };
type Lesson = {
  id: string;
  camper_id: string;
  scheduled_at: string;
  duration_minutes: number;
  instructor: string | null;
  location: string | null;
  cost_cents: number;
  status: string;
  parent_confirmed: boolean;
  parent_confirmed_at: string | null;
  reminder_sent_at: string | null;
  notes: string | null;
};

export default function SwimLessons() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [campers, setCampers] = useState<Camper[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!currentCompany?.id) return;
    
    const [{ data: cs }, { data: ls }] = await Promise.all([
      supabase.from("children").select("id, name, guardian_email").eq("company_id", currentCompany.id).eq("season", currentSeason),
      supabase.from("swim_lessons").select("*").eq("company_id", currentCompany.id).order("scheduled_at", { ascending: true }),
    ]);
    
    setCampers((cs ?? []) as Camper[]);
    setLessons((ls ?? []) as Lesson[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentCompany?.id, currentSeason]);

  const camperName = (id: string) => {
    const c = campers.find(x => x.id === id);
    return c ? c.name : "—";
  };
  
  const familyEmail = (id: string) => campers.find(f => f.id === id)?.guardian_email ?? "—";

  const remove = async (id: string) => {
    const { error } = await supabase.from("swim_lessons").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Lesson removed"); load(); }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Waves className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Swim Lessons</h1>
            <p className="text-sm text-muted-foreground">
              Schedule private swim lessons for eligible camp families
            </p>
          </div>
        </div>
        <LessonDialog campers={campers} onSaved={load} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All scheduled lessons</CardTitle>
          <CardDescription>Parents see these in their Parent Portal and confirm attendance.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lessons scheduled yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Camper</TableHead>
                  <TableHead>Parent Email</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Reminder</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessons.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{format(new Date(l.scheduled_at), "MMM d, yyyy")}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(l.scheduled_at), "h:mm a")} · {l.duration_minutes} min
                      </div>
                    </TableCell>
                    <TableCell>{camperName(l.camper_id)}</TableCell>
                    <TableCell>{familyEmail(l.camper_id)}</TableCell>
                    <TableCell>{l.instructor ?? "—"}</TableCell>
                    <TableCell>{l.location ?? "—"}</TableCell>
                    <TableCell>${(l.cost_cents / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      {l.parent_confirmed ? (
                        <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Confirmed</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {l.reminder_sent_at
                        ? <span className="text-xs text-muted-foreground">Sent {format(new Date(l.reminder_sent_at), "MMM d")}</span>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => remove(l.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
}

function LessonDialog({
  campers, onSaved,
}: { campers: Camper[]; onSaved: () => void }) {
  const { currentCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const [camperId, setCamperId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [instructor, setInstructor] = useState("");
  const [location, setLocation] = useState("");
  const [cost, setCost] = useState("45");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id) return;
    if (!camperId) return toast.error("Pick a camper");
    
    setSaving(true);
    const scheduled_at = new Date(`${date}T${time}:00`).toISOString();
    
    const { error } = await supabase.from("swim_lessons").insert({
      company_id: currentCompany.id,
      camper_id: camperId,
      scheduled_at,
      duration_minutes: parseInt(duration) || 30,
      instructor: instructor || null,
      location: location || null,
      cost_cents: Math.round(parseFloat(cost || "0") * 100),
      notes: notes || null,
    });
    
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Swim lesson scheduled");
    setOpen(false); 
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Schedule lesson</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule a swim lesson</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Camper</Label>
            <SearchableChildSelect 
              children={campers} 
              value={camperId} 
              onValueChange={setCamperId} 
              placeholder="Search campers..." 
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Minutes</Label>
              <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Instructor</Label>
              <Input value={instructor} onChange={e => setInstructor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Main Pool" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cost (USD)</Label>
            <Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Schedule"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}