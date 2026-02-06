import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Users, Plus, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";
import CreateGroupDialog from "./CreateGroupDialog";
import GroupChatView from "./GroupChatView";

interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  last_message?: string;
  last_message_at?: string;
  last_sender_name?: string;
}

export default function GroupList() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const { currentCompany } = useCompany();

  useEffect(() => {
    if (currentCompany?.id) fetchGroups();
  }, [currentCompany?.id]);

  const fetchGroups = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get groups user belongs to
    const { data: memberships } = await supabase
      .from("message_group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (!memberships?.length) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const groupIds = memberships.map(m => m.group_id);

    const { data: groupsData } = await supabase
      .from("message_groups")
      .select("id, name, description")
      .in("id", groupIds)
      .order("updated_at", { ascending: false });

    if (!groupsData) {
      setLoading(false);
      return;
    }

    // Get member counts and latest messages for each group
    const summaries: GroupSummary[] = [];
    for (const group of groupsData) {
      const { count } = await supabase
        .from("message_group_members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", group.id);

      const { data: lastMsg } = await supabase
        .from("group_messages")
        .select("content, created_at, sender_id")
        .eq("group_id", group.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let lastSenderName = undefined;
      if (lastMsg?.sender_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", lastMsg.sender_id)
          .maybeSingle();
        lastSenderName = profile?.full_name || "Unknown";
      }

      summaries.push({
        id: group.id,
        name: group.name,
        description: group.description,
        member_count: count || 0,
        last_message: lastMsg?.content,
        last_message_at: lastMsg?.created_at,
        last_sender_name: lastSenderName,
      });
    }

    setGroups(summaries);
    setLoading(false);
  };

  if (selectedGroupId) {
    return (
      <GroupChatView
        groupId={selectedGroupId}
        onBack={() => {
          setSelectedGroupId(null);
          fetchGroups();
        }}
      />
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Group Conversations
              </CardTitle>
              <CardDescription>{groups.length} groups</CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Group
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">Loading groups...</div>
            ) : groups.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No groups yet</p>
                <p className="text-sm mt-1">Create a group to start a conversation</p>
                <Button onClick={() => setShowCreateDialog(true)} className="mt-4" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Create Group
                </Button>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.id}>
                  <button
                    onClick={() => setSelectedGroupId(group.id)}
                    className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="h-4 w-4 text-primary shrink-0" />
                          <p className="font-medium truncate">{group.name}</p>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {group.member_count}
                          </Badge>
                        </div>
                        {group.description && (
                          <p className="text-xs text-muted-foreground mb-1">{group.description}</p>
                        )}
                        {group.last_message ? (
                          <p className="text-sm text-muted-foreground truncate">
                            <span className="font-medium">{group.last_sender_name}:</span>{" "}
                            {group.last_message.substring(0, 80)}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No messages yet</p>
                        )}
                        {group.last_message_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(group.last_message_at), 'MMM d, h:mm a')}
                          </p>
                        )}
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

      <CreateGroupDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onGroupCreated={fetchGroups}
      />
    </>
  );
}
