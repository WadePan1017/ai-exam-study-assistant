"use client";

import {
  BookOpen,
  CircleUserRound,
  ClipboardCheck,
  Home,
  NotebookTabs,
  Settings,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryItems = [
  { href: "/", label: "首页", icon: Home },
  { href: "/study", label: "学习", icon: BookOpen },
  { href: "/practice", label: "刷题", icon: ClipboardCheck },
  { href: "/mistakes", label: "错题", icon: NotebookTabs },
  { href: "/settings", label: "我的", icon: CircleUserRound },
] as const;

const secondaryItems = [
  { href: "/admin", label: "内容管理", icon: ShieldCheck },
  { href: "/settings", label: "设置", icon: Settings },
] as const;

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavigationLink({
  href,
  label,
  icon: Icon,
  mobile = false,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={
        mobile
          ? `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition ${
              active
                ? "bg-teal-50 text-teal-800"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`
          : `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-teal-50 text-teal-900"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`
      }
      href={href}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  );
}

export function AppNavigation() {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200/80 bg-white/95 px-4 py-6 backdrop-blur lg:flex lg:flex-col">
        <Link className="mb-8 flex items-center gap-3 px-2" href="/">
          <span className="grid size-10 place-items-center rounded-2xl bg-teal-800 text-sm font-bold text-white shadow-sm">
            AI
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-950">
              考证学习助手
            </span>
            <span className="block text-xs text-slate-500">系统集成 · 中级</span>
          </span>
        </Link>

        <nav aria-label="主要导航" className="space-y-1">
          {primaryItems.map((item) => (
            <NavigationLink key={item.href} {...item} />
          ))}
        </nav>

        <div className="mt-auto space-y-1 border-t border-slate-100 pt-4">
          {secondaryItems.map((item) => (
            <NavigationLink key={`${item.href}-${item.label}`} {...item} />
          ))}
        </div>
      </aside>

      <nav
        aria-label="移动端主要导航"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_35px_rgba(15,23,42,0.06)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-xl">
          {primaryItems.map((item) => (
            <NavigationLink key={item.href} {...item} mobile />
          ))}
        </div>
      </nav>
    </>
  );
}
