import { describe, expect, it } from "vitest";

import { parseQuestionImportText } from "@/features/practice/question-import-schema";

const validPayload = {
  schema_version: "1.0",
  exam_code: "system-integration-project-management-engineer",
  items: [
    {
      external_id: "q-project-characteristics-001",
      type: "single_choice",
      stem_md: "以下哪项最符合项目的基本特征？",
      options: [
        { key: "A", content_md: "持续重复且没有结束边界" },
        { key: "B", content_md: "为创造独特成果开展的临时性工作" },
        { key: "C", content_md: "只能由外部客户发起" },
        { key: "D", content_md: "只包括大型工程建设" },
      ],
      answer: { keys: ["B"] },
      explanation_md: "项目具有临时性和独特性。",
      difficulty: 1,
      importance: "A",
      knowledge_point_external_ids: ["kp-project-characteristics"],
      tags: ["基础概念"],
      source: {
        type: "self_authored",
        note: "项目原创示例题，非真题",
        copyright_status: "self_authored",
      },
      review_status: "published",
      version: 1,
    },
  ],
};

describe("题目导入格式", () => {
  it("接受带来源和知识点关联的原创单选题", () => {
    const result = parseQuestionImportText(JSON.stringify(validPayload));

    expect(result).toEqual({ success: true, data: validPayload });
  });

  it("拒绝重复选项键和不存在的答案键", () => {
    const invalid = structuredClone(validPayload);
    invalid.items[0].options[1].key = "A";
    invalid.items[0].answer.keys = ["Z"];

    const result = parseQuestionImportText(JSON.stringify(invalid));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map((error) => error.message)).toEqual(
        expect.arrayContaining([
          "选项key不能重复",
          "答案引用了不存在的选项",
        ]),
      );
    }
  });

  it("阻止版权未知或含危险脚本的题目发布", () => {
    const invalid = structuredClone(validPayload);
    invalid.items[0].source.copyright_status = "unknown";
    invalid.items[0].explanation_md = '<script>alert("x")</script>';

    const result = parseQuestionImportText(JSON.stringify(invalid));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map((error) => error.message)).toEqual(
        expect.arrayContaining([
          "版权状态未知的题目不能发布",
          "内容包含不安全的HTML或脚本",
        ]),
      );
    }
  });

  it("限制题目字段、答案数量和同一文件的重复编号", () => {
    const invalid = structuredClone(validPayload);
    invalid.items.push(structuredClone(invalid.items[0]));
    invalid.items[0].external_id = "Unsafe ID";
    invalid.items[1].external_id = "Unsafe ID";
    invalid.items[0].difficulty = 1.5;
    invalid.items[0].answer.keys = ["A", "B"];
    invalid.items[0].knowledge_point_external_ids = [];

    const result = parseQuestionImportText(JSON.stringify(invalid));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map((error) => error.message)).toEqual(
        expect.arrayContaining([
          "external_id只能使用小写字母、数字和连字符",
          "难度必须是1到5之间的整数",
          "单选或判断题只能有一个正确答案",
          "至少关联一个知识点",
          "同一文件中的external_id不能重复",
        ]),
      );
    }
  });

  it("多选题至少有两个正确答案，判断题必须恰好有两个选项", () => {
    const invalid = structuredClone(validPayload);
    invalid.items[0].type = "multiple_choice";
    invalid.items[0].answer.keys = ["B"];
    const trueFalse = structuredClone(validPayload.items[0]);
    trueFalse.external_id = "q-project-true-false-001";
    trueFalse.type = "true_false";
    trueFalse.options = trueFalse.options.slice(0, 3);
    invalid.items.push(trueFalse);

    const result = parseQuestionImportText(JSON.stringify(invalid));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map((error) => error.message)).toEqual(
        expect.arrayContaining([
          "多选题至少有两个正确答案",
          "判断题必须恰好有两个选项",
        ]),
      );
    }
  });
});
