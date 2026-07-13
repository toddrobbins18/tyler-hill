import { useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles } from "lucide-react";
import { useSignedPhotoUrl } from "@/hooks/useSignedPhotoUrl";

interface OwlPayFirstScanModalProps {
  open: boolean;
  camperName: string;
  camperPhoto?: string | null;
  onClose: () => void;
  autoCloseMs?: number;
}

const OwlPayFirstScanModal = ({
  open,
  camperName,
  camperPhoto,
  onClose,
  autoCloseMs = 3000,
}: OwlPayFirstScanModalProps) => {
  const { signedUrl } = useSignedPhotoUrl(camperPhoto);
  const initials = camperName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const photoSrc = signedUrl || camperPhoto;

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [open, autoCloseMs, onClose]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="sm:max-w-sm text-center [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Free daily canteen item</DialogTitle>
        <div className="flex flex-col items-center py-6 space-y-4">
          <Avatar className="h-24 w-24 border-4 border-green-500/30 shadow-xl">
            {photoSrc && <AvatarImage src={photoSrc} alt={camperName} className="object-cover" />}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <h2 className="text-2xl font-bold">{camperName}</h2>
          <div className="flex items-center gap-2 text-green-600 font-medium">
            <Sparkles className="h-4 w-4" />
            <span>Free daily canteen item</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OwlPayFirstScanModal;
