import { NextResponse } from "next/server";

import { favoriteQuestionRequestSchema } from "@/features/practice/practice-request-schema";
import { questionExternalIdSchema } from "@/features/practice/question-import-schema";
import { setOwnerQuestionFavorite } from "@/server/services/practice-service";

export async function PUT(
  request: Request,
  context: { params: Promise<{ externalId: string }> },
) {
  const body: unknown = await request.json().catch(() => null);
  const bodyResult = favoriteQuestionRequestSchema.safeParse(body);
  const { externalId } = await context.params;
  const idResult = questionExternalIdSchema.safeParse(externalId);

  if (!bodyResult.success || !idResult.success) {
    return NextResponse.json(
      { error: "收藏请求格式不正确" },
      { status: 400 },
    );
  }

  try {
    await setOwnerQuestionFavorite(
      idResult.data,
      bodyResult.data.isFavorite,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "保存收藏失败",
      },
      { status: 404 },
    );
  }
}
