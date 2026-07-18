import type { QuestionImportPayload } from "./question-import-schema";

export type QuestionImportAction =
  | "insert"
  | "update"
  | "skip"
  | "reject";

export type ExistingQuestionVersion = {
  externalId: string;
  version: number;
};

export type QuestionImportPreview = {
  counts: Record<QuestionImportAction, number>;
  items: Array<{
    externalId: string;
    version: number;
    action: QuestionImportAction;
    message: string;
  }>;
};

export function previewQuestionImport(
  payload: QuestionImportPayload,
  existingVersions: readonly ExistingQuestionVersion[],
  knownKnowledgeExternalIds: readonly string[],
): QuestionImportPreview {
  const existingById = new Map(
    existingVersions.map((item) => [item.externalId, item.version]),
  );
  const knownKnowledge = new Set(knownKnowledgeExternalIds);
  const counts: Record<QuestionImportAction, number> = {
    insert: 0,
    update: 0,
    skip: 0,
    reject: 0,
  };

  const items = payload.items.map((item) => {
    const missingKnowledgeId = item.knowledge_point_external_ids.find(
      (externalId) => !knownKnowledge.has(externalId),
    );
    const existingVersion = existingById.get(item.external_id);
    let action: QuestionImportAction;
    let message: string;

    if (missingKnowledgeId) {
      action = "reject";
      message = `关联知识点“${missingKnowledgeId}”不存在`;
    } else if (existingVersion === undefined) {
      action = "insert";
      message = "新增题目";
    } else if (item.version > existingVersion) {
      action = "update";
      message = `从版本${existingVersion}更新到版本${item.version}`;
    } else if (item.version === existingVersion) {
      action = "skip";
      message = "版本相同，保持现有题目";
    } else {
      action = "reject";
      message = `导入版本${item.version}低于现有版本${existingVersion}`;
    }

    counts[action] += 1;

    return {
      action,
      externalId: item.external_id,
      message,
      version: item.version,
    };
  });

  return { counts, items };
}
