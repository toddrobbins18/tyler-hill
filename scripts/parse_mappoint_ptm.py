#!/usr/bin/env python3
"""
Parse Microsoft MapPoint .ptm route files (North Shore day camp bus routes).

Each .ptm file is one bus route. Structure (via strings extraction):
  - Roster block: bus counselor + camper names in stop order
  - Address book: all pushpins (name, street, city, zip)

Outputs:
  - north_shore_mappoint_routes_2026.csv  (route stops with stop order)
  - north_shore_mappoint_addresses_2026.csv  (deduped master address list)

Usage:
  python3 tyler-hill/scripts/parse_mappoint_ptm.py [path/to/Mappoint]
"""

from __future__ import annotations

import csv
import glob
import os
import re
import subprocess
import sys

ZIP_RE = re.compile(r"(\d{5})")
STREET_RE = re.compile(r"\d")
NAME_OK = re.compile(r"^[A-Za-z0-9&',.\-\s]+$")
CAMP_ADDR_RE = re.compile(r"crescent beach|85 crescent", re.I)
COUNSELOR_RE = re.compile(r"bus counselor", re.I)
MAX_STOPS_PER_ROUTE = 28

DEFAULT_PTM_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "Mappoint")
)
DEFAULT_OUT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "data")
)


def is_camper_name(line: str) -> bool:
    if len(line) < 3 or len(line) > 60:
        return False
    if not NAME_OK.match(line):
        return False
    if line in ("Pushpins", "My pushpins", "MASM", "No active searches"):
        return False
    if COUNSELOR_RE.search(line):
        return False
    if CAMP_ADDR_RE.search(line):
        return False
    if any(x in line for x in ("@", "\\", "Microsoft", "MapPoint", "Standard Jet")):
        return False
    # Skip binary garbage
    if sum(1 for c in line if ord(c) < 32 or ord(c) > 126) > 0:
        return False
    return True


def roster_stop(line: str) -> bool:
    if not is_camper_name(line):
        return False
    # Address lines mixed into roster
    if STREET_RE.search(line) and any(
        s in line.lower()
        for s in (" rd", " road", " st", " street", " ave", " lane", " ln", " dr", " way", " ny ")
    ):
        return False
    return True


def parse_strings(path: str) -> list[str]:
    out = subprocess.check_output(["strings", path], text=True, errors="replace")
    return [ln.strip() for ln in out.splitlines() if ln.strip()]


def parse_address_book(lines: list[str]) -> dict[str, dict[str, str]]:
    try:
        start = lines.index("My pushpins") + 1
    except ValueError:
        start = 0

    by_name: dict[str, dict[str, str]] = {}
    i = start
    while i < len(lines):
        if i + 3 >= len(lines):
            break
        name, street, city, zip_line = lines[i], lines[i + 1], lines[i + 2], lines[i + 3]
        zm = ZIP_RE.search(zip_line.strip())
        if (
            zm
            and STREET_RE.search(street)
            and is_camper_name(name)
            and len(city) < 35
            and not ZIP_RE.fullmatch(city or "")
        ):
            zip_code = zm.group(1)
            by_name[name] = {
                "name": name,
                "street": street,
                "city": city,
                "zip": zip_code,
                "address": f"{street}, {city}, NY {zip_code}",
            }
            i += 4
            continue
        i += 1
    return by_name


def parse_roster(lines: list[str]) -> tuple[str | None, list[str]]:
    counselor: str | None = None
    roster: list[str] = []

    # Find start: first counselor line, or first line after MASM/No active searches
    start_idx = 0
    for i, ln in enumerate(lines):
        if COUNSELOR_RE.search(ln):
            counselor = ln
            start_idx = i + 1
            break
        if ln == "MASM" and i + 1 < len(lines):
            start_idx = i + 1
            break

    for ln in lines[start_idx:]:
        if ln in ("Pushpins", "My pushpins"):
            break
        if CAMP_ADDR_RE.search(ln) or ln.startswith(")85"):
            break
        if not roster_stop(ln):
            if roster:
                break
            continue
        roster.append(ln)
        if len(roster) >= MAX_STOPS_PER_ROUTE:
            break

    return counselor, roster


def route_meta(filename: str) -> dict[str, str]:
    base = os.path.splitext(os.path.basename(filename))[0]
    is_pm = bool(re.search(r"(\s-pm|\spm)$", base, re.I))
    clean = re.sub(r"(\s-pm|-pm|\spm)$", "", base, flags=re.I).strip()
    m = re.match(r"^(\d+)\s*-(.+)$", clean)
    bus_number = m.group(1) if m else clean.split(" ")[0]
    route_name = m.group(2).strip() if m else clean
    return {
        "route_file": base,
        "bus_number": bus_number,
        "route_name": route_name,
        "direction": "PM" if is_pm else "AM",
    }


def counselor_name(raw: str | None) -> str:
    if not raw:
        return ""
    s = re.sub(r"^Bus [Cc]ounselor\s*-?\s*", "", raw).strip()
    s = re.sub(r"\s*-\s*Bus [Cc]ounselor\s*$", "", s, flags=re.I).strip()
    return s


def main() -> int:
    ptm_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PTM_DIR
    out_dir = DEFAULT_OUT_DIR
    os.makedirs(out_dir, exist_ok=True)

    files = sorted(glob.glob(os.path.join(ptm_dir, "*.ptm")))
    if not files:
        print(f"No .ptm files in {ptm_dir}", file=sys.stderr)
        return 1

    route_rows: list[dict[str, str | int]] = []
    all_addrs: dict[str, dict[str, str]] = {}

    for path in files:
        lines = parse_strings(path)
        meta = route_meta(path)
        counselor_raw, roster = parse_roster(lines)
        book = parse_address_book(lines)
        all_addrs.update(book)

        for order, name in enumerate(roster, 1):
            info = book.get(name, {})
            route_rows.append(
                {
                    **meta,
                    "stop_order": order,
                    "camper_name": name,
                    "street": info.get("street", ""),
                    "city": info.get("city", ""),
                    "zip": info.get("zip", ""),
                    "address": info.get("address", ""),
                    "bus_counselor": counselor_name(counselor_raw),
                }
            )

    routes_path = os.path.join(out_dir, "north_shore_mappoint_routes_2026.csv")
    addr_path = os.path.join(out_dir, "north_shore_mappoint_addresses_2026.csv")

    route_fields = [
        "route_file",
        "bus_number",
        "route_name",
        "direction",
        "stop_order",
        "camper_name",
        "street",
        "city",
        "zip",
        "address",
        "bus_counselor",
    ]
    with open(routes_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=route_fields)
        w.writeheader()
        w.writerows(route_rows)

    with open(addr_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["name", "street", "city", "zip", "address"])
        w.writeheader()
        for row in sorted(all_addrs.values(), key=lambda r: r["name"].lower()):
            w.writerow(row)

    # Summary
    by_file: dict[str, int] = {}
    for row in route_rows:
        by_file[row["route_file"]] = by_file.get(row["route_file"], 0) + 1

    print(f"Parsed {len(files)} .ptm files")
    print(f"Route stops: {len(route_rows)} rows -> {routes_path}")
    print(f"Unique addresses: {len(all_addrs)} -> {addr_path}")
    print(f"Routes with roster: {len(by_file)} / {len(files)}")
    for fname in sorted(by_file):
        n = by_file[fname]
        if n <= MAX_STOPS_PER_ROUTE:
            print(f"  {fname}: {n} stops")

    missing_addr = [r for r in route_rows if not r["address"]]
    if missing_addr:
        print(f"Stops missing address match: {len(missing_addr)}")
        for r in missing_addr[:10]:
            print(f"  {r['route_file']} #{r['stop_order']} {r['camper_name']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
