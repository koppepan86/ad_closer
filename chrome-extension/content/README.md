# コンテンツスクリプト実装

## 概要

このコンテンツスクリプト（`content-script.js`）は、ウェブページ上でポップアップ要素を検出し、バックグラウンドサービスワーカーと通信してユーザーの決定を処理します。

## 主要機能

### 1. DOM監視 (observeDOM)
- `MutationObserver`を使用してDOM変更を監視
- 新しく追加された要素をリアルタイムで検出
- 既存の要素も初期スキャンで検出

### 2. ポップアップ検出 (checkForPopup)
以下の特性を持つ要素をポップアップとして検出：
- 固定位置またはabsolute位置
- 高いz-index値（1000以上）
- 画面の大部分を覆うサイズ
- 表示状態（visible、opacity > 0など）

### 3. ポップアップ分析 (createPopupData)
検出されたポップアップの特性を分析：
- 閉じるボタンの有無
- 広告コンテンツの検出
- 外部リンクの有無
- モーダル特性
- 信頼度スコア計算

### 4. メッセージ通信
- バックグラウンドワーカーとの双方向通信
- ポップアップ検出の通知
- ユーザー決定結果の受信
- 拡張機能状態の同期

## 実装された要件

### 要件1.1: ポップアップの自動検出
- 2秒以内の検出を実現するリアルタイム監視
- MutationObserverによる効率的なDOM監視

### 要件5.1: 全ウェブサイトでの動作
- `<all_urls>`パーミッションによる全サイト対応
- サイト固有の制限なし

### 要件5.2: 通常機能への非干渉
- 読み取り専用のDOM分析
- 最小限のパフォーマンス影響

### 要件5.3: 様々なポップアップタイプの検出
- 複数の検出条件による包括的な検出
- 異なる実装技術への対応

## データ構造

### PopupData
```javascript
{
  id: string,              // 一意識別子
  url: string,             // ページURL
  domain: string,          // ドメイン
  timestamp: number,       // 検出時刻
  characteristics: {       // 特性データ
    hasCloseButton: boolean,
    containsAds: boolean,
    hasExternalLinks: boolean,
    isModal: boolean,
    zIndex: number,
    dimensions: {width, height}
  },
  userDecision: string,    // 'pending'
  confidence: number       // 信頼度 (0-1)
}
```

## エラーハンドリング

- Chrome拡張機能API通信エラーの処理
- DOM操作エラーの適切な処理
- フォールバック機能による継続動作

## テスト

基本的なテストフレームワークを`content-script.test.js`に実装：
- Chrome API のモック
- DOM API のモック
- 基本的なテストケース構造

## 今後の拡張

- より高度なポップアップ検出アルゴリズム
- 機械学習による検出精度向上
- パフォーマンス最適化
- より詳細なテストカバレッジ