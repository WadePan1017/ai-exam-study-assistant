import { NextResponse } from "next/server";
import { z } from "zod";

import { saveMockExamAnswerRequestSchema } from "@/features/mock-exam/mock-exam-request-schema";
import { saveOwnerMockExamAnswer } from "@/server/services/mock-exam-service";

export async function PUT(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const id = z.uuid().safeParse(sessionId);
  const body: unknown = await request.json().catch(() => null);
  const input = saveMockExamAnswerRequestSchema.safeParse(body);
  if (!id.success || !input.success) {
    return NextResponse.json(
      { error: "模考答案格式不正确" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({
      session: await saveOwnerMockExamAnswer(
        id.data,
        input.data.position,
        input.data.selectedKeys,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "保存答案失败",
      },
      { status: 422 },
    );
  }
}
