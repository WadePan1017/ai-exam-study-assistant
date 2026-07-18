import type {
  QuestionImportItem,
  QuestionImportPayload,
} from "@/features/practice/question-import-schema";
import type { QuestionImportPreview } from "@/features/practice/question-import-preview";
import type { ImportReport } from "./learning-content-store";

export type PracticeMode =
  | "sequential"
  | "chapter"
  | "random"
  | "unanswered";

export type StartPracticeInput = {
  mode: PracticeMode;
  count: number;
  moduleTitle?: string;
};

export type PracticeFeedback = {
  isCorrect: boolean;
  score: number;
  correctKeys: string[];
  explanation: string;
};

export type PracticeQuestionView = {
  externalId: string;
  version: number;
  type: QuestionImportItem["type"];
  stem: string;
  options: Array<{ key: string; content: string }>;
  knowledgePointExternalIds: string[];
  selectedKeys: string[];
  confidence: "certain" | "uncertain" | null;
  isFavorite: boolean;
  feedback: PracticeFeedback | null;
  attemptHistory: Array<{
    id: string;
    questionVersion: number;
    selectedKeys: string[];
    isCorrect: boolean;
    confidence: "certain" | "uncertain";
    createdAt: string;
  }>;
};

export type PracticeSessionView = {
  id: string;
  startedAt: string;
  mode: PracticeMode;
  status: "in_progress" | "completed";
  currentIndex: number;
  answeredIndexes: number[];
  total: number;
  attemptCount: number;
  current: PracticeQuestionView;
};

export type PracticeSetup = {
  totalAvailable: number;
  unansweredAvailable: number;
  modules: Array<{ title: string; count: number }>;
};

export type SubmitPracticeAnswerInput = {
  selectedKeys: string[];
  confidence: "certain" | "uncertain";
};

export type KnowledgeReference = {
  externalId: string;
  syllabusPath: string[];
};

export interface PracticeStore {
  getSetup(userId: string): Promise<PracticeSetup>;
  startSession(
    userId: string,
    input: StartPracticeInput,
  ): Promise<PracticeSessionView>;
  getSession(
    userId: string,
    sessionId: string,
  ): Promise<PracticeSessionView | null>;
  navigateSession(
    userId: string,
    sessionId: string,
    index: number,
  ): Promise<PracticeSessionView>;
  submitAnswer(
    userId: string,
    sessionId: string,
    input: SubmitPracticeAnswerInput,
  ): Promise<PracticeSessionView>;
  setFavorite(
    userId: string,
    externalId: string,
    isFavorite: boolean,
  ): Promise<void>;
  previewQuestions(
    payload: QuestionImportPayload,
    knowledge: readonly KnowledgeReference[],
  ): Promise<QuestionImportPreview>;
  importQuestions(
    userId: string,
    payload: QuestionImportPayload,
    fileName: string,
    knowledge: readonly KnowledgeReference[],
  ): Promise<ImportReport>;
}
