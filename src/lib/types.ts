export type Topic = "counting" | "shapes" | "patterns" | "logic" | "arithmetic" | "time" | "number_theory" | "word_problems" | "combinatorics" | "travel";
export const TOPICS: Topic[] = ["counting", "shapes", "patterns", "logic", "arithmetic", "time", "number_theory", "word_problems", "combinatorics", "travel"];

export type Difficulty = 1 | 2 | 3 | 4 | 5 | 6;
export const DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5, 6];

export type Source = "practice" | "official" | "simulation" | "shangshi" | "olympiad";
export const SOURCES: Source[] = ["practice", "official", "simulation", "shangshi", "olympiad"];

export interface Choice {
  zh: string;
  en: string;
  /** 选项配图描述符（如 "img:/questions-images/xxx.png"）。存在时按钮以图片形式呈现，zh/en 作为朗读/无障碍标签。 */
  img?: string;
}

export interface Question {
  id: number;
  difficulty: Difficulty;
  topic: Topic;
  text_zh: string;
  text_en: string;
  illustration: string | null;
  choices: Choice[];
  correct_index: number;
  explanation_zh: string;
  explanation_en: string;
  source: Source;
  attribution: string | null;
}

export type RawQuestion = Omit<Question, "id" | "source" | "attribution"> & {
  attribution?: string | null;
};

export interface SessionRow {
  id: number;
  mode: "practice" | "exam";
  started_at: number;
  finished_at: number | null;
  score: number | null;
  max_score: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  blank_count: number | null;
  duration_seconds: number | null;
}

export interface AnswerRow {
  id: number;
  session_id: number;
  question_id: number;
  chosen_index: number | null;
  is_correct: number | null;
  time_spent_seconds: number | null;
  created_at: number;
}
