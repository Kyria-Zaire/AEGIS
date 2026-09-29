import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("merges conflicting tailwind classes, last one wins", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it.each([true, false])("applies conditional classes (disabled=%s)", (disabled) => {
    expect(cn("base", disabled && "opacity-50", undefined)).toBe(disabled ? "base opacity-50" : "base");
  });
});
