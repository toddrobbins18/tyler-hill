// OpenRouteService proxy: geocoding + route optimization
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORS_KEY = Deno.env.get("OPENROUTESERVICE_API_KEY");

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface GeocodeReq { action: "geocode"; address: string; }
interface GeocodeBatchReq { action: "geocodeBatch"; addresses: string[]; concurrency?: number; }
interface OptimizeReq {
  action: "optimize";
  vehicles: { id: number; start: [number, number]; end: [number, number]; capacity?: number[] }[];
  jobs: { id: number; location: [number, number]; amount?: number[] }[];
}
interface DirectionsReq {
  action: "directions";
  // Ordered stops as [lng, lat]
  coordinates: [number, number][];
  profile?: string; // e.g. "driving-car", "driving-hgv"
  includeGeometry?: boolean;
}
type ReqBody = GeocodeReq | GeocodeBatchReq | OptimizeReq | DirectionsReq;

const FOCUS_LAT = 40.8000;
const FOCUS_LNG = -73.6500;
const LI_MIN_LON = -74.05;
const LI_MAX_LON = -71.75;
const LI_MIN_LAT = 40.53;
const LI_MAX_LAT = 41.20;

const inLongIsland = (la: number, ln: number) =>
  la >= LI_MIN_LAT && la <= LI_MAX_LAT && ln >= LI_MIN_LON && ln <= LI_MAX_LON;

type GeocodeOneResult = Record<string, unknown>;

async function geocodeOneAddress(address: string): Promise<GeocodeOneResult> {
  const params = ORS_KEY
    ? new URLSearchParams({
      api_key: ORS_KEY,
      text: address,
      "boundary.country": "US",
      "boundary.region": "NY",
      "boundary.rect.min_lon": String(LI_MIN_LON),
      "boundary.rect.min_lat": String(LI_MIN_LAT),
      "boundary.rect.max_lon": String(LI_MAX_LON),
      "boundary.rect.max_lat": String(LI_MAX_LAT),
      "focus.point.lat": String(FOCUS_LAT),
      "focus.point.lon": String(FOCUS_LNG),
      size: "1",
    })
    : null;
  const url = params
    ? `https://api.openrouteservice.org/geocode/search?${params.toString()}`
    : "";

  let lat: number | undefined;
  let lng: number | undefined;
  let label: string | undefined;
  let orsFailed = false;
  let provider: "ors" | "nominatim" | "census" | undefined;
  const rateLimitedProviders: string[] = [];

  try {
    if (ORS_KEY) {
      const r = await fetch(url);
      const txt = await r.text();
      const data = txt ? JSON.parse(txt) : {};
      if (!r.ok) {
        console.warn(`ORS geocode failed [${r.status}], falling back to Nominatim`);
        if (r.status === 403 || r.status === 429) rateLimitedProviders.push("ORS");
        orsFailed = true;
      } else {
        const feat = data.features?.[0];
        if (feat) {
          [lng, lat] = feat.geometry.coordinates;
          label = feat.properties?.label;
          provider = "ors";
        }
      }
    } else {
      orsFailed = true;
    }
  } catch (err) {
    console.warn("ORS geocode threw, falling back to Nominatim:", err);
    orsFailed = true;
  }

  if (lat === undefined || lng === undefined) {
    const nomParams = new URLSearchParams({
      q: address,
      format: "json",
      limit: "1",
      countrycodes: "us",
      viewbox: `${LI_MIN_LON},${LI_MAX_LAT},${LI_MAX_LON},${LI_MIN_LAT}`,
      bounded: "1",
    });
    const nomUrl = `https://nominatim.openstreetmap.org/search?${nomParams.toString()}`;
    try {
      const nr = await fetch(nomUrl, {
        headers: { "User-Agent": "lovable-camp-transport/1.0" },
      });
      const txt = await nr.text();
      if (!nr.ok) {
        if (nr.status === 403 || nr.status === 429) {
          rateLimitedProviders.push("Nominatim");
          console.warn(`Nominatim geocode rate limited [${nr.status}], trying Census`);
          // Fall through to Census instead of failing immediately.
        } else {
          console.warn(`Nominatim geocode failed [${nr.status}]: ${txt.slice(0, 300)}`);
        }
      } else {
        const arr = txt ? JSON.parse(txt) : [];
        const hit = Array.isArray(arr) ? arr[0] : null;
        if (hit) {
          lat = parseFloat(hit.lat);
          lng = parseFloat(hit.lon);
          label = hit.display_name;
          provider = "nominatim";
        }
      }
    } catch (err) {
      console.warn("Nominatim geocode threw:", err);
    }
  }

  if (lat === undefined || lng === undefined) {
    try {
      const censusParams = new URLSearchParams({
        address,
        benchmark: "Public_AR_Current",
        format: "json",
      });
      const censusUrl = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${censusParams.toString()}`;
      const cr = await fetch(censusUrl);
      if (cr.ok) {
        const cj = await cr.json();
        const match = cj?.result?.addressMatches?.[0];
        if (match?.coordinates && inLongIsland(match.coordinates.y, match.coordinates.x)) {
          lng = match.coordinates.x;
          lat = match.coordinates.y;
          label = match.matchedAddress;
          provider = "census";
        }
      } else {
        console.warn(`Census geocode failed [${cr.status}]`);
      }
    } catch (err) {
      console.warn("Census geocode threw:", err);
    }
  }

  if (lat === undefined || lng === undefined) {
    if (rateLimitedProviders.length > 0) {
      return {
        found: false,
        error: "GEOCODING_RATE_LIMITED",
        message: "Geocoding providers are temporarily rate-limited. Please retry the import shortly.",
        providers: rateLimitedProviders,
        retryable: true,
        fallback: true,
      };
    }
    return { found: false };
  }

  if (!inLongIsland(lat, lng)) {
    console.warn(`Geocode result outside Long Island for "${address}": ${lat},${lng}`);
    return {
      found: false,
      error: "GEOCODE_OUT_OF_AREA",
      message: `Best match "${label ?? "unknown"}" is outside Long Island — please verify the address.`,
    };
  }

  return {
    found: true,
    lat,
    lng,
    label,
    provider: provider || (orsFailed ? "nominatim" : "ors"),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as ReqBody;

    if (body.action === "geocode") {
      if (!body.address || typeof body.address !== "string") {
        return new Response(JSON.stringify({ error: "address required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await geocodeOneAddress(body.address);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "geocodeBatch") {
      if (!Array.isArray(body.addresses) || body.addresses.length === 0) {
        return jsonResponse({ error: "addresses required" }, 400);
      }
      if (body.addresses.length > 50) {
        return jsonResponse({ error: "max 50 addresses per batch" }, 400);
      }
      const concurrency = ORS_KEY
        ? Math.min(Math.max(body.concurrency ?? 5, 1), 8)
        : 1;
      const results: GeocodeOneResult[] = new Array(body.addresses.length);
      let cursor = 0;
      const workers = Array.from({ length: Math.min(concurrency, body.addresses.length) }, async () => {
        while (true) {
          const i = cursor++;
          if (i >= body.addresses.length) return;
          const addr = body.addresses[i];
          if (typeof addr !== "string" || !addr.trim()) {
            results[i] = { found: false };
            continue;
          }
          results[i] = await geocodeOneAddress(addr.trim());
          if (!ORS_KEY) await new Promise((r) => setTimeout(r, 1100));
        }
      });
      await Promise.all(workers);
      return jsonResponse({ results });
    }

    if (body.action === "optimize") {
      if (!Array.isArray(body.vehicles) || !Array.isArray(body.jobs)) {
        return new Response(JSON.stringify({ error: "vehicles and jobs required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Local optimizer tuned for school/camp buses:
      // 1) use only as many buses as capacity requires,
      // 2) build compact geographic clusters before ordering stops,
      // 3) order each route as an open AM pickup path ending at camp.
      const MAX_JOBS_PER_CALL = 65;
      const vehicles = body.vehicles.map((v: any) => ({ profile: "driving-car", ...v }));
      const jobs = body.jobs;

      const capacities = vehicles.map((v: any) =>
        Array.isArray(v.capacity) && v.capacity.length ? v.capacity[0] : Number.MAX_SAFE_INTEGER
      );

      const jobsPerVehicle: typeof jobs[] = vehicles.map(() => []);
      const unassignedJobs: typeof jobs = [];

      // Haversine distance in km between [lng, lat] points
      const haversineKm = (a: [number, number], b: [number, number]) => {
        const R = 6371;
        const toRad = (x: number) => (x * Math.PI) / 180;
        const dLat = toRad(b[1] - a[1]);
        const dLng = toRad(b[0] - a[0]);
        const lat1 = toRad(a[1]);
        const lat2 = toRad(b[1]);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
      };

      // Tour total distance: start -> stops -> end
      const tourLen = (start: [number, number], end: [number, number], pts: [number, number][]) => {
        if (pts.length === 0) return haversineKm(start, end);
        let s = haversineKm(start, pts[0]);
        for (let i = 0; i < pts.length - 1; i++) s += haversineKm(pts[i], pts[i + 1]);
        s += haversineKm(pts[pts.length - 1], end);
        return s;
      };

      // 2-opt local search: repeatedly reverse subsequences if it shortens the tour.
      // This eliminates route crossings (zig-zags) that ORS may leave behind.
      const twoOpt = (
        order: number[],
        coords: [number, number][],
        start: [number, number],
        end: [number, number],
      ) => {
        const n = order.length;
        if (n < 3) return order;
        const pts = (ord: number[]) => ord.map((idx) => coords[idx]);
        let best = [...order];
        let bestLen = tourLen(start, end, pts(best));
        let improved = true;
        let guard = 0;
        while (improved && guard < 15) {
          improved = false;
          guard++;
          for (let i = 0; i < n - 1; i++) {
            for (let j = i + 1; j < n; j++) {
              const candidate = [
                ...best.slice(0, i),
                ...best.slice(i, j + 1).reverse(),
                ...best.slice(j + 1),
              ];
              const len = tourLen(start, end, pts(candidate));
              if (len + 1e-9 < bestLen) {
                best = candidate;
                bestLen = len;
                improved = true;
              }
            }
          }
        }
        return best;
      };

      const jobNeed = (job: typeof jobs[number]) =>
        Array.isArray(job.amount) && job.amount.length ? Math.max(1, job.amount[0]) : 1;

      const depot = (vehicles[0]?.end || vehicles[0]?.start || [-72.209, 40.954]) as [number, number];

      if (vehicles.length === 1) {
        let remainingSeats = capacities[0];
        let remainingStops = MAX_JOBS_PER_CALL;
        for (const job of jobs) {
          const need = jobNeed(job);
          if (remainingSeats >= need && remainingStops > 0) {
            jobsPerVehicle[0].push(job);
            remainingSeats -= need;
            remainingStops--;
          } else {
            unassignedJobs.push(job);
          }
        }
      } else if (jobs.length > 0) {
        // Spread across as many buses as possible to minimize per-route time.
        // Use every available vehicle, but never more buses than there are jobs.
        const activeVehicleIndexes: number[] = [];
        for (let i = 0; i < vehicles.length; i++) {
          if (capacities[i] <= 0) continue;
          activeVehicleIndexes.push(i);
        }
        // Cap clusters at jobs.length so we don't create empty buses
        if (activeVehicleIndexes.length > jobs.length) {
          activeVehicleIndexes.length = jobs.length;
        }

        if (activeVehicleIndexes.length === 0) {
          unassignedJobs.push(...jobs);
        } else {
          const kmPerLng = 111.32 * Math.cos((depot[1] * Math.PI) / 180);
          const toXY = (location: [number, number]) => [
            (location[0] - depot[0]) * kmPerLng,
            (location[1] - depot[1]) * 111.32,
          ] as [number, number];
          const distSq = (a: [number, number], b: [number, number]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
          const weightedJobs = jobs.map((job) => {
            const xy = toXY(job.location as [number, number]);
            return { job, xy, need: jobNeed(job), depotKm: Math.sqrt(distSq(xy, [0, 0])) };
          });
          const itemById = new Map<any, typeof weightedJobs[number]>();
          for (const w of weightedJobs) itemById.set(w.job.id, w);

          const seedJobs = [...weightedJobs].sort((a, b) => b.depotKm - a.depotKm);
          const centers: [number, number][] = seedJobs.length ? [[...seedJobs[0].xy] as [number, number]] : [[0, 0]];
          while (centers.length < activeVehicleIndexes.length) {
            let best = seedJobs[0];
            let bestScore = -1;
            for (const candidate of seedJobs) {
              const nearestSeed = Math.min(...centers.map((center) => distSq(candidate.xy, center)));
              const score = nearestSeed + candidate.depotKm * 0.15;
              if (score > bestScore) {
                best = candidate;
                bestScore = score;
              }
            }
            centers.push(best ? ([...best.xy] as [number, number]) : [0, 0]);
          }

          // Soft cap on cluster size to keep routes short and balanced across buses
          const idealPerBus = Math.ceil(jobs.length / activeVehicleIndexes.length);
          const softMax = Math.max(2, idealPerBus + 1);

          let clusterJobs: typeof jobs[] = activeVehicleIndexes.map(() => []);
          let overflow: typeof jobs = [];
          for (let iter = 0; iter < 6; iter++) {
            clusterJobs = activeVehicleIndexes.map(() => []);
            overflow = [];
            const remainingSeats = activeVehicleIndexes.map((vehicleIdx) => capacities[vehicleIdx]);
            const remainingStops = activeVehicleIndexes.map(() =>
              Math.min(MAX_JOBS_PER_CALL, softMax)
            );
            const assignmentOrder = weightedJobs
              .map((item) => {
                const distances = centers.map((center, idx) => ({ idx, d: distSq(item.xy, center) })).sort((a, b) => a.d - b.d);
                return { item, margin: (distances[1]?.d ?? distances[0]?.d ?? 0) - (distances[0]?.d ?? 0), nearest: distances[0]?.d ?? 0 };
              })
              .sort((a, b) => b.margin - a.margin || b.item.depotKm - a.item.depotKm || a.nearest - b.nearest);

            for (const { item } of assignmentOrder) {
              const rankedClusters = centers
                .map((center, idx) => ({ idx, d: distSq(item.xy, center) }))
                .sort((a, b) => a.d - b.d);
              const slot = rankedClusters.find(({ idx }) => remainingSeats[idx] >= item.need && remainingStops[idx] > 0);
              if (!slot) {
                // Fallback: ignore soft size cap so every job still gets placed on its nearest bus
                const relaxed = rankedClusters.find(({ idx }) => remainingSeats[idx] >= item.need);
                if (!relaxed) {
                  overflow.push(item.job);
                  continue;
                }
                clusterJobs[relaxed.idx].push(item.job);
                remainingSeats[relaxed.idx] -= item.need;
                continue;
              }
              clusterJobs[slot.idx].push(item.job);
              remainingSeats[slot.idx] -= item.need;
              remainingStops[slot.idx]--;
            }

            for (let c = 0; c < clusterJobs.length; c++) {
              if (clusterJobs[c].length === 0) continue;
              let sx = 0;
              let sy = 0;
              let weight = 0;
              for (const job of clusterJobs[c]) {
                const item = itemById.get(job.id);
                if (!item) continue;
                sx += item.xy[0] * item.need;
                sy += item.xy[1] * item.need;
                weight += item.need;
              }
              if (weight > 0) centers[c] = [sx / weight, sy / weight];
            }
          }

          // ============================================================
          // Territory refinement: swap jobs between clusters if it reduces
          // total intra-cluster spread. This eliminates the case where two
          // buses interleave through the same neighborhood — each bus ends
          // up with a tight, contiguous blob (its own "territory").
          // ============================================================
          const xyOf = (job: typeof jobs[number]) => {
            const item = itemById.get(job.id);
            return item ? item.xy : toXY(job.location as [number, number]);
          };
          const centroidOf = (cluster: typeof jobs) => {
            if (cluster.length === 0) return [0, 0] as [number, number];
            let sx = 0, sy = 0, w = 0;
            for (const j of cluster) {
              const item = itemById.get(j.id);
              const need = item?.need ?? 1;
              const xy = item?.xy ?? toXY(j.location as [number, number]);
              sx += xy[0] * need; sy += xy[1] * need; w += need;
            }
            return [sx / w, sy / w] as [number, number];
          };
          const spreadOf = (cluster: typeof jobs, center: [number, number]) => {
            let s = 0;
            for (const j of cluster) s += distSq(xyOf(j), center);
            return s;
          };

          let centroids = clusterJobs.map(centroidOf);
          let spreads = clusterJobs.map((c, i) => spreadOf(c, centroids[i]));

          // Greedy pairwise swap refinement
          let swapImproved = true;
          let swapGuard = 0;
          while (swapImproved && swapGuard < 5) {
            swapImproved = false;
            swapGuard++;
            const clusterUsed = clusterJobs.map((c) => c.reduce((s, j) => s + (itemById.get(j.id)?.need ?? 1), 0));
            for (let a = 0; a < clusterJobs.length; a++) {
              for (let b = a + 1; b < clusterJobs.length; b++) {
                if (clusterJobs[a].length === 0 || clusterJobs[b].length === 0) continue;
                let bestGain = 1e-9;
                let bestSwap: { ia: number; ib: number; ca: [number, number]; cb: [number, number]; sa: number; sb: number } | null = null;
                for (let ia = 0; ia < clusterJobs[a].length; ia++) {
                  for (let ib = 0; ib < clusterJobs[b].length; ib++) {
                    const ja = clusterJobs[a][ia];
                    const jb = clusterJobs[b][ib];
                    const itemA = itemById.get(ja.id);
                    const itemB = itemById.get(jb.id);
                    if (!itemA || !itemB) continue;
                    // Capacity check after swap (using cached cluster sums)
                    const remainA = capacities[activeVehicleIndexes[a]] - clusterUsed[a] + itemA.need - itemB.need;
                    const remainB = capacities[activeVehicleIndexes[b]] - clusterUsed[b] + itemB.need - itemA.need;
                    if (remainA < 0 || remainB < 0) continue;
                    // Tentative new clusters
                    const newA = [...clusterJobs[a]]; newA[ia] = jb;
                    const newB = [...clusterJobs[b]]; newB[ib] = ja;
                    const ca = centroidOf(newA);
                    const cb = centroidOf(newB);
                    const sa = spreadOf(newA, ca);
                    const sb = spreadOf(newB, cb);
                    const gain = (spreads[a] + spreads[b]) - (sa + sb);
                    if (gain > bestGain) {
                      bestGain = gain;
                      bestSwap = { ia, ib, ca, cb, sa, sb };
                    }
                  }
                }
                if (bestSwap) {
                  const ja = clusterJobs[a][bestSwap.ia];
                  const jb = clusterJobs[b][bestSwap.ib];
                  clusterJobs[a][bestSwap.ia] = jb;
                  clusterJobs[b][bestSwap.ib] = ja;
                  centroids[a] = bestSwap.ca; centroids[b] = bestSwap.cb;
                  spreads[a] = bestSwap.sa; spreads[b] = bestSwap.sb;
                  const itemAneed = itemById.get(jb.id)?.need ?? 1;
                  const itemBneed = itemById.get(ja.id)?.need ?? 1;
                  clusterUsed[a] += itemAneed - itemBneed;
                  clusterUsed[b] += itemBneed - itemAneed;
                  swapImproved = true;
                }
              }
            }
          }

          // Single-job moves (handles unequal-size territory cleanup)
          let moveImproved = true;
          let moveGuard = 0;
          while (moveImproved && moveGuard < 5) {
            moveImproved = false;
            moveGuard++;
            for (let from = 0; from < clusterJobs.length; from++) {
              if (clusterJobs[from].length <= 1) continue;
              for (let i = 0; i < clusterJobs[from].length; i++) {
                const j = clusterJobs[from][i];
                const item = itemById.get(j.id);
                if (!item) continue;
                let bestGain = 1e-9;
                let bestTo = -1;
                let bestNewFrom: [number, number] = centroids[from];
                let bestNewTo: [number, number] = [0, 0];
                let bestSpreadFrom = 0, bestSpreadTo = 0;
                for (let to = 0; to < clusterJobs.length; to++) {
                  if (to === from) continue;
                  const usedTo = clusterJobs[to].reduce((s, jj) => s + (itemById.get(jj.id)?.need ?? 1), 0);
                  if (capacities[activeVehicleIndexes[to]] - usedTo < item.need) continue;
                  const newFrom = clusterJobs[from].filter((_, idx) => idx !== i);
                  const newTo = [...clusterJobs[to], j];
                  const cf = centroidOf(newFrom);
                  const ct = centroidOf(newTo);
                  const sf = spreadOf(newFrom, cf);
                  const st = spreadOf(newTo, ct);
                  const gain = (spreads[from] + spreads[to]) - (sf + st);
                  if (gain > bestGain) {
                    bestGain = gain; bestTo = to;
                    bestNewFrom = cf; bestNewTo = ct;
                    bestSpreadFrom = sf; bestSpreadTo = st;
                  }
                }
                if (bestTo >= 0) {
                  clusterJobs[bestTo].push(j);
                  clusterJobs[from].splice(i, 1);
                  centroids[from] = bestNewFrom; centroids[bestTo] = bestNewTo;
                  spreads[from] = bestSpreadFrom; spreads[bestTo] = bestSpreadTo;
                  moveImproved = true;
                  break;
                }
              }
              if (moveImproved) break;
            }
          }

          clusterJobs.forEach((cluster, clusterIdx) => {
            const vehicleIdx = activeVehicleIndexes[clusterIdx];
            jobsPerVehicle[vehicleIdx].push(...cluster);
          });
          unassignedJobs.push(...overflow);
        }
      }

      const openPathLen = (ord: number[], coords: [number, number][], end: [number, number]) => {
        if (ord.length === 0) return 0;
        let total = 0;
        for (let i = 0; i < ord.length - 1; i++) total += haversineKm(coords[ord[i]], coords[ord[i + 1]]);
        total += haversineKm(coords[ord[ord.length - 1]], end);
        return total;
      };

      const orderToDepot = (batchJobs: typeof jobs) => {
        if (batchJobs.length <= 1) return [...batchJobs];
        const coords = batchJobs.map((j) => j.location as [number, number]);
        const remaining = coords.map((_, idx) => idx);
        let current = remaining.reduce((best, idx) => haversineKm(coords[idx], depot) > haversineKm(coords[best], depot) ? idx : best, remaining[0]);
        const order = [current];
        remaining.splice(remaining.indexOf(current), 1);
        while (remaining.length) {
          const currentDepotDistance = haversineKm(coords[current], depot);
          let bestPos = 0;
          let bestScore = Infinity;
          for (let i = 0; i < remaining.length; i++) {
            const idx = remaining[i];
            const depotDistance = haversineKm(coords[idx], depot);
            const awayPenalty = Math.max(0, depotDistance - currentDepotDistance) * 2.5;
            const score = haversineKm(coords[current], coords[idx]) + awayPenalty + depotDistance * 0.08;
            if (score < bestScore) {
              bestScore = score;
              bestPos = i;
            }
          }
          current = remaining.splice(bestPos, 1)[0];
          order.push(current);
        }

        let best = [...order];
        let bestLen = openPathLen(best, coords, depot);
        let improved = true;
        let guard = 0;
        while (improved && guard < 20) {
          improved = false;
          guard++;
          for (let i = 0; i < best.length - 1; i++) {
            for (let j = i + 1; j < best.length; j++) {
              const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
              const len = openPathLen(candidate, coords, depot);
              if (len + 1e-9 < bestLen) {
                best = candidate;
                bestLen = len;
                improved = true;
              }
            }
          }
        }
        return best.map((idx) => batchJobs[idx]);
      };

      const merged: any = {
        code: 0,
        summary: { cost: 0, unassigned: unassignedJobs.length, service: 0, duration: 0, waiting_time: 0, distance: 0 },
        unassigned: unassignedJobs.map((j) => ({ id: j.id, location: j.location })),
        routes: [],
      };

      for (let i = 0; i < vehicles.length; i++) {
        const orderedJobs = orderToDepot(jobsPerVehicle[i]);
        if (orderedJobs.length === 0) continue;
        const distanceKm = tourLen(orderedJobs[0].location as [number, number], vehicles[i].end as [number, number], orderedJobs.slice(1).map((j) => j.location as [number, number]));
        merged.summary.distance += distanceKm * 1000;
        merged.summary.cost += distanceKm * 1000;
        merged.routes.push({
          vehicle: vehicles[i].id,
          cost: distanceKm * 1000,
          distance: distanceKm * 1000,
          steps: [
            { type: "start", location: orderedJobs[0].location },
            ...orderedJobs.map((job) => ({ type: "job", id: job.id, job: job.id, location: job.location })),
            { type: "end", location: vehicles[i].end },
          ],
        });
      }

      return new Response(JSON.stringify(merged), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "directions") {
      if (!ORS_KEY) {
        return jsonResponse({
          totalDistanceMi: 0,
          totalDurationSec: 0,
          steps: [],
          geometry: body.includeGeometry === true ? [] : undefined,
          warning: "OPENROUTESERVICE_API_KEY is not configured — turn-by-turn directions unavailable.",
        });
      }
      if (!Array.isArray(body.coordinates) || body.coordinates.length < 2) {
        return new Response(JSON.stringify({ error: "at least 2 coordinates required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const profile = body.profile || "driving-car";
      const format = body.includeGeometry === true ? "geojson" : "json";

      const callOrs = async (coords: [number, number][]) => {
        const r = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/${format}`, {
          method: "POST",
          headers: { "Authorization": ORS_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            coordinates: coords,
            instructions: true,
            geometry: body.includeGeometry === true,
            units: "mi",
            language: "en",
          }),
        });
        const data = await r.json();
        return { ok: r.ok, status: r.status, data };
      };

      let coords = body.coordinates as [number, number][];
      let result = await callOrs(coords);

      // Retry loop handling both rate-limits (429) and unroutable coords (404).
      let retries = 0;
      while (!result.ok && retries < 6) {
        if (result.status === 429) {
          // Exponential backoff for rate limit
          const wait = 800 * Math.pow(2, retries);
          console.warn(`ORS rate-limited, backing off ${wait}ms`);
          await new Promise((r) => setTimeout(r, wait));
          result = await callOrs(coords);
          retries++;
          continue;
        }
        if (result.status === 404 && coords.length > 2) {
          const msg = JSON.stringify(result.data);
          const match = msg.match(/coordinate (\d+):/);
          if (!match) break;
          const badIdx = parseInt(match[1], 10);
          if (isNaN(badIdx) || badIdx < 0 || badIdx >= coords.length) break;
          console.warn(`ORS: dropping unroutable coordinate index ${badIdx}`);
          coords = coords.filter((_, i) => i !== badIdx);
          result = await callOrs(coords);
          retries++;
          continue;
        }
        break;
      }

      if (!result.ok) {
        // Graceful fallback: return empty geometry so the map omits the route line
        // instead of drawing misleading straight segments across water.
        console.error(`ORS directions failed [${result.status}] after ${retries} retries:`, JSON.stringify(result.data));
        return new Response(JSON.stringify({
          totalDistanceMi: 0,
          totalDurationSec: 0,
          steps: [],
          geometry: body.includeGeometry === true ? [] : undefined,
          warning: `ORS unavailable (${result.status}) — route line hidden until road geometry is available.`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = result.data;
      const route = data.routes?.[0] || data.features?.[0]?.properties;
      const geometry = data.features?.[0]?.geometry?.coordinates?.map(([lng, lat]: [number, number]) => [lat, lng]) ?? [];
      const segments = route?.segments || [];
      const steps = segments.flatMap((seg: any, segIdx: number) =>
        (seg.steps || []).map((s: any) => ({
          instruction: s.instruction,
          name: s.name,
          distanceMi: s.distance,
          durationSec: s.duration,
          type: s.type,
          segmentIndex: segIdx,
        }))
      );
      return new Response(JSON.stringify({
        totalDistanceMi: route?.summary?.distance ?? 0,
        totalDurationSec: route?.summary?.duration ?? 0,
        steps,
        geometry: body.includeGeometry === true ? geometry : undefined,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("route-optimizer error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
