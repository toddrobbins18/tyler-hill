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
  /** When false, item buttons are disabled until a camper/staff is selected. */
  canAdd?: boolean;
  isLoading?: boolean;
}

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case "food": return <Pizza className="h-8 w-8" />;
    case "snacks": return <Candy className="h-8 w-8" />;
    case "drinks": return <Coffee className="h-8 w-8" />;
    default: return <IceCream className="h-8 w-8" />;
  }
};

const getCategoryGradient = (category: string) => {
  switch (category.toLowerCase()) {
    case "food": return "owlpay-gradient-food";
    case "snacks": return "owlpay-gradient-snacks";
    case "drinks": return "owlpay-gradient-drinks";
    default: return "owlpay-gradient-default";
  }
};

const OwlPayItemGrid = ({
  items,
  cart,
  onAddToCart,
  canAdd = true,
  isLoading = false,
}: OwlPayItemGridProps) => {
  const getItemQuantity = (itemId: string) => {
    return cart.find((i) => i.id === itemId)?.quantity || 0;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">🍦 Select Items</h2>
      {!canAdd && (
        <p className="text-sm text-muted-foreground">Select a camper or staff member to add items to the cart.</p>
      )}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Loading items…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No active canteen items yet. Add items on the Items tab.
        </p>
      ) : (
      <div className="grid grid-cols-2 gap-4">
        {items.map((item) => {
          const quantity = getItemQuantity(item.id);
          const gradientClass = getCategoryGradient(item.category);

          return (
            <Card
              key={item.id}
              className="relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl rounded-xl group"
            >
              <Button
                variant="ghost"
                className="w-full h-full p-5 flex flex-col items-center gap-3 hover:bg-transparent"
                disabled={!canAdd}
                onClick={() => onAddToCart(item)}
              >
                <div className={`${gradientClass} w-full h-20 rounded-lg flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform duration-300`}>
                  {getCategoryIcon(item.category)}
                </div>
                <div className="text-sm font-semibold text-center">{item.name}</div>
                <div className="text-xl font-bold text-primary">
                  ${Number(item.price).toFixed(2)}
                </div>
                {quantity > 0 && (
                  <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground shadow-lg px-3 py-1 text-sm font-bold">
                    {quantity}
                  </Badge>
                )}
              </Button>
            </Card>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default OwlPayItemGrid;
