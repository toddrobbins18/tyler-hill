import { Award, Trophy, Star, Calendar, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Awards() {
  const navigate = useNavigate();

  // Mock data - would come from database with children and their achievements
  const allAchievements = [
    {
      childId: 1,
      childName: "Emma Thompson",
      achievements: [
        { id: 1, title: "Perfect Attendance", description: "September 2024", date: "Sep 30, 2024", icon: Award },
        { id: 2, title: "Science Fair Winner", description: "1st Place - Volcano Project", date: "Oct 15, 2024", icon: Trophy },
        { id: 3, title: "Reading Challenge", description: "Read 20 books this month", date: "Oct 31, 2024", icon: Star },
      ]
    },
    {
      childId: 2,
      childName: "Noah Martinez",
      achievements: [
        { id: 4, title: "Math Excellence", description: "Top scorer in class", date: "Oct 20, 2024", icon: Trophy },
        { id: 5, title: "Team Player", description: "Outstanding collaboration", date: "Oct 25, 2024", icon: Award },
      ]
    },
    {
      childId: 3,
      childName: "Olivia Chen",
      achievements: [
        { id: 6, title: "Art Contest Winner", description: "First place in school art show", date: "Nov 1, 2024", icon: Star },
        { id: 7, title: "Leadership Award", description: "Class representative", date: "Nov 5, 2024", icon: Trophy },
      ]
    }
  ];

  const totalAchievements = allAchievements.reduce((sum, child) => sum + child.achievements.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Awards & Achievements</h1>
          <p className="text-muted-foreground">Celebrating success across all children</p>
        </div>
        <Button>
          <Award className="h-4 w-4 mr-2" />
          Add Achievement
        </Button>
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
              {child.achievements.map((achievement) => (
                <div key={achievement.id} className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <achievement.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold mb-1">{achievement.title}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{achievement.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{achievement.date}</span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    Achievement
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
