"use client";

import { useState, type FormEvent } from "react";
import { Heart, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import type {
  KnowledgeStateInput,
  LearningStatus,
} from "@/server/repositories/learning-content-store";

const learningOptions: Array<{
  value: LearningStatus;
  label: string;
}> = [
  { value: "not_started", label: "未开始" },
  { value: "learning", label: "学习中" },
  { value: "weak", label: "薄弱" },
  { value: "mastered", label: "已掌握" },
];

export function KnowledgeStateForm({
  externalId,
  initialState,
}: {
  externalId: string;
  initialState: KnowledgeStateInput;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/knowledge/${encodeURIComponent(externalId)}/state`,
        {
          body: JSON.stringify(state),
          headers: { "content-type": "application/json" },
          method: "PUT",
        },
      );

      if (!response.ok) {
        const body: unknown = await response.json();
        const error =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : "保存失败，请稍后重试";
        throw new Error(error);
      }

      setMessage("学习记录已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"
      onSubmit={handleSubmit}
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-950">我的学习记录</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          记录只属于当前所有者，之后接入正式账号时仍可按用户隔离。
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-800">掌握状态</span>
        <select
          className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
          onChange={(event) =>
            setState((current) => ({
              ...current,
              status: event.target.value as LearningStatus,
            }))
          }
          value={state.status}
        >
          {learningOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-800">个人笔记</span>
        <textarea
          className="mt-2 min-h-36 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-950 placeholder:text-slate-400"
          maxLength={20_000}
          onChange={(event) =>
            setState((current) => ({
              ...current,
              personalNote: event.target.value,
            }))
          }
          placeholder="写下自己的理解、易错点或记忆方法"
          value={state.personalNote}
        />
      </label>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-4 text-sm font-medium text-slate-800">
        <input
          checked={state.isFavorite}
          className="size-4 accent-teal-700"
          onChange={(event) =>
            setState((current) => ({
              ...current,
              isFavorite: event.target.checked,
            }))
          }
          type="checkbox"
        />
        <Heart aria-hidden="true" className="size-4 text-rose-500" />
        收藏这个知识点
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          <Save aria-hidden="true" className="size-4" />
          {isSaving ? "正在保存…" : "保存学习记录"}
        </button>
        {message ? (
          <p aria-live="polite" className="text-sm text-slate-700">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
