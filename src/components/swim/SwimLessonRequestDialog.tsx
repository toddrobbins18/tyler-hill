import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { type Camper } from "@/lib/parentPortalConstants";
import { campDateTimeToIso } from "@/lib/campTime";
import { DEFAULT_SWIM_LESSON_TIME, SWIM_LESSON_TIME_OPTIONS } from "@/lib/swimLessonSchedule";

type Props = {
  companyId: string;
  campers: Camper[];
  onSaved: () => void;
};

export function SwimLessonRequestDialog({ companyId, campers, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [camperId, setCamperId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(DEFAULT_SWIM_LESSON_TIME);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!camperId) return toast.error("Pick a camper");
    setSaving(true);
    const { error } = await supabase.from("swim_lessons").insert({
      company_id: companyId,
      camper_id: camperId,
      scheduled_at: campDateTimeToIso(date, time),
      duration_minutes: 30,
      cost_cents: 0,
      status: "pending",
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Swim lesson request submitted — camp will review");
    setOpen(false);
    setCamperId("");
    setNotes("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={campers.length === 0} className="rounded-xl">
          <Plus className="mr-2 h-4 w-4" />
          Request lesson
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request a swim lesson</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Camper</Label>
            <Select value={camperId || undefined} onValueChange={setCamperId}>
              <SelectTrigger>
                <SelectValue placeholder="Select camper" />
              </SelectTrigger>
              <SelectContent>
                {campers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Preferred date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Preferred time</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SWIM_LESSON_TIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything we should know?"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
