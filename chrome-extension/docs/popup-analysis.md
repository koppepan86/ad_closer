# ポップアップ特性分析システム

## 概要

このドキュメントは、Chrome拡張機能のポップアップ特性分析システム（task 3.1）の実装について説明します。このシステムは、ウェブページ上の要素を詳細に分析し、それがポップアップ広告である可能性を評価します。

## 主要機能

### 1. analyzePopup() 関数

メイン分析関数で、要素の包括的な特性分析を実行します。

```javascript
analyzePopup(element) {
    // 詳細な特性分析
    const characteristics = this.analyzePopupCharacteristics(element);
    
    // 信頼度スコアを計算
    const confidence = this.calculatePopupConfidence(element, characteristics);
    
    return {
        id: string,              // 一意のポップアップ識別子
        url: string,             // ページURL
        domain: string,          // ドメイン
        timestamp: number,       // 検出タイムスタンプ
        characteristics: object, // 詳細な特性データ
        userDecision: string,    // ユーザー決定状態
        confidence: number       // 信頼度スコア (0-1)
    };
}
```

### 2. analyzePopupCharacteristics() 関数

要素の詳細な特性を8つのカテゴリに分けて分析します：

#### 2.1 位置特性 (Position)
- `type`: CSS position値
- `isFixed`: 固定位置かどうか
- `isAbsolute`: 絶対位置かどうか
- `isSticky`: スティッキー位置かどうか

#### 2.2 z-index特性 (ZIndex)
- `value`: z-index値
- `isHigh`: 1000より大きいかどうか
- `isVeryHigh`: 9999以上かどうか

#### 2.3 寸法特性 (Dimensions)
- `width`, `height`: 要素の寸法
- `area`: 面積
- `aspectRatio`: アスペクト比
- `coversLargeArea`: 画面の25%以上をカバーするか
- `isFullScreen`: 画面の90%以上をカバーするか

#### 2.4 モーダルオーバーレイ特性 (ModalOverlay)
- `hasOverlayBackground`: オーバーレイ背景を持つか
- `blocksInteraction`: ユーザーインタラクションをブロックするか
- `hasBackdrop`: モーダル背景を持つか
- `centerPositioned`: 中央配置されているか

#### 2.5 閉じるボタン特性 (CloseButton)
- `hasCloseButton`: 閉じるボタンがあるか
- `closeButtonTypes`: 閉じるボタンの種類配列
- `closeButtonPosition`: 閉じるボタンの位置

#### 2.6 コンテンツ特性 (Content)
- `containsAds`: 広告コンテンツを含むか
- `hasExternalLinks`: 外部リンクを含むか
- `hasFormElements`: フォーム要素を含むか
- `hasMediaContent`: メディアコンテンツを含むか
- `textLength`: テキストの長さ
- `hasCallToAction`: コールトゥアクションを含むか

#### 2.7 視覚的特性 (Visual)
- `backgroundColor`: 背景色
- `hasBoxShadow`: ボックスシャドウがあるか
- `hasBorder`: ボーダーがあるか
- `opacity`: 透明度
- `isVisible`: 視覚的に見えるか

#### 2.8 インタラクション特性 (Interaction)
- `hasClickHandlers`: クリックハンドラーを持つか
- `hasKeyboardHandlers`: キーボードハンドラーを持つか
- `preventsBubbling`: イベントバブリングを防ぐか

### 3. calculatePopupConfidence() 関数

特性データに基づいて信頼度スコア（0-1）を計算します。

#### 信頼度計算の重み配分：
- **位置特性**: 25% (固定位置: 15%, 絶対位置: 10%)
- **z-index特性**: 20% (非常に高い: 20%, 高い: 15%, 中程度: 10%)
- **サイズ特性**: 20% (フルスクリーン: 20%, 大きな領域: 15%, 中程度: 10%)
- **モーダル特性**: 15% (オーバーレイ背景: 5%, インタラクションブロック: 5%, 背景: 3%, 中央配置: 2%)
- **コンテンツ特性**: 10% (広告コンテンツ: 5%, CTA: 3%, 外部リンク: 2%)
- **閉じるボタン特性**: 5% (存在: 3%, 位置: 2%)
- **視覚的特性**: 5% (シャドウ: 2%, 透明度: 2%, ボーダー: 1%)

## 検出ロジック

### モーダルオーバーレイ検出

```javascript
hasOverlayBackground(element) {
    // 半透明背景の検出
    // rgba値の解析
    // 暗い背景色のパターンマッチング
}

blocksUserInteraction(element) {
    // 固定位置 + 画面の80%以上をカバー
}
```

### 閉じるボタン検出

複数のセレクターパターンで検出：
- `[class*="close"]`, `[id*="close"]`
- `[aria-label*="close"]`, `[aria-label*="閉じる"]`
- `[title*="close"]`, `[title*="閉じる"]`
- `.modal-close`, `.popup-close`

### コンテンツ分析

#### 広告コンテンツ検出
キーワードベース検出：`ad`, `advertisement`, `広告`, `sponsor`, `promo`

#### コールトゥアクション検出
キーワードベース検出：`クリック`, `今すぐ`, `無料`, `ダウンロード`, `登録`, `購入`

## 使用例

```javascript
const detector = new PopupDetector();
const element = document.querySelector('.suspicious-popup');
const analysisResult = detector.analyzePopup(element);

console.log('信頼度:', analysisResult.confidence);
console.log('特性:', analysisResult.characteristics);

if (analysisResult.confidence > 0.7) {
    // 高い信頼度でポップアップ広告と判定
    // ユーザーに閉鎖を提案
}
```

## テスト

包括的なテストスイートが `tests/popup-analysis.test.js` に実装されています：

1. **基本的なモーダルポップアップの分析**
2. **大きなオーバーレイポップアップの分析**
3. **信頼度スコア計算**
4. **小さな要素の分析**
5. **コンテンツ特性の詳細分析**
6. **視覚的特性の分析**
7. **インタラクション特性の分析**

テスト実行：
```bash
node tests/popup-analysis.test.js
```

## パフォーマンス考慮事項

- DOM操作の最小化
- 計算結果のキャッシュ
- 非同期処理での適切なエラーハンドリング
- メモリリークの防止

## 今後の拡張

- 機械学習ベースの分類改善
- ウェブサイト固有のパターン学習
- ユーザーフィードバックによる精度向上
- パフォーマンス最適化

## 関連ファイル

- `content/content-script.js` - メイン実装
- `types/popup-analysis.ts` - TypeScript型定義
- `tests/popup-analysis.test.js` - テストスイート
- `docs/popup-analysis.md` - このドキュメント