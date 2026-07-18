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
