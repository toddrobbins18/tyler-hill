import { describe, expect, it, vi } from "vitest";
import { resolveStaffForCampView } from "../profileCampResolution";

function createQueryChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
  };
  return chain;
}

describe("resolveStaffForCampView", () => {
  it("returns ok when staff already belongs to the active camp and season", async () => {
    const supabase = {
      from: vi.fn(() =>
        createQueryChain({
          data: {
            id: "abc",
            company_id: "camp-1",
            season: "2027",
            person_id: "p1",
            name: "Todd Robbins",
          },
          error: null,
        }),
      ),
    } as any;

    const result = await resolveStaffForCampView(supabase, "abc", "camp-1", "2027");
    expect(result).toEqual({ kind: "ok", recordId: "abc", name: "Todd Robbins" });
  });

  it("redirects to the matching person_id record in the new camp", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        let call = 0;
        return {
          select: vi.fn(function (this: any) {
            return this;
          }),
          eq: vi.fn(function (this: any) {
            return this;
          }),
          maybeSingle: vi.fn(async function (this: any) {
            call += 1;
            if (call === 1) {
              return {
                data: {
                  id: "north-id",
                  company_id: "north-shore",
                  season: "2027",
                  person_id: "p1",
                  name: "Todd Robbins",
                },
                error: null,
              };
            }
            return {
              data: {
                id: "tyler-id",
                company_id: "tyler-hill",
                season: "2027",
                person_id: "p1",
                name: "Todd Robbins",
              },
              error: null,
            };
          }),
        };
      }),
    } as any;

    const result = await resolveStaffForCampView(supabase, "north-id", "tyler-hill", "2027");
    expect(result).toEqual({
      kind: "redirect",
      recordId: "tyler-id",
      name: "Todd Robbins",
    });
  });

  it("returns not_found when the person is not on the target camp roster", async () => {
    let call = 0;
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => {
          call += 1;
          if (call === 1) {
            return {
              data: {
                id: "north-id",
                company_id: "north-shore",
                season: "2027",
                person_id: "p1",
                name: "Todd Robbins",
              },
              error: null,
            };
          }
          return { data: null, error: null };
        }),
      })),
    } as any;

    const result = await resolveStaffForCampView(supabase, "north-id", "tyler-hill", "2027");
    expect(result).toEqual({ kind: "not_found", name: "Todd Robbins" });
  });
});
