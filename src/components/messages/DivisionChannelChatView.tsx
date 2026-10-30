import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { MessageContent } from "@/components/messages/MessageContent";
import { MessageMediaComposer } from "@/components/messages/MessageMediaComposer";
import { fetchMessageProfileLabels } from "@/lib/messageProfiles";
import { messageMediaEnabledForCamp } from "@/lib/messageMedia";
import { useCompany } from "@/contexts/CompanyContext";
import {
  fetchDivisionChannelTimeline,
  markDivisionChannelRead,
  postDivisionChannelMessage,
  sendDivisionChannelMessageMedia,
  type DivisionChannelTimelineRow,
} from "@/lib/divisionChannelMessaging";
import { toast } from "sonner";

type Props = {
  rootId: string;
  divisionName: string;
  companyId: string;
  onBack?: () => void;
  onMarkedRead?: () => void;
};

export function DivisionChannelChatView({
  rootId,
  divisionName,
  companyId,
  onBack,
  onMarkedRead,
}: Props) {
  const { currentCompany } = useCompany();
  const [messages, setMessages] = useState<DivisionChannelTimelineRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const mediaEnabled = messageMediaEnabledForCamp(currentCompany?.slug);

  const load = useCallback(async () => {
    const { rows, error } = await fetchDivisionChannelTimeline(supabase, rootId);
    if (error) {
      toast.error(error);
      return;
    }
    const senderIds = rows
      .map((m) => m.sender_id as string | null)
      .filter(Boolean) as string[];
    const labels = await fetchMessageProfileLabels(senderIds, companyId);
    const nameMap: Record<string, string> = {};
    labels.forEach((label, id) => {
      nameMap[id] = label;
    });
    setSenderNames(nameMap);
    void markDivisionChannelRead(supabase, rootId).then(({ error: markErr }) => {
      if (!markErr) onMarkedRead?.();
    });

    setMessages(
      rows.map((m) => ({
        id: m.id as string,
        content: String(m.content ?? ""),
        created_at: String(m.created_at ?? ""),
        sender_id: (m.sender_id as string | null) ?? null,
        parent_message_id: (m.parent_message_id as string | null) ?? null,
        message_kind: (m.message_kind as string | null) ?? null,
        media_storage_path: (m.media_storage_path as string | null) ?? null,
        media_mime: (m.media_mime as string | null) ?? null,
        media_file_name: (m.media_file_name as string | null) ?? null,
      })),
    );
  }, [rootId, companyId, onMarkedRead]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`division-channel-${rootId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as { parent_message_id?: string; id?: string };
          if (row.parent_message_id === rootId || row.id === rootId) void load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rootId, load]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const body = newMessage.trim();
    if (!body || sending || mediaUploading) return;
    setSending(true);
    const { error } = await postDivisionChannelMessage(supabase, rootId, body);
    setSending(false);
    if (error) {
      toast.error(error);
      return;
    }
    setNewMessage("");
    await load();
  };

  const handleSendMedia = async (file: File) => {
    if (mediaUploading || sending) return;
    setMediaUploading(true);
    setMediaProgress(0);
    const { error } = await sendDivisionChannelMessageMedia(supabase, {
      rootId,
      companyId,
      caption: newMessage,
      file,
      onProgress: setMediaProgress,
    });
    setMediaUploading(false);
    if (error) {
      toast.error(error);
      return;
    }
    setNewMessage("");
    await load();
  };

  const posts = messages.filter((m) => m.parent_message_id === rootId);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {onBack ? (
          <Button type="button" variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{divisionName}</p>
          <Badge variant="secondary" className="mt-0.5 text-[10px]">
            Division channel
          </Badge>
        </div>
      </div>
      <ScrollArea className="flex-1 px-4 py-3">
        <div ref={scrollRef} className="space-y-3">
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet — say hello to your division.</p>
          ) : (
            posts.map((msg) => {
              const mine = msg.sender_id === currentUserId;
              const senderLabel = msg.sender_id ? senderNames[msg.sender_id] ?? "Staff" : "System";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
                >
                  {!mine ? (
                    <span className="text-xs font-medium text-muted-foreground">{senderLabel}</span>
                  ) : null}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      mine ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    <MessageContent
                      content={msg.content}
                      messageKind={msg.message_kind}
                      mediaStoragePath={msg.media_storage_path}
                      mediaMime={msg.media_mime}
                      mediaFileName={msg.media_file_name}
                      senderId={msg.sender_id}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(msg.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-3 space-y-2">
        {mediaEnabled ? (
          <MessageMediaComposer
            disabled={sending || mediaUploading}
            uploading={mediaUploading}
            uploadProgress={mediaProgress}
            onPick={(file) => void handleSendMedia(file)}
          />
        ) : null}
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Message your division…"
            rows={2}
            className="min-h-[60px] resize-none"
            disabled={mediaUploading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || mediaUploading || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
