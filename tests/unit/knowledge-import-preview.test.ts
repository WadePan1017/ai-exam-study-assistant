import { describe, expect, it } from "vitest";

import { previewKnowledgeImport } from "@/features/knowledge/knowledge-import-preview";
import type { KnowledgeImportPayload } from "@/features/knowledge/knowledge-import-schema";

const makeItem = (externalId: string, version: number) => ({
  external_id: externalId,
  syllabus_path: ["项目管理概论", "项目与项目管理"],
  title: externalId,
  summary: "摘要",
  content_md: "正文",
  exam_focus_md: "",
  confusion_md: "",
  work_example_md: "",
  formula_md: "",
  importance: "A" as const,
  difficulty: 1,
  source: {
    type: "self_authored" as const,
    note: "原创",
    copyright_status: "self_authored" as const,
  },
  review_status: "reviewed" as const,
  version,
});

describe("知识点导入预览", () => {
  it("区分新增、更新、跳过并拒绝版本倒退", () => {
    const payload: KnowledgeImportPayload = {
      schema_version: "1.0",
      exam_code: "system-integration-project-management-engineer",
      items: [
        makeItem("kp-new", 1),
        makeItem("kp-update", 2),
        makeItem("kp-skip", 1),
        makeItem("kp-regression", 1),
      ],
    };

    const preview = previewKnowledgeImport(payload, [
      { externalId: "kp-update", version: 1 },
      { externalId: "kp-skip", version: 1 },
      { externalId: "kp-regression", version: 2 },
    ]);

    expect(preview.counts).toEqual({
      insert: 1,
      update: 1,
      skip: 1,
      reject: 1,
    });
    expect(preview.items.map((item) => item.action)).toEqual([
      "insert",
      "update",
      "skip",
      "reject",
    ]);
    expect(preview.items[3].message).toBe(
      "导入版本1低于现有版本2",
    );
  });
});
