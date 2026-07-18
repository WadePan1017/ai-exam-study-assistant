import { NextResponse } from "next/server";
import { z } from "zod";

import { navigatePracticeRequestSchema } from "@/features/practice/practice-request-schema";
import { navigateOwnerPractice } from "@/server/services/practice-service";

export async function PUT(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const body: unknown = await request.json().catch(() => null);
  const bodyResult = navigatePracticeRequestSchema.safeParse(body);
  const { sessionId } = await context.params;
  const idResult = z.uuid().safeParse(sessionId);

  if (!bodyResult.success || !idResult.success) {
    return NextResponse.json(
      { error: "题号或会话编号格式不正确" },
      { status: 400 },
    );
  }

  try {
    const session = await navigateOwnerPractice(
      idResult.data,
      bodyResult.data.index,
    );
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "切换题目失败",
      },
      { status: 404 },
    );
  }
}
