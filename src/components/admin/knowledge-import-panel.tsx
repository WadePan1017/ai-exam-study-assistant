"use client";

import { useState } from "react";
import { CheckCircle2, FileJson, Upload, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  MAX_IMPORT_FILE_BYTES,
} from "@/features/knowledge/knowledge-import-request";
import type { KnowledgeImportPreview } from "@/features/knowledge/knowledge-import-preview";
import type { ImportValidationError } from "@/features/knowledge/knowledge-import-schema";
import type { ImportReport } from "@/server/repositories/learning-content-store";

type SelectedImport = {
  fileName: string;
  text: string;
};

const actionLabels = {
  insert: "新增",
  reject: "拒绝",
  skip: "跳过",
  update: "更新",
} as const;

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function objectProperty<T>(
  value: unknown,
  property: string,
): T | undefined {
  if (typeof value !== "object" || value === null || !(property in value)) {
    return undefined;
  }

  return (value as Record<string, unknown>)[property] as T;
}

export function KnowledgeImportPanel() {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedImport | null>(null);
  const [preview, setPreview] = useState<KnowledgeImportPreview | null>(
    null,
  );
  const [validationErrors, setValidationErrors] = useState<
    ImportValidationError[]
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

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setSelected(null);
      setMessage("文件不能超过2MB");
      return;
    }

    setSelected({ fileName: file.name, text: await file.text() });
  }

  async function requestPreview() {
    if (!selected) {
      setMessage("请先选择JSON文件");
      return;
    }

    setIsWorking(true);
    setMessage("");
    setValidationErrors([]);
    setReport(null);

    try {
      const response = await fetch(
        "/api/admin/knowledge-import/preview",
        {
          body: JSON.stringify(selected),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      const body = await readJsonResponse(response);

      if (!response.ok) {
        const errors =
          objectProperty<ImportValidationError[]>(body, "errors") ?? [];
        setValidationErrors(errors);
        throw new Error(
          objectProperty<string>(body, "error") ??
            "JSON校验失败，请检查下方错误",
        );
      }

      const nextPreview = objectProperty<KnowledgeImportPreview>(
        body,
        "preview",
      );
      if (!nextPreview) {
        throw new Error("服务器未返回预览结果");
      }

      setPreview(nextPreview);
      setMessage(
        nextPreview.counts.reject > 0
          ? "预览完成，但存在拒绝项，不能导入"
          : "校验通过，请确认预览后再导入",
      );
    } catch (error) {
      setPreview(null);
      setMessage(
        error instanceof Error ? error.message : "JSON校验失败",
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
        "/api/admin/knowledge-import/commit",
        {
          body: JSON.stringify(selected),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      const body = await readJsonResponse(response);
      const nextReport = objectProperty<ImportReport>(body, "report");

      if (nextReport) {
        setReport(nextReport);
        setMessage(
          nextReport.status === "completed"
            ? "导入事务已完成"
            : "导入事务已回滚，请查看报告",
        );
        if (nextReport.status === "completed") {
          router.refresh();
        }
        return;
      }

      if (!response.ok) {
        throw new Error(
          objectProperty<string>(body, "error") ?? "导入失败",
        );
      }

      throw new Error("服务器未返回导入报告");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          导入知识点 JSON
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          文件会先校验和预览，只有你明确确认后才会事务导入。单个文件最多
          2MB、500个知识点。
        </p>
      </div>

      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-teal-400 hover:bg-teal-50/40">
        <FileJson aria-hidden="true" className="size-7 text-teal-700" />
        <span className="mt-2 text-sm font-semibold text-slate-900">
          选择 JSON 文件
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
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        disabled={!selected || isWorking}
        onClick={() => void requestPreview()}
        type="button"
      >
        <Upload aria-hidden="true" className="size-4" />
        {isWorking ? "正在处理…" : "校验并预览"}
      </button>

      {message ? (
        <p
          aria-live="polite"
          className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700"
        >
          {message}
        </p>
      ) : null}

      {validationErrors.length ? (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <h3 className="font-semibold text-red-950">文件校验错误</h3>
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

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {preview.items.map((item) => (
                <li
                  className="flex items-start justify-between gap-3 p-4 text-sm"
                  key={item.externalId}
                >
                  <span>
                    <span className="font-medium text-slate-950">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {item.externalId} · v{item.version} · {item.message}
                    </span>
                  </span>
                  <span
                    className={
                      item.action === "reject"
                        ? "shrink-0 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
                        : "shrink-0 rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700"
                    }
                  >
                    {actionLabels[item.action]}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <button
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            disabled={isWorking || preview.counts.reject > 0}
            onClick={() => void commitImport()}
            type="button"
          >
            <CheckCircle2 aria-hidden="true" className="size-4" />
            确认事务导入
          </button>
        </div>
      ) : null}

      {report ? (
        <div
          className={
            report.status === "completed"
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
              : "rounded-2xl border border-red-200 bg-red-50 p-5"
          }
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
            <h3 className="font-semibold text-slate-950">导入报告</h3>
          </div>
          <p className="mt-2 text-sm text-slate-700">
            新增 {report.counts.inserted}，更新 {report.counts.updated}，跳过{" "}
            {report.counts.skipped}，失败 {report.counts.failed}
          </p>
          <p className="mt-1 break-all text-xs text-slate-500">
            文件：{report.fileName} · 任务：{report.jobId}
          </p>
        </div>
      ) : null}
    </section>
  );
}
