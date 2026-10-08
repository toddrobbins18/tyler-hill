import { describe, expect, it } from "vitest";
import {
  buildBusArrivalReportRows,
  busCheckinKey,
  parseBusCheckinMap,
} from "@/lib/transportBusCheckins";

describe("transportBusCheckins", () => {
  it("parses needs gas from saved data", () => {
    const map = parseBusCheckinMap({
      records: {
        "3": {
          arrivedAt: "2027-07-06T11:00:00.000Z",
          needsGas: true,
          needsGasAt: "2027-07-06T11:05:00.000Z",
        },
      },
    });
    expect(map[busCheckinKey(3)]?.needsGas).toBe(true);
    expect(map[busCheckinKey(3)]?.needsGasAt).toBeTruthy();
  });

  it("builds arrival report rows sorted by bus", () => {
    const rows = buildBusArrivalReportRows(
      [
        { id: 2, bus: "Bus 10", name: "Route B" },
        { id: 1, bus: "Bus 2", name: "Route A" },
      ],
      {
        [busCheckinKey(1)]: { arrivedAt: "2027-07-06T11:00:00.000Z" },
        [busCheckinKey(2)]: { arrivedAt: "2027-07-06T11:15:00.000Z", needsGas: true },
      },
    );
    expect(rows.map((r) => r.bus)).toEqual(["Bus 2", "Bus 10"]);
    expect(rows[1]?.needsGas).toBe(true);
    expect(rows[0]?.arrivedAt).toBeTruthy();
  });
});
