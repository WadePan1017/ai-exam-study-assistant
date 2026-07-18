import { z } from "zod";

const EXAM_CODE = "system-integration-project-management-engineer";
const MAX_MARKDOWN_LENGTH = 50_000;
const dangerousMarkup =
  /<\s*(script|iframe|object|embed)\b|javascript\s*:|on\w+\s*=/i;

export const knowledgeExternalIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "external_id只能使用小写字母、数字和连字符",
  );

const markdownSchema = z
  .string()
  .max(MAX_MARKDOWN_LENGTH, "内容不能超过50000个字符")
  .refine(
    (value) => !dangerousMarkup.test(value),
    "内容包含不安全的HTML或脚本",
  );

const sourceSchema = z.object({
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
});

export const knowledgeImportItemSchema = z
  .object({
    external_id: knowledgeExternalIdSchema,
    syllabus_path: z
      .array(z.string().trim().min(1).max(100))
      .min(1, "至少提供一级目录")
      .max(3, "目录路径最多支持三级"),
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().min(1).max(1_000),
    content_md: markdownSchema,
    exam_focus_md: markdownSchema,
    confusion_md: markdownSchema,
    work_example_md: markdownSchema,
    formula_md: markdownSchema,
    importance: z.enum(["S", "A", "B"]),
    difficulty: z.number().int().min(1).max(5),
    source: sourceSchema,
    review_status: z.enum([
      "draft",
      "reviewed",
      "published",
      "archived",
    ]),
    version: z.number().int().positive(),
  })
  .superRefine((item, context) => {
    if (
      item.review_status === "published" &&
      item.source.copyright_status === "unknown"
    ) {
      context.addIssue({
        code: "custom",
        message: "版权状态未知的内容不能发布",
        path: ["source", "copyright_status"],
      });
    }
  });

export const knowledgeImportSchema = z
  .object({
    schema_version: z.literal("1.0"),
    exam_code: z.literal(EXAM_CODE),
    items: z.array(knowledgeImportItemSchema).min(1).max(500),
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

export type KnowledgeImportItem = z.infer<
  typeof knowledgeImportItemSchema
>;
export type KnowledgeImportPayload = z.infer<
  typeof knowledgeImportSchema
>;

export type ImportValidationError = {
  path: string;
  message: string;
};

export function parseKnowledgeImportText(
  text: string,
):
  | { success: true; data: KnowledgeImportPayload }
  | { success: false; errors: ImportValidationError[] } {
  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch {
    return {
      success: false,
      errors: [{ path: "$", message: "文件不是有效的JSON" }],
    };
  }

  const result = knowledgeImportSchema.safeParse(raw);

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
