// ==================== 事業体サーベイ質問定義 ====================

export type RespondentType = "staff" | "manager" | "corporate";

export interface JigyotaiQuestion {
  id: number;
  text: string;
  area: string;
  short: string;
  skip: string | null; // "1" = 関わりがない, "2" = 経営企画室兼任, "3" = 責任者同一, "13" = 1 and 3
  coreId: number | null; // maps to staff question for gap analysis
  isCompensation?: boolean;
}

// ========== スタッフ用 Q1〜Q19 ==========
export const JG_STAFF_Q: JigyotaiQuestion[] = [
  { id: 1, text: "業務上の疑問や気づきを、気軽に口に出せる雰囲気がある", area: "心理的安全性", short: "発言しやすさ", skip: null, coreId: null },
  { id: 2, text: "ミスや失敗を報告したとき、責められるのではなく一緒に対策を考えてもらえる", area: "心理的安全性", short: "ミス報告", skip: null, coreId: null },
  { id: 3, text: "「こうした方がいいのでは」という改善提案をしやすい環境だと感じる", area: "心理的安全性", short: "改善提案", skip: null, coreId: null },
  { id: 4, text: "自分の考えや判断が尊重されていると感じる", area: "心理的安全性", short: "判断の尊重", skip: null, coreId: null },
  { id: 5, text: "業務の指示や方針について、理由や背景の説明が十分にある", area: "責任者との関係性", short: "背景説明", skip: "1", coreId: null },
  { id: 6, text: "自分の業務の進め方について、ある程度の裁量が認められている", area: "責任者との関係性", short: "裁量", skip: "1", coreId: null },
  { id: 7, text: "困ったことや悩みがあるとき、事業責任者/現場責任者に相談しやすいと感じる", area: "責任者との関係性", short: "相談しやすさ", skip: "1", coreId: null },
  { id: 8, text: "事業責任者/現場責任者は、自分の強みや事情を理解しようとしてくれている", area: "責任者との関係性", short: "個別理解", skip: "1", coreId: null },
  { id: 9, text: "経営企画室が、自分たちの事業に関心を持ち、状況を把握しようとしてくれていると感じる", area: "経営企画室との関係性", short: "関心・把握", skip: "13", coreId: null },
  { id: 10, text: "経営企画室からの連絡や方針は、内容が分かりやすく、現場の実情に合っていると感じる", area: "経営企画室との関係性", short: "伝達", skip: "13", coreId: null },
  { id: 11, text: "経営企画室に対して、必要なときに現場の声や要望を伝える手段があると感じる", area: "経営企画室との関係性", short: "現場→本部", skip: "13", coreId: null },
  { id: 12, text: "職種や役割の違いに関わらず、お互いの仕事に敬意を持って接していると感じる", area: "チームワーク", short: "相互敬意", skip: "1", coreId: null },
  { id: 13, text: "チーム内で業務に必要な情報共有が十分に行われていると感じる", area: "チームワーク", short: "情報共有", skip: "1", coreId: null },
  { id: 14, text: "忙しいときや困ったとき、同僚同士で自然に助け合える関係がある", area: "チームワーク", short: "助け合い", skip: "1", coreId: null },
  { id: 15, text: "今の仕事にやりがいを感じている", area: "働きがい・成長", short: "やりがい", skip: null, coreId: null },
  { id: 16, text: "この職場（事業）で、自分が成長できていると感じる", area: "働きがい・成長", short: "成長実感", skip: null, coreId: null },
  { id: 17, text: "現在の役割や業務内容、ご自身が発揮している価値に対して、報酬面は適正であると感じますか？", area: "働きがい・成長", short: "報酬適正度", skip: null, coreId: null, isCompensation: true },
  { id: 18, text: "このグループ全体の理念や方向性に共感できる", area: "組織への信頼", short: "理念共感", skip: null, coreId: null },
  { id: 19, text: "総合的に見て、今後もこの職場（組織）に関わっていきたいと思う", area: "組織への信頼", short: "継続意向", skip: null, coreId: null },
];

// ========== 事業責任者/現場責任者用 Q1〜Q21 ==========
export const JG_MANAGER_Q: JigyotaiQuestion[] = [
  { id: 1, text: "スタッフが、業務上の疑問や気づきを気軽に口に出せる雰囲気をつくれていると思う", area: "心理的安全性（自己評価）", short: "発言しやすさ", skip: null, coreId: 1 },
  { id: 2, text: "スタッフがミスや失敗を報告しやすい環境が整っていると思う", area: "心理的安全性（自己評価）", short: "ミス報告", skip: null, coreId: 2 },
  { id: 3, text: "スタッフからの改善提案を受け止め、検討する姿勢を持てていると思う", area: "心理的安全性（自己評価）", short: "改善提案", skip: null, coreId: 3 },
  { id: 4, text: "スタッフ一人ひとりの考えや判断を尊重できていると思う", area: "心理的安全性（自己評価）", short: "判断の尊重", skip: null, coreId: 4 },
  { id: 5, text: "経営企画室との間で、事業の運営方針や課題について十分なすり合わせができていると感じる", area: "経営企画室との関係性", short: "すり合わせ", skip: "2", coreId: null },
  { id: 6, text: "経営企画室からのサポートは、事業運営に役立っていると感じる", area: "経営企画室との関係性", short: "サポート有用性", skip: "2", coreId: null },
  { id: 7, text: "経営企画室に対して、自分の意見や現場の状況を率直に伝えられていると感じる", area: "経営企画室との関係性", short: "率直な伝達", skip: "2", coreId: null },
  { id: 8, text: "経営企画室と自分の間で、事業の優先順位や方向性について認識のズレが少ないと感じる", area: "経営企画室との関係性", short: "認識一致", skip: "2", coreId: null },
  { id: 9, text: "経営企画室とのやり取りにおいて、互いの立場を尊重した対等なコミュニケーションが取れていると感じる", area: "経営企画室との関係性", short: "対等コミュニケーション", skip: "2", coreId: null },
  { id: 10, text: "スタッフに対して、業務指示の理由や背景を十分に説明できていると思う", area: "スタッフとの関係性（自己評価）", short: "背景説明", skip: null, coreId: 5 },
  { id: 11, text: "スタッフの業務の進め方について、適切な裁量を与えられていると思う", area: "スタッフとの関係性（自己評価）", short: "裁量", skip: null, coreId: 6 },
  { id: 12, text: "スタッフが困ったときに自分に相談しやすい関係を築けていると思う", area: "スタッフとの関係性（自己評価）", short: "相談しやすさ", skip: null, coreId: 7 },
  { id: 13, text: "スタッフ一人ひとりの強みや事情を理解しようと努めていると思う", area: "スタッフとの関係性（自己評価）", short: "個別理解", skip: null, coreId: 8 },
  { id: 14, text: "職種や役割の違いに関わらず、チーム全体で互いの仕事に敬意が持たれていると感じる", area: "チームワーク", short: "相互敬意", skip: null, coreId: 12 },
  { id: 15, text: "チーム内の情報共有は十分に機能していると感じる", area: "チームワーク", short: "情報共有", skip: null, coreId: 13 },
  { id: 16, text: "チームメンバー同士が自然に助け合える関係が築けていると感じる", area: "チームワーク", short: "助け合い", skip: null, coreId: 14 },
  { id: 17, text: "今の役割にやりがいを感じている", area: "働きがい・成長", short: "やりがい", skip: null, coreId: 15 },
  { id: 18, text: "この事業・組織の中で、自分自身も成長できていると感じる", area: "働きがい・成長", short: "成長実感", skip: null, coreId: 16 },
  { id: 19, text: "スタッフの役割や業務内容、発揮している価値に対して、現在の報酬面は適正であると感じますか？", area: "働きがい・成長", short: "報酬認識", skip: null, coreId: 17, isCompensation: true },
  { id: 20, text: "このグループ全体の理念や方向性に共感できる", area: "組織への信頼", short: "理念共感", skip: null, coreId: 18 },
  { id: 21, text: "総合的に見て、今後もこの職場（組織）に関わっていきたいと思う", area: "組織への信頼", short: "継続意向", skip: null, coreId: 19 },
];

// ========== 経営企画室用 Q1〜Q20 ==========
export const JG_CORPORATE_Q: JigyotaiQuestion[] = [
  { id: 1, text: "この事業体のスタッフが、業務上の疑問や気づきを気軽に口に出せる雰囲気があると認識している", area: "心理的安全性（認識）", short: "発言しやすさ", skip: null, coreId: null },
  { id: 2, text: "この事業体では、ミスや失敗を報告しやすい環境が整っていると認識している", area: "心理的安全性（認識）", short: "ミス報告", skip: null, coreId: null },
  { id: 3, text: "この事業体では、スタッフからの改善提案がしやすい環境だと認識している", area: "心理的安全性（認識）", short: "改善提案", skip: null, coreId: null },
  { id: 4, text: "事業責任者/現場責任者との間で、事業の運営方針や課題について十分なすり合わせができていると感じる", area: "責任者との関係性", short: "すり合わせ", skip: "2", coreId: null },
  { id: 5, text: "事業責任者/現場責任者に対して、経営企画室としての提案や意見を率直に伝えられていると感じる", area: "責任者との関係性", short: "率直な提案", skip: "2", coreId: null },
  { id: 6, text: "事業責任者/現場責任者と経営企画室の間で、事業の優先順位や方向性について認識のズレが少ないと感じる", area: "責任者との関係性", short: "認識一致", skip: "2", coreId: null },
  { id: 7, text: "事業責任者/現場責任者の強みや課題を把握できていると感じる", area: "責任者との関係性", short: "責任者理解", skip: "2", coreId: null },
  { id: 8, text: "事業責任者/現場責任者とのやり取りにおいて、互いの立場を尊重した対等なコミュニケーションが取れていると感じる", area: "責任者との関係性", short: "対等コミュニケーション", skip: "2", coreId: null },
  { id: 9, text: "この事業体のスタッフの現場の状況や困りごとを、十分に把握できていると感じる", area: "スタッフとの関係性", short: "現場把握", skip: null, coreId: null },
  { id: 10, text: "スタッフに対して、経営企画室としての方針や連絡が分かりやすく届いていると感じる", area: "スタッフとの関係性", short: "伝達", skip: null, coreId: null },
  { id: 11, text: "スタッフから経営企画室に、必要なときに現場の声や要望が届く手段があると感じる", area: "スタッフとの関係性", short: "声が届く", skip: null, coreId: null },
  { id: 12, text: "この事業体のチーム内で、十分な情報共有が行われていると認識している", area: "チームワーク（認識）", short: "情報共有", skip: null, coreId: null },
  { id: 13, text: "この事業体のメンバー同士が、自然に助け合える関係にあると認識している", area: "チームワーク（認識）", short: "助け合い", skip: null, coreId: null },
  { id: 14, text: "この事業体のメンバーが、やりがいを感じて働いていると認識している", area: "働きがい・成長（認識）", short: "やりがい認識", skip: null, coreId: null },
  { id: 15, text: "この事業体のメンバーが、成長実感を持てていると認識している", area: "働きがい・成長（認識）", short: "成長認識", skip: null, coreId: null },
  { id: 16, text: "この事業体のメンバーの役割や業務内容に対して、現在の報酬面は適正であると感じますか？", area: "働きがい・成長（認識）", short: "報酬認識", skip: null, coreId: null, isCompensation: true },
  { id: 17, text: "この事業体に対して、経営企画室として十分なサポートができていると感じる", area: "経営企画室機能", short: "サポート充足", skip: null, coreId: null },
  { id: 18, text: "この事業体の運営改善に、経営企画室が実質的に貢献できていると感じる", area: "経営企画室機能", short: "貢献実感", skip: null, coreId: null },
  { id: 19, text: "このグループ全体の理念や方向性が、この事業体に浸透していると感じる", area: "組織全体", short: "理念浸透", skip: null, coreId: null },
  { id: 20, text: "この事業体の将来性や成長に期待を持っている", area: "組織全体", short: "将来性", skip: null, coreId: null },
];

// ========== 領域定義 ==========
export const JG_STAFF_AREAS = ["心理的安全性", "責任者との関係性", "経営企画室との関係性", "チームワーク", "働きがい・成長", "組織への信頼"];
export const JG_MANAGER_AREAS = ["心理的安全性（自己評価）", "経営企画室との関係性", "スタッフとの関係性（自己評価）", "チームワーク", "働きがい・成長", "組織への信頼"];
export const JG_CORPORATE_AREAS = ["心理的安全性（認識）", "責任者との関係性", "スタッフとの関係性", "チームワーク（認識）", "働きがい・成長（認識）", "経営企画室機能", "組織全体"];

// ========== スキップ選択肢ラベル ==========
export const SKIP_OPTIONS = {
  "1": "関わりがないため回答できない",
  "2": "経営企画室が事業責任者/現場責任者を担っているためスキップ",
  "3": "事業責任者/現場責任者と同一のためスキップ",
} as const;

// 報酬質問の選択肢
export const COMPENSATION_CHOICES = [
  { value: 5, label: "十分に適正である" },
  { value: 4, label: "概ね適正である" },
  { value: 3, label: "どちらとも言えない" },
  { value: 2, label: "やや見直しが必要と感じる" },
  { value: 1, label: "改善が必要と感じる" },
];

export function getJigyotaiQuestions(type: RespondentType): JigyotaiQuestion[] {
  switch (type) {
    case "staff": return JG_STAFF_Q;
    case "manager": return JG_MANAGER_Q;
    case "corporate": return JG_CORPORATE_Q;
  }
}

export function getJigyotaiAreas(type: RespondentType): string[] {
  switch (type) {
    case "staff": return JG_STAFF_AREAS;
    case "manager": return JG_MANAGER_AREAS;
    case "corporate": return JG_CORPORATE_AREAS;
  }
}
