import { z } from "zod";

import { previewQuestionImport } from "@/features/practice/question-import-preview";
import type {
  QuestionImportPayload,
} from "@/features/practice/question-import-schema";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

import type { ImportReport } from "./learning-content-store";
import type {
  KnowledgeReference,
  PracticeSessionView,
  PracticeStore,
  StartPracticeInput,
  SubmitPracticeAnswerInput,
} from "./practice-store";

const EXAM_CODE = "system-integration-project-management-engineer";

const idSchema = z.object({ id: z.string().uuid() });
const questionVersionRowSchema = z.object({
  id: z.string().uuid(),
  external_id: z.string(),
  version: z.number().int().positive(),
});
const questionRowSchema = questionVersionRowSchema.extend({
  exam_id: z.string().uuid(),
  question_type: z.enum([
    "single_choice",
    "multiple_choice",
    "true_false",
  ]),
  stem_md: z.string(),
  answer_json: z.object({ keys: z.array(z.string()) }),
  explanation_md: z.string(),
});
const optionRowSchema = z.object({
  option_key: z.string(),
  content_md: z.string(),
  sort_order: z.number().int().nonnegative(),
});
const sessionRowSchema = z.object({
  id: z.string().uuid(),
  mode: z.enum([
    "sequential",
    "chapter",
    "random",
    "unanswered",
  ]),
  status: z.enum([
    "created",
    "in_progress",
    "completed",
    "abandoned",
  ]),
  current_index: z.number().int().nonnegative(),
  started_at: z.string(),
});
const sessionItemRowSchema = z.object({
  question_id: z.string().uuid(),
  question_version: z.number().int().positive(),
  position: z.number().int().nonnegative(),
  answer_json: z.object({ keys: z.array(z.string()) }).nullable(),
  is_correct: z.boolean().nullable(),
  score: z.coerce.number().nullable(),
  confidence: z.enum(["certain", "uncertain"]).nullable(),
  answered_at: z.string().nullable(),
});
const attemptRowSchema = z.object({
  id: z.string().uuid(),
  question_id: z.string().uuid(),
  answer_json: z.object({ keys: z.array(z.string()) }),
  is_correct: z.boolean(),
  confidence: z.enum(["certain", "uncertain"]),
  created_at: z.string(),
});
const syllabusNodeRowSchema = z.object({
  id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  title: z.string(),
});
const knowledgeRowSchema = z.object({
  id: z.string().uuid(),
  syllabus_node_id: z.string().uuid(),
});
const questionKnowledgeRowSchema = z.object({
  question_id: z.string().uuid(),
  knowledge_point_id: z.string().uuid(),
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
const startSessionRpcSchema = z.object({
  session_id: z.string().uuid(),
});

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function currentVersions<
  T extends z.infer<typeof questionVersionRowSchema>,
>(rows: readonly T[]) {
  const currentByExternalId = new Map<string, T>();
  for (const row of rows) {
    const current = currentByExternalId.get(row.external_id);
    if (!current || row.version > current.version) {
      currentByExternalId.set(row.external_id, row);
    }
  }
  return Array.from(currentByExternalId.values());
}

function rootTitle(
  nodeId: string,
  nodes: readonly z.infer<typeof syllabusNodeRowSchema>[],
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  let current = byId.get(nodeId);

  while (current?.parent_id) {
    if (visited.has(current.id)) {
      throw new Error("大纲目录存在循环引用");
    }
    visited.add(current.id);
    current = byId.get(current.parent_id);
  }

  if (!current) {
    throw new Error("题目关联的大纲目录不存在");
  }
  return current.title;
}

export class SupabasePracticeStore implements PracticeStore {
  private readonly client = createSupabaseAdminClient();

  private async getExamId() {
    const { data, error } = await this.client
      .from("exams")
      .select("id")
      .eq("code", EXAM_CODE)
      .single();

    throwIfError(error);
    return idSchema.parse(data).id;
  }

  private async getPublishedCurrentQuestions() {
    const examId = await this.getExamId();
    const { data, error } = await this.client
      .from("questions")
      .select("id,external_id,version,review_status")
      .eq("exam_id", examId);

    throwIfError(error);
    const questionPoolRowSchema = questionVersionRowSchema.extend({
      review_status: z.enum([
        "draft",
        "pending_review",
        "reviewed",
        "published",
        "disputed",
        "archived",
      ]),
    });
    return {
      examId,
      questions: currentVersions(
        z.array(questionPoolRowSchema).parse(data),
      ).filter((question) => question.review_status === "published"),
    };
  }

  async getSetup(userId: string) {
    const { examId, questions } =
      await this.getPublishedCurrentQuestions();
    if (questions.length === 0) {
      return {
        modules: [],
        totalAvailable: 0,
        unansweredAvailable: 0,
      };
    }

    const questionIds = questions.map((question) => question.id);
    const [linksResult, nodesResult, attemptsResult] = await Promise.all([
      this.client
        .from("question_knowledge_points")
        .select("question_id,knowledge_point_id")
        .in("question_id", questionIds),
      this.client
        .from("syllabus_nodes")
        .select("id,parent_id,title")
        .eq("exam_id", examId)
        .neq("status", "archived"),
      this.client
        .from("question_attempts")
        .select("question_id")
        .eq("user_id", userId),
    ]);

    throwIfError(linksResult.error);
    throwIfError(nodesResult.error);
    throwIfError(attemptsResult.error);

    const links = z
      .array(questionKnowledgeRowSchema)
      .parse(linksResult.data);
    const nodes = z.array(syllabusNodeRowSchema).parse(nodesResult.data);
    const knowledgeIds = Array.from(
      new Set(links.map((link) => link.knowledge_point_id)),
    );
    const knowledgeById = new Map<
      string,
      z.infer<typeof knowledgeRowSchema>
    >();

    if (knowledgeIds.length > 0) {
      const { data, error } = await this.client
        .from("knowledge_points")
        .select("id,syllabus_node_id")
        .in("id", knowledgeIds);
      throwIfError(error);
      for (const row of z.array(knowledgeRowSchema).parse(data)) {
        knowledgeById.set(row.id, row);
      }
    }

    const moduleCounts = new Map<string, number>();
    for (const question of questions) {
      const moduleTitles = new Set(
        links
          .filter(
            (candidate) => candidate.question_id === question.id,
          )
          .map((link) => knowledgeById.get(link.knowledge_point_id))
          .filter(
            (
              knowledge,
            ): knowledge is z.infer<typeof knowledgeRowSchema> =>
              Boolean(knowledge),
          )
          .map((knowledge) =>
            rootTitle(knowledge.syllabus_node_id, nodes),
          ),
      );
      for (const moduleTitle of moduleTitles) {
        moduleCounts.set(
          moduleTitle,
          (moduleCounts.get(moduleTitle) ?? 0) + 1,
        );
      }
    }

    const attemptQuestionIds = z
      .array(z.object({ question_id: z.string().uuid() }))
      .parse(attemptsResult.data)
      .map((attempt) => attempt.question_id);
    const answeredExternalIds = new Set<string>();
    if (attemptQuestionIds.length > 0) {
      const { data, error } = await this.client
        .from("questions")
        .select("id,external_id,version")
        .in("id", Array.from(new Set(attemptQuestionIds)));
      throwIfError(error);
      for (const question of z
        .array(questionVersionRowSchema)
        .parse(data)) {
        answeredExternalIds.add(question.external_id);
      }
    }

    return {
      modules: Array.from(moduleCounts, ([title, count]) => ({
        count,
        title,
      })).sort((left, right) =>
        left.title.localeCompare(right.title, "zh-CN"),
      ),
      totalAvailable: questions.length,
      unansweredAvailable: questions.filter(
        (question) => !answeredExternalIds.has(question.external_id),
      ).length,
    };
  }

  async startSession(userId: string, input: StartPracticeInput) {
    const { data, error } = await this.client.rpc(
      "start_practice_session",
      {
        p_count: input.count,
        p_mode: input.mode,
        p_module_title: input.moduleTitle ?? null,
        p_user_id: userId,
      },
    );
    throwIfError(error);

    const sessionId = startSessionRpcSchema.parse(data).session_id;
    const session = await this.getSession(userId, sessionId);
    if (!session) {
      throw new Error("练习会话创建后无法读取");
    }
    return session;
  }

  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<PracticeSessionView | null> {
    const sessionResult = await this.client
      .from("practice_sessions")
      .select("id,mode,status,current_index,started_at")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    throwIfError(sessionResult.error);
    if (!sessionResult.data) {
      return null;
    }

    const session = sessionRowSchema.parse(sessionResult.data);
    const itemsResult = await this.client
      .from("practice_session_items")
      .select(
        "question_id,question_version,position,answer_json,is_correct,score,confidence,answered_at",
      )
      .eq("session_id", sessionId)
      .order("position");
    throwIfError(itemsResult.error);
    const items = z.array(sessionItemRowSchema).parse(itemsResult.data);
    const item = items.find(
      (candidate) => candidate.position === session.current_index,
    );
    if (!item) {
      throw new Error("练习会话的当前题目不存在");
    }

    const [questionResult, optionsResult] = await Promise.all([
      this.client
        .from("questions")
        .select(
          "id,exam_id,external_id,version,question_type,stem_md,answer_json,explanation_md",
        )
        .eq("id", item.question_id)
        .single(),
      this.client
        .from("question_options")
        .select("option_key,content_md,sort_order")
        .eq("question_id", item.question_id)
        .order("sort_order"),
    ]);
    throwIfError(questionResult.error);
    throwIfError(optionsResult.error);

    const question = questionRowSchema.parse(questionResult.data);
    const options = z.array(optionRowSchema).parse(optionsResult.data);
    const linksResult = await this.client
      .from("question_knowledge_points")
      .select("knowledge_point_id")
      .eq("question_id", question.id);
    throwIfError(linksResult.error);
    const linkedKnowledgeIds = z
      .array(z.object({ knowledge_point_id: z.string().uuid() }))
      .parse(linksResult.data)
      .map((link) => link.knowledge_point_id);
    let knowledgePointExternalIds: string[] = [];
    if (linkedKnowledgeIds.length > 0) {
      const knowledgeResult = await this.client
        .from("knowledge_points")
        .select("external_id")
        .in("id", linkedKnowledgeIds);
      throwIfError(knowledgeResult.error);
      knowledgePointExternalIds = z
        .array(z.object({ external_id: z.string() }))
        .parse(knowledgeResult.data)
        .map((knowledge) => knowledge.external_id);
    }
    const favoriteResult = await this.client
      .from("user_question_state")
      .select("is_favorite")
      .eq("user_id", userId)
      .eq("exam_id", question.exam_id)
      .eq("question_external_id", question.external_id)
      .maybeSingle();
    throwIfError(favoriteResult.error);
    const isFavorite = favoriteResult.data
      ? z
          .object({ is_favorite: z.boolean() })
          .parse(favoriteResult.data).is_favorite
      : false;

    const attemptHistory: PracticeSessionView["current"]["attemptHistory"] =
      [];
    if (item.answered_at) {
      const versionRowsResult = await this.client
        .from("questions")
        .select("id,external_id,version")
        .eq("exam_id", question.exam_id)
        .eq("external_id", question.external_id);
      throwIfError(versionRowsResult.error);
      const versionRows = z
        .array(questionVersionRowSchema)
        .parse(versionRowsResult.data);
      const versionById = new Map(
        versionRows.map((row) => [row.id, row.version]),
      );

      if (versionRows.length > 0) {
        const attemptsResult = await this.client
          .from("question_attempts")
          .select(
            "id,question_id,answer_json,is_correct,confidence,created_at",
          )
          .eq("user_id", userId)
          .in(
            "question_id",
            versionRows.map((row) => row.id),
          )
          .order("created_at");
        throwIfError(attemptsResult.error);
        for (const attempt of z
          .array(attemptRowSchema)
          .parse(attemptsResult.data)) {
          attemptHistory.push({
            confidence: attempt.confidence,
            createdAt: attempt.created_at,
            id: attempt.id,
            isCorrect: attempt.is_correct,
            questionVersion:
              versionById.get(attempt.question_id) ?? question.version,
            selectedKeys: attempt.answer_json.keys,
          });
        }
      }
    }

    return {
      answeredIndexes: items
        .filter((candidate) => candidate.answered_at)
        .map((candidate) => candidate.position),
      attemptCount: items.filter((candidate) => candidate.answered_at)
        .length,
      current: {
        attemptHistory,
        confidence: item.confidence,
        externalId: question.external_id,
        feedback: item.answered_at
          ? {
              correctKeys: question.answer_json.keys,
              explanation: question.explanation_md,
              isCorrect: item.is_correct ?? false,
              score: item.score ?? 0,
            }
          : null,
        isFavorite,
        knowledgePointExternalIds,
        options: options.map((option) => ({
          content: option.content_md,
          key: option.option_key,
        })),
        selectedKeys: item.answer_json?.keys ?? [],
        stem: question.stem_md,
        type: question.question_type,
        version: item.question_version,
      },
      currentIndex: session.current_index,
      id: session.id,
      mode: session.mode,
      startedAt: session.started_at,
      status:
        session.status === "completed" ? "completed" : "in_progress",
      total: items.length,
    };
  }

  async navigateSession(
    userId: string,
    sessionId: string,
    index: number,
  ) {
    const itemResult = await this.client
      .from("practice_session_items")
      .select("position")
      .eq("session_id", sessionId)
      .eq("position", index)
      .maybeSingle();
    throwIfError(itemResult.error);
    if (!itemResult.data) {
      throw new Error("题号超出当前练习范围");
    }

    const { data, error } = await this.client
      .from("practice_sessions")
      .update({ current_index: index })
      .eq("id", sessionId)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    throwIfError(error);
    if (!data) {
      throw new Error("练习会话不存在");
    }

    const session = await this.getSession(userId, sessionId);
    if (!session) {
      throw new Error("练习会话不存在");
    }
    return session;
  }

  async submitAnswer(
    userId: string,
    sessionId: string,
    input: SubmitPracticeAnswerInput,
  ) {
    const { error } = await this.client.rpc(
      "submit_practice_answer",
      {
        p_confidence: input.confidence,
        p_selected_keys: input.selectedKeys,
        p_session_id: sessionId,
        p_user_id: userId,
      },
    );
    throwIfError(error);

    const session = await this.getSession(userId, sessionId);
    if (!session) {
      throw new Error("练习会话不存在");
    }
    return session;
  }

  async setFavorite(
    userId: string,
    externalId: string,
    isFavorite: boolean,
  ) {
    const examId = await this.getExamId();
    const { data, error } = await this.client
      .from("questions")
      .select("id")
      .eq("exam_id", examId)
      .eq("external_id", externalId)
      .eq("review_status", "published")
      .limit(1);
    throwIfError(error);
    if (z.array(idSchema).parse(data).length === 0) {
      throw new Error("题目不存在");
    }

    const result = await this.client
      .from("user_question_state")
      .upsert(
        {
          exam_id: examId,
          is_favorite: isFavorite,
          question_external_id: externalId,
          user_id: userId,
        },
        {
          onConflict: "user_id,exam_id,question_external_id",
        },
      );
    throwIfError(result.error);
  }

  async previewQuestions(
    payload: QuestionImportPayload,
    knowledge: readonly KnowledgeReference[],
  ) {
    const examId = await this.getExamId();
    const { data, error } = await this.client
      .from("questions")
      .select("id,external_id,version")
      .eq("exam_id", examId)
      .in(
        "external_id",
        payload.items.map((item) => item.external_id),
      );
    throwIfError(error);

    return previewQuestionImport(
      payload,
      currentVersions(
        z.array(questionVersionRowSchema).parse(data),
      ).map((question) => ({
        externalId: question.external_id,
        version: question.version,
      })),
      knowledge.map((item) => item.externalId),
    );
  }

  async importQuestions(
    userId: string,
    payload: QuestionImportPayload,
    fileName: string,
    knowledge: readonly KnowledgeReference[],
  ): Promise<ImportReport> {
    void knowledge;
    const { data, error } = await this.client.rpc("import_questions", {
      p_file_name: fileName,
      p_payload: payload,
      p_user_id: userId,
    });
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
