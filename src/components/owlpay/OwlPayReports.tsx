import { useEffect, useState } from "react";
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
import { Calendar as CalendarIcon, DollarSign, Package, TrendingUp, Receipt } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

const OwlPayReports = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [tempDateRange, setTempDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["owl-pay-reports", dateRange.from.toISOString(), dateRange.to.toISOString(), currentCompany?.id],
    enabled: !!currentCompany?.id,
    queryFn: async () => {
      const start = startOfDay(dateRange.from).toISOString();
      const end = endOfDay(dateRange.to).toISOString();

      const { data: transactions, error } = await supabase
        .from("owl_pay_transactions" as any)
        .select("*, owl_pay_items(*), children(name)")
        .eq("company_id", currentCompany!.id)
        .eq("transaction_type", "purchase")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const itemMap = new Map<string, { id: string; name: string; category: string; quantity: number; revenue: number }>();
      const dateMap = new Map<string, { revenue: number; count: number }>();
      const purchases: any[] = [];
      let totalRevenue = 0;
      let totalItems = 0;

      (transactions as any[])?.forEach((tx: any) => {
        const item = tx.owl_pay_items;
        const amount = Number(tx.amount);
        if (item) {
          const key = tx.item_id;
          if (!itemMap.has(key)) {
            itemMap.set(key, { id: key, name: item.name, category: item.category, quantity: 0, revenue: 0 });
          }
          const d = itemMap.get(key)!;
          d.quantity += 1;
          d.revenue += amount;

          const dateKey = new Date(tx.created_at).toLocaleDateString();
          if (!dateMap.has(dateKey)) dateMap.set(dateKey, { revenue: 0, count: 0 });
          const dd = dateMap.get(dateKey)!;
          dd.revenue += amount;
          dd.count += 1;

          purchases.push({
            id: tx.id,
            camper_name: tx.children?.name || "Unknown",
            item_name: item.name,
            item_category: item.category,
            amount,
            is_free: tx.is_free,
            purchased_at: tx.created_at,
          });

          totalRevenue += amount;
          totalItems += 1;
        }
      });

      const salesByItem = Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity);
      const salesOverTime = Array.from(dateMap.entries())
        .map(([date, d]) => ({ date, revenue: d.revenue, count: d.count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        salesByItem,
        salesOverTime,
        purchases,
        stats: {
          totalRevenue,
          totalItems,
          mostPopular: salesByItem[0]?.name || "N/A",
          avgTransaction: totalItems > 0 ? totalRevenue / totalItems : 0,
        },
      };
    },
  });

  const setQuickRange = (range: string) => {
    const now = new Date();
    let from: Date;
    switch (range) {
      case "today": from = startOfDay(now); break;
      case "week": from = startOfWeek(now); break;
      case "month": from = startOfMonth(now); break;
      case "all": from = new Date(2020, 0, 1); break;
      default: from = startOfDay(now);
    }
    setDateRange({ from, to: endOfDay(now) });
  };

  const filteredPurchases = data?.purchases?.filter(
    (p: any) => p.camper_name.toLowerCase().includes(searchTerm.toLowerCase()) || p.item_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  useEffect(() => {
    if (!currentCompany?.id) return;
    const channel = supabase
      .channel(`owlpay-web-reports-${currentCompany.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "owl_pay_transactions", filter: `company_id=eq.${currentCompany.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["owl-pay-reports"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "owl_pay_items", filter: `company_id=eq.${currentCompany.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["owl-pay-reports"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, queryClient]);

  return (
    <div className="space-y-4">
      {/* Date Controls */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickRange("today")}>Today</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange("week")}>This Week</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange("month")}>This Month</Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange("all")}>All Time</Button>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm"><CalendarIcon className="mr-2 h-4 w-4" />Custom Range</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-4 space-y-4">
                  <div><p className="text-sm font-medium mb-2">From</p>
                    <Calendar mode="single" selected={tempDateRange.from} onSelect={(date) => setTempDateRange({ ...tempDateRange, from: date })} /></div>
                  <div><p className="text-sm font-medium mb-2">To</p>
                    <Calendar mode="single" selected={tempDateRange.to} onSelect={(date) => setTempDateRange({ ...tempDateRange, to: date })} /></div>
                  <Button className="w-full" onClick={() => { if (tempDateRange.from && tempDateRange.to) setDateRange({ from: startOfDay(tempDateRange.from), to: endOfDay(tempDateRange.to) }); }} disabled={!tempDateRange.from || !tempDateRange.to}>Apply</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Badge variant="outline" className="mt-3">{format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}</Badge>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Revenue</p><p className="text-xl font-bold">${data?.stats.totalRevenue.toFixed(2) || "0.00"}</p></div><DollarSign className="h-6 w-6 text-primary opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Items Sold</p><p className="text-xl font-bold">{data?.stats.totalItems || 0}</p></div><Package className="h-6 w-6 text-green-500 opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Most Popular</p><p className="text-sm font-bold truncate">{data?.stats.mostPopular || "N/A"}</p></div><TrendingUp className="h-6 w-6 text-yellow-500 opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Avg Transaction</p><p className="text-xl font-bold">${data?.stats.avgTransaction.toFixed(2) || "0.00"}</p></div><Receipt className="h-6 w-6 text-muted-foreground opacity-50" /></div></CardContent></Card>
      </div>

      {/* Report Tabs */}
      <Tabs defaultValue="by-item">
        <TabsList>
          <TabsTrigger value="by-item">By Item</TabsTrigger>
          <TabsTrigger value="over-time">Over Time</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
        </TabsList>

        <TabsContent value="by-item">
          {(data?.salesByItem?.length || 0) === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No sales data for this period.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Sales by Item</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={{ quantity: { label: "Qty Sold", color: "hsl(var(--primary))" } }} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.salesByItem?.map(i => ({ name: i.name.substring(0, 12), quantity: i.quantity }))}>
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
                    <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data?.salesByItem?.map((item) => (
                        <TableRow key={item.id}><TableCell className="font-medium">{item.name}</TableCell><TableCell className="capitalize">{item.category}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">${item.revenue.toFixed(2)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="over-time">
          {(data?.salesOverTime?.length || 0) === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No data for this period.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Revenue Over Time</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={{ revenue: { label: "Revenue", color: "hsl(var(--primary))" } }} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data?.salesOverTime}>
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
                      <AreaChart data={data?.salesOverTime}>
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="count" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2) / 0.2)" strokeWidth={2} />
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
              <CardTitle className="text-base">Camper Purchases</CardTitle>
              <Input placeholder="Search by camper or item..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm mt-2" />
            </CardHeader>
            <CardContent>
              {filteredPurchases.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No purchase data.</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Camper</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filteredPurchases.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell>{format(new Date(p.purchased_at), "MMM dd, h:mm a")}</TableCell>
                          <TableCell className="font-medium">{p.camper_name}</TableCell>
                          <TableCell>{p.item_name}</TableCell>
                          <TableCell className="text-right">{p.is_free ? <span className="text-muted-foreground">Free</span> : `$${p.amount.toFixed(2)}`}</TableCell>
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
