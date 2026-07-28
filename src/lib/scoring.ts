export const BASE_SCORE = 24;
export const EXAM_LENGTH = 24;
export const EXAM_MINUTES = 75;
export const MAX_SCORE = 120;

export interface ScoredAnswer {
  difficulty: number;
  chosen: number | null;
  correctIndex: number;
}

export interface ExamResult {
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  blank: number;
}

export function scoreExam(answers: ScoredAnswer[]): ExamResult {
  let score = BASE_SCORE;
  let maxScore = BASE_SCORE;
  let correct = 0;
  let wrong = 0;
  let blank = 0;

  for (const a of answers) {
    maxScore += a.difficulty;
    if (a.chosen === null) {
      blank += 1;
    } else if (a.chosen === a.correctIndex) {
      correct += 1;
      score += a.difficulty;
    } else {
      wrong += 1;
      score -= 1;
    }
  }

  return { score, maxScore, correct, wrong, blank };
}
