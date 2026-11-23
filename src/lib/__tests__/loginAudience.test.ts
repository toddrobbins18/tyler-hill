import { describe, expect, it } from "vitest";
import { loginAudienceFromSearch } from "@/lib/loginAudience";

describe("loginAudienceFromSearch", () => {
  it("defaults thenest.com login to staff", () => {
    expect(loginAudienceFromSearch(new URLSearchParams())).toBe("staff");
    expect(loginAudienceFromSearch(new URLSearchParams("company=north-shore-day-camp"))).toBe(
      "staff",
    );
    expect(loginAudienceFromSearch(new URLSearchParams("role=staff"))).toBe("staff");
  });

  it("opens parent login only when role=parent", () => {
    expect(loginAudienceFromSearch(new URLSearchParams("role=parent"))).toBe("parent");
    expect(
      loginAudienceFromSearch(new URLSearchParams("role=parent&company=north-shore-day-camp")),
    ).toBe("parent");
  });

  it("keeps staff invites on staff login", () => {
    expect(loginAudienceFromSearch(new URLSearchParams("company_id=abc"))).toBe("staff");
    expect(loginAudienceFromSearch(new URLSearchParams("email=todd@camptlc.com"))).toBe("staff");
  });
});
