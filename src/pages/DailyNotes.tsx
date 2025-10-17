import { Plus, Calendar, User, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AddNoteDialog from "@/components/dialogs/AddNoteDialog";
import EditNoteDialog from "@/components/dialogs/EditNoteDialog";
import { CSVUploader } from "@/components/CSVUploader";
import { useSeasonContext } from "@/contexts/SeasonContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DailyNotes() {
  const { currentSeason } = useSeasonContext();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [deletingNote, setDeletingNote] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();

    const channel = supabase
      .channel('notes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_notes' },
        () => fetchNotes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSeason]);

  const fetchNotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_notes")
      .select(`
        *,
        children:child_id (
          name
        ),
        profiles:created_by (
          full_name
        )
      `)
      .or(`season.eq.${currentSeason},season.is.null`)
      .order("date", { ascending: false });

    if (!error && data) {
      setNotes(data);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("daily_notes")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete note");
      console.error(error);
    } else {
      toast.success("Note deleted successfully");
      fetchNotes();
    }
    setDeletingNote(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Daily Notes</h1>
          <p className="text-muted-foreground">Share updates and important information with your team</p>
        </div>
        <div className="flex gap-2">
          <CSVUploader tableName="daily_notes" onUploadComplete={fetchNotes} />
          <AddNoteDialog onSuccess={fetchNotes} />
        </div>
      </div>

{loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : notes.length > 0 ? (
        <div className="grid gap-4">
          {notes.map((note) => (
            <Card key={note.id} className="shadow-card hover:shadow-md transition-all group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{note.children?.name || "Unknown Child"}</CardTitle>
                      {note.mood && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          {note.mood}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      {note.activities && (
                        <p><span className="font-medium">Activities:</span> {note.activities}</p>
                      )}
                      {note.meals && (
                        <p><span className="font-medium">Meals:</span> {note.meals}</p>
                      )}
                      {note.nap && (
                        <p><span className="font-medium">Nap:</span> {note.nap}</p>
                      )}
                      {note.notes && (
                        <p><span className="font-medium">Notes:</span> {note.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setEditingNote(note.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                      onClick={() => setDeletingNote(note.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{note.profiles?.full_name || "Unknown"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(note.date).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No notes found. Add your first daily note!</p>
        </div>
      )}

      {editingNote && (
        <EditNoteDialog
          noteId={editingNote}
          open={!!editingNote}
          onOpenChange={(open) => !open && setEditingNote(null)}
          onSuccess={fetchNotes}
        />
      )}

      <AlertDialog open={!!deletingNote} onOpenChange={(open) => !open && setDeletingNote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the daily note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingNote && handleDelete(deletingNote)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
