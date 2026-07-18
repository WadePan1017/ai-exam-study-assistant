import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

import type {
  MockExamSessionView,
  MockExamStore,
} from "./mock-exam-store";

const questionTypeSchema = z.enum([
  "single_choice",
  "multiple_choice",
  "true_false",
]);
const optionSchema = z.object({
  key: z.string(),
  content: z.string(),
});
const itemSchema = z.object({
  position: z.number().int().nonnegative(),
  externalId: z.string(),
  version: z.number().int().positive(),
  type: questionTypeSchema,
  stem: z.string(),
  options: z.array(optionSchema),
  selectedKeys: z.array(z.string()),
  isMarked: z.boolean(),
  savedAt: z.string().nullable(),
  correctKeys: z.array(z.string()).optional(),
  explanation: z.string().optional(),
  isCorrect: z.boolean().optional(),
  score: z.coerce.number().optional(),
});
const breakdownBaseSchema = z.object({
  questionCount: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  score: z.coerce.number(),
  maxScore: z.coerce.number(),
});
const resultSchema = z.object({
  questionCount: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  byModule: z.array(
    breakdownBaseSchema.extend({ moduleTitle: z.string() }),
  ),
  byType: z.array(
    breakdownBaseSchema.extend({ type: questionTypeSchema }),
  ),
});
const sessionSchema = z.object({
  id: z.uuid(),
  templateId: z.uuid(),
  status: z.enum(["in_progress", "submitted"]),
  startedAt: z.string(),
  deadlineAt: z.string(),
  submittedAt: z.string().nullable(),
  score: z.coerce.number().nullable(),
  maxScore: z.coerce.number(),
  result: resultSchema.nullable(),
  items: z.array(itemSchema),
});
const setupSchema = z.object({
  templates: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      durationMinutes: z.number().int().positive(),
      questionCount: z.number().int().positive(),
      maxScore: z.coerce.number().positive(),
      mode: z.enum(["fixed", "random"]),
    }),
  ),
});

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export class SupabaseMockExamStore implements MockExamStore {
  private readonly client = createSupabaseAdminClient();

  async getSetup(userId: string) {
    const { data, error } = await this.client.rpc(
      "get_mock_exam_setup",
      { p_user_id: userId },
    );
    throwIfError(error);
    return setupSchema.parse(data);
  }

  async startSession(userId: string, templateId: string) {
    const { data, error } = await this.client.rpc(
      "start_mock_exam_session",
      {
        p_template_id: templateId,
        p_user_id: userId,
      },
    );
    throwIfError(error);
    return sessionSchema.parse(data) as MockExamSessionView;
  }

  async getSession(userId: string, sessionId: string) {
    const { data, error } = await this.client.rpc(
      "get_mock_exam_session",
      {
        p_session_id: sessionId,
        p_user_id: userId,
      },
    );
    throwIfError(error);
    if (data === null) {
      return null;
    }
    const session = sessionSchema.parse(data) as MockExamSessionView;
    if (
      session.status === "in_progress" &&
      Date.now() >= new Date(session.deadlineAt).getTime()
    ) {
      return this.submitSession(userId, sessionId);
    }
    return session;
  }

  async saveAnswer(
    userId: string,
    sessionId: string,
    position: number,
    selectedKeys: string[],
  ) {
    const { data, error } = await this.client.rpc(
      "save_mock_exam_answer",
      {
        p_position: position,
        p_selected_keys: selectedKeys,
        p_session_id: sessionId,
        p_user_id: userId,
      },
    );
    throwIfError(error);
    return sessionSchema.parse(data) as MockExamSessionView;
  }

  async setMarked(
    userId: string,
    sessionId: string,
    position: number,
    isMarked: boolean,
  ) {
    const { data, error } = await this.client.rpc(
      "set_mock_exam_marked",
      {
        p_is_marked: isMarked,
        p_position: position,
        p_session_id: sessionId,
        p_user_id: userId,
      },
    );
    throwIfError(error);
    return sessionSchema.parse(data) as MockExamSessionView;
  }

  async submitSession(userId: string, sessionId: string) {
    const { data, error } = await this.client.rpc(
      "submit_mock_exam_session",
      {
        p_session_id: sessionId,
        p_user_id: userId,
      },
    );
    throwIfError(error);
    return sessionSchema.parse(data) as MockExamSessionView;
  }
}
