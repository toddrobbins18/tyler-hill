import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Send } from "lucide-react";
import { camperInitials } from "@/lib/parentPortalConstants";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type AudienceReply = {
  id: string;
  announcement_id: string;
  sender_id: string;
  sender_name: string | null;
  body: string;
  created_at: string;
};

type Note = {
  id: string;
  title: string;
  body: string;
  audience_label: string | null;
  published_at?: string;
};

export function AudienceMessageThread({
  note,
  onBack,
}: {
  note: Note;
  onBack: () => void;
  backLabel?: string;
}) {
  const [replies, setReplies] = useState<AudienceReply[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("parent_audience_replies")
      .select("id, announcement_id, sender_id, sender_name, body, created_at")
      .eq("announcement_id", note.id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setReplies((data ?? []) as AudienceReply[]);
  }, [note.id]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    void load();
  }, [load]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !userId || sending) return;
    setSending(true);
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    const name = profile?.full_name?.trim() || profile?.email?.split("@")[0] || "Parent";
    const { error } = await supabase.from("parent_audience_replies").insert({
      announcement_id: note.id,
      sender_id: userId,
      sender_name: name,
      body: text,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft("");
    await load();
  };

  const bubbles: { id: string; mine: boolean; name: string; body: string; at: string }[] = [
    {
      id: "root",
      mine: false,
      name: "Camp",
      body: note.body,
      at: note.published_at ?? "",
    },
    ...replies.map((reply) => ({
      id: reply.id,
      mine: reply.sender_id === userId,
      name: reply.sender_name || "Camp",
      body: reply.body,
      at: reply.created_at,
    })),
  ];

  return (
    <div className="flex h-full min-h-[min(560px,calc(100vh-12rem))] flex-col overflow-hidden bg-[hsl(var(--pp-bg-elevated))]">
      <div className="flex items-center gap-3 bg-[hsl(var(--pp-brand))] px-3 py-2.5 text-white">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full text-white hover:bg-white/15 lg:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
          {camperInitials(note.audience_label || note.title)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight">{note.audience_label || note.title}</p>
          <p className="truncate text-xs text-white/80">{note.title}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-[#e8eef5] px-3 py-4">
        {bubbles.map((bubble) => (
          <div key={bubble.id} className={cn("flex", bubble.mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[78%] px-3.5 py-2",
                bubble.mine
                  ? "rounded-2xl rounded-br-md bg-[hsl(var(--pp-brand))] text-white"
                  : "rounded-2xl rounded-bl-md border border-[hsl(var(--pp-border))] bg-white text-[hsl(var(--pp-fg))]",
              )}
            >
              {!bubble.mine ? (
                <p className="mb-0.5 text-[11px] font-semibold text-[hsl(var(--pp-brand-dark))]">{bubble.name}</p>
              ) : null}
              <p className="whitespace-pre-wrap text-sm">{bubble.body}</p>
              {bubble.at ? (
                <p className={cn("mt-1 text-right text-[10px]", bubble.mine ? "text-white/75" : "text-[hsl(var(--pp-text-muted))]")}>
                  {format(new Date(bubble.at), "h:mm a")}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <form
        className="flex items-center gap-2 border-t border-[hsl(var(--pp-border))] bg-white px-3 py-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message"
          className="h-11 rounded-full border-[hsl(var(--pp-border))] bg-[hsl(var(--pp-bg))]"
        />
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full" disabled={sending || !draft.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
