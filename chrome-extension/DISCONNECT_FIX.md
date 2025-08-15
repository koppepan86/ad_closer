# Observer Disconnect Error Fix

## 問題の概要

「DetectionThrottler: Failed to resume MutationObserver via Guard: TypeError: window.popupDetector.observer.disconnect is not a function」エラーが発生していました。これは、PopupDetectorの`observer`プロパティが存在するものの、適切なMutationObserverインスタンスではなく、`disconnect`メソッドを持たないオブジェクトだったことが原因でした。

## 根本原因の分析

1. **不適切なObserverインスタンス**: `window.popupDetector.observer`が存在するが、MutationObserverインスタンスではない
2. **メソッド存在チェックの不足**: `disconnect`メソッドの存在を確認せずに呼び出していた
3. **エラーハンドリングの不備**: 無効なObserverに対する適切な処理が不足していた

## 実施した修正

### 1. **DetectionThrottlerの安全な切断機能追加**

#### 新機能: `safeDisconnectObserver`メソッド
```javascript
safeDisconnectObserver(observer, context = '') {
  if (!observer) {
    return false;
  }
  
  if (typeof observer.disconnect === 'function') {
    try {
      observer.disconnect();
      console.debug(`DetectionThrottler: Observer disconnected${context ? ' (' + context + ')' : ''}`);
      return true;
    } catch (error) {
      console.warn(`DetectionThrottler: Failed to disconnect observer${context ? ' (' + context + ')' : ''}:`, error);
      return false;
    }
  } else {
    console.debug(`DetectionThrottler: Observer exists but disconnect method not available${context ? ' (' + context + ')' : ''}`);
    return false;
  }
}
```

### 2. **stopAllDetectionメソッドの改善**

#### 修正前の問題
```javascript
// 危険: disconnectメソッドの存在を確認せずに呼び出し
if (window.popupDetector && window.popupDetector.observer) {
  window.popupDetector.observer.disconnect();
}
```

#### 修正後の改善
```javascript
// 安全: ヘルパーメソッドを使用して安全に切断
if (window.popupDetector && window.popupDetector.observer) {
  this.safeDisconnectObserver(window.popupDetector.observer, 'stop');
}
```

### 3. **resumeDetectionメソッドの改善**

#### 修正前の問題
- 複雑な条件分岐とエラーハンドリング
- 同じ切断ロジックの重複

#### 修正後の改善
```javascript
// MutationObserverを再開
if (window.PopupDetectorGuard && typeof window.PopupDetectorGuard.safeSetupMutationObserver === 'function') {
  try {
    // 既存のobserverがある場合は一度切断してから再設定
    if (window.popupDetector && window.popupDetector.observer) {
      this.safeDisconnectObserver(window.popupDetector.observer, 'resume via Guard');
    }
    
    window.PopupDetectorGuard.safeSetupMutationObserver();
    console.debug('DetectionThrottler: MutationObserver resumed via Guard');
  } catch (error) {
    console.warn('DetectionThrottler: Failed to resume MutationObserver via Guard:', error);
  }
} else if (window.popupDetector && typeof window.popupDetector.setupMutationObserver === 'function') {
  try {
    // 既存のobserverがある場合は一度切断してから再設定
    if (window.popupDetector.observer) {
      this.safeDisconnectObserver(window.popupDetector.observer, 'resume direct');
    }
    
    window.popupDetector.setupMutationObserver();
    console.debug('DetectionThrottler: MutationObserver resumed directly');
  } catch (error) {
    console.warn('DetectionThrottler: Failed to resume MutationObserver:', error);
  }
} else {
  console.debug('DetectionThrottler: No suitable method found to resume MutationObserver');
}
```

### 4. **PopupDetectorGuardの安全な切断機能追加**

#### 新機能: PopupDetectorGuardにも`safeDisconnectObserver`を追加
```javascript
function safeDisconnectObserver(observer, context = '') {
  if (!observer) {
    return false;
  }
  
  if (typeof observer.disconnect === 'function') {
    try {
      observer.disconnect();
      console.debug(`PopupDetector Guard: Observer disconnected${context ? ' (' + context + ')' : ''}`);
      return true;
    } catch (error) {
      console.warn(`PopupDetector Guard: Failed to disconnect observer${context ? ' (' + context + ')' : ''}:`, error);
      return false;
    }
  } else {
    console.debug(`PopupDetector Guard: Observer exists but disconnect method not available${context ? ' (' + context + ')' : ''}`);
    return false;
  }
}
```

### 5. **safeSetupMutationObserverの改善**

#### 改善点
- セットアップ前に既存のObserverを安全に切断
- より堅牢なエラーハンドリング

```javascript
function safeSetupMutationObserver() {
  if (popupDetectorInitialized && 
      window.popupDetector && 
      typeof window.popupDetector.setupMutationObserver === 'function') {
    try {
      // 既存のobserverがある場合は安全に切断
      if (window.popupDetector.observer) {
        safeDisconnectObserver(window.popupDetector.observer, 'before setup');
      }
      
      return window.popupDetector.setupMutationObserver();
    } catch (error) {
      console.error('PopupDetector Guard: Error in setupMutationObserver:', error);
      return null;
    }
  }

  // PopupDetectorが初期化されていない場合は呼び出しをキューに追加
  console.debug('PopupDetector Guard: setupMutationObserver called before initialization, queuing');
  pendingCalls.push({ method: 'setupMutationObserver', args: [], timestamp: Date.now() });
  return null;
}
```

## テスト方法

### 基本テスト
1. 拡張機能をリロード
2. コンソールで「observer.disconnect is not a function」エラーが発生しないことを確認
3. DetectionThrottlerの停止・再開が正常に動作することを確認

### 詳細テスト（テストページ使用）
1. `test-disconnect-fix.html` をブラウザで開く
2. "全テスト実行" ボタンをクリック
3. すべてのテストが成功することを確認
4. 特に以下のテストに注目：
   - Observer検証テスト
   - 安全な切断テスト
   - DetectionThrottler テスト
   - 無効なObserverシミュレーション
   - Guard メソッドテスト

### 無効なObserverのシミュレーション
テストページの「無効なObserverシミュレーション」機能を使用して、意図的に無効なObserverを設定し、エラーが発生しないことを確認できます。

## 期待される結果

- 「observer.disconnect is not a function」エラーが発生しない
- 無効なObserverが存在してもDetectionThrottlerが正常に動作する
- 適切なログメッセージが出力される（エラーではなくデバッグレベル）
- MutationObserverの停止・再開が安全に実行される

## 注意事項

- この修正により、無効なObserverに対する処理が改善されますが、なぜ無効なObserverが作成されるのかの根本原因も調査することを推奨します
- `safeDisconnectObserver`メソッドは、Observerの存在と`disconnect`メソッドの存在を両方チェックします
- コンテキスト情報付きのログにより、どの処理でObserverの切断が行われたかを追跡できます
- DetectionThrottlerとPopupDetectorGuardの両方に同じ安全な切断機能を提供することで、一貫性を保っています