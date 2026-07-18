import { afterEach, describe, expect, it } from "vitest";

import { getAccessConfig } from "@/features/access/access-config";

const originalAccessKey = process.env.APP_ACCESS_KEY;
const originalSessionSecret = process.env.APP_SESSION_SECRET;

afterEach(() => {
  process.env.APP_ACCESS_KEY = originalAccessKey;
  process.env.APP_SESSION_SECRET = originalSessionSecret;
});

describe("access configuration", () => {
  it("accepts an access key and sufficiently long session secret", () => {
    process.env.APP_ACCESS_KEY = "private-access-key";
    process.env.APP_SESSION_SECRET =
      "a-session-secret-that-is-longer-than-thirty-two-characters";

    expect(getAccessConfig().success).toBe(true);
  });

  it("reports incomplete configuration without exposing a fallback secret", () => {
    delete process.env.APP_ACCESS_KEY;
    delete process.env.APP_SESSION_SECRET;

    expect(getAccessConfig().success).toBe(false);
  });
});
