import { notFound } from "next/navigation";
import { z } from "zod";

import { MockExamSession } from "@/components/mock-exam/mock-exam-session";
import { getOwnerMockExamSession } from "@/server/services/mock-exam-service";

export const dynamic = "force-dynamic";

export default async function MockExamSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  if (!z.uuid().safeParse(sessionId).success) {
    notFound();
  }
  const session = await getOwnerMockExamSession(sessionId);
  if (!session) {
    notFound();
  }
  return <MockExamSession initialSession={session} />;
}
