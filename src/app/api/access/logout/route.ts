import { NextResponse } from "next/server";

import { ACCESS_COOKIE_NAME } from "@/features/access/constants";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/access", request.url), 303);

  response.cookies.set(ACCESS_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
