import { describe, expect, it } from "vitest";

import { previewQuestionImport } from "@/features/practice/question-import-preview";
import type { QuestionImportPayload } from "@/features/practice/question-import-schema";

const baseItem: QuestionImportPayload["items"][number] = {
  external_id: "q-project-characteristics-001",
  type: "single_choice",
  stem_md: "以下哪项最符合项目的基本特征？",
  options: [
    { key: "A", content_md: "持续重复" },
    { key: "B", content_md: "临时且独特" },
  ],
  answer: { keys: ["B"] },
  explanation_md: "项目具有临时性和独特性。",
  difficulty: 1,
  importance: "A",
  knowledge_point_external_ids: ["kp-project-characteristics"],
  tags: ["基础概念"],
  source: {
    type: "self_authored",
    note: "原创示例题，非真题",
    copyright_status: "self_authored",
  },
  review_status: "published",
  version: 1,
};

describe("题目导入预览", () => {
  it("拒绝引用不存在知识点的题目", () => {
    const payload: QuestionImportPayload = {
      schema_version: "1.0",
      exam_code: "system-integration-project-management-engineer",
      items: [{ ...baseItem, external_id: "q-missing-kp" }],
    };

    const preview = previewQuestionImport(payload, [], []);

    expect(preview.counts.reject).toBe(1);
    expect(preview.items[0]).toEqual(
      expect.objectContaining({
        action: "reject",
        message: "关联知识点“kp-project-characteristics”不存在",
      }),
    );
  });

  it("按版本区分更新、跳过和版本回退", () => {
    const payload: QuestionImportPayload = {
      schema_version: "1.0",
      exam_code: "system-integration-project-management-engineer",
      items: [
        { ...baseItem, external_id: "q-update", version: 3 },
        { ...baseItem, external_id: "q-skip", version: 2 },
        { ...baseItem, external_id: "q-regression", version: 1 },
      ],
    };

    const preview = previewQuestionImport(
      payload,
      [
        { externalId: "q-update", version: 2 },
        { externalId: "q-skip", version: 2 },
        { externalId: "q-regression", version: 2 },
      ],
      ["kp-project-characteristics"],
    );

    expect(preview.counts).toEqual({
      insert: 0,
      reject: 1,
      skip: 1,
      update: 1,
    });
  });
});
