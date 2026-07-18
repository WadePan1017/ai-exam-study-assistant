import { describe, expect, it } from "vitest";

import {
  knowledgeImportRequestSchema,
  MAX_IMPORT_FILE_BYTES,
} from "@/features/knowledge/knowledge-import-request";

describe("knowledge import request", () => {
  it("rejects empty and oversized JSON text before parsing", () => {
    expect(
      knowledgeImportRequestSchema.safeParse({
        fileName: "empty.json",
        text: "",
      }).success,
    ).toBe(false);
    expect(
      knowledgeImportRequestSchema.safeParse({
        fileName: "huge.json",
        text: "x".repeat(MAX_IMPORT_FILE_BYTES + 1),
      }).success,
    ).toBe(false);
    expect(
      knowledgeImportRequestSchema.safeParse({
        fileName: "huge-utf8.json",
        text: "中".repeat(800_000),
      }).success,
    ).toBe(false);
  });
});
