import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { Search, ShoppingCart, Package, BarChart3, DollarSign, Scan, CheckCircle, XCircle, Settings, Briefcase } from "lucide-react";
import OwlPayCamperCard, { type OwlPayCamper } from "@/components/owlpay/OwlPayCamperCard";
import OwlPayItemGrid, { type OwlPayItem, type OwlPayCartItem } from "@/components/owlpay/OwlPayItemGrid";
import OwlPayTransactionSummary from "@/components/owlpay/OwlPayTransactionSummary";
import OwlPayItemManagement from "@/components/owlpay/OwlPayItemManagement";
import OwlPayReports from "@/components/owlpay/OwlPayReports";
import OwlPayBalanceManagement from "@/components/owlpay/OwlPayBalanceManagement";
import OwlPayEmailSettings from "@/components/owlpay/OwlPayEmailSettings";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useOwlPayItems } from "@/hooks/useOwlPayItems";
import {
  findInListByRfid,
  lookupOwlPayCamperByRfid,
  lookupOwlPayStaffByRfid,
  normalizeRfidInput,
  rfidsMatch,
} from "@/lib/rfidUtils";

interface StaffMember {
  id: string;
  name: string;
  rfid: string | null;
  photo_url: string | null;
}

function OwlPayPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCamper, setSelectedCamper] = useState<OwlPayCamper | null>(null);
  const [campers, setCampers] = useState<OwlPayCamper[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [cart, setCart] = useState<OwlPayCartItem[]>([]);
  const [hasFreeDailyItemAvailable, setHasFreeDailyItemAvailable] = useState(false);
  const [isStaffSelected, setIsStaffSelected] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [scanBuffer, setScanBuffer] = useState("");
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();
  const queryClient = useQueryClient();
  const { data: posItems = [], isLoading: itemsLoading } = useOwlPayItems(currentCompany?.id, true);

  useEffect(() => {
    loadCampers();
    loadStaff();
  }, [currentCompany, selectedSeason]);

  useEffect(() => {
    if (!currentCompany?.id) return;

    const channel = supabase
      .channel(`owlpay-web-pos-${currentCompany.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "children", filter: `company_id=eq.${currentCompany.id}` },
        () => {
          loadCampers();
          queryClient.invalidateQueries({ queryKey: ["owl-pay-reports"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff", filter: `company_id=eq.${currentCompany.id}` },
        () => {
          loadStaff();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "owl_pay_items", filter: `company_id=eq.${currentCompany.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["owlpay-items", currentCompany.id] });
          queryClient.invalidateQueries({ queryKey: ["owl-pay-reports"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "owl_pay_transactions", filter: `company_id=eq.${currentCompany.id}` },
        () => {
          loadCampers();
          queryClient.invalidateQueries({ queryKey: ["owl-pay-reports"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, queryClient, selectedSeason]);

  const loadCampers = async () => {
    if (!currentCompany?.id || !selectedSeason) return;
    const { data, error } = await supabase
      .from("children")
      .select("id, name, rfid, photo_url, owl_pay_balance, person_id")
      .eq("company_id", currentCompany.id)
      .eq("season", selectedSeason)
      .neq("status", "inactive")
      .order("name");
    if (error) { console.error(error); return; }
    setCampers((data as any) || []);
  };

  const loadStaff = async () => {
    if (!currentCompany?.id || !selectedSeason) return;
    const { data, error } = await supabase
      .from("staff")
      .select("id, name, rfid, photo_url")
      .eq("company_id", currentCompany.id)
      .eq("season", selectedSeason)
      .neq("status", "inactive")
      .order("name");
    if (error) { console.error(error); return; }
    setStaffMembers((data as any) || []);
  };

  const handleStaffSelect = (staff: StaffMember) => {
    const staffAsCamper: OwlPayCamper = {
      id: staff.id,
      name: staff.name,
      rfid: staff.rfid,
      photo_url: staff.photo_url,
      owl_pay_balance: 0,
      person_id: staff.id,
    };
    setSelectedCamper(staffAsCamper);
    setCart([]);
    setHasFreeDailyItemAvailable(false);
    setIsStaffSelected(true);
  };

  const checkFreeDailyItemAvailable = async (camperId: string) => {
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
    setIsStaffSelected(false);
    const hasFreeItem = await checkFreeDailyItemAvailable(camper.id);
    setHasFreeDailyItemAvailable(hasFreeItem);
    if (hasFreeItem) {
      toast({
        title: "Free daily item available",
        description: `${camper.name} can get one free snack or drink today.`,
      });
    }
  };

  const selectByRFID = async (rfidRaw: string) => {
    const rfid = normalizeRfidInput(rfidRaw);
    if (!rfid || !currentCompany?.id || !selectedSeason) {
      setScanStatus("error");
      toast({ title: "RFID not found", description: "Invalid scan or camp not selected", variant: "destructive", duration: 3000 });
      setTimeout(() => setScanStatus("idle"), 2000);
      return;
    }

    const camperMatch =
      (await lookupOwlPayCamperByRfid(rfid, currentCompany.id, selectedSeason)) ??
      findInListByRfid(campers, rfid);
    if (camperMatch) {
      setScanStatus("success");
      await handleCamperSelect(camperMatch as OwlPayCamper);
      toast({ title: "✓ Camper Found", description: camperMatch.name, duration: 2000 });
      setTimeout(() => { setSearchTerm(""); setScanStatus("idle"); }, 1000);
      return;
    }

    const staffMatch =
      (await lookupOwlPayStaffByRfid(rfid, currentCompany.id, selectedSeason)) ??
      findInListByRfid(staffMembers, rfid);
    if (staffMatch) {
      setScanStatus("success");
      const staffAsCamper: OwlPayCamper = {
        id: staffMatch.id,
        name: staffMatch.name,
        rfid: staffMatch.rfid,
        photo_url: staffMatch.photo_url,
        owl_pay_balance: 0,
        person_id: staffMatch.id,
      };
      setSelectedCamper(staffAsCamper);
      setCart([]);
      setHasFreeDailyItemAvailable(false);
      setIsStaffSelected(true);
      toast({ title: "✓ Staff Found", description: staffMatch.name, duration: 2000 });
      setTimeout(() => { setSearchTerm(""); setScanStatus("idle"); }, 1000);
      return;
    }

    setScanStatus("error");
    toast({ title: "RFID not found", description: `No camper or staff with RFID: ${rfid}`, variant: "destructive", duration: 3000 });
    setTimeout(() => setScanStatus("idle"), 2000);
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
  }, [scanBuffer, lastKeyTime, campers, staffMembers]);

  const filteredCampers = campers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rfidsMatch(c.rfid, searchTerm)
  );

  const filteredStaff = staffMembers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rfidsMatch(s.rfid, searchTerm)
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
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" /> Settings</TabsTrigger>
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
              <div className="space-y-2 max-h-[calc(100vh-28rem)] overflow-y-auto pr-1">
                {filteredCampers.map((camper) => (
                  <OwlPayCamperCard
                    key={camper.id}
                    camper={camper}
                    isSelected={selectedCamper?.id === camper.id && !isStaffSelected}
                    onSelect={handleCamperSelect}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2 text-sm font-semibold text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Staff (Running Tab)
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {filteredStaff.map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => handleStaffSelect(staff)}
                    className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selectedCamper?.id === staff.id && isStaffSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Briefcase className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{staff.name}</div>
                      <div className="text-xs text-muted-foreground">{staff.rfid || "No RFID"}</div>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">Tab</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Middle: Items — always visible so canteen staff can see the menu */}
            <div>
              <OwlPayItemGrid
                items={posItems}
                cart={cart}
                onAddToCart={addToCart}
                canAdd={!!selectedCamper}
                isLoading={itemsLoading}
              />
            </div>

            {/* Right: Transaction */}
            <div id="owlpay-checkout" className="scroll-mt-24">
              {selectedCamper && (
                <OwlPayTransactionSummary
                  camper={selectedCamper}
                  cart={cart}
                  hasFreeDailyItemAvailable={hasFreeDailyItemAvailable}
                  isStaff={isStaffSelected}
                  onUpdateCart={setCart}
                  onComplete={() => {
                    setSelectedCamper(null);
                    setCart([]);
                    setHasFreeDailyItemAvailable(false);
                    loadCampers();
                  }}
                />
              )}
            </div>
          </div>

          {selectedCamper && (
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-3 shadow-lg lg:hidden">
              <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{selectedCamper.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {cart.length === 0
                      ? "Add items, then scroll to checkout"
                      : `${cart.length} item${cart.length === 1 ? "" : "s"} in cart`}
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() =>
                    document.getElementById("owlpay-checkout")?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  {cart.length === 0 ? "Checkout" : "Review order"}
                </Button>
              </div>
            </div>
          )}
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

        <TabsContent value="settings">
          <OwlPayEmailSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Owl Pay is only available for companies with `owl_pay_enabled` (Tyler Hill in production). */
export default function OwlPay() {
  const { currentCompany, loading } = useCompany();
  const navigate = useNavigate();

  const owlPayEnabled =
    currentCompany?.owl_pay_enabled === true ||
    (currentCompany?.owl_pay_enabled == null && currentCompany?.slug === "tyler-hill-camp");

  if (loading || !currentCompany) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!owlPayEnabled) {
    return (
      <div className="max-w-lg mx-auto space-y-6 p-6 text-center">
        <h1 className="text-2xl font-bold">Owl Pay isn’t available here</h1>
        <p className="text-muted-foreground">
          Owl Pay is only enabled for Tyler Hill Camp. You’re viewing{" "}
          <span className="font-medium text-foreground">{currentCompany.name}</span>. Open the dashboard
          for this camp instead.
        </p>
        <Button className="w-full sm:w-auto" onClick={() => navigate("/")}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  return <OwlPayPage />;
}
