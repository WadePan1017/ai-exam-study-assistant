import { NotebookTabs } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function MistakesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="答错的题目会在Phase 4自动归档并进入间隔复习队列。"
        eyebrow="错题本"
        title="把每次错误变成下一次进步"
      />
      <EmptyState
        description="当前没有错题记录。完成题库和练习引擎后，答错的题目会自动出现在这里。"
        icon={NotebookTabs}
        title="当前没有错题"
      />
    </div>
  );
}
