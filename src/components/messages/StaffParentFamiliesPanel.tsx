import { useCallback, useEffect, useState } from "react";
import { Users, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import InlineThread from "@/components/messages/InlineThread";
import {
  fetchMessageRootById,
  listStaffParentPortalInbox,
  type StaffParentPortalThreadRow,
} from "@/lib/parentPortalMessaging";
import { messageContentPreview } from "@/lib/messageContentUtils";
import { formatCampDateTime } from "@/lib/campTime";
import { toast } from "sonner";

type Props = {
  companyId: string;
  companySlug?: string | null;
};

export function StaffParentFamiliesPanel({ companyId, companySlug }: Props) {
  const [rows, setRows] = useState<StaffParentPortalThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRootId, setSelectedRootId] = useState<string | null>(null);
  const [threadRoot, setThreadRoot] = useState<any>(null);
  const [opening, setOpening] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { rows: list, error } = await listStaffParentPortalInbox(supabase, companyId);
    if (error) toast.error(error);
    setRows(list);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openThread = async (row: StaffParentPortalThreadRow) => {
    setOpening(true);
    setSelectedRootId(row.thread_root_id);
    const { message, error } = await fetchMessageRootById(supabase, row.thread_root_id);
    if (error || !message) {
      toast.error(error ?? "Thread not found");
      setOpening(false);
      return;
    }
    setThreadRoot({
      ...message,
      sender_name: row.parent_display_name ?? "Parent",
      recipient_name: row.child_name ? `${row.child_name}'s family` : undefined,
    });
    setOpening(false);
  };

  if (selectedRootId && threadRoot) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Parent families</CardTitle>
            <CardDescription>{rows.length} conversation(s)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[min(700px,calc(100vh-11rem))]">
              {rows.map((row) => (
                <div key={row.thread_root_id}>
                  <button
                    type="button"
                    onClick={() => void openThread(row)}
                    className={`w-full px-4 py-3 text-left hover:bg-muted/50 ${
                      selectedRootId === row.thread_root_id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <p className="font-medium leading-snug truncate" title={row.parent_display_name ?? "Parent"}>
                        {row.parent_display_name ?? "Parent"}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="h-5 shrink-0 px-1.5 text-[10px] font-normal border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
                        >
                          Parent portal
                        </Badge>
                        {(row.unread_for_staff ?? 0) > 0 ? (
                          <Badge variant="default" className="h-5 shrink-0 px-1.5 text-[10px]">
                            {row.unread_for_staff} new
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs font-medium text-primary truncate">
                        Camper: {row.child_name ?? "—"}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                        {messageContentPreview(row.latest_preview ?? "", 80)}
                      </p>
                    </div>
                  </button>
                  <Separator />
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
        <div className="flex h-[min(700px,calc(100vh-11rem))] min-h-[520px] flex-col overflow-hidden">
          <InlineThread
            message={threadRoot}
            viewMode="inbox"
            campCompanyId={companyId}
            campCompanySlug={companySlug}
          />
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Parent families
        </CardTitle>
        <CardDescription>
          Messages from parents in the family portal — grouped by camper and division leader routing.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground animate-pulse">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No parent portal conversations yet.</p>
        ) : (
          <ScrollArea className="h-[600px]">
            {rows.map((row) => (
              <div key={row.thread_root_id}>
                <button
                  type="button"
                  onClick={() => void openThread(row)}
                  className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="font-medium leading-snug truncate">{row.parent_display_name ?? "Parent"}</p>
                      <Badge
                        variant="outline"
                        className="h-5 shrink-0 px-1.5 text-[10px] font-normal border-emerald-200 bg-emerald-50 text-emerald-900"
                      >
                        Parent portal
                      </Badge>
                      <p className="text-xs font-medium text-primary truncate">
                        Camper: {row.child_name ?? "—"}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                        {messageContentPreview(row.latest_preview ?? "", 100)}
                      </p>
                      {row.latest_at ? (
                        <p className="text-[11px] text-muted-foreground">
                          {formatCampDateTime(row.latest_at)}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                  </div>
                </button>
                <Separator />
              </div>
            ))}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
