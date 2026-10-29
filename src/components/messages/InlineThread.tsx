import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fetchMessageProfileLabels, inboxFromDisplayName } from "@/lib/messageProfiles";
import { MessageContent } from "@/components/messages/MessageContent";
import { MessageMediaComposer } from "@/components/messages/MessageMediaComposer";
import {
  messageMediaEnabledForCamp,
  sendDirectMessageMedia,
} from "@/lib/messageMedia";
import { toast } from "sonner";
import { ReadReceipt } from "@/components/messages/ReadReceipt";
import { markThreadRepliesReadForRecipient } from "@/lib/messageReadReceipts";
import { PP_CHAT_BUBBLE_ME, PP_CHAT_BUBBLE_THEM } from "@/lib/parentPortalTheme";

function isParentPortalThreadStarter(row: ThreadMessage): boolean {
  const text = String(row.content ?? "").trim();
  return text.startsWith("Parent portal thread for");
}

interface ThreadMessage {
  id: string;
  subject: string;
  content: string;
  created_at: string;
  read: boolean;
  read_at?: string | null;
  sender_id: string | null;
  recipient_id: string | null;
  parent_message_id?: string | null;
  group_id?: string | null;
  sender_display_name?: string | null;
  sender_name?: string;
  recipient_name?: string;
  notification_type?: string | null;
  message_kind?: string | null;
  media_storage_path?: string | null;
  media_mime?: string | null;
  media_file_name?: string | null;
  child_id?: string | null;
  family_id?: string | null;
  thread_kind?: string | null;
}

interface InlineThreadProps {
  message: ThreadMessage;
  viewMode: 'inbox' | 'sent';
  /** Current camp — used with RPC so reply thread resolves sender names under RLS. */
  campCompanyId?: string;
  campCompanySlug?: string | null;
  onNavigateToGroup?: (groupId: string) => void;
  onRootReadChange?: (messageId: string, read: boolean, read_at: string | null) => void;
  /** Parent portal: frosted glass bubbles and hide auto-generated thread root text. */
  bubbleStyle?: "nest" | "parentGlass";
}

export default function InlineThread({
  message,
  viewMode,
  campCompanyId,
  campCompanySlug,
  onNavigateToGroup,
  onRootReadChange,
  bubbleStyle = "nest",
}: InlineThreadProps) {
  const [replies, setReplies] = useState<ThreadMessage[]>([]);
  const [newReply, setNewReply] = useState("");
  const [sending, setSending] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  useEffect(() => {
    fetchReplies();

    const channel = supabase
      .channel(`inline-replies-${message.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          if (payload.new?.parent_message_id === message.id) {
            fetchReplies();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload: any) => {
          const updated = payload.new as ThreadMessage | undefined;
          if (!updated?.id) return;
          if (updated.id === message.id) {
            onRootReadChange?.(message.id, !!updated.read, updated.read_at ?? null);
          }
          if (updated.parent_message_id === message.id) {
            setReplies((prev) =>
              prev.map((r) =>
                r.id === updated.id
                  ? { ...r, read: !!updated.read, read_at: updated.read_at ?? null }
                  : r,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [message.id, onRootReadChange]);

  const markRepliesReadIfRecipient = useCallback(async () => {
    if (viewMode !== "inbox") return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || message.recipient_id !== user.id) return;
    await markThreadRepliesReadForRecipient(supabase, message.id, user.id);
  }, [message.id, message.recipient_id, viewMode]);

  useEffect(() => {
    void markRepliesReadIfRecipient();
  }, [markRepliesReadIfRecipient]);

  const resolveNames = useCallback(async (ids: string[]) => {
    const unknownIds = ids.filter(id => id && !profileCache[id.toLowerCase()]);
    if (unknownIds.length === 0) return profileCache;

    const labelMap = await fetchMessageProfileLabels(unknownIds, campCompanyId);
    const newCache = { ...profileCache };
    labelMap.forEach((label, id) => {
      newCache[id.toLowerCase()] = label;
    });
    setProfileCache(newCache);
    return newCache;
  }, [profileCache, campCompanyId]);

  const fetchReplies = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("parent_message_id", message.id)
      .order("created_at", { ascending: true });

    if (error || !data) return;

    const senderIds = data.map(m => m.sender_id).filter(Boolean) as string[];
    const cache = await resolveNames(senderIds);

    setReplies(data.map(m => ({
      ...m,
      sender_name: m.sender_id
        ? (cache[m.sender_id.toLowerCase()] || m.sender_display_name?.trim() || "Unknown sender")
        : inboxFromDisplayName({
            sender_name: m.sender_display_name ?? undefined,
            sender_id: m.sender_id,
            sender_display_name: m.sender_display_name,
            notification_type: (m as { notification_type?: string }).notification_type,
            subject: (m as { subject?: string }).subject,
            group_id: (m as { group_id?: string | null }).group_id,
          }),
    })));
    await markRepliesReadIfRecipient();
  };

  const mediaEnabled =
    !!campCompanyId && messageMediaEnabledForCamp(campCompanySlug);

  const dmRecipientId = useMemo((): string | null => {
    if (!currentUserId) return null;
    if (currentUserId === message.sender_id && message.recipient_id) {
      return message.recipient_id;
    }
    if (currentUserId === message.recipient_id && message.sender_id) {
      return message.sender_id;
    }
    const peerFromReplies = [...replies]
      .reverse()
      .find((r) => r.sender_id && r.sender_id !== currentUserId);
    if (peerFromReplies?.sender_id) return peerFromReplies.sender_id;
    if (viewMode === "sent" && message.recipient_id) return message.recipient_id;
    if (viewMode === "inbox" && message.recipient_id === currentUserId) {
      const firstOther = replies.find((r) => r.sender_id && r.sender_id !== currentUserId);
      if (firstOther?.sender_id) return firstOther.sender_id;
    }
    return message.recipient_id ?? message.sender_id ?? null;
  }, [currentUserId, message, replies, viewMode]);

  const canReply = !!currentUserId && !message.group_id && !!dmRecipientId;

  const handleSendMedia = async (file: File) => {
    if (!currentUserId || !campCompanyId || mediaUploading || !dmRecipientId) return;

    const recipientId = dmRecipientId;

    setMediaUploading(true);
    setMediaProgress(0);
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", currentUserId)
        .maybeSingle();
      const senderDisplayName =
        prof?.full_name?.trim() || prof?.email?.split("@")[0] || null;

      const { error } = await sendDirectMessageMedia(supabase, {
        companyId: campCompanyId,
        senderId: currentUserId,
        recipientId,
        subject: `Re: ${message.subject.replace(/^Re: /, "")}`,
        parentMessageId: message.id,
        threadScopeId: message.id,
        caption: newReply,
        file,
        senderDisplayName,
        onProgress: setMediaProgress,
        childId: message.child_id ?? null,
        familyId: message.family_id ?? null,
        threadKind: message.thread_kind ?? null,
      });

      if (error) {
        toast.error(error);
        return;
      }
      setNewReply("");
      await fetchReplies();
    } finally {
      setMediaUploading(false);
      setMediaProgress(0);
    }
  };

  const handleSendReply = async () => {
    if (!newReply.trim() || !currentUserId || !dmRecipientId) return;

    setSending(true);
    try {
      const recipientId = dmRecipientId;

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", currentUserId)
        .maybeSingle();
      const senderDisplayName =
        prof?.full_name?.trim() || prof?.email?.split("@")[0] || null;

      const { error } = await supabase
        .from("messages")
        .insert({
          sender_id: currentUserId,
          recipient_id: recipientId,
          subject: `Re: ${message.subject.replace(/^Re: /, '')}`,
          content: newReply.trim(),
          parent_message_id: message.id,
          notification_type: 'message',
          read: false,
          sender_display_name: senderDisplayName,
          ...(campCompanyId ? { company_id: campCompanyId } : {}),
          ...(message.child_id ? { child_id: message.child_id } : {}),
          ...(message.family_id ? { family_id: message.family_id } : {}),
          ...(message.thread_kind ? { thread_kind: message.thread_kind } : {}),
        });

      if (error) throw error;
      setNewReply("");
    } catch (error: any) {
      console.error("Failed to send reply:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const partyLabel =
    viewMode === "inbox"
      ? inboxFromDisplayName({
          sender_name: message.sender_name,
          sender_id: message.sender_id,
          sender_display_name: message.sender_display_name,
          notification_type: message.notification_type,
          subject: message.subject,
          group_id: message.group_id,
        })
      : message.recipient_name || "Unknown";

  const chatTimeline = useMemo(() => {
    let rows = [message, ...replies];
    if (bubbleStyle === "parentGlass") {
      rows = rows.filter((r) => !(r.id === message.id && isParentPortalThreadStarter(r)));
    }
    return rows.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [message, replies, bubbleStyle]);

  const renderBubble = (row: ThreadMessage) => {
    const isMe = row.sender_id === currentUserId;
    const senderLabel =
      row.sender_name ||
      (row.sender_id
        ? inboxFromDisplayName({
            sender_id: row.sender_id,
            sender_display_name: row.sender_display_name,
            notification_type: row.notification_type,
            subject: row.subject,
          })
        : "Unknown");

    const bubbleClass =
      bubbleStyle === "parentGlass"
        ? isMe
          ? PP_CHAT_BUBBLE_ME
          : PP_CHAT_BUBBLE_THEM
        : isMe
          ? "rounded-2xl rounded-tr-sm bg-secondary text-secondary-foreground"
          : "rounded-2xl rounded-tl-sm bg-card border border-border text-foreground";

    return (
      <div key={row.id} className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[84%] px-3.5 py-2.5 ${bubbleClass}`}>
          {!isMe && (
            <p
              className={`text-xs font-semibold mb-1 ${
                bubbleStyle === "parentGlass" ? "text-[hsl(var(--pp-brand-dark))]" : "text-secondary"
              }`}
            >
              {senderLabel}
            </p>
          )}
          <MessageContent
            content={row.content}
            messageKind={row.message_kind}
            mediaStoragePath={row.media_storage_path}
            mediaMime={row.media_mime}
            mediaFileName={row.media_file_name}
            senderId={row.sender_id}
            notificationType={row.notification_type}
            className="text-sm"
          />
          <div className="flex items-center justify-end gap-1 mt-1">
            <span
              className={`text-[11px] ${
                bubbleStyle === "parentGlass"
                  ? "text-[hsl(var(--pp-text-muted))]"
                  : isMe
                    ? "text-secondary-foreground/80"
                    : "text-muted-foreground"
              }`}
            >
              {format(new Date(row.created_at), "h:mm a")}
            </span>
            {isMe ? <ReadReceipt message={row} whatsapp /> : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full min-h-0 flex flex-col overflow-hidden border-0 shadow-md">
      <div className="bg-primary text-primary-foreground px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold truncate">{partyLabel}</p>
          {message.sender_id === null && (
            <Badge variant="secondary" className="shrink-0">
              Automated
            </Badge>
          )}
        </div>
        <p className="text-xs opacity-90 truncate mt-0.5">{message.subject}</p>
      </div>

      <CardContent
        className={`flex-1 flex flex-col p-0 min-h-0 ${
          bubbleStyle === "parentGlass" ? "bg-[hsl(var(--pp-bg))]" : "bg-muted/30"
        }`}
      >
        <ScrollArea className="flex-1 min-h-0 px-3 py-4 [&>[data-radix-scroll-area-viewport]]:max-h-full">
          <div className="space-y-2 pr-2">
            {chatTimeline.map(renderBubble)}
          </div>
          {message.group_id && onNavigateToGroup && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 bg-white"
              onClick={() => onNavigateToGroup(message.group_id!)}
            >
              <Users className="h-4 w-4 mr-2" />
              View in Group Chat
            </Button>
          )}
        </ScrollArea>

        {canReply && (
          <div
            className={`shrink-0 border-t p-3 space-y-2 ${
              bubbleStyle === "parentGlass"
                ? "border-white/60 bg-white/70 backdrop-blur-md"
                : "bg-background"
            }`}
          >
            {mediaEnabled && mediaUploading ? (
              <MessageMediaComposer
                disabled={sending}
                uploading={mediaUploading}
                uploadProgress={mediaProgress}
                onPick={handleSendMedia}
                onCancelUpload={() => {
                  toast.message("Upload in progress — wait for it to finish or refresh to reset.");
                }}
              />
            ) : null}
            <div className="flex items-end gap-2">
              {mediaEnabled ? (
                <MessageMediaComposer
                  variant="inline"
                  disabled={sending}
                  uploading={mediaUploading}
                  uploadProgress={mediaProgress}
                  onPick={handleSendMedia}
                />
              ) : null}
              <Textarea
                placeholder={mediaEnabled ? "Message…" : "Type a reply…"}
                rows={1}
                className={`min-h-[44px] flex-1 resize-none rounded-3xl border shadow-sm ${
                  bubbleStyle === "parentGlass"
                    ? "border-white/90 bg-white/88 backdrop-blur-sm"
                    : "bg-white"
                }`}
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={mediaUploading}
              />
              <Button
                onClick={handleSendReply}
                disabled={sending || mediaUploading || !newReply.trim()}
                size="icon"
                className="shrink-0 rounded-full h-11 w-11"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
