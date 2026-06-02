# Event Q&A App

Slido風のリアルタイムQ&Aアプリ。ウェビナー・イベントでの質問回収に使用する。

## 機能

- **参加者**: ルームコード/QRで参加 → 匿名または名前/会社名で質問投稿 → 他の質問にいいね
- **登壇者**: イベント作成・管理、承認フロー、CSV出力、Slack通知
- **複数イベント対応**: ルームコードで分離
- **リアルタイム同期**: Firebase Realtime Database

## セットアップ

### 1. Firebase プロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成
2. **Realtime Database** を有効化（「テストモード」で開始）
3. プロジェクト設定 > アプリ設定 から設定値を取得

### 2. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local` にFirebaseの設定値とホストパスワードを入力する。

### 3. Firebaseセキュリティルール（推奨）

Firebase Console > Realtime Database > ルール:

```json
{
  "rules": {
    "rooms": {
      ".read": true,
      ".write": true
    },
    "questions": {
      ".read": true,
      ".write": true
    }
  }
}
```

本番環境ではより厳密なルールを設定すること。

### 4. Slack通知のCORS設定

ブラウザから直接Slack Incoming WebhookへPOSTする場合、CORSエラーが発生することがある。その場合は以下のいずれかを選択:

- **Firebase Cloud Functions** でプロキシを設置する（推奨）
- Vercel/Netlify の **API Routes** を使う

## 起動

```bash
npm install
npm run dev
```

## デプロイ

```bash
npm run build
# dist/ をFirebase Hosting / Vercel / Netlify にデプロイ
```

## 画面構成

| URL | 説明 |
|-----|------|
| `/` | 参加者トップ（ルームコード入力） |
| `/room/:code` | 参加者Q&A画面 |
| `/host` | 登壇者ログイン |
| `/host/dashboard` | イベント一覧・作成 |
| `/host/room/:roomId` | 質問管理・承認・エクスポート |

## イベント設定項目

| 設定 | 説明 |
|------|------|
| 投稿者情報 | 匿名のみ / 名前 / 会社名 / 会社名+名前 |
| 承認制 | ONにすると登壇者が承認した質問のみ公開表示 |
| Slack Webhook URL | 承認時に指定チャンネルへ自動投稿 |
