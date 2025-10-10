import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Award, Trophy, Star, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ChildProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock data - would come from database
  const child = {
    id: parseInt(id || "1"),
    name: "Emma Thompson",
    age: 8,
    grade: "3rd Grade",
    group: "A",
    status: "active",
    guardians: [
      { name: "Jennifer Thompson", relation: "Mother", phone: "(555) 123-4567" },
      { name: "Robert Thompson", relation: "Father", phone: "(555) 123-4568" }
    ],
    achievements: [
      { id: 1, title: "Perfect Attendance", description: "September 2024", date: "Sep 30, 2024", icon: Award },
      { id: 2, title: "Science Fair Winner", description: "1st Place - Volcano Project", date: "Oct 15, 2024", icon: Trophy },
      { id: 3, title: "Reading Challenge", description: "Read 20 books this month", date: "Oct 31, 2024", icon: Star },
    ],
    activities: [
      { id: 1, name: "Soccer Team", role: "Forward", season: "Fall 2024" },
      { id: 2, name: "Art Club", role: "Member", season: "Year-round" },
      { id: 3, name: "Choir", role: "Alto", season: "Year-round" },
    ]
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/roster")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground mb-1">{child.name}</h1>
          <p className="text-muted-foreground">{child.grade} • Group {child.group}</p>
        </div>
        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
          Active
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Basic details and contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Age</p>
                    <p className="font-medium">{child.age} years old</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Grade</p>
                    <p className="font-medium">{child.grade}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Guardians</CardTitle>
                <CardDescription>Emergency contacts and family information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {child.guardians.map((guardian, index) => (
                  <div key={index} className="p-3 rounded-lg bg-muted/50">
                    <p className="font-medium">{guardian.name}</p>
                    <p className="text-sm text-muted-foreground">{guardian.relation} • {guardian.phone}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {child.achievements.length} total achievements
            </p>
            <Button size="sm">
              <Award className="h-4 w-4 mr-2" />
              Add Achievement
            </Button>
          </div>
          
          <div className="grid gap-4">
            {child.achievements.map((achievement) => (
              <Card key={achievement.id} className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <achievement.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{achievement.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{achievement.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{achievement.date}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Currently enrolled in {child.activities.length} activities
            </p>
            <Button size="sm">
              <Star className="h-4 w-4 mr-2" />
              Add Activity
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {child.activities.map((activity) => (
              <Card key={activity.id} className="shadow-card">
                <CardHeader>
                  <CardTitle>{activity.name}</CardTitle>
                  <CardDescription>{activity.season}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">{activity.role}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
