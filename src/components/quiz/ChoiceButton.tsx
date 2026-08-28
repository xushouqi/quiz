"use client";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

export type ChoiceVariant = "idle" | "wrong" | "correct" | "dimmed" | "selected";

const VARIANT_CLASS: Record<ChoiceVariant, string> = {
  idle: "border-cocoa/10 bg-white hover:-rotate-1 hover:border-sunny hover:shadow-lg",
  wrong: "animate-wiggle border-coral bg-coral/15",
  correct: "border-grass bg-grass/20",
  dimmed: "border-cocoa/10 bg-white/60 opacity-60",
  selected: "border-sunny bg-sunny/15",
};

export function ChoiceButton({
  index,
  zh,
  en,
  img,
  variant,
  disabled,
  onSelect,
}: {
  index: number;
  zh: string;
  en: string;
  img?: string;
  variant: ChoiceVariant;
  disabled: boolean;
  onSelect: (index: number) => void;
}) {
  const letter = LETTERS[index] ?? String(index + 1);

  // 图片选项：方形磁贴，图为主，字母角标 + 无障碍/朗读标签用文字描述
  if (img) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(index)}
        aria-label={`${letter}. ${zh}`}
        className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border-4 p-1.5 transition active:translate-y-1 md:rounded-3xl md:p-2 ${VARIANT_CLASS[variant]} ${disabled ? "cursor-default" : "cursor-pointer"}`}
      >
        <span className="absolute bottom-1 left-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-sunny font-kids text-sm text-white shadow md:h-7 md:w-7 md:text-base">
          {letter}
        </span>
        <span className="sr-only">{zh} {en}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={zh}
          draggable={false}
          className="pointer-events-none absolute top-1.5 right-1.5 bottom-7 left-7 select-none object-contain"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(index)}
      className={`flex w-full items-center gap-2.5 rounded-2xl border-4 p-2.5 text-left transition active:translate-y-1 md:gap-3 md:rounded-3xl md:p-3 ${VARIANT_CLASS[variant]} ${disabled ? "cursor-default" : "cursor-pointer"}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunny font-kids text-xl text-white shadow md:h-11 md:w-11 md:text-2xl">
        {letter}
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold leading-tight md:text-xl">{zh}</span>
        <span className="block truncate text-xs text-cocoa/60 md:text-sm">{en}</span>
      </span>
    </button>
  );
}
