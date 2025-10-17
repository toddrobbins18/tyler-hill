import { Award, Trophy, Star, Calendar, User, Pencil, Trash2, Upload, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AddAwardDialog from "@/components/dialogs/AddAwardDialog";
import EditAwardDialog from "@/components/dialogs/EditAwardDialog";
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

export default function Awards() {
  const navigate = useNavigate();
  const { currentSeason } = useSeasonContext();
  const [awards, setAwards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAward, setEditingAward] = useState<string | null>(null);
  const [deletingAward, setDeletingAward] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  useEffect(() => {
    fetchAwards();

    const channel = supabase
      .channel('awards-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'awards' },
        () => fetchAwards()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSeason]);

  const fetchAwards = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("awards")
      .select(`
        *,
        children:child_id (
          id,
          name
        )
      `)
      .eq("season", currentSeason)
      .order("date", { ascending: false });

    if (!error && data) {
      setAwards(data);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("awards")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete award");
      console.error(error);
    } else {
      toast.success("Award deleted successfully");
      fetchAwards();
    }
    setDeletingAward(null);
  };

  const groupedAwards = awards.reduce((acc, award) => {
    const childId = award.children?.id;
    const childName = award.children?.name || "Unknown Child";
    
    if (!acc[childId]) {
      acc[childId] = {
        childId,
        childName,
        achievements: [] as any[],
      };
    }
    
    acc[childId].achievements.push(award);
    return acc;
  }, {} as Record<string, { childId: string; childName: string; achievements: any[] }>);

  const allAchievements = Object.values(groupedAwards) as Array<{ childId: string; childName: string; achievements: any[] }>;
  const totalAchievements = awards.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Awards & Achievements</h1>
          <p className="text-muted-foreground">Celebrating success across all children</p>
        </div>
        <div className="flex gap-2">
          <CSVUploader tableName="awards" onUploadComplete={fetchAwards} />
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Award
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardDescription>Total Achievements</CardDescription>
            <CardTitle className="text-3xl">{totalAchievements}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardDescription>Children with Awards</CardDescription>
            <CardTitle className="text-3xl">{allAchievements.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardDescription>This Month</CardDescription>
            <CardTitle className="text-3xl">{allAchievements.filter(c => c.achievements.some(a => a.date.includes("Oct") || a.date.includes("Nov"))).length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

{loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : allAchievements.length > 0 ? (
        <div className="space-y-6">
          {allAchievements.map((child) => (
            <Card key={child.childId} className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{child.childName}</CardTitle>
                      <CardDescription>{child.achievements.length} achievements</CardDescription>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/child/${child.childId}`)}
                  >
                    View Profile
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {child.achievements.map((achievement: any) => (
                  <div key={achievement.id} className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Award className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold mb-1">{achievement.title}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{achievement.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(achievement.date).toLocaleDateString()}</span>
                        {achievement.category && (
                          <>
                            <span>•</span>
                            <span>{achievement.category}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setEditingAward(achievement.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                        onClick={() => setDeletingAward(achievement.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No awards found. Add your first achievement!</p>
        </div>
      )}

      <AddAwardDialog 
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={fetchAwards} 
      />

      {editingAward && (
        <EditAwardDialog
          awardId={editingAward}
          open={!!editingAward}
          onOpenChange={(open) => !open && setEditingAward(null)}
          onSuccess={fetchAwards}
        />
      )}

      <AlertDialog open={!!deletingAward} onOpenChange={(open) => !open && setDeletingAward(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the award.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingAward && handleDelete(deletingAward)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
