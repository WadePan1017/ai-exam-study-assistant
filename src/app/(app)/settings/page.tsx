import { Database, LogOut, UserRound } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="当前是个人专用模式，不需要注册账号。"
        eyebrow="我的"
        title="个人学习空间"
      />

      <section className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-4 p-5 sm:p-6">
          <span className="grid size-11 place-items-center rounded-2xl bg-teal-50 text-teal-800">
            <UserRound aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-950">个人所有者模式</h2>
            <p className="mt-1 text-sm text-slate-500">
              同时拥有学习和内容管理权限
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-5 sm:p-6">
          <span className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-700">
            <Database aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-950">数据状态</h2>
            <p className="mt-1 text-sm text-slate-500">
              Supabase连接将在部署时配置
            </p>
          </div>
        </div>
      </section>

      <form action="/api/access/logout" method="post">
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          type="submit"
        >
          <LogOut aria-hidden="true" className="size-4" />
          锁定学习空间
        </button>
      </form>
    </div>
  );
}
