import { describe, expect, it } from "vitest";

import {
  startPracticeRequestSchema,
  submitPracticeAnswerRequestSchema,
} from "@/features/practice/practice-request-schema";
import {
  MAX_QUESTION_IMPORT_FILE_BYTES,
  questionImportRequestSchema,
} from "@/features/practice/question-import-request";

describe("练习请求校验", () => {
  it("章节练习必须选择模块并限制题量", () => {
    expect(
      startPracticeRequestSchema.safeParse({
        count: 10,
        mode: "chapter",
      }).success,
    ).toBe(false);
    expect(
      startPracticeRequestSchema.safeParse({
        count: 101,
        mode: "random",
      }).success,
    ).toBe(false);
  });

  it("允许创建到期错题复习会话", () => {
    expect(
      startPracticeRequestSchema.safeParse({
        count: 20,
        mode: "review",
      }).success,
    ).toBe(true);
  });

  it("指定错题只能用于复习模式", () => {
    expect(
      startPracticeRequestSchema.safeParse({
        count: 1,
        mode: "review",
        questionExternalId: "q-project-characteristics-001",
      }).success,
    ).toBe(true);
    expect(
      startPracticeRequestSchema.safeParse({
        count: 1,
        mode: "random",
        questionExternalId: "q-project-characteristics-001",
      }).success,
    ).toBe(false);
  });

  it("拒绝重复答案和超过2MB的题目导入请求", () => {
    expect(
      submitPracticeAnswerRequestSchema.safeParse({
        confidence: "certain",
        selectedKeys: ["A", "A"],
      }).success,
    ).toBe(false);
    expect(
      questionImportRequestSchema.safeParse({
        fileName: "questions.json",
        text: "好".repeat(MAX_QUESTION_IMPORT_FILE_BYTES),
      }).success,
    ).toBe(false);
  });
});
