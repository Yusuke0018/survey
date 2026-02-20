"use client";

import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  if (score == null) return <span className="text-muted-foreground text-xs">-</span>;

  const colorClass =
    score >= 3.5 ? "score-good" : score >= 3.0 ? "score-warn" : "score-bad";

  const sizeClass = {
    sm: "w-5 h-5 text-[11px]",
    md: "w-8 h-8 text-sm",
    lg: "w-12 h-12 text-2xl",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-[family-name:var(--font-inter)] font-bold animate-scale-in",
        colorClass,
        sizeClass
      )}
    >
      {score.toFixed(2)}
    </span>
  );
}

export function getScoreColor(score: number | null): string {
  if (score == null) return "transparent";
  if (score >= 3.5) return "#DCFCE7";
  if (score >= 3.0) return "#FEF9C3";
  return "#FEE2E2";
}

export function getScoreTextColor(score: number | null): string {
  if (score == null) return "#64748B";
  if (score >= 3.5) return "#166534";
  if (score >= 3.0) return "#854D0E";
  return "#991B1B";
}

export function getScoreBorderColor(score: number | null): string {
  if (score == null) return "#E2E8F0";
  if (score >= 3.5) return "#BBF7D0";
  if (score >= 3.0) return "#FDE68A";
  return "#FCA5A5";
}
