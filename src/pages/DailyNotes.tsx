import { Calendar, MapPin, Users, Pencil, Trash2, Truck, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CSVUploader } from "@/components/CSVUploader";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { usePermissions } from "@/hooks/usePermissions";
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
  const { userRole, canAccessPage } = usePermissions();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [deletingNote, setDeletingNote] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
    checkEditPermission();

    const channel = supabase
      .channel('franko-sheet-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_calendar' }, () => fetchNotes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => fetchNotes())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSeason, userRole]);

  const checkEditPermission = async () => {
    const hasPermission = await canAccessPage('notes');
    setCanEdit(hasPermission && (userRole === 'admin' || userRole === 'staff'));
  };

  const fetchNotes = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from("sports_calendar")
      .select(`
        *,
        trips!sports_event_id(driver, chaperone, status),
        divisions(name, gender),
        sports_calendar_divisions(division_id, divisions(name, gender))
      `)
      .eq("event_date", today)
      .or(`season.eq.${currentSeason},season.is.null`)
      .order("time", { ascending: true });

    if (!error && data) {
      setNotes(data);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("sports_calendar")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete event");
      console.error(error);
    } else {
      toast.success("Event deleted successfully");
      fetchNotes();
    }
    setDeletingNote(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Franko Sheet</h1>
          <p className="text-muted-foreground">Today's sports game logistics and transportation schedule</p>
        </div>
        {canEdit && (
          <CSVUploader tableName="sports_calendar" onUploadComplete={fetchNotes} />
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : notes.length > 0 ? (
        <div className="grid gap-4">
          {notes.map((note) => {
            const divisions = note.sports_calendar_divisions?.map((d: any) => d.divisions) || [];
            const hasMeals = note.meal_options && note.meal_options.length > 0;
            const tripInfo = Array.isArray(note.trips) ? note.trips[0] : note.trips;
            
            return (
              <Card key={note.id} className="shadow-card hover:shadow-md transition-all group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <CardTitle className="text-xl">{note.title}</CardTitle>
                        <Badge variant="outline" className="bg-secondary/10 text-secondary-foreground">
                          {note.sport_type}
                        </Badge>
                        {note.home_away && (
                          <Badge 
                            variant="outline" 
                            className={note.home_away === 'home' 
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20' 
                              : 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20'}
                          >
                            {note.home_away.toUpperCase()}
                          </Badge>
                        )}
                        {divisions.length > 0 && divisions.map((div: any, idx: number) => (
                          <Badge key={idx} variant="secondary">
                            {div.name}
                          </Badge>
                        ))}
                      </div>
                      
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-lg">{note.time || "Time TBD"}</span>
                        </div>
                        
                        {note.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{note.location}</span>
                          </div>
                        )}
                        
                        {note.opponent && (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span><span className="font-medium">vs</span> {note.opponent}</span>
                          </div>
                        )}
                        
                        {tripInfo?.driver && (
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span><span className="font-medium">Driver:</span> {tripInfo.driver}</span>
                            {tripInfo.chaperone && (
                              <span className="text-muted-foreground">
                                | Chaperone: {tripInfo.chaperone}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {hasMeals && (
                          <div className="flex items-start gap-2">
                            <Utensils className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20 mb-1">
                                Food Needed
                              </Badge>
                              {note.meal_options && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {note.meal_options.join(', ')}
                                </p>
                              )}
                              {note.meal_notes && (
                                <p className="text-xs text-muted-foreground mt-1">{note.meal_notes}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                          onClick={() => setDeletingNote(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No games scheduled for today</p>
        </div>
      )}

      <AlertDialog open={!!deletingNote} onOpenChange={(open) => !open && setDeletingNote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the sports event from the calendar.
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
