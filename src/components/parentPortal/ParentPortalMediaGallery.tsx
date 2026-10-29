import { useCallback, useEffect, useState } from "react";
import { ImageIcon, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "./EmptyState";
import { listParentPortalMedia, type ParentPortalMediaRow } from "@/lib/parentPortalMessaging";
import { MessageContent } from "@/components/messages/MessageContent";
import { formatCampDateTime } from "@/lib/campTime";
import { cn } from "@/lib/utils";

type Props = {
  companyId: string;
  currentUserId: string | null;
  onOpenThread?: (threadRootId: string, childId: string | null) => void;
};

export function ParentPortalMediaGallery({ companyId, currentUserId, onOpenThread }: Props) {
  const [rows, setRows] = useState<ParentPortalMediaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { rows: media, error } = await listParentPortalMedia(supabase, companyId);
    if (error) console.warn("[ParentPortalMediaGallery]", error);
    setRows(media);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center pp-text-muted text-sm animate-pulse">
        Loading photos &amp; videos…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ImageIcon}
        title="No photos or videos yet"
        description="When your division leader shares images or clips in your message thread, they will appear here."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const isMe = currentUserId != null && row.sender_id === currentUserId;
        return (
          <button
            key={row.message_id}
            type="button"
            className={cn(
              "pp-card text-left overflow-hidden rounded-2xl border border-[hsl(var(--pp-border))] transition-shadow hover:shadow-md",
            )}
            onClick={() => onOpenThread?.(row.thread_root_id, row.child_id)}
          >
            <div className="p-3 border-b border-[hsl(var(--pp-border))] bg-[hsl(var(--pp-brand-subtle))]/40">
              <p className="text-xs font-semibold text-[hsl(var(--pp-brand))] truncate">
                {row.child_name ?? "Camper"}
              </p>
              <p className="text-[10px] pp-text-muted mt-0.5">
                {formatCampDateTime(row.created_at)}
                {isMe ? " · You" : " · Camp"}
              </p>
            </div>
            <div className="p-3 min-h-[120px]">
              <MessageContent
                content={row.content ?? ""}
                messageKind={row.message_kind}
                mediaStoragePath={row.media_storage_path}
                mediaMime={row.media_mime}
                mediaFileName={row.media_file_name}
                senderId={row.sender_id}
                className="text-sm"
              />
            </div>
            {row.message_kind === "video" ? (
              <div className="flex items-center gap-1 px-3 pb-2 text-[10px] pp-text-muted">
                <Film className="h-3 w-3" />
                Video
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
