import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Radio, Upload, Users, UserCheck, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface BulkRfidAssignmentDialogProps {
  type: "children" | "staff";
  onSuccess?: () => void;
}

interface AssignmentResult {
  name: string;
  rfid: string;
  status: "success" | "error" | "not_found";
  message: string;
}

export function BulkRfidAssignmentDialog({ type, onSuccess }: BulkRfidAssignmentDialogProps) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [csvData, setCsvData] = useState("");
  const [results, setResults] = useState<AssignmentResult[]>([]);
  const [searchName, setSearchName] = useState("");
  const [rfidInput, setRfidInput] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const rfidInputRef = useRef<HTMLInputElement>(null);

  const tableName = type === "children" ? "children" : "staff";
  const entityLabel = type === "children" ? "Camper" : "Staff";
  const entityLabelPlural = type === "children" ? "Campers" : "Staff";

  const handleSearch = async () => {
    if (!searchName.trim() || !currentCompany?.id) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("id, name, rfid")
        .eq("company_id", currentCompany.id)
        .eq("season", currentSeason)
        .ilike("name", `%${searchName.trim()}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPerson = (person: any) => {
    setSelectedPerson(person);
    setSearchResults([]);
    setSearchName("");
    setTimeout(() => rfidInputRef.current?.focus(), 100);
  };

  const handleAssignRfid = async () => {
    if (!selectedPerson || !rfidInput.trim()) {
      toast.error("Please select a person and scan a wristband");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ rfid: rfidInput.trim() })
        .eq("id", selectedPerson.id);

      if (error) throw error;

      toast.success(`Wristband assigned to ${selectedPerson.name}`);
      setSelectedPerson(null);
      setRfidInput("");
      onSuccess?.();
    } catch (error) {
      console.error("Assignment error:", error);
      toast.error("Failed to assign wristband");
    } finally {
      setLoading(false);
    }
  };

  const handleRfidKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAssignRfid();
    }
  };

  const handleBulkUpload = async () => {
    if (!csvData.trim() || !currentCompany?.id) {
      toast.error("Please enter CSV data");
      return;
    }

    setLoading(true);
    const newResults: AssignmentResult[] = [];

    try {
      // Parse CSV - expect format: name,rfid or personId,rfid
      const lines = csvData.trim().split('\n');
      
      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 2) continue;

        const [identifier, rfid] = parts;
        if (!identifier || !rfid) continue;

        // Try to find by name first, then by person_id
        let query = supabase
          .from(tableName)
          .select("id, name")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason);

        // Check if identifier looks like a person_id (numeric or uuid-like)
        const isPersonId = /^[0-9a-f-]+$/i.test(identifier) && identifier.length > 5;
        
        if (isPersonId) {
          query = query.eq("person_id", identifier);
        } else {
          query = query.ilike("name", identifier);
        }

        const { data, error } = await query.limit(1).single();

        if (error || !data) {
          newResults.push({
            name: identifier,
            rfid,
            status: "not_found",
            message: `${entityLabel} not found`
          });
          continue;
        }

        // Update RFID
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ rfid })
          .eq("id", data.id);

        if (updateError) {
          newResults.push({
            name: data.name,
            rfid,
            status: "error",
            message: updateError.message
          });
        } else {
          newResults.push({
            name: data.name,
            rfid,
            status: "success",
            message: "Wristband assigned"
          });
        }
      }

      setResults(newResults);
      
      const successCount = newResults.filter(r => r.status === "success").length;
      const errorCount = newResults.filter(r => r.status !== "success").length;
      
      if (successCount > 0) {
        toast.success(`Assigned ${successCount} wristbands`, {
          description: errorCount > 0 ? `${errorCount} failed` : undefined
        });
        onSuccess?.();
      } else if (errorCount > 0) {
        toast.error(`Failed to assign ${errorCount} wristbands`);
      }
    } catch (error) {
      console.error("Bulk upload error:", error);
      toast.error("Bulk upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      // Skip header row if it looks like a header
      const lines = text.split('\n');
      if (lines[0]?.toLowerCase().includes('name') || lines[0]?.toLowerCase().includes('rfid')) {
        setCsvData(lines.slice(1).join('\n'));
      } else {
        setCsvData(text);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Radio className="h-4 w-4 mr-2" />
          Assign Wristbands
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Assign RFID Wristbands - {entityLabelPlural}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="individual" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Individual
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Bulk CSV
            </TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="flex-1 space-y-4 overflow-auto">
            <div className="space-y-4">
              {/* Search for person */}
              <div className="space-y-2">
                <Label>1. Search for {entityLabel}</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder={`Search ${entityLabel.toLowerCase()} by name...`}
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? "..." : "Search"}
                  </Button>
                </div>

                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {searchResults.map((person) => (
                      <button
                        key={person.id}
                        onClick={() => handleSelectPerson(person)}
                        className="w-full p-3 text-left hover:bg-muted/50 flex items-center justify-between"
                      >
                        <span>{person.name}</span>
                        {person.rfid ? (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Has RFID
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            No RFID
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected person + RFID scan */}
              {selectedPerson && (
                <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedPerson.name}</p>
                      {selectedPerson.rfid && (
                        <p className="text-xs text-muted-foreground">
                          Current RFID: {selectedPerson.rfid}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPerson(null)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>2. Scan Wristband (ISO 14443 Type A)</Label>
                    <div className="flex gap-2">
                      <Input
                        ref={rfidInputRef}
                        value={rfidInput}
                        onChange={(e) => setRfidInput(e.target.value)}
                        onKeyDown={handleRfidKeyPress}
                        placeholder="Scan wristband..."
                        className="bg-white dark:bg-background"
                        autoFocus
                      />
                      <Button 
                        onClick={handleAssignRfid} 
                        disabled={loading || !rfidInput.trim()}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {loading ? "..." : "Assign"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="flex-1 flex flex-col overflow-hidden space-y-4">
            <div className="space-y-2">
              <Label>Upload CSV or paste data</Label>
              <p className="text-xs text-muted-foreground">
                Format: <code>name,rfid</code> or <code>person_id,rfid</code> (one per line)
              </p>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <Textarea
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder={`John Smith,ABC123DEF456\nJane Doe,XYZ789GHI012\n...`}
                className="h-full min-h-[150px] font-mono text-sm"
              />
            </div>

            <Button 
              onClick={handleBulkUpload} 
              disabled={loading || !csvData.trim()}
              className="w-full"
            >
              {loading ? "Processing..." : `Assign Wristbands (${csvData.trim().split('\n').filter(l => l.trim()).length} rows)`}
            </Button>

            {/* Results */}
            {results.length > 0 && (
              <ScrollArea className="h-[200px] border rounded-lg">
                <div className="divide-y">
                  {results.map((result, idx) => (
                    <div key={idx} className="p-2 flex items-center gap-2 text-sm">
                      {result.status === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : result.status === "not_found" ? (
                        <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{result.name}</span>
                      <span className="text-muted-foreground truncate max-w-[100px]">
                        {result.rfid}
                      </span>
                      <span className={`text-xs ${
                        result.status === "success" ? "text-green-600" : 
                        result.status === "not_found" ? "text-yellow-600" : "text-red-600"
                      }`}>
                        {result.message}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}