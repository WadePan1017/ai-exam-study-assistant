import { FileCheck2 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { MockExamLauncher } from "@/components/mock-exam/mock-exam-launcher";
import { EmptyState } from "@/components/ui/empty-state";
import { getOwnerMockExamSetup } from "@/server/services/mock-exam-service";

export const dynamic = "force-dynamic";

export default async function MockExamPage() {
  const setup = await getOwnerMockExamSetup();

  return (
    <div className="space-y-6">
      <PageHeader
        description="按模板组卷、限时作答并自动保存。题量、时长和分值均来自可编辑配置。"
        eyebrow="模拟考试"
        title="用一次完整作答检验掌握情况"
      />
      {setup.templates.length > 0 ? (
        <MockExamLauncher setup={setup} />
      ) : (
        <EmptyState
          description="还没有已发布的模考模板，请先完成模板配置。"
          icon={FileCheck2}
          title="暂无模考模板"
        />
      )}
    </div>
  );
}
