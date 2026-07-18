import { describe, expect, it } from "vitest";

import {
  mistakeFiltersRequestSchema,
  updateMistakeReasonRequestSchema,
} from "@/features/review/mistake-request-schema";

describe("错题请求校验", () => {
  it("接受可组合的错题筛选参数", () => {
    expect(
      mistakeFiltersRequestSchema.parse({
        lastWrongAfter: "2026-07-01T00:00:00.000Z",
        minWrongAttempts: "2",
        moduleTitle: "项目管理概论",
        reason: "concept_confusion",
        status: "active",
      }),
    ).toEqual({
      lastWrongAfter: "2026-07-01T00:00:00.000Z",
      minWrongAttempts: 2,
      moduleTitle: "项目管理概论",
      reason: "concept_confusion",
      status: "active",
    });
  });

  it("拒绝未知错因和小于一次的错误次数", () => {
    expect(
      updateMistakeReasonRequestSchema.safeParse({
        reason: "unknown",
      }).success,
    ).toBe(false);
    expect(
      mistakeFiltersRequestSchema.safeParse({
        minWrongAttempts: "0",
      }).success,
    ).toBe(false);
  });
});
