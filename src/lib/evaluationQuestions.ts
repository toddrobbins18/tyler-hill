export interface EvaluationQuestionLike {
  id: string;
  question_text: string;
  evaluated_by?: string | null;
  category?: string | null;
  staff_type?: string | null;
  display_order?: number | null;
  created_at?: string | null;
}

export function evaluationQuestionKey(question: Pick<EvaluationQuestionLike, "question_text" | "evaluated_by" | "category">): string {
  return [
    question.question_text.trim().toLowerCase(),
    (question.evaluated_by ?? "").trim().toLowerCase(),
    (question.category ?? "").trim().toLowerCase(),
  ].join("|");
}

/** Staff types to load for a given staff member type (includes shared "both" questions). */
export function staffTypesForEvaluation(staffType: string | null): string[] {
  if (!staffType) return [];
  if (staffType === "both") return ["general_counselor", "specialist", "both"];
  return [staffType, "both"];
}

/** Keep one row per question text + evaluator + category (lowest display_order, then oldest). */
export function dedupeEvaluationQuestions<T extends EvaluationQuestionLike>(questions: T[]): T[] {
  const seen = new Map<string, T>();

  for (const question of questions) {
    const key = evaluationQuestionKey(question);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, question);
      continue;
    }

    const existingOrder = existing.display_order ?? Number.MAX_SAFE_INTEGER;
    const questionOrder = question.display_order ?? Number.MAX_SAFE_INTEGER;
    const existingCreated = existing.created_at ?? "";
    const questionCreated = question.created_at ?? "";

    if (
      questionOrder < existingOrder ||
      (questionOrder === existingOrder && questionCreated < existingCreated)
    ) {
      seen.set(key, question);
    }
  }

  return Array.from(seen.values()).sort((a, b) => {
    const staffCompare = (a.staff_type ?? "").localeCompare(b.staff_type ?? "");
    if (staffCompare !== 0) return staffCompare;
    const categoryCompare = (a.category ?? "").localeCompare(b.category ?? "");
    if (categoryCompare !== 0) return categoryCompare;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });
}
