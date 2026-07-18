import { NextResponse } from "next/server";

import { startMockExamRequestSchema } from "@/features/mock-exam/mock-exam-request-schema";
import {
  getOwnerMockExamSetup,
  startOwnerMockExam,
} from "@/server/services/mock-exam-service";

export async function GET() {
  try {
    return NextResponse.json({
      setup: await getOwnerMockExamSetup(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "读取模考模板失败",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const result = startMockExamRequestSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "模考模板编号格式不正确" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      {
        session: await startOwnerMockExam(result.data.templateId),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "无法开始模考",
      },
      { status: 422 },
    );
  }
}
