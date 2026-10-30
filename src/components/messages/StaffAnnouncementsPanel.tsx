import { useCallback, useEffect, useRef, useState } from "react";
import { Megaphone, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useSeason } from "@/contexts/SeasonContext";
import {
  listStaffParentPortalAnnouncements,
  publishParentPortalAnnouncement,
  type ParentPortalAnnouncement,
} from "@/lib/parentPortalAnnouncements";
import { formatCampDateTime } from "@/lib/campTime";
import { toast } from "sonner";

type Props = {
  companyId: string;
};

export function StaffAnnouncementsPanel({ companyId }: Props) {
  const { currentSeason } = useSeason();
  const season = currentSeason ?? new Date().getFullYear().toString();
  const [rows, setRows] = useState<ParentPortalAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("Camp announcement");
  const [body, setBody] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { rows: list, error } = await listStaffParentPortalAnnouncements(
      supabase,
      companyId,
      season,
    );
    if (error) toast.error(error);
    setRows(list);
    setLoading(false);
  }, [companyId, season]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const publish = async () => {
    const text = body.trim();
    if ((!text && !imageFile) || publishing) return;
    setPublishing(true);
    const { error } = await publishParentPortalAnnouncement(
      supabase,
      companyId,
      season,
      title.trim() || "Camp announcement",
      text,
      { imageFile },
    );
    setPublishing(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Announcement sent to parent portal home");
    setBody("");
    setImageFile(null);
    void refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(320px,1fr)_minmax(300px,420px)]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Publish to families
          </CardTitle>
          <CardDescription>
            Appears on the parent portal home tab for season {season}. Not a private DM — camp-wide
            bulletin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            maxLength={120}
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your announcement…"
            rows={8}
            className="min-h-[160px] resize-y"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              {imageFile ? "Change photo" : "Add photo"}
            </Button>
            {imageFile ? (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{imageFile.name}</span>
            ) : null}
            {imageFile ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setImageFile(null)}>
                Remove
              </Button>
            ) : null}
          </div>
          <Button
            type="button"
            disabled={publishing || (!body.trim() && !imageFile)}
            onClick={() => void publish()}
          >
            <Send className="h-4 w-4 mr-2" />
            {publishing ? "Publishing…" : "Publish to parent portal"}
          </Button>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent ({season})</CardTitle>
          <CardDescription>{rows.length} post(s)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[min(520px,calc(100vh-14rem))]">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No announcements yet this season.</p>
            ) : (
              rows.map((row) => (
                <div key={row.id}>
                  <div className="px-4 py-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-snug">{row.title}</p>
                      {row.is_published ? (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          Live
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                      {row.body}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCampDateTime(row.published_at)}
                    </p>
                  </div>
                  <Separator />
                </div>
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
