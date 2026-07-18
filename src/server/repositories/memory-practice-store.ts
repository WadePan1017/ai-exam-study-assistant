import { gradeObjectiveAnswer } from "@/features/practice/objective-grading";
import { previewQuestionImport } from "@/features/practice/question-import-preview";
import type {
  QuestionImportItem,
  QuestionImportPayload,
} from "@/features/practice/question-import-schema";
import type { ImportReport } from "./learning-content-store";
import type {
  KnowledgeReference,
  PracticeSessionView,
  PracticeStore,
  StartPracticeInput,
  SubmitPracticeAnswerInput,
} from "./practice-store";

const seedQuestions: QuestionImportItem[] = [{
  external_id: "q-project-characteristics-001",
  type: "single_choice",
  stem_md: "以下哪项最符合项目的基本特征？",
  options: [
    { key: "A", content_md: "持续重复且没有明确结束边界" },
    { key: "B", content_md: "为创造独特成果开展的临时性工作" },
    { key: "C", content_md: "只能由外部客户发起" },
    { key: "D", content_md: "只包括大型工程建设" },
  ],
  answer: { keys: ["B"] },
  explanation_md:
    "项目具有临时性和独特性；规模大小和发起方都不是项目成立的必要条件。",
  difficulty: 1,
  importance: "A",
  knowledge_point_external_ids: ["kp-project-characteristics"],
  tags: ["项目管理概论", "基础概念"],
  source: {
    type: "self_authored",
    note: "项目原创练习题，非真题",
    copyright_status: "self_authored",
  },
  review_status: "published",
  version: 1,
}, {
  external_id: "q-project-constraints-001",
  type: "single_choice",
  stem_md: "项目经理平衡范围、进度、成本等相互影响的因素，最能说明什么？",
  options: [
    { key: "A", content_md: "项目制约因素之间存在关联" },
    { key: "B", content_md: "只需要优先控制成本" },
    { key: "C", content_md: "项目范围一经确定便不会变化" },
    { key: "D", content_md: "所有项目采用相同的管理方式" },
  ],
  answer: { keys: ["A"] },
  explanation_md:
    "范围、进度、成本、质量、资源和风险等因素会相互影响，调整其中一项通常需要评估其他因素。",
  difficulty: 1,
  importance: "A",
  knowledge_point_external_ids: ["kp-project-characteristics"],
  tags: ["项目管理概论", "项目制约因素"],
  source: {
    type: "self_authored",
    note: "项目原创练习题，非真题",
    copyright_status: "self_authored",
  },
  review_status: "published",
  version: 1,
}];

type SessionAnswer = {
  selectedKeys: string[];
  confidence: "certain" | "uncertain";
  isCorrect: boolean;
  score: number;
};

type StoredSession = {
  id: string;
  startedAt: string;
  userId: string;
  mode: StartPracticeInput["mode"];
  status: "in_progress" | "completed";
  currentIndex: number;
  questions: QuestionImportItem[];
  answers: Map<number, SessionAnswer>;
};

type StoredAttempt = {
  id: string;
  userId: string;
  questionExternalId: string;
  questionVersion: number;
  selectedKeys: string[];
  isCorrect: boolean;
  confidence: "certain" | "uncertain";
  createdAt: string;
};

export class MemoryPracticeStore implements PracticeStore {
  private readonly questions: QuestionImportItem[] = seedQuestions.map(
    (question) => structuredClone(question),
  );
  private readonly questionModules = new Map<string, string[]>([
    ...seedQuestions.map(
      (question) =>
        [
          question.external_id,
          ["项目管理概论"],
        ] as [string, string[]],
    ),
  ]);
  private readonly sessions = new Map<string, StoredSession>();
  private readonly attempts: StoredAttempt[] = [];
  private readonly favorites = new Set<string>();

  constructor(private readonly random: () => number = Math.random) {}

  private favoriteKey(userId: string, externalId: string) {
    return `${userId}:${externalId}`;
  }

  private shuffle(questions: QuestionImportItem[]) {
    const shuffled = [...questions];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[index],
      ];
    }
    return shuffled;
  }

  async getSetup(userId: string) {
    const available = this.currentQuestions().filter(
      (question) => question.review_status === "published",
    );
    const answeredExternalIds = new Set(
      this.attempts
        .filter((attempt) => attempt.userId === userId)
        .map((attempt) => attempt.questionExternalId),
    );
    const moduleCounts = new Map<string, number>();

    for (const question of available) {
      const moduleTitles =
        this.questionModules.get(question.external_id) ?? [];
      for (const moduleTitle of moduleTitles) {
        moduleCounts.set(
          moduleTitle,
          (moduleCounts.get(moduleTitle) ?? 0) + 1,
        );
      }
    }

    return {
      modules: Array.from(moduleCounts, ([title, count]) => ({
        count,
        title,
      })).sort((left, right) =>
        left.title.localeCompare(right.title, "zh-CN"),
      ),
      totalAvailable: available.length,
      unansweredAvailable: available.filter(
        (question) => !answeredExternalIds.has(question.external_id),
      ).length,
    };
  }

  private currentQuestions() {
    const currentByExternalId = new Map<string, QuestionImportItem>();

    for (const question of this.questions) {
      const current = currentByExternalId.get(question.external_id);
      if (!current || question.version > current.version) {
        currentByExternalId.set(question.external_id, question);
      }
    }

    return Array.from(currentByExternalId.values());
  }

  private toView(session: StoredSession): PracticeSessionView {
    const question = session.questions[session.currentIndex];
    const answer = session.answers.get(session.currentIndex);

    return {
      answeredIndexes: Array.from(session.answers.keys()).sort(
        (left, right) => left - right,
      ),
      attemptCount: session.answers.size,
      current: {
        attemptHistory: answer
          ? this.attempts
              .filter(
                (attempt) =>
                  attempt.userId === session.userId &&
                  attempt.questionExternalId === question.external_id,
              )
              .map((attempt) => ({
                confidence: attempt.confidence,
                createdAt: attempt.createdAt,
                id: attempt.id,
                isCorrect: attempt.isCorrect,
                questionVersion: attempt.questionVersion,
                selectedKeys: [...attempt.selectedKeys],
              }))
          : [],
        confidence: answer?.confidence ?? null,
        externalId: question.external_id,
        feedback: answer
          ? {
              correctKeys: [...question.answer.keys],
              explanation: question.explanation_md,
              isCorrect: answer.isCorrect,
              score: answer.score,
            }
          : null,
        isFavorite: this.favorites.has(
          this.favoriteKey(session.userId, question.external_id),
        ),
        knowledgePointExternalIds: [
          ...question.knowledge_point_external_ids,
        ],
        options: question.options.map((option) => ({
          content: option.content_md,
          key: option.key,
        })),
        selectedKeys: answer ? [...answer.selectedKeys] : [],
        stem: question.stem_md,
        type: question.type,
        version: question.version,
      },
      currentIndex: session.currentIndex,
      id: session.id,
      mode: session.mode,
      startedAt: session.startedAt,
      status: session.status,
      total: session.questions.length,
    };
  }

  async startSession(userId: string, input: StartPracticeInput) {
    let candidates = this.currentQuestions()
      .filter((question) => question.review_status === "published");
    if (input.mode === "unanswered") {
      const answeredExternalIds = new Set(
        this.attempts
          .filter((attempt) => attempt.userId === userId)
          .map((attempt) => attempt.questionExternalId),
      );
      candidates = candidates.filter(
        (question) => !answeredExternalIds.has(question.external_id),
      );
    }
    if (input.mode === "chapter") {
      candidates = candidates.filter(
        (question) =>
          this.questionModules
            .get(question.external_id)
            ?.includes(input.moduleTitle ?? "") ?? false,
      );
    }
    if (input.mode === "random") {
      candidates = this.shuffle(candidates);
    }
    const questions = candidates.slice(0, input.count);

    if (questions.length === 0) {
      throw new Error("当前筛选条件下没有可练习的题目");
    }

    const session: StoredSession = {
      answers: new Map(),
      currentIndex: 0,
      id: crypto.randomUUID(),
      mode: input.mode,
      questions,
      startedAt: new Date().toISOString(),
      status: "in_progress",
      userId,
    };
    this.sessions.set(session.id, session);

    return this.toView(session);
  }

  async getSession(userId: string, sessionId: string) {
    const session = this.sessions.get(sessionId);
    return session?.userId === userId ? this.toView(session) : null;
  }

  async navigateSession(
    userId: string,
    sessionId: string,
    index: number,
  ) {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("练习会话不存在");
    }
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= session.questions.length
    ) {
      throw new Error("题号超出当前练习范围");
    }

    session.currentIndex = index;
    return this.toView(session);
  }

  async submitAnswer(
    userId: string,
    sessionId: string,
    input: SubmitPracticeAnswerInput,
  ) {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("练习会话不存在");
    }
    if (session.answers.has(session.currentIndex)) {
      throw new Error("本题已经提交过答案");
    }

    const question = session.questions[session.currentIndex];
    const result = gradeObjectiveAnswer(
      question.type,
      question.answer.keys,
      input.selectedKeys,
    );
    session.answers.set(session.currentIndex, {
      ...result,
      confidence: input.confidence,
      selectedKeys: [...input.selectedKeys],
    });
    this.attempts.push({
      confidence: input.confidence,
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID(),
      isCorrect: result.isCorrect,
      questionExternalId: question.external_id,
      questionVersion: question.version,
      selectedKeys: [...input.selectedKeys],
      userId,
    });
    if (session.answers.size === session.questions.length) {
      session.status = "completed";
    }

    return this.toView(session);
  }

  async setFavorite(
    userId: string,
    externalId: string,
    isFavorite: boolean,
  ) {
    const questionExists = this.currentQuestions().some(
      (question) => question.external_id === externalId,
    );
    if (!questionExists) {
      throw new Error("题目不存在");
    }

    const key = this.favoriteKey(userId, externalId);
    if (isFavorite) {
      this.favorites.add(key);
    } else {
      this.favorites.delete(key);
    }
  }

  async previewQuestions(
    payload: QuestionImportPayload,
    knowledge: readonly KnowledgeReference[],
  ) {
    return previewQuestionImport(
      payload,
      this.currentQuestions().map((question) => ({
        externalId: question.external_id,
        version: question.version,
      })),
      knowledge.map((item) => item.externalId),
    );
  }

  async importQuestions(
    _userId: string,
    payload: QuestionImportPayload,
    fileName: string,
    knowledge: readonly KnowledgeReference[],
  ): Promise<ImportReport> {
    const preview = await this.previewQuestions(payload, knowledge);
    const errors = preview.items
      .filter((item) => item.action === "reject")
      .map((item) => ({
        externalId: item.externalId,
        message: item.message,
      }));

    if (errors.length > 0) {
      return {
        counts: {
          failed: errors.length,
          inserted: 0,
          skipped: 0,
          updated: 0,
        },
        errors,
        fileName,
        jobId: crypto.randomUUID(),
        status: "failed",
      };
    }

    const knowledgeById = new Map(
      knowledge.map((item) => [item.externalId, item]),
    );
    for (const previewItem of preview.items) {
      if (
        previewItem.action !== "insert" &&
        previewItem.action !== "update"
      ) {
        continue;
      }

      const question = payload.items.find(
        (item) => item.external_id === previewItem.externalId,
      );
      if (!question) {
        continue;
      }

      this.questions.push(structuredClone(question));
      const moduleTitles = Array.from(
        new Set(
          question.knowledge_point_external_ids
            .map(
              (externalId) =>
                knowledgeById.get(externalId)?.syllabusPath[0],
            )
            .filter((title): title is string => Boolean(title)),
        ),
      );
      if (moduleTitles.length > 0) {
        this.questionModules.set(
          question.external_id,
          moduleTitles,
        );
      }
    }

    return {
      counts: {
        failed: 0,
        inserted: preview.counts.insert,
        skipped: preview.counts.skip,
        updated: preview.counts.update,
      },
      errors: [],
      fileName,
      jobId: crypto.randomUUID(),
      status: "completed",
    };
  }
}
