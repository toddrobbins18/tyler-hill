import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Send, Reply, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ReplyMessage {
  id: string;
  subject: string;
  content: string;
  created_at: string;
  read: boolean;
  sender_id: string | null;
  recipient_id: string | null;
  parent_message_id?: string | null;
  sender_name?: string;
}

interface ReplyThreadProps {
  originalMessage: ReplyMessage;
  onBack: () => void;
}

export default function ReplyThread({ originalMessage, onBack }: ReplyThreadProps) {
  const [replies, setReplies] = useState<ReplyMessage[]>([]);
  const [newReply, setNewReply] = useState("");
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, string>>({});

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    init();
  }, []);

  useEffect(() => {
    fetchReplies();

    const channel = supabase
      .channel(`replies-${originalMessage.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          if (payload.new?.parent_message_id === originalMessage.id) {
            fetchReplies();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [originalMessage.id]);

  const resolveNames = useCallback(async (ids: string[]) => {
    const unknownIds = ids.filter(id => id && !profileCache[id]);
    if (unknownIds.length === 0) return profileCache;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", unknownIds);

    const newCache = { ...profileCache };
    profiles?.forEach(p => {
      newCache[p.id] = p.full_name || p.email || "Unknown";
    });
    setProfileCache(newCache);
    return newCache;
  }, [profileCache]);

  const fetchReplies = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("parent_message_id", originalMessage.id)
      .order("created_at", { ascending: true });

    if (error || !data) return;

    const senderIds = data.map(m => m.sender_id).filter(Boolean) as string[];
    const cache = await resolveNames(senderIds);

    const enriched = data.map(m => ({
      ...m,
      sender_name: m.sender_id ? (cache[m.sender_id] || "Unknown") : "System",
    }));
    setReplies(enriched);
  };

  const handleSendReply = async () => {
    if (!newReply.trim() || !currentUserId) return;

    setSending(true);
    try {
      // Determine recipient: if I'm the original sender, reply goes to original recipient
      // If I'm the recipient, reply goes to original sender
      const recipientId = currentUserId === originalMessage.sender_id
        ? originalMessage.recipient_id
        : originalMessage.sender_id;

      const { error } = await supabase
        .from("messages")
        .insert({
          sender_id: currentUserId,
          recipient_id: recipientId,
          subject: `Re: ${originalMessage.subject}`,
          content: newReply.trim(),
          parent_message_id: originalMessage.id,
          notification_type: 'message',
          read: false,
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
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <CardTitle className="text-base">{originalMessage.subject}</CardTitle>
            <p className="text-xs text-muted-foreground">
              From: {originalMessage.sender_name || "System"} · {format(new Date(originalMessage.created_at), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4 pt-0">
        <ScrollArea className="flex-1">
          {/* Original message */}
          <div className="p-3 bg-muted rounded-lg mb-4">
            <p className="text-sm whitespace-pre-wrap">{originalMessage.content}</p>
          </div>

          {/* Replies */}
          {replies.length === 0 ? (
            <div className="text-center text-muted-foreground py-6">
              <Reply className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No replies yet</p>
            </div>
          ) : (
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
                        {format(new Date(reply.created_at), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Reply input */}
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
      </CardContent>
    </Card>
  );
}
