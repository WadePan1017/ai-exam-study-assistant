import { Search } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { PageHeader } from "@/components/layout/page-header";
import { CatalogTree } from "@/components/study/catalog-tree";
import { EmptyState } from "@/components/ui/empty-state";
import { getStudyCatalog } from "@/server/services/learning-content-service";

export const dynamic = "force-dynamic";

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const queryResult = z.string().trim().max(200).safeParse(q);
  const query = queryResult.success ? queryResult.data : "";
  const catalog = await getStudyCatalog(query);

  return (
    <div className="space-y-6">
      <PageHeader
        description="按考试大纲的18个一级模块浏览已发布知识点，最多支持三级目录。"
        eyebrow="学习中心"
        title="知识目录"
      />

      <form className="flex gap-2" role="search">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">搜索知识点</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"
          />
          <input
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-12 pr-4 text-sm text-slate-950 placeholder:text-slate-400"
            defaultValue={query}
            name="q"
            placeholder="搜索标题、摘要或目录"
            type="search"
          />
        </label>
        <button
          className="h-12 shrink-0 rounded-2xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
          type="submit"
        >
          搜索
        </button>
      </form>

      <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
        <p>
          已发布 {catalog.totalPublished} 个知识点
          {query ? `，找到 ${catalog.matchedPublished} 个结果` : ""}
        </p>
        {query ? (
          <Link
            className="font-medium text-teal-700 hover:underline"
            href="/study"
          >
            清除搜索
          </Link>
        ) : null}
      </div>

      {catalog.modules.length ? (
        <CatalogTree catalog={catalog} />
      ) : (
        <EmptyState
          description={`没有找到与“${query}”匹配的已发布知识点，请尝试其他关键词。`}
          icon={Search}
          title="没有搜索结果"
        />
      )}
    </div>
  );
}
