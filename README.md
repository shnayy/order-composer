# ORDER LINE

15分間のオーダーを並べるモバイル向けタイムラインです。画面1はオーダー選択と並べ替え、画面2はGoogle SheetsをDBにした追加・編集・削除と画像アップロードに対応しています。

## 作成済みの保存先

- オーダーDB: https://docs.google.com/spreadsheets/d/1D2VTd1wVTTUVFm2oUoWbKQaiTjLGqksJdGiF584TKkk/edit
- 画像フォルダ: https://drive.google.com/drive/folders/1UKcbxOA2LZZ7YiUqNIQAvJzCXZPSM-9M

スプレッドシートの列は `orderId`、`imageFileName`、`name`、`waitSeconds`、`effectSeconds`、`categoryId` です。画像はDriveの専用フォルダへ `[orderId].拡張子` の名前で保存されます。

## Google Apps Scriptの接続

1. 上記スプレッドシートで「拡張機能 → Apps Script」を開きます。
2. `integrations/google-apps-script/Code.gs` の内容を貼り付けて保存します。スプレッドシートIDと画像フォルダIDは設定済みです。
3. 「デプロイ → 新しいデプロイ → ウェブアプリ」を選び、実行ユーザーを自分、アクセスできるユーザーをサイト利用者に合わせて設定します。
4. 発行された `/exec` URLを `.env.local` の `NEXT_PUBLIC_ORDERS_API_URL` に設定します。

接続前は管理画面がプレビューモードになり、変更は再読み込みで元に戻ります。

## カテゴリID

| 表示 | categoryId |
| --- | --- |
| 属性 | `attribute` |
| 発動率 | `activation` |
| MP | `mp` |
| 盾 | `shield` |
| その他 | `other` |

「待機」は画面1で生成される10秒・20秒・30秒・任意秒数の専用項目なので、DBの「全部」には含まれません。

## ローカル実行

```bash
pnpm install
pnpm dev
```

## GitHub Pages

リポジトリの Settings → Pages → Source で「GitHub Actions」を選択してください。Actions Variablesへ `NEXT_PUBLIC_ORDERS_API_URL` を登録すると管理画面がスプレッドシートへ接続されます。
