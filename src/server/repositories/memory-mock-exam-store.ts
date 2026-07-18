import { gradeObjectiveAnswer } from "@/features/practice/objective-grading";
import type {
  MockExamItemView,
  MockExamAttemptRecord,
  MockExamResult,
  MockExamSessionView,
  MockExamStore,
  MockExamTemplateView,
} from "./mock-exam-store";

type StoredSession = Omit<MockExamSessionView, "items"> & {
  items: StoredItem[];
  userId: string;
};

type StoredItem = Omit<
  MockExamItemView,
  "correctKeys" | "explanation" | "isCorrect" | "score"
> & {
  correctKeys: string[];
  explanation: string;
  moduleTitle: string;
  weight: number;
  isCorrect: boolean | null;
  score: number | null;
};

const questions: StoredItem[] = [{
  correctKeys: ["B"],
  explanation: "项目具有临时性和独特性。",
  externalId: "q-project-characteristics-001",
  isMarked: false,
  isCorrect: null,
  moduleTitle: "项目管理概论",
  options: [
    { key: "A", content: "持续重复且没有明确结束边界" },
    { key: "B", content: "为创造独特成果开展的临时性工作" },
    { key: "C", content: "只能由外部客户发起" },
    { key: "D", content: "只包括大型工程建设" },
  ],
  position: 0,
  savedAt: null,
  score: null,
  selectedKeys: [],
  stem: "以下哪项最符合项目的基本特征？",
  type: "single_choice",
  version: 1,
  weight: 1,
}, {
  correctKeys: ["A"],
  explanation: "范围、进度、成本等项目制约因素会相互影响。",
  externalId: "q-project-constraints-001",
  isMarked: false,
  isCorrect: null,
  moduleTitle: "项目管理概论",
  options: [
    { key: "A", content: "项目制约因素之间存在关联" },
    { key: "B", content: "只需要优先控制成本" },
    { key: "C", content: "项目范围一经确定便不会变化" },
    { key: "D", content: "所有项目采用相同的管理方式" },
  ],
  position: 1,
  savedAt: null,
  score: null,
  selectedKeys: [],
  stem: "项目经理平衡范围、进度、成本等相互影响的因素，最能说明什么？",
  type: "single_choice",
  version: 1,
  weight: 1,
}];

const template: MockExamTemplateView = {
  durationMinutes: 120,
  id: "10000000-0000-4000-8000-000000000001",
  maxScore: 2,
  mode: "fixed",
  name: "客观题基础模拟",
  questionCount: 2,
};

export class MemoryMockExamStore implements MockExamStore {
  private readonly sessions = new Map<string, StoredSession>();

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly recordAttempt: (
      attempt: MockExamAttemptRecord,
    ) => Promise<void> = async () => {},
  ) {}

  async getSetup(userId: string) {
    void userId;
    return { templates: [template] };
  }

  async startSession(userId: string, templateId: string) {
    if (templateId !== template.id) {
      throw new Error("模考模板不存在");
    }

    const startedAt = this.now();
    const session: StoredSession = {
      deadlineAt: new Date(
        startedAt.getTime() + template.durationMinutes * 60_000,
      ).toISOString(),
      id: crypto.randomUUID(),
      items: questions.map((question) => structuredClone(question)),
      maxScore: questions.reduce(
        (total, question) => total + question.weight,
        0,
      ),
      result: null,
      score: null,
      startedAt: startedAt.toISOString(),
      status: "in_progress",
      submittedAt: null,
      templateId,
      userId,
    };
    this.sessions.set(session.id, session);

    return this.toView(session);
  }

  async getSession(userId: string, sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }
    if (
      session.status === "in_progress" &&
      this.now().getTime() >= new Date(session.deadlineAt).getTime()
    ) {
      return this.submitSession(userId, sessionId);
    }
    return this.toView(session);
  }

  async saveAnswer(
    userId: string,
    sessionId: string,
    position: number,
    selectedKeys: string[],
  ) {
    const session = this.getStoredSession(userId, sessionId);
    this.assertEditable(session);
    const item = session.items[position];
    if (!item) {
      throw new Error("题号超出当前模考范围");
    }

    item.selectedKeys = [...selectedKeys];
    item.savedAt = this.now().toISOString();
    return this.toView(session);
  }

  async setMarked(
    userId: string,
    sessionId: string,
    position: number,
    isMarked: boolean,
  ) {
    const session = this.getStoredSession(userId, sessionId);
    this.assertEditable(session);
    const item = session.items[position];
    if (!item) {
      throw new Error("题号超出当前模考范围");
    }

    item.isMarked = isMarked;
    item.savedAt = this.now().toISOString();
    return this.toView(session);
  }

  async submitSession(userId: string, sessionId: string) {
    const session = this.getStoredSession(userId, sessionId);
    if (session.status === "submitted") {
      return this.toView(session);
    }

    for (const item of session.items) {
      const graded = gradeObjectiveAnswer(
        item.type,
        item.correctKeys,
        item.selectedKeys,
      );
      item.isCorrect = graded.isCorrect;
      item.score = graded.score * item.weight;
    }
    const submittedAt = this.now();
    for (const item of session.items) {
      await this.recordAttempt({
        attemptedAt: submittedAt,
        externalId: item.externalId,
        isCorrect: item.isCorrect ?? false,
        selectedKeys: [...item.selectedKeys],
        userId,
        version: item.version,
      });
    }
    session.score = session.items.reduce(
      (total, item) => total + (item.score ?? 0),
      0,
    );
    session.result = this.buildResult(session.items);
    session.status = "submitted";
    session.submittedAt = submittedAt.toISOString();
    return this.toView(session);
  }

  private getStoredSession(userId: string, sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("模考会话不存在");
    }
    return session;
  }

  private assertEditable(session: StoredSession) {
    if (session.status !== "in_progress") {
      throw new Error("模考已经提交");
    }
    if (this.now().getTime() >= new Date(session.deadlineAt).getTime()) {
      throw new Error("模考已到截止时间");
    }
  }

  private buildResult(items: StoredItem[]): MockExamResult {
    const byModule = new Map<
      string,
      MockExamResult["byModule"][number]
    >();
    const byType = new Map<
      StoredItem["type"],
      MockExamResult["byType"][number]
    >();

    for (const item of items) {
      const moduleResult = byModule.get(item.moduleTitle) ?? {
        correctCount: 0,
        maxScore: 0,
        moduleTitle: item.moduleTitle,
        questionCount: 0,
        score: 0,
      };
      moduleResult.questionCount += 1;
      moduleResult.correctCount += item.isCorrect ? 1 : 0;
      moduleResult.score += item.score ?? 0;
      moduleResult.maxScore += item.weight;
      byModule.set(item.moduleTitle, moduleResult);

      const type = byType.get(item.type) ?? {
        correctCount: 0,
        maxScore: 0,
        questionCount: 0,
        score: 0,
        type: item.type,
      };
      type.questionCount += 1;
      type.correctCount += item.isCorrect ? 1 : 0;
      type.score += item.score ?? 0;
      type.maxScore += item.weight;
      byType.set(item.type, type);
    }

    return {
      byModule: Array.from(byModule.values()),
      byType: Array.from(byType.values()),
      correctCount: items.filter((item) => item.isCorrect).length,
      questionCount: items.length,
    };
  }

  private toView(session: StoredSession): MockExamSessionView {
    return {
      deadlineAt: session.deadlineAt,
      id: session.id,
      items: session.items.map((item) => ({
        ...(session.status === "submitted"
          ? {
              correctKeys: [...item.correctKeys],
              explanation: item.explanation,
              isCorrect: item.isCorrect ?? false,
              score: item.score ?? 0,
            }
          : {}),
        externalId: item.externalId,
        isMarked: item.isMarked,
        options: item.options.map((option) => ({ ...option })),
        position: item.position,
        savedAt: item.savedAt,
        selectedKeys: [...item.selectedKeys],
        stem: item.stem,
        type: item.type,
        version: item.version,
      })),
      maxScore: session.maxScore,
      result: session.result,
      score: session.score,
      startedAt: session.startedAt,
      status: session.status,
      submittedAt: session.submittedAt,
      templateId: session.templateId,
    };
  }
}
