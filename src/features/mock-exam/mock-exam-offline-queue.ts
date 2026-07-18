import { z } from "zod";

const STORAGE_KEY = "mock-exam-answer-drafts:v1";

const draftSchema = z.object({
  sessionId: z.string().min(1),
  position: z.number().int().nonnegative(),
  selectedKeys: z.array(z.string().regex(/^[A-Z]$/)).max(10),
  updatedAt: z.string(),
});

export type MockExamAnswerDraft = z.infer<typeof draftSchema>;

function read(storage: Storage) {
  const value = storage.getItem(STORAGE_KEY);
  if (!value) {
    return [];
  }
  try {
    const parsed = z.array(draftSchema).safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function write(storage: Storage, drafts: MockExamAnswerDraft[]) {
  if (drafts.length === 0) {
    storage.removeItem(STORAGE_KEY);
    return;
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function saveMockExamDraft(
  storage: Storage,
  draft: MockExamAnswerDraft,
) {
  const drafts = read(storage).filter(
    (item) =>
      item.sessionId !== draft.sessionId ||
      item.position !== draft.position,
  );
  drafts.push(draftSchema.parse(draft));
  write(storage, drafts);
}

export function listMockExamDrafts(
  storage: Storage,
  sessionId: string,
) {
  return read(storage)
    .filter((draft) => draft.sessionId === sessionId)
    .sort((left, right) => left.position - right.position);
}

export function clearSyncedMockExamDraft(
  storage: Storage,
  sessionId: string,
  position: number,
  selectedKeys: string[],
) {
  const expected = JSON.stringify(selectedKeys);
  write(
    storage,
    read(storage).filter(
      (draft) =>
        draft.sessionId !== sessionId ||
        draft.position !== position ||
        JSON.stringify(draft.selectedKeys) !== expected,
    ),
  );
}
