/** Prefix scanned from printed staff QR badges. */
export const STAFF_QR_PREFIX = "NEST-STAFF-";

export function staffQrPayload(token: string): string {
  return `${STAFF_QR_PREFIX}${token.trim()}`;
}

export function parseStaffQrPayload(raw: string): string | null {
  const normalized = raw.trim();
  if (!normalized.toUpperCase().startsWith(STAFF_QR_PREFIX)) return null;
  const token = normalized.slice(STAFF_QR_PREFIX.length).trim();
  return token || null;
}
