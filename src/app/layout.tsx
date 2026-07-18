import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI考证学习助手",
    template: "%s · AI考证学习助手",
  },
  description: "系统集成项目管理工程师个人备考助手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh bg-slate-50 text-slate-950 antialiased">
        {children}
      </body>
    </html>
  );
}
