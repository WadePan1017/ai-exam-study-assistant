import { NextResponse } from "next/server";
import { z } from "zod";

import { knowledgeExternalIdSchema } from "@/features/knowledge/knowledge-import-schema";
import { saveOwnerKnowledgeState } from "@/server/services/learning-content-service";

const requestSchema = z.object({
  isFavorite: z.boolean(),
  personalNote: z.string().max(20_000),
  status: z.enum(["not_started", "learning", "mastered", "weak"]),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ externalId: string }> },
) {
  const body: unknown = await request.json().catch(() => null);
  const result = requestSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "学习记录格式不正确" },
      { status: 400 },
    );
  }

  const { externalId } = await context.params;
  const externalIdResult =
    knowledgeExternalIdSchema.safeParse(externalId);
  if (!externalIdResult.success) {
    return NextResponse.json(
      { error: "知识点编号格式不正确" },
      { status: 400 },
    );
  }

  try {
    await saveOwnerKnowledgeState(externalIdResult.data, result.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "保存学习记录失败",
      },
      { status: 404 },
    );
  }
}
