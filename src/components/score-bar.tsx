"use client";

import { getScoreColor, getScoreTextColor } from "./score-badge";

interface ScoreBarProps {
  score: number | null;
  maxScore?: number;
  globalAvg?: number | null;
  showValue?: boolean;
}

export function ScoreBar({ score, maxScore = 5, globalAvg, showValue = true }: ScoreBarProps) {
  if (score == null) return <div className="h-2 bg-gray-100 rounded-full" />;

  const pct = (score / maxScore) * 100;
  const bgColor = getScoreColor(score);
  const textColor = getScoreTextColor(score);

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: bgColor }}
        />
        {globalAvg != null && (
          <div
            className="absolute inset-y-0 w-0.5 bg-gray-400 opacity-50"
            style={{ left: `${(globalAvg / maxScore) * 100}%` }}
          />
        )}
      </div>
      {showValue && (
        <span
          className="text-sm font-[family-name:var(--font-inter)] font-semibold w-10 text-right"
          style={{ color: textColor }}
        >
          {score.toFixed(2)}
        </span>
      )}
    </div>
  );
}
