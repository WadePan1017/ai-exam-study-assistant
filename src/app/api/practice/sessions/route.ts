import { NextResponse } from "next/server";

import { startPracticeRequestSchema } from "@/features/practice/practice-request-schema";
import { startOwnerPractice } from "@/server/services/practice-service";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const result = startPracticeRequestSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "练习设置格式不正确" },
      { status: 400 },
    );
  }

  try {
    const session = await startOwnerPractice(result.data);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "无法开始练习",
      },
      { status: 422 },
    );
  }
}
