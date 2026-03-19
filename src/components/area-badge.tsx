"use client";

import { AREAS, type AreaKey } from "@/lib/questions";

const DEFAULT_AREA_COLORS: Record<string, string> = {
  safety: "#3B82F6",
  director: "#8B5CF6",
  teamwork: "#10B981",
  growth: "#F59E0B",
  trust: "#EF4444",
};

interface AreaBadgeProps {
  area: string;
  label?: string;
  color?: string;
  showLabel?: boolean;
}

export function AreaBadge({ area, label, color, showLabel = true }: AreaBadgeProps) {
  const areaInfo = (area in AREAS) ? AREAS[area as AreaKey] : null;
  const displayLabel = label ?? areaInfo?.label ?? area;
  const displayColor = color ?? areaInfo?.color ?? DEFAULT_AREA_COLORS[area] ?? "#64748B";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: displayColor }} />
      {showLabel && <span className="text-xs text-muted-foreground">{displayLabel}</span>}
    </span>
  );
}
