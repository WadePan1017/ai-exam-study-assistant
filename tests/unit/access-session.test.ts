import { describe, expect, it } from "vitest";

import {
  createAccessSession,
  isAccessKeyValid,
  verifyAccessSession,
} from "@/features/access/access-session";

describe("single-user access session", () => {
  it("accepts a session created with the configured secret", async () => {
    const issuedAt = new Date("2026-07-18T00:00:00.000Z");
    const session = await createAccessSession(
      "a-long-test-secret",
      issuedAt,
    );

    await expect(
      verifyAccessSession(
        session,
        "a-long-test-secret",
        new Date("2026-07-19T00:00:00.000Z"),
      ),
    ).resolves.toBe(true);
  });

  it("rejects an incorrect access key", async () => {
    await expect(
      isAccessKeyValid("incorrect-key", "correct-key"),
    ).resolves.toBe(false);
  });

  it("rejects a session signed with a different secret", async () => {
    const session = await createAccessSession("first-session-secret");

    await expect(
      verifyAccessSession(session, "different-session-secret"),
    ).resolves.toBe(false);
  });

  it("rejects an expired session even when its signature is valid", async () => {
    const session = await createAccessSession(
      "a-long-test-secret",
      new Date("2026-01-01T00:00:00.000Z"),
    );

    await expect(
      verifyAccessSession(
        session,
        "a-long-test-secret",
        new Date("2026-02-01T00:00:01.000Z"),
      ),
    ).resolves.toBe(false);
  });

  it("rejects a malformed or implausibly long-lived session", async () => {
    await expect(
      verifyAccessSession("not-a-session", "a-long-test-secret"),
    ).resolves.toBe(false);

    await expect(
      verifyAccessSession(
        `v1.1.9999999999.${"0".repeat(64)}`,
        "a-long-test-secret",
        new Date(2_000),
      ),
    ).resolves.toBe(false);
  });
});
