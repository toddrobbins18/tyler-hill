import { useNavigate } from "react-router-dom";
import { Search, Plus, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";

const mockStaff = [
  {
    id: 1,
    name: "Sarah Johnson",
    role: "Lead Teacher",
    department: "Education",
    status: "active",
    averageRating: 4.8,
    evaluationsCount: 12,
    recentEvaluation: "Excellent leadership",
    lastEvaluationDate: "Oct 30, 2024",
  },
  {
    id: 2,
    name: "Mike Chen",
    role: "Activity Coordinator",
    department: "Recreation",
    status: "active",
    averageRating: 4.6,
    evaluationsCount: 10,
    recentEvaluation: "Great with kids",
    lastEvaluationDate: "Nov 1, 2024",
  },
  {
    id: 3,
    name: "Lisa Brown",
    role: "Safety Officer",
    department: "Operations",
    status: "active",
    averageRating: 4.9,
    evaluationsCount: 15,
    recentEvaluation: "Outstanding protocols",
    lastEvaluationDate: "Oct 28, 2024",
  },
  {
    id: 4,
    name: "David Martinez",
    role: "Sports Coach",
    department: "Athletics",
    status: "active",
    averageRating: 4.7,
    evaluationsCount: 11,
    recentEvaluation: "Motivational and energetic",
    lastEvaluationDate: "Nov 2, 2024",
  },
];

export default function Staff() {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const filteredStaff = mockStaff.filter((staff) =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Staff & Evaluations</h1>
          <p className="text-muted-foreground">Manage team members and performance reviews</p>
        </div>
        <Button className="shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff by name, role, or department..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline">
          Filters
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredStaff.map((staff) => (
          <Card
            key={staff.id}
            className="shadow-card hover:shadow-md transition-all cursor-pointer"
            onClick={() => navigate(`/staff/${staff.id}`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {getInitials(staff.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg mb-1">{staff.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{staff.role}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/20">
                  {staff.department}
                </Badge>
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  Active
                </Badge>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Star className="h-4 w-4 text-warning fill-warning" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{staff.averageRating.toFixed(1)} Average Rating</p>
                  <p className="text-xs text-muted-foreground">{staff.evaluationsCount} evaluations</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-success mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Recent Evaluation</p>
                    <p className="text-xs text-muted-foreground">{staff.recentEvaluation}</p>
                    <p className="text-xs text-muted-foreground mt-1">{staff.lastEvaluationDate}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredStaff.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No staff members found matching your search.</p>
        </div>
      )}
    </div>
  );
}
