export type AreaKey = "safety" | "director" | "teamwork" | "growth" | "trust";

export interface Question {
  id: string;
  num: number;
  staffText: string;
  directorText: string;
  area: AreaKey;
  areaLabel: string;
  questionKey: string;
  compareKey: string;
}

export const AREAS: Record<AreaKey, { label: string; color: string }> = {
  safety: { label: "心理的安全性", color: "#3B82F6" },
  director: { label: "院長との関係性", color: "#8B5CF6" },
  teamwork: { label: "チームワーク", color: "#10B981" },
  growth: { label: "働きがい・成長", color: "#F59E0B" },
  trust: { label: "組織への信頼", color: "#EF4444" },
};

export const AREA_ORDER: AreaKey[] = ["safety", "director", "teamwork", "growth", "trust"];

export const QUESTIONS: Question[] = [
  { id: "q1", num: 1, staffText: "業務上の疑問や気づきを、気軽に口に出せる雰囲気がある", directorText: "スタッフが業務上の疑問や気づきを、気軽に口に出せる雰囲気を作れていると思う", area: "safety", areaLabel: "心理的安全性", questionKey: "clinic.psychological_safety.speak_up", compareKey: "clinic.psychological_safety.speak_up" },
  { id: "q2", num: 2, staffText: "ミスや失敗を報告したとき、責められるのではなく一緒に対策を考えてもらえる", directorText: "スタッフがミスや失敗を報告したとき、責めるのではなく一緒に対策を考える対応ができていると思う", area: "safety", areaLabel: "心理的安全性", questionKey: "clinic.psychological_safety.report_mistakes", compareKey: "clinic.psychological_safety.report_mistakes" },
  { id: "q3", num: 3, staffText: "「こうした方がいいのでは」という改善提案をしやすい環境だと感じる", directorText: "スタッフが「こうした方がいいのでは」と改善提案をしやすい環境を作れていると思う", area: "safety", areaLabel: "心理的安全性", questionKey: "clinic.psychological_safety.suggest_improvements", compareKey: "clinic.psychological_safety.suggest_improvements" },
  { id: "q4", num: 4, staffText: "職場で、自分の考えや判断が尊重されていると感じる", directorText: "スタッフの考えや判断を尊重できていると思う", area: "safety", areaLabel: "心理的安全性", questionKey: "clinic.psychological_safety.respect_judgment", compareKey: "clinic.psychological_safety.respect_judgment" },
  { id: "q5", num: 5, staffText: "業務の指示や方針について、理由や背景の説明が十分にある", directorText: "業務の指示や方針を伝えるとき、理由や背景を十分に説明できていると思う", area: "director", areaLabel: "院長との関係性", questionKey: "clinic.director_relation.explain_rationale", compareKey: "clinic.director_relation.explain_rationale" },
  { id: "q6", num: 6, staffText: "自分の業務の進め方について、ある程度の裁量が認められている", directorText: "スタッフの業務の進め方について、ある程度の裁量を認められていると思う", area: "director", areaLabel: "院長との関係性", questionKey: "clinic.director_relation.allow_discretion", compareKey: "clinic.director_relation.allow_discretion" },
  { id: "q7", num: 7, staffText: "困ったことや悩みがあるとき、院長に相談しやすいと感じる", directorText: "スタッフが困ったことや悩みがあるとき、自分に相談しやすい状態を作れていると思う", area: "director", areaLabel: "院長との関係性", questionKey: "clinic.director_relation.consult_easy", compareKey: "clinic.director_relation.consult_easy" },
  { id: "q8", num: 8, staffText: "院長は、スタッフ一人ひとりの強みや事情を理解しようとしてくれている", directorText: "スタッフ一人ひとりの強みや事情を理解しようと努められていると思う", area: "director", areaLabel: "院長との関係性", questionKey: "clinic.director_relation.understand_strengths", compareKey: "clinic.director_relation.understand_strengths" },
  { id: "q9", num: 9, staffText: "職種の違いに関わらず、お互いの仕事に敬意を持って接している", directorText: "職種の違いに関わらず、お互いの仕事に敬意を持って接する文化が自分のチームにあると思う", area: "teamwork", areaLabel: "チームワーク", questionKey: "clinic.teamwork.mutual_respect", compareKey: "clinic.teamwork.mutual_respect" },
  { id: "q10", num: 10, staffText: "チーム内で情報共有が十分に行われていると感じる", directorText: "チーム内の情報共有は十分にできていると思う", area: "teamwork", areaLabel: "チームワーク", questionKey: "clinic.teamwork.share_information", compareKey: "clinic.teamwork.share_information" },
  { id: "q11", num: 11, staffText: "忙しいときや困ったとき、同僚同士で自然に助け合える関係がある", directorText: "忙しいときや困ったとき、スタッフ同士で自然に助け合える関係が築けていると思う", area: "teamwork", areaLabel: "チームワーク", questionKey: "clinic.teamwork.help_each_other", compareKey: "clinic.teamwork.help_each_other" },
  { id: "q12", num: 12, staffText: "今の仕事にやりがいを感じている", directorText: "スタッフが今の仕事にやりがいを感じられる環境を作れていると思う", area: "growth", areaLabel: "働きがい・成長", questionKey: "clinic.engagement.meaningful_work", compareKey: "clinic.engagement.meaningful_work" },
  { id: "q13", num: 13, staffText: "この職場で、自分が成長できていると感じる", directorText: "スタッフがこの職場で成長できていると感じられる環境を作れていると思う", area: "growth", areaLabel: "働きがい・成長", questionKey: "clinic.engagement.growth", compareKey: "clinic.engagement.growth" },
  { id: "q14", num: 14, staffText: "このクリニック（グループ全体）の理念や方向性に共感できる", directorText: "クリニックグループ全体の理念や方向性を、スタッフに十分に伝えられていると思う", area: "trust", areaLabel: "組織への信頼", questionKey: "clinic.organization.shared_vision", compareKey: "clinic.organization.shared_vision" },
  { id: "q15", num: 15, staffText: "総合的に見て、今の職場で働き続けたいと思う", directorText: "総合的に見て、スタッフがこの職場で働き続けたいと思える環境を作れていると思う", area: "trust", areaLabel: "組織への信頼", questionKey: "clinic.organization.retention_intent", compareKey: "clinic.organization.retention_intent" },
];

export function getQuestionsByArea(): Record<AreaKey, Question[]> {
  const result: Record<AreaKey, Question[]> = {
    safety: [], director: [], teamwork: [], growth: [], trust: [],
  };
  for (const q of QUESTIONS) {
    result[q.area].push(q);
  }
  return result;
}

export function getShortLabel(q: Question): string {
  const labels: Record<number, string> = {
    1: "発言しやすい", 2: "ミス報告", 3: "改善提案", 4: "判断尊重",
    5: "背景説明", 6: "裁量", 7: "相談しやすい", 8: "強み理解",
    9: "相互敬意", 10: "情報共有", 11: "助け合い",
    12: "やりがい", 13: "成長実感", 14: "理念共感", 15: "継続意向",
  };
  return labels[q.num] || q.staffText.substring(0, 8);
}
