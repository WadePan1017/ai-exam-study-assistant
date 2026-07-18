import { z } from "zod";

export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;

export const knowledgeImportRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  text: z
    .string()
    .min(1, "导入文件不能为空")
    .max(MAX_IMPORT_FILE_BYTES, "导入文件不能超过2MB")
    .refine(
      (text) =>
        new TextEncoder().encode(text).byteLength <=
        MAX_IMPORT_FILE_BYTES,
      "导入文件不能超过2MB",
    ),
});
