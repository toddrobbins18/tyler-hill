/**
 * Utility functions for division sorting and management
 */

export interface Division {
  id: string;
  name: string;
  gender: string;
  sort_order: number;
  company_id: string;
  created_at?: string;
}

/**
 * Sorts divisions using the database sort_order field
 * The sort_order is already set correctly (Girls first → Boys)
 */
export const sortDivisionsGirlsFirst = (divisions: Division[]): Division[] => {
  return [...divisions].sort((a, b) => a.sort_order - b.sort_order);
};

/**
 * Sorts an array of items by their division using the database sort_order
 */
export const sortByDivisionGirlsFirst = <T extends { division?: Division | null; divisions?: Division[] }>(
  items: T[]
): T[] => {
  return [...items].sort((a, b) => {
    const divA = a.division || a.divisions?.[0];
    const divB = b.division || b.divisions?.[0];
    
    if (!divA && !divB) return 0;
    if (!divA) return 1;
    if (!divB) return -1;
    
    return divA.sort_order - divB.sort_order;
  });
};
