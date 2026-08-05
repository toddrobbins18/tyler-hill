// Bunking auto-optimizer
// Priority: town first, then mutual requests, then single requests.
// Coed only for Nursery / Pre-K divisions; everyone else split by gender.

export type OptCamper = {
  id: string;
  name: string;
  division: string;
  town?: string;
  gender?: string;            // "Boy"/"Girl"/"M"/"F"/"Boys"/"Girls"
  requests?: string[];        // names of campers they want to bunk with
  disrequests?: string[];     // names of campers they must NOT bunk with
};

export type OptCabin = {
  id: string;
  name: string;
  capacity: number;
  gender?: string;            // "Girls" | "Boys" | "Co-ed"
  ageGroup?: string;          // division label
  campers: { id: string; name: string }[];
};

export type OptimizeOptions = {
  defaultCapacity: number;       // e.g. 8
  coedDivisions: string[];       // lowercased division names treated as coed
};

const norm = (s?: string) => (s || "").trim().toLowerCase();

function isCoedDivision(division: string, coed: string[]) {
  const d = norm(division);
  return coed.some((c) => d === c || d.includes(c));
}

function normalizeGender(g?: string): "Boys" | "Girls" | "Other" {
  const x = norm(g);
  if (!x) return "Other";
  if (x.startsWith("b") || x === "m" || x === "male") return "Boys";
  if (x.startsWith("g") || x === "f" || x === "female") return "Girls";
  return "Other";
}

function nameKey(name: string) {
  return name.trim().toLowerCase();
}

/**
 * Group campers into "buckets" that must share a cabin pool:
 *   key = `${division}__${gender|coed}`
 */
function bucketKey(c: OptCamper, opts: OptimizeOptions) {
  const coed = isCoedDivision(c.division, opts.coedDivisions);
  const gender = coed ? "coed" : normalizeGender(c.gender);
  return `${norm(c.division) || "unassigned"}__${gender}`;
}

type Cluster = {
  campers: OptCamper[];
  towns: Set<string>;
  size: number;
};

/**
 * Inside one bucket, build clusters by:
 *  1. grouping by town (largest towns first)
 *  2. merging mutual-request pairs across town boundaries when possible
 *  3. attaching single-request campers to the cluster of their requested friend
 *  4. respecting disrequests (never put two disrequested campers in same cluster)
 */
function buildClusters(campers: OptCamper[], capacity: number): Cluster[] {
  const byName = new Map<string, OptCamper>();
  campers.forEach((c) => byName.set(nameKey(c.name), c));

  // Step 1: town clusters
  const townMap = new Map<string, OptCamper[]>();
  const noTown: OptCamper[] = [];
  campers.forEach((c) => {
    const t = norm(c.town);
    if (!t) { noTown.push(c); return; }
    if (!townMap.has(t)) townMap.set(t, []);
    townMap.get(t)!.push(c);
  });

  let clusters: Cluster[] = [];
  // Largest towns first so they "claim" cabins
  const sortedTowns = [...townMap.entries()].sort((a, b) => b[1].length - a[1].length);
  sortedTowns.forEach(([town, list]) => {
    clusters.push({ campers: [...list], towns: new Set([town]), size: list.length });
  });
  noTown.forEach((c) => clusters.push({ campers: [c], towns: new Set(), size: 1 }));

  const findCluster = (camperId: string) =>
    clusters.find((cl) => cl.campers.some((c) => c.id === camperId));

  const violatesDisrequest = (a: Cluster, b: Cluster) => {
    for (const ca of a.campers) {
      const dis = (ca.disrequests || []).map(nameKey);
      if (dis.length === 0) continue;
      for (const cb of b.campers) {
        if (dis.includes(nameKey(cb.name))) return true;
      }
    }
    for (const cb of b.campers) {
      const dis = (cb.disrequests || []).map(nameKey);
      if (dis.length === 0) continue;
      for (const ca of a.campers) {
        if (dis.includes(nameKey(ca.name))) return true;
      }
    }
    return false;
  };

  const mergeClusters = (a: Cluster, b: Cluster) => {
    if (a === b) return a;
    if (a.size + b.size > capacity) return null;
    if (violatesDisrequest(a, b)) return null;
    a.campers.push(...b.campers);
    b.towns.forEach((t) => a.towns.add(t));
    a.size = a.campers.length;
    clusters = clusters.filter((c) => c !== b);
    return a;
  };

  // Step 2: mutual requests
  const mutualPairs: [OptCamper, OptCamper][] = [];
  const seenPair = new Set<string>();
  campers.forEach((c) => {
    (c.requests || []).forEach((reqName) => {
      const other = byName.get(nameKey(reqName));
      if (!other || other.id === c.id) return;
      const otherWants = (other.requests || []).map(nameKey).includes(nameKey(c.name));
      if (!otherWants) return;
      const key = [c.id, other.id].sort().join("|");
      if (seenPair.has(key)) return;
      seenPair.add(key);
      mutualPairs.push([c, other]);
    });
  });
  mutualPairs.forEach(([a, b]) => {
    const ca = findCluster(a.id);
    const cb = findCluster(b.id);
    if (!ca || !cb || ca === cb) return;
    mergeClusters(ca, cb);
  });

  // Step 3: single requests (attach the smaller cluster into the larger)
  campers.forEach((c) => {
    (c.requests || []).forEach((reqName) => {
      const other = byName.get(nameKey(reqName));
      if (!other || other.id === c.id) return;
      const ca = findCluster(c.id);
      const cb = findCluster(other.id);
      if (!ca || !cb || ca === cb) return;
      const [small, big] = ca.size <= cb.size ? [ca, cb] : [cb, ca];
      mergeClusters(big, small);
    });
  });

  return clusters;
}

/**
 * Pack clusters into cabins of `capacity`. Strict: never split a town if it fits;
 * if a single town is bigger than capacity, split it across multiple cabins
 * (still keeping town-mates adjacent).
 */
function packIntoCabins(clusters: Cluster[], capacity: number): Cluster[][] {
  const cabins: Cluster[][] = [];
  // Sort: bigger clusters first so packing is tight
  const sorted = [...clusters].sort((a, b) => b.size - a.size);

  const fits = (cabin: Cluster[], cl: Cluster) => {
    const used = cabin.reduce((s, c) => s + c.size, 0);
    return used + cl.size <= capacity;
  };

  sorted.forEach((cl) => {
    if (cl.size > capacity) {
      // Split oversized cluster
      let remaining = [...cl.campers];
      while (remaining.length) {
        const chunk = remaining.slice(0, capacity);
        remaining = remaining.slice(capacity);
        cabins.push([{ campers: chunk, towns: new Set(cl.towns), size: chunk.length }]);
      }
      return;
    }
    const target = cabins.find((cab) => fits(cab, cl));
    if (target) target.push(cl);
    else cabins.push([cl]);
  });

  return cabins;
}

export type OptimizeResult = {
  cabins: OptCabin[];
  unassigned: OptCamper[];
  notes: string[];
};

export function optimizeCabins(
  campers: OptCamper[],
  opts: OptimizeOptions,
): OptimizeResult {
  const buckets = new Map<string, OptCamper[]>();
  campers.forEach((c) => {
    const k = bucketKey(c, opts);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(c);
  });

  const cabins: OptCabin[] = [];
  const notes: string[] = [];
  let cabinIdx = 0;

  for (const [key, list] of buckets) {
    const [division, gender] = key.split("__");
    const clusters = buildClusters(list, opts.defaultCapacity);
    const packed = packIntoCabins(clusters, opts.defaultCapacity);

    const labelDiv = list[0]?.division || division;
    const labelGender =
      gender === "coed" ? "Co-ed" : gender === "Boys" ? "Boys" : gender === "Girls" ? "Girls" : "";

    packed.forEach((cabinClusters, i) => {
      cabinIdx++;
      const flat = cabinClusters.flatMap((c) => c.campers);
      cabins.push({
        id: `opt-${Date.now()}-${cabinIdx}`,
        name: `${labelDiv}${labelGender ? " " + labelGender : ""} — Cabin ${i + 1}`,
        capacity: opts.defaultCapacity,
        gender: labelGender || undefined,
        ageGroup: labelDiv,
        campers: flat.map((c) => ({ id: c.id, name: c.name })),
      });
    });
  }

  return { cabins, unassigned: [], notes };
}