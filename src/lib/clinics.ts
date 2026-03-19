// ==================== 事業体 (Business Entity) ====================

export interface ClinicGroup {
  id: string;
  label: string;
  color: string;
  icon: string; // emoji for simple display
  clinics: string[];
}

export const CLINIC_GROUPS: ClinicGroup[] = [
  {
    id: "medical",
    label: "医科クリニック",
    color: "#3B82F6",
    icon: "🏥",
    clinics: [
      "リベ大総合クリニック大阪院",
      "リベ大クリニック名古屋院",
      "横浜LA内科・内視鏡クリニック",
      "春日すぐファミリークリニック",
      "北堀江LA皮膚科クリニック",
      "とどろきLAクリニック",
      "つくばLAファミリークリニック",
    ],
  },
  {
    id: "dental",
    label: "デンタルクリニック",
    color: "#8B5CF6",
    icon: "🦷",
    clinics: [
      "リベ大デンタルクリニック大阪院",
      "リベ大デンタルクリニック福岡院",
      "リベ大デンタルクリニック武蔵小杉院",
    ],
  },
  {
    id: "animal",
    label: "どうぶつ病院",
    color: "#F59E0B",
    icon: "🐾",
    clinics: [
      "リベ大どうぶつ病院",
    ],
  },
];

// Flat list derived from groups
export const CLINICS = CLINIC_GROUPS.flatMap((g) => g.clinics);

export type ClinicName = string;

// ==================== Lookup Helpers ====================

export function getClinicGroup(clinicName: string): ClinicGroup | undefined {
  return CLINIC_GROUPS.find((g) => g.clinics.includes(clinicName));
}

export function getClinicGroupId(clinicName: string): string {
  return getClinicGroup(clinicName)?.id || "other";
}

export function getClinicGroupLabel(clinicName: string): string {
  return getClinicGroup(clinicName)?.label || "その他";
}

export function getClinicGroupColor(clinicName: string): string {
  return getClinicGroup(clinicName)?.color || "#6B7280";
}

export function getClinicShortName(name: string): string {
  const map: Record<string, string> = {
    "リベ大総合クリニック大阪院": "大阪総合",
    "リベ大クリニック名古屋院": "名古屋",
    "横浜LA内科・内視鏡クリニック": "横浜LA",
    "春日すぐファミリークリニック": "春日",
    "北堀江LA皮膚科クリニック": "北堀江",
    "とどろきLAクリニック": "とどろき",
    "つくばLAファミリークリニック": "つくば",
    "リベ大デンタルクリニック大阪院": "デンタル大阪",
    "リベ大デンタルクリニック福岡院": "デンタル福岡",
    "リベ大デンタルクリニック武蔵小杉院": "デンタル武蔵小杉",
    "リベ大どうぶつ病院": "どうぶつ",
  };
  return map[name] || name;
}

// Group clinics from data by their business entity
export function groupClinicsByEntity<T extends { clinic: string }>(items: T[]): Array<{
  group: ClinicGroup;
  items: T[];
  groupAvg?: number;
}> {
  const result: Array<{ group: ClinicGroup; items: T[]; groupAvg?: number }> = [];

  for (const group of CLINIC_GROUPS) {
    const groupItems = items.filter((item) => group.clinics.includes(item.clinic));
    if (groupItems.length > 0) {
      result.push({ group, items: groupItems });
    }
  }

  // Handle clinics not in any group
  const allGrouped = new Set(CLINIC_GROUPS.flatMap((g) => g.clinics));
  const ungrouped = items.filter((item) => !allGrouped.has(item.clinic));
  if (ungrouped.length > 0) {
    result.push({
      group: { id: "other", label: "その他", color: "#6B7280", icon: "📋", clinics: [] },
      items: ungrouped,
    });
  }

  return result;
}
