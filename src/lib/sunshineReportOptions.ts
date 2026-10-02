/** North Shore Sunshine Report — tag options from Airtable (Giraffes / nursery groups). */

export type SunshineTagSeed = {
  category: "sport" | "activity" | "lunch";
  label: string;
  color: string;
  sort_order: number;
};

export const NORTH_SHORE_SUNSHINE_TAG_OPTIONS: SunshineTagSeed[] = [
  { category: "sport", label: "Swimming", color: "teal", sort_order: 0 },

  { category: "activity", label: "Glow party", color: "gray", sort_order: 0 },
  { category: "activity", label: "Starfish huddle", color: "teal", sort_order: 1 },
  { category: "activity", label: "Yoga", color: "blue", sort_order: 2 },
  { category: "activity", label: "Turf's Up", color: "purple", sort_order: 3 },
  { category: "activity", label: "Cooking", color: "pink", sort_order: 4 },

  { category: "lunch", label: "Pasta", color: "pink", sort_order: 0 },
  { category: "lunch", label: "Pizza", color: "purple", sort_order: 1 },
  { category: "lunch", label: "Cucumber", color: "orange", sort_order: 2 },
  { category: "lunch", label: "Bagel", color: "blue", sort_order: 3 },
  { category: "lunch", label: "Jelly Sand", color: "yellow", sort_order: 4 },
];
