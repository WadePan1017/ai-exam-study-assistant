import { z } from "zod";

export const mistakeReasonSchema = z.enum([
  "not_learned",
  "concept_confusion",
  "formula_memory",
  "calculation_error",
  "reading_error",
  "option_trap",
  "time_shortage",
  "careless",
  "other",
]);

export const mistakeFiltersRequestSchema = z.object({
  lastWrongAfter: z.iso.datetime({ offset: true }).optional(),
  minWrongAttempts: z.coerce.number().int().min(1).max(100).optional(),
  moduleTitle: z.string().trim().min(1).max(100).optional(),
  reason: z
    .union([mistakeReasonSchema, z.literal("unassigned")])
    .optional(),
  status: z.enum(["active", "mastered"]).optional(),
});

export const updateMistakeReasonRequestSchema = z.object({
  reason: mistakeReasonSchema,
});
