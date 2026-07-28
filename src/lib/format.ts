export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function encouragement(score: number, maxScore: number): { zh: string; en: string } {
  const pct = maxScore > 0 ? score / maxScore : 0;
  if (pct >= 0.9) {
    return { zh: "太棒了！你简直是小袋鼠天才！", en: "Amazing! You are a little kangaroo genius!" };
  }
  if (pct >= 0.7) {
    return { zh: "非常厉害！再细心一点就更完美啦！", en: "Great job! A little more care and it will be perfect!" };
  }
  if (pct >= 0.5) {
    return { zh: "不错哦！多练习，下次会更好！", en: "Nice! Keep practicing and you will do even better!" };
  }
  return { zh: "没关系，跳跳陪你多练几次就会啦！", en: "No worries — practice makes progress!" };
}
