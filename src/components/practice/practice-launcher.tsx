"use client";

import {
  BookOpenCheck,
  ListOrdered,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  PracticeMode,
  PracticeSessionView,
  PracticeSetup,
} from "@/server/repositories/practice-store";

const modes = [
  {
    description: "按题目编号稳定推进",
    icon: ListOrdered,
    label: "顺序练习",
    value: "sequential",
  },
  {
    description: "只练选定知识模块",
    icon: BookOpenCheck,
    label: "章节练习",
    value: "chapter",
  },
  {
    description: "本次抽题不重复",
    icon: Shuffle,
    label: "随机练习",
    value: "random",
  },
  {
    description: "自动排除做过的题",
    icon: Sparkles,
    label: "只练未做题",
    value: "unanswered",
  },
] satisfies Array<{
  description: string;
  icon: typeof ListOrdered;
  label: string;
  value: PracticeMode;
}>;

function property<T>(value: unknown, key: string): T | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key] as T;
}

export function PracticeLauncher({ setup }: { setup: PracticeSetup }) {
  const router = useRouter();
  const [mode, setMode] = useState<PracticeMode>("sequential");
  const [moduleTitle, setModuleTitle] = useState(
    setup.modules[0]?.title ?? "",
  );
  const [count, setCount] = useState(
    Math.min(10, setup.totalAvailable),
  );
  const [message, setMessage] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const available = useMemo(() => {
    if (mode === "unanswered") {
      return setup.unansweredAvailable;
    }
    if (mode === "chapter") {
      return (
        setup.modules.find((module) => module.title === moduleTitle)
          ?.count ?? 0
      );
    }
    return setup.totalAvailable;
  }, [mode, moduleTitle, setup]);

  async function startPractice() {
    if (available === 0) {
      setMessage("当前条件下没有可练习题目");
      return;
    }

    setIsStarting(true);
    setMessage("");
    try {
      const response = await fetch("/api/practice/sessions", {
        body: JSON.stringify({
          count: Math.min(count, available),
          mode,
          moduleTitle: mode === "chapter" ? moduleTitle : undefined,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json().catch(() => null);
      const session = property<PracticeSessionView>(body, "session");
      if (!response.ok || !session) {
        throw new Error(
          property<string>(body, "error") ?? "无法开始练习",
        );
      }
      router.push(`/practice/${session.id}`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "无法开始练习",
      );
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {modes.map((item) => {
          const Icon = item.icon;
          const selected = item.value === mode;
          return (
            <button
              aria-pressed={selected}
              className={`min-h-32 rounded-3xl border p-5 text-left transition ${
                selected
                  ? "border-teal-600 bg-teal-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
              key={item.value}
              onClick={() => {
                setMode(item.value);
                setMessage("");
              }}
              type="button"
            >
              <Icon
                aria-hidden="true"
                className={
                  selected ? "size-6 text-teal-800" : "size-6 text-slate-500"
                }
              />
              <span className="mt-4 block font-semibold text-slate-950">
                {item.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {item.description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {mode === "chapter" ? (
            <label className="text-sm font-medium text-slate-800">
              选择模块
              <select
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-950"
                onChange={(event) => {
                  setModuleTitle(event.target.value);
                  setMessage("");
                }}
                value={moduleTitle}
              >
                {setup.modules.map((module) => (
                  <option key={module.title} value={module.title}>
                    {module.title}（{module.count}题）
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="text-sm font-medium text-slate-800">
            本次题量
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-slate-950"
              max={Math.max(1, available)}
              min={1}
              onChange={(event) =>
                setCount(Number.parseInt(event.target.value, 10) || 1)
              }
              type="number"
              value={Math.min(count, Math.max(1, available))}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            当前可用 <strong className="text-slate-950">{available}</strong>{" "}
            题
            {mode === "unanswered"
              ? `，已做 ${setup.totalAvailable - setup.unansweredAvailable} 题`
              : ""}
          </p>
          <button
            className="min-h-12 rounded-xl bg-teal-700 px-6 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isStarting || available === 0}
            onClick={() => void startPractice()}
            type="button"
          >
            {isStarting ? "正在创建练习…" : "开始练习"}
          </button>
        </div>

        {message ? (
          <p
            aria-live="polite"
            className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
