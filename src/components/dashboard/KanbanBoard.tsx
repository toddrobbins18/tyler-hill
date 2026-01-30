import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, GripVertical, Pencil, Trash2, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { cn } from "@/lib/utils";

interface KanbanNote {
  id: string;
  column_status: 'todo' | 'in_progress' | 'done';
  title: string;
  content: string | null;
  sort_order: number;
}

type ColumnStatus = 'todo' | 'in_progress' | 'done';

const COLUMNS: { id: ColumnStatus; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];

interface KanbanBoardProps {
  className?: string;
}

export default function KanbanBoard({ className }: KanbanBoardProps) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [notes, setNotes] = useState<KanbanNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<KanbanNote | null>(null);
  const [newNote, setNewNote] = useState({ title: '', content: '', column_status: 'todo' as ColumnStatus });
  const [draggedNote, setDraggedNote] = useState<KanbanNote | null>(null);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchNotes();
    }
  }, [currentCompany?.id, currentSeason]);

  const fetchNotes = async () => {
    if (!currentCompany?.id) return;
    
    const { data, error } = await supabase
      .from("kanban_notes")
      .select("*")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .order("sort_order");

    if (error) {
      console.error("Error fetching notes:", error);
      setNotes([]);
    } else if (data) {
      const typedNotes: KanbanNote[] = data.map(note => ({
        id: note.id,
        column_status: note.column_status as ColumnStatus,
        title: note.title,
        content: note.content,
        sort_order: note.sort_order
      }));
      setNotes(typedNotes);
    }
    setLoading(false);
  };

  const handleAddNote = async () => {
    if (!newNote.title.trim() || !currentCompany?.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    const maxSortOrder = notes
      .filter(n => n.column_status === newNote.column_status)
      .reduce((max, n) => Math.max(max, n.sort_order), -1);

    const { error } = await supabase
      .from("kanban_notes")
      .insert({
        title: newNote.title,
        content: newNote.content || null,
        column_status: newNote.column_status,
        company_id: currentCompany.id,
        season: currentSeason,
        created_by: user?.id,
        sort_order: maxSortOrder + 1,
      });

    if (error) {
      toast.error("Failed to add note");
      console.error(error);
    } else {
      toast.success("Note added");
      setNewNote({ title: '', content: '', column_status: 'todo' });
      setAddDialogOpen(false);
      fetchNotes();
    }
  };

  const handleUpdateNote = async () => {
    if (!editingNote || !editingNote.title.trim()) return;

    const { error } = await supabase
      .from("kanban_notes")
      .update({
        title: editingNote.title,
        content: editingNote.content,
      })
      .eq("id", editingNote.id);

    if (error) {
      toast.error("Failed to update note");
      console.error(error);
    } else {
      toast.success("Note updated");
      setEditingNote(null);
      fetchNotes();
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const { error } = await supabase
      .from("kanban_notes")
      .delete()
      .eq("id", noteId);

    if (error) {
      toast.error("Failed to delete note");
      console.error(error);
    } else {
      toast.success("Note deleted");
      fetchNotes();
    }
  };

  const handleDragStart = (e: React.DragEvent, note: KanbanNote) => {
    setDraggedNote(note);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: ColumnStatus) => {
    e.preventDefault();
    if (!draggedNote || draggedNote.column_status === targetColumn) {
      setDraggedNote(null);
      return;
    }

    const maxSortOrder = notes
      .filter(n => n.column_status === targetColumn)
      .reduce((max, n) => Math.max(max, n.sort_order), -1);

    const { error } = await supabase
      .from("kanban_notes")
      .update({
        column_status: targetColumn,
        sort_order: maxSortOrder + 1,
      })
      .eq("id", draggedNote.id);

    if (error) {
      toast.error("Failed to move note");
      console.error(error);
    } else {
      fetchNotes();
    }
    setDraggedNote(null);
  };

  const getColumnNotes = (columnId: ColumnStatus) => {
    return notes.filter(n => n.column_status === columnId);
  };

  if (loading) {
    return (
      <Card className={cn("shadow-card", className)}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Notes Board</span>
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
          <span>Notes Board</span>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Note
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Note</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Input
                    placeholder="Note title"
                    value={newNote.title}
                    onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  />
                </div>
                <div>
                  <Textarea
                    placeholder="Note content (optional)"
                    value={newNote.content}
                    onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  {COLUMNS.map((col) => (
                    <Button
                      key={col.id}
                      size="sm"
                      variant={newNote.column_status === col.id ? "default" : "outline"}
                      onClick={() => setNewNote({ ...newNote, column_status: col.id })}
                    >
                      {col.title}
                    </Button>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddNote} disabled={!newNote.title.trim()}>
                    Add Note
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {COLUMNS.map((column) => (
            <div
              key={column.id}
              className="bg-muted/50 rounded-lg p-2 min-h-[200px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              <h4 className="font-semibold text-sm text-foreground/80 mb-2 px-1">
                {column.title} ({getColumnNotes(column.id).length})
              </h4>
              <div className="space-y-2">
                {getColumnNotes(column.id).map((note) => (
                  <div
                    key={note.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, note)}
                    className={cn(
                      "bg-card border rounded-md p-2 cursor-grab active:cursor-grabbing shadow-sm hover:shadow transition-shadow",
                      draggedNote?.id === note.id && "opacity-50"
                    )}
                  >
                    {editingNote?.id === note.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editingNote.title}
                          onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                          className="h-7 text-sm"
                        />
                        <Textarea
                          value={editingNote.content || ''}
                          onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                          className="text-sm min-h-[60px]"
                        />
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingNote(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleUpdateNote}>
                            <Check className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-1">
                          <GripVertical className="h-4 w-4 text-foreground/60 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate text-foreground">{note.title}</p>
                            {note.content && (
                              <p className="text-xs text-foreground/70 mt-1 line-clamp-2">{note.content}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 justify-end mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => setEditingNote(note)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteNote(note.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
