import { describe, expect, it } from "vitest";
import { CAMP_LOCATION } from "@/lib/transportStopTimes";
import { applySeasonRosterToRoutes, pruneRouteStopsWithNoRiders } from "@/lib/transportWeekView";
import {
  coreIndexFromDisplayStops,
  isCounselorPickupStop,
  parseBusCounselorPickup,
  routeStopsForTiming,
  withCounselorPickupStops,
  withUntimedCounselorDisplay,
} from "@/lib/transportCounselorPickup";
import { buildAMStops, buildPMStops } from "@/lib/transportStopTimes";

const counselor = {
  name: "Alex Rivera",
  address: "12 Counselor Ln, Glen Cove, NY",
  lat: 40.86,
  lng: -73.63,
};

const kid = {
  name: "Kid One",
  address: "1 Main St",
  lat: 40.87,
  lng: -73.64,
  pickupTime: "",
  passengers: 1,
  camperNames: ["Kid One"],
};

describe("transportCounselorPickup", () => {
  it("parses a valid pickup and rejects missing coordinates", () => {
    expect(parseBusCounselorPickup(counselor)?.name).toBe("Alex Rivera");
    expect(parseBusCounselorPickup({ ...counselor, lat: 0, lng: 0 })).toBeNull();
    expect(parseBusCounselorPickup({ name: "Alex", address: "" })).toBeNull();
  });

  it("puts the counselor first on AM and last on PM, outside camper optimize order", () => {
    const amCore = withCounselorPickupStops([kid], counselor, "am");
    const pmCore = withCounselorPickupStops([kid], counselor, "pm");
    const am = buildAMStops(amCore, "7:00 AM");
    const pm = buildPMStops(pmCore, "4:00 PM");

    expect(isCounselorPickupStop(am[0])).toBe(true);
    expect(am[0]?.name).toBe("Alex Rivera");
    expect(am[1]?.camperNames).toEqual(["Kid One"]);
    expect(am[2]?.address).toBe(CAMP_LOCATION.address);

    expect(pm[0]?.address).toBe(CAMP_LOCATION.address);
    expect(pm[1]?.camperNames).toEqual(["Kid One"]);
    expect(isCounselorPickupStop(pm[2])).toBe(true);
  });

  it("keeps counselor on the list without putting them on the clock when toggled off", () => {
    const routed = withCounselorPickupStops([kid], counselor, "am");
    const forTiming = routeStopsForTiming(routed, false);
    const timed = buildAMStops(forTiming, "7:00 AM", { legMinutes: [18] });
    const display = withUntimedCounselorDisplay(timed, counselor, "am", false);

    expect(isCounselorPickupStop(display[0])).toBe(true);
    expect(display[0]?.pickupTime).toBe("—");
    expect(display[1]?.camperNames).toEqual(["Kid One"]);
    expect(display[1]?.pickupTime).toBe("7:00 AM");
    expect(routeStopsForTiming(display, false)[0]?.camperNames).toEqual(["Kid One"]);
  });

  it("maps display indices past camp and counselor onto camper coreStops", () => {
    const am = [
      { address: counselor.address, stopRole: "counselor" as const },
      { address: kid.address },
      { address: CAMP_LOCATION.address },
    ];
    const pm = [
      { address: CAMP_LOCATION.address },
      { address: kid.address },
      { address: counselor.address, stopRole: "counselor" as const },
    ];
    expect(coreIndexFromDisplayStops(am, 0, CAMP_LOCATION.address)).toBeNull();
    expect(coreIndexFromDisplayStops(am, 1, CAMP_LOCATION.address)).toBe(0);
    expect(coreIndexFromDisplayStops(am, 2, CAMP_LOCATION.address)).toBeNull();
    expect(coreIndexFromDisplayStops(pm, 0, CAMP_LOCATION.address)).toBeNull();
    expect(coreIndexFromDisplayStops(pm, 1, CAMP_LOCATION.address)).toBe(0);
    expect(coreIndexFromDisplayStops(pm, 2, CAMP_LOCATION.address)).toBeNull();
  });

  it("keeps counselor stops when empty camper stops are pruned", () => {
    const counselorStop = {
      name: "Alex Rivera",
      address: counselor.address,
      lat: counselor.lat,
      lng: counselor.lng,
      pickupTime: "7:00 AM",
      passengers: 0,
      camperNames: [] as string[],
      stopRole: "counselor" as const,
    };
    const [kept] = pruneRouteStopsWithNoRiders([
      {
        id: 1,
        name: "Bus 5",
        bus: "5",
        color: "#f00",
        direction: "Inbound",
        departure: "7:00 AM",
        status: "Confirmed",
        capacity: 40,
        campers: 0,
        stops: [counselorStop, { ...CAMP_LOCATION, passengers: 0, pickupTime: "" }],
      },
    ]);
    expect(kept?.stops.some(isCounselorPickupStop)).toBe(true);

    const rostered = applySeasonRosterToRoutes(
      [
        {
          id: 1,
          name: "Bus 5",
          bus: "5",
          color: "#f00",
          direction: "Inbound",
          departure: "7:00 AM",
          status: "Confirmed",
          capacity: 40,
          campers: 1,
          stops: [
            counselorStop,
            { ...kid },
            { ...CAMP_LOCATION, passengers: 0, pickupTime: "" },
          ],
        },
      ],
      new Set(["kid one"]),
    );
    expect(rostered[0]?.stops.some(isCounselorPickupStop)).toBe(true);
    expect(rostered[0]?.stops.some((s) => s.camperNames?.includes("Kid One"))).toBe(true);
  });
});
