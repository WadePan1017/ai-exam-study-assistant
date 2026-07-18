import { z } from "zod";

export const startMockExamRequestSchema = z.object({
  templateId: z.uuid(),
});

export const saveMockExamAnswerRequestSchema = z.object({
  position: z.number().int().nonnegative(),
  selectedKeys: z
    .array(z.string().regex(/^[A-Z]$/))
    .max(10)
    .refine(
      (keys) => new Set(keys).size === keys.length,
      "答案选项不能重复",
    ),
});

export const markMockExamItemRequestSchema = z.object({
  position: z.number().int().nonnegative(),
  isMarked: z.boolean(),
});
