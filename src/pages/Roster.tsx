import { useState, useEffect } from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AddChildDialog from "@/components/dialogs/AddChildDialog";
import CSVUploader from "@/components/CSVUploader";

export default function Roster() {
  const [searchTerm, setSearchTerm] = useState("");
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchChildren = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("children")
      .select("*")
      .order("name");
    
    if (!error && data) {
      setChildren(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChildren();
  }, []);

  const filteredChildren = children.filter((child) =>
    child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (child.grade?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Roster</h1>
          <p className="text-muted-foreground">Manage and view all children in your program</p>
        </div>
        <div className="flex gap-2">
          <CSVUploader tableName="children" onUploadComplete={fetchChildren} />
          <AddChildDialog onSuccess={fetchChildren} />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or grade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredChildren.map((child) => (
            <Card 
              key={child.id} 
              className="shadow-card hover:shadow-md transition-all cursor-pointer"
              onClick={() => navigate(`/child/${child.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">{child.name}</h3>
                    <p className="text-sm text-muted-foreground">{child.grade || "N/A"}</p>
                  </div>
                  {child.group_name && (
                    <Badge variant="secondary">Group {child.group_name}</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Age: {child.age || "N/A"}</span>
                  <Badge 
                    variant="outline" 
                    className={
                      child.status === "active"
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {child.status || "Active"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredChildren.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No children found</p>
        </div>
      )}
    </div>
  );
}
