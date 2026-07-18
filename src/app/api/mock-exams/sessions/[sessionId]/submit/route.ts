import { NextResponse } from "next/server";
import { z } from "zod";

import { submitOwnerMockExam } from "@/server/services/mock-exam-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const id = z.uuid().safeParse(sessionId);
  if (!id.success) {
    return NextResponse.json(
      { error: "模考会话编号格式不正确" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json({
      session: await submitOwnerMockExam(id.data),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "交卷失败",
      },
      { status: 422 },
    );
  }
}
