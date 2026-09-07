#!/usr/bin/env python3
"""Export geocode cache from transport_boards via supabase db query output."""
import json
import subprocess
import sys

SQL = """
SELECT stop->>'address' AS address,
       (stop->>'lat')::float AS lat,
       (stop->>'lng')::float AS lng
FROM transport_boards t,
  jsonb_each(t.data->'coreStops') e,
  jsonb_array_elements(e.value) stop
WHERE t.company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
  AND t.season = '2027'
  AND stop->>'lat' IS NOT NULL
  AND trim(coalesce(stop->>'address', '')) <> '';
"""

def main():
    out_path = "data/north_shore_mappoint_geocodes_2026.json"
    proc = subprocess.run(
        ["npx", "supabase", "db", "query", "--linked", SQL],
        capture_output=True,
        text=True,
        cwd=".",
    )
    text = proc.stdout
    start = text.find('{"boundary"')
    if start < 0:
        print(proc.stderr or proc.stdout, file=sys.stderr)
        sys.exit(1)
    payload = json.loads(text[start:])
    rows = payload.get("rows") or []
    geocodes = {}
    for row in rows:
        addr = (row.get("address") or "").strip().lower()
        lat, lng = row.get("lat"), row.get("lng")
        if addr and lat is not None and lng is not None:
            geocodes[addr] = {"lat": lat, "lng": lng, "provider": "ors"}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(geocodes, f, separators=(",", ":"))
    print(f"Wrote {len(geocodes)} geocodes → {out_path}")

if __name__ == "__main__":
    main()
