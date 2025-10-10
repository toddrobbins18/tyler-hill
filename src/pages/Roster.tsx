import { useState } from "react";
import { Search, Plus, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const mockChildren = [
  { id: 1, name: "Emma Thompson", age: 8, grade: "3rd Grade", group: "A", status: "active" },
  { id: 2, name: "Liam Rodriguez", age: 9, grade: "4th Grade", group: "B", status: "active" },
  { id: 3, name: "Olivia Chen", age: 7, grade: "2nd Grade", group: "A", status: "active" },
  { id: 4, name: "Noah Patel", age: 10, grade: "5th Grade", group: "C", status: "active" },
  { id: 5, name: "Ava Johnson", age: 8, grade: "3rd Grade", group: "B", status: "active" },
  { id: 6, name: "Ethan Williams", age: 9, grade: "4th Grade", group: "A", status: "active" },
  { id: 7, name: "Sophia Martinez", age: 7, grade: "2nd Grade", group: "C", status: "active" },
  { id: 8, name: "Mason Brown", age: 10, grade: "5th Grade", group: "B", status: "active" },
];

export default function Roster() {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const filteredChildren = mockChildren.filter((child) =>
    child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    child.grade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Roster</h1>
          <p className="text-muted-foreground">Manage and view all children in your program</p>
        </div>
        <Button className="shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Child
        </Button>
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
                  <p className="text-sm text-muted-foreground">{child.grade}</p>
                </div>
                <Badge variant="secondary">Group {child.group}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Age: {child.age}</span>
                <Badge 
                  variant="outline" 
                  className="bg-success/10 text-success border-success/20"
                >
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
