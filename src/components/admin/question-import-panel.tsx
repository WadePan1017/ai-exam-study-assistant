"use client";

import { CheckCircle2, FileJson, Upload, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MAX_QUESTION_IMPORT_FILE_BYTES } from "@/features/practice/question-import-request";
import type { QuestionImportPreview } from "@/features/practice/question-import-preview";
import type { QuestionImportValidationError } from "@/features/practice/question-import-schema";
import type { ImportReport } from "@/server/repositories/learning-content-store";

type SelectedImport = {
  fileName: string;
  text: string;
};

const actionLabels = {
  insert: "新增",
  reject: "拒绝",
  skip: "跳过",
  update: "新版本",
} as const;

function property<T>(value: unknown, key: string): T | undefined {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key] as T;
}

export function QuestionImportPanel() {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedImport | null>(null);
  const [preview, setPreview] = useState<QuestionImportPreview | null>(
    null,
  );
  const [validationErrors, setValidationErrors] = useState<
    QuestionImportValidationError[]
  >([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [message, setMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  async function selectFile(file: File | undefined) {
    setPreview(null);
    setReport(null);
    setValidationErrors([]);
    setMessage("");

    if (!file) {
      setSelected(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".json")) {
      setSelected(null);
      setMessage("请选择 .json 文件");
      return;
    }
    if (file.size > MAX_QUESTION_IMPORT_FILE_BYTES) {
      setSelected(null);
      setMessage("文件不能超过2MB");
      return;
    }
    setSelected({ fileName: file.name, text: await file.text() });
  }

  async function requestPreview() {
    if (!selected) {
      setMessage("请先选择题目JSON文件");
      return;
    }

    setIsWorking(true);
    setMessage("");
    setValidationErrors([]);
    setReport(null);
    try {
      const response = await fetch(
        "/api/admin/question-import/preview",
        {
          body: JSON.stringify(selected),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setValidationErrors(
          property<QuestionImportValidationError[]>(body, "errors") ??
            [],
        );
        throw new Error(
          property<string>(body, "error") ??
            "题目JSON校验失败，请检查错误",
        );
      }

      const nextPreview = property<QuestionImportPreview>(
        body,
        "preview",
      );
      if (!nextPreview) {
        throw new Error("服务器未返回题目预览");
      }
      setPreview(nextPreview);
      setMessage(
        nextPreview.counts.reject > 0
          ? "题目预览完成，但存在拒绝项，不能导入"
          : "题目校验通过，请确认预览后再导入",
      );
    } catch (error) {
      setPreview(null);
      setMessage(
        error instanceof Error ? error.message : "题目JSON校验失败",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function commitImport() {
    if (!selected || !preview || preview.counts.reject > 0) {
      return;
    }

    setIsWorking(true);
    setMessage("");
    try {
      const response = await fetch(
        "/api/admin/question-import/commit",
        {
          body: JSON.stringify(selected),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      const body: unknown = await response.json().catch(() => null);
      const nextReport = property<ImportReport>(body, "report");
      if (!nextReport) {
        throw new Error(
          property<string>(body, "error") ?? "题目导入失败",
        );
      }

      setReport(nextReport);
      setMessage(
        nextReport.status === "completed"
          ? "题目导入事务已完成"
          : "题目导入事务已回滚，请查看报告",
      );
      if (nextReport.status === "completed") {
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "题目导入失败",
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          导入题目 JSON
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          题目会校验知识点关联、来源、版权、审核状态和版本。更新会新增版本，不覆盖历史题目。
        </p>
      </div>

      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-teal-400 hover:bg-teal-50/40">
        <FileJson aria-hidden="true" className="size-7 text-teal-700" />
        <span className="mt-2 text-sm font-semibold text-slate-900">
          选择题目 JSON
        </span>
        <span className="mt-1 text-xs text-slate-500">
          {selected?.fileName ?? "尚未选择文件"}
        </span>
        <input
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => void selectFile(event.target.files?.[0])}
          type="file"
        />
      </label>

      <button
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
        disabled={!selected || isWorking}
        onClick={() => void requestPreview()}
        type="button"
      >
        <Upload aria-hidden="true" className="size-4" />
        {isWorking ? "正在处理…" : "校验并预览题目"}
      </button>

      {message ? (
        <p
          aria-live="polite"
          className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700"
        >
          {message}
        </p>
      ) : null}

      {validationErrors.length > 0 ? (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <h3 className="font-semibold text-red-950">题目文件校验错误</h3>
          <ul className="mt-2 space-y-2 text-sm text-red-900">
            {validationErrors.map((error, index) => (
              <li key={`${error.path}-${index}`}>
                <code>{error.path}</code>：{error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              ["insert", "update", "skip", "reject"] as const
            ).map((action) => (
              <div
                className="rounded-2xl bg-slate-50 p-4 text-center"
                key={action}
              >
                <p className="text-2xl font-bold text-slate-950">
                  {preview.counts[action]}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {actionLabels[action]}
                </p>
              </div>
            ))}
          </div>

          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200">
            {preview.items.map((item) => (
              <li
                className="flex items-start justify-between gap-3 p-4 text-sm"
                key={item.externalId}
              >
                <span>
                  <span className="font-medium text-slate-950">
                    {item.externalId}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    v{item.version} · {item.message}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                    item.action === "reject"
                      ? "bg-red-50 text-red-700"
                      : "bg-teal-50 text-teal-700"
                  }`}
                >
                  {actionLabels[item.action]}
                </span>
              </li>
            ))}
          </ul>

          <button
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            disabled={isWorking || preview.counts.reject > 0}
            onClick={() => void commitImport()}
            type="button"
          >
            <CheckCircle2 aria-hidden="true" className="size-4" />
            确认导入题目
          </button>
        </div>
      ) : null}

      {report ? (
        <div
          className={`rounded-2xl border p-5 ${
            report.status === "completed"
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <div className="flex items-center gap-2">
            {report.status === "completed" ? (
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
            <h3 className="font-semibold text-slate-950">题目导入报告</h3>
          </div>
          <p className="mt-2 text-sm text-slate-700">
            新增 {report.counts.inserted}，新版本 {report.counts.updated}
            ，跳过 {report.counts.skipped}，失败 {report.counts.failed}
          </p>
          <p className="mt-1 break-all text-xs text-slate-500">
            文件：{report.fileName} · 任务：{report.jobId}
          </p>
        </div>
      ) : null}
    </section>
  );
}
