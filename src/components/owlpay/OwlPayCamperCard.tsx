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
      className={`p-3 cursor-pointer transition-all duration-200 ${
        isSelected
          ? "ring-2 ring-primary bg-primary/5"
          : "hover:shadow-md"
      }`}
      onClick={() => onSelect(camper)}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          {(signedUrl || camper.photo_url) ? (
            <img
              src={signedUrl || camper.photo_url || ""}
              alt={camper.name}
              className="w-10 h-10 rounded-full object-cover border-2 border-muted"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{camper.name}</div>
        </div>
        <Badge variant="outline" className={`${balanceColor} font-bold text-sm`}>
          ${camper.owl_pay_balance.toFixed(2)}
        </Badge>
      </div>
    </Card>
  );
};

export default OwlPayCamperCard;
