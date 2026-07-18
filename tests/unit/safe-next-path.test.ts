import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/features/access/safe-next-path";

describe("post-unlock destination", () => {
  it.each(["https://example.com", "//example.com", "/\\example.com"])(
    "rejects external destination %s",
    (destination) => {
      expect(safeNextPath(destination)).toBe("/");
    },
  );

  it("keeps a local path and query string", () => {
    expect(safeNextPath("/study?chapter=1")).toBe("/study?chapter=1");
  });
});
