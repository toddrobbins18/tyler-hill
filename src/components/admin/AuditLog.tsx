import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, FileText, Download } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  user_id: string | null;
  table_name: string;
  record_id: string;
  action: string;
  old_data: any;
  new_data: any;
  changed_at: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAuditLogs();
  }, [tableFilter]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(100);

    if (tableFilter !== "all") {
      query = query.eq("table_name", tableFilter);
    }

    const { data: logsData, error } = await query;

    if (error) {
      console.error("Error fetching audit logs:", error);
      setLoading(false);
      return;
    }

    // Fetch user profiles separately for each log
    const logsWithProfiles = await Promise.all(
      (logsData || []).map(async (log) => {
        if (!log.user_id) {
          return { ...log, profiles: null };
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", log.user_id)
          .maybeSingle();
        return { ...log, profiles: profile };
      })
    );

    setLogs(logsWithProfiles as AuditLog[]);
    setLoading(false);
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "INSERT":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "UPDATE":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "DELETE":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      default:
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400";
    }
  };

  const getChangedFields = (oldData: any, newData: any) => {
    if (!oldData || !newData) return [];
    const changes: { field: string; old: any; new: any }[] = [];
    Object.keys(newData).forEach(key => {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes.push({ field: key, old: oldData[key], new: newData[key] });
      }
    });
    return changes;
  };

  const formatValue = (value: any): string => {
    if (value === null) return "null";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const exportLogs = () => {
    const csv = [
      ["Date", "User", "Table", "Action", "Record ID"].join(","),
      ...logs.map(log =>
        [
          format(new Date(log.changed_at), "yyyy-MM-dd HH:mm:ss"),
          log.profiles?.full_name || "System",
          log.table_name,
          log.action,
          log.record_id,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const filteredLogs = logs.filter(log =>
    searchTerm === "" ||
    log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const uniqueTables = Array.from(new Set(logs.map(log => log.table_name))).sort();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Edit History
            </CardTitle>
            <CardDescription>View all changes made to the system</CardDescription>
          </div>
          <Button onClick={exportLogs} variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by table, user, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by table" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tables</SelectItem>
              {uniqueTables.map(table => (
                <SelectItem key={table} value={table}>
                  {table}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
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
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <Collapsible key={log.id} asChild>
                    <>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRow(log.id)}
                            >
                              {expandedRows.has(log.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.changed_at), "MMM dd, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.profiles?.full_name || "System"}</div>
                            {log.profiles?.email && (
                              <div className="text-xs text-muted-foreground">{log.profiles.email}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-1 rounded">{log.table_name}</code>
                        </TableCell>
                        <TableCell>
                          <Badge className={getActionColor(log.action)}>{log.action}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.record_id.slice(0, 8)}...</TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <div className="py-4 space-y-4">
                              {log.action === "UPDATE" && log.old_data && log.new_data && (
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm">Changed Fields:</h4>
                                  <div className="grid gap-2">
                                    {getChangedFields(log.old_data, log.new_data).map((change, idx) => (
                                      <div key={idx} className="bg-background rounded p-3 space-y-1">
                                        <div className="font-medium text-sm">{change.field}</div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                          <div>
                                            <span className="text-muted-foreground">Old: </span>
                                            <span className="text-red-600 dark:text-red-400">
                                              {formatValue(change.old)}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">New: </span>
                                            <span className="text-green-600 dark:text-green-400">
                                              {formatValue(change.new)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {log.action === "INSERT" && log.new_data && (
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm">Created Data:</h4>
                                  <pre className="bg-background rounded p-3 text-xs overflow-auto">
                                    {JSON.stringify(log.new_data, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.action === "DELETE" && log.old_data && (
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm">Deleted Data:</h4>
                                  <pre className="bg-background rounded p-3 text-xs overflow-auto">
                                    {JSON.stringify(log.old_data, null, 2)}
                                  </pre>
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
      </CardContent>
    </Card>
  );
}
