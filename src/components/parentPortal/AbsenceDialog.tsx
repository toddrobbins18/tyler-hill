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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  isSameDayRequestBlocked,
  SAME_DAY_CUTOFF_MESSAGE,
} from "@/lib/parentPortalCutoff";
import { ABSENCE_TYPES, type Camper } from "@/lib/parentPortalConstants";

type AbsenceDialogProps = {
  companyId: string;
  familyId: string;
  campers: Camper[];
  onSaved: () => void;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
};

export function AbsenceDialog({
  companyId,
  familyId,
  campers,
  onSaved,
  triggerLabel = "Report an absence",
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: AbsenceDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [camperId, setCamperId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState("absent");
  const [arrivalTime, setArrivalTime] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const sameDayBlocked = isSameDayRequestBlocked(date);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!camperId) return toast.error("Pick a camper");
    if (isSameDayRequestBlocked(date)) {
      return toast.error(SAME_DAY_CUTOFF_MESSAGE);
    }
    setSaving(true);
    const { error } = await supabase.from("absences").insert({
      company_id: companyId,
      family_id: familyId,
      camper_id: camperId,
      absence_date: date,
      absence_type: type,
      arrival_time: arrivalTime || null,
      reason: reason || null,
      notes: notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Absence reported");
    setOpen(false);
    onSaved();
    setReason("");
    setNotes("");
    setArrivalTime("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button
            disabled={campers.length === 0}
            className="pp-btn-primary rounded-xl"
          >
            <Plus className="mr-2 h-4 w-4" />
            {triggerLabel}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report absence or late arrival</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {sameDayBlocked ? (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{SAME_DAY_CUTOFF_MESSAGE}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label>Camper</Label>
            <Select value={camperId} onValueChange={setCamperId}>
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
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ABSENCE_TYPES.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(type === "late_arrival" || type === "leaving_early") && (
            <div className="space-y-2">
              <Label>{type === "late_arrival" ? "Arrival time" : "Leaving time"}</Label>
              <Input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Doctor appointment"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || sameDayBlocked} className="rounded-xl">
              {saving ? "Submitting…" : "Submit report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
