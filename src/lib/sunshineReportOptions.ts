/** North Shore Sunshine Report — tag options from Airtable (Bunnies / nursery groups). */

export type SunshineTagSeed = {
  category: "sport" | "activity" | "lunch";
  label: string;
  color: string;
  sort_order: number;
};

const COLOR_PALETTE = {
  sport: ["teal", "blue", "green", "orange", "purple"],
  activity: ["pink", "purple", "yellow", "blue", "green", "gray", "teal"],
  lunch: ["orange", "yellow", "green", "pink", "teal", "blue", "purple"],
} as const;

const SPORT_LABELS = [
  "Adventure Course",
  "Basketball",
  "Climbing Wall",
  "FAST",
  "Gymnastics",
  "Soccer",
  "Softball",
  "Swimming",
  "Tennis",
  "FUNtastic Fridays",
  "Train",
] as const;

const ACTIVITY_LABELS = [
  "Adventureland",
  "Arts + Crafts",
  "Carnival",
  "Construction Zone",
  "Cooking",
  "Dance",
  "Jumping Pillow",
  "Mansion Play",
  "Music",
  "Playground",
  "SS Village",
  "TGIM",
  "Trackless Train",
  "Triathlon Events",
  "Tug of War",
  "Turf's Up",
  "Water Relays",
  "Wonderworks",
  "Imagination play",
  "Olympics",
  "Show Club",
  "Dance party",
  "Yoga",
  "Storytime",
  "Movie",
  "Basketball",
  "Starfish huddle",
  "Fun house",
  "Water Games",
  "Glow party",
] as const;

const LUNCH_LABELS = [
  "Bagel",
  "Cereal/French Toast",
  "Chicken",
  "Fruit",
  "Grilled Cheese",
  "Hamburger",
  "Mac & Cheese",
  "Meatballs + Spaghetti",
  "Pasta",
  "Pizza",
  "Quesadilla",
  "Sandwich",
  "Stuffed Shells",
  "Yogurt",
  "Sliced Hotdog",
  "Cucumber",
  "Turkey",
  "Cheese sandwich",
  "Banana",
  "Jelly Sandwich",
  "Baked ziti",
  "Sausage",
  "Rice",
  "Starfish Buffet",
  "Hot dog",
  "Carrot",
  "Tomatoes",
  "Watermelon",
  "Pizza bagel",
  "Oranges",
  "Kosher Nuggets",
  "Kosher Burger",
  "Veggie Nuggets",
  "Veggie Burger",
  "Salami",
  "Corn",
  "Tortellini",
  "Brocolli",
  "Bread",
  "Turkey sandwich",
  "Chickpeas",
  "Boiled egg",
  "Meatballs",
  "Vegetarian Option",
  "Salad",
  "Beans",
  "Cheese",
  "Cranberry",
  "Peaches",
] as const;

function tagSeeds(
  category: SunshineTagSeed["category"],
  labels: readonly string[],
): SunshineTagSeed[] {
  const palette = COLOR_PALETTE[category];
  return labels.map((label, index) => ({
    category,
    label,
    color: palette[index % palette.length],
    sort_order: index,
  }));
}

export const NORTH_SHORE_SUNSHINE_TAG_OPTIONS: SunshineTagSeed[] = [
  ...tagSeeds("sport", SPORT_LABELS),
  ...tagSeeds("activity", ACTIVITY_LABELS),
  ...tagSeeds("lunch", LUNCH_LABELS),
];
