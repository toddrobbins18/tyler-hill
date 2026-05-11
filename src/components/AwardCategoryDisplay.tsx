import { Badge } from "@/components/ui/badge";
import { tryParseAwardCategory } from "@/lib/awardCategory";

/** Renders structured award category JSON as chips; falls back to plain text for legacy values. */
export function AwardCategoryDisplay({ category }: { category: string | null | undefined }) {
  if (category == null || category === "") return null;

  const parsed = tryParseAwardCategory(category);
  if (!parsed) {
    return (
      <Badge variant="secondary" className="mb-2">
        {category}
      </Badge>
    );
  }

  const hasAny =
    (parsed.weekly_starfish_values?.length ?? 0) > 0 ||
    Boolean(parsed.weekly_camper_award) ||
    (parsed.year_end_starfish_values?.length ?? 0) > 0;

  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {parsed.weekly_starfish_values?.map((v) => (
        <Badge key={`ws-${v}`} variant="secondary">
          Starfish: {v}
        </Badge>
      ))}
      {parsed.weekly_camper_award && <Badge variant="outline">{parsed.weekly_camper_award}</Badge>}
      {parsed.year_end_starfish_values?.map((v) => (
        <Badge key={`ye-${v}`} variant="outline">
          Year-end: {v}
        </Badge>
      ))}
    </div>
  );
}
