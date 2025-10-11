import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Calendar, TrendingUp, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function StaffProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock data
  const staff = {
    id: parseInt(id || "1"),
    name: "Sarah Johnson",
    role: "Lead Teacher",
    department: "Education",
    email: "sarah.johnson@opconnect.com",
    phone: "(555) 123-4567",
    hireDate: "Jan 15, 2022",
    status: "active",
    averageRating: 4.8,
    evaluations: [
      {
        id: 1,
        date: "Oct 30, 2024",
        evaluator: "Principal Adams",
        rating: 5,
        category: "Leadership",
        comments: "Excellent leadership skills and dedication to student success. Consistently goes above and beyond.",
        strengths: ["Communication", "Organization", "Student Engagement"],
        improvements: []
      },
      {
        id: 2,
        date: "Aug 15, 2024",
        evaluator: "Director Thompson",
        rating: 4.8,
        category: "Teaching",
        comments: "Outstanding classroom management and innovative teaching methods.",
        strengths: ["Classroom Management", "Innovation", "Collaboration"],
        improvements: ["Digital Tools Integration"]
      },
      {
        id: 3,
        date: "May 20, 2024",
        evaluator: "Principal Adams",
        rating: 4.6,
        category: "Professional Development",
        comments: "Active participant in training sessions. Shows great initiative in personal growth.",
        strengths: ["Initiative", "Adaptability", "Teamwork"],
        improvements: ["Time Management"]
      },
    ],
    achievements: [
      { id: 1, title: "Teacher of the Quarter", date: "Q3 2024", description: "Recognized for excellence in education" },
      { id: 2, title: "Perfect Attendance", date: "2023", description: "Full year without absences" },
      { id: 3, title: "Innovation Award", date: "Jun 2024", description: "New curriculum development" },
    ]
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/staff")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
            {getInitials(staff.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground mb-1">{staff.name}</h1>
          <p className="text-muted-foreground">{staff.role} • {staff.department}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center gap-1">
              <Star className="h-5 w-5 text-warning fill-warning" />
              <span className="text-2xl font-bold">{staff.averageRating}</span>
            </div>
            <p className="text-xs text-muted-foreground">Average Rating</p>
          </div>
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            Active
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Professional details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{staff.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{staff.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{staff.department}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hire Date</p>
                  <p className="font-medium">{staff.hireDate}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
                <CardDescription>Recent evaluation metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total Evaluations</span>
                  <span className="text-xl font-bold">{staff.evaluations.length}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Average Rating</span>
                  <span className="text-xl font-bold">{staff.averageRating}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Achievements</span>
                  <span className="text-xl font-bold">{staff.achievements.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="evaluations" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {staff.evaluations.length} total evaluations
            </p>
            <Button size="sm">
              <TrendingUp className="h-4 w-4 mr-2" />
              Add Evaluation
            </Button>
          </div>

          <div className="grid gap-4">
            {staff.evaluations.map((evaluation) => (
              <Card key={evaluation.id} className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          {evaluation.category}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-warning fill-warning" />
                          <span className="font-bold">{evaluation.rating}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Evaluated by {evaluation.evaluator}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{evaluation.date}</span>
                    </div>
                  </div>

                  <p className="text-sm mb-4">{evaluation.comments}</p>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Strengths</p>
                      <div className="flex flex-wrap gap-2">
                        {evaluation.strengths.map((strength, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {strength}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {evaluation.improvements.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Areas for Growth</p>
                        <div className="flex flex-wrap gap-2">
                          {evaluation.improvements.map((improvement, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {improvement}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {staff.achievements.length} total achievements
            </p>
            <Button size="sm">
              <Award className="h-4 w-4 mr-2" />
              Add Achievement
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {staff.achievements.map((achievement) => (
              <Card key={achievement.id} className="shadow-card">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-warning/10">
                      <Award className="h-6 w-6 text-warning" />
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
      </Tabs>
    </div>
  );
}
