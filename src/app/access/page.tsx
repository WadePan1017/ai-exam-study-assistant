import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "进入学习助手",
};

const errorMessages = {
  invalid: "访问口令不正确，请重新输入。",
  configuration: "应用尚未配置访问口令，请先完成环境变量设置。",
} as const;

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const error =
    params.error && params.error in errorMessages
      ? errorMessages[params.error as keyof typeof errorMessages]
      : null;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#f5f8f7] px-5 py-10">
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 size-80 rounded-full bg-teal-200/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -left-24 size-96 rounded-full bg-cyan-100/70 blur-3xl"
      />

      <section className="relative w-full max-w-md rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_28px_80px_rgba(15,118,110,0.12)] backdrop-blur sm:p-8">
        <div className="mb-8">
          <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-teal-800 text-white shadow-lg shadow-teal-900/15">
            <Sparkles aria-hidden="true" className="size-6" />
          </span>
          <p className="mb-2 text-sm font-semibold tracking-wide text-teal-700">
            系统集成项目管理工程师 · 中级
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            开始今天的学习
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            这是你的个人学习空间。输入一次访问口令，之后本设备会保持登录状态。
          </p>
        </div>

        {error ? (
          <p
            className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <form action="/api/access" method="post">
          <input name="next" type="hidden" value={params.next ?? "/"} />
          <label
            className="mb-2 block text-sm font-medium text-slate-800"
            htmlFor="accessKey"
          >
            访问口令
          </label>
          <div className="relative">
            <KeyRound
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"
            />
            <input
              autoComplete="current-password"
              autoFocus
              className="h-13 w-full rounded-2xl border border-slate-300 bg-white pl-12 pr-4 text-base text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              id="accessKey"
              name="accessKey"
              placeholder="输入你的访问口令"
              required
              type="password"
            />
          </div>
          <button
            className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-teal-800 px-5 text-base font-semibold text-white shadow-lg shadow-teal-900/15 transition hover:bg-teal-900 active:translate-y-px"
            type="submit"
          >
            <ShieldCheck aria-hidden="true" className="size-5" />
            进入学习助手
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          口令只用于保护个人数据和AI预算，不会创建公开账号。
        </p>
      </section>
    </main>
  );
}
