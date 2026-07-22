/** Camp policy: no negative balance cap — campers may spend into the red. */

export function calculateOwlPayNewBalance(
  currentBalance: number,
  chargeTotal: number,
  isStaff: boolean,
): number {
  if (isStaff) return currentBalance + chargeTotal;
  return currentBalance - chargeTotal;
}

/** @deprecated No credit limit — always returns false. */
export function wouldExceedOwlPayOverdraft(_currentBalance: number, _chargeTotal: number): boolean {
  return false;
}

export type OwlPayBalanceTone = "negative" | "low" | "medium" | "healthy";

export function getOwlPayBalanceTone(balance: number): OwlPayBalanceTone {
  if (balance < 0) return "negative";
  if (balance < 5) return "low";
  if (balance < 15) return "medium";
  return "healthy";
}

export function formatOwlPayBalanceHint(balance: number): string | null {
  if (balance < 0) return "Negative balance";
  if (balance < 5) return "Low balance — please add funds";
  if (balance < 15) return "Balance is getting low";
  return null;
}
