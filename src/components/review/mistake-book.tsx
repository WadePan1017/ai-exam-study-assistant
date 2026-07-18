"use client";

import {
  CalendarClock,
  CheckCircle2,
  Filter,
  Heart,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  MistakeListItem,
  MistakeReason,
} from "@/server/repositories/practice-store";

const reasonLabels: Record<MistakeReason, string> = {
  not_learned: "知识点未学习",
  concept_confusion: "概念混淆",
  formula_memory: "公式记忆不牢",
  calculation_error: "计算错误",
  reading_error: "审题错误",
  option_trap: "选项陷阱",
  time_shortage: "时间不足",
  careless: "粗心",
  other: "其他",
};

const dueLabels: Record<MistakeListItem["dueStatus"], string> = {
  scheduled: "尚未到期",
  due_today: "今日到期",
  overdue: "已经逾期",
  paused: "已暂停",
};

function property<T>(value: unknown, key: string): T | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key] as T;
}

function formatReviewDate(value: string | null) {
  if (!value) {
    return "不再自动安排";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

export function MistakeBook({
  initialMistakes,
}: {
  initialMistakes: MistakeListItem[];
}) {
  const router = useRouter();
  const [mistakes, setMistakes] = useState(initialMistakes);
  const [status, setStatus] = useState("all");
  const [moduleTitle, setModuleTitle] = useState("all");
  const [reason, setReason] = useState("all");
  const [minimumWrong, setMinimumWrong] = useState("all");
  const [recentDays, setRecentDays] = useState("all");
  const [referenceNow] = useState(() => Date.now());
  const [pendingAction, setPendingAction] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState("");

  const modules = useMemo(
    () =>
      Array.from(
        new Set(mistakes.flatMap((mistake) => mistake.moduleTitles)),
      ).sort((left, right) => left.localeCompare(right, "zh-CN")),
    [mistakes],
  );

  const filteredMistakes = useMemo(() => {
    const recentCutoff =
      recentDays === "all"
        ? null
        : referenceNow -
          Number.parseInt(recentDays, 10) * 24 * 60 * 60 * 1000;

    return mistakes.filter(
      (mistake) =>
        (status === "all" ||
          (status === "active" ? mistake.isWrong : !mistake.isWrong)) &&
        (moduleTitle === "all" ||
          mistake.moduleTitles.includes(moduleTitle)) &&
        (reason === "all" ||
          (reason === "unassigned"
            ? mistake.errorReason === null
            : mistake.errorReason === reason)) &&
        (minimumWrong === "all" ||
          mistake.wrongAttempts >= Number.parseInt(minimumWrong, 10)) &&
        (recentCutoff === null ||
          new Date(mistake.lastWrongAt).getTime() >= recentCutoff),
    );
  }, [
    minimumWrong,
    mistakes,
    moduleTitle,
    reason,
    recentDays,
    referenceNow,
    status,
  ]);

  const stats = useMemo(
    () => ({
      active: mistakes.filter((mistake) => mistake.isWrong).length,
      due: mistakes.filter(
        (mistake) =>
          mistake.dueStatus === "due_today" ||
          mistake.dueStatus === "overdue",
      ).length,
      mastered: mistakes.filter((mistake) => !mistake.isWrong).length,
      overdue: mistakes.filter(
        (mistake) => mistake.dueStatus === "overdue",
      ).length,
      total: mistakes.length,
    }),
    [mistakes],
  );

  async function startReview(questionExternalId?: string) {
    const actionKey = questionExternalId ?? "due-queue";
    setPendingAction(actionKey);
    setMessage("");
    try {
      const response = await fetch("/api/practice/sessions", {
        body: JSON.stringify({
          count: questionExternalId ? 1 : Math.min(stats.due, 20),
          mode: "review",
          ...(questionExternalId ? { questionExternalId } : {}),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json().catch(() => null);
      const session = property<{ id: string }>(body, "session");
      if (!response.ok || !session) {
        throw new Error(
          property<string>(body, "error") ?? "无法开始复习",
        );
      }
      router.push(`/practice/${session.id}`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "无法开始复习",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function saveReason(
    externalId: string,
    nextReason: MistakeReason,
  ) {
    setPendingAction(`reason:${externalId}`);
    setMessage("");
    try {
      const response = await fetch(
        `/api/mistakes/${encodeURIComponent(externalId)}/reason`,
        {
          body: JSON.stringify({ reason: nextReason }),
          headers: { "content-type": "application/json" },
          method: "PUT",
        },
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          property<string>(body, "error") ?? "保存错因失败",
        );
      }
      setMistakes((current) =>
        current.map((mistake) =>
          mistake.externalId === externalId
            ? { ...mistake, errorReason: nextReason }
            : mistake,
        ),
      );
      setMessage("错因已保存");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "保存错因失败",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function markMastered(externalId: string) {
    setPendingAction(`mastered:${externalId}`);
    setMessage("");
    try {
      const response = await fetch(
        `/api/mistakes/${encodeURIComponent(externalId)}/mastered`,
        { method: "POST" },
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          property<string>(body, "error") ?? "标记掌握失败",
        );
      }
      setMistakes((current) =>
        current.map((mistake) =>
          mistake.externalId === externalId
            ? {
                ...mistake,
                dueStatus: "paused",
                isWrong: false,
                masteredAt: new Date().toISOString(),
                nextReviewAt: null,
              }
            : mistake,
        ),
      );
      setMessage("已标记掌握，自动复习已暂停");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "标记掌握失败",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-5">
      <section
        aria-label="错题统计"
        className="grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        {[
          ["错题历史", stats.total],
          ["仍需巩固", stats.active],
          ["今日待复习", stats.due],
          ["已经逾期", stats.overdue],
          ["暂时掌握", stats.mastered],
        ].map(([label, value]) => (
          <div
            className="rounded-2xl border border-slate-200 bg-white p-4"
            key={label}
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {value}
            </p>
          </div>
        ))}
      </section>

      {stats.due > 0 ? (
        <button
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50 sm:w-auto"
          disabled={pendingAction !== null}
          onClick={() => void startReview()}
          type="button"
        >
          <CalendarClock aria-hidden="true" className="size-5" />
          {pendingAction === "due-queue"
            ? "正在创建复习…"
            : `开始今日复习（${stats.due}题）`}
        </button>
      ) : null}

      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-slate-800">
          <Filter aria-hidden="true" className="size-4" />
          筛选错题
          <span className="ml-auto text-xs font-normal text-slate-500">
            当前 {filteredMistakes.length} 题
          </span>
        </summary>
        <div className="grid gap-4 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-medium text-slate-600">
            状态
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="all">全部</option>
              <option value="active">仍需巩固</option>
              <option value="mastered">暂时掌握</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            模块
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
              onChange={(event) => setModuleTitle(event.target.value)}
              value={moduleTitle}
            >
              <option value="all">全部模块</option>
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            错因
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
              onChange={(event) => setReason(event.target.value)}
              value={reason}
            >
              <option value="all">全部错因</option>
              <option value="unassigned">尚未标注</option>
              {Object.entries(reasonLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            错误次数
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
              onChange={(event) => setMinimumWrong(event.target.value)}
              value={minimumWrong}
            >
              <option value="all">不限</option>
              <option value="1">至少1次</option>
              <option value="2">至少2次</option>
              <option value="3">至少3次</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            最近答错
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
              onChange={(event) => setRecentDays(event.target.value)}
              value={recentDays}
            >
              <option value="all">不限</option>
              <option value="7">最近7天</option>
              <option value="30">最近30天</option>
            </select>
          </label>
        </div>
      </details>

      {message ? (
        <p
          aria-live="polite"
          className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {message}
        </p>
      ) : null}

      <section aria-label="错题列表" className="space-y-4">
        {filteredMistakes.map((mistake) => (
          <article
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            key={mistake.externalId}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-full px-2.5 py-1 font-medium ${
                  mistake.dueStatus === "overdue"
                    ? "bg-rose-50 text-rose-700"
                    : mistake.dueStatus === "due_today"
                      ? "bg-amber-50 text-amber-800"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {dueLabels[mistake.dueStatus]}
              </span>
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-teal-800">
                复习等级 {mistake.reviewLevel}
              </span>
              {mistake.isFavorite ? (
                <span className="inline-flex items-center gap-1 text-rose-700">
                  <Heart
                    aria-hidden="true"
                    className="size-3.5 fill-current"
                  />
                  已收藏
                </span>
              ) : null}
            </div>

            <h2 className="mt-4 text-base font-semibold leading-7 text-slate-950">
              {mistake.stem}
            </h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {mistake.moduleTitles.join(" · ") || "未关联模块"} · 共答错{" "}
              {mistake.wrongAttempts} 次 · 下次复习{" "}
              {formatReviewDate(mistake.nextReviewAt)}
            </p>

            <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="text-xs font-medium text-slate-600">
                错误原因
                <select
                  aria-label={`错误原因：${mistake.stem}`}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
                  disabled={pendingAction !== null}
                  onChange={(event) =>
                    void saveReason(
                      mistake.externalId,
                      event.target.value as MistakeReason,
                    )
                  }
                  value={mistake.errorReason ?? ""}
                >
                  <option disabled value="">
                    请选择错因
                  </option>
                  {Object.entries(reasonLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-2 sm:flex-row">
                {mistake.nextReviewAt ? (
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    disabled={pendingAction !== null}
                    onClick={() =>
                      void markMastered(mistake.externalId)
                    }
                    type="button"
                  >
                    <CheckCircle2
                      aria-hidden="true"
                      className="size-4"
                    />
                    标记掌握
                  </button>
                ) : null}
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  disabled={pendingAction !== null}
                  onClick={() =>
                    void startReview(mistake.externalId)
                  }
                  type="button"
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  {pendingAction === mistake.externalId
                    ? "正在创建…"
                    : "再练此题"}
                </button>
              </div>
            </div>
          </article>
        ))}

        {filteredMistakes.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <p className="font-semibold text-slate-900">
              没有符合当前筛选的错题
            </p>
            <p className="mt-2 text-sm text-slate-500">
              调整筛选条件后再查看。
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
