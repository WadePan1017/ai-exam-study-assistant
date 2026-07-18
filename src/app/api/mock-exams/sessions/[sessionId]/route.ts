import { NextResponse } from "next/server";
import { z } from "zod";

import { getOwnerMockExamSession } from "@/server/services/mock-exam-service";

export async function GET(
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
    const session = await getOwnerMockExamSession(id.data);
    return session
      ? NextResponse.json({ session })
      : NextResponse.json(
          { error: "模考会话不存在" },
          { status: 404 },
        );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "读取模考会话失败",
      },
      { status: 500 },
    );
  }
}
