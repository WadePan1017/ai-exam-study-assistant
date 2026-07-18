"use client";

import { TriangleAlert } from "lucide-react";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="grid min-h-96 place-items-center rounded-3xl border border-rose-200 bg-white p-8 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-700">
          <TriangleAlert aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-slate-950">
          页面加载失败
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          数据没有丢失。你可以重试，或稍后重新进入这个页面。
        </p>
        <button
          className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          onClick={reset}
          type="button"
        >
          重新加载
        </button>
      </div>
    </section>
  );
}
