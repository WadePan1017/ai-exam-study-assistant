import "server-only";

import { z } from "zod";

import type { KnowledgeImportPayload } from "@/features/knowledge/knowledge-import-schema";
import { MemoryLearningContentStore } from "@/server/repositories/memory-learning-content-store";
import { SupabaseLearningContentStore } from "@/server/repositories/supabase-learning-content-store";
import type {
  KnowledgeStateInput,
  LearningContentStore,
} from "@/server/repositories/learning-content-store";

export const OWNER_PROFILE_ID =
  "00000000-0000-4000-8000-000000000001";

const knowledgeStateSchema = z.object({
  personalNote: z.string().max(20_000),
  status: z.enum(["not_started", "learning", "mastered", "weak"]),
  isFavorite: z.boolean(),
});

const globalStore = globalThis as typeof globalThis & {
  phase2MemoryStore?: MemoryLearningContentStore;
};

function hasSupabaseConfig() {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getLearningContentStore(): LearningContentStore {
  if (hasSupabaseConfig()) {
    return new SupabaseLearningContentStore();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("生产环境必须配置Supabase学习数据库");
  }

  globalStore.phase2MemoryStore ??= new MemoryLearningContentStore();
  return globalStore.phase2MemoryStore;
}

export async function getStudyCatalog(query = "") {
  return getLearningContentStore().getCatalog(OWNER_PROFILE_ID, query);
}

export async function getPublishedKnowledgePoint(externalId: string) {
  return getLearningContentStore().getKnowledgePoint(
    OWNER_PROFILE_ID,
    externalId,
  );
}

export async function saveOwnerKnowledgeState(
  externalId: string,
  input: KnowledgeStateInput,
) {
  const validated = knowledgeStateSchema.parse(input);
  return getLearningContentStore().saveKnowledgeState(
    OWNER_PROFILE_ID,
    externalId,
    validated,
  );
}

export async function previewOwnerKnowledgeImport(
  payload: KnowledgeImportPayload,
) {
  return getLearningContentStore().previewKnowledge(payload);
}

export async function commitOwnerKnowledgeImport(
  payload: KnowledgeImportPayload,
  fileName: string,
) {
  return getLearningContentStore().importKnowledge(
    OWNER_PROFILE_ID,
    payload,
    fileName,
  );
}
