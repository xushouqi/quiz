interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

const EMOJI_OPTIONS = [
  "🐨", "🐰", "🐱", "🐶", "🐼", "🦊", "🐸", "🐧",
  "🦋", "🐻", "🐯", "🦁", "🐮", "🐷", "🐵", "🦄",
  "🐙", "🐳", "🦖", "🦕", "🐢", "🦜", "🦩", "🐦",
  "🌟", "🌈", "🎀", "👑", "🦸", "🧚", "🎨", "🎭",
];

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {EMOJI_OPTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={`aspect-square rounded-xl border-2 text-3xl transition ${
            value === emoji
              ? "border-sunny bg-sunny/20 scale-110 shadow"
              : "border-cocoa/10 bg-white hover:border-cocoa/30 hover:bg-cocoa/5"
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
