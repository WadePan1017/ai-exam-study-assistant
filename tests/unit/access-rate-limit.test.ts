import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearAccessFailures,
  createAccessFingerprint,
  getAccessRateLimitStatus,
  getMemoryAccessRateLimitStatus,
  recordAccessFailure,
  recordMemoryAccessFailure,
  resetMemoryAccessRateLimit,
} from "@/features/access/access-rate-limit";

afterEach(() => {
  resetMemoryAccessRateLimit();
  vi.unstubAllEnvs();
});

describe("access rate limiting", () => {
  it("blocks the fifth failed attempt and increases the next block", () => {
    const fingerprint = "test-fingerprint";
    resetMemoryAccessRateLimit();

    for (let attempt = 1; attempt < 5; attempt += 1) {
      expect(
        recordMemoryAccessFailure(fingerprint, 0),
      ).toEqual({
        allowed: true,
        retryAfterSeconds: 0,
      });
    }

    expect(recordMemoryAccessFailure(fingerprint, 0)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(getMemoryAccessRateLimitStatus(fingerprint, 30_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 30,
    });
    expect(recordMemoryAccessFailure(fingerprint, 60_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 120,
    });
  });

  it("clears stale failures after the rolling window", () => {
    const fingerprint = "stale-fingerprint";
    resetMemoryAccessRateLimit();

    recordMemoryAccessFailure(fingerprint, 0);

    expect(
      recordMemoryAccessFailure(fingerprint, 15 * 60 * 1_000 + 1),
    ).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("uses the in-memory limiter outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const fingerprint = "development-fingerprint";

    await expect(
      getAccessRateLimitStatus(fingerprint),
    ).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    await expect(recordAccessFailure(fingerprint)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });

    await clearAccessFailures(fingerprint);

    expect(
      getMemoryAccessRateLimitStatus(fingerprint),
    ).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("fails closed in production without Supabase", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    await expect(
      getAccessRateLimitStatus("fingerprint"),
    ).rejects.toThrow("Supabase is required");
    await expect(recordAccessFailure("fingerprint")).rejects.toThrow(
      "Supabase is required",
    );
    await expect(clearAccessFailures("fingerprint")).rejects.toThrow(
      "Supabase is required",
    );
  });

  it("hashes the source IP without storing it in plain text", async () => {
    const request = new Request("https://example.test/access", {
      headers: {
        "user-agent": "study-phone",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
    });

    const fingerprint = await createAccessFingerprint(
      request,
      "a-long-test-secret",
    );

    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    await expect(
      createAccessFingerprint(request, "a-long-test-secret"),
    ).resolves.toBe(fingerprint);
    expect(fingerprint).not.toContain("203.0.113.10");
  });
});
