# AI考证学习助手（系统集成项目管理工程师专版）开发规格包

版本：v1.0  
适用范围：第一版仅服务“系统集成项目管理工程师（中级）”个人备考  
目标终端：移动端优先的 Web / PWA，桌面端自适应

## 怎么使用

1. 将本目录复制到项目根目录的 `docs/spec/`。
2. 项目根目录已有 `AGENTS.md` 时，以现有文件为最高优先级，并把本包的必要规则合并进去；没有时可参考 `AGENTS.md.template`。
3. 将 `00_CODEX_MASTER_PROMPT.md` 的全文发给 Codex。
4. Codex 第一次只允许审查仓库并输出实施计划，不直接大规模编码。
5. 你确认计划后，按照 `04_PHASE_PLAN_AND_ACCEPTANCE.md` 一阶段一阶段推进。
6. 每阶段完成后必须运行 lint、类型检查、测试和构建，并提交验收报告。
7. 未经确认，不进入下一阶段。

## 文件说明

- `00_CODEX_MASTER_PROMPT.md`：可以直接发给 Codex 的完整总提示词
- `01_PRODUCT_REQUIREMENTS.md`：产品需求说明
- `02_TECHNICAL_SPEC.md`：技术架构、工程规范和安全要求
- `03_DATA_MODEL_AND_IMPORT_SCHEMA.md`：数据库与内容导入结构
- `04_PHASE_PLAN_AND_ACCEPTANCE.md`：分阶段开发计划和验收标准
- `05_AI_TUTOR_SPEC.md`：AI讲题、知识检索和成本控制
- `06_UI_UX_SPEC.md`：移动端页面和交互规范
- `07_TEST_AND_RELEASE.md`：测试、备份、发布和回滚
- `08_COPYRIGHT_AND_CONTENT_RULES.md`：教材、题库与AI内容版权规则
- `09_PHASE_PROMPTS.md`：各阶段可直接复制给 Codex 的提示词
- `AGENTS.md.template`：项目工程约束模板
- `question-import.example.json`：题目导入示例
- `knowledge-import.example.json`：知识点导入示例

## 核心原则

- 当前版本只做一个考试，不开发考试选择中心。
- 系统先能稳定学习和刷题，再做AI。AI不是拿来掩盖基础功能没做完的烟雾机。
- 所有内容必须可追溯来源并标记版权状态。
- 所有关键数据可导出、可恢复、可迁移。
- 分阶段开发，可审核、可回滚、可测试。
