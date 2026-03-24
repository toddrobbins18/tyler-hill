import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { Search, ShoppingCart, Package, BarChart3, DollarSign, Scan, CheckCircle, XCircle } from "lucide-react";
import OwlPayCamperCard, { type OwlPayCamper } from "@/components/owlpay/OwlPayCamperCard";
import OwlPayItemGrid, { type OwlPayItem, type OwlPayCartItem } from "@/components/owlpay/OwlPayItemGrid";
import OwlPayTransactionSummary from "@/components/owlpay/OwlPayTransactionSummary";
import OwlPayItemManagement from "@/components/owlpay/OwlPayItemManagement";
import OwlPayReports from "@/components/owlpay/OwlPayReports";
import OwlPayBalanceManagement from "@/components/owlpay/OwlPayBalanceManagement";

export default function OwlPay() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCamper, setSelectedCamper] = useState<OwlPayCamper | null>(null);
  const [campers, setCampers] = useState<OwlPayCamper[]>([]);
  const [items, setItems] = useState<OwlPayItem[]>([]);
  const [cart, setCart] = useState<OwlPayCartItem[]>([]);
  const [isFirstScanToday, setIsFirstScanToday] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [scanBuffer, setScanBuffer] = useState("");
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();

  useEffect(() => {
    loadCampers();
    loadItems();
  }, [currentCompany, selectedSeason]);

  const loadCampers = async () => {
    if (!currentCompany?.id) return;
    const { data, error } = await supabase
      .from("children")
      .select("id, name, rfid, photo_url, owl_pay_balance, person_id")
      .eq("company_id", currentCompany.id)
      .neq("status", "inactive")
      .order("name");
    if (error) { console.error(error); return; }
    setCampers((data as any) || []);
  };

  const loadItems = async () => {
    if (!currentCompany?.id) return;
    const { data, error } = await supabase
      .from("owl_pay_items" as any)
      .select("*")
      .eq("company_id", currentCompany.id)
      .eq("active", true)
      .order("name");
    if (error) { console.error(error); return; }
    setItems((data as any) || []);
  };

  const checkFirstScanToday = async (camperId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from("owl_pay_daily_scans" as any)
      .select("*")
      .eq("child_id", camperId)
      .eq("scan_date", today)
      .maybeSingle();
    return !data;
  };

  const handleCamperSelect = async (camper: OwlPayCamper) => {
    setSelectedCamper(camper);
    setCart([]);
    const isFirst = await checkFirstScanToday(camper.id);
    setIsFirstScanToday(isFirst);
    if (isFirst) {
      toast({ title: "First scan today!", description: `${camper.name}'s first visit is free.` });
    }
  };

  const selectByRFID = async (rfid: string) => {
    const match = campers.find(c => c.rfid?.toLowerCase() === rfid.toLowerCase());
    if (match) {
      setScanStatus("success");
      await handleCamperSelect(match);
      toast({ title: "✓ Camper Found", description: match.name, duration: 2000 });
      setTimeout(() => { setSearchTerm(""); setScanStatus("idle"); }, 1000);
    } else {
      setScanStatus("error");
      toast({ title: "RFID not found", description: `No camper with RFID: ${rfid}`, variant: "destructive", duration: 3000 });
      setTimeout(() => setScanStatus("idle"), 2000);
    }
  };

  // RFID keyboard listener
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement;
      if (active?.tagName === "TEXTAREA" || (active?.tagName === "INPUT" && active !== searchInputRef.current)) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTime;

      if (e.key === "Enter") {
        if (scanBuffer.length > 0 && timeDiff < 500) {
          e.preventDefault();
          selectByRFID(scanBuffer);
          setScanBuffer("");
          if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        }
        return;
      }

      if (e.key.length === 1) {
        if (timeDiff < 100 && scanBuffer.length > 0) setScanStatus("scanning");
        setScanBuffer(prev => prev + e.key);
        setLastKeyTime(now);
        if (document.activeElement !== searchInputRef.current) {
          setSearchTerm(prev => prev + e.key);
          searchInputRef.current?.focus();
        }
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = setTimeout(() => { setScanBuffer(""); setScanStatus("idle"); }, 500);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, [scanBuffer, lastKeyTime, campers]);

  const filteredCampers = campers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.rfid && c.rfid.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addToCart = (item: OwlPayItem) => {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
      setCart(cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">🦉 Owl Pay</h1>
        <p className="text-muted-foreground">Point-of-sale canteen system with RFID scanning</p>
      </div>

      <Tabs defaultValue="pos">
        <TabsList>
          <TabsTrigger value="pos"><ShoppingCart className="h-4 w-4 mr-1" /> POS</TabsTrigger>
          <TabsTrigger value="items"><Package className="h-4 w-4 mr-1" /> Items</TabsTrigger>
          <TabsTrigger value="balances"><DollarSign className="h-4 w-4 mr-1" /> Balances</TabsTrigger>
          <TabsTrigger value="reports"><BarChart3 className="h-4 w-4 mr-1" /> Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="pos">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Camper Selection */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 z-20" />
                <Input
                  ref={searchInputRef}
                  placeholder="🏷️ Scan RFID or search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-9"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
                  {scanStatus === "idle" && <Scan className="h-4 w-4 text-primary opacity-50" />}
                  {scanStatus === "scanning" && <Scan className="h-4 w-4 text-primary animate-spin" />}
                  {scanStatus === "success" && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {scanStatus === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                </div>
              </div>
              <div className="space-y-2 max-h-[calc(100vh-20rem)] overflow-y-auto pr-1">
                {filteredCampers.map((camper) => (
                  <OwlPayCamperCard
                    key={camper.id}
                    camper={camper}
                    isSelected={selectedCamper?.id === camper.id}
                    onSelect={handleCamperSelect}
                  />
                ))}
              </div>
            </div>

            {/* Middle: Items */}
            <div>
              {selectedCamper ? (
                <OwlPayItemGrid items={items} cart={cart} onAddToCart={addToCart} />
              ) : (
                <div className="flex items-center justify-center h-full text-center p-8">
                  <div className="text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Select a camper to begin</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Transaction */}
            <div>
              {selectedCamper && (
                <OwlPayTransactionSummary
                  camper={selectedCamper}
                  cart={cart}
                  isFirstScanToday={isFirstScanToday}
                  onUpdateCart={setCart}
                  onComplete={() => {
                    setSelectedCamper(null);
                    setCart([]);
                    loadCampers();
                  }}
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="items">
          <OwlPayItemManagement />
        </TabsContent>

        <TabsContent value="balances">
          <OwlPayBalanceManagement />
        </TabsContent>

        <TabsContent value="reports">
          <OwlPayReports />
        </TabsContent>
      </Tabs>
    </div>
  );
}
