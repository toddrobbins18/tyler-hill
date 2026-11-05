import { useCallback, useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSeason } from "@/contexts/SeasonContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AudienceMessageThread } from "@/components/messages/AudienceMessageThread";
import { cn } from "@/lib/utils";
import {
  audienceWeekChoices,
  campersForBus,
  campersForGroup,
  loadAudienceCampers,
  loadBusRosters,
  publishAudienceMessage,
  type AudienceCamper,
  type AudienceKind,
  type BusRoster,
} from "@/lib/audienceMessaging";
import {
  defaultEnrollmentWeekForDate,
  loadEnrollmentWeekCalendar,
} from "@/lib/enrollmentWeekCalendar";

type Props = { companyId: string; kind: AudienceKind };

export function StaffAudienceMessagesPanel({ companyId, kind }: Props) {
  const { currentSeason } = useSeason();
  const season = currentSeason ?? new Date().getFullYear().toString();
  const [campers, setCampers] = useState<AudienceCamper[]>([]);
  const [buses, setBuses] = useState<BusRoster[]>([]);
  const [target, setTarget] = useState("");
  const [weeks, setWeeks] = useState<number[]>([]);
  const [everyone, setEveryone] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ id: string; title: string; body: string; audience_label: string | null }[]>([]);
  const [openSentId, setOpenSentId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [roster, routes, calendar] = await Promise.all([
        loadAudienceCampers(supabase, companyId, season),
        loadBusRosters(supabase, companyId, season),
        loadEnrollmentWeekCalendar(supabase, companyId, season),
      ]);
      setCampers(roster);
      setBuses(routes);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const currentWeek = defaultEnrollmentWeekForDate(calendar, today);
      setWeeks(currentWeek ? [currentWeek] : [1]);
      const posted = await supabase
        .from("parent_portal_announcements")
        .select("id, title, body, audience_label, audience_kind")
        .eq("company_id", companyId)
        .eq("season", season)
        .eq("audience_kind", kind)
        .order("published_at", { ascending: false })
        .limit(20);
      setSent((posted.data ?? []) as { id: string; title: string; body: string; audience_label: string | null }[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load groups and buses");
    } finally {
      setLoading(false);
    }
  }, [companyId, season, kind]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setTarget("");
  }, [kind]);

  const groups = useMemo(() => {
    const names = new Set<string>();
    for (const camper of campers) {
      if (camper.groupName && camper.groupName !== "Unassigned") names.add(camper.groupName);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [campers]);

  const bus = buses.find((row) => row.id === target);
  const recipients = useMemo(() => {
    if (!target) return [];
    if (kind === "group") return campersForGroup(campers, target, weeks, everyone);
    return campersForBus(campers, bus?.camperNames ?? [], weeks, everyone);
  }, [bus, campers, everyone, kind, target, weeks]);

  const toggleWeek = (week: number) => {
    setEveryone(false);
    setWeeks((current) =>
      current.includes(week) ? current.filter((value) => value !== week) : [...current, week].sort((a, b) => a - b),
    );
  };

  const send = async () => {
    if (!target || !body.trim() || recipients.length === 0 || sending) return;
    setSending(true);
    const label = kind === "group" ? target : bus?.label ?? "Bus";
    const { error } = await publishAudienceMessage(supabase, {
      companyId,
      season,
      title: title.trim() || (kind === "group" ? `${target} update` : `${label} update`),
      body: body.trim(),
      kind,
      label,
      weeks,
      everyone,
      childIds: recipients.map((camper) => camper.id),
    });
    setSending(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(
      `Sent to ${recipients.length} camper${recipients.length === 1 ? "" : "s"}${everyone ? "" : ` enrolled in week${weeks.length === 1 ? "" : "s"} ${weeks.join(", ")}`}`,
    );
    setBody("");
    void refresh();
  };

  const openSent = sent.find((row) => row.id === openSentId);

  if (openSent) {
    return (
      <AudienceMessageThread
        note={openSent}
        backLabel={kind === "group" ? "Back to group messages" : "Back to bus messages"}
        onBack={() => setOpenSentId(null)}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(320px,1fr)_minmax(280px,380px)]">
      <Card>
        <CardHeader>
          <CardTitle>{kind === "group" ? "Message a group" : "Message a bus"}</CardTitle>
          <CardDescription>
            Parents only see this if their camper is included. Pick weeks for who is enrolled, or message everyone on that {kind}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{kind === "group" ? "Group" : "Bus"}</p>
            <Select value={target} onValueChange={setTarget} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Loading…" : kind === "group" ? "Choose a group" : "Choose a bus"} />
              </SelectTrigger>
              <SelectContent>
                {kind === "group"
                  ? groups.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))
                  : buses.map((row) => (
                      <SelectItem key={row.id} value={row.id}>{row.label}</SelectItem>
                    ))}
              </SelectContent>
            </Select>
            {kind === "bus" && !loading && buses.length === 0 ? (
              <p className="text-xs text-muted-foreground">No saved bus routes for this season yet.</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Weeks</p>
              <Button
                type="button"
                size="sm"
                variant={everyone ? "default" : "outline"}
                onClick={() => setEveryone((value) => !value)}
              >
                Message everyone {kind === "group" ? "in this group" : "on this bus"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {audienceWeekChoices().map((week) => {
                const on = !everyone && weeks.includes(week);
                return (
                  <button
                    key={week}
                    type="button"
                    onClick={() => toggleWeek(week)}
                    className={cn(
                      "h-8 rounded-md border px-3 text-xs font-medium",
                      on ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                      everyone && "opacity-40",
                    )}
                  >
                    Week {week}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {everyone
                ? "Everyone on this list gets it, even if they are not enrolled those weeks."
                : weeks.length
                  ? `Only campers enrolled in week${weeks.length === 1 ? "" : "s"} ${weeks.join(", ")}.`
                  : "Choose at least one week, or message everyone."}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Subject</p>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Subject" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Message</p>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} placeholder="Write the message parents should see" />
          </div>
          <Button type="button" onClick={() => void send()} disabled={sending || !body.trim() || recipients.length === 0}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Sending…" : `Send to ${recipients.length} camper${recipients.length === 1 ? "" : "s"}`}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who gets it</CardTitle>
          <CardDescription>
            {recipients.length} camper{recipients.length === 1 ? "" : "s"}
            {target ? "" : " — choose a group or bus"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[28rem] overflow-auto">
          {recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campers match.</p>
          ) : (
            recipients.map((camper) => (
              <div key={camper.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{camper.name}</span>
                <Badge variant="outline">{camper.groupName || "No group"}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sent</CardTitle>
          <CardDescription>Open a message to read replies and answer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[28rem] overflow-auto">
          {sent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
          ) : (
            sent.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setOpenSentId(row.id)}
                className="block w-full rounded-md border p-3 text-left hover:bg-muted/50"
              >
                <p className="text-xs text-muted-foreground">{row.audience_label}</p>
                <p className="font-medium">{row.title}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{row.body}</p>
              </button>
            ))
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
