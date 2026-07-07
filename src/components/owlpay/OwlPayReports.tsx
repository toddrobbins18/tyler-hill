import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Line, LineChart, Area, AreaChart } from "recharts";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, DollarSign, Package, TrendingUp, Receipt, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import {
  aggregateOwlPayReports,
  fetchAllOwlPayPurchaseTransactions,
  formatCampReportDateTime,
  formatCampReportDateTimeCsv,
  formatCampReportTime,
  formatCampYmdDisplay,
  getCampYmd,
  getCampYmdFromIso,
  getOwlPayQuickRangeYmd,
  getOwlPayDailyRowsForChart,
  getOwlPayDailyRowsForDisplay,
  getOwlPayReportFetchBounds,
  type OwlPayReportAudience,
} from "@/lib/owlPayReports";

function toCsvCell(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsvLines(filename: string, lines: (string | number | boolean)[][]) {
  const bom = "\uFEFF";
  const body = lines.map((row) => row.map(toCsvCell).join(",")).join("\r\n");
  const blob = new Blob([bom + body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Calendar picker date ↔ camp report YMD (use wall date, not timezone shift). */
function ymdToPickerDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function pickerDateToYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function pickerDateToDisplay(date: Date): string {
  return formatCampYmdDisplay(pickerDateToYmd(date));
}

const OwlPayReports = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const todayYmd = getCampYmd();
  const [fromYmd, setFromYmd] = useState(todayYmd);
  const [toYmd, setToYmd] = useState(todayYmd);
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>();
  const [rangeOpen, setRangeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [reportAudience, setReportAudience] = useState<OwlPayReportAudience>("all");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["owl-pay-reports", "v4", fromYmd, toYmd, currentCompany?.id, reportAudience],
    enabled: !!currentCompany?.id,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { startISO, endInclusiveISO } = getOwlPayReportFetchBounds(fromYmd, toYmd);
      const transactions = await fetchAllOwlPayPurchaseTransactions(
        supabase,
        currentCompany!.id,
        startISO,
        endInclusiveISO,
      );
      const aggregated = aggregateOwlPayReports(transactions, reportAudience, fromYmd, toYmd);
      if (import.meta.env.DEV) {
        console.info("[OwlPay Reports]", {
          fromYmd,
          toYmd,
          startISO,
          endInclusiveISO,
          fetched: transactions.length,
          purchases: aggregated.purchases.length,
          paidItems: aggregated.stats.totalItems,
          revenue: aggregated.stats.totalRevenue,
        });
      }
      return aggregated;
    },
  });

  const setQuickRange = (range: "today" | "week" | "month" | "all") => {
    const { fromYmd: from, toYmd: to } = getOwlPayQuickRangeYmd(range);
    setFromYmd(from);
    setToYmd(to);
  };

  const filteredPurchases = data?.purchases?.filter(
    (p) =>
      p.camper_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.item_name.toLowerCase().includes(searchTerm.toLowerCase()),
  ) || [];

  const dailyRowsForDisplay = data ? getOwlPayDailyRowsForDisplay(data.salesOverTime) : [];
  const dailyRowsForChart = data ? getOwlPayDailyRowsForChart(data.salesOverTime) : [];

  const exportReportsCsv = () => {
    if (!data || !currentCompany?.id) {
      toast({ title: "Nothing to export", variant: "destructive" });
      return;
    }
    const audienceLabel = reportAudience === "all" ? "all-buyers" : reportAudience;
    const filename = `owlpay-report_${currentCompany.slug ?? "camp"}_${fromYmd}_${toYmd}_${audienceLabel}.csv`;

    const summaryRows: (string | number | boolean)[][] = [
      ["Report", "Owl Pay"],
      ["Company", currentCompany.name ?? ""],
      ["Date range (camp time / US Eastern)", `${formatCampYmdDisplay(fromYmd)} to ${formatCampYmdDisplay(toYmd)}`],
      ["Audience", reportAudience],
      ["Total revenue (paid items)", data.stats.totalRevenue.toFixed(2)],
      ["Paid items sold", data.stats.totalItems],
      ["Free daily items", data.stats.freeItems],
      ["Total purchase lines (paid + free)", data.stats.totalPurchaseLines],
      ["Avg paid transaction", data.stats.avgTransaction.toFixed(2)],
      ["Most popular item", data.stats.mostPopular],
      [],
      ["Daily summary — Camp date", "Revenue (paid)", "Paid items", "Free items", "Total lines"],
      ...dailyRowsForDisplay.map((d) => [
        formatCampYmdDisplay(d.ymd),
        d.revenue.toFixed(2),
        d.paidItems,
        d.freeItems,
        d.totalLines,
      ]),
      [],
      ["Sales by item — Item", "Category", "Qty sold (paid)", "Revenue"],
      ...data.salesByItem.map((i) => [i.name, i.category, i.quantity, i.revenue.toFixed(2)]),
      [],
      ["Purchases — Camp date", "Date/time (camp)", "Buyer type", "Name", "Item", "Category", "Amount", "Free"],
      ...data.purchases.map((p) => [
        formatCampYmdDisplay(p.camp_date || getCampYmdFromIso(p.purchased_at)),
        formatCampReportDateTimeCsv(p.purchased_at),
        p.buyer_type,
        p.camper_name,
        p.item_name,
        p.item_category,
        p.is_free ? "0.00" : p.amount.toFixed(2),
        p.is_free ? "yes" : "no",
      ]),
    ];

    downloadCsvLines(filename, summaryRows);
    toast({ title: "CSV downloaded", description: filename });
  };

  useEffect(() => {
    if (!currentCompany?.id) return;
    const channel = supabase
      .channel(`owlpay-web-reports-${currentCompany.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "owl_pay_transactions", filter: `company_id=eq.${currentCompany.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["owl-pay-reports"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "owl_pay_items", filter: `company_id=eq.${currentCompany.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["owl-pay-reports"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, queryClient]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickRange("today")}>Today</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange("week")}>This Week</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange("month")}>This Month</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange("all")}>All Time</Button>
            </div>
            <Popover
              open={rangeOpen}
              onOpenChange={(open) => {
                setRangeOpen(open);
                if (open) {
                  setTempDateRange({
                    from: ymdToPickerDate(fromYmd),
                    to: ymdToPickerDate(toYmd),
                  });
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><CalendarIcon className="mr-2 h-4 w-4" />Custom Range</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-4 space-y-3">
                  <p className="text-sm font-medium text-center">Select date range</p>
                  <p className="text-xs text-muted-foreground text-center">
                    1. Click the first day · 2. Click the last day · Same day twice = one day
                  </p>
                  <Calendar
                    mode="range"
                    numberOfMonths={1}
                    defaultMonth={ymdToPickerDate(fromYmd)}
                    selected={tempDateRange}
                    onSelect={setTempDateRange}
                    classNames={{
                      day_today: "font-semibold underline underline-offset-4 aria-selected:no-underline",
                    }}
                  />
                  <p className="text-sm text-center min-h-[1.25rem]">
                    {tempDateRange?.from ? (
                      tempDateRange.to ? (
                        <span>
                          <strong>{pickerDateToDisplay(tempDateRange.from)}</strong>
                          {" → "}
                          <strong>{pickerDateToDisplay(tempDateRange.to)}</strong>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Start: <strong>{pickerDateToDisplay(tempDateRange.from)}</strong> — now pick end date
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground">No dates selected</span>
                    )}
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (!tempDateRange?.from) return;
                      const start = tempDateRange.from;
                      const end = tempDateRange.to ?? tempDateRange.from;
                      const from = start <= end ? start : end;
                      const to = start <= end ? end : start;
                      setFromYmd(pickerDateToYmd(from));
                      setToYmd(pickerDateToYmd(to));
                      setRangeOpen(false);
                    }}
                    disabled={!tempDateRange?.from}
                  >
                    Apply range
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Purchasers:</span>
              <Button variant={reportAudience === "all" ? "default" : "outline"} size="sm" onClick={() => setReportAudience("all")}>All</Button>
              <Button variant={reportAudience === "campers" ? "default" : "outline"} size="sm" onClick={() => setReportAudience("campers")}>Campers</Button>
              <Button variant={reportAudience === "staff" ? "default" : "outline"} size="sm" onClick={() => setReportAudience("staff")}>Staff</Button>
            </div>
            <Button variant="secondary" size="sm" onClick={exportReportsCsv} disabled={isLoading || !data}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <Badge variant="outline">
            {formatCampYmdDisplay(fromYmd)} - {formatCampYmdDisplay(toYmd)} (camp time)
          </Badge>
          {fromYmd === toYmd && fromYmd === getCampYmd() && (data?.purchases?.length || 0) === 0 && !isLoading && (
            <p className="text-xs text-muted-foreground">
              Today uses US Eastern camp time. Purchases from last night may appear under yesterday&apos;s date.
            </p>
          )}
        </CardContent>
      </Card>

      {isError && (
        <Card>
          <CardContent className="py-4 text-destructive text-sm">
            Failed to load report data: {(error as Error)?.message || "Unknown error"}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Revenue (paid)</p>
                <p className="text-xl font-bold">${data?.stats.totalRevenue.toFixed(2) || "0.00"}</p>
              </div>
              <DollarSign className="h-6 w-6 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Paid Items</p>
                <p className="text-xl font-bold">{data?.stats.totalItems || 0}</p>
              </div>
              <Package className="h-6 w-6 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Lines</p>
                <p className="text-xl font-bold">{data?.stats.totalPurchaseLines || 0}</p>
                <p className="text-[11px] text-muted-foreground">paid + free</p>
              </div>
              <Receipt className="h-6 w-6 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Free Daily</p>
                <p className="text-xl font-bold">{data?.stats.freeItems || 0}</p>
              </div>
              <Package className="h-6 w-6 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Most Popular</p>
                <p className="text-sm font-bold truncate">{data?.stats.mostPopular || "N/A"}</p>
                <p className="text-[11px] text-muted-foreground">
                  avg paid ${data?.stats.avgTransaction.toFixed(2) || "0.00"}
                </p>
              </div>
              <TrendingUp className="h-6 w-6 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {(dailyRowsForDisplay.length || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily breakdown (camp time)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Camp date</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Paid items</TableHead>
                  <TableHead className="text-right">Free items</TableHead>
                  <TableHead className="text-right">Total lines</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyRowsForDisplay.map((day) => (
                  <TableRow key={day.ymd}>
                    <TableCell className="font-medium">{day.date}</TableCell>
                    <TableCell className="text-right">${day.revenue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{day.paidItems}</TableCell>
                    <TableCell className="text-right">{day.freeItems}</TableCell>
                    <TableCell className="text-right">{day.totalLines}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="by-item">
        <TabsList>
          <TabsTrigger value="by-item">By Item</TabsTrigger>
          <TabsTrigger value="over-time">Over Time</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
        </TabsList>

        <TabsContent value="by-item">
          {!isLoading && (data?.salesByItem?.length || 0) === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground space-y-2">
                <p>No paid sales for this period.</p>
                <p className="text-xs">
                  Try <strong>This Month</strong> or <strong>All Time</strong> for earlier sales.
                  Free daily items still appear in the Purchases tab.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Sales by Item</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={{ quantity: { label: "Qty Sold", color: "hsl(var(--primary))" } }} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.salesByItem?.map((i) => ({ name: i.name.substring(0, 12), quantity: i.quantity }))}>
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.salesByItem?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="capitalize">{item.category}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${item.revenue.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="over-time">
          {(dailyRowsForChart.length || 0) === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No data for this period.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Revenue Over Time</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={{ revenue: { label: "Revenue", color: "hsl(var(--primary))" } }} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyRowsForChart}>
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Transaction Volume</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={{ count: { label: "Transactions", color: "hsl(var(--chart-2))" } }} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyRowsForChart}>
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="totalLines" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2) / 0.2)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="purchases">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {reportAudience === "staff" ? "Staff purchases" : reportAudience === "campers" ? "Camper purchases" : "Purchases"}
              </CardTitle>
              <Input placeholder="Search by name or item..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm mt-2" />
            </CardHeader>
            <CardContent>
              {filteredPurchases.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No purchase data.</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Camp date</TableHead>
                        <TableHead>Time</TableHead>
                        {reportAudience === "all" && <TableHead>Type</TableHead>}
                        <TableHead>Name</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPurchases.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{formatCampYmdDisplay(p.camp_date)}</TableCell>
                          <TableCell>{formatCampReportTime(p.purchased_at)}</TableCell>
                          {reportAudience === "all" && (
                            <TableCell><Badge variant="outline" className="capitalize">{p.buyer_type}</Badge></TableCell>
                          )}
                          <TableCell className="font-medium">{p.camper_name}</TableCell>
                          <TableCell>{p.item_name}</TableCell>
                          <TableCell className="text-right">
                            {p.is_free ? <span className="text-muted-foreground">Free</span> : `$${p.amount.toFixed(2)}`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OwlPayReports;
