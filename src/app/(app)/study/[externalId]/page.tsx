import { ArrowLeft, BookMarked } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { KnowledgeStateForm } from "@/components/study/knowledge-state-form";
import { knowledgeExternalIdSchema } from "@/features/knowledge/knowledge-import-schema";
import { getPublishedKnowledgePoint } from "@/server/services/learning-content-service";

export const dynamic = "force-dynamic";

function ContentSection({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  if (!content.trim()) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
        {content}
      </div>
    </section>
  );
}

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ externalId: string }>;
}) {
  const { externalId } = await params;
  const externalIdResult =
    knowledgeExternalIdSchema.safeParse(externalId);
  if (!externalIdResult.success) {
    notFound();
  }

  const point = await getPublishedKnowledgePoint(externalIdResult.data);

  if (!point) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-teal-700 hover:underline"
        href="/study"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        返回知识目录
      </Link>

      <header className="rounded-3xl bg-teal-950 p-6 text-white sm:p-8">
        <div className="flex items-center gap-2 text-xs text-teal-100">
          <BookMarked aria-hidden="true" className="size-4" />
          {point.syllabusPath.join(" / ")}
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          {point.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-teal-50/85">
          {point.summary}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/10 px-3 py-1">
            重要度 {point.importance}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1">
            难度 {point.difficulty}/5
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1">
            内容版本 {point.version}
          </span>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <ContentSection content={point.content} title="核心内容" />
        <ContentSection content={point.examFocus} title="考试关注点" />
        <ContentSection content={point.confusion} title="易混淆点" />
        <ContentSection content={point.workExample} title="工作场景示例" />
        <ContentSection content={point.formula} title="公式与计算" />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600 sm:p-6">
        <h2 className="font-semibold text-slate-900">来源与版权</h2>
        <p className="mt-2">{point.sourceNote}</p>
        <p className="mt-1">
          来源类型：{point.sourceType} · 版权状态：{point.copyrightStatus}
        </p>
      </section>

      <KnowledgeStateForm
        externalId={point.externalId}
        initialState={{
          isFavorite: point.isFavorite,
          personalNote: point.personalNote,
          status: point.learningStatus,
        }}
      />
    </div>
  );
}
