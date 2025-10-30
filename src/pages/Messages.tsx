import { useState, useEffect } from "react";
import { Mail, Send, Eye, Clock, Bell, Users, User, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

interface TagGroup {
  tag: string;
  label: string;
  count: number;
  color: string;
}

interface UserOption {
  id: string;
  email: string;
  full_name: string;
  tags: string[];
}

interface Message {
  id: string;
  subject: string;
  content: string;
  created_at: string;
  read: boolean;
  sender_id: string | null;
}

const TAG_LABELS = {
  nurse: "Nurses",
  transportation: "Transportation",
  food_service: "Food Service",
  specialist: "Specialists",
  division_leader: "Division Leaders",
  director: "Directors",
  general_staff: "General Staff",
  admin_staff: "Admin Staff",
};

const TAG_COLORS = {
  nurse: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  transportation: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  food_service: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  specialist: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  division_leader: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  director: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  general_staff: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  admin_staff: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export default function Messages() {
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [viewMode, setViewMode] = useState<'compose' | 'inbox'>('inbox');
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showRecipientPreview, setShowRecipientPreview] = useState(false);

  useEffect(() => {
    fetchTagGroups();
    fetchAllUsers();
    fetchMessages();

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

  const fetchTagGroups = async () => {
    setLoading(true);
    
    const { data: userTags, error } = await supabase
      .from("user_tags")
      .select("tag");

    if (error || !userTags) {
      setLoading(false);
      return;
    }

    const tagCounts: Record<string, number> = {};
    userTags.forEach((item) => {
      tagCounts[item.tag] = (tagCounts[item.tag] || 0) + 1;
    });

    const groups: TagGroup[] = Object.entries(tagCounts).map(([tag, count]) => ({
      tag,
      label: TAG_LABELS[tag as keyof typeof TAG_LABELS] || tag,
      count,
      color: TAG_COLORS[tag as keyof typeof TAG_COLORS] || "bg-gray-100 text-gray-800",
    }));

    setTagGroups(groups);
    setLoading(false);
  };

  const fetchAllUsers = async () => {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .order("full_name");

    if (profilesError || !profiles) return;

    const { data: userTags } = await supabase
      .from("user_tags")
      .select("user_id, tag");

    const users: UserOption[] = profiles.map((profile) => ({
      id: profile.id,
      email: profile.email || "",
      full_name: profile.full_name || "Unknown",
      tags: userTags?.filter((tag) => tag.user_id === profile.id).map((tag) => tag.tag) || [],
    }));

    setAllUsers(users);
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const getUniqueRecipients = () => {
    const recipientSet = new Set<string>();

    selectedTags.forEach((tag) => {
      allUsers.forEach((user) => {
        if (user.tags.includes(tag)) {
          recipientSet.add(user.id);
        }
      });
    });

    selectedUserIds.forEach((id) => recipientSet.add(id));

    return Array.from(recipientSet).map((id) => allUsers.find((u) => u.id === id)!).filter(Boolean);
  };

  const filteredUsers = allUsers.filter((user) =>
    user.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const uniqueRecipients = getUniqueRecipients();

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in subject and message");
      return;
    }

    if (uniqueRecipients.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-bulk-email", {
        body: {
          subject,
          message,
          recipientTags: selectedTags,
          recipientIds: selectedUserIds,
        },
      });

      if (error) throw error;

      toast.success(`Email queued for ${uniqueRecipients.length} recipient(s)`);
      
      setSubject("");
      setMessage("");
      setSelectedTags([]);
      setSelectedUserIds([]);
    } catch (error: any) {
      toast.error(error.message || "Failed to send email");
      console.error(error);
    } finally {
      setSending(false);
    }
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
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <Card>
            <CardHeader>
              <CardTitle>Compose Message</CardTitle>
              <CardDescription>Create and send messages to selected recipients</CardDescription>
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
                  rows={12}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setSubject("");
                  setMessage("");
                  setSelectedTags([]);
                  setSelectedUserIds([]);
                }}>
                  Clear
                </Button>
                <Button onClick={handleSend} disabled={sending}>
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "Sending..." : "Send Message"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Tag Groups
                </CardTitle>
                <CardDescription>Select groups by tag</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : tagGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tags found</p>
                ) : (
                  tagGroups.map((group) => (
                    <div
                      key={group.tag}
                      className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleTagToggle(group.tag)}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Checkbox
                          checked={selectedTags.includes(group.tag)}
                          onCheckedChange={() => handleTagToggle(group.tag)}
                        />
                        <span className="text-sm font-medium">{group.label}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {group.count}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Individual Users
                </CardTitle>
                <CardDescription>Select specific users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Search users..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-start gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleUserToggle(user.id)}
                      >
                        <Checkbox
                          checked={selectedUserIds.includes(user.id)}
                          onCheckedChange={() => handleUserToggle(user.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          {user.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {user.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {TAG_LABELS[tag as keyof typeof TAG_LABELS]}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Recipient Preview</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRecipientPreview(!showRecipientPreview)}
                  >
                    {showRecipientPreview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
                <CardDescription>
                  {uniqueRecipients.length} {uniqueRecipients.length === 1 ? 'recipient' : 'recipients'} selected
                </CardDescription>
              </CardHeader>
              {showRecipientPreview && (
                <CardContent>
                  <ScrollArea className="h-[150px]">
                    <div className="space-y-1 text-xs">
                      {uniqueRecipients.map((recipient) => (
                        <div key={recipient.id}>
                          <span className="font-medium">{recipient.full_name}</span>
                          <span className="text-muted-foreground ml-2">{recipient.email}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              )}
            </Card>

            <Card className="bg-info/5 border-info/20">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Mail className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium mb-1 text-info">Email Integration Pending</p>
                    <p className="text-xs text-muted-foreground">
                      Email sending functionality will be enabled once Microsoft 365 integration is configured. For now, messages are logged but not sent.
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
