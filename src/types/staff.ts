export type HiringStatus = 'to-hire' | 'interviewing' | 'offered' | 'hired';

export interface StaffMember {
  id: string;
  name: string;
  position: string;
  department: string;
  actualBudget: number;
  proposedBudget: number;
  kidCredit: number;
  netBudget: number;
  status: HiringStatus;
  notes?: string;
}

export interface DepartmentStats {
  name: string;
  totalPositions: number;
  filled: number;
  toHire: number;
  budgetTotal: number;
  budgetUsed: number;
}
