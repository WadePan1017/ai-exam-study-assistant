import { NextResponse } from "next/server";

import { knowledgeImportRequestSchema } from "@/features/knowledge/knowledge-import-request";
import { parseKnowledgeImportText } from "@/features/knowledge/knowledge-import-schema";
import {
  commitOwnerKnowledgeImport,
  previewOwnerKnowledgeImport,
} from "@/server/services/learning-content-service";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const requestResult = knowledgeImportRequestSchema.safeParse(body);

  if (!requestResult.success) {
    return NextResponse.json(
      { error: "导入请求格式不正确" },
      { status: 400 },
    );
  }

  const parsed = parseKnowledgeImportText(requestResult.data.text);

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.errors, type: "validation" },
      { status: 422 },
    );
  }

  const preview = await previewOwnerKnowledgeImport(parsed.data);
  if (preview.counts.reject > 0) {
    return NextResponse.json(
      { error: "预览中存在拒绝项，未执行导入", preview },
      { status: 409 },
    );
  }

  const report = await commitOwnerKnowledgeImport(
    parsed.data,
    requestResult.data.fileName,
  );

  return NextResponse.json(
    { report },
    { status: report.status === "completed" ? 200 : 422 },
  );
}
