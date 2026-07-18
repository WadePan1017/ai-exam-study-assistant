import { BookOpenText } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function StudyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="知识目录将在Phase 2导入，支持18个一级模块和三级目录。"
        eyebrow="学习中心"
        title="按大纲建立知识体系"
      />
      <EmptyState
        description="当前还没有已发布的知识点。完成内容导入后，这里会显示真实的章节进度和掌握状态。"
        icon={BookOpenText}
        title="知识目录等待导入"
      />
    </div>
  );
}
