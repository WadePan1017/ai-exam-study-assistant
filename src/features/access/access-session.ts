import { ACCESS_COOKIE_MAX_AGE_SECONDS } from "@/features/access/constants";

const SESSION_VERSION = "v1";
const MAX_CLOCK_SKEW_SECONDS = 60;
const SESSION_PATTERN = /^(v1)\.(\d+)\.(\d+)\.([\da-f]{64})$/i;

async function importSecret(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function hexToBytes(value: string) {
  if (!/^[\da-f]{64}$/i.test(value)) {
    return null;
  }

  return Uint8Array.from(
    value.match(/.{2}/g) ?? [],
    (byte) => Number.parseInt(byte, 16),
  );
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

export async function isAccessKeyValid(provided: string, expected: string) {
  const [providedDigest, expectedDigest] = await Promise.all([
    digest(provided),
    digest(expected),
  ]);
  let difference = 0;

  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= providedDigest[index] ^ expectedDigest[index];
  }

  return difference === 0;
}

export async function createAccessSession(
  secret: string,
  now = new Date(),
) {
  const issuedAt = Math.floor(now.getTime() / 1_000);
  const expiresAt = issuedAt + ACCESS_COOKIE_MAX_AGE_SECONDS;
  const payload = `${SESSION_VERSION}.${issuedAt}.${expiresAt}`;
  const key = await importSecret(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  return `${payload}.${bytesToHex(signature)}`;
}

export async function verifyAccessSession(
  session: string,
  secret: string,
  now = new Date(),
) {
  const match = SESSION_PATTERN.exec(session);

  if (!match) {
    return false;
  }

  const [, version, issuedAtValue, expiresAtValue, signatureValue] = match;
  const issuedAt = Number(issuedAtValue);
  const expiresAt = Number(expiresAtValue);
  const currentTime = Math.floor(now.getTime() / 1_000);
  const signature = hexToBytes(signatureValue);

  if (
    !signature ||
    version !== SESSION_VERSION ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > ACCESS_COOKIE_MAX_AGE_SECONDS ||
    issuedAt > currentTime + MAX_CLOCK_SKEW_SECONDS ||
    expiresAt <= currentTime
  ) {
    return false;
  }

  const key = await importSecret(secret);
  const payload = `${version}.${issuedAtValue}.${expiresAtValue}`;

  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    new TextEncoder().encode(payload),
  );
}
