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
import { CHANGE_TYPES, type Camper } from "@/lib/parentPortalConstants";

type PickupChangeDialogProps = {
  companyId: string;
  familyId: string;
  campers: Camper[];
  onSaved: () => void;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
};

export function PickupChangeDialog({
  companyId,
  familyId,
  campers,
  onSaved,
  triggerLabel = "Change pickup",
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: PickupChangeDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [camperId, setCamperId] = useState("");
  const [changeDate, setChangeDate] = useState(new Date().toISOString().slice(0, 10));
  const [changeType, setChangeType] = useState("early_pickup");
  const [pickupTime, setPickupTime] = useState("");
  const [personName, setPersonName] = useState("");
  const [personPhone, setPersonPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const sameDayBlocked = isSameDayRequestBlocked(changeDate);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!camperId) return toast.error("Pick a camper");
    if (isSameDayRequestBlocked(changeDate)) {
      return toast.error(SAME_DAY_CUTOFF_MESSAGE);
    }
    setSaving(true);
    const { error } = await supabase.from("pickup_changes").insert({
      company_id: companyId,
      family_id: familyId,
      camper_id: camperId,
      change_date: changeDate,
      change_type: changeType,
      pickup_time: pickupTime || null,
      pickup_person_name: personName || null,
      pickup_person_phone: personPhone || null,
      notes: notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Pickup change submitted");
    setOpen(false);
    onSaved();
    setPersonName("");
    setPersonPhone("");
    setNotes("");
    setPickupTime("");
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
          <DialogTitle>Request a pickup change</DialogTitle>
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
              <Input
                type="date"
                value={changeDate}
                onChange={(e) => setChangeDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={changeType} onValueChange={setChangeType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANGE_TYPES.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Pickup time (optional)</Label>
            <Input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Person picking up</Label>
              <Input value={personName} onChange={(e) => setPersonName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Their phone</Label>
              <Input value={personPhone} onChange={(e) => setPersonPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || sameDayBlocked} className="rounded-xl">
              {saving ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
