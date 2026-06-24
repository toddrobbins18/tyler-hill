import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useSignedPhotoUrl } from "@/hooks/useSignedPhotoUrl";

interface OwlPaySuccessModalProps {
  open: boolean;
  onClose: () => void;
  camperName: string;
  camperPhoto?: string | null;
  camperInitials: string;
  chargedAmount: number;
  newBalance: number;
  freeItemApplied: boolean;
}

const OwlPaySuccessModal = ({
  open, onClose, camperName, camperPhoto, camperInitials,
  chargedAmount, newBalance, freeItemApplied,
}: OwlPaySuccessModalProps) => {
  const { signedUrl } = useSignedPhotoUrl(camperPhoto);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [open, onClose]);

  const balanceColor = newBalance < 5 ? "text-destructive" : newBalance < 15 ? "text-yellow-600" : "text-green-600";
  const photoSrc = signedUrl || camperPhoto;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md text-center" onClick={onClose}>
        <div className="flex flex-col items-center py-4 space-y-4">
          <CheckCircle className="h-14 w-14 text-green-500" />
          <Avatar className="h-20 w-20 border-4 border-green-500/30 shadow-xl">
            {photoSrc && <AvatarImage src={photoSrc} alt={camperName} className="object-cover" />}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">{camperInitials}</AvatarFallback>
          </Avatar>
          <h2 className="text-lg font-bold">{camperName}</h2>

          {freeItemApplied && chargedAmount === 0 ? (
            <div className="flex items-center gap-2 text-green-600 font-medium">
              <Sparkles className="h-4 w-4" />
              <span>Free daily snack or drink applied!</span>
            </div>
          ) : (
            <div className="text-muted-foreground">
              Charged: <span className="font-semibold text-foreground">${chargedAmount.toFixed(2)}</span>
              {freeItemApplied && (
                <span className="block text-xs text-green-600 mt-1">Includes 1 free snack or drink</span>
              )}
            </div>
          )}

          <div className="w-full rounded-xl p-4 bg-muted/50">
            <div className="text-sm text-muted-foreground mb-1">Remaining Balance</div>
            <div className={`text-4xl font-bold ${balanceColor}`}>${newBalance.toFixed(2)}</div>
            {newBalance < 15 && newBalance >= 5 && (
              <div className="text-sm text-yellow-600 mt-1">⚠️ Balance is getting low</div>
            )}
            {newBalance < 5 && (
              <div className="text-sm text-destructive mt-1">⚠️ Low balance - please add funds</div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Tap anywhere to close</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OwlPaySuccessModal;
