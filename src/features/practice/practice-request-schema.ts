import { z } from "zod";

export const startPracticeRequestSchema = z
  .object({
    mode: z.enum([
      "sequential",
      "chapter",
      "random",
      "unanswered",
    ]),
    count: z.number().int().min(1).max(100),
    moduleTitle: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((input, context) => {
    if (input.mode === "chapter" && !input.moduleTitle) {
      context.addIssue({
        code: "custom",
        message: "章节练习必须选择模块",
        path: ["moduleTitle"],
      });
    }
  });

export const navigatePracticeRequestSchema = z.object({
  index: z.number().int().nonnegative(),
});

export const submitPracticeAnswerRequestSchema = z.object({
  selectedKeys: z
    .array(z.string().regex(/^[A-Z]$/))
    .min(1)
    .max(10)
    .refine(
      (keys) => new Set(keys).size === keys.length,
      "答案选项不能重复",
    ),
  confidence: z.enum(["certain", "uncertain"]),
});

export const favoriteQuestionRequestSchema = z.object({
  isFavorite: z.boolean(),
});
