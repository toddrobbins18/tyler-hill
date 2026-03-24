import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { useSignedPhotoUrl } from "@/hooks/useSignedPhotoUrl";

export interface OwlPayCamper {
  id: string;
  name: string;
  rfid: string | null;
  photo_url: string | null;
  owl_pay_balance: number;
  person_id: string;
}

interface OwlPayCamperCardProps {
  camper: OwlPayCamper;
  isSelected: boolean;
  onSelect: (camper: OwlPayCamper) => void;
}

const OwlPayCamperCard = ({ camper, isSelected, onSelect }: OwlPayCamperCardProps) => {
  const { signedUrl } = useSignedPhotoUrl(camper.photo_url);
  const balanceColor = camper.owl_pay_balance < 5
    ? "text-destructive"
    : camper.owl_pay_balance < 15
      ? "text-yellow-600"
      : "text-green-600";

  return (
    <Card
      className={`p-4 cursor-pointer transition-all duration-300 rounded-xl ${
        isSelected
          ? "ring-2 ring-primary shadow-xl bg-primary/5 scale-[1.02]"
          : "hover:shadow-xl hover:-translate-y-0.5"
      }`}
      onClick={() => onSelect(camper)}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 relative">
          {(signedUrl || camper.photo_url) ? (
            <div className={`relative ${isSelected ? 'animate-pulse' : ''}`}>
              <img
                src={signedUrl || camper.photo_url || ""}
                alt={camper.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-primary/30 shadow-md"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base truncate">{camper.name}</div>
        </div>
        <Badge variant="outline" className={`${balanceColor} font-bold text-sm px-3 py-1 shadow-sm`}>
          ${camper.owl_pay_balance.toFixed(2)}
        </Badge>
      </div>
    </Card>
  );
};

export default OwlPayCamperCard;
