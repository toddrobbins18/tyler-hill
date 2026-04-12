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
 * Sorts divisions in alternating gender order by level.
 * e.g., Freshmen A Girls, Freshmen A Boys, Freshmen B Girls, Freshmen B Boys, Cadet Girls, Cadet Boys...
 * Groups by base name (without gender suffix), then alternates Girls/Boys within each group.
 */
export const sortDivisionsAlternatingGender = (divisions: Division[]): Division[] => {
  // Extract base name by removing " Girls" or " Boys" suffix
  const getBaseName = (name: string): string => {
    return name.replace(/\s+(Girls|Boys)$/i, '').trim();
  };

  // Group divisions by base name, preserving order from sort_order
  const sorted = [...divisions].sort((a, b) => a.sort_order - b.sort_order);
  const baseNameOrder: string[] = [];
  const groups: Record<string, Division[]> = {};

  for (const div of sorted) {
    const base = getBaseName(div.name);
    if (!groups[base]) {
      groups[base] = [];
      baseNameOrder.push(base);
    }
    groups[base].push(div);
  }

  // Within each group, sort Girls first then Boys
  const result: Division[] = [];
  for (const base of baseNameOrder) {
    const group = groups[base];
    // Sort: Girls before Boys within each group
    group.sort((a, b) => {
      const aIsGirls = a.gender.toLowerCase() === 'girls' || a.name.toLowerCase().includes('girls');
      const bIsGirls = b.gender.toLowerCase() === 'girls' || b.name.toLowerCase().includes('girls');
      if (aIsGirls && !bIsGirls) return -1;
      if (!aIsGirls && bIsGirls) return 1;
      return 0;
    });
    result.push(...group);
  }

  return result;
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
