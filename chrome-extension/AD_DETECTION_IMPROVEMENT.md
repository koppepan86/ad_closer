# 広告検出機能の改善

## 問題の概要

PopupDetectorの広告検出がうまくいかない問題がありました。特に、sample-dom.htmlのような実際の広告要素を適切に検出できていませんでした。

## 実施した改善

### 1. **広告特有のセレクタの追加**

#### 新機能: `adSelectors`配列
```javascript
// 広告特有のセレクタ
adSelectors: [
  '[id*="ad"]',
  '[id*="banner"]',
  '[id*="bnc_ad"]',
  '[class*="ad"]',
  '[class*="banner"]',
  '[class*="advertisement"]',
  'iframe[id*="ad"]',
  'iframe[src*="ads"]',
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
  '[data-ad-slot]',
  '[data-google-ad-client]'
]
```

### 2. **広告用Z-Indexしきい値の追加**

#### 改善点
- 高いz-indexしきい値（1000）に加えて、広告用の低いしきい値（500）を追加
- より多くの広告要素を検出可能に

```javascript
// z-indexベースの検出
highZIndexThreshold: 1000,

// 広告用の低いz-indexしきい値
adZIndexThreshold: 500,
```

### 3. **一般的な広告サイズの定義**

#### 新機能: `commonAdSizes`配列
```javascript
// 広告の一般的なサイズ
commonAdSizes: [
  { width: 728, height: 90 },   // Leaderboard
  { width: 300, height: 250 },  // Medium Rectangle
  { width: 320, height: 50 },   // Mobile Banner
  { width: 160, height: 600 },  // Wide Skyscraper
  { width: 300, height: 600 },  // Half Page
  { width: 970, height: 250 },  // Billboard
  { width: 320, height: 100 }   // Large Mobile Banner
]
```

### 4. **広告特徴判定メソッドの追加**

#### 新機能: `hasAdCharacteristics`メソッド
```javascript
hasAdCharacteristics(element) {
  try {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    // 一般的な広告サイズかチェック
    for (const adSize of this.universalDetector.commonAdSizes) {
      if (Math.abs(rect.width - adSize.width) <= 10 && 
          Math.abs(rect.height - adSize.height) <= 10) {
        return true;
      }
    }
    
    // 画面の端に配置されているかチェック
    const isAtEdge = rect.top <= 10 || rect.bottom >= window.innerHeight - 10 ||
                    rect.left <= 10 || rect.right >= window.innerWidth - 10;
    
    // 全幅に近いかチェック
    const isFullWidth = rect.width >= window.innerWidth * 0.8;
    
    // 固定位置で端に配置されている場合
    if ((style.position === 'fixed' || style.position === 'absolute') && 
        (isAtEdge || isFullWidth)) {
      return true;
    }
    
    // iframeを含む場合
    const iframe = element.querySelector('iframe');
    if (iframe) {
      const iframeSrc = iframe.src || '';
      const iframeId = iframe.id || '';
      
      // 広告関連のURLやIDパターン
      const adUrlPatterns = [
        /ads/i,
        /doubleclick/i,
        /googlesyndication/i,
        /adsystem/i,
        /ad.*server/i
      ];
      
      for (const pattern of adUrlPatterns) {
        if (pattern.test(iframeSrc) || pattern.test(iframeId)) {
          return true;
        }
      }
    }
    
    return false;
    
  } catch (error) {
    console.debug('PopupDetector: hasAdCharacteristics error:', error);
    return false;
  }
}
```

### 5. **広告パターンの拡張**

#### 改善点
- 既存のポップアップパターンに加えて広告特有のパターンを追加

```javascript
// 広告パターン
const adPatterns = [
  /ad[_-]?/i,
  /banner/i,
  /advertisement/i,
  /bnc_ad/i,
  /google.*ad/i,
  /doubleclick/i,
  /adsystem/i
];
```

### 6. **検出ロジックの強化**

#### 改善点
- 広告セレクタベースの検出を追加
- iframe要素の特別チェック
- 広告特徴を持つ要素の検出

```javascript
// 広告セレクタベースの検出
for (const selector of this.universalDetector.adSelectors) {
  try {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (this.isVisiblePopup(element)) {
        detectedPopups.push({
          element,
          type: 'ad-selector',
          selector,
          timestamp: Date.now()
        });
      }
    }
  } catch (selectorError) {
    console.debug('PopupDetector: Ad selector error:', selector, selectorError);
  }
}
```

### 7. **sample-dom.htmlの大幅改善**

#### 新機能
- 6種類の異なる広告タイプのサンプル
- インタラクティブなテスト機能
- リアルタイム検出結果の表示

**含まれる広告タイプ**:
1. 固定位置バナー広告（元のサンプル）
2. サイドバー広告
3. ポップアップ風モーダル広告
4. Google AdSense風広告
5. 上部固定バナー
6. フローティング広告

### 8. **検出結果の詳細化**

#### 改善点
- より詳細なデバッグ情報の提供
- 要素の寸法と位置情報の追加

```javascript
// デバッグログ
if (this.options.debugMode || uniquePopups.length > 0) {
  console.log('PopupDetector: Detected popups:', uniquePopups.map(popup => ({
    element: popup.element.tagName + (popup.element.id ? '#' + popup.element.id : '') + (popup.element.className ? '.' + popup.element.className.split(' ').join('.') : ''),
    type: popup.type,
    selector: popup.selector,
    zIndex: popup.zIndex,
    dimensions: {
      width: popup.element.offsetWidth,
      height: popup.element.offsetHeight
    },
    position: {
      top: popup.element.offsetTop,
      left: popup.element.offsetLeft
    }
  })));
}
```

### 9. **専用テストページの作成**

#### 新機能: `test-ad-detection.html`
- 基本検出テスト
- 広告セレクタテスト
- Z-Index検出テスト
- 広告特徴テスト
- リアルタイムステータス表示

## テスト方法

### 基本テスト
1. `sample-dom.html`を開く
2. 「検出テスト実行」ボタンをクリック
3. 検出された広告要素の数と詳細を確認

### 詳細テスト
1. `test-ad-detection.html`を開く
2. 「全テスト実行」ボタンをクリック
3. 各テストの結果を確認

### 実際のサイトでのテスト
1. 広告が表示されているサイトを開く
2. 開発者ツールのコンソールで以下を実行:
```javascript
if (window.popupDetector) {
  const results = window.popupDetector.detectPopups();
  console.log('検出された広告:', results);
}
```

## 期待される結果

- sample-dom.htmlの6種類の広告要素がすべて検出される
- 実際のWebサイトでより多くの広告要素が検出される
- false positiveが減少し、より正確な検出が可能
- 詳細なデバッグ情報により問題の特定が容易

## 注意事項

- 広告ブロッカーが有効な場合、一部の広告要素が表示されない可能性があります
- サイトによっては動的に生成される広告要素があるため、MutationObserverによる監視が重要です
- 検出精度を向上させるため、新しい広告パターンが発見された場合は随時追加することを推奨します