import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Mail, MessageSquare, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type ParentContactType = "phone" | "email" | "text";

export type ParentCommunicationEntry = {
  id: string;
  contact_date: string;
  contact_type: ParentContactType;
  notes: string;
  logged_by_name: string | null;
  created_at: string;
  updated_at: string;
};

const CONTACT_TYPE_OPTIONS: { value: ParentContactType; label: string }[] = [
  { value: "phone", label: "Phone call" },
  { value: "email", label: "Email" },
  { value: "text", label: "Text message" },
];

function contactTypeLabel(type: ParentContactType): string {
  return CONTACT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

function ContactTypeIcon({ type }: { type: ParentContactType }) {
  if (type === "email") return <Mail className="h-5 w-5 text-primary" />;
  if (type === "text") return <MessageSquare className="h-5 w-5 text-primary" />;
  return <Phone className="h-5 w-5 text-primary" />;
}

async function resolveLoggedByName(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name?.trim() || data?.email?.trim() || null;
}

interface Props {
  childId: string;
}

export function CamperParentContactLogTab({ childId }: Props) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [entries, setEntries] = useState<ParentCommunicationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ParentCommunicationEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [contactDate, setContactDate] = useState<Date>(new Date());
  const [contactType, setContactType] = useState<ParentContactType>("phone");
  const [notes, setNotes] = useState("");

  const fetchEntries = useCallback(async () => {
    if (!childId || !currentCompany?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("camper_parent_communications")
      .select("id, contact_date, contact_type, notes, logged_by_name, created_at, updated_at")
      .eq("child_id", childId)
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .order("contact_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load parent contact log");
      setEntries([]);
    } else {
      setEntries((data ?? []) as ParentCommunicationEntry[]);
    }
    setLoading(false);
  }, [childId, currentCompany?.id, currentSeason]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    const channel = supabase
      .channel(`camper_parent_communications_${childId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "camper_parent_communications", filter: `child_id=eq.${childId}` },
        () => {
          void fetchEntries();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [childId, fetchEntries]);

  const resetForm = () => {
    setEditingEntry(null);
    setContactDate(new Date());
    setContactType("phone");
    setNotes("");
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (entry: ParentCommunicationEntry) => {
    setEditingEntry(entry);
    setContactDate(new Date(`${entry.contact_date}T12:00:00`));
    setContactType(entry.contact_type);
    setNotes(entry.notes);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!childId || !currentCompany?.id || !notes.trim()) {
      toast.error("Enter notes for this contact");
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const loggedByName = await resolveLoggedByName(userData.user?.id);
    const payload = {
      contact_date: format(contactDate, "yyyy-MM-dd"),
      contact_type: contactType,
      notes: notes.trim(),
      logged_by: userData.user?.id ?? null,
      logged_by_name: loggedByName,
    };

    if (editingEntry) {
      const { error } = await supabase
        .from("camper_parent_communications")
        .update(payload)
        .eq("id", editingEntry.id);

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Contact log updated");
        setDialogOpen(false);
        resetForm();
        void fetchEntries();
      }
    } else {
      const { error } = await supabase.from("camper_parent_communications").insert({
        ...payload,
        child_id: childId,
        company_id: currentCompany.id,
        season: currentSeason,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Contact logged");
        setDialogOpen(false);
        resetForm();
        void fetchEntries();
      }
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("camper_parent_communications").delete().eq("id", deletingId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Entry removed");
      void fetchEntries();
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading..." : `${entries.length} logged ${entries.length === 1 ? "contact" : "contacts"}`}
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Log contact
        </Button>
      </div>

      {loading ? (
        <Card className="shadow-card">
          <CardContent className="py-8 text-center text-muted-foreground">Loading contact log...</CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            No parent contacts logged yet. Record phone calls, emails, or texts with notes.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {entries.map((entry) => (
            <Card key={entry.id} className="shadow-card">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <ContactTypeIcon type={entry.contact_type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{contactTypeLabel(entry.contact_type)}</Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {new Date(`${entry.contact_date}T12:00:00`).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(entry)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingId(entry.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{entry.notes}</p>
                    {entry.logged_by_name && (
                      <p className="text-xs text-muted-foreground mt-3">Logged by {entry.logged_by_name}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit contact log" : "Log parent contact"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(contactDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={contactDate} onSelect={(d) => d && setContactDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Contact type</Label>
              <Select value={contactType} onValueChange={(v) => setContactType(v as ParentContactType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Summary of the conversation, action items, etc."
                rows={5}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving || !notes.trim()}>
                {saving ? "Saving..." : editingEntry ? "Save changes" : "Log contact"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact log entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
