import { describe, expect, it } from "vitest";

import { MemoryPracticeStore } from "@/server/repositories/memory-practice-store";
import type { QuestionImportPayload } from "@/features/practice/question-import-schema";

describe("本地练习仓库", () => {
  it("提供真实可用题量，并随历史作答更新未做题数量", async () => {
    const store = new MemoryPracticeStore();

    await expect(store.getSetup("owner")).resolves.toEqual({
      modules: [{ count: 2, title: "项目管理概论" }],
      totalAvailable: 2,
      unansweredAvailable: 2,
    });

    const session = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    await store.submitAnswer("owner", session.id, {
      confidence: "certain",
      selectedKeys: ["B"],
    });

    await expect(store.getSetup("owner")).resolves.toEqual(
      expect.objectContaining({ unansweredAvailable: 1 }),
    );
  });

  it("提交前隐藏答案，提交后判分并在刷新会话时保留结果", async () => {
    const store = new MemoryPracticeStore();
    const started = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });

    expect(started.current.feedback).toBeNull();
    expect(started.current.selectedKeys).toEqual([]);

    const answered = await store.submitAnswer("owner", started.id, {
      confidence: "uncertain",
      selectedKeys: ["B"],
    });

    expect(answered.current.feedback).toEqual(
      expect.objectContaining({
        correctKeys: ["B"],
        explanation: expect.any(String),
        isCorrect: true,
      }),
    );
    expect(answered.current.selectedKeys).toEqual(["B"]);
    expect(answered.attemptCount).toBe(1);
    expect(answered.current.attemptHistory).toHaveLength(1);

    await expect(
      store.getSession("owner", started.id),
    ).resolves.toEqual(answered);
  });

  it("未做题模式排除已经作答过的题目", async () => {
    const store = new MemoryPracticeStore();
    const first = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    await store.submitAnswer("owner", first.id, {
      confidence: "certain",
      selectedKeys: ["B"],
    });

    const unanswered = await store.startSession("owner", {
      count: 10,
      mode: "unanswered",
    });

    expect(unanswered.current.externalId).not.toBe(
      first.current.externalId,
    );
  });

  it("题目导入保持幂等且章节模式只选择指定模块", async () => {
    const store = new MemoryPracticeStore();
    const payload: QuestionImportPayload = {
      schema_version: "1.0",
      exam_code: "system-integration-project-management-engineer",
      items: [
        {
          external_id: "q-information-lifecycle-001",
          type: "single_choice",
          stem_md: "信息系统上线后进入持续运行支持，属于哪个阶段？",
          options: [
            { key: "A", content_md: "规划" },
            { key: "B", content_md: "运行维护" },
          ],
          answer: { keys: ["B"] },
          explanation_md: "上线后的持续支持属于运行维护。",
          difficulty: 1,
          importance: "B",
          knowledge_point_external_ids: ["kp-information-lifecycle"],
          tags: ["信息化发展"],
          source: {
            type: "self_authored",
            note: "原创练习题，非真题",
            copyright_status: "self_authored",
          },
          review_status: "published",
          version: 1,
        },
      ],
    };
    const knowledge = [
      {
        externalId: "kp-information-lifecycle",
        syllabusPath: ["信息化发展", "信息系统基础"],
      },
    ];

    const first = await store.importQuestions(
      "owner",
      payload,
      "questions.json",
      knowledge,
    );
    const second = await store.importQuestions(
      "owner",
      payload,
      "questions.json",
      knowledge,
    );

    expect(first.counts.inserted).toBe(1);
    expect(second.counts.skipped).toBe(1);

    const session = await store.startSession("owner", {
      count: 10,
      mode: "chapter",
      moduleTitle: "信息化发展",
    });
    expect(session.total).toBe(1);
    expect(session.current.externalId).toBe(
      "q-information-lifecycle-001",
    );
  });

  it("保存题目位置、已答题号和收藏状态，并按用户隔离", async () => {
    const store = new MemoryPracticeStore();
    const session = await store.startSession("owner", {
      count: 2,
      mode: "sequential",
    });

    await store.submitAnswer("owner", session.id, {
      confidence: "certain",
      selectedKeys: ["B"],
    });
    const second = await store.navigateSession("owner", session.id, 1);
    await store.setFavorite(
      "owner",
      second.current.externalId,
      true,
    );

    const restored = await store.getSession("owner", session.id);
    expect(restored).toEqual(
      expect.objectContaining({
        answeredIndexes: [0],
        currentIndex: 1,
      }),
    );
    expect(restored?.current.isFavorite).toBe(true);
    await expect(store.getSession("someone-else", session.id)).resolves.toBeNull();

    const otherUser = await store.startSession("someone-else", {
      count: 2,
      mode: "sequential",
    });
    const otherSecond = await store.navigateSession(
      "someone-else",
      otherUser.id,
      1,
    );
    expect(otherSecond.current.isFavorite).toBe(false);
  });

  it("随机练习不会重复，并保留同一题的每次历史作答", async () => {
    const store = new MemoryPracticeStore(() => 0);
    const random = await store.startSession("owner", {
      count: 2,
      mode: "random",
    });
    const firstExternalId = random.current.externalId;
    const second = await store.navigateSession("owner", random.id, 1);

    expect(second.current.externalId).not.toBe(firstExternalId);

    const firstSession = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    await store.submitAnswer("owner", firstSession.id, {
      confidence: "certain",
      selectedKeys: ["B"],
    });
    const secondSession = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    const answeredAgain = await store.submitAnswer(
      "owner",
      secondSession.id,
      {
        confidence: "uncertain",
        selectedKeys: ["A"],
      },
    );

    expect(answeredAgain.current.attemptHistory).toHaveLength(2);
    expect(
      answeredAgain.current.attemptHistory.map(
        (attempt) => attempt.questionVersion,
      ),
    ).toEqual([1, 1]);
  });

  it("题目新版本不会改变旧会话，并在历史中保留各次版本", async () => {
    const store = new MemoryPracticeStore();
    const oldSession = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    const oldAnswered = await store.submitAnswer("owner", oldSession.id, {
      confidence: "certain",
      selectedKeys: ["B"],
    });

    const versionTwo: QuestionImportPayload = {
      schema_version: "1.0",
      exam_code: "system-integration-project-management-engineer",
      items: [
        {
          external_id: "q-project-characteristics-001",
          type: "single_choice",
          stem_md: "项目区别于日常运营的核心特征是什么？",
          options: [
            { key: "A", content_md: "无限期持续" },
            { key: "B", content_md: "只能产生实体产品" },
            { key: "C", content_md: "临时性与独特性" },
          ],
          answer: { keys: ["C"] },
          explanation_md: "项目具有临时性，并创造独特成果。",
          difficulty: 1,
          importance: "A",
          knowledge_point_external_ids: [
            "kp-project-characteristics",
          ],
          tags: ["项目管理概论"],
          source: {
            type: "self_authored",
            note: "原创练习题第二版，非真题",
            copyright_status: "self_authored",
          },
          review_status: "published",
          version: 2,
        },
      ],
    };
    const report = await store.importQuestions(
      "owner",
      versionTwo,
      "questions-v2.json",
      [
        {
          externalId: "kp-project-characteristics",
          syllabusPath: ["项目管理概论", "项目与项目管理"],
        },
      ],
    );

    expect(report.counts.updated).toBe(1);
    await expect(store.getSession("owner", oldSession.id)).resolves.toEqual(
      oldAnswered,
    );

    const newSession = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    expect(newSession.current.version).toBe(2);
    const newAnswered = await store.submitAnswer("owner", newSession.id, {
      confidence: "certain",
      selectedKeys: ["C"],
    });
    expect(
      newAnswered.current.attemptHistory.map(
        (attempt) => attempt.questionVersion,
      ),
    ).toEqual([1, 2]);
  });

  it("答错后自动进入错题本，并按上海自然日在次日零点到期", async () => {
    const now = new Date("2026-07-18T15:30:00.000Z");
    const store = new MemoryPracticeStore(Math.random, () => now);
    const session = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });

    await store.submitAnswer("owner", session.id, {
      confidence: "certain",
      selectedKeys: ["A"],
    });

    await expect(store.getMistakes("owner")).resolves.toEqual([
      expect.objectContaining({
        consecutiveCorrect: 0,
        externalId: "q-project-characteristics-001",
        isFavorite: false,
        isWrong: true,
        nextReviewAt: "2026-07-18T16:00:00.000Z",
        reviewLevel: 0,
        wrongAttempts: 1,
      }),
    ]);
  });

  it("复习答对但不确定时提升一级并在三个自然日后到期", async () => {
    let now = new Date("2026-07-18T15:30:00.000Z");
    const store = new MemoryPracticeStore(Math.random, () => now);
    const first = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    await store.submitAnswer("owner", first.id, {
      confidence: "certain",
      selectedKeys: ["A"],
    });

    now = new Date("2026-07-19T01:00:00.000Z");
    const review = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    await store.submitAnswer("owner", review.id, {
      confidence: "uncertain",
      selectedKeys: ["B"],
    });

    await expect(store.getMistakes("owner")).resolves.toEqual([
      expect.objectContaining({
        consecutiveCorrect: 1,
        isWrong: true,
        nextReviewAt: "2026-07-21T16:00:00.000Z",
        reviewLevel: 1,
      }),
    ]);
  });

  it("复习答对且确定时提升两级并在七个自然日后到期", async () => {
    let now = new Date("2026-07-18T01:00:00.000Z");
    const store = new MemoryPracticeStore(Math.random, () => now);
    const first = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    await store.submitAnswer("owner", first.id, {
      confidence: "certain",
      selectedKeys: ["A"],
    });

    now = new Date("2026-07-19T01:00:00.000Z");
    const review = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    await store.submitAnswer("owner", review.id, {
      confidence: "certain",
      selectedKeys: ["B"],
    });

    await expect(store.getMistakes("owner")).resolves.toEqual([
      expect.objectContaining({
        consecutiveCorrect: 1,
        isWrong: true,
        nextReviewAt: "2026-07-25T16:00:00.000Z",
        reviewLevel: 2,
      }),
    ]);
  });

  it("连续两次复习答对后保留错题历史并标记暂时掌握", async () => {
    let now = new Date("2026-07-18T01:00:00.000Z");
    const store = new MemoryPracticeStore(Math.random, () => now);

    for (const answer of [
      { at: "2026-07-18T01:00:00.000Z", key: "A" },
      { at: "2026-07-19T01:00:00.000Z", key: "B" },
      { at: "2026-07-26T01:00:00.000Z", key: "B" },
    ]) {
      now = new Date(answer.at);
      const session = await store.startSession("owner", {
        count: 1,
        mode: "sequential",
      });
      await store.submitAnswer("owner", session.id, {
        confidence: "certain",
        selectedKeys: [answer.key],
      });
    }

    await expect(store.getMistakes("owner")).resolves.toEqual([
      expect.objectContaining({
        consecutiveCorrect: 2,
        isWrong: false,
        masteredAt: "2026-07-26T01:00:00.000Z",
        reviewLevel: 4,
        wrongAttempts: 1,
      }),
    ]);
  });

  it("允许设置错因并按用户隔离", async () => {
    const store = new MemoryPracticeStore();
    const session = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    await store.submitAnswer("owner", session.id, {
      confidence: "certain",
      selectedKeys: ["A"],
    });

    await store.setMistakeReason(
      "owner",
      session.current.externalId,
      "concept_confusion",
    );

    await expect(store.getMistakes("owner")).resolves.toEqual([
      expect.objectContaining({
        errorReason: "concept_confusion",
      }),
    ]);
    await expect(store.getMistakes("another-user")).resolves.toEqual([]);
  });

  it("手动标记掌握会暂停复习但不会取消收藏", async () => {
    const now = new Date("2026-07-18T01:00:00.000Z");
    const store = new MemoryPracticeStore(Math.random, () => now);
    const session = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    await store.submitAnswer("owner", session.id, {
      confidence: "certain",
      selectedKeys: ["A"],
    });
    await store.setFavorite(
      "owner",
      session.current.externalId,
      true,
    );

    await store.markMistakeMastered(
      "owner",
      session.current.externalId,
    );

    await expect(store.getMistakes("owner")).resolves.toEqual([
      expect.objectContaining({
        isFavorite: true,
        isWrong: false,
        masteredAt: "2026-07-18T01:00:00.000Z",
        nextReviewAt: null,
      }),
    ]);
  });

  it("复习模式只抽取到期和逾期题目", async () => {
    let now = new Date("2026-07-18T01:00:00.000Z");
    const store = new MemoryPracticeStore(Math.random, () => now);
    const first = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    await store.submitAnswer("owner", first.id, {
      confidence: "certain",
      selectedKeys: ["A"],
    });

    now = new Date("2026-07-20T01:00:00.000Z");
    await expect(store.getMistakes("owner")).resolves.toEqual([
      expect.objectContaining({ dueStatus: "overdue" }),
    ]);

    const review = await store.startSession("owner", {
      count: 10,
      mode: "review",
    });
    expect(review.mode).toBe("review");
    expect(review.total).toBe(1);
    expect(review.current.externalId).toBe(
      first.current.externalId,
    );
  });

  it("活动筛选只返回仍在复习队列中的错题", async () => {
    const store = new MemoryPracticeStore();
    const session = await store.startSession("owner", {
      count: 2,
      mode: "sequential",
    });
    await store.submitAnswer("owner", session.id, {
      confidence: "certain",
      selectedKeys: ["A"],
    });
    const second = await store.navigateSession("owner", session.id, 1);
    await store.submitAnswer("owner", second.id, {
      confidence: "certain",
      selectedKeys: ["B"],
    });
    await store.markMistakeMastered(
      "owner",
      session.current.externalId,
    );

    const active = await store.getMistakes("owner", {
      status: "active",
    });

    expect(active).toHaveLength(1);
    expect(active[0]).toEqual(
      expect.objectContaining({
        externalId: second.current.externalId,
        isWrong: true,
      }),
    );
  });

  it("模块、错因、错误次数和最近错误时间筛选可以组合", async () => {
    let now = new Date("2026-07-01T01:00:00.000Z");
    const store = new MemoryPracticeStore(Math.random, () => now);
    const session = await store.startSession("owner", {
      count: 2,
      mode: "sequential",
    });
    await store.submitAnswer("owner", session.id, {
      confidence: "certain",
      selectedKeys: ["A"],
    });
    await store.setMistakeReason(
      "owner",
      session.current.externalId,
      "concept_confusion",
    );

    now = new Date("2026-07-18T01:00:00.000Z");
    const second = await store.navigateSession("owner", session.id, 1);
    await store.submitAnswer("owner", second.id, {
      confidence: "certain",
      selectedKeys: ["B"],
    });
    await store.setMistakeReason(
      "owner",
      second.current.externalId,
      "careless",
    );

    const filtered = await store.getMistakes("owner", {
      lastWrongAfter: "2026-07-10T00:00:00.000Z",
      minWrongAttempts: 1,
      moduleTitle: "项目管理概论",
      reason: "careless",
    });

    expect(filtered).toEqual([
      expect.objectContaining({
        errorReason: "careless",
        externalId: second.current.externalId,
        lastWrongAt: "2026-07-18T01:00:00.000Z",
        wrongAttempts: 1,
      }),
    ]);
  });

  it("未到期题不会进入复习会话", async () => {
    const now = new Date("2026-07-18T01:00:00.000Z");
    const store = new MemoryPracticeStore(Math.random, () => now);
    const session = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    await store.submitAnswer("owner", session.id, {
      confidence: "certain",
      selectedKeys: ["A"],
    });

    await expect(
      store.startSession("owner", {
        count: 10,
        mode: "review",
      }),
    ).rejects.toThrow("当前没有到期或逾期错题");
  });

  it("复习队列按用户隔离", async () => {
    let now = new Date("2026-07-18T01:00:00.000Z");
    const store = new MemoryPracticeStore(Math.random, () => now);
    const session = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    await store.submitAnswer("owner", session.id, {
      confidence: "certain",
      selectedKeys: ["A"],
    });
    now = new Date("2026-07-19T16:00:00.000Z");

    await expect(
      store.startSession("another-user", {
        count: 10,
        mode: "review",
      }),
    ).rejects.toThrow("当前没有到期或逾期错题");
  });

  it("可以立即再练指定的历史错题且不混入其他题目", async () => {
    const now = new Date("2026-07-18T01:00:00.000Z");
    const store = new MemoryPracticeStore(Math.random, () => now);
    const session = await store.startSession("owner", {
      count: 1,
      mode: "sequential",
    });
    await store.submitAnswer("owner", session.id, {
      confidence: "certain",
      selectedKeys: ["A"],
    });

    const retry = await store.startSession("owner", {
      count: 10,
      mode: "review",
      questionExternalId: session.current.externalId,
    });

    expect(retry.total).toBe(1);
    expect(retry.current.externalId).toBe(
      session.current.externalId,
    );
  });
});
