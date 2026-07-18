import { NotebookTabs } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { MistakeBook } from "@/components/review/mistake-book";
import { EmptyState } from "@/components/ui/empty-state";
import { getOwnerMistakes } from "@/server/services/practice-service";

export const dynamic = "force-dynamic";

export default async function MistakesPage() {
  const mistakes = await getOwnerMistakes();

  return (
    <div className="space-y-6">
      <PageHeader
        description="答错自动归档；优先处理逾期和今日到期题，也可以随时再练任意一道历史错题。"
        eyebrow="错题本"
        title="把每次错误变成下一次进步"
      />
      {mistakes.length > 0 ? (
        <MistakeBook initialMistakes={mistakes} />
      ) : (
        <div className="space-y-4">
          <EmptyState
            description="当前没有错题记录。完成练习后，答错的题目会自动出现在这里。"
            icon={NotebookTabs}
            title="当前没有错题"
          />
          <Link
            className="mx-auto flex min-h-11 w-fit items-center rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800"
            href="/practice"
          >
            去章节练习
          </Link>
        </div>
      )}
    </div>
  );
}
