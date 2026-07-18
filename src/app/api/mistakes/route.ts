import { NextResponse } from "next/server";

import { mistakeFiltersRequestSchema } from "@/features/review/mistake-request-schema";
import { getOwnerMistakes } from "@/server/services/practice-service";

export async function GET(request: Request) {
  const parameters = Object.fromEntries(new URL(request.url).searchParams);
  const result = mistakeFiltersRequestSchema.safeParse(parameters);

  if (!result.success) {
    return NextResponse.json(
      { error: "错题筛选条件格式不正确" },
      { status: 400 },
    );
  }

  try {
    const mistakes = await getOwnerMistakes(result.data);
    return NextResponse.json({ mistakes });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "读取错题失败",
      },
      { status: 500 },
    );
  }
}
