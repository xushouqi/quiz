"use client";

const LETTERS = ["A", "B", "C"] as const;

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
  variant,
  disabled,
  onSelect,
}: {
  index: number;
  zh: string;
  en: string;
  variant: ChoiceVariant;
  disabled: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(index)}
      className={`flex w-full items-center gap-4 rounded-3xl border-4 p-4 text-left transition active:translate-y-1 ${VARIANT_CLASS[variant]} ${disabled ? "cursor-default" : "cursor-pointer"}`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sunny font-kids text-2xl text-white shadow">
        {LETTERS[index]}
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-bold leading-tight">{zh}</span>
        <span className="block truncate text-sm text-cocoa/60">{en}</span>
      </span>
    </button>
  );
}
