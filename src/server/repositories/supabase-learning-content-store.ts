import { z } from "zod";

import {
  previewKnowledgeImport,
  type ExistingKnowledgeVersion,
} from "@/features/knowledge/knowledge-import-preview";
import {
  knowledgeImportItemSchema,
  type KnowledgeImportItem,
  type KnowledgeImportPayload,
} from "@/features/knowledge/knowledge-import-schema";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

import { buildStudyCatalog } from "./build-study-catalog";
import type {
  ImportReport,
  KnowledgePointDetail,
  KnowledgeStateInput,
  LearningContentStore,
} from "./learning-content-store";

const syllabusNodeRowSchema = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  title: z.string(),
});

const knowledgePointRowSchema = z.object({
  id: z.string().uuid(),
  syllabus_node_id: z.string().uuid(),
  external_id: z.string(),
  title: z.string(),
  summary: z.string(),
  content_md: z.string(),
  exam_focus_md: z.string(),
  confusion_md: z.string(),
  work_example_md: z.string(),
  formula_md: z.string(),
  importance: z.enum(["S", "A", "B"]),
  difficulty: z.number().int(),
  source_type: z.enum([
    "self_authored",
    "official_public",
    "authorized",
    "user_note",
    "ai_draft",
  ]),
  source_note: z.string(),
  copyright_status: z.enum([
    "self_authored",
    "official_public",
    "authorized",
    "user_note",
    "ai_draft",
    "unknown",
  ]),
  review_status: z.enum([
    "draft",
    "reviewed",
    "published",
    "archived",
  ]),
  version: z.number().int().positive(),
});

const stateRowSchema = z.object({
  knowledge_point_id: z.string().uuid(),
  status: z.enum(["not_started", "learning", "mastered", "weak"]),
  personal_note_md: z.string(),
  is_favorite: z.boolean(),
});

const knowledgeReferenceRowSchema = z.object({
  external_id: z.string(),
  syllabus_node_id: z.string().uuid(),
});

const importRpcSchema = z.object({
  job_id: z.string().uuid(),
  file_name: z.string(),
  status: z.enum(["completed", "failed"]),
  inserted: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  errors: z
    .array(
      z.object({
        externalId: z.string(),
        message: z.string(),
      }),
    )
    .default([]),
});

type SyllabusNodeRow = z.infer<typeof syllabusNodeRowSchema>;
type KnowledgePointRow = z.infer<typeof knowledgePointRowSchema>;
const EXAM_CODE = "system-integration-project-management-engineer";

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function buildSyllabusPath(
  syllabusNodeId: string,
  nodes: readonly SyllabusNodeRow[],
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path: string[] = [];
  const visited = new Set<string>();
  let currentId: string | null = syllabusNodeId;

  while (currentId) {
    if (visited.has(currentId)) {
      throw new Error("大纲目录存在循环引用");
    }
    visited.add(currentId);

    const node = byId.get(currentId);
    if (!node) {
      throw new Error("知识点引用的大纲目录不存在");
    }
    path.unshift(node.title);
    currentId = node.parent_id;
  }

  return path;
}

function toImportItem(
  row: KnowledgePointRow,
  nodes: readonly SyllabusNodeRow[],
): KnowledgeImportItem {
  return knowledgeImportItemSchema.parse({
    external_id: row.external_id,
    syllabus_path: buildSyllabusPath(row.syllabus_node_id, nodes),
    title: row.title,
    summary: row.summary,
    content_md: row.content_md,
    exam_focus_md: row.exam_focus_md,
    confusion_md: row.confusion_md,
    work_example_md: row.work_example_md,
    formula_md: row.formula_md,
    importance: row.importance,
    difficulty: row.difficulty,
    source: {
      type: row.source_type,
      note: row.source_note,
      copyright_status: row.copyright_status,
    },
    review_status: row.review_status,
    version: row.version,
  });
}

export class SupabaseLearningContentStore
  implements LearningContentStore
{
  private readonly client = createSupabaseAdminClient();

  private async getExamId() {
    const { data, error } = await this.client
      .from("exams")
      .select("id")
      .eq("code", EXAM_CODE)
      .single();

    throwIfError(error);
    return z.object({ id: z.string().uuid() }).parse(data).id;
  }

  async getKnowledgeReferences() {
    const examId = await this.getExamId();
    const [nodesResult, pointsResult] = await Promise.all([
      this.client
        .from("syllabus_nodes")
        .select("id,parent_id,title")
        .eq("exam_id", examId)
        .neq("status", "archived"),
      this.client
        .from("knowledge_points")
        .select("external_id,syllabus_node_id")
        .eq("exam_id", examId)
        .neq("review_status", "archived"),
    ]);

    throwIfError(nodesResult.error);
    throwIfError(pointsResult.error);

    const nodes = z.array(syllabusNodeRowSchema).parse(nodesResult.data);
    return z
      .array(knowledgeReferenceRowSchema)
      .parse(pointsResult.data)
      .map((point) => ({
        externalId: point.external_id,
        syllabusPath: buildSyllabusPath(point.syllabus_node_id, nodes),
      }));
  }

  async getCatalog(userId: string, query = "") {
    const examId = await this.getExamId();
    const [nodesResult, pointsResult, statesResult] = await Promise.all([
      this.client
        .from("syllabus_nodes")
        .select("id,parent_id,title")
        .eq("exam_id", examId)
        .eq("status", "published"),
      this.client
        .from("knowledge_points")
        .select(
          "id,syllabus_node_id,external_id,title,summary,content_md,exam_focus_md,confusion_md,work_example_md,formula_md,importance,difficulty,source_type,source_note,copyright_status,review_status,version",
        )
        .eq("exam_id", examId)
        .eq("review_status", "published"),
      this.client
        .from("user_knowledge_state")
        .select(
          "knowledge_point_id,status,personal_note_md,is_favorite",
        )
        .eq("user_id", userId),
    ]);

    throwIfError(nodesResult.error);
    throwIfError(pointsResult.error);
    throwIfError(statesResult.error);

    const nodes = z.array(syllabusNodeRowSchema).parse(nodesResult.data);
    const pointRows = z
      .array(knowledgePointRowSchema)
      .parse(pointsResult.data);
    const stateRows = z.array(stateRowSchema).parse(statesResult.data);
    const stateByPointId = new Map(
      stateRows.map((state) => [state.knowledge_point_id, state]),
    );
    const states = new Map<string, KnowledgeStateInput>();

    for (const point of pointRows) {
      const state = stateByPointId.get(point.id);
      if (state) {
        states.set(point.external_id, {
          isFavorite: state.is_favorite,
          personalNote: state.personal_note_md,
          status: state.status,
        });
      }
    }

    return buildStudyCatalog(
      pointRows.map((point) => toImportItem(point, nodes)),
      states,
      query,
    );
  }

  async getKnowledgePoint(userId: string, externalId: string) {
    const examId = await this.getExamId();
    const pointResult = await this.client
      .from("knowledge_points")
      .select(
        "id,syllabus_node_id,external_id,title,summary,content_md,exam_focus_md,confusion_md,work_example_md,formula_md,importance,difficulty,source_type,source_note,copyright_status,review_status,version",
      )
      .eq("exam_id", examId)
      .eq("external_id", externalId)
      .eq("review_status", "published")
      .maybeSingle();

    throwIfError(pointResult.error);
    if (!pointResult.data) {
      return null;
    }

    const point = knowledgePointRowSchema.parse(pointResult.data);
    const [nodesResult, stateResult] = await Promise.all([
      this.client
        .from("syllabus_nodes")
        .select("id,parent_id,title")
        .eq("exam_id", examId)
        .eq("status", "published"),
      this.client
        .from("user_knowledge_state")
        .select(
          "knowledge_point_id,status,personal_note_md,is_favorite",
        )
        .eq("user_id", userId)
        .eq("knowledge_point_id", point.id)
        .maybeSingle(),
    ]);

    throwIfError(nodesResult.error);
    throwIfError(stateResult.error);

    const nodes = z.array(syllabusNodeRowSchema).parse(nodesResult.data);
    const item = toImportItem(point, nodes);
    const state = stateResult.data
      ? stateRowSchema.parse(stateResult.data)
      : null;

    return {
      confusion: item.confusion_md,
      content: item.content_md,
      copyrightStatus: item.source.copyright_status,
      difficulty: item.difficulty,
      examFocus: item.exam_focus_md,
      externalId: item.external_id,
      formula: item.formula_md,
      importance: item.importance,
      isFavorite: state?.is_favorite ?? false,
      learningStatus: state?.status ?? "not_started",
      personalNote: state?.personal_note_md ?? "",
      reviewStatus: item.review_status,
      sourceNote: item.source.note,
      sourceType: item.source.type,
      summary: item.summary,
      syllabusPath: item.syllabus_path,
      title: item.title,
      version: item.version,
      workExample: item.work_example_md,
    } satisfies KnowledgePointDetail;
  }

  async saveKnowledgeState(
    userId: string,
    externalId: string,
    input: KnowledgeStateInput,
  ) {
    const examId = await this.getExamId();
    const pointResult = await this.client
      .from("knowledge_points")
      .select("id")
      .eq("exam_id", examId)
      .eq("external_id", externalId)
      .eq("review_status", "published")
      .maybeSingle();

    throwIfError(pointResult.error);
    if (!pointResult.data) {
      throw new Error("知识点不存在或尚未发布");
    }

    const pointId = z
      .object({ id: z.string().uuid() })
      .parse(pointResult.data).id;
    const { error } = await this.client
      .from("user_knowledge_state")
      .upsert(
        {
          is_favorite: input.isFavorite,
          knowledge_point_id: pointId,
          personal_note_md: input.personalNote,
          status: input.status,
          user_id: userId,
        },
        { onConflict: "user_id,knowledge_point_id" },
      );

    throwIfError(error);
  }

  async previewKnowledge(payload: KnowledgeImportPayload) {
    const examId = await this.getExamId();
    const { data, error } = await this.client
      .from("knowledge_points")
      .select("external_id,version")
      .eq("exam_id", examId)
      .in(
        "external_id",
        payload.items.map((item) => item.external_id),
      );

    throwIfError(error);
    const existing = z
      .array(
        z.object({
          external_id: z.string(),
          version: z.number().int().positive(),
        }),
      )
      .parse(data)
      .map(
        (item): ExistingKnowledgeVersion => ({
          externalId: item.external_id,
          version: item.version,
        }),
      );

    return previewKnowledgeImport(payload, existing);
  }

  async importKnowledge(
    userId: string,
    payload: KnowledgeImportPayload,
    fileName: string,
  ): Promise<ImportReport> {
    const { data, error } = await this.client.rpc(
      "import_knowledge_points",
      {
        p_file_name: fileName,
        p_payload: payload,
        p_user_id: userId,
      },
    );

    throwIfError(error);
    const report = importRpcSchema.parse(data);

    return {
      counts: {
        failed: report.failed,
        inserted: report.inserted,
        skipped: report.skipped,
        updated: report.updated,
      },
      errors: report.errors,
      fileName: report.file_name,
      jobId: report.job_id,
      status: report.status,
    };
  }
}
