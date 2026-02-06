import { useState, useEffect, useCallback } from "react";
import { Mail, Send, Eye, Clock, Bell, Users, User, ChevronDown, ChevronUp, ArrowLeft, SendHorizonal, Reply, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import GroupList from "@/components/messages/GroupList";
import ReplyThread from "@/components/messages/ReplyThread";

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
  recipient_id: string | null;
  parent_message_id?: string | null;
  sender_name?: string;
  recipient_name?: string;
  reply_count?: number;
}

const TAG_LABELS: Record<string, string> = {
  nurse: "Nurses",
  transportation: "Transportation",
  food_service: "Food Service",
  specialist: "Specialists",
  division_leader: "Division Leaders",
  director: "Directors",
  general_staff: "General Staff",
  admin_staff: "Admin Staff",
};

const TAG_COLORS: Record<string, string> = {
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
  const [viewMode, setViewMode] = useState<'compose' | 'inbox' | 'sent' | 'groups'>('inbox');
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showReplyThread, setShowReplyThread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showRecipientPreview, setShowRecipientPreview] = useState(false);
  const [deliveryMethods, setDeliveryMethods] = useState({
    inApp: true,
    email: false
  });
  const [emailConfig, setEmailConfig] = useState<any>(null);
  const [profileCache, setProfileCache] = useState<Record<string, string>>({});
  const { currentCompany } = useCompany();

  const resolveProfileNames = useCallback(async (messages: any[]) => {
    const unknownIds = new Set<string>();
    messages.forEach(m => {
      if (m.sender_id && !profileCache[m.sender_id]) unknownIds.add(m.sender_id);
      if (m.recipient_id && !profileCache[m.recipient_id]) unknownIds.add(m.recipient_id);
    });

    if (unknownIds.size === 0) return profileCache;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", Array.from(unknownIds));

    const newCache = { ...profileCache };
    profiles?.forEach(p => {
      newCache[p.id] = p.full_name || p.email || "Unknown";
    });
    setProfileCache(newCache);
    return newCache;
  }, [profileCache]);

  useEffect(() => {
    if (!currentCompany?.id) return;
    fetchTagGroups();
    fetchAllUsers();
    fetchMessages();
    fetchSentMessages();
    fetchEmailConfig();

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          fetchMessages();
          fetchSentMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id]);

  const fetchMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Only fetch top-level messages (not replies)
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("recipient_id", user.id)
      .is("parent_message_id", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const cache = await resolveProfileNames(data);

      // Get reply counts for each message
      const enrichedPromises = data.map(async (m) => {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("parent_message_id", m.id);

        return {
          ...m,
          sender_name: m.sender_id ? (cache[m.sender_id] || "Unknown") : undefined,
          reply_count: count || 0,
        };
      });

      const enriched = await Promise.all(enrichedPromises);
      setReceivedMessages(enriched);
      setUnreadCount(enriched.filter(m => !m.read).length);
    }
  };

  const fetchSentMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("sender_id", user.id)
      .is("parent_message_id", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const cache = await resolveProfileNames(data);
      const enriched = data.map(m => ({
        ...m,
        recipient_name: m.recipient_id ? (cache[m.recipient_id] || "Unknown") : undefined,
      }));
      setSentMessages(enriched);
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
    setShowReplyThread(false);
    if (!msg.read && viewMode === 'inbox') {
      markAsRead(msg.id);
    }
  };

  const fetchTagGroups = async () => {
    setLoading(true);
    
    const { data: userTags, error } = await supabase
      .from("user_tags")
      .select("tag")
      .eq("company_id", currentCompany!.id);

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
      label: TAG_LABELS[tag] || tag,
      count,
      color: TAG_COLORS[tag] || "bg-gray-100 text-gray-800",
    }));

    setTagGroups(groups);
    setLoading(false);
  };

  const fetchEmailConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("company_email_config")
        .select("is_configured, is_active")
        .eq("company_id", currentCompany?.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching email config:", error);
      }
      setEmailConfig(data);
    } catch (error) {
      console.error("Error fetching email config:", error);
    }
  };

  const fetchAllUsers = async () => {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("company_id", currentCompany!.id)
      .order("full_name");

    if (profilesError || !profiles) return;

    const { data: userTags } = await supabase
      .from("user_tags")
      .select("user_id, tag")
      .eq("company_id", currentCompany!.id);

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

    if (!deliveryMethods.inApp && !deliveryMethods.email) {
      toast.error("Please select at least one delivery method");
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
          deliveryMethods: {
            inApp: deliveryMethods.inApp,
            email: deliveryMethods.email
          }
        },
      });

      if (error) throw error;

      const methodsUsed = [];
      if (deliveryMethods.inApp) methodsUsed.push("in-app notification");
      if (deliveryMethods.email) methodsUsed.push("email");

      toast.success(`${methodsUsed.join(" and ")} sent to ${uniqueRecipients.length} recipient(s)!`);
      
      setSubject("");
      setMessage("");
      setSelectedTags([]);
      setSelectedUserIds([]);
      setDeliveryMethods({ inApp: true, email: false });
    } catch (error: any) {
      toast.error(error.message || "Failed to send notification");
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const activeMessages = viewMode === 'sent' ? sentMessages : receivedMessages;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Notifications & Messages
          </h1>
          <p className="text-muted-foreground">Send notifications, chat in groups, and reply to messages</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'inbox' ? 'default' : 'outline'}
            onClick={() => { setViewMode('inbox'); setSelectedMessage(null); setShowReplyThread(false); }}
          >
            <Bell className="h-4 w-4 mr-2" />
            Inbox {unreadCount > 0 && `(${unreadCount})`}
          </Button>
          <Button
            variant={viewMode === 'sent' ? 'default' : 'outline'}
            onClick={() => { setViewMode('sent'); setSelectedMessage(null); setShowReplyThread(false); }}
          >
            <SendHorizonal className="h-4 w-4 mr-2" />
            Sent
          </Button>
          <Button
            variant={viewMode === 'groups' ? 'default' : 'outline'}
            onClick={() => { setViewMode('groups'); setSelectedMessage(null); setShowReplyThread(false); }}
          >
            <Users className="h-4 w-4 mr-2" />
            Groups
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

      {/* Groups Tab */}
      {viewMode === 'groups' && <GroupList />}

      {/* Inbox / Sent Tab */}
      {(viewMode === 'inbox' || viewMode === 'sent') && (
        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{viewMode === 'sent' ? 'Sent Messages' : 'Notifications & Messages'}</CardTitle>
              <CardDescription>{activeMessages.length} total messages</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {activeMessages.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    {viewMode === 'sent' ? 'No sent messages yet' : 'No messages yet'}
                  </div>
                ) : (
                  activeMessages.map((msg) => (
                    <div key={msg.id}>
                      <button
                        onClick={() => handleMessageClick(msg)}
                        className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                          selectedMessage?.id === msg.id ? 'bg-muted' : ''
                        } ${viewMode === 'inbox' && !msg.read ? 'bg-primary/5 border-l-4 border-primary' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`font-medium truncate ${viewMode === 'inbox' && !msg.read ? 'font-bold' : ''}`}>
                                {msg.subject}
                              </p>
                              {viewMode === 'inbox' && !msg.read && (
                                <Badge variant="default" className="h-5 px-1 text-xs">NEW</Badge>
                              )}
                              {(msg.reply_count ?? 0) > 0 && (
                                <Badge variant="outline" className="h-5 px-1 text-xs flex items-center gap-0.5">
                                  <Reply className="h-3 w-3" />
                                  {msg.reply_count}
                                </Badge>
                              )}
                            </div>
                            {viewMode === 'inbox' && (
                              <p className="text-xs font-medium text-primary mb-1">
                                From: {msg.sender_name || "System Notification"}
                              </p>
                            )}
                            {viewMode === 'sent' && (
                              <p className="text-xs font-medium text-primary mb-1">
                                To: {msg.recipient_name || "Unknown"}
                              </p>
                            )}
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

          {/* Message Detail / Reply Thread */}
          {showReplyThread && selectedMessage ? (
            <ReplyThread
              originalMessage={selectedMessage}
              onBack={() => {
                setShowReplyThread(false);
                fetchMessages();
                fetchSentMessages();
              }}
            />
          ) : (
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
                    <CardDescription className="space-y-1">
                      <span className="block">
                        {format(new Date(selectedMessage.created_at), 'MMMM d, yyyy h:mm a')}
                      </span>
                      {viewMode === 'inbox' && (
                        <span className="block font-medium text-foreground">
                          From: {selectedMessage.sender_name || "System Notification"}
                        </span>
                      )}
                      {viewMode === 'sent' && (
                        <span className="block font-medium text-foreground">
                          To: {selectedMessage.recipient_name || "Unknown"}
                        </span>
                      )}
                    </CardDescription>
                  </>
                ) : (
                  <CardTitle>Select a message</CardTitle>
                )}
              </CardHeader>
              <CardContent>
                {selectedMessage ? (
                  <div className="space-y-4">
                    <ScrollArea className="h-[430px]">
                      <div className="whitespace-pre-wrap text-sm">{selectedMessage.content}</div>
                    </ScrollArea>
                    {/* Reply button */}
                    {selectedMessage.sender_id && (
                      <div className="flex items-center gap-2 pt-3 border-t">
                        <Button
                          variant="outline"
                          onClick={() => setShowReplyThread(true)}
                          className="flex items-center gap-2"
                        >
                          <Reply className="h-4 w-4" />
                          Reply
                          {(selectedMessage.reply_count ?? 0) > 0 && (
                            <Badge variant="secondary" className="ml-1">
                              {selectedMessage.reply_count} {selectedMessage.reply_count === 1 ? 'reply' : 'replies'}
                            </Badge>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-[500px] flex items-center justify-center text-muted-foreground">
                    Select a message to view its contents
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Compose Tab - unchanged */}
      {viewMode === 'compose' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">
                    Multi-Channel Notifications
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Send notifications via in-app push alerts and/or email. In-app notifications are delivered instantly.
                    <span className="block mt-1 text-amber-600 dark:text-amber-400">
                      ⚠️ Email integration requires configuration (Microsoft 365 or Resend)
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Delivery Method
                </CardTitle>
                <CardDescription>Choose how to deliver this notification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="in-app"
                    checked={deliveryMethods.inApp}
                    onCheckedChange={(checked) =>
                      setDeliveryMethods(prev => ({ ...prev, inApp: !!checked }))
                    }
                  />
                  <label htmlFor="in-app" className="flex items-center gap-2 cursor-pointer">
                    <Bell className="h-4 w-4 text-blue-500" />
                    <span>In-App Notification (Push)</span>
                    <Badge variant="secondary">Instant</Badge>
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="email"
                    checked={deliveryMethods.email}
                    onCheckedChange={(checked) =>
                      setDeliveryMethods(prev => ({ ...prev, email: !!checked }))
                    }
                  />
                  <label htmlFor="email" className="flex items-center gap-2 cursor-pointer">
                    <Mail className="h-4 w-4 text-green-500" />
                    <span>Email Notification</span>
                    {emailConfig?.is_configured && emailConfig?.is_active ? (
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600">
                        Not Configured
                      </Badge>
                    )}
                  </label>
                </div>
                
                {!deliveryMethods.inApp && !deliveryMethods.email && (
                  <p className="text-sm text-destructive">
                    ⚠️ Please select at least one delivery method
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compose Notification</CardTitle>
                <CardDescription>Create and send notifications to selected recipients</CardDescription>
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
                  {sending ? "Sending..." : "Send Notification"}
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>

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
                                  {TAG_LABELS[tag]}
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
