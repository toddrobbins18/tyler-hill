export type OwlPayCartLine = {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
};

export type OwlPayCartPricing = {
  subtotal: number;
  freeDiscount: number;
  total: number;
  freeItemApplied: boolean;
  freeItemLineId: string | null;
  freeItemName: string | null;
};

export function normalizeOwlPayCategory(category: string | null | undefined): string {
  return (category ?? "").trim().toLowerCase();
}

/** Candy/chips/snacks or soda/slushie — the only categories eligible for the daily free item. */
export function isEligibleForFreeDailyItem(category: string | null | undefined): boolean {
  const normalized = normalizeOwlPayCategory(category);
  return normalized === "snacks" || normalized === "drinks";
}

export function calculateOwlPayCartPricing(
  cart: OwlPayCartLine[],
  options: { hasFreeDailyItemAvailable: boolean; isStaff: boolean }
): OwlPayCartPricing {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (options.isStaff || !options.hasFreeDailyItemAvailable || cart.length === 0) {
    return {
      subtotal,
      freeDiscount: 0,
      total: subtotal,
      freeItemApplied: false,
      freeItemLineId: null,
      freeItemName: null,
    };
  }

  const freeLine = cart.find((item) => isEligibleForFreeDailyItem(item.category));
  if (!freeLine) {
    return {
      subtotal,
      freeDiscount: 0,
      total: subtotal,
      freeItemApplied: false,
      freeItemLineId: null,
      freeItemName: null,
    };
  }

  const freeDiscount = Math.min(freeLine.price, subtotal);
  return {
    subtotal,
    freeDiscount,
    total: subtotal - freeDiscount,
    freeItemApplied: true,
    freeItemLineId: freeLine.id,
    freeItemName: freeLine.name,
  };
}

export function buildOwlPayPurchaseRows(
  cart: OwlPayCartLine[],
  pricing: OwlPayCartPricing,
  base: {
    child_id: string | null;
    staff_id: string | null;
    company_id: string;
    created_by?: string | null;
  }
) {
  let freeUnitApplied = false;

  return cart.flatMap((item) =>
    Array.from({ length: item.quantity }, () => {
      const isFreeUnit =
        pricing.freeItemApplied &&
        !freeUnitApplied &&
        item.id === pricing.freeItemLineId &&
        isEligibleForFreeDailyItem(item.category);

      if (isFreeUnit) {
        freeUnitApplied = true;
      }

      return {
        child_id: base.child_id,
        staff_id: base.staff_id,
        company_id: base.company_id,
        item_id: item.id,
        amount: isFreeUnit ? 0 : item.price,
        is_free: isFreeUnit,
        transaction_type: "purchase" as const,
        created_by: base.created_by,
        ...(isFreeUnit ? { notes: "Daily free item (snacks or drinks)" } : {}),
      };
    })
  );
}
