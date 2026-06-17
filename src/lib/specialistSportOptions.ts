import { isTylerHillCamp } from "@/lib/camps";

export const BASE_SPECIALIST_SPORTS = [
  "Baseball",
  "Basketball",
  "Dance",
  "Football",
  "Golf",
  "Gymnastics",
  "Hockey",
  "Lacrosse",
  "Soccer",
  "Softball",
  "Tennis",
  "Volleyball",
  "Waterfront",
] as const;

/** Tyler Hill–only specialist departments (in addition to sports). */
export const TYLER_HILL_SPECIALIST_DEPARTMENTS = [
  "Arts and Crafts",
  "Ceramics",
  "Cheerleading",
  "Climbing Wall",
  "Cooking",
  "Social Hall Electives",
  "Fishing",
  "Media",
  "Podcasting",
  "Theatre",
] as const;

export function getAvailableSpecialistSports(companySlug?: string | null): string[] {
  if (isTylerHillCamp(companySlug)) {
    return [...BASE_SPECIALIST_SPORTS, ...TYLER_HILL_SPECIALIST_DEPARTMENTS];
  }
  return [...BASE_SPECIALIST_SPORTS];
}
