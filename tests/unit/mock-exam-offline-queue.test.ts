import { describe, expect, it } from "vitest";

import {
  clearSyncedMockExamDraft,
  listMockExamDrafts,
  saveMockExamDraft,
} from "@/features/mock-exam/mock-exam-offline-queue";

describe("模考断网暂存", () => {
  it("同一题只保留最新答案，且只清除已确认同步的版本", () => {
    localStorage.clear();
    saveMockExamDraft(localStorage, {
      position: 0,
      selectedKeys: ["A"],
      sessionId: "session-1",
      updatedAt: "2026-07-18T02:00:00.000Z",
    });
    saveMockExamDraft(localStorage, {
      position: 0,
      selectedKeys: ["B"],
      sessionId: "session-1",
      updatedAt: "2026-07-18T02:01:00.000Z",
    });

    expect(listMockExamDrafts(localStorage, "session-1")).toEqual([
      expect.objectContaining({ position: 0, selectedKeys: ["B"] }),
    ]);

    clearSyncedMockExamDraft(localStorage, "session-1", 0, ["A"]);
    expect(listMockExamDrafts(localStorage, "session-1")).toHaveLength(1);

    clearSyncedMockExamDraft(localStorage, "session-1", 0, ["B"]);
    expect(listMockExamDrafts(localStorage, "session-1")).toEqual([]);
  });
});
