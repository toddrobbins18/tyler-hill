import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Send, Users, Reply } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fetchMessageProfileLabels, inboxFromDisplayName } from "@/lib/messageProfiles";
import MessageBody from "@/components/messages/MessageBody";

interface ThreadMessage {
  id: string;
  subject: string;
  content: string;
  created_at: string;
  read: boolean;
  sender_id: string | null;
  recipient_id: string | null;
  parent_message_id?: string | null;
  group_id?: string | null;
  sender_display_name?: string | null;
  sender_name?: string;
  recipient_name?: string;
  notification_type?: string | null;
}

interface InlineThreadProps {
  message: ThreadMessage;
  viewMode: 'inbox' | 'sent';
  /** Current camp — used with RPC so reply thread resolves sender names under RLS. */
  campCompanyId?: string;
  onNavigateToGroup?: (groupId: string) => void;
}

export default function InlineThread({ message, viewMode, campCompanyId, onNavigateToGroup }: InlineThreadProps) {
  const [replies, setReplies] = useState<ThreadMessage[]>([]);
  const [newReply, setNewReply] = useState("");
  const [sending, setSending] = useState(false);
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [message.id]);

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
  };

  const handleSendReply = async () => {
    if (!newReply.trim() || !currentUserId) return;

    setSending(true);
    try {
      const recipientId = currentUserId === message.sender_id
        ? message.recipient_id
        : message.sender_id;

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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {message.subject}
          {message.sender_id === null && (
            <Badge variant="secondary">Automated</Badge>
          )}
        </CardTitle>
        <CardDescription className="space-y-1">
          <span className="block">
            {format(new Date(message.created_at), 'MMMM d, yyyy h:mm a')}
          </span>
          {viewMode === 'inbox' && (
            <span className="block font-medium text-foreground">
              From:{" "}
              {inboxFromDisplayName({
                sender_name: message.sender_name,
                sender_id: message.sender_id,
                sender_display_name: message.sender_display_name,
                notification_type: message.notification_type,
                subject: message.subject,
                group_id: message.group_id,
              })}
            </span>
          )}
          {viewMode === 'sent' && (
            <span className="block font-medium text-foreground">
              To: {message.recipient_name || "Unknown"}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4 pt-0 min-h-0">
        <ScrollArea className="flex-1">
          {/* Original message */}
          <div className="p-3 bg-muted rounded-lg mb-4">
            <MessageBody
              content={message.content}
              senderId={message.sender_id}
              notificationType={message.notification_type}
            />
          </div>

          {/* Group link */}
          {message.group_id && onNavigateToGroup && (
            <Button
              variant="outline"
              size="sm"
              className="mb-4"
              onClick={() => onNavigateToGroup(message.group_id!)}
            >
              <Users className="h-4 w-4 mr-2" />
              View in Group Chat
            </Button>
          )}

          {/* Replies */}
          {replies.length > 0 && (
            <div className="space-y-3">
              {replies.map(reply => {
                const isMe = reply.sender_id === currentUserId;
                return (
                  <div key={reply.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      {!isMe && (
                        <p className="text-xs font-semibold mb-1 opacity-80">{reply.sender_name}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                      <p className={`text-xs mt-1 ${isMe ? 'opacity-70' : 'text-muted-foreground'}`}>
                        {format(new Date(reply.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Reply input - only show if there's a sender to reply to */}
        {message.sender_id && (
          <div className="flex gap-2 pt-3 border-t mt-3">
            <Textarea
              placeholder="Type a reply..."
              rows={1}
              className="min-h-[40px] resize-none"
              value={newReply}
              onChange={(e) => setNewReply(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button onClick={handleSendReply} disabled={sending || !newReply.trim()} size="icon" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
