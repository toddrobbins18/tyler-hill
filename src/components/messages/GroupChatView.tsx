import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Send, ArrowLeft, MessageSquare, Reply } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  parent_message_id: string | null;
  created_at: string;
  sender_name?: string;
}

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  member_count: number;
  members: { user_id: string; full_name: string }[];
}

interface GroupChatViewProps {
  groupId: string;
  onBack: () => void;
}

export default function GroupChatView({ groupId, onBack }: GroupChatViewProps) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    init();
  }, []);

  useEffect(() => {
    if (!groupId) return;
    fetchGroupInfo();
    fetchMessages();

    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        () => fetchMessages()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  useEffect(() => {
    // Scroll to bottom when messages update
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const resolveNames = useCallback(async (senderIds: string[]) => {
    const unknownIds = senderIds.filter(id => !profileCache[id]);
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

  const fetchGroupInfo = async () => {
    const { data: group } = await supabase
      .from("message_groups")
      .select("id, name, description, created_by")
      .eq("id", groupId)
      .single();

    if (!group) return;

    const { data: members } = await supabase
      .from("message_group_members")
      .select("user_id")
      .eq("group_id", groupId);

    const memberIds = members?.map(m => m.user_id) || [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", memberIds);

    setGroupInfo({
      ...group,
      member_count: memberIds.length,
      members: profiles?.map(p => ({ user_id: p.id, full_name: p.full_name || "Unknown" })) || [],
    });
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("group_messages")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });

    if (error || !data) return;

    const senderIds = [...new Set(data.map(m => m.sender_id))];
    const cache = await resolveNames(senderIds);

    const enriched = data.map(m => ({
      ...m,
      sender_name: cache[m.sender_id] || "Unknown",
    }));
    setMessages(enriched);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUserId) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from("group_messages")
        .insert({
          group_id: groupId,
          sender_id: currentUserId,
          content: newMessage.trim(),
          parent_message_id: replyTo?.id || null,
        });

      if (error) throw error;
      setNewMessage("");
      setReplyTo(null);
    } catch (error: any) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages into threads (top-level + replies)
  const topLevelMessages = messages.filter(m => !m.parent_message_id);
  const repliesMap = new Map<string, GroupMessage[]>();
  messages.filter(m => m.parent_message_id).forEach(m => {
    const replies = repliesMap.get(m.parent_message_id!) || [];
    replies.push(m);
    repliesMap.set(m.parent_message_id!, replies);
  });

  return (
    <div className="flex flex-col h-[700px]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            {groupInfo?.name || "Loading..."}
          </h2>
          <p className="text-sm text-muted-foreground">
            {groupInfo?.member_count} members: {groupInfo?.members.map(m => m.full_name).join(", ")}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 py-4" ref={scrollRef}>
        <div className="space-y-4 pr-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            topLevelMessages.map((msg) => {
              const replies = repliesMap.get(msg.id) || [];
              const isMe = msg.sender_id === currentUserId;

              return (
                <div key={msg.id} className="space-y-2">
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg p-3 ${
                      isMe 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
                      {!isMe && (
                        <p className="text-xs font-semibold mb-1 opacity-80">
                          {msg.sender_name}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex items-center justify-between mt-1 gap-4">
                        <p className={`text-xs ${isMe ? 'opacity-70' : 'text-muted-foreground'}`}>
                          {format(new Date(msg.created_at), 'h:mm a')}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-5 px-1 text-xs ${isMe ? 'text-primary-foreground/70 hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                          onClick={() => setReplyTo(msg)}
                        >
                          <Reply className="h-3 w-3 mr-1" />
                          Reply
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Replies */}
                  {replies.length > 0 && (
                    <div className="ml-8 space-y-2 border-l-2 border-muted pl-3">
                      {replies.map(reply => {
                        const isReplyMe = reply.sender_id === currentUserId;
                        return (
                          <div key={reply.id} className={`flex ${isReplyMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] rounded-lg p-2 ${
                              isReplyMe 
                                ? 'bg-primary/80 text-primary-foreground' 
                                : 'bg-muted/80'
                            }`}>
                              {!isReplyMe && (
                                <p className="text-xs font-semibold mb-0.5 opacity-80">
                                  {reply.sender_name}
                                </p>
                              )}
                              <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                              <p className={`text-xs mt-0.5 ${isReplyMe ? 'opacity-70' : 'text-muted-foreground'}`}>
                                {format(new Date(reply.created_at), 'h:mm a')}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Reply indicator */}
      {replyTo && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-t rounded-t-md">
          <Reply className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground truncate flex-1">
            Replying to {replyTo.sender_name}: {replyTo.content.substring(0, 50)}...
          </span>
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setReplyTo(null)}>
            ✕
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t">
        <Textarea
          placeholder="Type a message..."
          rows={1}
          className="min-h-[40px] resize-none"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button onClick={handleSend} disabled={sending || !newMessage.trim()} size="icon" className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
