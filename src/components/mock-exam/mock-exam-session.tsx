"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  Send,
  WifiOff,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  clearSyncedMockExamDraft,
  listMockExamDrafts,
  saveMockExamDraft,
} from "@/features/mock-exam/mock-exam-offline-queue";
import type { MockExamSessionView } from "@/server/repositories/mock-exam-store";

function property<T>(value: unknown, key: string): T | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key] as T;
}

function formatRemaining(seconds: number) {
  const hours = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${remainder}`;
}

async function readSession(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const session = property<MockExamSessionView>(body, "session");
  if (!response.ok || !session) {
    throw new Error(property<string>(body, "error") ?? "操作失败，请重试");
  }
  return session;
}

export function MockExamSession({
  initialSession,
}: {
  initialSession: MockExamSessionView;
}) {
  const [session, setSession] = useState(initialSession);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(() =>
    Math.max(
      0,
      Math.ceil(
        (new Date(initialSession.deadlineAt).getTime() - Date.now()) /
          1000,
      ),
    ),
  );
  const [syncState, setSyncState] = useState<
    "saved" | "saving" | "offline"
  >("saved");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSubmitRef = useRef(false);

  const syncDraft = useCallback(
    async (position: number, selectedKeys: string[]) => {
      try {
        const response = await fetch(
          `/api/mock-exams/sessions/${session.id}/answer`,
          {
            body: JSON.stringify({ position, selectedKeys }),
            headers: { "content-type": "application/json" },
            method: "PUT",
          },
        );
        const next = await readSession(response);
        clearSyncedMockExamDraft(
          window.localStorage,
          session.id,
          position,
          selectedKeys,
        );
        setSession(next);
        setSyncState(
          listMockExamDrafts(window.localStorage, session.id).length
            ? "offline"
            : "saved",
        );
      } catch {
        setSyncState("offline");
      }
    },
    [session.id],
  );

  const submitSession = useCallback(async () => {
    if (isSubmitting || session.status === "submitted") {
      return;
    }
    setIsSubmitting(true);
    setMessage("");
    try {
      const drafts = listMockExamDrafts(
        window.localStorage,
        session.id,
      );
      for (const draft of drafts) {
        await syncDraft(draft.position, draft.selectedKeys);
      }
      if (
        listMockExamDrafts(window.localStorage, session.id).length >
        0
      ) {
        throw new Error("仍有答案未同步，请联网后再交卷");
      }
      const response = await fetch(
        `/api/mock-exams/sessions/${session.id}/submit`,
        { method: "POST" },
      );
      setSession(await readSession(response));
      setSyncState("saved");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "交卷失败，请重试",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, session.id, session.status, syncDraft]);

  useEffect(() => {
    if (session.status === "submitted") {
      return;
    }
    const drafts = listMockExamDrafts(window.localStorage, session.id);
    const hydrateTimer = window.setTimeout(() => {
      if (drafts.length === 0) {
        return;
      }
      setSession((current) => ({
        ...current,
        items: current.items.map((item) => {
          const draft = drafts.find(
            (candidate) => candidate.position === item.position,
          );
          return draft
            ? { ...item, selectedKeys: draft.selectedKeys }
            : item;
        }),
      }));
      setSyncState("offline");
    }, 0);
    const flush = async () => {
      for (const draft of listMockExamDrafts(
        window.localStorage,
        session.id,
      )) {
        await syncDraft(draft.position, draft.selectedKeys);
      }
      if (
        Date.now() >= new Date(session.deadlineAt).getTime() &&
        listMockExamDrafts(window.localStorage, session.id).length === 0
      ) {
        void submitSession();
      }
    };
    if (navigator.onLine) {
      void flush();
    }
    const handleOnline = () => void flush();
    window.addEventListener("online", handleOnline);
    return () => {
      window.clearTimeout(hydrateTimer);
      window.removeEventListener("online", handleOnline);
    };
  }, [
    session.deadlineAt,
    session.id,
    session.status,
    submitSession,
    syncDraft,
  ]);

  useEffect(() => {
    if (session.status === "submitted") {
      return;
    }
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil(
          (new Date(session.deadlineAt).getTime() - Date.now()) /
            1000,
        ),
      );
      setRemaining(seconds);
      if (seconds === 0 && !autoSubmitRef.current) {
        autoSubmitRef.current = true;
        void submitSession();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session.deadlineAt, session.status, submitSession]);

  const item = session.items[currentIndex];

  function selectOption(key: string) {
    if (session.status !== "in_progress") {
      return;
    }
    const selectedKeys =
      item.type === "multiple_choice"
        ? item.selectedKeys.includes(key)
          ? item.selectedKeys.filter((selected) => selected !== key)
          : [...item.selectedKeys, key]
        : [key];
    setSession((current) => ({
      ...current,
      items: current.items.map((candidate) =>
        candidate.position === item.position
          ? { ...candidate, selectedKeys }
          : candidate,
      ),
    }));
    saveMockExamDraft(window.localStorage, {
      position: item.position,
      selectedKeys,
      sessionId: session.id,
      updatedAt: new Date().toISOString(),
    });
    setSyncState("saving");
    void syncDraft(item.position, selectedKeys);
  }

  async function toggleMarked() {
    const next = !item.isMarked;
    setSession((current) => ({
      ...current,
      items: current.items.map((candidate) =>
        candidate.position === item.position
          ? { ...candidate, isMarked: next }
          : candidate,
      ),
    }));
    try {
      const response = await fetch(
        `/api/mock-exams/sessions/${session.id}/mark`,
        {
          body: JSON.stringify({
            isMarked: next,
            position: item.position,
          }),
          headers: { "content-type": "application/json" },
          method: "PUT",
        },
      );
      setSession(await readSession(response));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "保存标记失败",
      );
    }
  }

  if (session.status === "submitted" && session.result) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-24">
        <section className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
          <p className="text-sm text-teal-300">模考已交卷</p>
          <div className="mt-3 flex items-end gap-2">
            <strong className="text-5xl font-semibold tracking-tight">
              {session.score}
            </strong>
            <span className="pb-1 text-slate-400">
              / {session.maxScore} 分
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-300">
            答对 {session.result.correctCount} /{" "}
            {session.result.questionCount} 题。错题已进入错题本和复习队列。
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-950">章节拆解</h2>
            <div className="mt-4 space-y-3">
              {session.result.byModule.map((row) => (
                <div
                  className="flex items-center justify-between text-sm"
                  key={row.moduleTitle}
                >
                  <span className="text-slate-600">{row.moduleTitle}</span>
                  <strong className="text-slate-950">
                    {row.score}/{row.maxScore}
                  </strong>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-950">题型拆解</h2>
            <div className="mt-4 space-y-3">
              {session.result.byType.map((row) => (
                <div
                  className="flex items-center justify-between text-sm"
                  key={row.type}
                >
                  <span className="text-slate-600">
                    {row.type === "multiple_choice"
                      ? "多选题"
                      : row.type === "true_false"
                        ? "判断题"
                        : "单选题"}
                  </span>
                  <strong className="text-slate-950">
                    {row.correctCount}/{row.questionCount}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-950">
            逐题回顾
          </h2>
          {session.items.map((resultItem) => (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-5"
              key={resultItem.position}
            >
              <div className="flex items-start gap-3">
                {resultItem.isCorrect ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal-700" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-rose-600" />
                )}
                <div>
                  <h3 className="font-medium leading-7 text-slate-950">
                    {resultItem.position + 1}. {resultItem.stem}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    你的答案：
                    {resultItem.selectedKeys.join("、") || "未作答"}；正确答案：
                    {resultItem.correctKeys?.join("、")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {resultItem.explanation}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>
        <div className="flex gap-3">
          <Link
            className="min-h-11 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700"
            href="/mistakes"
          >
            查看错题本
          </Link>
          <Link
            className="min-h-11 flex-1 rounded-xl bg-teal-700 px-4 py-3 text-center text-sm font-semibold text-white"
            href="/mock-exam"
          >
            返回模考
          </Link>
        </div>
      </div>
    );
  }

  const answeredCount = session.items.filter(
    (candidate) => candidate.selectedKeys.length > 0,
  ).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-32">
      <header className="sticky top-3 z-20 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <Link
          className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-slate-600"
          href="/mock-exam"
        >
          <ChevronLeft className="size-4" />
          暂离
        </Link>
        <div className="text-center">
          <p className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-slate-950">
            <Clock3 className="size-4 text-rose-600" />
            {formatRemaining(remaining)}
          </p>
          <p className="text-[11px] text-slate-500">
            {syncState === "saving"
              ? "正在保存"
              : syncState === "offline"
                ? "本地暂存，等待联网"
                : "已自动保存"}
          </p>
        </div>
        <button
          className="min-h-10 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white"
          disabled={isSubmitting}
          onClick={() => {
            if (window.confirm("确定提前交卷吗？交卷后不能修改答案。")) {
              void submitSession();
            }
          }}
          type="button"
        >
          交卷
        </button>
      </header>

      {syncState === "offline" ? (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <WifiOff className="size-4 shrink-0" />
          当前答案已保存在本机，网络恢复后会自动同步。
        </p>
      ) : null}

      <article className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-teal-700">
              第 {currentIndex + 1} / {session.items.length} 题 ·{" "}
              {item.type === "multiple_choice"
                ? "多选题"
                : item.type === "true_false"
                  ? "判断题"
                  : "单选题"}
            </p>
            <h1 className="mt-3 text-lg font-semibold leading-8 text-slate-950 sm:text-xl">
              {item.stem}
            </h1>
          </div>
          <button
            aria-label={item.isMarked ? "取消标记" : "标记本题"}
            aria-pressed={item.isMarked}
            className={`grid size-11 shrink-0 place-items-center rounded-xl border ${
              item.isMarked
                ? "border-rose-200 bg-rose-50 text-rose-600"
                : "border-slate-200 text-slate-500"
            }`}
            onClick={() => void toggleMarked()}
            type="button"
          >
            <Flag
              className="size-5"
              fill={item.isMarked ? "currentColor" : "none"}
            />
          </button>
        </div>

        <fieldset className="mt-6 space-y-3">
          <legend className="sr-only">请选择答案</legend>
          {item.options.map((option) => {
            const selected = item.selectedKeys.includes(option.key);
            return (
              <button
                aria-pressed={selected}
                className={`flex min-h-14 w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                  selected
                    ? "border-teal-600 bg-teal-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                key={option.key}
                onClick={() => selectOption(option.key)}
                type="button"
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                    selected
                      ? "bg-teal-700 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {option.key}
                </span>
                <span className="pt-0.5 text-sm leading-6 text-slate-800">
                  {option.content}
                </span>
              </button>
            );
          })}
        </fieldset>
      </article>

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-950">答题卡</h2>
          <p className="text-xs text-slate-500">
            已答 {answeredCount}/{session.items.length}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
          {session.items.map((candidate) => (
            <button
              aria-label={`第${candidate.position + 1}题${
                candidate.isMarked ? "，已标记" : ""
              }`}
              className={`relative aspect-square rounded-xl border text-sm font-semibold ${
                candidate.position === currentIndex
                  ? "border-slate-950 bg-slate-950 text-white"
                  : candidate.selectedKeys.length
                    ? "border-teal-200 bg-teal-50 text-teal-800"
                    : "border-slate-200 text-slate-600"
              }`}
              key={candidate.position}
              onClick={() => setCurrentIndex(candidate.position)}
              type="button"
            >
              {candidate.position + 1}
              {candidate.isMarked ? (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-rose-500" />
              ) : null}
            </button>
          ))}
        </div>
      </section>

      {message ? (
        <p
          aria-live="polite"
          className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {message}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-[4.8rem] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-4xl gap-3">
          <button
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 disabled:opacity-40"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((value) => value - 1)}
            type="button"
          >
            <ChevronLeft className="size-4" />
            上一题
          </button>
          {currentIndex < session.items.length - 1 ? (
            <button
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-teal-700 text-sm font-semibold text-white"
              onClick={() => setCurrentIndex((value) => value + 1)}
              type="button"
            >
              下一题
              <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white"
              onClick={() => {
                if (window.confirm("确定交卷吗？交卷后不能修改答案。")) {
                  void submitSession();
                }
              }}
              type="button"
            >
              <Send className="size-4" />
              交卷
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
