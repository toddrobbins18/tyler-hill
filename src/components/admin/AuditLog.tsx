import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Search, FileText, Calendar } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";

interface AuditLog {
  id: string;
  user_id: string | null;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: any;
  new_data: any;
  changed_at: string;
  user_email?: string;
  user_name?: string;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      
      // Fetch audit logs with user information
      const { data: logsData, error: logsError } = await supabase
        .from("audit_logs")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(500);

      if (logsError) throw logsError;

      // Fetch user profiles to get names
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email");

      if (profilesError) throw profilesError;

      // Map user info to logs
      const logsWithUsers = (logsData || []).map(log => {
        const profile = profiles?.find(p => p.id === log.user_id);
        return {
          ...log,
          user_email: profile?.email,
          user_name: profile?.full_name,
        };
      });

      setLogs(logsWithUsers);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch audit logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getChangedFields = (oldData: any, newData: any) => {
    if (!oldData || !newData) return [];
    
    const changes: { field: string; old: any; new: any }[] = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    
    allKeys.forEach(key => {
      if (key === 'updated_at' || key === 'created_at') return; // Skip timestamps
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes.push({
          field: key,
          old: oldData[key],
          new: newData[key],
        });
      }
    });
    
    return changes;
  };

  const formatValue = (value: any) => {
    if (value === null) return <span className="text-muted-foreground italic">null</span>;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === "" || 
      log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.record_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTable = selectedTable === "all" || log.table_name === selectedTable;
    
    return matchesSearch && matchesTable;
  });

  const uniqueTables = Array.from(new Set(logs.map(log => log.table_name))).sort();

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      INSERT: "default",
      UPDATE: "secondary",
      DELETE: "destructive",
    };
    return <Badge variant={variants[action] || "default"}>{action}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Edit History
        </CardTitle>
        <CardDescription>
          View all changes made to records in the system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by table, record ID, or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by table" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tables</SelectItem>
              {uniqueTables.map(table => (
                <SelectItem key={table} value={table}>
                  {table.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <Collapsible
                    key={log.id}
                    open={expandedRows.has(log.id)}
                    onOpenChange={() => toggleRow(log.id)}
                    asChild
                  >
                    <>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                              {expandedRows.has(log.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Date(log.changed_at).toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.user_name || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">{log.user_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.table_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.record_id.substring(0, 8)}...
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-4">
                            <div className="space-y-3">
                              <div className="font-semibold text-sm">Change Details:</div>
                              {log.action === "INSERT" && log.new_data && (
                                <div className="space-y-2">
                                  <div className="text-sm text-muted-foreground">New Record Created:</div>
                                  <pre className="bg-background p-3 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(log.new_data, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.action === "DELETE" && log.old_data && (
                                <div className="space-y-2">
                                  <div className="text-sm text-muted-foreground">Deleted Record:</div>
                                  <pre className="bg-background p-3 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(log.old_data, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.action === "UPDATE" && log.old_data && log.new_data && (
                                <div className="space-y-2">
                                  {getChangedFields(log.old_data, log.new_data).map((change, idx) => (
                                    <div key={idx} className="bg-background p-3 rounded space-y-1">
                                      <div className="font-medium text-sm">{change.field}:</div>
                                      <div className="flex gap-4 text-xs">
                                        <div className="flex-1">
                                          <span className="text-red-600 dark:text-red-400">Old: </span>
                                          <span className="font-mono">{formatValue(change.old)}</span>
                                        </div>
                                        <div className="flex-1">
                                          <span className="text-green-600 dark:text-green-400">New: </span>
                                          <span className="font-mono">{formatValue(change.new)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="text-sm text-muted-foreground">
          Showing {filteredLogs.length} of {logs.length} audit logs
        </div>
      </CardContent>
    </Card>
  );
}
