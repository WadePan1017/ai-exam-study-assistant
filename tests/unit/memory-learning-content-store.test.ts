import { describe, expect, it } from "vitest";

import type { KnowledgeImportPayload } from "@/features/knowledge/knowledge-import-schema";
import { MemoryLearningContentStore } from "@/server/repositories/memory-learning-content-store";

const payload: KnowledgeImportPayload = {
  schema_version: "1.0",
  exam_code: "system-integration-project-management-engineer",
  items: [
    {
      external_id: "kp-three-level",
      syllabus_path: ["规划过程组", "项目范围管理", "创建WBS"],
      title: "工作分解结构",
      summary: "将项目可交付成果和项目工作分解成较小组件。",
      content_md: "WBS面向可交付成果逐层分解。",
      exam_focus_md: "理解工作包。",
      confusion_md: "",
      work_example_md: "",
      formula_md: "",
      importance: "S",
      difficulty: 2,
      source: {
        type: "self_authored",
        note: "原创学习笔记",
        copyright_status: "self_authored",
      },
      review_status: "published",
      version: 1,
    },
  ],
};

describe("本地学习内容仓库", () => {
  it("事务导入三级目录、保持幂等并持久保存个人笔记", async () => {
    const store = new MemoryLearningContentStore();

    const firstReport = await store.importKnowledge(
      "owner",
      payload,
      "knowledge.json",
    );
    const secondReport = await store.importKnowledge(
      "owner",
      payload,
      "knowledge.json",
    );

    expect(firstReport.counts).toEqual({
      inserted: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
    });
    expect(secondReport.counts).toEqual({
      inserted: 0,
      updated: 0,
      skipped: 1,
      failed: 0,
    });

    const catalog = await store.getCatalog("owner", "工作分解");
    const planning = catalog.modules.find(
      (module) => module.title === "规划过程组",
    );
    expect(planning?.children[0].children[0].knowledgePoints).toEqual([
      expect.objectContaining({ externalId: "kp-three-level" }),
    ]);

    await store.saveKnowledgeState("owner", "kp-three-level", {
      personalNote: "记住：最底层是工作包。",
      status: "learning",
      isFavorite: true,
    });

    await expect(
      store.getKnowledgePoint("owner", "kp-three-level"),
    ).resolves.toEqual(
      expect.objectContaining({
        personalNote: "记住：最底层是工作包。",
        learningStatus: "learning",
        isFavorite: true,
      }),
    );

    await expect(
      store.getKnowledgePoint("another-user", "kp-three-level"),
    ).resolves.toEqual(
      expect.objectContaining({
        personalNote: "",
        learningStatus: "not_started",
        isFavorite: false,
      }),
    );

    await expect(store.getKnowledgeReferences()).resolves.toEqual(
      expect.arrayContaining([
        {
          externalId: "kp-three-level",
          syllabusPath: ["规划过程组", "项目范围管理", "创建WBS"],
        },
      ]),
    );
  });

  it("存在拒绝项时不写入同一文件中的其他知识点", async () => {
    const store = new MemoryLearningContentStore();
    const rejectedPayload: KnowledgeImportPayload = {
      ...payload,
      items: [
        payload.items[0],
        {
          ...payload.items[0],
          external_id: "kp-invalid-module",
          syllabus_path: ["不存在的模块"],
          title: "不应写入",
        },
      ],
    };

    const report = await store.importKnowledge(
      "owner",
      rejectedPayload,
      "rejected.json",
    );

    expect(report.status).toBe("failed");
    expect(report.counts.inserted).toBe(0);
    await expect(
      store.getKnowledgePoint("owner", "kp-three-level"),
    ).resolves.toBeNull();
  });
});
