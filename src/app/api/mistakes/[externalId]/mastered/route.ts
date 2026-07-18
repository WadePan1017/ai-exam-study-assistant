import { NextResponse } from "next/server";

import { questionExternalIdSchema } from "@/features/practice/question-import-schema";
import { markOwnerMistakeMastered } from "@/server/services/practice-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ externalId: string }> },
) {
  const { externalId } = await context.params;
  const idResult = questionExternalIdSchema.safeParse(externalId);

  if (!idResult.success) {
    return NextResponse.json(
      { error: "题目编号格式不正确" },
      { status: 400 },
    );
  }

  try {
    await markOwnerMistakeMastered(idResult.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "标记掌握失败",
      },
      { status: 404 },
    );
  }
}
