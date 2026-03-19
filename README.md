# リベクリ スタッフサーベイシステム

## 1. プロジェクト概要

リベクリ スタッフサーベイは、リベル大学クリニックグループおよび関連事業体向けの**スタッフ満足度調査・分析ダッシュボード**システムである。組織内の心理的安全性、リーダーシップ、チームワーク、成長実感、組織信頼度を定量的に測定し、拠点間比較・ギャップ分析・離職リスク予測を行う。

### 対象ユーザー
- **管理者（本部）**: サーベイの作成・管理・データ分析を行う
- **スタッフ**: アンケートに回答する（匿名可）
- **院長/事業責任者**: 自己評価としてアンケートに回答する
- **経営企画室**: 各事業体の状況認識をアンケートで回答する

### 解決する課題
- 従業員満足度の定量的な可視化
- 院長（責任者）とスタッフ間の認識ギャップの検出
- 離職リスクの早期発見
- 拠点間・事業体間の比較分析
- 時系列での変化追跡

---

## 2. コンセプト

### 設計思想
- **2種類のサーベイ**: クリニック向け（2者構造）と事業体向け（3者構造）を1つのシステムで統合管理
- **永続DB対応**: ローカルは SQLite、Vercel 本番は Turso/libSQL で永続化
- **即時分析**: データ投入と同時にダッシュボードで可視化
- **匿名安全性**: 回答は匿名可。sessionTokenによる重複防止のみ
- **日本語ファースト**: UI・質問文・分析ラベルすべて日本語

### サーベイの2つのモード

| 項目 | クリニックサーベイ | 事業体サーベイ |
|---|---|---|
| 回答者構造 | 2者（スタッフ + 院長） | 3者（スタッフ + 責任者 + 経営企画室） |
| 質問数 | 15問（共通） | スタッフ19問 / 責任者21問 / 経営企画室20問 |
| 対象組織 | 11クリニック（3グループ） | 14事業体（6グループ） |
| スキップ機能 | なし | あり（3種類） |
| 報酬質問 | なし | あり（5段階選択式） |
| ギャップ分析 | 院長 vs スタッフ | 責任者 vs スタッフ（coreIdマッピング） |
| データ取込 | CSV一括インポート | Web回答フォーム |

---

## 3. 技術スタック

| カテゴリ | 技術 | バージョン |
|---|---|---|
| フレームワーク | Next.js (App Router) | 16.1.6 |
| 言語 | TypeScript | ^5 |
| UI ライブラリ | React | 19.2.3 |
| スタイリング | Tailwind CSS | ^4 |
| UIコンポーネント | shadcn/ui (Radix UI) | ^1.4.3 |
| チャート | Recharts | ^3.7.0 |
| アイコン | Lucide React | ^0.575.0 |
| データベース | libSQL/Turso + SQLite(file) | @libsql/client ^0.17.0 |
| CSV パース | csv-parse | ^6.1.0 |
| UUID | uuid | ^13.0.0 |
| アニメーション | tw-animate-css | ^1.4.0 |
| フォント | Noto Sans JP + Inter | Google Fonts |

---

## 4. システム構成

```
┌─────────────────────────────────────────────────┐
│  ブラウザ (React 19 / Next.js App Router)        │
│  ┌─────────────┐ ┌────────────────┐              │
│  │ ダッシュボード │ │ 回答フォーム    │              │
│  │ (admin only) │ │ (staff/admin)  │              │
│  └──────┬──────┘ └───────┬────────┘              │
│         │                │                        │
│    Cookie認証 (survey_session + survey_role)      │
└─────────┼────────────────┼────────────────────────┘
          │                │
┌─────────▼────────────────▼────────────────────────┐
│  Next.js API Routes (/api/*)                       │
│  ┌──────────────┐  ┌────────────┐                  │
│  │ Middleware     │  │ Auth Layer │                  │
│  │ (route guard) │  │ (cookie)   │                  │
│  └──────────────┘  └────────────┘                  │
│                                                     │
│  ┌──────────────────────────────────────┐          │
│  │ libSQL / Turso または file:SQLite    │          │
│  │ TURSO_DATABASE_URL / data/survey.db  │          │
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
```

### アーキテクチャの特徴
- **App Router**: Next.js 16のApp Routerを使用。ページはすべて `src/app/` 配下
- **サーバーサイドDB**: `@libsql/client` でサーバーサイドのみDB操作。クライアントからはAPI経由
- **Cookie認証**: `survey_session` と `survey_role` の2つのHTTP-only cookieで認証管理
- **Middleware**: Next.js middlewareでルート保護。admin/staffのロールベースアクセス制御
- **SurveyContext**: React Contextでダッシュボード全体にサーベイID・タイプを共有
- **データ格納**: ローカルでは `data/survey.db`、Vercel 本番では `TURSO_DATABASE_URL` 経由で Turso を使用

---

## 5. データベーススキーマ

### surveys テーブル
```sql
CREATE TABLE surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                          -- サーベイ名（例: "第1回スタッフサーベイ"）
  conducted_at DATE NOT NULL,                  -- 実施日
  status TEXT NOT NULL DEFAULT 'draft',        -- 'draft' | 'active'
  survey_type TEXT NOT NULL DEFAULT 'clinic',  -- 'clinic' | 'jigyotai'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### question_templates テーブル
```sql
CREATE TABLE question_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  num INTEGER NOT NULL,                     -- 質問番号
  staff_text TEXT NOT NULL DEFAULT '',      -- クリニック用: スタッフ向け質問文
  director_text TEXT NOT NULL DEFAULT '',   -- クリニック用: 院長向け質問文
  area TEXT NOT NULL,                       -- 領域キー（例: "心理的安全性"）
  area_label TEXT NOT NULL DEFAULT '',      -- 領域ラベル
  respondent_type TEXT,                     -- 事業体用: 'staff' | 'manager' | 'corporate'
  text TEXT,                                -- 事業体用: 質問文
  short_label TEXT,                         -- 短縮ラベル（チャート表示用）
  core_id INTEGER,                          -- ギャップ分析用: スタッフ質問番号へのマッピング
  scale_type TEXT DEFAULT 'agreement',      -- 'agreement' | 'compensation'
  skip_options TEXT                          -- スキップ選択肢（例: "1", "2", "13"）
);
```

### responses テーブル（新レスポンスシステム）
```sql
CREATE TABLE responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                       -- 'staff' | 'director' | 'manager' | 'corporate'
  clinic TEXT NOT NULL DEFAULT '',          -- クリニック名（クリニックサーベイ用）
  entity TEXT,                              -- 事業体名（事業体サーベイ用）
  respondent_name TEXT,                     -- 回答者名（任意）
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  free_text TEXT,                           -- 自由記入
  session_token TEXT                        -- 重複回答防止用UUID
);
```

### response_answers テーブル
```sql
CREATE TABLE response_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES question_templates(id) ON DELETE CASCADE,
  score INTEGER,                            -- 1〜5のスコア（スキップ時はNULL）
  skip_reason TEXT                           -- スキップ理由（例: "関わりがないため回答できない"）
);
```

### staff_responses テーブル（レガシー: CSV一括インポート用）
```sql
CREATE TABLE staff_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  timestamp DATETIME,
  clinic TEXT NOT NULL,
  respondent_name TEXT,
  q1 INTEGER, q2 INTEGER, q3 INTEGER, q4 INTEGER, q5 INTEGER,
  q6 INTEGER, q7 INTEGER, q8 INTEGER, q9 INTEGER, q10 INTEGER,
  q11 INTEGER, q12 INTEGER, q13 INTEGER, q14 INTEGER, q15 INTEGER,
  free_text TEXT
);
```

### director_responses テーブル（レガシー: CSV一括インポート用）
```sql
CREATE TABLE director_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  timestamp DATETIME,
  clinic TEXT NOT NULL,
  q1 INTEGER, q2 INTEGER, q3 INTEGER, q4 INTEGER, q5 INTEGER,
  q6 INTEGER, q7 INTEGER, q8 INTEGER, q9 INTEGER, q10 INTEGER,
  q11 INTEGER, q12 INTEGER, q13 INTEGER, q14 INTEGER, q15 INTEGER,
  free_text TEXT
);
```

### インデックス
```sql
CREATE INDEX idx_responses_survey ON responses(survey_id);
CREATE INDEX idx_responses_type ON responses(survey_id, type);
CREATE INDEX idx_response_answers_response ON response_answers(response_id);
CREATE INDEX idx_question_templates_survey ON question_templates(survey_id);
```

### テーブル関係図
```
surveys (1) ──< question_templates (N)
surveys (1) ──< responses (N)
responses (1) ──< response_answers (N)
question_templates (1) ──< response_answers (N)
surveys (1) ──< staff_responses (N)    [レガシー]
surveys (1) ──< director_responses (N) [レガシー]
```

---

## 6. 認証システム

### ロール構成

| ロール | パスワード環境変数 | デフォルト値 | アクセス範囲 |
|---|---|---|---|
| admin | `ADMIN_PASSWORD` | `liberalarts` | 全ページ（ダッシュボード + 管理 + 回答） |
| staff | `STAFF_PASSWORD` | `staff` | 回答ページのみ（`/respond/*`） |

### 認証フロー

1. ユーザーが `/login` でパスワード入力
2. `POST /api/auth/login` がパスワード照合
3. 成功時、2つのHTTP-only cookieをセット:
   - `survey_session`: `"active"` (有効期限7日)
   - `survey_role`: `"admin"` または `"staff"` (有効期限7日)
4. cookieは `httpOnly: true`, `sameSite: "lax"`, 本番環境では `secure: true`

### Middleware によるルート保護

```
/login                  → 認証不要（公開）
/api/auth/*             → 認証不要（公開）
/_next/*                → 認証不要（静的ファイル）
/favicon*               → 認証不要

/dashboard/*            → admin のみ（staff → /respond にリダイレクト）
/admin/*                → admin のみ
/api/surveys/active     → GET のみ staff 許可
/api/surveys/:id/questions → GET のみ staff 許可
/api/surveys/:id/respond → POST のみ staff 許可
/api/surveys/*          → admin のみ（GETはstaff許可）
/respond/*              → admin + staff 両方
```

---

## 7. 2つのサーベイタイプ

### 7.1 クリニックサーベイ（clinic）

**2者構造**: スタッフと院長が同じ15問に対して、それぞれの立場の文言で回答する。

- **対象**: 11クリニック（3グループ）
- **質問数**: 15問（5領域 x 3問）
- **スコア**: 5段階（1:そう思わない 〜 5:そう思う）
- **データ取込**: CSVインポート（Google Forms出力想定）またはWeb回答フォーム

#### 5つの領域（クリニック）

| 領域 | カラー | 質問番号 |
|---|---|---|
| 心理的安全性 | #3B82F6 (青) | Q1〜Q4 |
| 院長との関係性 | #8B5CF6 (紫) | Q5〜Q8 |
| チームワーク | #10B981 (緑) | Q9〜Q11 |
| 働きがい・成長 | #F59E0B (黄) | Q12〜Q13 |
| 組織への信頼 | #EF4444 (赤) | Q14〜Q15 |

### 7.2 事業体サーベイ（jigyotai）

**3者構造**: スタッフ・事業責任者/現場責任者・経営企画室の3者がそれぞれ異なる質問セットに回答する。

- **対象**: 14事業体（6グループ）
- **質問数**: スタッフ19問 / 責任者21問 / 経営企画室20問
- **スコア**: 5段階 + 報酬質問は専用5段階
- **スキップ機能**: 3種類のスキップ理由に対応
- **coreId**: 責任者の質問からスタッフの質問番号へのマッピング（ギャップ分析用）
- **データ取込**: Web回答フォームのみ（経営企画室は事業体ごとに回答可）

---

## 8. 質問定義

### 8.1 クリニック質問（15問・スタッフ/院長共通）

| Q# | 領域 | スタッフ向け質問文 | 短縮ラベル |
|---|---|---|---|
| Q1 | 心理的安全性 | 業務上の疑問や気づきを、気軽に口に出せる雰囲気がある | 発言しやすい |
| Q2 | 心理的安全性 | ミスや失敗を報告したとき、責められるのではなく一緒に対策を考えてもらえる | ミス報告 |
| Q3 | 心理的安全性 | 「こうした方がいいのでは」という改善提案をしやすい環境だと感じる | 改善提案 |
| Q4 | 心理的安全性 | 職場で、自分の考えや判断が尊重されていると感じる | 判断尊重 |
| Q5 | 院長との関係性 | 業務の指示や方針について、理由や背景の説明が十分にある | 背景説明 |
| Q6 | 院長との関係性 | 自分の業務の進め方について、ある程度の裁量が認められている | 裁量 |
| Q7 | 院長との関係性 | 困ったことや悩みがあるとき、院長に相談しやすいと感じる | 相談しやすい |
| Q8 | 院長との関係性 | 院長は、スタッフ一人ひとりの強みや事情を理解しようとしてくれている | 強み理解 |
| Q9 | チームワーク | 職種の違いに関わらず、お互いの仕事に敬意を持って接している | 相互敬意 |
| Q10 | チームワーク | チーム内で情報共有が十分に行われていると感じる | 情報共有 |
| Q11 | チームワーク | 忙しいときや困ったとき、同僚同士で自然に助け合える関係がある | 助け合い |
| Q12 | 働きがい・成長 | 今の仕事にやりがいを感じている | やりがい |
| Q13 | 働きがい・成長 | この職場で、自分が成長できていると感じる | 成長実感 |
| Q14 | 組織への信頼 | このクリニック（グループ全体）の理念や方向性に共感できる | 理念共感 |
| Q15 | 組織への信頼 | 総合的に見て、今の職場で働き続けたいと思う | 継続意向 |

院長向けは同内容を「スタッフが〜できていると思う」という自己評価の文言に変換して表示する。

### 8.2 事業体スタッフ質問（19問）

| Q# | 領域 | 質問文 | スキップ | coreId |
|---|---|---|---|---|
| Q1 | 心理的安全性 | 業務上の疑問や気づきを、気軽に口に出せる雰囲気がある | - | - |
| Q2 | 心理的安全性 | ミスや失敗を報告したとき、責められるのではなく一緒に対策を考えてもらえる | - | - |
| Q3 | 心理的安全性 | 「こうした方がいいのでは」という改善提案をしやすい環境だと感じる | - | - |
| Q4 | 心理的安全性 | 自分の考えや判断が尊重されていると感じる | - | - |
| Q5 | 責任者との関係性 | 業務の指示や方針について、理由や背景の説明が十分にある | 1 | - |
| Q6 | 責任者との関係性 | 自分の業務の進め方について、ある程度の裁量が認められている | 1 | - |
| Q7 | 責任者との関係性 | 困ったことや悩みがあるとき、事業責任者/現場責任者に相談しやすいと感じる | 1 | - |
| Q8 | 責任者との関係性 | 事業責任者/現場責任者は、自分の強みや事情を理解しようとしてくれている | 1 | - |
| Q9 | 経営企画室との関係性 | 経営企画室が、自分たちの事業に関心を持ち、状況を把握しようとしてくれていると感じる | 13 | - |
| Q10 | 経営企画室との関係性 | 経営企画室からの連絡や方針は、内容が分かりやすく、現場の実情に合っていると感じる | 13 | - |
| Q11 | 経営企画室との関係性 | 経営企画室に対して、必要なときに現場の声や要望を伝える手段があると感じる | 13 | - |
| Q12 | チームワーク | 職種や役割の違いに関わらず、お互いの仕事に敬意を持って接していると感じる | 1 | - |
| Q13 | チームワーク | チーム内で業務に必要な情報共有が十分に行われていると感じる | 1 | - |
| Q14 | チームワーク | 忙しいときや困ったとき、同僚同士で自然に助け合える関係がある | 1 | - |
| Q15 | 働きがい・成長 | 今の仕事にやりがいを感じている | - | - |
| Q16 | 働きがい・成長 | この職場（事業）で、自分が成長できていると感じる | - | - |
| Q17 | 働きがい・成長 | 現在の役割や業務内容、ご自身が発揮している価値に対して、報酬面は適正であると感じますか？ | - | - |
| Q18 | 組織への信頼 | このグループ全体の理念や方向性に共感できる | - | - |
| Q19 | 組織への信頼 | 総合的に見て、今後もこの職場（組織）に関わっていきたいと思う | - | - |

**注**: Q17は報酬質問（`isCompensation: true`）。通常の5段階合意スケールではなく、専用の5段階選択肢を使用。

### 8.3 事業体 責任者質問（21問）

| Q# | 領域 | 質問文 | スキップ | coreId |
|---|---|---|---|---|
| Q1 | 心理的安全性（自己評価） | スタッフが、業務上の疑問や気づきを気軽に口に出せる雰囲気をつくれていると思う | - | 1 |
| Q2 | 心理的安全性（自己評価） | スタッフがミスや失敗を報告しやすい環境が整っていると思う | - | 2 |
| Q3 | 心理的安全性（自己評価） | スタッフからの改善提案を受け止め、検討する姿勢を持てていると思う | - | 3 |
| Q4 | 心理的安全性（自己評価） | スタッフ一人ひとりの考えや判断を尊重できていると思う | - | 4 |
| Q5 | 経営企画室との関係性 | 経営企画室との間で、事業の運営方針や課題について十分なすり合わせができていると感じる | 2 | - |
| Q6 | 経営企画室との関係性 | 経営企画室からのサポートは、事業運営に役立っていると感じる | 2 | - |
| Q7 | 経営企画室との関係性 | 経営企画室に対して、自分の意見や現場の状況を率直に伝えられていると感じる | 2 | - |
| Q8 | 経営企画室との関係性 | 経営企画室と自分の間で、事業の優先順位や方向性について認識のズレが少ないと感じる | 2 | - |
| Q9 | 経営企画室との関係性 | 経営企画室とのやり取りにおいて、互いの立場を尊重した対等なコミュニケーションが取れていると感じる | 2 | - |
| Q10 | スタッフとの関係性（自己評価） | スタッフに対して、業務指示の理由や背景を十分に説明できていると思う | - | 5 |
| Q11 | スタッフとの関係性（自己評価） | スタッフの業務の進め方について、適切な裁量を与えられていると思う | - | 6 |
| Q12 | スタッフとの関係性（自己評価） | スタッフが困ったときに自分に相談しやすい関係を築けていると思う | - | 7 |
| Q13 | スタッフとの関係性（自己評価） | スタッフ一人ひとりの強みや事情を理解しようと努めていると思う | - | 8 |
| Q14 | チームワーク | 職種や役割の違いに関わらず、チーム全体で互いの仕事に敬意が持たれていると感じる | - | 12 |
| Q15 | チームワーク | チーム内の情報共有は十分に機能していると感じる | - | 13 |
| Q16 | チームワーク | チームメンバー同士が自然に助け合える関係が築けていると感じる | - | 14 |
| Q17 | 働きがい・成長 | 今の役割にやりがいを感じている | - | 15 |
| Q18 | 働きがい・成長 | この事業・組織の中で、自分自身も成長できていると感じる | - | 16 |
| Q19 | 働きがい・成長 | スタッフの役割や業務内容、発揮している価値に対して、現在の報酬面は適正であると感じますか？ | - | 17 |
| Q20 | 組織への信頼 | このグループ全体の理念や方向性に共感できる | - | 18 |
| Q21 | 組織への信頼 | 総合的に見て、今後もこの職場（組織）に関わっていきたいと思う | - | 19 |

**coreIdの意味**: 責任者Q1のcoreId=1は、スタッフQ1に対応する。3者比較やギャップ分析で使用。

### 8.4 事業体 経営企画室質問（20問）

| Q# | 領域 | 質問文 | スキップ |
|---|---|---|---|
| Q1 | 心理的安全性（認識） | この事業体のスタッフが、業務上の疑問や気づきを気軽に口に出せる雰囲気があると認識している | - |
| Q2 | 心理的安全性（認識） | この事業体では、ミスや失敗を報告しやすい環境が整っていると認識している | - |
| Q3 | 心理的安全性（認識） | この事業体では、スタッフからの改善提案がしやすい環境だと認識している | - |
| Q4 | 責任者との関係性 | 事業責任者/現場責任者との間で、事業の運営方針や課題について十分なすり合わせができていると感じる | 2 |
| Q5 | 責任者との関係性 | 事業責任者/現場責任者に対して、経営企画室としての提案や意見を率直に伝えられていると感じる | 2 |
| Q6 | 責任者との関係性 | 事業責任者/現場責任者と経営企画室の間で、事業の優先順位や方向性について認識のズレが少ないと感じる | 2 |
| Q7 | 責任者との関係性 | 事業責任者/現場責任者の強みや課題を把握できていると感じる | 2 |
| Q8 | 責任者との関係性 | 事業責任者/現場責任者とのやり取りにおいて、互いの立場を尊重した対等なコミュニケーションが取れていると感じる | 2 |
| Q9 | スタッフとの関係性 | この事業体のスタッフの現場の状況や困りごとを、十分に把握できていると感じる | - |
| Q10 | スタッフとの関係性 | スタッフに対して、経営企画室としての方針や連絡が分かりやすく届いていると感じる | - |
| Q11 | スタッフとの関係性 | スタッフから経営企画室に、必要なときに現場の声や要望が届く手段があると感じる | - |
| Q12 | チームワーク（認識） | この事業体のチーム内で、十分な情報共有が行われていると認識している | - |
| Q13 | チームワーク（認識） | この事業体のメンバー同士が、自然に助け合える関係にあると認識している | - |
| Q14 | 働きがい・成長（認識） | この事業体のメンバーが、やりがいを感じて働いていると認識している | - |
| Q15 | 働きがい・成長（認識） | この事業体のメンバーが、成長実感を持てていると認識している | - |
| Q16 | 働きがい・成長（認識） | この事業体のメンバーの役割や業務内容に対して、現在の報酬面は適正であると感じますか？ | - |
| Q17 | 経営企画室機能 | この事業体に対して、経営企画室として十分なサポートができていると感じる | - |
| Q18 | 経営企画室機能 | この事業体の運営改善に、経営企画室が実質的に貢献できていると感じる | - |
| Q19 | 組織全体 | このグループ全体の理念や方向性が、この事業体に浸透していると感じる | - |
| Q20 | 組織全体 | この事業体の将来性や成長に期待を持っている | - |

### 8.5 報酬質問の選択肢

報酬質問（`isCompensation: true` / `scale_type: "compensation"`）は通常の5段階スケールではなく、以下の専用選択肢を使用:

| 値 | ラベル |
|---|---|
| 5 | 十分に適正である |
| 4 | 概ね適正である |
| 3 | どちらとも言えない |
| 2 | やや見直しが必要と感じる |
| 1 | 改善が必要と感じる |

---

## 9. 組織構造

### 9.1 クリニックグループ（11拠点・3グループ）

| グループ | カラー | アイコン | 所属クリニック |
|---|---|---|---|
| 医科クリニック | #3B82F6 | 🏥 | リベ大総合クリニック大阪院、リベ大クリニック名古屋院、横浜LA内科・内視鏡クリニック、春日すぐファミリークリニック、北堀江LA皮膚科クリニック、とどろきLAクリニック、つくばLAファミリークリニック |
| デンタルクリニック | #8B5CF6 | 🦷 | リベ大デンタルクリニック大阪院、リベ大デンタルクリニック福岡院、リベ大デンタルクリニック武蔵小杉院 |
| どうぶつ病院 | #F59E0B | 🐾 | リベ大どうぶつ病院 |

### 9.2 事業体グループ（14事業体・6グループ）

| グループ | カラー | アイコン | 所属事業体 |
|---|---|---|---|
| 不動産 | #3B82F6 | 🏠 | 不動産(賃貸)、不動産(売買) |
| 建設・引越 | #F59E0B | 🔨 | 工務店、引越センター |
| バックオフィス | #8B5CF6 | 💼 | 経理代行、オンライン秘書 |
| 訪問看護 | #10B981 | 🏥 | 訪問看護(横浜)、訪問看護(大阪) |
| 福祉 | #EC4899 | 🤝 | 就労支援(大阪)、就労支援(東京)、就労支援(広島)、放デイ(大阪) |
| 士業・その他 | #6366F1 | 📋 | 司法書士、葬儀 |

---

## 10. ページ構成

### 10.1 公開ページ

| URL | ページ | 説明 |
|---|---|---|
| `/login` | ログイン | パスワード入力。admin→ダッシュボード、staff→回答ページへリダイレクト |
| `/respond` | 回答一覧 | アクティブなサーベイの一覧。`GET /api/surveys/active` を呼出 |
| `/respond/[id]` | 回答フォーム | 質問に回答する。回答者タイプ選択→拠点/事業体選択→質問回答→送信 |

### 10.2 ダッシュボード（admin only）

全てのダッシュボードページは `?surveyId=N` クエリパラメータでサーベイを選択。ヘッダーの `SurveySelector` で切替可能。`SurveyContext` がサーベイタイプ（clinic/jigyotai）を判定し、サイドバーのナビゲーション項目を動的に切替。

#### クリニックサーベイ用ナビゲーション

| URL | ページ | 説明 | 使用API |
|---|---|---|---|
| `/dashboard` | 全体ダッシュボード | サマリーカード（回答数・全体平均・最高/最低スコア）、レーダーチャート、質問別スコア | `/api/surveys/:id/summary`, `/api/surveys/:id/scores` |
| `/dashboard/clinics` | 拠点別 | グループ別/全拠点一覧、クリニックカード（レーダーチャート付）、ヒートマップ | `/api/surveys/:id/clinics`, `/api/surveys/:id/heatmap` |
| `/dashboard/gap` | ギャップ分析 | 院長スコア vs スタッフスコアの差分分析。拠点別展開式 | `/api/surveys/:id/gap` |
| `/dashboard/retention` | 離職リスク | Q7(相談しやすさ) x Q15(継続意向) 散布図。リスクレベル分類 | `/api/surveys/:id/retention` |
| `/dashboard/responses` | 個別回答 | 回答一覧テーブル + サイドパネル詳細。自由記入タブ切替 | `/api/surveys/:id/responses`, `/api/surveys/:id/free-text` |
| `/dashboard/trends` | 時系列比較 | 複数サーベイを選択して領域別/拠点別の推移を折れ線グラフで表示 | `/api/trends` |

#### 事業体サーベイ用ナビゲーション

| URL | ページ | 説明 | 使用API |
|---|---|---|---|
| `/dashboard` | 事業体ダッシュボード | サマリー（スタッフ/責任者/経営企画室回答数）、レーダーチャート、事業体ランキング、質問別スコア | `/api/surveys/:id/summary`, `/api/surveys/:id/jg-scores`, `/api/surveys/:id/jg-entities` |
| `/dashboard/entities` | 事業体別 | グループ別/全事業体一覧、エンティティカード、ヒートマップ | `/api/surveys/:id/jg-entities`, `/api/surveys/:id/jg-scores` |
| `/dashboard/tricompare` | 3者比較 | スタッフ vs 責任者 vs 経営企画室の3者平均を棒グラフ比較。事業体別詳細テーブル | `/api/surveys/:id/jg-tricompare` |
| `/dashboard/skip-analysis` | スキップ分析 | スキップ率マトリクス（事業体 x 質問）。回答者タイプ別フィルタ | `/api/surveys/:id/jg-skip` |
| `/dashboard/corporate` | 経営企画室 | 経営企画室の回答分析。事業体別レーダーチャート、自由記述コメント一覧 | `/api/surveys/:id/jg-corporate` |
| `/dashboard/responses` | 個別回答 | （クリニックと共通UI） | `/api/surveys/:id/responses` |
| `/dashboard/retention` | 離職リスク | （クリニックと共通UI） | `/api/surveys/:id/retention` |

### 10.3 管理ページ（admin only）

| URL | ページ | 説明 |
|---|---|---|
| `/admin` | データ管理 | サーベイのCRUD、CSVアップロード（スタッフ/院長）、ステータス切替（draft/active） |
| `/admin/questions` | 質問テンプレート | サーベイの質問を編集。デフォルト質問セットの読み込み、追加/削除/並べ替え |

---

## 11. API仕様

### 11.1 認証API

#### `POST /api/auth/login`
- **認証**: 不要
- **リクエスト**: `{ "password": "string" }`
- **レスポンス**: `{ "success": true, "role": "admin" | "staff" }` + Set-Cookie
- **エラー**: `401 { "error": "パスワードが正しくありません" }`

#### `POST /api/auth/logout`
- **認証**: 不要
- **処理**: Cookie削除
- **レスポンス**: `{ "success": true }`

### 11.2 サーベイ管理API

#### `GET /api/surveys`
- **認証**: admin (staff は middleware で制限)
- **レスポンス**: サーベイ一覧（回答数カウント含む）
```json
[{
  "id": 1, "name": "第1回", "conducted_at": "2025-01-01",
  "status": "active", "survey_type": "clinic",
  "legacy_staff_count": 50, "legacy_director_count": 5,
  "new_staff_count": 10, "new_director_count": 2,
  "new_manager_count": 0, "new_corporate_count": 0,
  "question_count": 15
}]
```

#### `POST /api/surveys`
- **認証**: admin
- **リクエスト**: `{ "name": "string", "conducted_at": "YYYY-MM-DD", "survey_type": "clinic" | "jigyotai" }`
- **レスポンス**: `{ "id": 1, "name": "...", "conducted_at": "...", "survey_type": "clinic" }`

#### `GET /api/surveys/[id]`
- **認証**: admin
- **レスポンス**: サーベイ詳細

#### `PATCH /api/surveys/[id]`
- **認証**: admin
- **リクエスト**: `{ "status": "draft" | "active" }`
- **レスポンス**: `{ "success": true }`

#### `DELETE /api/surveys/[id]`
- **認証**: admin
- **処理**: サーベイと関連する全データ（回答・質問テンプレート）を削除
- **レスポンス**: `{ "success": true }`

#### `GET /api/surveys/active`
- **認証**: staff可
- **レスポンス**: `status='active'` のサーベイ一覧

### 11.3 質問テンプレートAPI

#### `GET /api/surveys/[id]/questions`
- **認証**: staff可
- **クエリ**: `?respondentType=staff|manager|corporate`（事業体サーベイ用）
- **レスポンス**: `{ "survey_type": "clinic" | "jigyotai", "questions": [...] }`

#### `PUT /api/surveys/[id]/questions`
- **認証**: admin
- **リクエスト**: `{ "questions": [...] }` または `{ "respondent_type": "staff", "questions": [...] }`
- **処理**: 既存の質問をすべて削除して再挿入

### 11.4 回答API

#### `POST /api/surveys/[id]/respond`
- **認証**: staff可
- **リクエスト**:
```json
{
  "respondentType": "staff",
  "clinic": "リベ大総合クリニック大阪院",
  "entity": null,
  "respondentName": "匿名",
  "freeText": "自由記入テキスト",
  "sessionToken": "uuid-v4",
  "answers": [
    { "questionId": 1, "score": 4, "skipReason": null },
    { "questionId": 5, "score": null, "skipReason": "関わりがないため回答できない" }
  ]
}
```
- **バリデーション**:
  - サーベイがactive状態であること
  - 拠点/事業体が必須
  - 全回答の questionId が有効であること
  - スコアは1〜5（またはスキップ時null）
  - sessionTokenによる重複チェック（経営企画室は事業体ごとに回答可）
- **レスポンス**: `{ "success": true, "responseId": 123 }`

### 11.5 CSVアップロードAPI

#### `POST /api/surveys/[id]/upload/staff`
#### `POST /api/surveys/[id]/upload/director`
- **認証**: admin
- **Content-Type**: `multipart/form-data`
- **フィールド**: `csv` (File)
- **処理**: CSVパース→レガシーテーブル（staff_responses/director_responses）に挿入
- **レスポンス**: `{ "count": 50, "matchedQuestions": 15, "totalRows": 50, "warnings": [] }`

#### 管理用 Seed

第1回サーベイのような既存CSVを「初期表示用データ」として投入したい場合は、実データをリポジトリへ同梱せず、管理者がローカルまたは本番環境で seed コマンドを実行する。

```bash
npm run seed:first-survey -- \
  --name "第1回スタッフサーベイ" \
  --conducted-at 2025-01-01 \
  --staff-csv /absolute/path/staff.csv \
  --director-csv /absolute/path/director.csv \
  --activate \
  --replace
```

- `--staff-csv` は必須、`--director-csv` は任意
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` があれば Turso へ投入、未設定時はローカル SQLite を使用
- `--db-path` を付けると投入先をローカル SQLite ファイルに固定可能
- `--replace` を付けると、同名・同実施日の既存サーベイに対して質問・回答を削除して再投入
- `--activate` を付けると seed 後に `active` 化
- 実データCSVや `data/survey.db` 自体は git 管理に含めない

### 11.6 分析API（クリニック）

#### `GET /api/surveys/[id]/summary`
- **レスポンス（clinic）**: `{ "surveyType": "clinic", "staffCount": 50, "directorCount": 5, "overallAvg": 3.82, "highest": {...}, "lowest": {...} }`
- **レスポンス（jigyotai）**: `{ "surveyType": "jigyotai", "staffCount": 100, "managerCount": 14, "corporateCount": 10, "overallAvg": 3.65, "highest": {...}, "lowest": {...}, "entities": [...] }`

#### `GET /api/surveys/[id]/scores`
- **クリニック専用**
- **レスポンス**: `{ "scores": [...], "areaAverages": [...] }`

#### `GET /api/surveys/[id]/gap`
- **クリニック専用**: 院長 vs スタッフのギャップ分析

#### `GET /api/surveys/[id]/retention`
- **レスポンス**: Q7 x Q15 のクリニック別散布図データ + リスクレベル分類

### 11.7 分析API（事業体）

#### `GET /api/surveys/[id]/jg-scores?type=staff&entity=XXX`
- **レスポンス**: `{ "scores": [...], "areaAverages": [...] }`

#### `GET /api/surveys/[id]/jg-entities`
- **レスポンス**: 事業体別サマリー配列（overallAvg, areaAverages, alertItems）

#### `GET /api/surveys/[id]/jg-tricompare`
- **レスポンス**: 事業体別3者比較（staffAvg, managerAvg, corporateAvg, comparisons）

#### `GET /api/surveys/[id]/jg-skip`
- **レスポンス**: `{ "entities": [...], "rows": [...] }`（質問 x 事業体のスキップ率マトリクス）

#### `GET /api/surveys/[id]/jg-corporate`
- **レスポンス**: `{ "overallAvg": 3.5, "overallScores": [...], "entities": [...], "allComments": [...] }`

---

## 12. CSVインポート仕様

### 対象
クリニックサーベイのレガシーデータインポート（Google Formsのエクスポート想定）。

### エンコーディング処理
1. まずUTF-8でデコード
2. `\uFFFD`（置換文字）が含まれる場合、Shift_JISで再デコード
3. BOM（UTF-8/UTF-16）を除去
4. ゼロ幅文字を除去

### カラムマッチングロジック

| ヘッダーの条件 | マッピング先 |
|---|---|
| 「タイムスタンプ」or「timestamp」を含む | timestamp列 |
| 「所属」「所属拠点」「拠点」「クリニック」「クリニック名」のいずれか | clinic列 |
| 「氏名」「名前」「お名前」を含む | respondent_name列 |
| 「自由」「コメント」「ご意見」「その他」「ご自身の」「職場環境」を含む | free_text列 |
| 質問文の先頭20文字と部分一致 | 該当するq1〜q15列 |

### スコア抽出
- `"4：ややそう思う"` 形式 → 先頭の数字を抽出（正規表現: `/^(\d)/`）
- 純粋な数値 → 1〜5の範囲であればそのまま使用
- 空文字列・範囲外 → null

### CSVパース
- 引用符付きフィールド（ダブルクォート）に対応
- ダブルクォートのエスケープ（`""`）に対応
- 改行を含むフィールドに対応（引用符内）

### 院長回答の特別処理
- 同一クリニック・同一サーベイの既存院長回答は**上書き**（DELETE→INSERT）
- respondent_nameフィールドは削除

---

## 13. スキップ回答

### スキップの3種類

| キー | ラベル | 対象 | 意味 |
|---|---|---|---|
| 1 | 関わりがないため回答できない | スタッフ・責任者 | 責任者/経営企画室と関わりがない |
| 2 | 経営企画室が事業責任者/現場責任者を担っているためスキップ | 責任者・経営企画室 | 兼任のため該当しない |
| 3 | 事業責任者/現場責任者と同一のためスキップ | スタッフ | 責任者と経営企画室が同一人物 |

### skip_options フィールドの読み方
- `"1"` → スキップ選択肢「1」のみ表示
- `"2"` → スキップ選択肢「2」のみ表示
- `"13"` → スキップ選択肢「1」と「3」の両方を表示（各文字を分割）

### スキップがスコアに与える影響
- スキップ回答は `score = NULL`, `skip_reason = "理由テキスト"` として保存
- 平均スコア計算時、`score IS NOT NULL` の回答のみを使用（スキップは除外）
- スキップ分析ページで事業体別のスキップ率を可視化

---

## 14. ダッシュボード分析ロジック

### スコア評価基準

| スコア | 評価 | カラー |
|---|---|---|
| >= 3.5 | 良好 | #10B981 (緑) / bg: #DCFCE7 |
| 3.0 〜 3.5 | 注意 | #F59E0B (黄) / bg: #FEF9C3 |
| < 3.0 | 要改善 | #EF4444 (赤) / bg: #FEE2E2 |

### ギャップ分析（クリニック）
- ギャップ = 院長スコア - スタッフスコア
- `>= +1.5`: 院長が大幅に過大評価（赤）
- `+0.5 〜 +1.5`: 院長がやや過大評価（黄）
- `-0.5 〜 +0.5`: 認識一致（緑）
- `< -0.5`: 院長が過小評価（青）

### ギャップ分析（事業体 3者比較）
- coreIdマッピングで責任者の質問をスタッフの質問と対応付け
- ギャップ = 責任者スコア - スタッフスコア
- `|差| >= 1.0`: 要対応（赤）
- `|差| 0.5〜1.0`: 要注意（黄）
- `|差| < 0.5`: 一致（緑）

### 離職リスク分析
- **X軸**: Q7（院長/責任者への相談しやすさ）
- **Y軸**: Q15（継続意向）
- **リスクレベル**:
  - `critical`: Q7 < 3.0 かつ Q15 < 3.0（要緊急対応）
  - `warning-director`: Q7 < 3.0（院長関係に課題）
  - `warning-other`: Q15 < 3.0（継続意向に課題）
  - `good`: それ以外（概ね良好）

### スキップ分析
- スキップ率 = (スキップ回数 / 総回答数) x 100%
- 表示閾値:
  - `>= 80%`: 赤背景
  - `50〜80%`: 黄背景
  - `20〜50%`: 薄黄背景
  - `< 20%`: 背景なし

---

## 15. UI/UXデザイン

### カラーテーマ
- **プライマリ**: `#10B981`（エメラルドグリーン）
- **背景**: `#F8FAFB`
- **テキスト**: `#111827`（メイン）/ `#6B7280`（サブ）/ `#9CA3AF`（淡い）
- **ボーダー**: `#E5E7EB`
- **カード**: `#FFFFFF` + `border-radius: 0.75rem`

### レイアウト
- **サイドバー**: 幅260px、固定左配置、上下分割（ナビ + ログアウト）
- **ヘッダー**: 粘着配置、右にサーベイセレクタ
- **メインコンテンツ**: `ml-[260px]`, `p-8`

### チャートライブラリ（Recharts）
- RadarChart: 領域別スコア
- BarChart: 拠点/事業体ランキング
- ScatterChart: 離職リスク散布図
- LineChart: 時系列推移

### フォント
- **本文**: Noto Sans JP（400/500/600/700）
- **数値**: Inter（400/600/700）

### アニメーション
- `animate-fade-in`: フェードイン（200ms）
- `animate-slide-in`: 右からスライド（300ms）
- `animate-scale-in`: スケールイン（150ms、モーダル用）

---

## 16. 環境変数

| 変数名 | 説明 | デフォルト値 |
|---|---|---|
| `ADMIN_PASSWORD` | 管理者ログインパスワード | `liberalarts` |
| `STAFF_PASSWORD` | スタッフログインパスワード | `staff` |
| `TURSO_DATABASE_URL` | Vercel / 本番で使う libSQL 接続先 | - |
| `TURSO_AUTH_TOKEN` | Turso 接続トークン | - |
| `SQLITE_DB_PATH` | ローカル SQLite パスを上書きする場合に使用 | `data/survey.db` |
| `VERCEL` | Vercel環境フラグ（自動設定） | - |
| `NODE_ENV` | 環境（production でcookieにsecure付与） | `development` |

---

## 17. セットアップ手順

### 前提条件
- Node.js 20+
- npm

### インストール

```bash
git clone <repository-url>
cd survey
npm install
```

### 開発サーバー起動

```bash
npm run dev
```

`http://localhost:3000` でアクセス。`TURSO_DATABASE_URL` 未設定時は初回アクセスで `data/survey.db` が自動作成され、設定済みなら Turso に対してマイグレーションが実行される。

### ログイン
- 管理者: パスワード `liberalarts` → ダッシュボード
- スタッフ: パスワード `staff` → 回答ページ

### サーベイ作成の流れ

1. 管理者でログイン
2. `/admin` でサーベイを作成（タイプ選択: クリニック or 事業体）
3. `/admin/questions?surveyId=N` で質問テンプレートを設定
   - クリニック: 「デフォルト質問を読み込む」で15問セット
   - 事業体: API経由で各回答者タイプの質問を登録
4. ステータスを「公開」に変更
5. スタッフに `/respond` のURLとパスワードを共有

### 本番ビルド

```bash
npm run build
npm start
```

### Vercel デプロイ

Vercel 本番では `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN` を設定し、Turso に永続化する。未設定のままでは `/tmp` の一時 DB にフォールバックし、データは保持されない。

---

## 18. ディレクトリ構成

```
survey/
├── data/                              # ローカル開発用SQLite格納（gitignore推奨）
│   └── survey.db
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── components.json                    # shadcn/ui設定
├── src/
│   ├── middleware.ts                   # ルート保護（認証・ロールチェック）
│   ├── lib/
│   │   ├── auth.ts                    # 認証ロジック（login, cookie管理, requireAuth）
│   │   ├── db.ts                      # DBスキーマ・マイグレーション・全CRUD関数
│   │   ├── clinics.ts                 # クリニックグループ定義・ヘルパー
│   │   ├── entities.ts               # 事業体グループ定義・ヘルパー
│   │   ├── questions.ts              # クリニック質問15問定義
│   │   ├── jigyotai-questions.ts     # 事業体質問（3セット）・スキップ・報酬定義
│   │   ├── csv-parser.ts             # CSV解析（エンコーディング・カラムマッチング）
│   │   └── utils.ts                  # cn()ヘルパー（tailwind-merge）
│   ├── components/
│   │   ├── sidebar.tsx               # サイドバーナビゲーション（タイプ別切替）
│   │   ├── survey-context.tsx        # SurveyProvider（サーベイID・タイプ共有）
│   │   ├── survey-selector.tsx       # サーベイプルダウン選択
│   │   ├── score-badge.tsx           # スコア表示バッジ（色分け付き）
│   │   ├── score-bar.tsx             # スコアバー（プログレスバー風）
│   │   ├── area-badge.tsx            # 領域バッジ
│   │   └── ui/                       # shadcn/ui コンポーネント群
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       └── tooltip.tsx
│   ├── app/
│   │   ├── layout.tsx                # ルートレイアウト（フォント・メタデータ）
│   │   ├── globals.css               # グローバルCSS（Tailwind・アニメーション）
│   │   ├── page.tsx                  # ルートページ（リダイレクト）
│   │   ├── favicon.ico
│   │   ├── login/
│   │   │   └── page.tsx              # ログインページ
│   │   ├── respond/
│   │   │   ├── layout.tsx            # 回答ページレイアウト
│   │   │   ├── page.tsx              # アクティブサーベイ一覧
│   │   │   └── [id]/
│   │   │       └── page.tsx          # 回答フォーム
│   │   ├── admin/
│   │   │   ├── layout.tsx            # 管理ページレイアウト
│   │   │   ├── page.tsx              # データ管理（サーベイCRUD・CSVアップロード）
│   │   │   └── questions/
│   │   │       └── page.tsx          # 質問テンプレート編集
│   │   ├── dashboard/
│   │   │   ├── layout.tsx            # ダッシュボードレイアウト（サイドバー・セレクタ）
│   │   │   ├── page.tsx              # メインダッシュボード（clinic/jigyotai分岐）
│   │   │   ├── clinics/
│   │   │   │   ├── page.tsx          # 拠点別ダッシュボード
│   │   │   │   └── [clinicName]/
│   │   │   │       └── page.tsx      # 個別クリニック詳細
│   │   │   ├── entities/
│   │   │   │   └── page.tsx          # 事業体別ダッシュボード
│   │   │   ├── tricompare/
│   │   │   │   └── page.tsx          # 3者比較分析
│   │   │   ├── skip-analysis/
│   │   │   │   └── page.tsx          # スキップ分析
│   │   │   ├── corporate/
│   │   │   │   └── page.tsx          # 経営企画室ダッシュボード
│   │   │   ├── gap/
│   │   │   │   └── page.tsx          # ギャップ分析
│   │   │   ├── retention/
│   │   │   │   └── page.tsx          # 離職リスク分析
│   │   │   ├── responses/
│   │   │   │   └── page.tsx          # 個別回答ビューア
│   │   │   └── trends/
│   │   │       └── page.tsx          # 時系列比較
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts    # POST ログイン
│   │       │   ├── logout/route.ts   # POST ログアウト
│   │       │   └── check/route.ts    # GET 認証チェック
│   │       ├── surveys/
│   │       │   ├── route.ts          # GET 一覧 / POST 作成
│   │       │   ├── active/route.ts   # GET アクティブサーベイ一覧
│   │       │   └── [id]/
│   │       │       ├── route.ts      # GET / PATCH / DELETE
│   │       │       ├── questions/route.ts     # GET / PUT 質問テンプレート
│   │       │       ├── respond/route.ts       # POST 回答送信
│   │       │       ├── summary/route.ts       # GET サマリー
│   │       │       ├── scores/route.ts        # GET クリニックスコア
│   │       │       ├── clinics/route.ts       # GET クリニック別データ
│   │       │       ├── clinics/[name]/route.ts # GET 個別クリニック
│   │       │       ├── heatmap/route.ts       # GET ヒートマップ
│   │       │       ├── gap/route.ts           # GET ギャップ分析
│   │       │       ├── retention/route.ts     # GET 離職リスク
│   │       │       ├── responses/route.ts     # GET 回答一覧
│   │       │       ├── responses/[resId]/route.ts # GET 回答詳細
│   │       │       ├── free-text/route.ts     # GET 自由記入一覧
│   │       │       ├── jg-scores/route.ts     # GET 事業体スコア
│   │       │       ├── jg-entities/route.ts   # GET 事業体別サマリー
│   │       │       ├── jg-tricompare/route.ts # GET 3者比較
│   │       │       ├── jg-skip/route.ts       # GET スキップ分析
│   │       │       ├── jg-corporate/route.ts  # GET 経営企画室分析
│   │       │       └── upload/
│   │       │           ├── staff/route.ts     # POST スタッフCSVアップロード
│   │       │           └── director/route.ts  # POST 院長CSVアップロード
│   │       └── trends/route.ts        # GET 時系列比較データ
```
