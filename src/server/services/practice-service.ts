import "server-only";

import type { QuestionImportPayload } from "@/features/practice/question-import-schema";
import { MemoryPracticeStore } from "@/server/repositories/memory-practice-store";
import type {
  MistakeFilters,
  MistakeReason,
  PracticeStore,
  StartPracticeInput,
  SubmitPracticeAnswerInput,
} from "@/server/repositories/practice-store";
import { SupabasePracticeStore } from "@/server/repositories/supabase-practice-store";

import {
  getLearningContentStore,
  OWNER_PROFILE_ID,
} from "./learning-content-service";

const globalStore = globalThis as typeof globalThis & {
  phase3MemoryStore?: MemoryPracticeStore;
};

function hasSupabaseConfig() {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getPracticeStore(): PracticeStore {
  if (hasSupabaseConfig()) {
    return new SupabasePracticeStore();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("生产环境必须配置Supabase练习数据库");
  }

  globalStore.phase3MemoryStore ??= new MemoryPracticeStore();
  return globalStore.phase3MemoryStore;
}

export function getOwnerPracticeSetup() {
  return getPracticeStore().getSetup(OWNER_PROFILE_ID);
}

export function startOwnerPractice(input: StartPracticeInput) {
  return getPracticeStore().startSession(OWNER_PROFILE_ID, input);
}

export function getOwnerPracticeSession(sessionId: string) {
  return getPracticeStore().getSession(OWNER_PROFILE_ID, sessionId);
}

export function navigateOwnerPractice(
  sessionId: string,
  index: number,
) {
  return getPracticeStore().navigateSession(
    OWNER_PROFILE_ID,
    sessionId,
    index,
  );
}

export function submitOwnerPracticeAnswer(
  sessionId: string,
  input: SubmitPracticeAnswerInput,
) {
  return getPracticeStore().submitAnswer(
    OWNER_PROFILE_ID,
    sessionId,
    input,
  );
}

export function setOwnerQuestionFavorite(
  externalId: string,
  isFavorite: boolean,
) {
  return getPracticeStore().setFavorite(
    OWNER_PROFILE_ID,
    externalId,
    isFavorite,
  );
}

export function getOwnerMistakes(filters: MistakeFilters = {}) {
  return getPracticeStore().getMistakes(OWNER_PROFILE_ID, filters);
}

export function setOwnerMistakeReason(
  externalId: string,
  reason: MistakeReason,
) {
  return getPracticeStore().setMistakeReason(
    OWNER_PROFILE_ID,
    externalId,
    reason,
  );
}

export function markOwnerMistakeMastered(externalId: string) {
  return getPracticeStore().markMistakeMastered(
    OWNER_PROFILE_ID,
    externalId,
  );
}

async function getKnowledgeReferences() {
  return getLearningContentStore().getKnowledgeReferences();
}

export async function previewOwnerQuestionImport(
  payload: QuestionImportPayload,
) {
  return getPracticeStore().previewQuestions(
    payload,
    await getKnowledgeReferences(),
  );
}

export async function commitOwnerQuestionImport(
  payload: QuestionImportPayload,
  fileName: string,
) {
  return getPracticeStore().importQuestions(
    OWNER_PROFILE_ID,
    payload,
    fileName,
    await getKnowledgeReferences(),
  );
}
