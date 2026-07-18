const MAX_FAILURES = 5;
const WINDOW_MILLISECONDS = 15 * 60 * 1_000;
const BASE_BLOCK_MILLISECONDS = 60 * 1_000;
const MAX_BLOCK_MILLISECONDS = 60 * 60 * 1_000;

type AccessRateLimitStatus = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type MemoryAttempt = {
  failureCount: number;
  windowStartedAt: number;
  blockedUntil: number;
};

const memoryAttempts = new Map<string, MemoryAttempt>();

function statusFromAttempt(
  attempt: MemoryAttempt | undefined,
  now: number,
): AccessRateLimitStatus {
  if (!attempt || attempt.blockedUntil <= now) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((attempt.blockedUntil - now) / 1_000),
  };
}

export function getMemoryAccessRateLimitStatus(
  fingerprint: string,
  now = Date.now(),
) {
  const attempt = memoryAttempts.get(fingerprint);

  if (attempt && now - attempt.windowStartedAt > WINDOW_MILLISECONDS) {
    memoryAttempts.delete(fingerprint);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return statusFromAttempt(attempt, now);
}

export function recordMemoryAccessFailure(
  fingerprint: string,
  now = Date.now(),
) {
  const current = memoryAttempts.get(fingerprint);
  const currentStatus = statusFromAttempt(current, now);

  if (!currentStatus.allowed) {
    return currentStatus;
  }

  const failureCount =
    !current || now - current.windowStartedAt > WINDOW_MILLISECONDS
      ? 1
      : current.failureCount + 1;
  const windowStartedAt =
    failureCount === 1 ? now : current?.windowStartedAt ?? now;
  const blockMilliseconds =
    failureCount >= MAX_FAILURES
      ? Math.min(
          BASE_BLOCK_MILLISECONDS *
            2 ** (failureCount - MAX_FAILURES),
          MAX_BLOCK_MILLISECONDS,
        )
      : 0;
  const attempt = {
    failureCount,
    windowStartedAt,
    blockedUntil: now + blockMilliseconds,
  };

  memoryAttempts.set(fingerprint, attempt);

  return statusFromAttempt(attempt, now);
}

export function resetMemoryAccessRateLimit(fingerprint?: string) {
  if (fingerprint) {
    memoryAttempts.delete(fingerprint);
    return;
  }

  memoryAttempts.clear();
}

function hasSupabaseConfig() {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function readDatabaseStatus(
  data: unknown,
  error: { message: string } | null,
): AccessRateLimitStatus {
  if (error) {
    throw new Error(`Access rate limiter failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : null;

  if (
    !row ||
    typeof row !== "object" ||
    !("is_allowed" in row) ||
    !("retry_after_seconds" in row)
  ) {
    throw new Error("Access rate limiter returned an invalid response.");
  }

  return {
    allowed: Boolean(row.is_allowed),
    retryAfterSeconds: Number(row.retry_after_seconds),
  };
}

async function runRateLimitRpc(
  functionName:
    | "get_access_rate_limit_status"
    | "record_access_failure",
  fingerprint: string,
) {
  const { createSupabaseAdminClient } = await import(
    "@/lib/supabase/server"
  );
  const { data, error } = await createSupabaseAdminClient().rpc(
    functionName,
    { p_fingerprint_hash: fingerprint },
  );

  return readDatabaseStatus(data, error);
}

export async function createAccessFingerprint(
  request: Request,
  secret: string,
) {
  const forwardedFor =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(forwardedFor),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function getAccessRateLimitStatus(fingerprint: string) {
  if (hasSupabaseConfig()) {
    return runRateLimitRpc(
      "get_access_rate_limit_status",
      fingerprint,
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Supabase is required for production access rate limiting.",
    );
  }

  return getMemoryAccessRateLimitStatus(fingerprint);
}

export async function recordAccessFailure(fingerprint: string) {
  if (hasSupabaseConfig()) {
    return runRateLimitRpc("record_access_failure", fingerprint);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Supabase is required for production access rate limiting.",
    );
  }

  return recordMemoryAccessFailure(fingerprint);
}

export async function clearAccessFailures(fingerprint: string) {
  if (hasSupabaseConfig()) {
    const { createSupabaseAdminClient } = await import(
      "@/lib/supabase/server"
    );
    const { error } = await createSupabaseAdminClient().rpc(
      "clear_access_failures",
      { p_fingerprint_hash: fingerprint },
    );

    if (error) {
      throw new Error(`Access rate limiter failed: ${error.message}`);
    }
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Supabase is required for production access rate limiting.",
    );
  }

  resetMemoryAccessRateLimit(fingerprint);
}
