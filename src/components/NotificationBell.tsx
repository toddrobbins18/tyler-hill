import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Trophy, Calendar, AlertTriangle, Stethoscope, BookOpen, Users, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

interface InboxMessage {
  id: string;
  subject: string;
  content: string;
  sender_id: string;
  created_at: string;
  read: boolean;
  notification_type: string | null;
  group_id: string | null;
  sender_name?: string;
}

function getNotificationIcon(type: string | null, subject: string) {
  // Check notification_type first, then fall back to subject keywords
  if (type === "notification" || !type) {
    const s = subject.toLowerCase();
    if (s.includes("sports academy") || s.includes("athletics")) return Trophy;
    if (s.includes("staff assignment") || s.includes("assigned")) return Users;
    if (s.includes("incident")) return AlertTriangle;
    if (s.includes("appointment") || s.includes("tooth fairy")) return Stethoscope;
    if (s.includes("tutoring") || s.includes("therapy")) return BookOpen;
    if (s.includes("group") || s.includes("message in")) return Mail;
    if (s.includes("event") || s.includes("calendar") || s.includes("schedule")) return Calendar;
  }
  return Bell;
}

function getNotificationLabel(type: string | null, subject: string): string | null {
  const s = subject.toLowerCase();
  if (s.includes("sports academy") || s.includes("athletics")) return "Sports";
  if (s.includes("staff assignment") || s.includes("assigned")) return "Assignment";
  if (s.includes("incident")) return "Incident";
  if (s.includes("appointment") || s.includes("tooth fairy")) return "Health";
  if (s.includes("tutoring") || s.includes("therapy")) return "Tutoring";
  if (s.includes("group") || s.includes("message in")) return "Group";
  if (s.includes("event") || s.includes("calendar")) return "Event";
  return null;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentMessages, setRecentMessages] = useState<InboxMessage[]>([]);
  const [open, setOpen] = useState(false);

  const fetchUnread = useCallback(async () => {
    if (!user) return;

    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("read", false);

    setUnreadCount(count || 0);
  }, [user]);

  const fetchRecent = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("messages")
      .select("id, subject, content, sender_id, created_at, read, notification_type, group_id")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8);

    if (data) {
      const senderIds = [...new Set(data.map((m) => m.sender_id).filter(Boolean))];
      let profileMap = new Map<string, string>();

      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", senderIds);

        profileMap = new Map(
          (profiles || []).map((p) => [
            p.id,
            p.full_name || p.email?.split("@")[0] || "System",
          ])
        );
      }

      setRecentMessages(
        data.map((m) => ({
          ...m,
          sender_name: m.sender_id ? profileMap.get(m.sender_id) || "System" : "System",
        }))
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchUnread();

    const channel = supabase
      .channel("notification-bell")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          fetchUnread();
          if (open) fetchRecent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, open, fetchUnread, fetchRecent]);

  useEffect(() => {
    if (open) fetchRecent();
  }, [open, fetchRecent]);

  const handleGoToMessages = (msg?: InboxMessage) => {
    setOpen(false);
    if (msg?.group_id) {
      sessionStorage.setItem("messages_view_mode", "groups");
      sessionStorage.setItem("messages_active_group_id", msg.group_id);
    } else {
      sessionStorage.setItem("messages_view_mode", "inbox");
    }
    navigate("/messages");
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await supabase
      .from("messages")
      .update({ read: true })
      .eq("recipient_id", user.id)
      .eq("read", false);
    setUnreadCount(0);
    setRecentMessages((prev) => prev.map((m) => ({ ...m, read: true })));
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-background">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-auto py-1"
              onClick={handleMarkAllRead}
            >
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {recentMessages.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              No notifications yet
            </p>
          ) : (
            <div>
              {recentMessages.map((msg) => {
                const Icon = getNotificationIcon(msg.notification_type, msg.subject);
                const label = getNotificationLabel(msg.notification_type, msg.subject);
                return (
                  <button
                    key={msg.id}
                    className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
                      !msg.read ? "bg-accent/20" : ""
                    }`}
                    onClick={() => handleGoToMessages(msg)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0 relative">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {!msg.read && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate flex-1">
                            {msg.subject}
                          </p>
                          {label && (
                            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                              {label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {msg.sender_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(msg.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => handleGoToMessages()}
          >
            View all messages
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
