import { ClipboardList } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { PracticeLauncher } from "@/components/practice/practice-launcher";
import { EmptyState } from "@/components/ui/empty-state";
import { getOwnerPracticeSetup } from "@/server/services/practice-service";

export const dynamic = "force-dynamic";

export default async function PracticePage() {
  const setup = await getOwnerPracticeSetup();

  return (
    <div className="space-y-6">
      <PageHeader
        description="选择练习方式和题量。每次作答都会保存，刷新后仍可继续。"
        eyebrow="刷题中心"
        title="开始一次专注练习"
      />
      {setup.totalAvailable > 0 ? (
        <PracticeLauncher setup={setup} />
      ) : (
        <EmptyState
          description="还没有已发布的合规题目。请先到内容管理导入题目 JSON。"
          icon={ClipboardList}
          title="暂无可练习题目"
        />
      )}
    </div>
  );
}
