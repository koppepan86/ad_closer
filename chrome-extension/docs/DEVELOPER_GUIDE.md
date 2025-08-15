# 広告プレビューシステム 開発者ガイド

## 目次
1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [コンポーネント詳細](#コンポーネント詳細)
3. [API リファレンス](#api-リファレンス)
4. [開発環境セットアップ](#開発環境セットアップ)
5. [ビルドとデプロイ](#ビルドとデプロイ)
6. [テスト](#テスト)
7. [デバッグとログ](#デバッグとログ)
8. [パフォーマンス最適化](#パフォーマンス最適化)
9. [セキュリティ考慮事項](#セキュリティ考慮事項)
10. [拡張とカスタマイズ](#拡張とカスタマイズ)

## アーキテクチャ概要

### システム構成
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PopupDetector │───▶│ AdPreviewCapture│───▶│ UserChoiceDialog│
│                 │    │                 │    │                 │
│ - 広告要素検出   │    │ - スクリーンショット│    │ - プレビュー表示 │
│ - 要素分析       │    │ - 画像処理       │    │ - ユーザー選択   │
│ - DOM監視        │    │ - エラーハンドリング│    │ - 一括操作       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Element Tracker │    │ Image Processor │    │ Preview Gallery │
│                 │    │                 │    │                 │
│ - 要素追跡       │    │ - WebP/PNG変換   │    │ - サムネイル表示 │
│ - 位置計算       │    │ - リサイズ       │    │ - 拡大表示       │
│ - 可視性判定     │    │ - 圧縮          │    │ - 個別選択UI     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### データフロー
```
DOM変更検出 → 要素分析 → プレビュー生成 → UI表示 → ユーザー選択 → アクション実行
     ↓           ↓           ↓           ↓           ↓           ↓
  MutationObs  PopupDet   AdPreview   PreviewGal  UserChoice   ActionProc
```

### 技術スタック
- **フロントエンド**: Vanilla JavaScript (ES2020+)
- **画像処理**: html2canvas
- **ストレージ**: Chrome Storage API
- **UI**: CSS3 + Custom Components
- **テスト**: Jest + Custom Test Framework
- **ビルド**: npm scripts

## コンポーネント詳細

### 1. AdPreviewCapture クラス

#### 概要
広告要素のスクリーンショット取得と画像処理を担当するコアコンポーネント。

#### 主要メソッド

```javascript
class AdPreviewCapture {
  constructor(options = {})
  async init()
  async captureElement(element, options = {})
  async captureMultipleElements(elements)
  processImage(canvas, options)
  generateFallbackPreview(element, reason, error)
  cleanup()
}
```

#### 設定オプション
```javascript
const options = {
  // スクリーンショット設定
  thumbnailWidth: 300,
  thumbnailHeight: 200,
  fullSizeWidth: 800,
  fullSizeHeight: 600,
  
  // 画像品質設定
  imageQuality: 0.8,
  imageFormat: 'webp',
  fallbackFormat: 'png',
  
  // パフォーマンス設定
  captureTimeout: 500,
  maxConcurrentCaptures: 3,
  targetProcessingTime: 500,
  
  // プライバシー設定
  privacyEnabled: true,
  privacyLevel: 'medium'
};
```

#### 使用例
```javascript
const adPreviewCapture = new AdPreviewCapture({
  imageQuality: 0.8,
  captureTimeout: 1000,
  debugMode: true
});

await adPreviewCapture.init();

const element = document.querySelector('.ad-element');
const previewData = await adPreviewCapture.captureElement(element);

console.log(previewData);
// {
//   id: 'unique-id',
//   screenshot: {
//     thumbnail: 'data:image/webp;base64,...',
//     fullSize: 'data:image/webp;base64,...',
//     width: 400,
//     height: 300,
//     format: 'webp'
//   },
//   elementInfo: { ... },
//   captureTime: 150
// }
```

### 2. PreviewGallery クラス

#### 概要
プレビュー画像の表示とユーザーインタラクションを管理するUIコンポーネント。

#### 主要メソッド
```javascript
class PreviewGallery {
  constructor(options = {})
  init()
  async renderPreviews(previewDataArray, container)
  showExpandedView(previewId)
  handleIndividualSelection(previewId, action)
  updateSelectionStats()
  cleanup()
}
```

#### イベントハンドラー
```javascript
const previewGallery = new PreviewGallery({
  onPreviewClick: (previewData, event) => {
    console.log('Preview clicked:', previewData.id);
  },
  onIndividualSelection: (previewId, action) => {
    console.log('Selection changed:', previewId, action);
  },
  onExpandedView: (previewData) => {
    console.log('Expanded view shown:', previewData.id);
  }
});
```

### 3. UserChoiceDialog クラス

#### 概要
ユーザー選択ダイアログの表示と管理を行うメインUIコンポーネント。

#### 主要メソッド
```javascript
class UserChoiceDialog {
  constructor()
  init()
  async showChoiceDialog(detectedAds)
  async generatePreviews(dialogId, detectedAds)
  handleUserChoice(dialogId, action)
  closeAllDialogs()
}
```

#### ダイアログライフサイクル
```javascript
// 1. ダイアログ表示
const result = await userChoiceDialog.showChoiceDialog(detectedAds);

// 2. プレビュー生成（非同期）
// 内部で AdPreviewCapture を使用

// 3. ユーザー選択待ち
// UI イベントを監視

// 4. 結果返却
console.log(result);
// {
//   action: 'individual', // 'allow', 'block', 'individual'
//   selections: {
//     'ad-1': 'block',
//     'ad-2': 'allow'
//   },
//   options: {
//     rememberChoice: true,
//     autoBlock: false
//   }
// }
```

### 4. PrivacyManager クラス

#### 概要
プライバシー保護機能を提供するユーティリティクラス。

#### 主要機能
- 機密サイト検出
- 個人情報検出とぼかし処理
- 一時的画像保存管理
- 自動削除機能

```javascript
class PrivacyManager {
  constructor(options = {})
  async applyPrivacyProtection(element, previewData)
  detectSensitiveSite(url)
  detectPersonalInfo(element)
  applyBlurEffect(imageData)
  scheduleAutoCleanup(previewData)
}
```

## API リファレンス

### AdPreviewCapture API

#### captureElement(element, options)
単一要素のスクリーンショットを取得します。

**パラメータ:**
- `element` (HTMLElement): 対象要素
- `options` (Object): オプション設定

**戻り値:**
- `Promise<PreviewData>`: プレビューデータオブジェクト

**例外:**
- `Error`: キャプチャ失敗時

#### captureMultipleElements(elements)
複数要素のスクリーンショットを並列取得します。

**パラメータ:**
- `elements` (Array<HTMLElement>): 対象要素配列

**戻り値:**
- `Promise<Array<PreviewData>>`: プレビューデータ配列

### PreviewGallery API

#### renderPreviews(previewDataArray, container)
プレビューギャラリーを描画します。

**パラメータ:**
- `previewDataArray` (Array<PreviewData>): プレビューデータ配列
- `container` (HTMLElement): 描画先コンテナ

**戻り値:**
- `Promise<HTMLElement>`: ギャラリー要素

#### handleIndividualSelection(previewId, action)
個別選択を処理します。

**パラメータ:**
- `previewId` (string): プレビューID
- `action` (string): 'allow' | 'block'

### データ構造

#### PreviewData
```typescript
interface PreviewData {
  id: string;
  element: HTMLElement;
  screenshot: {
    thumbnail: string;      // Base64エンコードされた画像
    fullSize: string;       // Base64エンコードされた画像
    width: number;          // 元の幅
    height: number;         // 元の高さ
    format: 'webp' | 'png'; // 画像形式
    thumbnailSize?: number; // サムネイルファイルサイズ
    fullSizeSize?: number;  // フルサイズファイルサイズ
    compression?: number;   // 圧縮率
  };
  elementInfo: {
    tagName: string;        // タグ名
    className: string;      // クラス名
    id: string;            // ID
    position: {x: number, y: number}; // 位置
    size: {width: number, height: number}; // サイズ
    zIndex: number;        // z-index
    type: string;          // 広告タイプ
    visibility?: {         // 可視性情報
      visible: boolean;
      inViewport: boolean;
      obscured: boolean;
    };
  };
  captureTime?: number;    // キャプチャ時間（ms）
  timestamp: number;       // タイムスタンプ
  fallback?: {            // フォールバック情報
    reason: string;        // フォールバック理由
    description: string;   // 代替説明
  };
  batchInfo?: {           // バッチ情報
    batchId: string;
    elementIndex: number;
  };
  scrollInfo?: {          // スクロール情報
    scrolled: boolean;
    scrollTime: number;
  };
}
```

## 開発環境セットアップ

### 必要な環境
- Node.js 16.0.0 以上
- npm 8.0.0 以上
- Chrome 88 以上

### セットアップ手順
```bash
# リポジトリのクローン
git clone https://github.com/your-repo/ad-preview-system.git
cd ad-preview-system

# 依存関係のインストール
npm install

# 開発用ビルド
npm run build:dev

# テストの実行
npm test

# 開発サーバーの起動（ホットリロード）
npm run dev
```

### 開発用設定
```javascript
// config/development.js
module.exports = {
  debugMode: true,
  logLevel: 'debug',
  captureTimeout: 2000,
  imageQuality: 0.6, // 開発時は低品質で高速化
  enablePerformanceMonitoring: true
};
```

### Chrome拡張機能の読み込み
1. Chrome で `chrome://extensions/` を開く
2. 「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. プロジェクトの `chrome-extension` フォルダを選択

## ビルドとデプロイ

### ビルドスクリプト
```json
{
  "scripts": {
    "build": "npm run build:prod",
    "build:dev": "webpack --mode development",
    "build:prod": "webpack --mode production",
    "build:analyze": "webpack-bundle-analyzer dist/stats.json",
    "clean": "rimraf dist",
    "lint": "eslint src/**/*.js",
    "lint:fix": "eslint src/**/*.js --fix"
  }
}
```

### 本番ビルド
```bash
# 本番用ビルド
npm run clean
npm run lint
npm run test
npm run build:prod

# パッケージ作成
npm run package
```

### デプロイメント
```bash
# Chrome ウェブストア用パッケージ
npm run package:webstore

# 手動配布用パッケージ
npm run package:manual
```

## テスト

### テスト構成
```
tests/
├── unit/                    # ユニットテスト
│   ├── ad-preview-capture.test.js
│   ├── preview-gallery.test.js
│   └── user-choice-dialog.test.js
├── integration/             # 統合テスト
│   ├── ad-preview-system-integration.test.js
│   └── end-to-end.test.js
├── performance/             # パフォーマンステスト
│   └── performance.test.js
└── helpers/                 # テストヘルパー
    └── test-helpers.js
```

### テスト実行
```bash
# 全テスト実行
npm test

# ユニットテストのみ
npm run test:unit

# 統合テストのみ
npm run test:integration

# カバレッジ付きテスト
npm run test:coverage

# ウォッチモード
npm run test:watch
```

### テスト例
```javascript
// tests/unit/ad-preview-capture.test.js
describe('AdPreviewCapture', () => {
  let adPreviewCapture;

  beforeEach(async () => {
    adPreviewCapture = new AdPreviewCapture({
      debugMode: true,
      captureTimeout: 1000
    });
    await adPreviewCapture.init();
  });

  test('should capture element screenshot', async () => {
    const mockElement = createMockElement();
    const previewData = await adPreviewCapture.captureElement(mockElement);
    
    expect(previewData).toHaveProperty('screenshot');
    expect(previewData.screenshot.thumbnail).toMatch(/^data:image/);
  });

  test('should handle capture failure gracefully', async () => {
    const invalidElement = null;
    
    await expect(
      adPreviewCapture.captureElement(invalidElement)
    ).rejects.toThrow('Invalid element provided');
  });
});
```

### モックとスタブ
```javascript
// tests/helpers/test-helpers.js
export function createMockElement(tagName = 'div', attributes = {}) {
  return {
    tagName: tagName.toUpperCase(),
    getBoundingClientRect: jest.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0
    })),
    style: attributes.style || {},
    className: attributes.className || '',
    // ... その他のプロパティ
  };
}

export function mockHtml2Canvas() {
  global.html2canvas = jest.fn(() => Promise.resolve({
    width: 400,
    height: 300,
    toDataURL: jest.fn(() => 'data:image/webp;base64,mock-data')
  }));
}
```

## デバッグとログ

### ログシステム
```javascript
// utils/logger.js
class Logger {
  constructor(component, debugMode = false) {
    this.component = component;
    this.debugMode = debugMode;
  }

  debug(message, data = {}) {
    if (this.debugMode) {
      console.log(`[${this.component}] DEBUG:`, message, data);
    }
  }

  info(message, data = {}) {
    console.log(`[${this.component}] INFO:`, message, data);
  }

  warn(message, data = {}) {
    console.warn(`[${this.component}] WARN:`, message, data);
  }

  error(message, data = {}) {
    console.error(`[${this.component}] ERROR:`, message, data);
  }
}
```

### デバッグ機能
```javascript
// デバッグモードの有効化
const adPreviewCapture = new AdPreviewCapture({
  debugMode: true,
  logLevel: 'debug'
});

// パフォーマンス監視
adPreviewCapture.enablePerformanceMonitoring();

// メモリ使用量監視
adPreviewCapture.startMemoryMonitoring();
```

### Chrome DevTools での確認
```javascript
// コンソールでの確認
// 1. F12 で開発者ツールを開く
// 2. Console タブを選択
// 3. フィルタで "AdPreview" を検索

// パフォーマンス統計の確認
console.log(adPreviewCapture.getPerformanceStats());

// メモリ使用量の確認
console.log(adPreviewCapture.getMemoryUsage());

// キャッシュ状態の確認
console.log(adPreviewCapture.getCacheStats());
```

## パフォーマンス最適化

### 画像処理最適化
```javascript
// 品質とサイズのバランス調整
const optimizedOptions = {
  imageQuality: 0.8,        // 品質80%
  thumbnailWidth: 300,      // サムネイル幅
  thumbnailHeight: 200,     // サムネイル高さ
  maxConcurrentCaptures: 3, // 並列処理数制限
  captureTimeout: 500       // タイムアウト設定
};

// WebP対応確認と自動フォールバック
if (adPreviewCapture.webpSupported) {
  options.imageFormat = 'webp';
} else {
  options.imageFormat = 'png';
}
```

### メモリ管理
```javascript
// 自動クリーンアップの設定
adPreviewCapture.setupAutoCleanup({
  memoryThreshold: 50 * 1024 * 1024, // 50MB
  cleanupInterval: 300000,            // 5分間隔
  maxCacheSize: 100                   // 最大キャッシュ数
});

// 手動クリーンアップ
adPreviewCapture.cleanup();
previewGallery.cleanup();
```

### 遅延読み込み
```javascript
// 遅延読み込みの有効化
const previewGallery = new PreviewGallery({
  lazyLoadingEnabled: true,
  intersectionThreshold: 0.1,
  rootMargin: '50px'
});
```

### パフォーマンス監視
```javascript
// パフォーマンス統計の取得
const stats = adPreviewCapture.getPerformanceStats();
console.log('Performance Stats:', {
  averageProcessingTime: stats.averageProcessingTime,
  cacheHitRate: stats.cacheHitRate,
  memoryUsage: stats.memoryUsage,
  optimizationEvents: stats.optimizationEvents
});
```

## セキュリティ考慮事項

### Content Security Policy
```json
// manifest.json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### 入力検証
```javascript
// 要素の検証
function validateElement(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    throw new Error('Invalid element provided');
  }
  
  // XSS攻撃の防止
  if (element.innerHTML.includes('<script>')) {
    throw new Error('Potentially malicious element detected');
  }
  
  return true;
}

// URL の検証
function validateURL(url) {
  try {
    const parsedURL = new URL(url);
    
    // 危険なプロトコルの拒否
    if (!['http:', 'https:'].includes(parsedURL.protocol)) {
      throw new Error('Invalid protocol');
    }
    
    return true;
  } catch (error) {
    throw new Error('Invalid URL provided');
  }
}
```

### 権限の最小化
```json
// manifest.json - 必要最小限の権限のみ
{
  "permissions": [
    "activeTab",      // 現在のタブのみ
    "storage",        // ローカルストレージ
    "notifications"   // 通知表示
  ]
}
```

### データサニタイゼーション
```javascript
// HTMLのサニタイゼーション
function sanitizeHTML(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

// 画像データの検証
function validateImageData(dataURL) {
  const validFormats = ['data:image/webp', 'data:image/png', 'data:image/jpeg'];
  
  if (!validFormats.some(format => dataURL.startsWith(format))) {
    throw new Error('Invalid image format');
  }
  
  // サイズ制限（10MB）
  if (dataURL.length > 10 * 1024 * 1024) {
    throw new Error('Image too large');
  }
  
  return true;
}
```

## 拡張とカスタマイズ

### カスタムプレビュープロセッサー
```javascript
// カスタム画像処理の追加
class CustomImageProcessor {
  constructor(options = {}) {
    this.options = options;
  }

  async processImage(canvas, options) {
    // カスタム処理ロジック
    const ctx = canvas.getContext('2d');
    
    // フィルター適用
    if (options.applyFilter) {
      this.applyImageFilter(ctx, options.filter);
    }
    
    // ウォーターマーク追加
    if (options.addWatermark) {
      this.addWatermark(ctx, options.watermark);
    }
    
    return canvas;
  }

  applyImageFilter(ctx, filter) {
    // フィルター処理の実装
  }

  addWatermark(ctx, watermark) {
    // ウォーターマーク追加の実装
  }
}

// カスタムプロセッサーの使用
const adPreviewCapture = new AdPreviewCapture({
  customImageProcessor: new CustomImageProcessor({
    applyFilter: true,
    filter: 'blur(2px)'
  })
});
```

### カスタムUI テーマ
```javascript
// カスタムテーマの定義
const customTheme = {
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
    success: '#28a745',
    danger: '#dc3545',
    background: '#ffffff',
    surface: '#f8f9fa'
  },
  fonts: {
    primary: 'Arial, sans-serif',
    monospace: 'Consolas, monospace'
  },
  spacing: {
    small: '8px',
    medium: '16px',
    large: '24px'
  }
};

// テーマの適用
const previewGallery = new PreviewGallery({
  theme: customTheme,
  customCSS: `
    .preview-item {
      border-radius: 12px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
  `
});
```

### プラグインシステム
```javascript
// プラグインインターフェース
class PreviewPlugin {
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
  }

  // プラグインの初期化
  init(adPreviewCapture) {
    this.adPreviewCapture = adPreviewCapture;
  }

  // プレビュー生成前の処理
  beforeCapture(element, options) {
    // 前処理ロジック
  }

  // プレビュー生成後の処理
  afterCapture(previewData) {
    // 後処理ロジック
  }

  // クリーンアップ
  cleanup() {
    // リソースの解放
  }
}

// プラグインの使用例
class WatermarkPlugin extends PreviewPlugin {
  afterCapture(previewData) {
    // ウォーターマークを追加
    previewData.screenshot.thumbnail = this.addWatermark(
      previewData.screenshot.thumbnail
    );
  }

  addWatermark(imageData) {
    // ウォーターマーク追加ロジック
    return imageData;
  }
}

// プラグインの登録
const adPreviewCapture = new AdPreviewCapture();
adPreviewCapture.registerPlugin(new WatermarkPlugin('watermark', {
  text: 'Preview',
  position: 'bottom-right'
}));
```

### イベントシステム
```javascript
// カスタムイベントの定義
class PreviewEventEmitter extends EventTarget {
  emit(eventName, data) {
    this.dispatchEvent(new CustomEvent(eventName, { detail: data }));
  }

  on(eventName, callback) {
    this.addEventListener(eventName, callback);
  }

  off(eventName, callback) {
    this.removeEventListener(eventName, callback);
  }
}

// イベントの使用例
const eventEmitter = new PreviewEventEmitter();

// イベントリスナーの登録
eventEmitter.on('previewGenerated', (event) => {
  console.log('Preview generated:', event.detail);
});

eventEmitter.on('userSelection', (event) => {
  console.log('User selection:', event.detail);
});

// イベントの発火
eventEmitter.emit('previewGenerated', {
  previewId: 'ad-1',
  captureTime: 150
});
```

---

## 貢献ガイドライン

### コードスタイル
- ESLint設定に従う
- Prettier でフォーマット
- JSDoc でドキュメント化

### プルリクエスト
1. フィーチャーブランチを作成
2. テストを追加
3. ドキュメントを更新
4. プルリクエストを作成

### 問題報告
GitHub Issues を使用して問題を報告してください。

---

**バージョン**: 1.0.0  
**最終更新**: 2024年8月  
**ライセンス**: MIT License