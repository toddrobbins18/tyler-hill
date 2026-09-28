/** North Shore Sunshine Report — tag options from Airtable export (Sep 2026). */

export type SunshineTagSeed = {
  category: "sport" | "activity" | "lunch";
  label: string;
  color: string;
  sort_order: number;
};

export const NORTH_SHORE_SUNSHINE_TAG_OPTIONS: SunshineTagSeed[] = [
  { category: "sport", label: "Swimming", color: "teal", sort_order: 0 },
  { category: "sport", label: "Soccer", color: "blue", sort_order: 1 },
  { category: "activity", label: "Arts + Crafts", color: "pink", sort_order: 0 },
  { category: "activity", label: "Glow party", color: "purple", sort_order: 1 },
  { category: "lunch", label: "Pizza", color: "orange", sort_order: 0 },
  { category: "lunch", label: "Pasta", color: "yellow", sort_order: 1 },
  { category: "lunch", label: "Fruit", color: "green", sort_order: 2 },
  { category: "lunch", label: "Jelly Sandwich", color: "pink", sort_order: 3 },
];
