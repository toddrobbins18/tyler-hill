import { useCallback, useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DivisionChannelChatView } from "@/components/messages/DivisionChannelChatView";
import {
  listStaffDivisionChannels,
  markDivisionChannelRead,
  openDivisionChannelRoot,
  type DivisionChannelRow,
} from "@/lib/divisionChannelMessaging";
import { messageContentPreview } from "@/lib/messageContentUtils";
import { formatCampDateTime } from "@/lib/campTime";
import { toast } from "sonner";
import { compareDayCampProgramDivisionsByName } from "@/lib/divisionFilterUtils";

type Props = {
  companyId: string;
  dayCampDivisionSort?: boolean;
  onUnreadTotalChange?: (total: number) => void;
};

export function StaffDivisionChannelsPanel({
  companyId,
  dayCampDivisionSort = false,
  onUnreadTotalChange,
}: Props) {
  const [rows, setRows] = useState<DivisionChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ rootId: string; name: string } | null>(null);
  const [opening, setOpening] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { rows: list, error } = await listStaffDivisionChannels(supabase, companyId);
    if (error) toast.error(error);
    const sorted = dayCampDivisionSort
      ? [...list].sort((a, b) =>
          compareDayCampProgramDivisionsByName(a.division_name, b.division_name),
        )
      : list;
    setRows(sorted);
    const total = list.reduce((n, r) => n + (r.unread_for_staff ?? 0), 0);
    onUnreadTotalChange?.(total);
    setLoading(false);
  }, [companyId, dayCampDivisionSort, onUnreadTotalChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openChannel = async (row: DivisionChannelRow) => {
    setOpening(true);
    let rootId = row.thread_root_id;
    if (!rootId) {
      const created = await openDivisionChannelRoot(supabase, row.division_id);
      if (created.error || !created.rootId) {
        toast.error(created.error ?? "Could not open channel");
        setOpening(false);
        return;
      }
      rootId = created.rootId;
      void refresh();
    }
    setSelected({ rootId, name: row.division_name });
    void markDivisionChannelRead(supabase, rootId).then(() => refresh());
    setOpening(false);
  };

  const listBody = (
    <ScrollArea className="h-[min(700px,calc(100vh-11rem))]">
      {loading ? (
        <p className="p-4 text-sm text-muted-foreground">Loading channels…</p>
      ) : rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No divisions you can access yet.</p>
      ) : (
        rows.map((row) => (
          <div key={row.division_id}>
            <button
              type="button"
              disabled={opening}
              onClick={() => void openChannel(row)}
              className={`w-full px-4 py-3 text-left hover:bg-muted/50 ${
                selected?.rootId === row.thread_root_id ? "bg-muted" : ""
              }`}
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="font-medium leading-snug truncate">{row.division_name}</p>
                  {(row.unread_for_staff ?? 0) > 0 ? (
                    <Badge variant="default" className="h-5 shrink-0 px-1.5 text-[10px]">
                      {row.unread_for_staff} new
                    </Badge>
                  ) : null}
                </div>
                <Badge variant="outline" className="h-5 text-[10px] font-normal">
                  Staff channel
                </Badge>
                <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                  {messageContentPreview(row.latest_preview ?? "", 80)}
                </p>
                {row.latest_at ? (
                  <p className="text-xs text-muted-foreground">
                    {formatCampDateTime(row.latest_at)}
                  </p>
                ) : null}
              </div>
            </button>
            <Separator />
          </div>
        ))
      )}
    </ScrollArea>
  );

  if (selected) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Channels</CardTitle>
            <CardDescription>{rows.length} division(s)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">{listBody}</CardContent>
        </Card>
        <div className="flex h-[min(700px,calc(100vh-11rem))] min-h-[520px] flex-col overflow-hidden">
          <DivisionChannelChatView
            rootId={selected.rootId}
            divisionName={selected.name}
            companyId={companyId}
            onMarkedRead={() => void refresh()}
          />
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Division channels</CardTitle>
        <CardDescription>Staff-only threads per division — no parent access.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">{listBody}</CardContent>
    </Card>
  );
}
