import { describe, expect, it } from "vitest";

import { parseKnowledgeImportText } from "@/features/knowledge/knowledge-import-schema";

const validItem = {
  external_id: "kp-project-basic-001",
  syllabus_path: ["项目管理概论", "项目与项目管理"],
  title: "项目的基本特征",
  summary: "项目是为了创造独特成果而进行的临时性工作。",
  content_md: "项目具有明确的开始与结束。",
  exam_focus_md: "区分项目与运营。",
  confusion_md: "临时性不等于持续时间短。",
  work_example_md: "建设一次专题网站属于项目。",
  formula_md: "",
  importance: "A",
  difficulty: 1,
  source: {
    type: "self_authored",
    note: "个人原创学习笔记",
    copyright_status: "self_authored",
  },
  review_status: "reviewed",
  version: 1,
};

describe("知识点 JSON 校验", () => {
  it("接受符合1.0规范的知识点文件", () => {
    const result = parseKnowledgeImportText(
      JSON.stringify({
        schema_version: "1.0",
        exam_code: "system-integration-project-management-engineer",
        items: [validItem],
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].external_id).toBe(
        "kp-project-basic-001",
      );
    }
  });

  it("拒绝包含危险HTML的内容并返回字段路径", () => {
    const result = parseKnowledgeImportText(
      JSON.stringify({
        schema_version: "1.0",
        exam_code: "system-integration-project-management-engineer",
        items: [
          {
            ...validItem,
            content_md: '<script>alert("xss")</script>',
          },
        ],
      }),
    );

    expect(result).toEqual({
      success: false,
      errors: [
        {
          path: "items.0.content_md",
          message: "内容包含不安全的HTML或脚本",
        },
      ],
    });
  });

  it("拒绝同一文件中的重复external_id", () => {
    const result = parseKnowledgeImportText(
      JSON.stringify({
        schema_version: "1.0",
        exam_code: "system-integration-project-management-engineer",
        items: [validItem, validItem],
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual({
        path: "items.1.external_id",
        message: "同一文件中的external_id不能重复",
      });
    }
  });

  it("为损坏的JSON返回可读错误", () => {
    expect(parseKnowledgeImportText("{")).toEqual({
      success: false,
      errors: [{ path: "$", message: "文件不是有效的JSON" }],
    });
  });
});
