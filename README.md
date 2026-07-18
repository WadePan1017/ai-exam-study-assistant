# AI考证学习助手

面向“系统集成项目管理工程师（中级）”的个人备考 Web 应用。项目采用
移动端优先设计，按 `docs/spec/04_PHASE_PLAN_AND_ACCEPTANCE.md` 分阶段开发。

Phase 5 的本地代码已完成：工程基础、个人访问保护、18模块知识目录、
知识点管理、题目导入，以及顺序、章节、随机和只练未做题的手机刷题流程。
作答历史会保留题目版本，刷新可恢复原会话；错题会自动归档并按
1/3/7/14/30/60天安排复习。模考支持配置驱动组卷、服务端截止时间、
自动保存、断网暂存、交卷评分和结果拆解。真实 Supabase 项目的迁移和
RLS验证仍需在云项目创建后完成。

## 技术栈

- Next.js App Router
- React + TypeScript strict
- Tailwind CSS
- Supabase PostgreSQL
- Zod
- Vitest + Testing Library
- Playwright
- pnpm

## 本地启动

要求 Node.js 24 或当前受支持的稳定版本，以及 pnpm 11。

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

然后打开 <http://localhost:3000>。

至少修改 `.env.local` 中的：

```dotenv
APP_ACCESS_KEY=你自己的访问口令
APP_SESSION_SECRET=至少32个随机字符
```

访问口令必须至少8个字符。正式环境可用以下命令生成会话密钥：

```bash
openssl rand -hex 32
```

## Supabase初始化

第一版使用服务端 Supabase 管理客户端，浏览器不会获得 service role key。

1. 创建 Supabase 项目。
2. 将项目URL和 service role key写入 `.env.local`。
3. 使用 Supabase CLI连接项目。
4. 应用 `supabase/migrations/` 中的迁移。

```bash
supabase link --project-ref <project-ref>
supabase db push
```

迁移会创建：

- 固定个人所有者档案
- 单一考试配置
- 访问口令失败次数和持久限流
- 18个大纲模块、知识点、个人知识状态和导入任务
- 版本化题目、选项、知识点关联、练习会话、作答历史和题目收藏
- 错题状态、错因、复习等级、到期队列和掌握状态
- 模考模板、限时会话、题目快照、作答保存和结果拆解
- RLS基础保护
- 2026年已核验的考试科目、时长和合格规则

`anon` 和 `authenticated` 角色不能直接访问这些表，也没有 RLS
访问策略；应用只通过服务端的 `service_role` 访问。重复执行初始化种子
不会覆盖已经编辑的所有者资料或考试配置。

## 知识点导入

内容管理页接受不超过2MB、最多500条记录的JSON文件。导入分为校验、
预览和明确确认三个步骤；`external_id` 与 `version` 共同保证重复导入
不会产生重复知识点。示例见
`docs/spec/knowledge-import.example.json`。

只有 `review_status` 为 `published` 的内容会出现在学习目录。每条内容
必须记录来源和版权状态；不要复制商业教材或题库。官方教材可用于个人
学习和人工原创总结，但不能把大段原文导入或公开传播。

## 题目导入与练习

内容管理页也接受不超过2MB、最多500题的JSON文件。题目必须关联已有
知识点，并记录来源、版权、审核状态和递增版本。示例见
`docs/spec/question-import.example.json`。

刷题中心支持顺序、章节、随机和只练未做题。单选、判断使用精确匹配，
多选采用全对才得分；提交前不会返回正确答案和解析。练习会话固定题目
顺序和版本，刷新后可继续，收藏和每次历史作答均按固定所有者隔离。

## 错题本与间隔复习

答错后题目自动进入错题本，并按上海自然日从次日开始复习。答对但不确定
提升一级，答对且确定提升两级，最高五级；再次答错会重置为零级。错题本
支持状态、模块、错因、错误次数和最近错误时间筛选，也可以立即再练单题、
处理今日到期/逾期队列或手动标记掌握。收藏与错题状态相互独立。

## 模拟考试

模考入口提供固定卷或随机组卷模板，题量、时长和单题权重均从模板读取。
开始时间和截止时间由服务端保存，刷新不会重置倒计时。每次选择答案都会
同步到服务端；断网时先暂存在当前浏览器，恢复网络后自动重试。交卷前不
返回正确答案和解析，交卷或超时后才显示客观题得分、章节/题型拆解和逐题
回顾，错题同时进入既有错题本与复习队列。

当前内置模板是用于验证流程的2题原创客观题模拟，不代表官方题量或分值。
主观案例题只保留后续自评/AI辅助接口方向，不伪装成准确自动评分。

## 质量检查

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm build
```

端到端测试使用电脑中已经安装的 Chrome，并覆盖手机视口和桌面视口。

## 部署

推荐部署到 Vercel，并配置 `.env.example` 中列出的全部环境变量。

- 不要把 `.env.local` 提交到版本库。
- 不要给 service role key 添加 `NEXT_PUBLIC_` 前缀。
- 正式网站必须配置个人访问口令。
- 本地未配置 Supabase 时会使用进程内限流，方便开发。
- 本地未配置 Supabase 时，Phase 2知识内容和个人笔记使用进程内存储，
  Phase 3至Phase 5的题目、练习会话、历史作答、错题、复习状态和模考
  会话同样使用进程内存储；重启开发服务器会恢复为内置原创示例。
- 正式环境必须配置 Supabase，并先应用迁移；否则访问保护会拒绝登录，
  学习内容服务也会拒绝启动，避免把临时数据当成正式数据。
- “锁定学习空间”会清除当前浏览器 Cookie。若怀疑 Cookie 已复制，
  应轮换 `APP_SESSION_SECRET`，使所有旧会话立即失效。

## 备份与恢复

完整的用户数据导出和恢复属于 Phase 8。当前阶段数据库只有基础配置；云端
启用后，在进行结构变更前应使用 Supabase 的数据库备份能力。

## 项目文档

- `docs/spec/`：产品、技术和验收规格
- `docs/DECISIONS.md`：已冻结的产品与技术决策
- `docs/CHANGELOG.md`：阶段变更
- `docs/KNOWN_ISSUES.md`：已知限制
- `docs/CONTENT_SOURCE_AUDIT.md`：资料来源、采购建议和内容发布门禁
- `docs/PHASE_1_ACCEPTANCE.md`：Phase 1 验收结果和待办
- `docs/PHASE_2_ACCEPTANCE.md`：Phase 2 验收结果和待办
- `docs/PHASE_3_ACCEPTANCE.md`：Phase 3 验收结果和待办
- `docs/PHASE_4_ACCEPTANCE.md`：Phase 4 验收结果和待办
- `docs/PHASE_5_ACCEPTANCE.md`：Phase 5 验收结果和待办
