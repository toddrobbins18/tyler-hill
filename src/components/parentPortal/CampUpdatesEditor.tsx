import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCampDateTime } from "@/lib/campTime";
import {
  fetchCampUpdateForSeason,
  saveCampUpdateForSeason,
  type ParentPortalCampUpdateDraft,
} from "@/lib/parentPortalCampUpdates";

type CampUpdatesEditorProps = {
  companyId: string;
  season: string;
};

export function CampUpdatesEditor({ companyId, season }: CampUpdatesEditorProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ParentPortalCampUpdateDraft>({
    title: "Camp updates",
    body: "",
    is_published: false,
  });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await fetchCampUpdateForSeason(supabase, companyId, season);
      if (row) {
        setDraft({
          title: row.title,
          body: row.body,
          is_published: row.is_published,
        });
        setUpdatedAt(row.updated_at);
        setPublishedAt(row.published_at);
      } else {
        setDraft({ title: "Camp updates", body: "", is_published: false });
        setUpdatedAt(null);
        setPublishedAt(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load camp update";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [companyId, season]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (draft.is_published && !draft.body.trim()) {
      toast.error("Add a message before publishing to families");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveCampUpdateForSeason(supabase, companyId, season, draft, user?.id);
      setUpdatedAt(saved.updated_at);
      setPublishedAt(saved.published_at);
      toast.success(draft.is_published ? "Camp update published" : "Camp update saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save camp update";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Camp updates</CardTitle>
              <CardDescription>
                Message shown on the parent portal Home tab for season {season}.
              </CardDescription>
            </div>
          </div>
          {draft.is_published ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600">Published</Badge>
          ) : (
            <Badge variant="outline">Draft</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="camp-update-title">Headline</Label>
              <Input
                id="camp-update-title"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Camp updates"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="camp-update-body">Message</Label>
              <Textarea
                id="camp-update-body"
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                placeholder="Don't forget! Friday is Water Day…"
                rows={5}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Show in parent portal</p>
                <p className="text-xs text-muted-foreground">
                  Families see this on their Home tab when published.
                </p>
              </div>
              <Switch
                checked={draft.is_published}
                onCheckedChange={(checked) => setDraft((d) => ({ ...d, is_published: checked }))}
              />
            </div>
            {(updatedAt || publishedAt) && (
              <p className="text-xs text-muted-foreground">
                {publishedAt ? `Published ${formatCampDateTime(publishedAt)}` : "Not published yet"}
                {updatedAt ? ` · Last saved ${formatCampDateTime(updatedAt)}` : null}
              </p>
            )}
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : draft.is_published ? "Save & publish" : "Save draft"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
