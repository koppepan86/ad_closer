# 広告プレビューシステム設計書

## 概要

広告検出時にユーザー選択ダイアログで検出された広告要素の画像プレビューを表示するシステムの設計。

## アーキテクチャ

### システム構成図

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PopupDetector │───▶│ AdPreviewCapture│───▶│ UserChoiceDialog│
│                 │    │                 │    │                 │
│ - 広告要素検出   │    │ - スクリーンショット│    │ - プレビュー表示 │
│ - 要素情報収集   │    │ - 画像処理       │    │ - ユーザー選択   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Element Tracker │    │ Image Processor │    │ Preview Gallery │
│                 │    │                 │    │                 │
│ - 要素追跡       │    │ - リサイズ       │    │ - サムネイル表示 │
│ - 位置計算       │    │ - 圧縮          │    │ - 拡大表示       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## コンポーネント設計

### 1. AdPreviewCapture クラス

#### 責任
- 広告要素のスクリーンショット取得
- 画像の前処理とリサイズ
- エラーハンドリング

#### 主要メソッド
```javascript
class AdPreviewCapture {
  async captureElement(element, options = {})
  async captureMultipleElements(elements)
  processImage(imageData, options)
  generateFallbackPreview(element)
}
```

#### 技術仕様
- **スクリーンショット方式**: html2canvas ライブラリを使用
- **画像形式**: WebP（サポートされていない場合はPNG）
- **最大サイズ**: 300x200px（サムネイル）、800x600px（拡大表示）
- **圧縮率**: 品質80%

### 2. PreviewGallery クラス

#### 責任
- プレビュー画像の表示管理
- サムネイル/拡大表示の切り替え
- 個別選択機能

#### 主要メソッド
```javascript
class PreviewGallery {
  renderPreviews(previewData)
  showExpandedView(previewId)
  handleIndividualSelection(previewId, action)
  cleanup()
}
```

### 3. UserChoiceDialog 拡張

#### 新機能
- プレビューギャラリーの統合
- 個別選択UI
- 一括操作ボタン

## データ構造

### PreviewData 構造
```javascript
{
  id: string,                    // ユニークID
  element: HTMLElement,          // 対象要素
  screenshot: {
    thumbnail: string,           // Base64エンコードされたサムネイル
    fullSize: string,           // Base64エンコードされた拡大画像
    width: number,              // 元の幅
    height: number,             // 元の高さ
    format: 'webp' | 'png'      // 画像形式
  },
  elementInfo: {
    tagName: string,            // タグ名
    className: string,          // クラス名
    id: string,                 // ID
    position: {x: number, y: number}, // 位置
    size: {width: number, height: number}, // サイズ
    zIndex: number,             // z-index
    type: string                // 広告タイプ
  },
  fallback: {
    reason: string,             // フォールバック理由
    description: string         // 代替説明
  }
}
```

## UI設計

### プレビューギャラリーレイアウト

```
┌─────────────────────────────────────────────────────────┐
│ 広告を検出 (3個)                                    × │
├─────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│ │[Preview]│ │[Preview]│ │[Preview]│                    │
│ │  Image  │ │  Image  │ │  Image  │                    │
│ │ 300x200 │ │ 300x200 │ │ 300x200 │                    │
│ └─────────┘ └─────────┘ └─────────┘                    │
│ Overlay Ad   Banner Ad   Popup Ad                      │
│ 320x240px    728x90px    400x300px                     │
│                                                         │
│ ☐ このサイトで記憶  ☐ 今後自動ブロック                │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 個別選択:                                           │ │
│ │ [ブロック] [許可] [ブロック] [許可] [ブロック] [許可] │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [すべて許可] [設定] [すべてブロック]                    │
└─────────────────────────────────────────────────────────┘
```

### 拡大表示モーダル

```
┌─────────────────────────────────────────────────────────┐
│                    広告プレビュー                    × │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              ┌─────────────────────┐                    │
│              │                     │                    │
│              │    拡大画像表示      │                    │
│              │    800x600px       │                    │
│              │                     │                    │
│              └─────────────────────┘                    │
│                                                         │
│ タイプ: オーバーレイ広告                                │
│ サイズ: 320x240px                                       │
│ 位置: (150, 200)                                        │
│ クラス: .popup-overlay .ad-container                    │
│                                                         │
│              [ブロック] [許可]                          │
└─────────────────────────────────────────────────────────┘
```

## パフォーマンス最適化

### 1. 非同期処理
```javascript
// 並列スクリーンショット取得
const previews = await Promise.allSettled(
  elements.map(element => this.captureElement(element))
);
```

### 2. 画像圧縮
```javascript
// WebP形式での圧縮
const compressedImage = canvas.toDataURL('image/webp', 0.8);
```

### 3. メモリ管理
```javascript
// 自動クリーンアップ
setTimeout(() => {
  this.clearPreviewCache();
}, 300000); // 5分後
```

### 4. 遅延読み込み
```javascript
// 必要時のみ拡大画像を生成
async expandPreview(previewId) {
  if (!this.fullSizeCache[previewId]) {
    this.fullSizeCache[previewId] = await this.generateFullSize(previewId);
  }
}
```

## セキュリティ考慮事項

### 1. プライバシー保護
- 画像は一時的にのみメモリに保存
- ダイアログ閉じ時に即座に削除
- 機密サイトでの無効化

### 2. Content Security Policy 対応
- インライン画像のBase64エンコード使用
- 外部リソースへの依存を最小化

### 3. 権限管理
- 必要最小限の権限のみ使用
- ユーザーの明示的な同意

## エラーハンドリング

### 1. スクリーンショット失敗時
```javascript
try {
  const screenshot = await html2canvas(element);
  return this.processScreenshot(screenshot);
} catch (error) {
  console.warn('Screenshot failed:', error);
  return this.generateFallbackPreview(element);
}
```

### 2. フォールバック表示
```javascript
generateFallbackPreview(element) {
  return {
    type: 'fallback',
    content: `
      <div class="fallback-preview">
        <div class="element-icon">📄</div>
        <div class="element-info">
          <div>タグ: ${element.tagName}</div>
          <div>サイズ: ${element.offsetWidth}x${element.offsetHeight}</div>
          <div>クラス: ${element.className}</div>
        </div>
      </div>
    `
  };
}
```

## テスト戦略

### 1. ユニットテスト
- AdPreviewCapture クラスの各メソッド
- 画像処理機能
- エラーハンドリング

### 2. 統合テスト
- PopupDetector との連携
- UserChoiceDialog との統合
- パフォーマンステスト

### 3. E2Eテスト
- 実際のWebサイトでの動作確認
- 様々な広告タイプでのテスト
- ブラウザ互換性テスト

## 実装フェーズ

### フェーズ1: 基本機能
1. AdPreviewCapture クラスの実装
2. 基本的なスクリーンショット機能
3. UserChoiceDialog への統合

### フェーズ2: UI改善
1. PreviewGallery の実装
2. サムネイル表示機能
3. 拡大表示モーダル

### フェーズ3: 最適化
1. パフォーマンス最適化
2. メモリ管理改善
3. エラーハンドリング強化

### フェーズ4: 高度な機能
1. 個別選択機能
2. 一括操作機能
3. プライバシー保護機能