import type { QuestionImportItem } from "@/features/practice/question-import-schema";

export type MockExamTemplateView = {
  id: string;
  name: string;
  durationMinutes: number;
  questionCount: number;
  maxScore: number;
  mode: "fixed" | "random";
};

export type MockExamSetup = {
  templates: MockExamTemplateView[];
};

export type MockExamSessionView = {
  id: string;
  templateId: string;
  status: "in_progress" | "submitted";
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number;
  result: MockExamResult | null;
  items: MockExamItemView[];
};

export type MockExamItemView = {
  position: number;
  externalId: string;
  version: number;
  type: QuestionImportItem["type"];
  stem: string;
  options: Array<{ key: string; content: string }>;
  selectedKeys: string[];
  isMarked: boolean;
  savedAt: string | null;
  correctKeys?: string[];
  explanation?: string;
  isCorrect?: boolean;
  score?: number;
};

export type MockExamResult = {
  questionCount: number;
  correctCount: number;
  byModule: Array<{
    moduleTitle: string;
    questionCount: number;
    correctCount: number;
    score: number;
    maxScore: number;
  }>;
  byType: Array<{
    type: QuestionImportItem["type"];
    questionCount: number;
    correctCount: number;
    score: number;
    maxScore: number;
  }>;
};

export type MockExamAttemptRecord = {
  userId: string;
  externalId: string;
  version: number;
  selectedKeys: string[];
  isCorrect: boolean;
  attemptedAt: Date;
};

export interface MockExamStore {
  getSetup(userId: string): Promise<MockExamSetup>;
  startSession(
    userId: string,
    templateId: string,
  ): Promise<MockExamSessionView>;
  getSession(
    userId: string,
    sessionId: string,
  ): Promise<MockExamSessionView | null>;
  saveAnswer(
    userId: string,
    sessionId: string,
    position: number,
    selectedKeys: string[],
  ): Promise<MockExamSessionView>;
  setMarked(
    userId: string,
    sessionId: string,
    position: number,
    isMarked: boolean,
  ): Promise<MockExamSessionView>;
  submitSession(
    userId: string,
    sessionId: string,
  ): Promise<MockExamSessionView>;
}
