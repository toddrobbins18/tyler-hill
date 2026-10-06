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
