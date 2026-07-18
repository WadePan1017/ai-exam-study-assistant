import {
  previewKnowledgeImport,
  type ExistingKnowledgeVersion,
} from "@/features/knowledge/knowledge-import-preview";
import type {
  KnowledgeImportItem,
  KnowledgeImportPayload,
} from "@/features/knowledge/knowledge-import-schema";
import type {
  ImportReport,
  KnowledgePointDetail,
  KnowledgeStateInput,
  LearningContentStore,
  StudyCatalog,
} from "./learning-content-store";
import { buildStudyCatalog } from "./build-study-catalog";

const seedKnowledgePoint: KnowledgeImportItem = {
  external_id: "kp-project-characteristics",
  syllabus_path: ["项目管理概论", "项目与项目管理"],
  title: "项目的基本特征",
  summary: "项目是为了创造独特成果而进行的临时性工作。",
  content_md:
    "项目具有临时性、独特性和渐进明细等特征。临时性表示项目有明确的开始和结束，并不意味着持续时间一定很短。",
  exam_focus_md: "重点区分项目与持续、重复的运营工作。",
  confusion_md: "临时性描述项目边界，不等于项目成果只能短期存在。",
  work_example_md:
    "建设一次专题网站属于项目；网站上线后的长期日常维护更接近运营。",
  formula_md: "",
  importance: "A",
  difficulty: 1,
  source: {
    type: "self_authored",
    note: "依据公开项目管理基本概念整理的原创学习卡片",
    copyright_status: "self_authored",
  },
  review_status: "published",
  version: 1,
};

type StoredState = KnowledgeStateInput;

export class MemoryLearningContentStore implements LearningContentStore {
  private readonly knowledgePoints = new Map<string, KnowledgeImportItem>([
    [seedKnowledgePoint.external_id, seedKnowledgePoint],
  ]);

  private readonly states = new Map<string, StoredState>();

  private stateKey(userId: string, externalId: string) {
    return `${userId}:${externalId}`;
  }

  private existingVersions(): ExistingKnowledgeVersion[] {
    return Array.from(this.knowledgePoints.values(), (item) => ({
      externalId: item.external_id,
      version: item.version,
    }));
  }

  async getKnowledgeReferences() {
    return Array.from(this.knowledgePoints.values(), (item) => ({
      externalId: item.external_id,
      syllabusPath: [...item.syllabus_path],
    }));
  }

  async getCatalog(userId: string, query = ""): Promise<StudyCatalog> {
    const states = new Map<string, KnowledgeStateInput>();
    for (const [key, state] of this.states) {
      const prefix = `${userId}:`;
      if (key.startsWith(prefix)) {
        states.set(key.slice(prefix.length), state);
      }
    }

    return buildStudyCatalog(
      Array.from(this.knowledgePoints.values()),
      states,
      query,
    );
  }

  async getKnowledgePoint(
    userId: string,
    externalId: string,
  ): Promise<KnowledgePointDetail | null> {
    const item = this.knowledgePoints.get(externalId);

    if (!item || item.review_status !== "published") {
      return null;
    }

    const state = this.states.get(this.stateKey(userId, externalId));

    return {
      confusion: item.confusion_md,
      content: item.content_md,
      copyrightStatus: item.source.copyright_status,
      difficulty: item.difficulty,
      examFocus: item.exam_focus_md,
      externalId: item.external_id,
      formula: item.formula_md,
      importance: item.importance,
      isFavorite: state?.isFavorite ?? false,
      learningStatus: state?.status ?? "not_started",
      personalNote: state?.personalNote ?? "",
      reviewStatus: item.review_status,
      sourceNote: item.source.note,
      sourceType: item.source.type,
      summary: item.summary,
      syllabusPath: item.syllabus_path,
      title: item.title,
      version: item.version,
      workExample: item.work_example_md,
    };
  }

  async saveKnowledgeState(
    userId: string,
    externalId: string,
    input: KnowledgeStateInput,
  ) {
    const item = this.knowledgePoints.get(externalId);

    if (!item || item.review_status !== "published") {
      throw new Error("知识点不存在或尚未发布");
    }

    this.states.set(this.stateKey(userId, externalId), { ...input });
  }

  async previewKnowledge(payload: KnowledgeImportPayload) {
    return previewKnowledgeImport(payload, this.existingVersions());
  }

  async importKnowledge(
    _userId: string,
    payload: KnowledgeImportPayload,
    fileName: string,
  ): Promise<ImportReport> {
    const preview = await this.previewKnowledge(payload);
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

    for (const previewItem of preview.items) {
      if (
        previewItem.action === "insert" ||
        previewItem.action === "update"
      ) {
        const item = payload.items.find(
          (candidate) =>
            candidate.external_id === previewItem.externalId,
        );
        if (item) {
          this.knowledgePoints.set(item.external_id, item);
        }
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
