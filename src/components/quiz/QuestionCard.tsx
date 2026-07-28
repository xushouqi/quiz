import type { Question } from "@/lib/types";
import { Illustration } from "./Illustration";
import { ReadAloud } from "./ReadAloud";

export function QuestionCard({
  question,
  children,
}: {
  question: Question;
  children?: React.ReactNode;
}) {
  return (
    <div className="animate-pop rounded-[2rem] border-4 border-cocoa/10 bg-white/90 p-6 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="font-kids text-2xl leading-snug sm:text-3xl">{question.text_zh}</p>
        <ReadAloud text={question.text_zh} />
      </div>
      <p className="mb-4 text-base text-cocoa/60">{question.text_en}</p>
      <div className="mb-5">
        <Illustration descriptor={question.illustration} />
      </div>
      {children}
    </div>
  );
}
