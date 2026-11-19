const ZIP_ONLY = /^\d{5}(?:-\d{4})?$/;
const STATE_ZIP = /^(NY|New York)(?:\s+(\d{5})(?:-\d{4})?)?$/i;
const CITY_STATE_ZIP = /^(.*)\s+(NY|New York)(?:\s+(\d{5})(?:-\d{4})?)?$/i;
const TRAILING_ZIP = /^(.*)\s+(\d{5})(?:-\d{4})?$/;

/** ZIP+4 sitting in its own comma slot between street and city. */
export function isMalformedTransportGeocodeAddress(raw: string): boolean {
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.some((part, index) => index > 0 && index < parts.length - 1 && ZIP_ONLY.test(part));
}

/**
 * CampMinder sometimes stores ZIP in AddressLine2, which formats as
 * "152 Plymouth Ct, 11030-1556, Manhasset, NY 11030-1556".
 */
export function sanitizeTransportGeocodeAddress(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return "";

  const street = parts[0];
  if (parts.length === 1) return street;

  const locality: string[] = [];
  let state = "";
  let zip = "";

  for (const part of parts.slice(1)) {
    if (ZIP_ONLY.test(part)) {
      zip = part.slice(0, 5);
      continue;
    }

    const stateZip = part.match(STATE_ZIP);
    if (stateZip) {
      state = "NY";
      if (stateZip[2]) zip = stateZip[2];
      continue;
    }

    const cityStateZip = part.match(CITY_STATE_ZIP);
    if (cityStateZip?.[1]?.trim()) {
      locality.push(cityStateZip[1].trim());
      state = "NY";
      if (cityStateZip[3]) zip = cityStateZip[3];
      continue;
    }

    const trailingZip = part.match(TRAILING_ZIP);
    if (trailingZip?.[1]?.trim() && !ZIP_ONLY.test(trailingZip[1].trim())) {
      locality.push(trailingZip[1].trim());
      zip = trailingZip[2];
      continue;
    }

    locality.push(part);
  }

  const tail = [state, zip].filter(Boolean).join(" ");
  return [street, ...locality, tail].filter(Boolean).join(", ");
}
