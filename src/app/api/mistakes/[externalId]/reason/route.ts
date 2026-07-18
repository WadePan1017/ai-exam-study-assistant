import { NextResponse } from "next/server";

import { questionExternalIdSchema } from "@/features/practice/question-import-schema";
import { updateMistakeReasonRequestSchema } from "@/features/review/mistake-request-schema";
import { setOwnerMistakeReason } from "@/server/services/practice-service";

export async function PUT(
  request: Request,
  context: { params: Promise<{ externalId: string }> },
) {
  const body: unknown = await request.json().catch(() => null);
  const bodyResult = updateMistakeReasonRequestSchema.safeParse(body);
  const { externalId } = await context.params;
  const idResult = questionExternalIdSchema.safeParse(externalId);

  if (!bodyResult.success || !idResult.success) {
    return NextResponse.json(
      { error: "错因请求格式不正确" },
      { status: 400 },
    );
  }

  try {
    await setOwnerMistakeReason(
      idResult.data,
      bodyResult.data.reason,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "保存错因失败",
      },
      { status: 404 },
    );
  }
}
