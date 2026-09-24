import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Clock, LogIn, LogOut, QrCode, Radio, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  loadStaffTimeClockForDate,
  processStaffTimeClockScan,
  staffTimeClockWorkDate,
  type StaffTimeClockRow,
} from "@/lib/staffTimeClock";

type ClockRow = StaffTimeClockRow & { staff?: { name: string } };

export default function StaffTimeClock() {
  const { currentCompany } = useCompany();
  const { selectedSeason: season } = useSeason();
  const { user } = useAuth();
  const { toast } = useToast();

  const [scannerMode, setScannerMode] = useState(true);
  const [scanInput, setScanInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<ClockRow[]>([]);
  const [lastPunch, setLastPunch] = useState<{ name: string; action: "in" | "out"; at: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const workDate = staffTimeClockWorkDate();

  const refresh = useCallback(async () => {
    if (!currentCompany?.id || !season) return;
    const data = await loadStaffTimeClockForDate(supabase, currentCompany.id, season, workDate);
    setRows(data);
  }, [currentCompany?.id, season, workDate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!scannerMode) return;
    const id = setInterval(() => {
      if (document.activeElement !== inputRef.current && !scanning) {
        inputRef.current?.focus();
      }
    }, 500);
    return () => clearInterval(id);
  }, [scannerMode, scanning]);

  const handleScan = async (value?: string) => {
    const raw = (value ?? scanInput).trim();
    if (!raw || !currentCompany?.id || !season) return;

    setScanning(true);
    try {
      const result = await processStaffTimeClockScan(supabase, {
        rawScan: raw,
        companyId: currentCompany.id,
        season,
        userId: user?.id,
        workDate,
      });

      if (!result.ok) {
        toast({ title: result.message, variant: "destructive" });
      } else {
        setLastPunch({ name: result.staffName, action: result.action, at: result.at });
        toast({
          title: result.action === "in" ? "Signed in" : "Signed out",
          description: `${result.staffName} · ${format(new Date(result.at), "h:mm a")}`,
        });
        await refresh();
      }
    } catch (e: unknown) {
      toast({
        title: "Scan failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setScanInput("");
      setScanning(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const signedIn = rows.filter((r) => r.signed_in_at && !r.signed_out_at).length;
  const completed = rows.filter((r) => r.signed_in_at && r.signed_out_at).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="h-8 w-8" />
            Staff Time Clock
          </h1>
          <p className="text-muted-foreground">
            Scan QR badge or wristband · {format(new Date(`${workDate}T12:00:00`), "EEEE, MMMM d, yyyy")} · auto sign-out 4:15 PM
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button
            variant={scannerMode ? "default" : "outline"}
            onClick={() => setScannerMode((v) => !v)}
          >
            {scannerMode ? "Scanner on" : "Scanner off"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Signed in now</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold text-green-600">{signedIn}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Completed today</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{completed}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total punches</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{rows.length}</CardContent>
        </Card>
      </div>

      {lastPunch && (
        <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6 flex items-center gap-3">
            {lastPunch.action === "in" ? (
              <LogIn className="h-6 w-6 text-green-600" />
            ) : (
              <LogOut className="h-6 w-6 text-green-600" />
            )}
            <div>
              <p className="font-semibold">{lastPunch.name}</p>
              <p className="text-sm text-muted-foreground">
                {lastPunch.action === "in" ? "Signed in" : "Signed out"} at {format(new Date(lastPunch.at), "h:mm a")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <QrCode className="h-5 w-5" />
            Scan badge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            ref={inputRef}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleScan();
              }
            }}
            placeholder="Scan QR code or wristband…"
            disabled={scanning}
            className="text-lg h-14"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><QrCode className="h-3 w-3" /> QR badge</span>
            <span className="inline-flex items-center gap-1"><Radio className="h-3 w-3" /> RFID wristband</span>
            · First scan = in · Second = out
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Today&apos;s log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No punches yet today.</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
                <span className="font-medium">{row.staff?.name ?? "Staff"}</span>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {row.signed_in_at && (
                    <Badge variant="outline" className="gap-1">
                      <LogIn className="h-3 w-3" />
                      In {format(new Date(row.signed_in_at), "h:mm a")}
                      {row.sign_in_method ? ` · ${row.sign_in_method}` : ""}
                    </Badge>
                  )}
                  {row.signed_out_at ? (
                    <Badge variant={row.auto_signed_out ? "secondary" : "outline"} className="gap-1">
                      <LogOut className="h-3 w-3" />
                      Out {format(new Date(row.signed_out_at), "h:mm a")}
                      {row.auto_signed_out ? " · auto" : row.sign_out_method ? ` · ${row.sign_out_method}` : ""}
                    </Badge>
                  ) : (
                    <Badge className="bg-green-600">On site</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
