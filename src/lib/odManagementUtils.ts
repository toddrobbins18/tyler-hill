export type OdGenderFilter = "all" | "girls" | "boys";

type BunkWithDivision = {
  divisions?:
    | { gender?: string | null; name?: string | null }
    | { gender?: string | null; name?: string | null }[]
    | null;
};

/** Resolve bunk gender from linked division (handles Supabase array joins + name fallback). */
export function resolveBunkDivisionGender(
  bunk: BunkWithDivision | undefined | null,
): string | null {
  if (!bunk) return null;

  const division = Array.isArray(bunk.divisions) ? bunk.divisions[0] : bunk.divisions;
  const rawGender = division?.gender?.trim();
  if (rawGender) return rawGender;

  const name = division?.name?.toLowerCase() ?? "";
  if (name.includes("girl")) return "Girls";
  if (name.includes("boy")) return "Boys";
  return null;
}

export function bunkMatchesOdGenderFilter(
  bunk: BunkWithDivision | undefined | null,
  filter: OdGenderFilter,
): boolean {
  if (filter === "all") return true;

  const g = resolveBunkDivisionGender(bunk)?.toLowerCase() ?? "";
  if (filter === "boys") {
    return g.includes("boy") || g === "male" || g === "m";
  }
  if (filter === "girls") {
    return g.includes("girl") || g === "female" || g === "f";
  }
  return true;
}

/** Girls first, then boys, then unknown/coed. */
export function odGenderSortRank(bunk: BunkWithDivision | undefined | null): number {
  const g = resolveBunkDivisionGender(bunk)?.toLowerCase() ?? "";
  if (g.includes("girl") || g === "female" || g === "f") return 0;
  if (g.includes("boy") || g === "male" || g === "m") return 1;
  return 2;
}

export function isOdGirlsBunk(bunk: BunkWithDivision | undefined | null): boolean {
  return odGenderSortRank(bunk) === 0;
}

export function sortOdRowsByGenderThenBunkNumber<T>(
  items: T[],
  getBunk: (item: T) => BunkWithDivision | undefined | null,
  getBunkNumber: (item: T) => string | number | null | undefined,
): T[] {
  return [...items].sort((a, b) => {
    const genderDiff = odGenderSortRank(getBunk(a)) - odGenderSortRank(getBunk(b));
    if (genderDiff !== 0) return genderDiff;
    return String(getBunkNumber(a) ?? "").localeCompare(String(getBunkNumber(b) ?? ""), undefined, {
      numeric: true,
    });
  });
}
