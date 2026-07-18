import { describe, expect, it } from "vitest";

import { MemoryMockExamStore } from "@/server/repositories/memory-mock-exam-store";
import { MemoryPracticeStore } from "@/server/repositories/memory-practice-store";

describe("本地模考仓库", () => {
  it("由服务端开始时间计算截止时间，刷新读取不会重置", async () => {
    const startedAt = new Date("2026-07-18T02:00:00.000Z");
    const store = new MemoryMockExamStore(() => startedAt);
    const setup = await store.getSetup("owner");

    const started = await store.startSession(
      "owner",
      setup.templates[0].id,
    );

    expect(started.startedAt).toBe("2026-07-18T02:00:00.000Z");
    expect(started.deadlineAt).toBe("2026-07-18T04:00:00.000Z");

    startedAt.setUTCHours(3);

    await expect(
      store.getSession("owner", started.id),
    ).resolves.toEqual(started);
    await expect(
      store.getSession("another-user", started.id),
    ).resolves.toBeNull();
  });

  it("每次作答立即保存，刷新后恢复且提交前不泄露答案", async () => {
    let now = new Date("2026-07-18T02:00:00.000Z");
    const store = new MemoryMockExamStore(() => now);
    const setup = await store.getSetup("owner");
    const started = await store.startSession(
      "owner",
      setup.templates[0].id,
    );

    expect(started.items).toHaveLength(2);
    expect(started.items[0]).not.toHaveProperty("correctKeys");
    expect(started.items[0]).not.toHaveProperty("explanation");

    now = new Date("2026-07-18T02:01:00.000Z");
    const saved = await store.saveAnswer("owner", started.id, 0, ["B"]);

    expect(saved.items[0]).toEqual(
      expect.objectContaining({
        savedAt: "2026-07-18T02:01:00.000Z",
        selectedKeys: ["B"],
      }),
    );
    expect(saved.items[0]).not.toHaveProperty("correctKeys");
    expect(saved.items[0]).not.toHaveProperty("explanation");

    await expect(
      store.getSession("owner", started.id),
    ).resolves.toEqual(saved);
  });

  it("提交后正确判分，并按章节和题型拆解结果", async () => {
    const now = new Date("2026-07-18T02:00:00.000Z");
    const store = new MemoryMockExamStore(() => now);
    const setup = await store.getSetup("owner");
    const started = await store.startSession(
      "owner",
      setup.templates[0].id,
    );

    await store.saveAnswer("owner", started.id, 0, ["B"]);
    await store.saveAnswer("owner", started.id, 1, ["B"]);
    await store.setMarked("owner", started.id, 1, true);
    const submitted = await store.submitSession("owner", started.id);

    expect(submitted).toEqual(
      expect.objectContaining({
        maxScore: 2,
        score: 1,
        status: "submitted",
        submittedAt: "2026-07-18T02:00:00.000Z",
      }),
    );
    expect(submitted.items[0]).toEqual(
      expect.objectContaining({
        correctKeys: ["B"],
        isCorrect: true,
        score: 1,
      }),
    );
    expect(submitted.items[1]).toEqual(
      expect.objectContaining({
        correctKeys: ["A"],
        isCorrect: false,
        isMarked: true,
        score: 0,
      }),
    );
    expect(submitted.result).toEqual({
      byModule: [
        {
          correctCount: 1,
          maxScore: 2,
          moduleTitle: "项目管理概论",
          questionCount: 2,
          score: 1,
        },
      ],
      byType: [
        {
          correctCount: 1,
          maxScore: 2,
          questionCount: 2,
          score: 1,
          type: "single_choice",
        },
      ],
      correctCount: 1,
      questionCount: 2,
    });
  });

  it("超过服务端截止时间后读取会话会自动交卷", async () => {
    let now = new Date("2026-07-18T02:00:00.000Z");
    const store = new MemoryMockExamStore(() => now);
    const setup = await store.getSetup("owner");
    const started = await store.startSession(
      "owner",
      setup.templates[0].id,
    );

    now = new Date("2026-07-18T04:00:01.000Z");
    const expired = await store.getSession("owner", started.id);

    expect(expired).toEqual(
      expect.objectContaining({
        score: 0,
        status: "submitted",
        submittedAt: "2026-07-18T04:00:01.000Z",
      }),
    );
  });

  it("交卷时输出作答记录，供错题和复习队列更新", async () => {
    const attempts: Array<{
      externalId: string;
      isCorrect: boolean;
    }> = [];
    const store = new MemoryMockExamStore(
      () => new Date("2026-07-18T02:00:00.000Z"),
      async (attempt) => {
        attempts.push({
          externalId: attempt.externalId,
          isCorrect: attempt.isCorrect,
        });
      },
    );
    const setup = await store.getSetup("owner");
    const started = await store.startSession(
      "owner",
      setup.templates[0].id,
    );

    await store.saveAnswer("owner", started.id, 0, ["B"]);
    await store.saveAnswer("owner", started.id, 1, ["B"]);
    await store.submitSession("owner", started.id);
    await store.submitSession("owner", started.id);

    expect(attempts).toEqual([
      {
        externalId: "q-project-characteristics-001",
        isCorrect: true,
      },
      {
        externalId: "q-project-constraints-001",
        isCorrect: false,
      },
    ]);
  });

  it("错题实际进入既有错题本和复习队列", async () => {
    const now = new Date("2026-07-18T02:00:00.000Z");
    const practice = new MemoryPracticeStore(Math.random, () => now);
    const store = new MemoryMockExamStore(
      () => now,
      (attempt) => practice.recordMockExamAttempt(attempt),
    );
    const setup = await store.getSetup("owner");
    const started = await store.startSession(
      "owner",
      setup.templates[0].id,
    );

    await store.saveAnswer("owner", started.id, 0, ["A"]);
    await store.submitSession("owner", started.id);

    const mistakes = await practice.getMistakes("owner");
    expect(mistakes).toEqual([
      expect.objectContaining({
        externalId: "q-project-characteristics-001",
        isWrong: true,
        nextReviewAt: expect.any(String),
        wrongAttempts: 1,
      }),
      expect.objectContaining({
        externalId: "q-project-constraints-001",
        isWrong: true,
        nextReviewAt: expect.any(String),
        wrongAttempts: 1,
      }),
    ]);
  });
});
