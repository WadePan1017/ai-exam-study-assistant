import type {
  KnowledgeImportItem,
  KnowledgeImportPayload,
} from "@/features/knowledge/knowledge-import-schema";
import type { KnowledgeImportPreview } from "@/features/knowledge/knowledge-import-preview";

export type LearningStatus =
  | "not_started"
  | "learning"
  | "mastered"
  | "weak";

export type KnowledgeStateInput = {
  personalNote: string;
  status: LearningStatus;
  isFavorite: boolean;
};

export type KnowledgeListItem = {
  externalId: string;
  title: string;
  summary: string;
  importance: "S" | "A" | "B";
  difficulty: number;
  learningStatus: LearningStatus;
};

export type CatalogNode = {
  key: string;
  title: string;
  children: CatalogNode[];
  knowledgePoints: KnowledgeListItem[];
};

export type CatalogModule = CatalogNode & {
  externalId: string;
  sortOrder: number;
};

export type StudyCatalog = {
  modules: CatalogModule[];
  totalPublished: number;
  matchedPublished: number;
};

export type KnowledgePointDetail = KnowledgeListItem & {
  syllabusPath: string[];
  content: string;
  examFocus: string;
  confusion: string;
  workExample: string;
  formula: string;
  sourceType: KnowledgeImportItem["source"]["type"];
  sourceNote: string;
  copyrightStatus: KnowledgeImportItem["source"]["copyright_status"];
  reviewStatus: KnowledgeImportItem["review_status"];
  version: number;
  personalNote: string;
  isFavorite: boolean;
};

export type ImportReport = {
  jobId: string;
  fileName: string;
  status: "completed" | "failed";
  counts: {
    inserted: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  errors: Array<{ externalId: string; message: string }>;
};

export interface LearningContentStore {
  getCatalog(userId: string, query?: string): Promise<StudyCatalog>;
  getKnowledgePoint(
    userId: string,
    externalId: string,
  ): Promise<KnowledgePointDetail | null>;
  saveKnowledgeState(
    userId: string,
    externalId: string,
    input: KnowledgeStateInput,
  ): Promise<void>;
  previewKnowledge(
    payload: KnowledgeImportPayload,
  ): Promise<KnowledgeImportPreview>;
  importKnowledge(
    userId: string,
    payload: KnowledgeImportPayload,
    fileName: string,
  ): Promise<ImportReport>;
}
