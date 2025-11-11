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
 * Sorts divisions with girls first, then boys, maintaining sort_order within each gender
 * Example order: Freshman Girls, Cadet Girls, Sophomore Girls, Freshman Boys, Cadet Boys, Sophomore Boys
 */
export const sortDivisionsGirlsFirst = (divisions: Division[]): Division[] => {
  return [...divisions].sort((a, b) => {
    // First sort by gender - girls (female) come before boys (male)
    const genderOrder = { female: 0, male: 1 };
    const genderA = genderOrder[a.gender.toLowerCase() as keyof typeof genderOrder] ?? 2;
    const genderB = genderOrder[b.gender.toLowerCase() as keyof typeof genderOrder] ?? 2;
    
    if (genderA !== genderB) {
      return genderA - genderB;
    }
    
    // Within same gender, sort by sort_order
    return a.sort_order - b.sort_order;
  });
};

/**
 * Sorts an array of items by their division using girls-first ordering
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
    
    // First sort by gender
    const genderOrder = { female: 0, male: 1 };
    const genderA = genderOrder[divA.gender.toLowerCase() as keyof typeof genderOrder] ?? 2;
    const genderB = genderOrder[divB.gender.toLowerCase() as keyof typeof genderOrder] ?? 2;
    
    if (genderA !== genderB) {
      return genderA - genderB;
    }
    
    // Within same gender, sort by sort_order
    return divA.sort_order - divB.sort_order;
  });
};
