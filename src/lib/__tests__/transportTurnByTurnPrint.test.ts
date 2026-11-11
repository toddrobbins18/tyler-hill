import { describe, expect, it } from "vitest";
import {
  buildTurnByTurnPrintHtml,
  formatTurnDuration,
} from "@/lib/transportTurnByTurnPrint";

describe("transportTurnByTurnPrint", () => {
  it("keeps short turns in seconds instead of rounding every step up to 1 minute", () => {
    expect(formatTurnDuration(20)).toBe("20 sec");
    expect(formatTurnDuration(180)).toBe("3.0 min");
  });

  it("prints first-stop to last-stop without requiring turn instructions", () => {
    const html = buildTurnByTurnPrintHtml({
      bus: "Bus 6",
      routeName: "Oyster Bay",
      totalDistanceMi: 0,
      totalDurationSec: 0,
      steps: [],
      stopLabels: ["Kid One", "Kid Two", "Camp"],
      stops: [
        { name: "Kid One", address: "1 Main St", lat: 40.87, lng: -73.64, pickupTime: "7:00 AM" },
        { name: "Kid Two", address: "2 Oak St", lat: 40.88, lng: -73.65, pickupTime: "7:12 AM" },
        { name: "Camp", address: "85 Crescent Beach Road", lat: 40.88, lng: -73.64, pickupTime: "7:40 AM" },
      ],
    });
    expect(html).toContain("Bus 6");
    expect(html).toContain("Kid One");
    expect(html).toContain("first stop to last stop");
    expect(html).toContain("google.com/maps/dir");
  });
});
