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
  const choicesLen = Array.isArray(obj.choices) ? obj.choices.length : -1;
  if (choicesLen < 3 || choicesLen > 5) {
    errors.push(`${label}: choices 必须是 3–5 项的数组（当前 ${choicesLen}）`);
  } else {
    (obj.choices as unknown[]).forEach((c, i) => {
      const choice = c as Record<string, unknown> | null;
      if (typeof choice?.zh !== "string" || choice.zh.trim() === "") {
        errors.push(`${label}: choices[${i}].zh 为空`);
      }
      if (typeof choice?.en !== "string" || choice.en.trim() === "") {
        errors.push(`${label}: choices[${i}].en 为空`);
      }
      if (choice?.img !== undefined && (typeof choice.img !== "string" || choice.img.trim() === "")) {
        errors.push(`${label}: choices[${i}].img 必须是非空字符串（或省略）`);
      }
    });
  }
  const maxIndex = Math.max(choicesLen - 1, 0);
  if (
    typeof obj.correct_index !== "number" ||
    !Number.isInteger(obj.correct_index) ||
    obj.correct_index < 0 ||
    obj.correct_index > maxIndex
  ) {
    errors.push(`${label}: correct_index 必须是 0..${maxIndex} 的整数（当前 ${JSON.stringify(obj.correct_index)}）`);
  }
  if (
    obj.illustration !== null &&
    obj.illustration !== undefined &&
    typeof obj.illustration !== "string"
  ) {
    errors.push(`${label}: illustration 必须是字符串或 null`);
  }
  if (obj.attribution !== undefined && obj.attribution !== null) {
    if (typeof obj.attribution !== "string" || (obj.attribution as string).trim() === "") {
      errors.push(`${label}: attribution 必须是非空字符串（或省略）`);
    }
  }
  return errors;
}

export function validateBank(raw: unknown[]): RawQuestion[] {
  const errors = raw.flatMap((q, i) => validateQuestion(q, `question[${i}]`));
  if (errors.length > 0) {
    throw new Error(`题库校验失败：\n${errors.join("\n")}`);
  }
  return raw.map((q) => {
    const obj = q as Omit<RawQuestion, "illustration" | "attribution"> & {
      illustration?: string | null;
      attribution?: string | null;
    };
    return { ...obj, illustration: obj.illustration ?? null, attribution: obj.attribution ?? null };
  });
}
