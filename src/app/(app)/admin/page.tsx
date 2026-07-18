import { FileUp } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="个人所有者拥有内容管理权限；导入校验和事务提交属于Phase 2。"
        eyebrow="内容管理"
        title="管理知识点与题库"
      />
      <EmptyState
        description="当前尚未实现导入功能。Phase 2会先提供知识点JSON校验、预览和导入报告。"
        icon={FileUp}
        title="等待内容导入功能"
      />
    </div>
  );
}
