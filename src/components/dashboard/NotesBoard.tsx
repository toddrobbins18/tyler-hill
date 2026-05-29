import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Check, X, StickyNote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { cn } from "@/lib/utils";

interface NotesBoardProps {
  className?: string;
  compact?: boolean;
}

export default function NotesBoard({ className, compact = false }: NotesBoardProps) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [content, setContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [noteId, setNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchNote();
    }
  }, [currentCompany?.id, currentSeason]);

  const fetchNote = async () => {
    if (!currentCompany?.id) return;
    
    const { data, error } = await supabase
      .from("kanban_notes")
      .select("*")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .eq("column_status", "todo")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching note:", error);
    } else if (data) {
      setContent(data.content || data.title || "");
      setNoteId(data.id);
    }
    setLoading(false);
  };

  const handleEdit = () => {
    setEditContent(content);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent("");
  };

  const handleSave = async () => {
    if (!currentCompany?.id) return;

    const { data: { user } } = await supabase.auth.getUser();

    if (noteId) {
      // Update existing note
      const { error } = await supabase
        .from("kanban_notes")
        .update({ content: editContent, title: "Dashboard Notes" })
        .eq("id", noteId);

      if (error) {
        toast.error("Failed to save notes");
        console.error(error);
        return;
      }
    } else {
      // Create new note
      const { data, error } = await supabase
        .from("kanban_notes")
        .insert({
          title: "Dashboard Notes",
          content: editContent,
          column_status: "todo",
          company_id: currentCompany.id,
          season: currentSeason,
          created_by: user?.id,
          sort_order: 0,
        })
        .select()
        .single();

      if (error) {
        toast.error("Failed to save notes");
        console.error(error);
        return;
      }
      setNoteId(data.id);
    }

    setContent(editContent);
    setIsEditing(false);
    toast.success("Notes saved");
  };

  if (loading) {
    return (
      <Card className={cn("shadow-card", className)}>
        <CardHeader className={compact ? "p-4 pb-2" : "pb-3"}>
          <CardTitle className={cn("flex items-center gap-2", compact && "text-base font-semibold")}>
            <StickyNote className="h-4 w-4" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? "px-4 pb-4 pt-0" : undefined}>
          <div className="py-2 text-center text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-card", className)}>
      <CardHeader className={compact ? "flex flex-row items-center justify-between space-y-0 p-4 pb-2" : "pb-3"}>
        <CardTitle className={cn("flex items-center justify-between", compact && "text-base font-semibold")}>
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            <span>Notes</span>
          </div>
          {!isEditing && !compact && (
            <Button size="sm" variant="ghost" onClick={handleEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
        {!isEditing && compact && (
          <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={handleEdit}>
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className={compact ? "px-4 pb-4 pt-0" : undefined}>
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Add your notes here..."
              className="min-h-[120px] text-foreground"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Check className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "cursor-pointer whitespace-pre-wrap rounded-md text-foreground transition-colors hover:bg-muted/50",
              compact ? "p-1 text-sm" : "min-h-[80px] p-2 -m-2",
            )}
            onClick={handleEdit}
          >
            {content || <span className="text-muted-foreground italic">Click to add notes...</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
