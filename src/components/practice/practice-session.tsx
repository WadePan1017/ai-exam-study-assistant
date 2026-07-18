"use client";

import {
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { PracticeSessionView } from "@/server/repositories/practice-store";

function property<T>(value: unknown, key: string): T | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key] as T;
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function PracticeSession({
  initialSession,
}: {
  initialSession: PracticeSessionView;
}) {
  const [session, setSession] = useState(initialSession);
  const [selectedKeys, setSelectedKeys] = useState(
    initialSession.current.selectedKeys,
  );
  const [uncertain, setUncertain] = useState(
    initialSession.current.confidence === "uncertain",
  );
  const [elapsed, setElapsed] = useState(() =>
    Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(initialSession.startedAt).getTime()) /
          1000,
      ),
    ),
  );
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setInterval(
      () => setElapsed((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  function applySession(nextSession: PracticeSessionView) {
    setSession(nextSession);
    setSelectedKeys(nextSession.current.selectedKeys);
    setUncertain(nextSession.current.confidence === "uncertain");
  }

  async function readSessionResponse(response: Response) {
    const body: unknown = await response.json().catch(() => null);
    const nextSession = property<PracticeSessionView>(body, "session");
    if (!response.ok || !nextSession) {
      throw new Error(
        property<string>(body, "error") ?? "操作失败，请重试",
      );
    }
    return nextSession;
  }

  async function navigate(index: number) {
    setIsWorking(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/practice/sessions/${session.id}/position`,
        {
          body: JSON.stringify({ index }),
          headers: { "content-type": "application/json" },
          method: "PUT",
        },
      );
      applySession(await readSessionResponse(response));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "切换题目失败");
    } finally {
      setIsWorking(false);
    }
  }

  async function submit() {
    if (selectedKeys.length === 0) {
      setMessage("请先选择答案");
      return;
    }

    setIsWorking(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/practice/sessions/${session.id}/answer`,
        {
          body: JSON.stringify({
            confidence: uncertain ? "uncertain" : "certain",
            selectedKeys,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      applySession(await readSessionResponse(response));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交答案失败");
    } finally {
      setIsWorking(false);
    }
  }

  async function toggleFavorite() {
    const nextFavorite = !session.current.isFavorite;
    setIsWorking(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/questions/${session.current.externalId}/favorite`,
        {
          body: JSON.stringify({ isFavorite: nextFavorite }),
          headers: { "content-type": "application/json" },
          method: "PUT",
        },
      );
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(
          property<string>(body, "error") ?? "保存收藏失败",
        );
      }
      setSession((current) => ({
        ...current,
        current: {
          ...current.current,
          isFavorite: nextFavorite,
        },
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存收藏失败");
    } finally {
      setIsWorking(false);
    }
  }

  function toggleOption(key: string) {
    if (session.current.feedback) {
      return;
    }
    if (session.current.type === "multiple_choice") {
      setSelectedKeys((current) =>
        current.includes(key)
          ? current.filter((item) => item !== key)
          : [...current, key],
      );
      return;
    }
    setSelectedKeys([key]);
  }

  const feedback = session.current.feedback;
  const isLast = session.currentIndex === session.total - 1;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-28">
      <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <Link
          className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-slate-600"
          href="/practice"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          退出
        </Link>
        <p className="text-sm font-semibold text-slate-950">
          {session.currentIndex + 1} / {session.total}
        </p>
        <p className="inline-flex min-h-10 items-center gap-1.5 text-sm tabular-nums text-slate-600">
          <Clock3 aria-hidden="true" className="size-4" />
          {formatElapsed(elapsed)}
        </p>
      </header>

      <div
        aria-label={`练习进度 ${session.currentIndex + 1} / ${session.total}`}
        aria-valuemax={session.total}
        aria-valuemin={0}
        aria-valuenow={session.currentIndex + 1}
        className="h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-teal-600 transition-all"
          style={{
            width: `${((session.currentIndex + 1) / session.total) * 100}%`,
          }}
        />
      </div>

      <article className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              {session.current.type === "multiple_choice"
                ? "多选题"
                : session.current.type === "true_false"
                  ? "判断题"
                  : "单选题"}
              {" · "}v{session.current.version}
            </p>
            <h1 className="mt-3 text-lg font-semibold leading-8 text-slate-950 sm:text-xl">
              {session.current.stem}
            </h1>
          </div>
          <button
            aria-label={
              session.current.isFavorite ? "取消收藏本题" : "收藏本题"
            }
            aria-pressed={session.current.isFavorite}
            className={`grid size-11 shrink-0 place-items-center rounded-xl border transition ${
              session.current.isFavorite
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
            disabled={isWorking}
            onClick={() => void toggleFavorite()}
            type="button"
          >
            <Bookmark
              aria-hidden="true"
              className="size-5"
              fill={session.current.isFavorite ? "currentColor" : "none"}
            />
          </button>
        </div>

        <fieldset className="mt-6 space-y-3">
          <legend className="sr-only">请选择答案</legend>
          {session.current.options.map((option) => {
            const selected = selectedKeys.includes(option.key);
            const correct = feedback?.correctKeys.includes(option.key);
            const wrongSelection = Boolean(
              feedback && selected && !correct,
            );
            return (
              <label
                className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 transition ${
                  correct
                    ? "border-emerald-400 bg-emerald-50"
                    : wrongSelection
                      ? "border-red-300 bg-red-50"
                      : selected
                        ? "border-teal-500 bg-teal-50"
                        : "border-slate-200 hover:border-slate-300"
                } ${feedback ? "cursor-default" : ""}`}
                key={option.key}
              >
                <input
                  checked={selected}
                  className="mt-1 size-4 accent-teal-700"
                  disabled={Boolean(feedback)}
                  name="answer"
                  onChange={() => toggleOption(option.key)}
                  type={
                    session.current.type === "multiple_choice"
                      ? "checkbox"
                      : "radio"
                  }
                />
                <span className="text-sm leading-6 text-slate-800">
                  <strong className="mr-2 text-slate-950">
                    {option.key}.
                  </strong>
                  {option.content}
                </span>
              </label>
            );
          })}
        </fieldset>

        {!feedback ? (
          <label className="mt-5 flex min-h-11 items-center gap-3 rounded-xl bg-slate-50 px-4 text-sm text-slate-700">
            <input
              checked={uncertain}
              className="size-4 accent-amber-600"
              onChange={(event) => setUncertain(event.target.checked)}
              type="checkbox"
            />
            这题我不确定
          </label>
        ) : (
          <section
            className={`mt-6 rounded-2xl border p-5 ${
              feedback.isCorrect
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.isCorrect ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="size-5 text-emerald-700"
                />
              ) : (
                <XCircle
                  aria-hidden="true"
                  className="size-5 text-red-700"
                />
              )}
              <h2 className="font-semibold text-slate-950">
                {feedback.isCorrect ? "回答正确" : "回答错误"}
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              正确答案：{feedback.correctKeys.join("、")}
            </p>
            <h3 className="mt-4 text-sm font-semibold text-slate-950">
              解析
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {feedback.explanation}
            </p>

            {session.current.knowledgePointExternalIds.length > 0 ? (
              <div className="mt-4 border-t border-slate-200/70 pt-4">
                <p className="text-xs font-medium text-slate-500">
                  关联知识点
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {session.current.knowledgePointExternalIds.map(
                    (externalId) => (
                      <Link
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-teal-800"
                        href={`/study/${externalId}`}
                        key={externalId}
                      >
                        {externalId}
                      </Link>
                    ),
                  )}
                </div>
              </div>
            ) : null}

            <p className="mt-4 text-xs text-slate-500">
              本题共保留 {session.current.attemptHistory.length} 次历史作答
              {session.current.confidence === "uncertain"
                ? " · 本次标记为不确定"
                : ""}
            </p>
          </section>
        )}
      </article>

      <details className="rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          题号导航（已答 {session.answeredIndexes.length}/{session.total}）
        </summary>
        <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: session.total }, (_, index) => (
            <button
              aria-label={`第${index + 1}题${
                session.answeredIndexes.includes(index) ? "，已答" : ""
              }`}
              className={`aspect-square rounded-xl text-sm font-semibold ${
                index === session.currentIndex
                  ? "bg-teal-700 text-white"
                  : session.answeredIndexes.includes(index)
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-600"
              }`}
              disabled={isWorking}
              key={index}
              onClick={() => void navigate(index)}
              type="button"
            >
              {index + 1}
            </button>
          ))}
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

      <div className="fixed inset-x-0 bottom-[4.8rem] z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            className="inline-flex min-h-12 items-center justify-center gap-1 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40"
            disabled={isWorking || session.currentIndex === 0}
            onClick={() => void navigate(session.currentIndex - 1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            上一题
          </button>

          {feedback ? (
            isLast ? (
              <Link
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white"
                href="/practice"
              >
                完成并返回
              </Link>
            ) : (
              <button
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white disabled:opacity-50"
                disabled={isWorking}
                onClick={() => void navigate(session.currentIndex + 1)}
                type="button"
              >
                下一题
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            )
          ) : (
            <button
              className="min-h-12 flex-1 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
              disabled={isWorking || selectedKeys.length === 0}
              onClick={() => void submit()}
              type="button"
            >
              {isWorking ? "正在保存…" : "提交答案"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
