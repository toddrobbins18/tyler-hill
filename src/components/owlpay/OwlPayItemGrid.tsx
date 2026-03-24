import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pizza, Candy, Coffee, IceCream } from "lucide-react";

export interface OwlPayItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

export interface OwlPayCartItem extends OwlPayItem {
  quantity: number;
}

interface OwlPayItemGridProps {
  items: OwlPayItem[];
  cart: OwlPayCartItem[];
  onAddToCart: (item: OwlPayItem) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "food": return <Pizza className="h-6 w-6" />;
    case "snacks": return <Candy className="h-6 w-6" />;
    case "drinks": return <Coffee className="h-6 w-6" />;
    default: return <IceCream className="h-6 w-6" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case "food": return "bg-primary/10 text-primary";
    case "snacks": return "bg-yellow-500/10 text-yellow-600";
    case "drinks": return "bg-green-500/10 text-green-600";
    default: return "bg-accent/10 text-accent-foreground";
  }
};

const OwlPayItemGrid = ({ items, cart, onAddToCart }: OwlPayItemGridProps) => {
  const getItemQuantity = (itemId: string) => {
    return cart.find((i) => i.id === itemId)?.quantity || 0;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">🍦 Select Items</h2>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const quantity = getItemQuantity(item.id);
          return (
            <Card key={item.id} className="relative overflow-hidden hover:shadow-md transition-all">
              <Button
                variant="ghost"
                className="w-full h-full p-4 flex flex-col items-center gap-2 hover:bg-transparent"
                onClick={() => onAddToCart(item)}
              >
                <div className={`w-full h-14 rounded-lg flex items-center justify-center ${getCategoryColor(item.category)}`}>
                  {getCategoryIcon(item.category)}
                </div>
                <div className="text-sm font-medium text-center">{item.name}</div>
                <div className="text-lg font-bold text-primary">${item.price.toFixed(2)}</div>
                {quantity > 0 && (
                  <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground">
                    {quantity}
                  </Badge>
                )}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default OwlPayItemGrid;
