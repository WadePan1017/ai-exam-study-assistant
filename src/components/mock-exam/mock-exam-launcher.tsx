"use client";

import { Clock3, FileCheck2, Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type {
  MockExamSessionView,
  MockExamSetup,
} from "@/server/repositories/mock-exam-store";

function property<T>(value: unknown, key: string): T | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key] as T;
}

export function MockExamLauncher({ setup }: { setup: MockExamSetup }) {
  const router = useRouter();
  const [startingId, setStartingId] = useState("");
  const [message, setMessage] = useState("");

  async function start(templateId: string) {
    setStartingId(templateId);
    setMessage("");
    try {
      const response = await fetch("/api/mock-exams", {
        body: JSON.stringify({ templateId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json().catch(() => null);
      const session = property<MockExamSessionView>(body, "session");
      if (!response.ok || !session) {
        throw new Error(
          property<string>(body, "error") ?? "无法开始模考",
        );
      }
      router.push(`/mock-exam/${session.id}`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "无法开始模考",
      );
    } finally {
      setStartingId("");
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {setup.templates.map((template) => (
          <article
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            key={template.id}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="grid size-11 place-items-center rounded-2xl bg-teal-50 text-teal-800">
                <FileCheck2 aria-hidden="true" className="size-5" />
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {template.mode === "random" ? "随机组卷" : "固定卷"}
              </span>
            </div>
            <h2 className="mt-5 text-lg font-semibold text-slate-950">
              {template.name}
            </h2>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 aria-hidden="true" className="size-4" />
                {template.durationMinutes} 分钟
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Shuffle aria-hidden="true" className="size-4" />
                {template.questionCount} 题 · {template.maxScore} 分
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              仅使用已发布、无争议且可自动判分的客观题。交卷前不会显示答案。
            </p>
            <button
              className="mt-5 min-h-12 w-full rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50"
              disabled={Boolean(startingId)}
              onClick={() => void start(template.id)}
              type="button"
            >
              {startingId === template.id ? "正在组卷…" : "开始模拟考试"}
            </button>
          </article>
        ))}
      </div>
      {message ? (
        <p
          aria-live="polite"
          className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
