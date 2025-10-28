import { useState, useEffect } from "react";
import { Search, Filter, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AddChildDialog from "@/components/dialogs/AddChildDialog";
import EditChildDialog from "@/components/dialogs/EditChildDialog";
import CSVUploader from "@/components/CSVUploader";
import { JSONUploader } from "@/components/JSONUploader";
import { toast } from "sonner";
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function Roster() {
  const { currentSeason } = useSeasonContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [children, setChildren] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"name" | "division">("name");
  const [loading, setLoading] = useState(true);
  const [editingChild, setEditingChild] = useState<string | null>(null);
  const [deletingChild, setDeletingChild] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const navigate = useNavigate();

  const fetchChildren = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("children")
      .select(`
        *,
        division:divisions(id, name, gender, sort_order)
      `)
      .or(`season.eq.${currentSeason},season.is.null`)
      .limit(2000)
      .order("name");
    
    if (!error && data) {
      setChildren(data);
      // Extract unique seasons
      const uniqueSeasons = [...new Set(data?.map(child => child.season).filter(Boolean))].sort().reverse();
      setSeasons(uniqueSeasons as string[]);
    }
    setLoading(false);
  };

  const fetchDivisions = async () => {
    const { data } = await supabase
      .from("divisions")
      .select("*")
      .order("sort_order");
    
    if (data) {
      setDivisions(data);
    }
  };

  useEffect(() => {
    fetchChildren();
    fetchDivisions();
  }, [currentSeason]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDivision, selectedSeason, sortBy]);

  const filteredChildren = children
    .filter((child) => {
      const matchesSearch = 
        child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (child.grade?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (child.division?.name?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      
      const matchesDivision = 
        selectedDivision === "all" || child.division_id === selectedDivision;
      
      const matchesSeason = 
        selectedSeason === "all" || child.season === selectedSeason;
      
      return matchesSearch && matchesDivision && matchesSeason;
    })
    .sort((a, b) => {
      if (sortBy === "division") {
        const divA = a.division?.sort_order || 999;
        const divB = b.division?.sort_order || 999;
        return divA - divB;
      }
      return a.name.localeCompare(b.name);
    });

  const totalPages = Math.ceil(filteredChildren.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedChildren = filteredChildren.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('ellipsis-start');
      }
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis-end');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("children")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete child");
      console.error(error);
    } else {
      toast.success("Child deleted successfully");
      fetchChildren();
    }
    setDeletingChild(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Camper</h1>
          <p className="text-muted-foreground">Manage and view all campers in your program</p>
        </div>
        <div className="flex gap-2">
          <CSVUploader tableName="children" onUploadComplete={fetchChildren} />
          <JSONUploader tableName="children" onUploadComplete={fetchChildren} />
          <AddChildDialog onSuccess={fetchChildren} />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, grade, or division..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedDivision}
          onChange={(e) => setSelectedDivision(e.target.value)}
          className="px-4 py-2 border rounded-md bg-background"
        >
          <option value="all">All Divisions</option>
          {divisions.map((div) => (
            <option key={div.id} value={div.id}>
              {div.name}
            </option>
          ))}
        </select>
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="px-4 py-2 border rounded-md bg-background"
        >
          <option value="all">All Seasons</option>
          {seasons.map((season) => (
            <option key={season} value={season}>
              {season}
            </option>
          ))}
        </select>
        <Button 
          variant="outline"
          onClick={() => setSortBy(sortBy === "name" ? "division" : "name")}
        >
          <ArrowUpDown className="h-4 w-4 mr-2" />
          Sort by {sortBy === "name" ? "Division" : "Name"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center text-sm text-muted-foreground mb-4">
            <span>
              Showing {filteredChildren.length === 0 ? 0 : startIndex + 1}-{Math.min(endIndex, filteredChildren.length)} of {filteredChildren.length} campers
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedChildren.map((child) => (
            <Card 
              key={child.id} 
              className="shadow-card hover:shadow-md transition-all group"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div 
                    className="space-y-1 flex-1 cursor-pointer"
                    onClick={() => navigate(`/child/${child.id}`)}
                  >
                    <h3 className="font-semibold text-lg">{child.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {child.division?.name || child.grade || "N/A"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {child.division && (
                      <Badge variant="secondary">{child.division.name}</Badge>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingChild(child.id);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingChild(child.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div 
                  className="flex items-center justify-between text-sm cursor-pointer"
                  onClick={() => navigate(`/child/${child.id}`)}
                >
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

        {totalPages > 1 && (
          <Pagination className="mt-8">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {getPageNumbers().map((page, idx) => (
                <PaginationItem key={`${page}-${idx}`}>
                  {typeof page === 'number' ? (
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  ) : (
                    <PaginationEllipsis />
                  )}
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
        </>
      )}

      {!loading && filteredChildren.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No campers found</p>
        </div>
      )}

      {editingChild && (
        <EditChildDialog
          childId={editingChild}
          open={!!editingChild}
          onOpenChange={(open) => !open && setEditingChild(null)}
          onSuccess={fetchChildren}
        />
      )}

      <AlertDialog open={!!deletingChild} onOpenChange={(open) => !open && setDeletingChild(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the camper record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingChild && handleDelete(deletingChild)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
