export type LassoPoint = { lat: number; lng: number };

/** Ray-cast point-in-polygon. Closed or open rings both work. */
export function pointInPolygon(point: LassoPoint, ring: LassoPoint[]): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const intersects =
      a.lat > point.lat !== b.lat > point.lat &&
      point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function closeLassoRing(path: LassoPoint[]): LassoPoint[] {
  if (path.length < 3) return path;
  const first = path[0];
  const last = path[path.length - 1];
  if (first.lat === last.lat && first.lng === last.lng) return path;
  return [...path, first];
}

export function campersInsideLasso<T extends { lat: number; lng: number }>(
  campers: T[],
  path: LassoPoint[],
): T[] {
  const ring = closeLassoRing(path);
  if (ring.length < 4) return [];
  return campers.filter((camper) => pointInPolygon({ lat: camper.lat, lng: camper.lng }, ring));
}
