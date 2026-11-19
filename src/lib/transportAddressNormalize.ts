/** Normalize addresses so Ln↔Lane, Rd↔Road, etc. match for stop deduping. */
const STREET_SUFFIX_MAP: Record<string, string> = {
  st: "street", str: "street", street: "street",
  rd: "road", road: "road",
  ln: "lane", lane: "lane",
  ave: "avenue", av: "avenue", avenue: "avenue",
  blvd: "boulevard", boulevard: "boulevard",
  dr: "drive", drive: "drive",
  ct: "court", court: "court",
  pl: "place", place: "place",
  pkwy: "parkway", parkway: "parkway",
  hwy: "highway", highway: "highway",
  ter: "terrace", terr: "terrace", terrace: "terrace",
  cir: "circle", circle: "circle",
  trl: "trail", trail: "trail",
  way: "way",
  sq: "square", square: "square",
  hl: "hill", hill: "hill",
  hts: "heights", heights: "heights",
  pt: "point", point: "point",
  cv: "cove", cove: "cove",
  xing: "crossing", crossing: "crossing",
  n: "north", s: "south", e: "east", w: "west",
  north: "north", south: "south", east: "east", west: "west",
  ne: "northeast", nw: "northwest", se: "southeast", sw: "southwest",
};

const ZIP_ONLY = /^\d{5}(?:-\d{4})?$/;
const STATE_ZIP = /^(NY|New York)(?:\s+(\d{5})(?:-\d{4})?)?$/i;
const CITY_STATE_ZIP = /^(.*)\s+(NY|New York)(?:\s+(\d{5})(?:-\d{4})?)?$/i;
const TRAILING_ZIP = /^(.*)\s+(\d{5})(?:-\d{4})?$/;

/** ZIP+4 sitting in its own comma slot between street and city, e.g. "152 Plymouth Ct, 11030-1556, Manhasset, NY". */
export function isMalformedTransportGeocodeAddress(raw: string): boolean {
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.some((part, index) => index > 0 && index < parts.length - 1 && ZIP_ONLY.test(part));
}

/**
 * CampMinder sometimes stores ZIP in AddressLine2, which formats as
 * "152 Plymouth Ct, 11030-1556, Manhasset, NY 11030-1556". Geocoders then
 * drop the city and pin the house in the wrong town.
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

/** Street line only — city/state/zip must not affect dedupe keys. */
export function transportAddressStreetLine(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.split(",")[0]?.trim() || trimmed;
}

export function normalizeTransportAddress(raw: string): string {
  return transportAddressStreetLine(raw)
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((tok) => STREET_SUFFIX_MAP[tok] ?? tok)
    .join(" ");
}

const SUSPICIOUS_SUFFIXES = new Set(["ct", "court", "pl", "place"]);

const SUFFIX_ALTERNATES: Record<string, string[]> = {
  ct: ["Rd", "Dr", "Ln", "St", "Ave"],
  court: ["Rd", "Dr", "Ln", "St", "Ave"],
  pl: ["Rd", "Dr", "Ave", "St", "Ct"],
  place: ["Rd", "Dr", "Ave", "St", "Ct"],
};

function streetTokens(address: string): string[] {
  return transportAddressStreetLine(address).split(/\s+/).filter(Boolean);
}

/** CampMinder Court/Place typos (Plymouth Ct vs the real Plymouth Rd). */
export function isSuspiciousStreetSuffixAddress(raw: string): boolean {
  const tokens = streetTokens(sanitizeTransportGeocodeAddress(raw) || raw);
  const suffix = tokens[tokens.length - 1]?.toLowerCase() ?? "";
  return SUSPICIOUS_SUFFIXES.has(suffix);
}

/** Original address first, then Rd/Dr/Ln swaps for Court/Place suffixes. */
export function streetSuffixGeocodeCandidates(raw: string): string[] {
  const address = sanitizeTransportGeocodeAddress(raw) || raw.trim();
  if (!address) return [];
  if (!isSuspiciousStreetSuffixAddress(address)) return [address];

  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const tokens = streetTokens(parts[0] ?? "");
  if (tokens.length < 2) return [address];

  const suffix = tokens[tokens.length - 1]?.toLowerCase() ?? "";
  const alts = SUFFIX_ALTERNATES[suffix];
  if (!alts) return [address];

  const houseAndName = tokens.slice(0, -1).join(" ");
  const rest = parts.slice(1).join(", ");
  const out = [address];
  for (const alt of alts) {
    const street = `${houseAndName} ${alt}`;
    const next = rest ? `${street}, ${rest}` : street;
    if (!out.some((existing) => existing.toLowerCase() === next.toLowerCase())) out.push(next);
  }
  return out;
}

export function geocodeLabelMatchScore(address: string, label?: string | null): number {
  if (!label) return 2;
  const tokens = streetTokens(address);
  if (tokens.length < 2) return 0;
  const house = tokens[0]?.toLowerCase() ?? "";
  const suffix = tokens[tokens.length - 1]?.toLowerCase() ?? "";
  const base = tokens.slice(1, -1).join(" ").toLowerCase();
  const hay = label.toLowerCase();
  let score = 0;
  if (house && hay.includes(house)) score += 3;
  if (base && hay.includes(base)) score += 3;
  const suffixWord = STREET_SUFFIX_MAP[suffix] ?? suffix;
  if (suffix && (new RegExp(`\\b${suffix}\\b`).test(hay) || hay.includes(suffixWord))) score += 1;
  return score;
}

export type StreetGeocodeCandidate = {
  address: string;
  lat: number;
  lng: number;
  label?: string;
};

/** Prefer the candidate whose geocode label actually names this house and street. */
export function pickPreferredStreetGeocode(
  original: string,
  candidates: StreetGeocodeCandidate[],
): StreetGeocodeCandidate | null {
  const originalKey = streetTokens(original).join(" ").toLowerCase();
  let originalBest: { candidate: StreetGeocodeCandidate; score: number } | null = null;
  let altBest: { candidate: StreetGeocodeCandidate; score: number } | null = null;

  for (const candidate of candidates) {
    const score = geocodeLabelMatchScore(candidate.address, candidate.label);
    const isOriginal = streetTokens(candidate.address).join(" ").toLowerCase() === originalKey;
    if (isOriginal) {
      if (!originalBest || score > originalBest.score) originalBest = { candidate, score };
    } else if (!altBest || score > altBest.score) {
      altBest = { candidate, score };
    }
  }

  if (isSuspiciousStreetSuffixAddress(original) && altBest && altBest.score >= 4) {
    if (!originalBest || altBest.score >= originalBest.score) return altBest.candidate;
  }
  if (altBest && (!originalBest || altBest.score > originalBest.score)) return altBest.candidate;
  return originalBest?.candidate ?? altBest?.candidate ?? null;
}
