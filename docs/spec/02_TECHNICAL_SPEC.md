# 技术规格

## 1. 架构原则

- 单体优先，不拆微服务
- 服务端负责鉴权、数据持久化、AI调用和敏感逻辑
- 前端不持有高权限密钥
- 数据结构可迁移，不依赖某个页面形状
- 业务规则集中在 service/domain 层，不散落于组件
- 考试结构通过配置驱动
- 先保证可靠性，再追求动画和花哨图表

## 2. 默认技术栈

空仓库时：

- Next.js App Router
- TypeScript strict
- Tailwind CSS
- shadcn/ui 或等价可维护组件
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage（仅用于后续附件，不强制第一阶段使用）
- Zod
- Vitest
- Playwright

沿用现有锁文件。没有锁文件时使用 pnpm。

## 3. 建议目录

```text
src/
  app/
    (auth)/
    (app)/
      dashboard/
      study/
      practice/
      mistakes/
      mock/
      reports/
      settings/
    admin/
    api/
  components/
    ui/
    layout/
    study/
    question/
    reports/
  features/
    auth/
    syllabus/
    knowledge/
    practice/
    review/
    mock-exam/
    analytics/
    ai-tutor/
    import/
  lib/
    supabase/
    validation/
    security/
    dates/
  server/
    repositories/
    services/
    domain/
  types/
supabase/
  migrations/
  seed/
tests/
  unit/
  integration/
  e2e/
docs/
  spec/
```

目录可结合现有项目调整，但必须保持业务边界清晰。

## 4. 鉴权和权限

角色：

- `learner`：学习用户
- `admin`：内容导入和管理

第一版允许同一个账号同时拥有两个角色。

要求：

- Supabase Auth
- 邮箱魔法链接或邮箱密码登录
- 所有用户学习表带 `user_id`
- 使用RLS隔离用户数据
- 管理操作必须在服务端再次验证角色
- 不能仅靠隐藏按钮实现权限控制

## 5. 状态和数据获取

- 服务端数据优先
- 需要即时交互的练习页使用客户端状态
- 每次答案变化应及时持久化或进入可靠的自动保存队列
- 模考答案在本地暂存与服务端保存之间做双层保护
- 对网络失败提供重试和明确提示
- 不在多个组件中重复实现同一统计逻辑

## 6. 时间处理

- 数据库存UTC
- 界面默认 `Asia/Shanghai`
- 每日学习任务按用户时区计算
- 连续学习天数必须用自然日而非24小时滑动窗口
- 模考计时使用服务端开始时间，避免用户刷新重置

## 7. 考试配置

建立单一考试配置，但字段可编辑：

```ts
type ExamConfig = {
  code: "system-integration-project-management-engineer";
  name: string;
  level: "中级";
  syllabusVersion: string;
  timezone: string;
  passingRule: {
    mode: "per_subject";
    percentage?: number;
    fixedScore?: number;
  };
  sessions: Array<{
    code: string;
    name: string;
    durationMinutes: number;
    scoringMode: string;
    questionBlueprint: unknown;
  }>;
};
```

初始数值必须来自用户确认的当次官方考务信息或管理员配置。不得因为网上常见说法就在代码中写死。

## 8. 练习引擎

练习会话状态：

- created
- in_progress
- completed
- abandoned

每个会话保存：

- 模式
- 筛选条件
- 题目顺序
- 开始时间
- 当前题号
- 已答题
- 标记题
- 用时
- 完成状态

判分逻辑：

- 单选、判断：精确匹配
- 多选：默认全对才得分，规则可配置
- 填空：支持标准化后匹配和多个可接受答案
- 简答、案例、计算：保存文本，由用户自评、人工评阅或AI辅助，不伪装成确定机器评分

## 9. 掌握度模型

知识点掌握度不使用未经解释的AI评分。

建议基础评分由以下数据计算：

- 首次正确率
- 最近正确率
- 复习成功率
- 距离上次正确的时间
- 题目覆盖量
- 难度权重

输出只分四档：

- 未学习
- 学习中
- 基本掌握
- 薄弱

算法写在独立服务中，并有单元测试。

## 10. 性能

目标：

- 移动网络下首页主要内容快速出现
- 练习下一题切换无明显等待
- 题库分页或游标加载
- 报告统计避免每次请求扫描全部尝试记录
- 必要时建立聚合表或定时刷新统计
- 图片和公式资源懒加载
- 不在客户端一次加载完整题库

## 11. 安全

- AI密钥只在服务端
- Supabase service role只在服务端
- 所有导入内容经过Zod校验
- Markdown渲染必须防XSS
- 上传文件限制类型、大小和数量
- 管理接口限速
- AI接口按用户和日期限制次数
- 日志不得记录完整密钥和敏感认证信息
- `.env.example` 只含变量名和说明

## 12. 可观察性

至少记录：

- 登录失败
- 导入失败
- 自动保存失败
- 模考提交失败
- AI调用失败、耗时和令牌量
- 数据导出和恢复操作

开发环境可使用结构化控制台日志，生产环境保留可替换的日志适配层。

## 13. 数据备份

用户必须能够：

- 导出学习数据JSON
- 导出个人笔记
- 导出错题和收藏
- 导出完整内容库（管理员）
- 在空环境中恢复

备份格式必须包含：

- schema_version
- exported_at
- exam_code
- content
- user_data

恢复前显示预览和冲突策略：

- skip
- update
- replace

默认使用 `skip/update`，禁止无确认全量覆盖。
