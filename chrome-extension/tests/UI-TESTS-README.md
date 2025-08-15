# UIコンポーネントテスト - 分割構造

## 概要

Task 9.1.5のUIコンポーネントテストは、テスト実行結果のサイズを管理しやすくするため、以下の4つのファイルに分割されています。

## テストファイル構造

### 1. popup-ui.test.js
**ポップアップインターフェースのテスト**
- 拡張機能ポップアップUIの初期化
- トグルスイッチの動作
- 統計表示の更新
- ホワイトリスト機能
- 設定ページへのナビゲーション
- エラーハンドリング

### 2. options-ui.test.js
**設定ページのインタラクションテスト**
- 設定UIの初期化と表示
- 各種設定値の保存・読み込み
- ホワイトリストドメインの管理
- 設定のエクスポート・インポート
- 設定のリセット機能
- ドメイン形式の検証

### 3. notification-ui.test.js
**通知システムのUIテスト**
- 通知システムの初期化
- 通知の表示・削除
- ユーザー決定の処理
- 自動削除タイマー
- 重複通知の防止
- テキストのサニタイズ

### 4. accessibility.test.js
**アクセシビリティ機能のテスト**
- キーボードナビゲーション
- ARIAラベルの自動追加
- フォーカス管理
- スクリーンリーダー対応
- 高コントラストモード検出
- フォーカスインジケーターの強化

## テスト実行方法

### 全UIテストの実行
```bash
npm run test:ui-components
# または
node tests/run-ui-tests.js --all
```

### 個別テストの実行
```bash
# ポップアップUIテスト
npm run test:ui-components:popup

# 設定ページテスト
npm run test:ui-components:options

# 通知システムテスト
npm run test:ui-components:notification

# アクセシビリティテスト
npm run test:ui-components:accessibility
```

### 特定のテストファイルを直接実行
```bash
npx jest tests/popup-ui.test.js --verbose
npx jest tests/options-ui.test.js --verbose
npx jest tests/notification-ui.test.js --verbose
npx jest tests/accessibility.test.js --verbose
```

## テスト実行スクリプトの使用

`run-ui-tests.js`スクリプトは以下のオプションをサポートします：

```bash
# すべてのUIテストを実行
node tests/run-ui-tests.js --all

# 特定のテストのみ実行
node tests/run-ui-tests.js --test popup
node tests/run-ui-tests.js --test accessibility

# 利用可能なテスト一覧を表示
node tests/run-ui-tests.js --list

# ヘルプを表示
node tests/run-ui-tests.js --help
```

## 分割の利点

1. **実行結果のサイズ管理**: 各テストファイルが小さくなり、実行結果が管理しやすくなりました
2. **並列実行**: 個別のテストファイルを並列で実行できます
3. **デバッグの容易さ**: 特定の機能のテストのみを実行してデバッグできます
4. **保守性の向上**: 各UIコンポーネントのテストが独立しており、保守しやすくなりました
5. **CI/CD対応**: 継続的インテグレーションでの実行時間を最適化できます

## テストヘルパー

すべてのテストファイルは共通の`test-helpers.js`を使用しており、以下の機能を提供します：

- `createMockElement()`: モックDOM要素の作成
- `createMockUserPreferences()`: モックユーザー設定の作成
- `createChromeApiMock()`: Chrome API のモック
- `resetTestData()`: テストデータのリセット
- `TimerHelpers`: タイマー関連のヘルパー

## 今後の拡張

新しいUIコンポーネントが追加された場合は、対応するテストファイルを作成し、`run-ui-tests.js`の`testFiles`配列に追加してください。

## トラブルシューティング

### テスト実行時のエラー
- Node.jsのバージョンが16以上であることを確認
- `npm install`で依存関係をインストール
- `npm run clean`でビルドキャッシュをクリア

### モックの問題
- `test-helpers.js`のモック実装を確認
- Chrome APIのモックが正しく設定されているか確認

### パフォーマンスの問題
- 個別のテストファイルを実行して問題を特定
- `--verbose`オプションで詳細な実行情報を確認