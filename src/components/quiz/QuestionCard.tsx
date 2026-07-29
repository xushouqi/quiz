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
    <div className="animate-pop rounded-[1.5rem] border-4 border-cocoa/10 bg-white/90 p-3 shadow-xl backdrop-blur md:p-4">
      <div className="mb-1 flex items-start justify-between gap-2 md:mb-1.5 md:gap-3">
        <p className="font-kids text-lg leading-snug md:text-xl lg:text-2xl">{question.text_zh}</p>
        <ReadAloud text={question.text_zh} autoPlay />
      </div>
      <p className="mb-1.5 text-xs text-cocoa/60 md:mb-2 md:text-sm">{question.text_en}</p>
      <div className="mb-2 md:mb-3">
        <Illustration descriptor={question.illustration} />
      </div>
      {children}
    </div>
  );
}
