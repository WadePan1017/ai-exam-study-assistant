import { NextResponse } from "next/server";
import { z } from "zod";

import { markMockExamItemRequestSchema } from "@/features/mock-exam/mock-exam-request-schema";
import { setOwnerMockExamMarked } from "@/server/services/mock-exam-service";

export async function PUT(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const id = z.uuid().safeParse(sessionId);
  const body: unknown = await request.json().catch(() => null);
  const input = markMockExamItemRequestSchema.safeParse(body);
  if (!id.success || !input.success) {
    return NextResponse.json(
      { error: "标记格式不正确" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({
      session: await setOwnerMockExamMarked(
        id.data,
        input.data.position,
        input.data.isMarked,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "保存标记失败",
      },
      { status: 422 },
    );
  }
}
