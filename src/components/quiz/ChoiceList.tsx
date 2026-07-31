import type { Choice } from "@/lib/types";
import { ChoiceButton, type ChoiceVariant } from "./ChoiceButton";

/**
 * 选项列表容器。自适应两种布局：
 * - 含图片选项：3 列网格（磁贴），4–5 个选项自然换行；
 * - 纯文字选项：≤3 项竖向堆叠（阅读友好），4–5 项 2 列网格（一屏放得下）。
 */
export function ChoiceList({
  choices,
  variantFor,
  disabled,
  onSelect,
}: {
  choices: Choice[];
  variantFor: (index: number) => ChoiceVariant;
  disabled: boolean;
  onSelect: (index: number) => void;
}) {
  const hasImg = choices.some((c) => Boolean(c.img));
  const container = hasImg
    ? "grid grid-cols-3 gap-2 md:gap-3"
    : choices.length <= 3
      ? "space-y-2 md:space-y-3"
      : "grid grid-cols-2 gap-2 md:gap-3";

  return (
    <div className={container}>
      {choices.map((c, i) => (
        <ChoiceButton
          key={i}
          index={i}
          zh={c.zh}
          en={c.en}
          img={c.img}
          variant={variantFor(i)}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
