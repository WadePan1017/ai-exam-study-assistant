import { NextResponse, type NextRequest } from "next/server";

import { getAccessConfig } from "@/features/access/access-config";
import { ACCESS_COOKIE_NAME } from "@/features/access/constants";
import { verifyAccessSession } from "@/features/access/access-session";

export async function proxy(request: NextRequest) {
  const config = getAccessConfig();
  const accessUrl = new URL("/access", request.url);
  accessUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  if (!config.success) {
    accessUrl.searchParams.set("error", "configuration");
    return NextResponse.redirect(accessUrl);
  }

  const session = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const allowed =
    session &&
    (await verifyAccessSession(
      session,
      config.data.APP_SESSION_SECRET,
    ));

  if (!allowed) {
    return NextResponse.redirect(accessUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!access|api/access|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
