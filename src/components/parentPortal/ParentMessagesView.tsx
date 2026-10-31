import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ImageIcon, MessageSquare, Search } from "lucide-react";
import { ParentPortalMediaGallery } from "./ParentPortalMediaGallery";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import InlineThread from "@/components/messages/InlineThread";
import { EmptyState } from "./EmptyState";
import { camperInitials } from "@/lib/parentPortalConstants";
import {
  fetchMessageRootById,
  listParentPortalThreads,
  openParentDivisionLeaderThread,
  parentPortalThreadListTitle,
  type ParentPortalThreadRow,
} from "@/lib/parentPortalMessaging";
import { messageContentPreview } from "@/lib/messageContentUtils";
import { formatParentMessageListDate } from "@/lib/campTime";
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
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.child_name,
        row.division_leader_name,
        row.latest_preview,
        row.group_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, searchQuery]);

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

  const threadHeaderTitle =
    selectedLeaderName && rows.find((r) => r.child_id === selectedChildId)
      ? parentPortalThreadListTitle(rows.find((r) => r.child_id === selectedChildId)!)
      : selectedLeaderName ?? "Messages";

  if (selectedChildId && threadRoot) {
    return (
      <div className="flex min-h-[min(720px,calc(100vh-8rem))] flex-col gap-0 lg:min-h-[680px]">
        <div className="pp-header-bar flex items-center gap-2 rounded-t-2xl border border-b-0 border-[hsl(var(--pp-border))] px-3 py-2.5 lg:hidden">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[hsl(var(--pp-fg))]">
            {threadHeaderTitle}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 hidden rounded-xl -ml-2 lg:inline-flex"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          All conversations
        </Button>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[hsl(var(--pp-border))] bg-[hsl(var(--pp-bg))] shadow-sm lg:rounded-2xl">
          <InlineThread
            message={threadRoot}
            viewMode="sent"
            campCompanyId={companyId}
            campCompanySlug={companySlug}
            bubbleStyle="parentGlass"
            threadHeaderTitle={threadHeaderTitle}
          />
        </div>
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
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="hidden lg:block">
        <h1 className="pp-page-title">Messages</h1>
        <p className="pp-text-muted mt-1 text-sm">
          Chat with your camper&apos;s division leader. Photos and videos appear in your threads and
          in the gallery tab.
        </p>
      </div>

      <div className="flex gap-1 rounded-xl border border-[hsl(var(--pp-border))] bg-[hsl(var(--pp-bg-elevated))] p-1">
        <button
          type="button"
          onClick={() => setSectionTab("chats")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors",
            sectionTab === "chats"
              ? "bg-[hsl(var(--pp-brand))] text-white shadow-sm"
              : "text-[hsl(var(--pp-text-muted))] hover:text-[hsl(var(--pp-fg))]",
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Chats
        </button>
        <button
          type="button"
          onClick={() => setSectionTab("photos")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors",
            sectionTab === "photos"
              ? "bg-[hsl(var(--pp-brand))] text-white shadow-sm"
              : "text-[hsl(var(--pp-text-muted))] hover:text-[hsl(var(--pp-fg))]",
          )}
        >
          <ImageIcon className="h-4 w-4" />
          Photos
        </button>
      </div>

      {sectionTab === "photos" ? (
        <ParentPortalMediaGallery
          companyId={companyId}
          currentUserId={currentUserId}
          onOpenThread={(rootId, childId) => void openThreadByRootId(rootId, childId)}
        />
      ) : null}

      {sectionTab === "chats" ? (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pp-text-muted))]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="h-11 rounded-xl border-[hsl(var(--pp-border))] bg-[hsl(var(--pp-bg-elevated))] pl-10 text-[hsl(var(--pp-fg))] placeholder:text-[hsl(var(--pp-text-muted))]"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-[hsl(var(--pp-border))] bg-[hsl(var(--pp-bg-elevated))]">
            {filteredRows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm pp-text-muted">No conversations match your search.</p>
            ) : (
              filteredRows.map((row, index) => {
                const disabled = !row.division_leader_user_id;
                const preview = row.latest_preview
                  ? messageContentPreview(row.latest_preview, 100)
                  : row.division_leader_name
                    ? "Tap to message your division leader"
                    : "Division leader not assigned yet";
                return (
                  <button
                    key={row.child_id}
                    type="button"
                    disabled={disabled}
                    onClick={() => void openThread(row)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
                      index > 0 && "border-t border-[hsl(var(--pp-border))]",
                      disabled ? "cursor-not-allowed opacity-45" : "hover:bg-[hsl(var(--pp-brand-subtle))]",
                    )}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--pp-brand))]/15 text-sm font-semibold text-[hsl(var(--pp-brand-dark))]">
                      {camperInitials(row.child_name)}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-semibold text-[hsl(var(--pp-fg))]">
                          {parentPortalThreadListTitle(row)}
                        </p>
                        {row.latest_at ? (
                          <span className="shrink-0 text-xs tabular-nums pp-text-muted">
                            {formatParentMessageListDate(row.latest_at)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-snug pp-text-muted">{preview}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
