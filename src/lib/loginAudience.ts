export type LoginAudience = "parent" | "staff";

/** Public thenest.com login is staff first. Parents opt in with role=parent. */
export function loginAudienceFromSearch(search: URLSearchParams): LoginAudience {
  if (search.get("company_id") || search.get("email")) return "staff";
  if (search.get("role") === "parent") return "parent";
  return "staff";
}
