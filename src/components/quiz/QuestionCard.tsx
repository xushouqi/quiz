import type { Question } from "@/lib/types";
import { Illustration } from "./Illustration";
import { ReadAloud } from "./ReadAloud";

export function QuestionCard({
  question,
  children,
  largeImage = false,
  questionNumber,
}: {
  question: Question;
  children?: React.ReactNode;
  /** 大图模式:放大题图(上实机考整页截图便于看清)。 */
  largeImage?: boolean;
  /** 可选的原始题号(如来自 PDF 的编号),显示在题目前方。 */
  questionNumber?: number | string;
}) {
  return (
    <div className="animate-pop flex flex-col rounded-[1.5rem] border-4 border-cocoa/10 bg-white p-3 shadow-xl md:p-4">
      <div className="shrink-0">
        <div className="mb-1 flex items-start justify-between gap-2 md:mb-1.5 md:gap-3">
          <p className="font-kids text-lg leading-snug md:text-xl lg:text-2xl">
            {questionNumber != null && (
              <span className="mr-1 inline-block rounded-full bg-violet/15 px-2 py-0.5 text-base font-semibold text-violet md:text-lg">
                {questionNumber}
              </span>
            )}
            {question.text_zh}
          </p>
          <ReadAloud text={question.text_zh} autoPlay mode="edge" />
        </div>
        <p className="mb-1.5 text-xs text-cocoa/60 md:mb-2 md:text-sm">{question.text_en}</p>
        <div className="mb-2 md:mb-3">
          <Illustration descriptor={question.illustration} large={largeImage} />
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
