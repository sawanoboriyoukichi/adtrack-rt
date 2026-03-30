# adtrack-rt セットアップ手順

## 概要

Supabase データベースを使用した広告効果測定ダッシュボード。リアルタイムでセッション・イベント・コンバージョンデータを追跡・分析します。

**機能:**
- セッション数・コンバージョン数・直帰率の分析
- UTM パラメータ別（ソース/メディア/キャンペーン/用語/コンテンツ）の分類
- マイクロコンバージョン（CV）選択と複数イベント追跡
- 期間別・時間別レポート
- CSV データエクスポート

## 1. 前提条件

- Node.js 18 以上
- Supabase アカウント（https://supabase.com）
- データベーステーブルの初期化済み

## 2. Supabase テーブル構造

以下のテーブルが必要です:

### `sessions` テーブル
```sql
CREATE TABLE sessions (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  visitor_id TEXT,
  site_id TEXT DEFAULT 'default',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  referrer TEXT,
  landing_page TEXT,
  user_agent TEXT,
  ip_address TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  is_bounce BOOLEAN DEFAULT FALSE,
  page_count INTEGER DEFAULT 1,
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP DEFAULT NOW()
);
```

### `pageviews` テーブル
```sql
CREATE TABLE pageviews (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  visitor_id TEXT,
  site_id TEXT DEFAULT 'default',
  page_url TEXT,
  page_title TEXT,
  referrer TEXT,
  viewed_at TIMESTAMP DEFAULT NOW()
);
```

### `events` テーブル
```sql
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  visitor_id TEXT,
  site_id TEXT DEFAULT 'default',
  event_name TEXT,
  event_category TEXT,
  event_label TEXT,
  event_value NUMERIC,
  page_url TEXT,
  metadata JSONB,
  occurred_at TIMESTAMP DEFAULT NOW()
);
```

## 3. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成:

```bash
cp .env.local.example .env.local
```

`.env.local` を開いて以下を設定:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**キーの取得方法:**
1. Supabase ダッシュボードにログイン
2. プロジェクトを選択
3. Settings > API から `URL` と キーを取得

## 4. インストールと起動

```bash
# プロジェクトフォルダに移動
cd adtrack-rt

# パッケージインストール
npm install

# デモデータの初期化
curl -X POST http://localhost:3000/api/seed-demo-data \
  -H "x-seed-secret: demo-seed-secret-12345" \
  -H "Content-Type: application/json"

# 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## 5. 本番ビルド（オプション）

```bash
npm run build
npm run start
```

## 6. ファイル構成

```
adtrack-rt/
├── pages/
│   ├── index.js ← リダイレクト
│   ├── _app.js ← アプリケーションルート
│   └── report/
│       ├── direct.js ← 直接効果レポート
│       ├── period.js ← 期間別レポート
│       ├── hourly.js ← 時間別レポート
│       └── params.js ← パラメーター別レポート
├── pages/api/
│   ├── report.js ← データ取得 API
│   ├── track.js ← トラッキング記録 API
│   ├── event.js ← イベント記録 API
│   └── seed-demo-data.js ← デモデータシーダー
├── components/
│   ├── Layout.js ← ヘッダー・ナビゲーション
│   └── DateRangePicker.js ← 日付範囲選択
├── lib/
│   ├── supabase.js ← Supabase クライアント
│   ├── botFilter.js ← ボット判定
│   └── parseDevice.js ← デバイス判定
└── .env.local ← 環境変数（要作成）
```

## 7. API エンドポイント

### GET /api/report

レポートデータを取得します。

**パラメータ:**
- `type` - レポートタイプ: `direct`, `period`, `hourly`, `params`, `event_names`
- `site_id` - サイト ID（デフォルト: `default`）
- `from` - 開始日（YYYY-MM-DD）
- `to` - 終了日（YYYY-MM-DD）
- `events` - イベント名（カンマ区切り）
- `utm_source` - UTM ソースフィルター
- `utm_medium` - UTM メディアフィルター
- `search` - テキスト検索
- `dimension` - パラメーター別レポートの集計ディメンション

**例:**
```bash
curl "http://localhost:3000/api/report?type=direct&from=2026-03-01&to=2026-03-30&events=scroll_10_percent,LINE登録"
```

### POST /api/track

セッション・ページビューデータを記録します。

### POST /api/event

イベントデータを記録します。

### POST /api/seed-demo-data

デモデータを Supabase に挿入します（開発用）。

## 8. デモデータの生成

デモデータで UI をテストできます:

```bash
curl -X POST http://localhost:3000/api/seed-demo-data \
  -H "x-seed-secret: demo-seed-secret-12345"
```

または localhost の場合は認証不要:

```bash
curl -X POST http://localhost:3000/api/seed-demo-data
```

## 9. トラッキングコード

ウェブサイトに以下のコードを追加してセッションをトラッキング:

```html
<script>
  // セッション ID 生成
  const sessionId = 'session_' + Math.random().toString(36).substr(2, 12);

  // ページビュー記録
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      page: window.location.pathname,
      title: document.title,
      referrer: document.referrer
    })
  });

  // CV イベント記録
  function trackEvent(eventName, label) {
    fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        eventName,
        eventLabel: label,
        page: window.location.pathname
      })
    });
  }

  // 使用例
  // trackEvent('LINE登録', 'form_submit');
</script>
```

## 10. トラブルシューティング

| エラー | 対処法 |
|--------|--------|
| Supabase connection failed | `.env.local` の URL とキーが正しいか確認 |
| Permission denied | Service Role Key を使用しているか確認（API Routes用） |
| No data showing | `POST /api/seed-demo-data` を実行してデモデータを生成 |
| CORS errors | Supabase のセキュリティ設定を確認 |

## 11. 本番環境への デプロイ

### Vercel へのデプロイ

1. GitHub にプッシュ
2. Vercel を GitHub リポジトリに接続
3. 環境変数を設定:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. デプロイ実行

### 環境変数の設定

Vercel ダッシュボード > プロジェクト > Settings > Environment Variables から設定してください。

---

**サポート**: 問題が発生した場合は GitHub Issues を作成してください。
