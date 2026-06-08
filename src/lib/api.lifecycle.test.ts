/**
 * toLifecycle mapper — the backend lifecycle must flow through verbatim, and
 * anything unrecognized reads as "unknown", never "active". Guards the bug
 * where a non-active part (ltb/preview/unknown) was silently relabeled active.
 */
import { describe, it, expect } from "vitest";
import { toLifecycle } from "@/lib/api";

describe("toLifecycle", () => {
  it("passes recognized lifecycles through verbatim", () => {
    expect(toLifecycle("active")).toBe("active");
    expect(toLifecycle("nrnd")).toBe("nrnd");
    expect(toLifecycle("ltb")).toBe("ltb");
    expect(toLifecycle("obsolete")).toBe("obsolete");
    expect(toLifecycle("preview")).toBe("preview");
  });

  it("maps unrecognized / missing values to 'unknown', NOT 'active'", () => {
    expect(toLifecycle("garbage")).toBe("unknown");
    expect(toLifecycle("")).toBe("unknown");
    expect(toLifecycle(null)).toBe("unknown");
    expect(toLifecycle(undefined)).toBe("unknown");
  });

  it("never silently relabels a non-active part as active", () => {
    for (const raw of ["ltb", "preview", "obsolete", "nrnd", "weird", null, undefined]) {
      expect(toLifecycle(raw)).not.toBe("active");
    }
  });
});
