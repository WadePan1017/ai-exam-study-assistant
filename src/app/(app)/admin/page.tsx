import { KnowledgeImportPanel } from "@/components/admin/knowledge-import-panel";
import { PageHeader } from "@/components/layout/page-header";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="个人所有者同时拥有学习与内容管理权限。导入内容必须标注来源、版权状态和审核状态。"
        eyebrow="内容管理"
        title="管理知识点"
      />
      <KnowledgeImportPanel />
      <aside className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 sm:p-6">
        <h2 className="font-semibold">内容合规提醒</h2>
        <p className="mt-1">
          不要批量复制商业教材或题库。AI生成内容必须先作为草稿并经人工复核；版权状态未知的内容不能发布。
        </p>
      </aside>
    </div>
  );
}
