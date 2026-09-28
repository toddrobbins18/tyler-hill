import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Calendar, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  defaultOwlTimeSettings,
  listScheduledWorkDays,
  loadOwlTimeClosedDates,
  loadOwlTimeSeasonSettings,
  saveOwlTimeClosedDates,
  saveOwlTimeSeasonSettings,
  type OwlTimeClosedDate,
  type OwlTimeSeasonSettings,
} from "@/lib/owlTimeAttendance";

type Props = {
  companyId: string;
  season: string;
  onSaved?: () => void;
};

function timeInputValue(dbTime: string): string {
  return dbTime.slice(0, 5);
}

function timeDbValue(input: string): string {
  return input.length === 5 ? `${input}:00` : input;
}

export function OwlTimeSeasonSettingsPanel({ companyId, season, onSaved }: Props) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<OwlTimeSeasonSettings>(() =>
    defaultOwlTimeSettings(companyId, season),
  );
  const [closedDates, setClosedDates] = useState<OwlTimeClosedDate[]>([]);
  const [newClosedDate, setNewClosedDate] = useState("");
  const [newClosedLabel, setNewClosedLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSavedSettings, setHasSavedSettings] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [loadedSettings, loadedClosed] = await Promise.all([
      loadOwlTimeSeasonSettings(supabase, companyId, season),
      loadOwlTimeClosedDates(supabase, companyId, season),
    ]);

    const { data: existing } = await supabase
      .from("owl_time_season_settings")
      .select("company_id")
      .eq("company_id", companyId)
      .eq("season", season)
      .maybeSingle();

    setHasSavedSettings(!!existing);
    setSettings(loadedSettings);
    setClosedDates(loadedClosed);
    setLoading(false);
  }, [companyId, season]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const scheduledDays = listScheduledWorkDays(
    settings.start_date,
    settings.end_date,
    closedDates.map((d) => d.closed_date),
  );

  const addClosedDate = () => {
    if (!newClosedDate) return;
    if (closedDates.some((d) => d.closed_date === newClosedDate)) {
      toast({ title: "Date already listed", variant: "destructive" });
      return;
    }
    setClosedDates((prev) => [
      ...prev,
      { closed_date: newClosedDate, label: newClosedLabel.trim() || null },
    ].sort((a, b) => a.closed_date.localeCompare(b.closed_date)));
    setNewClosedDate("");
    setNewClosedLabel("");
  };

  const handleSave = async () => {
    if (settings.end_date < settings.start_date) {
      toast({ title: "End date must be on or after start date", variant: "destructive" });
      return;
    }

    setSaving(true);
    const settingsResult = await saveOwlTimeSeasonSettings(supabase, settings);
    if (!settingsResult.ok) {
      toast({ title: "Save failed", description: settingsResult.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const closedResult = await saveOwlTimeClosedDates(supabase, companyId, season, closedDates);
    setSaving(false);

    if (!closedResult.ok) {
      toast({ title: "Closed dates save failed", description: closedResult.message, variant: "destructive" });
      return;
    }

    setHasSavedSettings(true);
    toast({ title: "Season settings saved" });
    onSaved?.();
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground p-4">Loading season settings…</p>;
  }

  return (
    <div className="space-y-6">
      {!hasSavedSettings && (
        <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6 text-sm">
            Set your season dates and save — reports use Mon–Fri weekdays in this range (minus closed days).
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Season dates
          </CardTitle>
          <CardDescription>
            {scheduledDays.length} scheduled work days (Mon–Fri, excluding closed dates)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="owl-start">Start date</Label>
            <Input
              id="owl-start"
              type="date"
              value={settings.start_date}
              onChange={(e) => setSettings((s) => ({ ...s, start_date: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="owl-end">End date</Label>
            <Input
              id="owl-end"
              type="date"
              value={settings.end_date}
              onChange={(e) => setSettings((s) => ({ ...s, end_date: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="owl-sign-in">On-time sign-in by</Label>
            <Input
              id="owl-sign-in"
              type="time"
              value={timeInputValue(settings.expected_sign_in_time)}
              onChange={(e) =>
                setSettings((s) => ({ ...s, expected_sign_in_time: timeDbValue(e.target.value) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="owl-sign-out">Expected sign-out (early if before)</Label>
            <Input
              id="owl-sign-out"
              type="time"
              value={timeInputValue(settings.expected_sign_out_time)}
              onChange={(e) =>
                setSettings((s) => ({ ...s, expected_sign_out_time: timeDbValue(e.target.value) }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Closed / holiday dates</CardTitle>
          <CardDescription>Weekdays when camp is closed — not counted as missing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-2">
              <Label htmlFor="owl-closed-date">Date</Label>
              <Input
                id="owl-closed-date"
                type="date"
                value={newClosedDate}
                min={settings.start_date}
                max={settings.end_date}
                onChange={(e) => setNewClosedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2 flex-1 min-w-[160px]">
              <Label htmlFor="owl-closed-label">Label (optional)</Label>
              <Input
                id="owl-closed-label"
                placeholder="July 4"
                value={newClosedLabel}
                onChange={(e) => setNewClosedLabel(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" onClick={addClosedDate}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          {closedDates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No closed dates added.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {closedDates.map((row) => (
                <li key={row.closed_date} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    {format(parseISO(row.closed_date), "EEE, MMM d, yyyy")}
                    {row.label ? ` · ${row.label}` : ""}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setClosedDates((prev) => prev.filter((d) => d.closed_date !== row.closed_date))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving…" : "Save season settings"}
        </Button>
      </div>
    </div>
  );
}
