import { z } from "zod";

const EXAM_CODE = "system-integration-project-management-engineer";
export const questionExternalIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "external_id只能使用小写字母、数字和连字符",
  );
const dangerousMarkup =
  /<\s*(script|iframe|object|embed)\b|javascript\s*:|on\w+\s*=/i;
const markdownSchema = z
  .string()
  .trim()
  .min(1, "内容不能为空")
  .max(50_000, "内容不能超过50000个字符")
  .refine(
    (value) => !dangerousMarkup.test(value),
    "内容包含不安全的HTML或脚本",
  );

const optionSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[A-Z]$/, "选项key必须是单个大写英文字母"),
  content_md: markdownSchema.max(5_000, "选项内容不能超过5000个字符"),
});

export const questionImportItemSchema = z
  .object({
    external_id: questionExternalIdSchema,
    type: z.enum(["single_choice", "multiple_choice", "true_false"]),
    stem_md: markdownSchema,
    options: z.array(optionSchema).min(2).max(10),
    answer: z.object({
      keys: z
        .array(
          z
            .string()
            .trim()
            .regex(/^[A-Z]$/, "答案key必须是单个大写英文字母"),
        )
        .min(1, "至少提供一个正确答案")
        .max(10),
    }),
    explanation_md: markdownSchema,
    difficulty: z
      .number()
      .refine(
        (value) =>
          Number.isInteger(value) && value >= 1 && value <= 5,
        "难度必须是1到5之间的整数",
      ),
    importance: z.enum(["S", "A", "B"]),
    knowledge_point_external_ids: z
      .array(questionExternalIdSchema)
      .min(1, "至少关联一个知识点")
      .max(10),
    tags: z
      .array(z.string().trim().min(1).max(50))
      .max(20),
    source: z.object({
      type: z.enum([
        "self_authored",
        "official_public",
        "authorized",
        "user_note",
        "ai_draft",
      ]),
      note: z.string().trim().min(1, "必须填写来源说明").max(500),
      copyright_status: z.enum([
        "self_authored",
        "official_public",
        "authorized",
        "user_note",
        "ai_draft",
        "unknown",
      ]),
    }),
    review_status: z.enum([
      "draft",
      "pending_review",
      "reviewed",
      "published",
      "disputed",
      "archived",
    ]),
    version: z.number().int().positive(),
  })
  .superRefine((item, context) => {
    const optionKeys = new Set<string>();
    const answerKeys = new Set<string>();
    const knowledgeIds = new Set<string>();
    const tags = new Set<string>();

    item.options.forEach((option, index) => {
      if (optionKeys.has(option.key)) {
        context.addIssue({
          code: "custom",
          message: "选项key不能重复",
          path: ["options", index, "key"],
        });
      }
      optionKeys.add(option.key);
    });

    item.answer.keys.forEach((key, index) => {
      if (answerKeys.has(key)) {
        context.addIssue({
          code: "custom",
          message: "答案key不能重复",
          path: ["answer", "keys", index],
        });
      }
      answerKeys.add(key);

      if (!optionKeys.has(key)) {
        context.addIssue({
          code: "custom",
          message: "答案引用了不存在的选项",
          path: ["answer", "keys", index],
        });
      }
    });

    item.knowledge_point_external_ids.forEach(
      (externalId, index) => {
        if (knowledgeIds.has(externalId)) {
          context.addIssue({
            code: "custom",
            message: "关联知识点不能重复",
            path: ["knowledge_point_external_ids", index],
          });
        }
        knowledgeIds.add(externalId);
      },
    );

    item.tags.forEach((tag, index) => {
      if (tags.has(tag)) {
        context.addIssue({
          code: "custom",
          message: "标签不能重复",
          path: ["tags", index],
        });
      }
      tags.add(tag);
    });

    if (
      (item.type === "single_choice" ||
        item.type === "true_false") &&
      item.answer.keys.length !== 1
    ) {
      context.addIssue({
        code: "custom",
        message: "单选或判断题只能有一个正确答案",
        path: ["answer", "keys"],
      });
    }

    if (
      item.type === "multiple_choice" &&
      item.answer.keys.length < 2
    ) {
      context.addIssue({
        code: "custom",
        message: "多选题至少有两个正确答案",
        path: ["answer", "keys"],
      });
    }

    if (item.type === "true_false" && item.options.length !== 2) {
      context.addIssue({
        code: "custom",
        message: "判断题必须恰好有两个选项",
        path: ["options"],
      });
    }

    if (
      item.review_status === "published" &&
      item.source.copyright_status === "unknown"
    ) {
      context.addIssue({
        code: "custom",
        message: "版权状态未知的题目不能发布",
        path: ["source", "copyright_status"],
      });
    }
  });

export const questionImportSchema = z
  .object({
    schema_version: z.literal("1.0"),
    exam_code: z.literal(EXAM_CODE),
    items: z.array(questionImportItemSchema).min(1).max(500),
  })
  .superRefine((payload, context) => {
    const seen = new Set<string>();

    payload.items.forEach((item, index) => {
      if (seen.has(item.external_id)) {
        context.addIssue({
          code: "custom",
          message: "同一文件中的external_id不能重复",
          path: ["items", index, "external_id"],
        });
      }
      seen.add(item.external_id);
    });
  });

export type QuestionImportItem = z.infer<typeof questionImportItemSchema>;
export type QuestionImportPayload = z.infer<typeof questionImportSchema>;

export type QuestionImportValidationError = {
  path: string;
  message: string;
};

export function parseQuestionImportText(
  text: string,
):
  | { success: true; data: QuestionImportPayload }
  | { success: false; errors: QuestionImportValidationError[] } {
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    return {
      success: false,
      errors: [{ path: "$", message: "文件不是有效的JSON" }],
    };
  }

  const result = questionImportSchema.safeParse(raw);

  if (result.success) {
    return result;
  }

  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.length ? issue.path.join(".") : "$",
    })),
  };
}
