import { ClipboardList } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function PracticePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="顺序、章节、随机和未做题练习将在Phase 3实现。"
        eyebrow="刷题中心"
        title="稳定记录每一次作答"
      />
      <EmptyState
        description="题库尚未导入，因此暂时不能开始练习。这里不会用示例按钮伪装成已实现功能。"
        icon={ClipboardList}
        title="暂无可练习题目"
      />
    </div>
  );
}
