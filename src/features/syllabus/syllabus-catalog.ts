export type SyllabusModule = {
  externalId: string;
  title: string;
  sortOrder: number;
};

const moduleTitles = [
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
] as const;

export const SYLLABUS_MODULES: readonly SyllabusModule[] =
  moduleTitles.map((title, index) => ({
    externalId: `module-${String(index + 1).padStart(2, "0")}`,
    sortOrder: index + 1,
    title,
  }));
