import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, ImageIcon, MessageSquare, User } from "lucide-react";
import { ParentPortalMediaGallery } from "./ParentPortalMediaGallery";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import InlineThread from "@/components/messages/InlineThread";
import { EmptyState } from "./EmptyState";
import {
  fetchMessageRootById,
  listParentPortalThreads,
  openParentDivisionLeaderThread,
  type ParentPortalThreadRow,
} from "@/lib/parentPortalMessaging";
import { messageContentPreview } from "@/lib/messageContentUtils";
import { formatCampDateTime } from "@/lib/campTime";
import { cn } from "@/lib/utils";
import { markThreadRepliesReadForRecipient } from "@/lib/messageReadReceipts";

type Props = {
  companyId: string;
  companySlug?: string | null;
};

type ThreadMessage = {
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
};

type SectionTab = "chats" | "photos";

export function ParentMessagesView({ companyId, companySlug }: Props) {
  const [sectionTab, setSectionTab] = useState<SectionTab>("chats");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<ParentPortalThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedLeaderName, setSelectedLeaderName] = useState<string | null>(null);
  const [threadRoot, setThreadRoot] = useState<ThreadMessage | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const refreshList = useCallback(async () => {
    setLoading(true);
    const { rows: list, error } = await listParentPortalThreads(supabase, companyId);
    if (error) toast.error(error);
    setRows(list);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const openThreadByRootId = async (threadRootId: string, childId: string | null) => {
    const row = rows.find((r) => r.child_id === childId);
    setOpening(true);
    setSelectedChildId(childId);
    setSelectedLeaderName(row?.division_leader_name ?? null);
    const { message, error: fetchErr } = await fetchMessageRootById(supabase, threadRootId);
    if (fetchErr || !message) {
      toast.error(fetchErr ?? "Thread not found");
      setOpening(false);
      return;
    }
    const root = {
      ...(message as ThreadMessage),
      recipient_name: row?.division_leader_name ?? "Division leader",
    };
    setThreadRoot(root);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await markThreadRepliesReadForRecipient(supabase, root.id, user.id);
    setOpening(false);
  };

  const openThread = async (row: ParentPortalThreadRow) => {
    if (!row.division_leader_user_id) {
      toast.error("No division leader is assigned for this camper yet.");
      return;
    }
    setOpening(true);
    setSelectedChildId(row.child_id);
    setSelectedLeaderName(row.division_leader_name);
    const { threadRootId, error } = await openParentDivisionLeaderThread(supabase, row.child_id);
    if (error || !threadRootId) {
      toast.error(error ?? "Could not open conversation");
      setOpening(false);
      setSelectedChildId(null);
      return;
    }
    const { message, error: fetchErr } = await fetchMessageRootById(supabase, threadRootId);
    if (fetchErr || !message) {
      toast.error(fetchErr ?? "Thread not found");
      setOpening(false);
      setSelectedChildId(null);
      return;
    }
    const root = {
      ...(message as ThreadMessage),
      recipient_name: row.division_leader_name ?? "Division leader",
    };
    setThreadRoot(root);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await markThreadRepliesReadForRecipient(supabase, root.id, user.id);
    }
    setOpening(false);
  };

  const handleBack = () => {
    setSelectedChildId(null);
    setThreadRoot(null);
    void refreshList();
  };

  if (selectedChildId && threadRoot) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="rounded-xl -ml-2" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          All conversations
        </Button>
        <div className="flex h-[min(640px,calc(100vh-12rem))] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-[hsl(var(--pp-border))] bg-white shadow-sm">
          <InlineThread
            message={threadRoot}
            viewMode="sent"
            campCompanyId={companyId}
            campCompanySlug={companySlug}
            bubbleStyle="parentGlass"
          />
        </div>
        {selectedLeaderName ? (
          <p className="pp-text-muted text-center text-xs">
            Messages go to your camper&apos;s division leader ({selectedLeaderName}). Camp office may also
            assist if needed.
          </p>
        ) : null}
      </div>
    );
  }

  if (opening) {
    return (
      <div className="flex min-h-[240px] items-center justify-center pp-text-muted text-sm">
        Opening conversation…
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center pp-text-muted text-sm animate-pulse">
        Loading messages…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No campers linked"
        description="Link your campers to your family account to message their division leader from here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="pp-dashboard-section-title">Messages</h2>
        <p className="pp-text-muted mt-1 text-sm">
          Chat with your camper&apos;s division leader and view photos &amp; videos shared in your threads.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant={sectionTab === "chats" ? "default" : "outline"}
            size="sm"
            className="rounded-xl"
            onClick={() => setSectionTab("chats")}
          >
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Chats
          </Button>
          <Button
            type="button"
            variant={sectionTab === "photos" ? "default" : "outline"}
            size="sm"
            className="rounded-xl"
            onClick={() => setSectionTab("photos")}
          >
            <ImageIcon className="h-4 w-4 mr-1.5" />
            Photos &amp; videos
          </Button>
        </div>
      </div>
      {sectionTab === "photos" ? (
        <ParentPortalMediaGallery
          companyId={companyId}
          currentUserId={currentUserId}
          onOpenThread={(rootId, childId) => void openThreadByRootId(rootId, childId)}
        />
      ) : null}
      {sectionTab === "chats" ? (
      <Card className="rounded-2xl border-[hsl(var(--pp-border))] overflow-hidden">
        <CardContent className="p-0 divide-y divide-[hsl(var(--pp-border))]">
          {rows.map((row) => {
            const disabled = !row.division_leader_user_id;
            return (
              <button
                key={row.child_id}
                type="button"
                disabled={disabled}
                onClick={() => void openThread(row)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-4 text-left transition-colors",
                  disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-[hsl(var(--pp-brand-subtle))]",
                )}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--pp-brand-subtle))] text-[hsl(var(--pp-brand))]">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[hsl(var(--pp-fg))] truncate">{row.child_name}</p>
                  <p className="text-xs text-[hsl(var(--pp-brand))] truncate">
                    {row.division_leader_name
                      ? `Division leader: ${row.division_leader_name}`
                      : "Division leader not assigned yet"}
                  </p>
                  {row.latest_preview ? (
                    <p className="pp-text-muted mt-1 text-sm truncate">
                      {messageContentPreview(row.latest_preview, 80)}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  {row.latest_at ? (
                    <p className="text-[10px] pp-text-muted">{formatCampDateTime(row.latest_at)}</p>
                  ) : null}
                  {!disabled ? <ChevronRight className="h-5 w-5 pp-text-muted mt-1 ml-auto" /> : null}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}
