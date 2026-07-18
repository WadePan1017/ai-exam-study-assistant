import { describe, expect, it } from "vitest";

import { SYLLABUS_MODULES } from "@/features/syllabus/syllabus-catalog";

describe("考试大纲目录", () => {
  it("按冻结顺序提供18个一级模块", () => {
    expect(SYLLABUS_MODULES).toHaveLength(18);
    expect(SYLLABUS_MODULES.map((module) => module.title)).toEqual([
      "信息化发展",
      "信息技术发展",
      "信息技术服务",
      "信息系统架构",
      "软件工程",
      "数据工程",
      "软硬件系统集成",
      "信息安全工程",
      "项目管理概论",
      "启动过程组",
      "规划过程组",
      "执行过程组",
      "监控过程组",
      "收尾过程组",
      "组织保障",
      "监理基础知识",
      "法律法规与标准规范",
      "职业道德规范",
    ]);
    expect(SYLLABUS_MODULES.map((module) => module.sortOrder)).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    );
  });
});
