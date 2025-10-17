import { useState, useEffect } from "react";
import { Mail, Send, Eye, Clock, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

interface RecipientGroup {
  id: string;
  name: string;
  count: number;
  role: string;
}

interface Message {
  id: string;
  subject: string;
  content: string;
  created_at: string;
  read: boolean;
  sender_id: string | null;
}

export default function Messages() {
  const [recipientGroups, setRecipientGroups] = useState<RecipientGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'compose' | 'inbox'>('inbox');
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchRecipientGroups();
    fetchMessages();

    // Subscribe to real-time message updates
    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => fetchMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setReceivedMessages(data);
      setUnreadCount(data.filter(m => !m.read).length);
    }
  };

  const markAsRead = async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ read: true })
      .eq("id", messageId);

    if (!error) {
      fetchMessages();
    }
  };

  const handleMessageClick = (msg: Message) => {
    setSelectedMessage(msg);
    if (!msg.read) {
      markAsRead(msg.id);
    }
  };

  const fetchRecipientGroups = async () => {
    setLoading(true);
    
    // Fetch all users with accounts (from profiles)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, user_roles(role)");

    if (!profiles) {
      setLoading(false);
      return;
    }

    // Group by role
    const roleGroups: Record<string, number> = {};
    
    profiles.forEach((profile: any) => {
      const roles = profile.user_roles || [];
      roles.forEach((roleObj: any) => {
        const role = roleObj.role;
        roleGroups[role] = (roleGroups[role] || 0) + 1;
      });
    });

    // Create recipient groups from roles
    const groups: RecipientGroup[] = Object.entries(roleGroups).map(([role, count]) => ({
      id: role,
      name: role.charAt(0).toUpperCase() + role.slice(1) + "s",
      count,
      role,
    }));

    setRecipientGroups(groups);
    setLoading(false);
  };

  const handleGroupToggle = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSend = () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in subject and message");
      return;
    }

    if (selectedGroups.length === 0) {
      toast.error("Please select at least one recipient group");
      return;
    }

    // TODO: Implement actual email sending via edge function
    toast.success(`Message queued to send to ${selectedGroups.length} group(s)`);
    
    // Reset form
    setSubject("");
    setMessage("");
    setSelectedGroups([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Mail className="h-8 w-8" />
            Messages
          </h1>
          <p className="text-muted-foreground">View notifications and compose messages</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'inbox' ? 'default' : 'outline'}
            onClick={() => setViewMode('inbox')}
          >
            <Bell className="h-4 w-4 mr-2" />
            Inbox {unreadCount > 0 && `(${unreadCount})`}
          </Button>
          <Button
            variant={viewMode === 'compose' ? 'default' : 'outline'}
            onClick={() => setViewMode('compose')}
          >
            <Send className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>
      </div>

      {viewMode === 'inbox' ? (
        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* Message List */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications & Messages</CardTitle>
              <CardDescription>{receivedMessages.length} total messages</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {receivedMessages.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No messages yet
                  </div>
                ) : (
                  receivedMessages.map((msg) => (
                    <div key={msg.id}>
                      <button
                        onClick={() => handleMessageClick(msg)}
                        className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                          selectedMessage?.id === msg.id ? 'bg-muted' : ''
                        } ${!msg.read ? 'bg-primary/5 border-l-4 border-primary' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`font-medium truncate ${!msg.read ? 'font-bold' : ''}`}>
                                {msg.subject}
                              </p>
                              {!msg.read && (
                                <Badge variant="default" className="h-5 px-1 text-xs">NEW</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {msg.content.substring(0, 100)}...
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(msg.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                      </button>
                      <Separator />
                    </div>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Message Detail */}
          <Card>
            <CardHeader>
              {selectedMessage ? (
                <>
                  <CardTitle className="flex items-center gap-2">
                    {selectedMessage.subject}
                    {selectedMessage.sender_id === null && (
                      <Badge variant="secondary">System</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {format(new Date(selectedMessage.created_at), 'MMMM d, yyyy h:mm a')}
                  </CardDescription>
                </>
              ) : (
                <CardTitle>Select a message</CardTitle>
              )}
            </CardHeader>
            <CardContent>
              {selectedMessage ? (
                <ScrollArea className="h-[500px]">
                  <div className="whitespace-pre-wrap text-sm">{selectedMessage.content}</div>
                </ScrollArea>
              ) : (
                <div className="h-[500px] flex items-center justify-center text-muted-foreground">
                  Select a message to view its contents
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        // Compose Mode - Keep existing compose UI
        <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Compose Message</CardTitle>
              <CardDescription>Create and send messages to selected groups</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <Input
                  type="text"
                  placeholder="Message subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Message</label>
                <Textarea
                  placeholder="Write your message here..."
                  rows={8}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setSubject("");
                  setMessage("");
                  setSelectedGroups([]);
                }}>
                  Clear
                </Button>
                <Button onClick={handleSend}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Recipients</CardTitle>
              <CardDescription>Select who will receive this message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading recipients...</p>
              ) : recipientGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recipient groups found</p>
              ) : (
                recipientGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedGroups.includes(group.id)
                        ? "bg-primary/10 border-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => handleGroupToggle(group.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm">{group.name}</p>
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedGroups.includes(group.id)}
                        onChange={() => handleGroupToggle(group.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {group.count} {group.count === 1 ? "person" : "people"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{group.role}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card bg-info/5 border-info/20">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Mail className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1 text-info">Email Integration</p>
                  <p className="text-xs text-muted-foreground">
                    Messages will be sent only to users with active accounts. Recipients can reply directly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}
