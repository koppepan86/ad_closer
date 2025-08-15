# Chrome ポップアップ広告ブロッカー拡張機能

インテリジェントなポップアップ広告検出とユーザー制御によるブロック機能を提供するChrome拡張機能です。

## 主な機能

- **インテリジェントなポップアップ検出**: 広告と正当なコンテンツを区別
- **学習機能**: ユーザーの決定を記憶し、次回から自動適用
- **統計表示**: ブロックしたポップアップの統計
- **カスタマイズ可能な設定**: ホワイトリスト、検出感度の調整
- **パフォーマンス最適化**: メモリ使用量とCPU使用率を最小限に抑制
- **セキュリティ強化**: 継続的なセキュリティ監視と検証
- **包括的なヘルプシステム**: インアプリヘルプとドキュメント

## 環境要件

### 必須環境
- **Node.js**: 16.0.0 以上（推奨: 18.x LTS）
- **npm**: 8.0.0 以上
- **Google Chrome**: 88 以上（Manifest V3サポート）
- **TypeScript**: 4.5.0 以上

### 環境確認
```bash
node --version  # v18.x.x
npm --version   # 8.x.x
```

## セットアップ

### 1. 依存関係のインストール
```bash
npm install
```

### 2. TypeScriptビルド
```bash
# 一回ビルド
npm run build

# ウォッチモード（開発時推奨）
npm run build:watch
```

### 3. Chrome拡張機能の読み込み
1. Chrome で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. このプロジェクトの `chrome-extension/` フォルダを選択

## 開発コマンド

### ビルド
```bash
npm run build          # 本番ビルド
npm run build:watch    # 開発用ウォッチモード
npm run clean          # ビルドファイル削除
```

### テスト
```bash
npm test                    # 基本テスト実行
npm run test:jest          # Jestユニットテスト
npm run test:integration   # 統合テスト
npm run test:ui-components # UIテスト
npm run test:all          # 全テスト実行
npm run test:final-qa     # 最終品質保証テスト
npm run test:coverage     # カバレッジ付きテスト
```

### 最適化とセキュリティ
```bash
npm run optimize          # パフォーマンス最適化
npm run security:audit    # セキュリティ監査
npm run security:validate # セキュリティ検証
```

### リリース準備
```bash
npm run release:prepare   # リリース準備（テスト、監査、ドキュメント）
npm run release:build     # リリースビルド
```

### コード品質
```bash
npm run lint           # ESLintチェック
npm run lint:fix       # ESLint自動修正
```

### パッケージング
```bash
npm run package        # Chrome Web Store用zipファイル作成
```

## プロジェクト構造

```
chrome-extension/
├── manifest.json           # 拡張機能設定
├── background/
│   └── service-worker.js   # バックグラウンドワーカー
├── content/
│   └── content-script.js   # コンテンツスクリプト
├── popup/
│   ├── popup.html         # ポップアップUI
│   ├── popup.js           # ポップアップロジック
│   └── popup.css          # スタイル
├── options/
│   ├── options.html       # 設定ページ
│   ├── options.js         # 設定ロジック
│   └── options.css        # 設定スタイル
├── utils/
│   ├── performance-monitor.js    # パフォーマンス監視
│   ├── performance-optimizer.js  # パフォーマンス最適化
│   ├── security-validator.js     # セキュリティ検証
│   ├── help-system.js           # ヘルプシステム
│   └── logger.js               # ログシステム
├── types/
│   └── interfaces.ts      # TypeScript型定義
├── tests/
│   ├── final-qa-suite.js  # 最終品質保証テスト
│   └── ...               # 各種テストファイル
├── docs/
│   ├── USER_GUIDE.md      # ユーザーガイド
│   ├── INSTALLATION_GUIDE.md # インストールガイド
│   ├── FAQ.md             # よくある質問
│   └── SECURITY_AUDIT.md  # セキュリティ監査レポート
└── icons/                 # アイコンファイル
```

## 開発ワークフロー

### 1. 開発開始
```bash
# ウォッチモードでビルド開始
npm run build:watch

# 別ターミナルでテスト監視
npm run test:watch
```

### 2. コード変更
- TypeScriptファイルを編集
- 自動的にビルドされる
- Chromeで拡張機能をリロード（拡張機能ページで更新ボタン）

### 3. テスト
```bash
# 全テスト実行
npm test

# 特定のテストファイル
npm test -- background/service-worker.test.js
```

### 4. デバッグ
- Chrome DevTools を使用
- `chrome://extensions/` でエラーログ確認
- バックグラウンドページの「検証」リンクをクリック

## トラブルシューティング

### よくある問題

1. **拡張機能が読み込まれない**
   - manifest.jsonの構文エラーを確認
   - 必要なファイルが存在するか確認

2. **TypeScriptエラー**
   - `npm run build` でエラー詳細を確認
   - tsconfig.jsonの設定を確認

3. **権限エラー**
   - manifest.jsonの permissions を確認
   - Chrome拡張機能ページでエラーログを確認

### デバッグ方法

1. **コンテンツスクリプト**: ウェブページのDevToolsでデバッグ
2. **バックグラウンドワーカー**: 拡張機能ページの「検証」からDevTools
3. **ポップアップ**: ポップアップを右クリック→「検証」

## 貢献

1. 機能追加や修正を行う
2. テストを追加・更新
3. `npm run lint` でコード品質をチェック
4. `npm test` で全テストが通ることを確認

## ライセンス

MIT License