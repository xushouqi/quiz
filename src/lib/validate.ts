import { DIFFICULTIES, TOPICS, type RawQuestion } from "./types";

const TEXT_FIELDS = ["text_zh", "text_en", "explanation_zh", "explanation_en"] as const;

export function validateQuestion(q: unknown, label: string): string[] {
  if (typeof q !== "object" || q === null) return [`${label}: 必须是对象`];
  const obj = q as Record<string, unknown>;
  const errors: string[] = [];

  if (!DIFFICULTIES.includes(obj.difficulty as 3 | 4 | 5)) {
    errors.push(`${label}: difficulty 必须是 3、4 或 5（当前 ${JSON.stringify(obj.difficulty)}）`);
  }
  if (!TOPICS.includes(obj.topic as (typeof TOPICS)[number])) {
    errors.push(`${label}: topic "${String(obj.topic)}" 不在 ${TOPICS.join("|")} 中`);
  }
  for (const f of TEXT_FIELDS) {
    if (typeof obj[f] !== "string" || (obj[f] as string).trim() === "") {
      errors.push(`${label}: ${f} 必须是非空字符串`);
    }
  }
  if (!Array.isArray(obj.choices) || obj.choices.length !== 3) {
    errors.push(`${label}: choices 必须是恰好 3 项的数组`);
  } else {
    (obj.choices as unknown[]).forEach((c, i) => {
      const choice = c as Record<string, unknown> | null;
      if (typeof choice?.zh !== "string" || choice.zh.trim() === "") {
        errors.push(`${label}: choices[${i}].zh 为空`);
      }
      if (typeof choice?.en !== "string" || choice.en.trim() === "") {
        errors.push(`${label}: choices[${i}].en 为空`);
      }
    });
  }
  if (
    typeof obj.correct_index !== "number" ||
    !Number.isInteger(obj.correct_index) ||
    obj.correct_index < 0 ||
    obj.correct_index > 2
  ) {
    errors.push(`${label}: correct_index 必须是 0、1 或 2（当前 ${JSON.stringify(obj.correct_index)}）`);
  }
  if (
    obj.illustration !== null &&
    obj.illustration !== undefined &&
    typeof obj.illustration !== "string"
  ) {
    errors.push(`${label}: illustration 必须是字符串或 null`);
  }
  return errors;
}

export function validateBank(raw: unknown[]): RawQuestion[] {
  const errors = raw.flatMap((q, i) => validateQuestion(q, `question[${i}]`));
  if (errors.length > 0) {
    throw new Error(`题库校验失败：\n${errors.join("\n")}`);
  }
  return raw.map((q) => {
    const obj = q as Omit<RawQuestion, "illustration"> & { illustration?: string | null };
    return { ...obj, illustration: obj.illustration ?? null };
  });
}
