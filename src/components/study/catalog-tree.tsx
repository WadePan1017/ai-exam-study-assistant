import { BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";

import type {
  CatalogNode,
  LearningStatus,
  StudyCatalog,
} from "@/server/repositories/learning-content-store";

const statusLabels: Record<LearningStatus, string> = {
  learning: "学习中",
  mastered: "已掌握",
  not_started: "未开始",
  weak: "薄弱",
};

function NodeContent({ node }: { node: CatalogNode }) {
  return (
    <div className="space-y-3">
      {node.children.map((child) => (
        <section
          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
          key={child.key}
        >
          <h3 className="font-semibold text-slate-900">{child.title}</h3>
          <div className="mt-3">
            <NodeContent node={child} />
          </div>
        </section>
      ))}

      {node.knowledgePoints.map((point) => (
        <Link
          className="group flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-teal-300 hover:shadow-sm"
          href={`/study/${point.externalId}`}
          key={point.externalId}
        >
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-950">
                {point.title}
              </span>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                {statusLabels[point.learningStatus]}
              </span>
            </span>
            <span className="mt-1 line-clamp-2 block text-sm leading-6 text-slate-600">
              {point.summary}
            </span>
            <span className="mt-2 block text-xs text-slate-500">
              重要度 {point.importance} · 难度 {point.difficulty}/5
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="size-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-teal-700"
          />
        </Link>
      ))}
    </div>
  );
}

export function CatalogTree({ catalog }: { catalog: StudyCatalog }) {
  return (
    <div className="space-y-3">
      {catalog.modules.map((module) => {
        const hasContent =
          module.knowledgePoints.length > 0 ||
          module.children.length > 0;

        return (
          <details
            className="group overflow-hidden rounded-3xl border border-slate-200 bg-white"
            key={module.externalId}
            open={hasContent}
          >
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 py-4 marker:hidden">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-sm font-bold text-teal-700">
                {module.sortOrder}
              </span>
              <span className="min-w-0 flex-1 font-semibold text-slate-950">
                {module.title}
              </span>
              <span className="text-xs text-slate-500">
                {hasContent ? "查看内容" : "暂无内容"}
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-5 shrink-0 text-slate-400 transition group-open:rotate-90"
              />
            </summary>
            <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
              {hasContent ? (
                <NodeContent node={module} />
              ) : (
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  <BookOpen aria-hidden="true" className="size-4" />
                  该模块还没有已发布的知识点
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
