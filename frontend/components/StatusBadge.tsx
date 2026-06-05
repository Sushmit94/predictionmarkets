import type { ReactNode } from "react";

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "green" | "yellow" | "red" | "neutral";
}) {
  const tones = {
    green: "border-[#9de9be] bg-[#e9fff1] text-[#116636]",
    yellow: "border-[#eadb8a] bg-[#fff9df] text-[#6b580f]",
    red: "border-[#f3b4aa] bg-[#fff0ed] text-[#8a2a1d]",
    neutral: "border-[#dce8dd] bg-white text-[#40564a]",
  };

  return (
    <span className={`inline-flex h-7 items-center rounded border px-2 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
