import { describe, expect, it } from "vitest";

import { gradeObjectiveAnswer } from "@/features/practice/objective-grading";

describe("客观题判分", () => {
  it("单选题只有精确匹配标准答案才得分", () => {
    expect(
      gradeObjectiveAnswer("single_choice", ["B"], ["B"]),
    ).toEqual({ isCorrect: true, score: 1 });
    expect(
      gradeObjectiveAnswer("single_choice", ["B"], ["A"]),
    ).toEqual({ isCorrect: false, score: 0 });
  });

  it("多选题不受选择顺序影响但必须全部选对", () => {
    expect(
      gradeObjectiveAnswer("multiple_choice", ["A", "C"], ["C", "A"]),
    ).toEqual({ isCorrect: true, score: 1 });
    expect(
      gradeObjectiveAnswer("multiple_choice", ["A", "C"], ["A"]),
    ).toEqual({ isCorrect: false, score: 0 });
    expect(
      gradeObjectiveAnswer("multiple_choice", ["A", "C"], ["A", "B", "C"]),
    ).toEqual({ isCorrect: false, score: 0 });
  });
});
