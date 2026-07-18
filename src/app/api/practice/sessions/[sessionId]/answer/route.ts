import { NextResponse } from "next/server";
import { z } from "zod";

import { submitPracticeAnswerRequestSchema } from "@/features/practice/practice-request-schema";
import { submitOwnerPracticeAnswer } from "@/server/services/practice-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const body: unknown = await request.json().catch(() => null);
  const bodyResult =
    submitPracticeAnswerRequestSchema.safeParse(body);
  const { sessionId } = await context.params;
  const idResult = z.uuid().safeParse(sessionId);

  if (!bodyResult.success || !idResult.success) {
    return NextResponse.json(
      { error: "答案或会话编号格式不正确" },
      { status: 400 },
    );
  }

  try {
    const session = await submitOwnerPracticeAnswer(
      idResult.data,
      bodyResult.data,
    );
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "提交答案失败",
      },
      { status: 409 },
    );
  }
}
