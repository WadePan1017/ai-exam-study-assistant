import type { KnowledgeImportPayload } from "./knowledge-import-schema";
import { SYLLABUS_MODULES } from "@/features/syllabus/syllabus-catalog";

export type ImportAction = "insert" | "update" | "skip" | "reject";

export type ExistingKnowledgeVersion = {
  externalId: string;
  version: number;
};

export type KnowledgeImportPreview = {
  counts: Record<ImportAction, number>;
  items: Array<{
    externalId: string;
    title: string;
    version: number;
    action: ImportAction;
    message: string;
  }>;
};

export function previewKnowledgeImport(
  payload: KnowledgeImportPayload,
  existingVersions: readonly ExistingKnowledgeVersion[],
): KnowledgeImportPreview {
  const existingById = new Map(
    existingVersions.map((item) => [item.externalId, item.version]),
  );
  const counts: Record<ImportAction, number> = {
    insert: 0,
    update: 0,
    skip: 0,
    reject: 0,
  };

  const items = payload.items.map((item) => {
    const existingVersion = existingById.get(item.external_id);
    let action: ImportAction;
    let message: string;

    if (
      !SYLLABUS_MODULES.some(
        (module) => module.title === item.syllabus_path[0],
      )
    ) {
      action = "reject";
      message = `一级模块“${item.syllabus_path[0]}”不存在`;
    } else if (existingVersion === undefined) {
      action = "insert";
      message = "新增知识点";
    } else if (item.version > existingVersion) {
      action = "update";
      message = `从版本${existingVersion}更新到版本${item.version}`;
    } else if (item.version === existingVersion) {
      action = "skip";
      message = "版本相同，保持现有内容";
    } else {
      action = "reject";
      message = `导入版本${item.version}低于现有版本${existingVersion}`;
    }

    counts[action] += 1;

    return {
      action,
      externalId: item.external_id,
      message,
      title: item.title,
      version: item.version,
    };
  });

  return { counts, items };
}
