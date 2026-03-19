# 質問編集と分析反映の改善ロードマップ

最終更新: 2026-03-19 JST

## 目的

理想形は次のとおりです。

- 管理画面で質問を自由に追加・削除・並び替えできる
- 文言を気軽に修正できる
- 新しいサーベイを取ったとき、分析画面に自動で反映される
- 前回と同じ意図の質問は、文言が少し変わっても時系列比較や対応付けができる

## 現状の制約

### 1. クリニックサーベイは固定15問前提

クリニック分析の多くは `src/lib/questions.ts` の固定 `QUESTIONS` 配列を参照しています。

主な参照箇所:

- `src/lib/questions.ts`
- `src/app/api/surveys/[id]/scores/route.ts`
- `src/app/api/surveys/[id]/clinics/route.ts`
- `src/app/api/surveys/[id]/clinics/[name]/route.ts`
- `src/app/api/surveys/[id]/gap/route.ts`
- `src/app/api/surveys/[id]/heatmap/route.ts`
- `src/app/api/surveys/[id]/summary/route.ts`
- `src/app/api/trends/route.ts`
- `src/lib/csv-parser.ts`
- `src/lib/survey-analytics.ts`

そのため、管理画面でクリニック質問を `Q16` 以降追加しても、現状は次の状態になります。

- 回答画面: 出せる
- 保存: できる
- 個別回答: 見える
- 集計・拠点別・ギャップ分析・時系列: 基本的に固定15問しか見ない

### 2. 事業体サーベイは比較的柔軟

事業体は `question_templates` テーブルベースで動く部分が多く、自由度は高いです。

ただし分析に必要な項目があります。

- `respondent_type`
- `short_label`
- `core_id`
- `scale_type`
- `skip_options`

特に `core_id` は、責任者質問とスタッフ質問の対応付けに使っています。

参照箇所:

- `src/lib/jigyotai-questions.ts`
- `src/app/api/surveys/[id]/jg-tricompare/route.ts`
- `src/app/api/surveys/[id]/jg-scores/route.ts`
- `src/app/api/surveys/[id]/jg-skip/route.ts`

### 3. 時系列比較は「同じ質問」の識別子を持っていない

今は文言ではなく固定問番寄りで比較している部分が多く、文言変更後に「前回と同じ質問」と機械的に判断する共通キーがありません。

## あるべき設計

### 中心方針

`質問文` と `分析上の意味` を分離する。

必要なのは、各質問に次の2種類のIDを持たせることです。

- `question_id`
  - そのサーベイ内の物理ID
- `question_key`
  - サーベイをまたいで「同じ意味の質問」を表す論理キー

例:

- `clinic.psychological_safety.speak_up`
- `clinic.director_relation.consult_easy`
- `common.growth.meaningful_work`

文言を変えても `question_key` が同じなら、同一系列として比較できます。

## 推奨データ構造

### 追加したい列

`question_templates` に少なくとも以下を追加する想定です。

- `question_key TEXT`
- `analysis_group TEXT`
- `analysis_label TEXT`
- `compare_key TEXT`
- `is_active INTEGER DEFAULT 1`
- `display_order INTEGER`

意味:

- `question_key`
  - 時系列比較や前回質問との紐付け用の安定キー
- `analysis_group`
  - 領域集計に使うキー
- `analysis_label`
  - 表示名
- `compare_key`
  - ギャップ分析などで別立場の質問同士を結ぶキー
- `display_order`
  - 並び順

### 追加で作りたいテーブル

理想的には、質問マスタとサーベイへの割当を分けます。

#### `question_catalog`

- 質問の意味を管理するマスタ
- `question_key` を一意にする

例:

- `id`
- `question_key`
- `default_text`
- `analysis_group`
- `analysis_label`
- `default_short_label`
- `scale_type`

#### `survey_question_links`

- サーベイごとの質問差し替え用
- 文言変更や一時的な設問追加もここで管理

例:

- `id`
- `survey_id`
- `respondent_type`
- `question_key`
- `text`
- `short_label`
- `compare_key`
- `skip_options`
- `display_order`

ただし時間優先なら、まずは `question_templates` 拡張だけでもよいです。

## 最短の改修順

### フェーズ1: 共通キー導入

最優先です。これがないと「前回と同じ質問」の扱いができません。

やること:

1. `question_templates` に `question_key` と `compare_key` を追加
2. 既存の固定15問にキーを振る
3. 管理画面で `question_key` を編集または選択できるようにする
4. 新規質問追加時は空欄または自動生成で入れる

対象ファイル:

- `src/lib/db.ts`
- `src/app/admin/questions/page.tsx`
- `src/app/api/surveys/[id]/questions/route.ts`

### フェーズ2: クリニック分析の固定配列依存を外す

今の最大の詰まりどころです。

やること:

1. `src/lib/questions.ts` の固定配列参照をやめる
2. 分析APIは DB の `question_templates` を読む
3. 領域集計は `analysis_group` 単位で計算
4. ギャップ分析は `compare_key` で院長質問とスタッフ質問を対応付ける
5. 離職リスクは固定 `Q7/Q15` ではなく、該当 `question_key` を設定で引く

対象ファイル:

- `src/lib/survey-analytics.ts`
- `src/app/api/surveys/[id]/scores/route.ts`
- `src/app/api/surveys/[id]/clinics/route.ts`
- `src/app/api/surveys/[id]/clinics/[name]/route.ts`
- `src/app/api/surveys/[id]/gap/route.ts`
- `src/app/api/surveys/[id]/heatmap/route.ts`
- `src/app/api/surveys/[id]/summary/route.ts`
- `src/app/api/trends/route.ts`

### フェーズ3: 時系列比較の再設計

やること:

1. サーベイ間比較を `question_key` ベースにする
2. 文言が変わっても同じ `question_key` なら同系列で表示する
3. 領域推移も `analysis_group` ベースにする

対象ファイル:

- `src/app/api/trends/route.ts`
- 時系列画面コンポーネント一式

### フェーズ4: 管理UIを「気軽に編集できる」形にする

理想の運用に近づけるフェーズです。

やること:

1. 質問追加時に `question_key` 候補を選べるようにする
2. 「前回サーベイから複製」ボタンを付ける
3. 「共通質問マスタから追加」ボタンを付ける
4. 並び替え UI を付ける
5. 変更プレビューを付ける

対象ファイル:

- `src/app/admin/questions/page.tsx`

## 管理画面の理想UI

管理者が触る画面は次の操作ができるのが理想です。

- 前回サーベイを複製
- 質問を追加
- 質問を削除
- 文言を編集
- 領域を変更
- 比較対象キーを選択
- 並び順を変える
- その質問が「前回と同じか」「新規か」を明示

例:

- `質問文`
- `短縮ラベル`
- `領域`
- `question_key`
- `compare_key`
- `回答者タイプ`
- `スキップ可否`
- `尺度`

## クリニックサーベイをどう扱うべきか

### 当面の安全運用

急ぎで運用するなら、クリニックは以下に留めるのが安全です。

- 既存15問の文言修正
- 2〜3問の追加は「補足設問」として使う
- 主分析は既存15問ベースと割り切る

### 理想運用

本当に自由編集したいなら、クリニックも事業体と同じく DB 駆動に寄せるべきです。

そのときは:

- スタッフ質問
- 院長質問
- 両者の対応関係

をすべて `question_templates` から作る設計に移します。

## 追加で決めるべきこと

実装前に次を決める必要があります。

1. `question_key` は手入力にするか、マスタ選択にするか
2. 既存サーベイの15問に付ける正式キー名
3. 離職リスクに使う設問を固定にするか、サーベイごと設定にするか
4. クリニックの追加質問を領域集計に含めるか、補足設問扱いにするか
5. 時系列で比較対象外の質問をどう表示するか

## 次回着手時のおすすめ順

時間がないときは、次の順が最もリターンが大きいです。

1. `question_templates` に `question_key` と `compare_key` を追加
2. 管理画面でそれを編集可能にする
3. ギャップ分析を `compare_key` ベースに変更
4. 時系列比較を `question_key` ベースに変更
5. その後にクリニックの固定15問依存を外す

## 次回そのまま使える依頼文

次回 Codex に再開させるときは、以下をそのまま送れば足ります。

```text
/Users/osakasoshin1/survey の docs/question-system-roadmap.md を読んで、その続きから実装してください。

目的は、質問を管理画面から自由に追加・編集・文言変更できて、新しいサーベイでも分析に自動反映されるようにすることです。
前回と意味が同じ質問は question_key などで紐づけて、時系列比較やギャップ分析にも使えるようにしてください。

まずは roadmap のフェーズ1から順に進めて、必要なら設計を微修正しつつ実装・検証・push まで行ってください。
```

もっと短くするなら、これでも通じます。

```text
/Users/osakasoshin1/survey の docs/question-system-roadmap.md の続きやって。フェーズ1から実装して。
```

## 補足

今の状態でも、質問編集画面からサーベイごとに質問文を変えること自体はできます。

ただし「自由に変えた質問が、そのまま分析全体に自然反映される」状態にはまだなっていません。

このドキュメントは、その差分を埋めるための引き継ぎメモです。
