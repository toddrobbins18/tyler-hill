import { useNavigate } from "react-router-dom";
import { Search, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AddStaffDialog from "@/components/dialogs/AddStaffDialog";
import CSVUploader from "@/components/CSVUploader";

export default function Staff() {
  const [searchTerm, setSearchTerm] = useState("");
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchStaff = async () => {
    setLoading(true);
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("*")
      .order("name");

    if (!staffError && staffData) {
      const staffWithEvals = await Promise.all(
        staffData.map(async (member) => {
          const { data: evals } = await supabase
            .from("staff_evaluations")
            .select("rating, date, comments")
            .eq("staff_id", member.id)
            .order("date", { ascending: false });

          const averageRating = evals?.length
            ? evals.reduce((sum, e) => sum + (Number(e.rating) || 0), 0) / evals.length
            : 0;

          return {
            ...member,
            averageRating: averageRating.toFixed(1),
            evaluationsCount: evals?.length || 0,
            recentEvaluation: evals?.[0]?.comments || "No evaluations yet",
            lastEvaluationDate: evals?.[0]?.date || null,
          };
        })
      );

      setStaff(staffWithEvals);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const filteredStaff = staff.filter((member) =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (member.role?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (member.department?.toLowerCase() || "").includes(searchTerm.toLowerCase())
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
        <div className="flex gap-2">
          <CSVUploader tableName="staff" onUploadComplete={fetchStaff} />
          <AddStaffDialog onSuccess={fetchStaff} />
        </div>
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

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredStaff.map((staffMember) => (
            <Card
              key={staffMember.id}
              className="shadow-card hover:shadow-md transition-all cursor-pointer"
              onClick={() => navigate(`/staff/${staffMember.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {getInitials(staffMember.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg mb-1">{staffMember.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{staffMember.role}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  {staffMember.department && (
                    <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/20">
                      {staffMember.department}
                    </Badge>
                  )}
                  <Badge 
                    variant="outline" 
                    className={
                      staffMember.status === "active"
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {staffMember.status || "Active"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <Star className="h-4 w-4 text-warning fill-warning" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{staffMember.averageRating} Average Rating</p>
                    <p className="text-xs text-muted-foreground">{staffMember.evaluationsCount} evaluations</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-success mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Recent Evaluation</p>
                      <p className="text-xs text-muted-foreground">{staffMember.recentEvaluation}</p>
                      {staffMember.lastEvaluationDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(staffMember.lastEvaluationDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredStaff.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No staff members found matching your search.</p>
        </div>
      )}
    </div>
  );
}
