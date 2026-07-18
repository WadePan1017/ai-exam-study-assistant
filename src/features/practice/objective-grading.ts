import type { QuestionImportItem } from "./question-import-schema";

export function gradeObjectiveAnswer(
  _type: QuestionImportItem["type"],
  correctKeys: readonly string[],
  submittedKeys: readonly string[],
) {
  const normalizedCorrect = [...new Set(correctKeys)].sort();
  const normalizedSubmitted = [...new Set(submittedKeys)].sort();
  const isCorrect =
    normalizedCorrect.length === normalizedSubmitted.length &&
    normalizedCorrect.every(
      (key, index) => key === normalizedSubmitted[index],
    );

  return { isCorrect, score: isCorrect ? 1 : 0 };
}
