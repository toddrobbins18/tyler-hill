#!/usr/bin/env python3
"""Geocode MapPoint AM addresses and write bundled JSON for instant import."""
import csv
import json
import os
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "data", "north_shore_mappoint_routes_2026.csv")
OUT_PATH = os.path.join(ROOT, "data", "north_shore_mappoint_geocodes_2026.json")

URL = os.environ.get("VITE_SUPABASE_URL", "https://qjbkvnzeejbqxbcbskdu.supabase.co")
KEY = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY", "")


def row_address(row: dict) -> str:
    trimmed = (row.get("address") or "").strip()
    if trimmed:
        return trimmed
    street = (row.get("street") or "").strip()
    city = (row.get("city") or "").strip()
    zip_code = (row.get("zip") or "").strip()
    if not street or not city:
        return ""
    return f"{street}, {city}, NY {zip_code}" if zip_code else f"{street}, {city}, NY"


def geocode_batch(addresses: list[str]) -> list[dict]:
    body = json.dumps({"action": "geocodeBatch", "addresses": addresses, "concurrency": 4}).encode()
    req = urllib.request.Request(
        f"{URL}/functions/v1/route-optimizer",
        data=body,
        headers={
            "Authorization": f"Bearer {KEY}",
            "apikey": KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode())
    return data.get("results") or []


def main():
    if not KEY:
        raise SystemExit("Set VITE_SUPABASE_PUBLISHABLE_KEY")

    addresses: list[str] = []
    seen: set[str] = set()
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if (row.get("direction") or "AM").upper() != "AM":
                continue
            addr = row_address(row)
            if not addr:
                continue
            key = addr.strip().lower()
            if key not in seen:
                seen.add(key)
                addresses.append(addr)

    print(f"Geocoding {len(addresses)} addresses…")
    out: dict[str, dict] = {}
    chunk = 40
    for i in range(0, len(addresses), chunk):
        batch = addresses[i : i + chunk]
        results = geocode_batch(batch)
        for addr, r in zip(batch, results):
            if r.get("found") and "lat" in r and "lng" in r:
                out[addr.strip().lower()] = {
                    "lat": r["lat"],
                    "lng": r["lng"],
                    "provider": r.get("provider", "ors"),
                }
        print(f"  {min(i + chunk, len(addresses))}/{len(addresses)} ({len(out)} found)")
        time.sleep(0.4)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"Wrote {len(out)} geocodes → {OUT_PATH}")


if __name__ == "__main__":
    main()
