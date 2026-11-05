import { useCallback, useEffect, useMemo, useState } from "react";
import { Bus, ImageIcon, MessageCircle, MessageSquare, Search, Users } from "lucide-react";
import { ParentPortalMediaGallery } from "./ParentPortalMediaGallery";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import InlineThread from "@/components/messages/InlineThread";
import { AudienceMessageThread } from "@/components/messages/AudienceMessageThread";
import { camperInitials } from "@/lib/parentPortalConstants";
import { formatParentMessageListDate } from "@/lib/campTime";
import {
  fetchMessageRootById,
  listParentPortalThreads,
  openParentDivisionLeaderThread,
  parentPortalThreadListSubtitle,
  parentPortalThreadListTitle,
  type ParentPortalThreadRow,
} from "@/lib/parentPortalMessaging";
import { messageContentPreview } from "@/lib/messageContentUtils";
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

type SectionTab = "chats" | "groups" | "buses" | "photos";

type CampNote = {
  id: string;
  title: string;
  body: string;
  published_at: string;
  audience_kind: string | null;
  audience_label: string | null;
};

const TABS: { id: SectionTab; label: string; icon: typeof MessageSquare }[] = [
  { id: "chats", label: "Chats", icon: MessageSquare },
  { id: "groups", label: "Groups", icon: Users },
  { id: "buses", label: "Buses", icon: Bus },
  { id: "photos", label: "Photos", icon: ImageIcon },
];

function ChatAvatar({ name, dimmed }: { name: string; dimmed?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
        dimmed
          ? "bg-[hsl(var(--pp-brand))]/10 text-[hsl(var(--pp-text-muted))]"
          : "bg-[hsl(var(--pp-brand))] text-white",
      )}
    >
      {camperInitials(name)}
    </div>
  );
}

function ConversationRow({
  title,
  subtitle,
  preview,
  time,
  active,
  disabled,
  onClick,
}: {
  title: string;
  subtitle?: string;
  preview: string;
  time?: string | null;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
        disabled ? "cursor-not-allowed opacity-45" : "hover:bg-[hsl(var(--pp-brand-subtle))]",
        active && "bg-[hsl(var(--pp-brand-subtle))]",
      )}
    >
      <ChatAvatar name={title} dimmed={disabled} />
      <div className="min-w-0 flex-1 border-b border-[hsl(var(--pp-border))] pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[15px] font-semibold text-[hsl(var(--pp-fg))]">{title}</p>
          {time ? (
            <span className="shrink-0 text-[11px] tabular-nums text-[hsl(var(--pp-text-muted))]">{time}</span>
          ) : null}
        </div>
        {subtitle ? (
          <p className="truncate text-[12px] font-medium text-[hsl(var(--pp-brand-dark))]">{subtitle}</p>
        ) : null}
        <p className="mt-0.5 truncate text-[13px] text-[hsl(var(--pp-text-muted))]">{preview}</p>
      </div>
    </button>
  );
}

export function ParentMessagesView({ companyId, companySlug }: Props) {
  const [sectionTab, setSectionTab] = useState<SectionTab>("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<ParentPortalThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [campNotes, setCampNotes] = useState<CampNote[]>([]);
  const [openNote, setOpenNote] = useState<CampNote | null>(null);
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
    const notes = await supabase
      .from("parent_portal_announcements")
      .select("id, title, body, published_at, audience_kind, audience_label")
      .eq("company_id", companyId)
      .eq("is_published", true)
      .in("audience_kind", ["group", "bus"])
      .order("published_at", { ascending: false })
      .limit(20);
    setCampNotes((notes.data ?? []) as CampNote[]);
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

  const audienceNotes = useMemo(() => {
    const kind = sectionTab === "groups" ? "group" : "bus";
    const notes = campNotes.filter((note) => note.audience_kind === kind);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((note) =>
      [note.audience_label, note.title, note.body].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [campNotes, searchQuery, sectionTab]);

  const selectedRow = rows.find((r) => r.child_id === selectedChildId) ?? null;
  const chatOpen = Boolean(selectedChildId && threadRoot);
  const noteOpen = Boolean(openNote);
  const threadVisible = chatOpen || noteOpen;

  const openThreadByRootId = async (threadRootId: string, childId: string | null) => {
    const row = rows.find((r) => r.child_id === childId);
    setOpening(true);
    setOpenNote(null);
    setSelectedChildId(childId);
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
    setOpenNote(null);
    setSelectedChildId(row.child_id);
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
    setOpenNote(null);
    void refreshList();
  };

  const switchTab = (tab: SectionTab) => {
    setSectionTab(tab);
    setSearchQuery("");
    if (tab !== "chats") {
      setSelectedChildId(null);
      setThreadRoot(null);
    }
    if (tab !== "groups" && tab !== "buses") setOpenNote(null);
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[hsl(var(--pp-bg-elevated))]">
      <section
        className={cn(
          "flex min-h-0 w-full flex-col border-[hsl(var(--pp-border))] bg-[hsl(var(--pp-bg-elevated))] lg:w-[22.5rem] lg:shrink-0 lg:border-r xl:w-[26rem]",
          threadVisible && "hidden lg:flex",
          sectionTab === "photos" && "lg:w-full lg:border-r-0",
        )}
      >
        <div className="hidden shrink-0 px-5 pb-1 pt-5 lg:block">
          <h1 className="text-[1.65rem] font-bold tracking-tight text-[hsl(var(--pp-fg))]">Messages</h1>
        </div>

        <div className="flex shrink-0 gap-1 px-3 pb-2 pt-2 lg:pt-3">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = sectionTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-[hsl(var(--pp-brand))] text-white"
                    : "text-[hsl(var(--pp-text-muted))] hover:bg-[hsl(var(--pp-brand-subtle))] hover:text-[hsl(var(--pp-fg))]",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {sectionTab !== "photos" ? (
          <div className="shrink-0 px-3 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--pp-text-muted))]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="h-10 rounded-full border-0 bg-[hsl(var(--pp-bg))] pl-10 text-[hsl(var(--pp-fg))] placeholder:text-[hsl(var(--pp-text-muted))]"
              />
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-4 py-10 text-center text-sm text-[hsl(var(--pp-text-muted))]">Loading messages…</p>
          ) : sectionTab === "photos" ? (
            <div className="p-4">
              <ParentPortalMediaGallery
                companyId={companyId}
                currentUserId={currentUserId}
                onOpenThread={(rootId, childId) => void openThreadByRootId(rootId, childId)}
              />
            </div>
          ) : sectionTab === "chats" ? (
            filteredRows.length === 0 ? (
              <div className="flex flex-col items-center px-8 py-16 text-center">
                <MessageCircle className="mb-3 h-10 w-10 text-[hsl(var(--pp-brand))]/40" />
                <p className="text-sm text-[hsl(var(--pp-text-muted))]">
                  {rows.length === 0
                    ? "Link your campers to message their division leader."
                    : "No conversations match your search."}
                </p>
              </div>
            ) : (
              filteredRows.map((row) => {
                const title = parentPortalThreadListTitle(row);
                const preview = row.latest_preview
                  ? messageContentPreview(row.latest_preview, 80)
                  : "No messages yet";
                return (
                  <ConversationRow
                    key={row.child_id}
                    title={title}
                    subtitle={parentPortalThreadListSubtitle(row)}
                    preview={preview}
                    time={row.latest_at ? formatParentMessageListDate(row.latest_at) : null}
                    active={selectedChildId === row.child_id}
                    disabled={!row.division_leader_user_id}
                    onClick={() => void openThread(row)}
                  />
                );
              })
            )
          ) : audienceNotes.length === 0 ? (
            <div className="flex flex-col items-center px-8 py-16 text-center">
              <MessageCircle className="mb-3 h-10 w-10 text-[hsl(var(--pp-brand))]/40" />
              <p className="text-sm text-[hsl(var(--pp-text-muted))]">
                {sectionTab === "groups" ? "No group messages yet." : "No bus messages yet."}
              </p>
            </div>
          ) : (
            audienceNotes.map((note) => (
              <ConversationRow
                key={note.id}
                title={note.audience_label || note.title}
                subtitle={note.title}
                preview={note.body}
                time={note.published_at ? formatParentMessageListDate(note.published_at) : null}
                active={openNote?.id === note.id}
                onClick={() => {
                  setSelectedChildId(null);
                  setThreadRoot(null);
                  setOpenNote(note);
                }}
              />
            ))
          )}
        </div>
      </section>

      {sectionTab !== "photos" ? (
        <section
          className={cn(
            "min-h-0 flex-1 flex-col bg-[#e8eef5]",
            threadVisible ? "flex" : "hidden lg:flex",
          )}
        >
          {opening ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[hsl(var(--pp-text-muted))]">
              Opening conversation…
            </div>
          ) : chatOpen && threadRoot && selectedRow ? (
            <InlineThread
              message={threadRoot}
              viewMode="sent"
              campCompanyId={companyId}
              campCompanySlug={companySlug}
              bubbleStyle="parentGlass"
              threadHeaderTitle={parentPortalThreadListTitle(selectedRow)}
              threadHeaderSubtitle={parentPortalThreadListSubtitle(selectedRow)}
              onClose={handleBack}
            />
          ) : noteOpen && openNote ? (
            <AudienceMessageThread note={openNote} onBack={handleBack} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--pp-brand))]/10">
                <MessageCircle className="h-8 w-8 text-[hsl(var(--pp-brand))]" />
              </div>
              <p className="text-base font-semibold text-[hsl(var(--pp-fg))]">Select a chat</p>
              <p className="max-w-xs text-sm text-[hsl(var(--pp-text-muted))]">
                Pick a conversation from the left to start messaging.
              </p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
