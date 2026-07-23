/** True when a camper/staff row has a non-empty allergy note. */
export function hasDocumentedAllergy(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function getAllergyDisplayText(value: string | null | undefined): string | null {
  if (!hasDocumentedAllergy(value)) return null;
  return value!.trim();
}
