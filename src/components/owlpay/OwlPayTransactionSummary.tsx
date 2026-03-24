import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Minus, Plus, Trash2, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useCountAnimation } from "@/hooks/useCountAnimation";
import { useSignedPhotoUrl } from "@/hooks/useSignedPhotoUrl";
import type { OwlPayCamper } from "./OwlPayCamperCard";
import type { OwlPayCartItem } from "./OwlPayItemGrid";
import OwlPaySuccessModal from "./OwlPaySuccessModal";

interface OwlPayTransactionSummaryProps {
  camper: OwlPayCamper;
  cart: OwlPayCartItem[];
  isFirstScanToday: boolean;
  isStaff?: boolean;
  onUpdateCart: (cart: OwlPayCartItem[]) => void;
  onComplete: () => void;
}

const OwlPayTransactionSummary = ({
  camper,
  cart,
  isFirstScanToday,
  isStaff = false,
  onUpdateCart,
  onComplete,
}: OwlPayTransactionSummaryProps) => {
  const [processing, setProcessing] = useState(false);
  const [successData, setSuccessData] = useState<{
    show: boolean;
    chargedAmount: number;
    newBalance: number;
  } | null>(null);
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { signedUrl } = useSignedPhotoUrl(camper.photo_url);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = isFirstScanToday ? 0 : subtotal;
  // Staff: running tab totals up; Campers: deduct from balance
  const newBalance = isStaff ? camper.owl_pay_balance + total : camper.owl_pay_balance - total;
  const animatedBalance = useCountAnimation(newBalance, 500);

  const updateQuantity = (itemId: string, change: number) => {
    onUpdateCart(
      cart
        .map((item) =>
          item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + change) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (itemId: string) => {
    onUpdateCart(cart.filter((item) => item.id !== itemId));
  };

  const handleComplete = async () => {
    if (!currentCompany?.id) return;

    if (cart.length === 0 && !isFirstScanToday) {
      toast({ title: "No items selected", variant: "destructive" });
      return;
    }

    if (!isStaff && !isFirstScanToday && newBalance < 0) {
      toast({ title: "Insufficient funds", variant: "destructive" });
      return;
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Record first scan if applicable
      if (isFirstScanToday) {
        await supabase.from("owl_pay_daily_scans" as any).insert({
          child_id: camper.id,
          company_id: currentCompany.id,
        });

        await supabase.from("owl_pay_transactions" as any).insert({
          child_id: camper.id,
          company_id: currentCompany.id,
          amount: 0,
          is_free: true,
          transaction_type: "first_scan",
          notes: "First scan of the day - free entry",
          created_by: user?.id,
        });
      }

      // Process paid items
      if (cart.length > 0 && !isFirstScanToday) {
        const transactionInserts = cart.flatMap(item =>
          Array(item.quantity).fill(null).map(() => ({
            child_id: camper.id,
            company_id: currentCompany.id,
            item_id: item.id,
            amount: item.price,
            is_free: false,
            transaction_type: "purchase",
            created_by: user?.id,
          }))
        );

        const { error: txError } = await supabase
          .from("owl_pay_transactions" as any)
          .insert(transactionInserts);
        if (txError) throw txError;

        // Only deduct balance for campers (not staff)
        if (!isStaff) {
          const { error: balError } = await supabase
            .from("children")
            .update({ owl_pay_balance: newBalance } as any)
            .eq("id", camper.id);
          if (balError) throw balError;
        }
      }

      setSuccessData({ show: true, chargedAmount: total, newBalance });
    } catch (error: any) {
      console.error("Transaction error:", error);
      toast({ title: "Transaction failed", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const initials = camper.name.split(' ').map(n => n[0]).join('').toUpperCase();
  const photoSrc = signedUrl || camper.photo_url;

  return (
    <>
      <OwlPaySuccessModal
        open={successData?.show ?? false}
        onClose={() => { setSuccessData(null); onComplete(); }}
        camperName={camper.name}
        camperPhoto={camper.photo_url}
        camperInitials={initials}
        chargedAmount={successData?.chargedAmount ?? 0}
        newBalance={successData?.newBalance ?? 0}
        isFirstScan={isFirstScanToday}
      />

      <Card className="sticky top-4 rounded-xl shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl">💳 Transaction</CardTitle>
          <div className="flex flex-col items-center pt-4 pb-2">
            <Avatar className="h-24 w-24 border-4 border-primary/30 shadow-xl ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
              {photoSrc && <AvatarImage src={photoSrc} alt={camper.name} className="object-cover" />}
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-2xl font-bold text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-center mt-3">
              <div className="font-semibold text-lg">{camper.name}</div>
              <div className="text-sm text-muted-foreground">{isStaff ? "Running Tab" : `Current Balance: $${camper.owl_pay_balance.toFixed(2)}`}</div>
            </div>
            {isFirstScanToday && (
              <Badge className="bg-green-500 text-white mt-2">
                <Sparkles className="w-3 h-3 mr-1" /> First Scan
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {cart.length > 0 ? (
            <>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground">${item.price.toFixed(2)} each</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                {isFirstScanToday && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span><Sparkles className="w-3 h-3 inline mr-1" />First Scan Discount:</span>
                    <span>-${subtotal.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-muted/50">
                  <span className="text-sm">{isStaff ? "Tab Total:" : "New Balance:"}</span>
                  <span className={`font-bold ${isStaff ? "text-primary" : newBalance < 5 ? "text-destructive" : newBalance < 15 ? "text-yellow-600" : "text-green-600"}`}>
                    ${animatedBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          ) : isFirstScanToday ? (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p className="font-medium">First scan - free entry!</p>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No items selected</p>
            </div>
          )}

          {(cart.length > 0 || isFirstScanToday) && (
            <Button
              className="w-full owlpay-gradient-header text-white shadow-xl text-lg active:scale-95 transition-transform"
              size="lg"
              onClick={handleComplete}
              disabled={processing || (!isFirstScanToday && newBalance < 0)}
            >
              {processing ? "Processing..." : isFirstScanToday && cart.length === 0 ? "🎉 Record First Scan" : "💳 Complete Transaction"}
            </Button>
          )}

          {!isFirstScanToday && newBalance < 0 && cart.length > 0 && (
            <p className="text-sm text-destructive text-center">⚠️ Insufficient funds</p>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default OwlPayTransactionSummary;
