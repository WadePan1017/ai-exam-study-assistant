import { NextResponse } from "next/server";

import { questionImportRequestSchema } from "@/features/practice/question-import-request";
import { parseQuestionImportText } from "@/features/practice/question-import-schema";
import { previewOwnerQuestionImport } from "@/server/services/practice-service";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const requestResult = questionImportRequestSchema.safeParse(body);

  if (!requestResult.success) {
    return NextResponse.json(
      { error: "导入请求格式不正确" },
      { status: 400 },
    );
  }

  const parsed = parseQuestionImportText(requestResult.data.text);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.errors, type: "validation" },
      { status: 422 },
    );
  }

  const preview = await previewOwnerQuestionImport(parsed.data);
  return NextResponse.json({ preview });
}
