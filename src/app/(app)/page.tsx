import {
  ArrowRight,
  CalendarCheck,
  CircleAlert,
  DatabaseZap,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const today = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "full",
    timeZone: "Asia/Shanghai",
  }).format(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        description="先完成基础工程，导入知识点和题库后，这里会根据真实记录生成每日任务。"
        eyebrow={today}
        title="今天，从一个小目标开始"
      />

      <section className="overflow-hidden rounded-3xl bg-teal-900 p-6 text-white shadow-xl shadow-teal-950/10 sm:p-8">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-teal-50">
              <CalendarCheck aria-hidden="true" className="size-4" />
              今日学习计划
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
              还没有可学习的内容
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-teal-50/80">
              Phase 2
              导入知识点后，系统会生成1个知识点和20道题的基础任务，不展示虚假进度。
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-teal-950 transition hover:bg-teal-50"
            href="/study"
          >
            查看学习中心
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      <EmptyState
        description="导入知识点和题库后，这里才会依据真实学习记录显示进度、复习数量和练习统计。"
        icon={DatabaseZap}
        title="暂无学习数据"
      />

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
        <div className="flex gap-3">
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-amber-700"
          />
          <div>
            <h2 className="font-semibold text-amber-950">当前处于工程基础阶段</h2>
            <p className="mt-1 text-sm leading-6 text-amber-900/80">
              学习、刷题、错题和模考入口已经可用；首页统计与今日任务将在后续报告阶段接入真实学习记录。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
