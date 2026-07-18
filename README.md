# AI考证学习助手

面向“系统集成项目管理工程师（中级）”的个人备考 Web 应用。项目采用
移动端优先设计，按 `docs/spec/04_PHASE_PLAN_AND_ACCEPTANCE.md` 分阶段开发。

Phase 1 的本地代码已完成：工程基础、个人访问保护、响应式应用外壳、
Supabase 基础迁移和质量工具。知识点、题库和练习功能将在后续阶段实现。
真实 Supabase 项目的迁移和 RLS 验证仍需在云项目创建后完成。

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
- RLS基础保护
- 2026年已核验的考试科目、时长和合格规则

`anon` 和 `authenticated` 角色不能直接访问这些表，也没有 RLS
访问策略；应用只通过服务端的 `service_role` 访问。重复执行初始化种子
不会覆盖已经编辑的所有者资料或考试配置。

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
- 正式环境必须配置 Supabase，并先应用迁移；否则访问保护会拒绝登录，
  避免在没有持久限流的情况下暴露口令入口。
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
- `docs/PHASE_1_ACCEPTANCE.md`：Phase 1 验收结果和待办
