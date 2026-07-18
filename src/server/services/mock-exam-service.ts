import "server-only";

import { MemoryMockExamStore } from "@/server/repositories/memory-mock-exam-store";
import type {
  MockExamAttemptRecord,
  MockExamStore,
} from "@/server/repositories/mock-exam-store";
import { SupabaseMockExamStore } from "@/server/repositories/supabase-mock-exam-store";

import { OWNER_PROFILE_ID } from "./learning-content-service";
import { getPracticeStore } from "./practice-service";

const globalStore = globalThis as typeof globalThis & {
  phase5MemoryStore?: MemoryMockExamStore;
};

function hasSupabaseConfig() {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getMockExamStore(): MockExamStore {
  if (hasSupabaseConfig()) {
    return new SupabaseMockExamStore();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("生产环境必须配置Supabase模考数据库");
  }

  const practiceStore = getPracticeStore() as ReturnType<
    typeof getPracticeStore
  > & {
    recordMockExamAttempt(
      attempt: MockExamAttemptRecord,
    ): Promise<void>;
  };
  globalStore.phase5MemoryStore ??= new MemoryMockExamStore(
    undefined,
    (attempt) => practiceStore.recordMockExamAttempt(attempt),
  );
  return globalStore.phase5MemoryStore;
}

export function getOwnerMockExamSetup() {
  return getMockExamStore().getSetup(OWNER_PROFILE_ID);
}

export function startOwnerMockExam(templateId: string) {
  return getMockExamStore().startSession(
    OWNER_PROFILE_ID,
    templateId,
  );
}

export function getOwnerMockExamSession(sessionId: string) {
  return getMockExamStore().getSession(OWNER_PROFILE_ID, sessionId);
}

export function saveOwnerMockExamAnswer(
  sessionId: string,
  position: number,
  selectedKeys: string[],
) {
  return getMockExamStore().saveAnswer(
    OWNER_PROFILE_ID,
    sessionId,
    position,
    selectedKeys,
  );
}

export function setOwnerMockExamMarked(
  sessionId: string,
  position: number,
  isMarked: boolean,
) {
  return getMockExamStore().setMarked(
    OWNER_PROFILE_ID,
    sessionId,
    position,
    isMarked,
  );
}

export function submitOwnerMockExam(sessionId: string) {
  return getMockExamStore().submitSession(
    OWNER_PROFILE_ID,
    sessionId,
  );
}
