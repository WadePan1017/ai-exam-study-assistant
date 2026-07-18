import { NextResponse } from "next/server";
import { z } from "zod";

import { getOwnerPracticeSession } from "@/server/services/practice-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const idResult = z.uuid().safeParse(sessionId);
  if (!idResult.success) {
    return NextResponse.json(
      { error: "练习会话编号格式不正确" },
      { status: 400 },
    );
  }

  try {
    const session = await getOwnerPracticeSession(idResult.data);
    if (!session) {
      return NextResponse.json(
        { error: "练习会话不存在" },
        { status: 404 },
      );
    }
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "读取练习会话失败",
      },
      { status: 500 },
    );
  }
}
