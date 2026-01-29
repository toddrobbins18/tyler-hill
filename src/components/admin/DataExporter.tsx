import { useState } from "react";
import { Download, Users, User, Check, Loader2, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useQuery } from "@tanstack/react-query";

interface ExportRecord {
  id: string;
  name: string;
  person_id: string;
  rfid: string | null;
  photo_url: string | null;
  division?: string | null;
  bunk?: string | null;
}

export default function DataExporter() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { selectedSeason: currentSeason } = useSeason();
  const [exportType, setExportType] = useState<"children" | "staff">("children");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  // Fetch children
  const { data: children = [], isLoading: loadingChildren } = useQuery({
    queryKey: ["export-children", currentCompany?.id, currentSeason],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("children")
        .select(`
          id,
          name,
          person_id,
          rfid,
          photo_url,
          divisions:division_id(name),
          bunks:bunk_id(bunk_name, bunk_number)
        `)
        .eq("company_id", currentCompany.id)
        .eq("season", currentSeason)
        .order("name");
      
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        person_id: c.person_id,
        rfid: c.rfid,
        photo_url: c.photo_url,
        division: c.divisions?.name || null,
        bunk: c.bunks?.bunk_name || `Bunk ${c.bunks?.bunk_number}` || null,
      })) as ExportRecord[];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch staff
  const { data: staff = [], isLoading: loadingStaff } = useQuery({
    queryKey: ["export-staff", currentCompany?.id, currentSeason],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("staff")
        .select(`
          id,
          name,
          person_id,
          rfid,
          photo_url,
          divisions:division_id(name)
        `)
        .eq("company_id", currentCompany.id)
        .eq("season", currentSeason)
        .order("name");
      
      if (error) throw error;
      return (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        person_id: s.person_id,
        rfid: s.rfid,
        photo_url: s.photo_url,
        division: s.divisions?.name || null,
      })) as ExportRecord[];
    },
    enabled: !!currentCompany?.id,
  });

  const currentRecords = exportType === "children" ? children : staff;
  const isLoading = exportType === "children" ? loadingChildren : loadingStaff;

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(currentRecords.map(r => r.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const getSignedUrl = async (photoUrl: string): Promise<string | null> => {
    if (!photoUrl) return null;
    
    try {
      const { data, error } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(photoUrl, 3600); // 1 hour
      
      if (error) {
        console.error("Error creating signed URL:", error);
        return null;
      }
      return data.signedUrl;
    } catch (err) {
      console.error("Error getting signed URL:", err);
      return null;
    }
  };

  const handleExport = async (mode: "selected" | "all") => {
    const recordsToExport = mode === "all" 
      ? currentRecords 
      : currentRecords.filter(r => selectedIds.has(r.id));
    
    if (recordsToExport.length === 0) {
      toast({
        title: "No records to export",
        description: mode === "selected" 
          ? "Please select at least one record to export." 
          : "No records available to export.",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      // Generate signed URLs for photos
      const exportData = await Promise.all(
        recordsToExport.map(async (record) => {
          const signedPhotoUrl = record.photo_url 
            ? await getSignedUrl(record.photo_url)
            : null;

          return {
            name: record.name,
            person_id: record.person_id,
            rfid: record.rfid || null,
            photo_path: record.photo_url || null,
            photo_url: signedPhotoUrl,
            division: record.division || null,
            ...(exportType === "children" && record.bunk ? { bunk: record.bunk } : {}),
          };
        })
      );

      const exportPayload = {
        export_type: exportType,
        export_date: new Date().toISOString(),
        company: currentCompany?.name || "Unknown",
        season: currentSeason,
        record_count: exportData.length,
        records: exportData,
      };

      // Download as JSON file
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportType}-export-${currentSeason}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `Exported ${exportData.length} ${exportType} records.`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "An error occurred while exporting data.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const recordsWithPhotos = currentRecords.filter(r => r.photo_url);
  const recordsWithRfid = currentRecords.filter(r => r.rfid);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Data Export
        </CardTitle>
        <CardDescription>
          Export photos, person IDs, and RFID data for campers or staff as JSON
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={exportType} onValueChange={(v) => {
          setExportType(v as "children" | "staff");
          setSelectedIds(new Set());
        }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="children" className="gap-2">
              <Users className="h-4 w-4" />
              Campers ({children.length})
            </TabsTrigger>
            <TabsTrigger value="staff" className="gap-2">
              <User className="h-4 w-4" />
              Staff ({staff.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={exportType} className="mt-4 space-y-4">
            {/* Stats */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                <Image className="h-3 w-3 mr-1" />
                {recordsWithPhotos.length} with photos
              </Badge>
              <Badge variant="secondary">
                {recordsWithRfid.length} with RFID
              </Badge>
              <Badge variant="outline">
                {selectedIds.size} selected
              </Badge>
            </div>

            {/* Selection controls */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
            </div>

            {/* Record list */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : currentRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No {exportType} found for {currentSeason}
              </div>
            ) : (
              <ScrollArea className="h-[400px] border rounded-md p-4">
                <div className="space-y-2">
                  {currentRecords.map((record) => (
                    <div
                      key={record.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedIds.has(record.id) 
                          ? "bg-primary/5 border-primary" 
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => toggleSelection(record.id)}
                    >
                      <Checkbox
                        checked={selectedIds.has(record.id)}
                        onCheckedChange={() => toggleSelection(record.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{record.name}</div>
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-2">
                          <span>ID: {record.person_id}</span>
                          {record.rfid && <span>RFID: {record.rfid}</span>}
                          {record.division && <span>{record.division}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {record.photo_url && (
                          <Badge variant="secondary" className="text-xs">
                            <Image className="h-3 w-3" />
                          </Badge>
                        )}
                        {record.rfid && (
                          <Badge variant="outline" className="text-xs">RFID</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Export buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={() => handleExport("selected")}
                disabled={exporting || selectedIds.size === 0}
                className="gap-2"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export Selected ({selectedIds.size})
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("all")}
                disabled={exporting || currentRecords.length === 0}
                className="gap-2"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export All ({currentRecords.length})
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
