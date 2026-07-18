import { describe, expect, it } from "vitest";

import {
  getReviewDueStatus,
  updateReviewProgress,
} from "@/features/review/review-schedule";

describe("间隔复习算法", () => {
  it("暂时掌握后再次答错会重置等级并在次日到期", () => {
    const attemptedAt = new Date("2026-12-31T15:30:00.000Z");
    const result = updateReviewProgress(
      {
        consecutiveCorrect: 4,
        isWrong: false,
        masteredAt: new Date("2026-11-01T01:00:00.000Z"),
        nextReviewAt: new Date("2027-01-01T16:00:00.000Z"),
        reviewLevel: 5,
      },
      {
        attemptedAt,
        confidence: "certain",
        isCorrect: false,
      },
      "Asia/Shanghai",
    );

    expect(result).toEqual({
      consecutiveCorrect: 0,
      isWrong: true,
      masteredAt: null,
      nextReviewAt: new Date("2026-12-31T16:00:00.000Z"),
      reviewLevel: 0,
    });
  });

  it("复习等级最高不会超过五级", () => {
    const attemptedAt = new Date("2026-07-18T01:00:00.000Z");
    const result = updateReviewProgress(
      {
        consecutiveCorrect: 0,
        isWrong: true,
        masteredAt: null,
        nextReviewAt: attemptedAt,
        reviewLevel: 5,
      },
      {
        attemptedAt,
        confidence: "certain",
        isCorrect: true,
      },
      "Asia/Shanghai",
    );

    expect(result).toEqual(
      expect.objectContaining({
        nextReviewAt: new Date("2026-09-15T16:00:00.000Z"),
        reviewLevel: 5,
      }),
    );
  });

  it("今日到期和逾期按上海自然日区分", () => {
    const dueAt = new Date("2026-07-18T16:00:00.000Z");

    expect(
      getReviewDueStatus(
        dueAt,
        new Date("2026-07-19T15:59:59.000Z"),
        "Asia/Shanghai",
      ),
    ).toBe("due_today");
    expect(
      getReviewDueStatus(
        dueAt,
        new Date("2026-07-19T16:00:00.000Z"),
        "Asia/Shanghai",
      ),
    ).toBe("overdue");
  });
});
