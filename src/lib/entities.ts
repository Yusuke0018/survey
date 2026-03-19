// ==================== 事業体 (Business Entity) ====================

export interface EntityGroup {
  id: string;
  label: string;
  color: string;
  icon: string;
  entities: string[];
}

export const ENTITY_GROUPS: EntityGroup[] = [
  {
    id: "fudosan",
    label: "不動産",
    color: "#3B82F6",
    icon: "🏠",
    entities: ["不動産(賃貸)", "不動産(売買)"],
  },
  {
    id: "construction",
    label: "建設・引越",
    color: "#F59E0B",
    icon: "🔨",
    entities: ["工務店", "引越センター"],
  },
  {
    id: "office",
    label: "バックオフィス",
    color: "#8B5CF6",
    icon: "💼",
    entities: ["経理代行", "オンライン秘書"],
  },
  {
    id: "nursing",
    label: "訪問看護",
    color: "#10B981",
    icon: "🏥",
    entities: ["訪問看護(横浜)", "訪問看護(大阪)"],
  },
  {
    id: "welfare",
    label: "福祉",
    color: "#EC4899",
    icon: "🤝",
    entities: ["就労支援(大阪)", "就労支援(東京)", "就労支援(広島)", "放デイ(大阪)"],
  },
  {
    id: "professional",
    label: "士業・その他",
    color: "#6366F1",
    icon: "📋",
    entities: ["司法書士", "葬儀"],
  },
];

export const ENTITIES = ENTITY_GROUPS.flatMap((g) => g.entities);

export function getEntityGroup(name: string): EntityGroup | undefined {
  return ENTITY_GROUPS.find((g) => g.entities.includes(name));
}

export function getEntityGroupColor(name: string): string {
  return getEntityGroup(name)?.color || "#6B7280";
}

export function getEntityShortName(name: string): string {
  const map: Record<string, string> = {
    "不動産(賃貸)": "不賃貸",
    "不動産(売買)": "不売買",
    "工務店": "工務店",
    "引越センター": "引越",
    "経理代行": "経理",
    "オンライン秘書": "ON秘書",
    "訪問看護(横浜)": "訪問横浜",
    "訪問看護(大阪)": "訪問大阪",
    "就労支援(大阪)": "就労大阪",
    "就労支援(東京)": "就労東京",
    "就労支援(広島)": "就労広島",
    "放デイ(大阪)": "放デイ",
    "司法書士": "司法書士",
    "葬儀": "葬儀",
  };
  return map[name] || name;
}

export function groupEntitiesByGroup<T extends { entity: string }>(items: T[]) {
  const result: Array<{ group: EntityGroup; items: T[] }> = [];
  for (const group of ENTITY_GROUPS) {
    const groupItems = items.filter((item) => group.entities.includes(item.entity));
    if (groupItems.length > 0) {
      result.push({ group, items: groupItems });
    }
  }
  const allGrouped = new Set(ENTITIES);
  const ungrouped = items.filter((item) => !allGrouped.has(item.entity));
  if (ungrouped.length > 0) {
    result.push({
      group: { id: "other", label: "その他", color: "#6B7280", icon: "📦", entities: [] },
      items: ungrouped,
    });
  }
  return result;
}
