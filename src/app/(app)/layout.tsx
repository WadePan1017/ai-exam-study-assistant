import { AppNavigation } from "@/components/layout/app-navigation";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh">
      <AppNavigation />
      <div className="lg:pl-64">
        <div className="border-b border-slate-200/80 bg-white/80 px-5 py-3 backdrop-blur lg:hidden">
          <p className="text-sm font-semibold text-slate-950">AI考证学习助手</p>
          <p className="text-xs text-slate-500">系统集成项目管理工程师</p>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
