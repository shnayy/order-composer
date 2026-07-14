# ORDER LINE

待機時間と効果時間を持つ「オーダー」を並べ、15分間の実行順と残り時間を組み立てるモバイル向けWebアプリです。

## できること

- カテゴリで絞り込んだオーダーをタップで追加
- タッチ／マウスのドラッグ操作で上下に並べ替え
- キーボードの上下矢印でも並べ替え
- オーダー削除、残り時間、15分超過を即時表示
- 次の待機時間・効果時間への補正と、指定時刻での効果終了に対応
- Google Sheetsの公開CSVをオーダーDBとして読込

画面2のオーダー管理機能は次のフェーズで実装予定です。

## スプレッドシートの列

1行目を次の列名にしてください。`public/orders.sample.csv`をそのままGoogle Sheetsへ読み込むと簡単です。

| 列 | 内容 |
| --- | --- |
| `id` | 重複しない英数字ID |
| `name` | オーダー名 |
| `category` | カテゴリ |
| `waitSeconds` | 待機時間（秒） |
| `effectSeconds` | 効果時間（秒） |
| `icon` | 画像枠に表示する1〜2文字 |
| `color` | `#55e6d2`形式の色 |
| `modifierType` | 下記の補正タイプ |
| `modifierValue` | 補正値 |
| `description` | 説明 |

補正タイプは `none`、`next_wait_multiplier`、`next_effect_multiplier`、`next_wait_reduction`、`effect_end_at` に対応しています。`effect_end_at` の値はタイムライン開始からの秒数です。

Google Sheetsで「ファイル → 共有 → ウェブに公開」からCSVを公開し、そのURLを `.env.local` の `NEXT_PUBLIC_ORDERS_CSV_URL` に設定してください。書式は `.env.example` を参照してください。

## ローカル実行

Node.js 22とpnpmを使います。

```bash
pnpm install
pnpm dev
```

## GitHub Pagesで公開

1. このフォルダをGitHubリポジトリの `main` ブランチへpushします。
2. リポジトリの Settings → Pages → Source で「GitHub Actions」を選びます。
3. 以後は `main` へのpushごとに `.github/workflows/deploy-pages.yml` が自動公開します。

Google Sheetsを使う場合は、GitHubの Settings → Secrets and variables → Actions → Variables に `NEXT_PUBLIC_ORDERS_CSV_URL` を追加し、ワークフローのbuild環境へ渡してください。
