import { notFound } from "next/navigation";
import { z } from "zod";

import { PracticeSession } from "@/components/practice/practice-session";
import { getOwnerPracticeSession } from "@/server/services/practice-service";

export default async function PracticeSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  if (!z.uuid().safeParse(sessionId).success) {
    notFound();
  }
  const session = await getOwnerPracticeSession(sessionId);
  if (!session) {
    notFound();
  }

  return <PracticeSession initialSession={session} />;
}
