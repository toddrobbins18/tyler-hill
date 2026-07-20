/** Campers may charge up to this amount below zero (matches DB/RPC limit). */
export const OWL_PAY_MAX_OVERDRAFT = 25;

export const OWL_PAY_MIN_BALANCE = -OWL_PAY_MAX_OVERDRAFT;

export function calculateOwlPayNewBalance(
  currentBalance: number,
  chargeTotal: number,
  isStaff: boolean,
): number {
  if (isStaff) return currentBalance + chargeTotal;
  return currentBalance - chargeTotal;
}

export function wouldExceedOwlPayOverdraft(currentBalance: number, chargeTotal: number): boolean {
  return currentBalance - chargeTotal < OWL_PAY_MIN_BALANCE;
}

export type OwlPayBalanceTone = "negative" | "low" | "medium" | "healthy";

export function getOwlPayBalanceTone(balance: number): OwlPayBalanceTone {
  if (balance < 0) return "negative";
  if (balance < 5) return "low";
  if (balance < 15) return "medium";
  return "healthy";
}

export function formatOwlPayBalanceHint(balance: number): string | null {
  if (balance < OWL_PAY_MIN_BALANCE) return null;
  if (balance < 0) {
    return `Negative balance — up to $${OWL_PAY_MAX_OVERDRAFT.toFixed(0)} credit available`;
  }
  if (balance < 5) return "Low balance — please add funds";
  if (balance < 15) return "Balance is getting low";
  return null;
}
