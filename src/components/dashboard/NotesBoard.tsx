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
}

export default function NotesBoard({ className }: NotesBoardProps) {
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
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-card", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            <span>Notes</span>
          </div>
          {!isEditing && (
            <Button size="sm" variant="ghost" onClick={handleEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
            className="min-h-[80px] text-foreground whitespace-pre-wrap cursor-pointer hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors"
            onClick={handleEdit}
          >
            {content || <span className="text-muted-foreground italic">Click to add notes...</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
