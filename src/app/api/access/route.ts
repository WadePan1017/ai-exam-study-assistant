import { NextResponse } from "next/server";
import { z } from "zod";

import { getAccessConfig } from "@/features/access/access-config";
import {
  clearAccessFailures,
  createAccessFingerprint,
  getAccessRateLimitStatus,
  recordAccessFailure,
} from "@/features/access/access-rate-limit";
import {
  ACCESS_COOKIE_MAX_AGE_SECONDS,
  ACCESS_COOKIE_NAME,
} from "@/features/access/constants";
import {
  createAccessSession,
  isAccessKeyValid,
} from "@/features/access/access-session";
import { safeNextPath } from "@/features/access/safe-next-path";

const accessFormSchema = z.object({
  accessKey: z.string().trim().min(1),
  next: z.string().optional(),
});

function rateLimitedResponse(retryAfterSeconds: number) {
  return new NextResponse("访问尝试过多，请稍后重试。", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": String(Math.max(1, retryAfterSeconds)),
    },
    status: 429,
  });
}

function rateLimiterUnavailableResponse(error: unknown) {
  console.error(
    "Access rate limiter unavailable.",
    error instanceof Error ? error.message : "Unknown error",
  );

  return new NextResponse("访问保护暂时不可用，请稍后重试。", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 503,
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = accessFormSchema.safeParse({
    accessKey: formData.get("accessKey"),
    next: formData.get("next") || undefined,
  });
  const appConfig = getAccessConfig();

  if (!appConfig.success) {
    return NextResponse.redirect(
      new URL("/access?error=configuration", request.url),
      303,
    );
  }

  let fingerprint: string;

  try {
    fingerprint = await createAccessFingerprint(
      request,
      appConfig.data.APP_SESSION_SECRET,
    );
    const rateLimitStatus =
      await getAccessRateLimitStatus(fingerprint);

    if (!rateLimitStatus.allowed) {
      return rateLimitedResponse(
        rateLimitStatus.retryAfterSeconds,
      );
    }
  } catch (error) {
    return rateLimiterUnavailableResponse(error);
  }

  if (
    !parsed.success ||
    !(await isAccessKeyValid(
      parsed.data.accessKey,
      appConfig.data.APP_ACCESS_KEY,
    ))
  ) {
    try {
      const rateLimitStatus = await recordAccessFailure(fingerprint);

      if (!rateLimitStatus.allowed) {
        return rateLimitedResponse(
          rateLimitStatus.retryAfterSeconds,
        );
      }
    } catch (error) {
      return rateLimiterUnavailableResponse(error);
    }

    const url = new URL("/access", request.url);
    url.searchParams.set("error", "invalid");
    if (parsed.success && parsed.data.next) {
      url.searchParams.set("next", safeNextPath(parsed.data.next));
    }
    return NextResponse.redirect(url, 303);
  }

  const response = NextResponse.redirect(
    new URL(safeNextPath(parsed.data.next), request.url),
    303,
  );

  try {
    await clearAccessFailures(fingerprint);
  } catch (error) {
    return rateLimiterUnavailableResponse(error);
  }

  const session = await createAccessSession(
    appConfig.data.APP_SESSION_SECRET,
  );

  response.cookies.set(ACCESS_COOKIE_NAME, session, {
    httpOnly: true,
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
