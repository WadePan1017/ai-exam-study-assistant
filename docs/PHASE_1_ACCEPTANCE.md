# Phase 1 验收记录

日期：2026-07-18

## 已完成

- Next.js、React、TypeScript strict、Tailwind 工程基础。
- 单一 `owner` 访问口令，不引入注册或多用户账号。
- 30天 HttpOnly 会话 Cookie；服务端校验签名、签发时间和到期时间。
- 访问失败限流：15分钟窗口，第5次失败开始阻断，阻断时间从1分钟
  指数增加到最高1小时。
- 手机五项底部导航和桌面侧栏。
- 首页、学习、刷题、错题、设置和内容管理的真实空状态。
- `profiles`、`exams`、`access_rate_limits` 迁移和服务端
  Supabase 客户端。
- 浏览器角色无表权限、无 RLS 策略；仅服务端 `service_role` 可访问。
- 初始化种子重复执行不覆盖已编辑数据。
- 官方考试配置和 DeepSeek 决策已经记录。

## 自动化结果

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- `pnpm test:coverage`：17个单元/组件测试通过；全局行覆盖率83.33%。
- `pnpm test:e2e`：手机和桌面核心访问流程通过。
- `pnpm build`：通过；首页确认为动态服务端渲染。
- `pnpm audit --registry=https://registry.npmjs.org --prod`：
  无已知漏洞。

## 尚待外部环境验收

当前电脑没有 Supabase CLI，也没有目标 Supabase 云项目。正式部署前必须：

1. 创建 Supabase 云项目并配置服务端环境变量。
2. 在空数据库执行
   `supabase/migrations/202607180001_phase1_foundation.sql`。
3. 重复执行或用等价测试确认种子不覆盖已编辑数据。
4. 使用 `anon`、`authenticated` 和 `service_role` 分别验证权限边界。
5. 验证限流 RPC 的第5次失败、阻断到期、指数退避和成功后清除。
6. 部署后用真实手机完成一次解锁、刷新、退出和重新保护验收。

这部分完成前，Phase 1 的本地代码验收通过，但云端数据库和正式部署
不能标记为完成。
