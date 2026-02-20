"use client";

import { AREAS, type AreaKey } from "@/lib/questions";

interface AreaBadgeProps {
  area: AreaKey;
  showLabel?: boolean;
}

export function AreaBadge({ area, showLabel = true }: AreaBadgeProps) {
  const { label, color } = AREAS[area];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {showLabel && <span className="text-xs text-muted-foreground">{label}</span>}
    </span>
  );
}
