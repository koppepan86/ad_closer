# ObserveDOM Error Fix

## 問題の概要

「PopupDetector Guard: observeDOM called before initialization」エラーが発生していました。これは、DetectionThrottlerがPopupDetectorの初期化前に存在しない`observeDOM()`メソッドを呼び出そうとしていたことが原因でした。

## 根本原因の分析

1. **存在しないメソッドの呼び出し**: DetectionThrottlerが`observeDOM()`メソッドを呼び出していたが、PopupDetectorクラスには`setupMutationObserver()`メソッドしか存在しなかった
2. **不正確なプロパティ名**: `periodicDetectionTimer`と`performPeriodicDetection()`を呼び出していたが、実際は`periodicCheckInterval`と`setupPeriodicCheck()`だった
3. **初期化タイミングの問題**: PopupDetectorが完全に初期化される前にメソッドが呼び出されていた

## 実施した修正

### 1. **DetectionThrottlerの修正**

#### 修正前の問題
```javascript
// 存在しないメソッドの呼び出し
window.popupDetector.observeDOM();
window.popupDetector.performPeriodicDetection();

// 存在しないプロパティの参照
window.popupDetector.periodicDetectionTimer
```

#### 修正後の改善
```javascript
// 正しいメソッドの呼び出し
window.popupDetector.setupMutationObserver();
window.popupDetector.setupPeriodicCheck();

// 正しいプロパティの参照
window.popupDetector.periodicCheckInterval
```

### 2. **PopupDetectorGuardの安全なメソッド追加**

#### 新機能
- `safeSetupMutationObserver()`: MutationObserverの安全な設定
- `safeSetupPeriodicCheck()`: 定期チェックの安全な設定
- 初期化前の呼び出しをキューイングする機能

```javascript
function safeSetupMutationObserver() {
  if (popupDetectorInitialized && 
      window.popupDetector && 
      typeof window.popupDetector.setupMutationObserver === 'function') {
    try {
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

### 3. **フォールバックメソッドの改善**

#### 改善点
- 特定のメソッド（`observeDOM`, `setupMutationObserver`）に対する特別な処理
- 初期化前の呼び出しをキューに追加
- プロキシの実際のインスタンスもチェック

```javascript
function createFallbackMethod(methodName) {
  return function(...args) {
    // 実際のインスタンスが利用可能な場合はそれを使用
    if (popupDetectorInitialized && 
        window.popupDetector && 
        typeof window.popupDetector[methodName] === 'function') {
      try {
        return window.popupDetector[methodName].apply(window.popupDetector, args);
      } catch (error) {
        console.error(`PopupDetector Guard: Error in ${methodName}:`, error);
        return null;
      }
    }

    // プロキシの実際のインスタンスをチェック
    if (window.popupDetector && 
        window.popupDetector._realInstance && 
        typeof window.popupDetector._realInstance[methodName] === 'function') {
      try {
        return window.popupDetector._realInstance[methodName].apply(window.popupDetector._realInstance, args);
      } catch (error) {
        console.error(`PopupDetector Guard: Error in real instance ${methodName}:`, error);
        return null;
      }
    }

    // 特定のメソッドに対する特別な処理
    if (methodName === 'observeDOM' || methodName === 'setupMutationObserver') {
      console.debug(`PopupDetector Guard: ${methodName} called before initialization, queuing for later`);
      // 初期化後に実行するためにキューに追加
      pendingCalls.push({ method: methodName, args: args, timestamp: Date.now() });
      return;
    }

    // 一般的な警告（observeDOMなど特定のメソッドは除く）
    if (methodName !== 'observeDOM' && methodName !== 'setupMutationObserver') {
      console.debug(`PopupDetector Guard: ${methodName} called before initialization`);
    }
    
    // メソッドに応じた適切なフォールバック値を返す
    if (methodName === 'detectPopups') {
      return [];
    } else if (methodName.includes('get') || methodName.includes('find')) {
      return null;
    } else if (methodName.includes('is') || methodName.includes('has')) {
      return false;
    } else if (methodName.includes('setup') || methodName.includes('observe')) {
      // セットアップ系メソッドは何も返さない
      return;
    } else {
      return undefined;
    }
  };
}
```

### 4. **DetectionThrottlerでのGuard使用**

#### 改善点
- PopupDetectorGuardの安全なメソッドを優先的に使用
- 直接呼び出しのフォールバック
- より詳細なエラーハンドリング

```javascript
resumeDetection() {
  // PopupDetectorの定期検出を再開
  if (window.PopupDetectorGuard && typeof window.PopupDetectorGuard.safeSetupPeriodicCheck === 'function') {
    try {
      window.PopupDetectorGuard.safeSetupPeriodicCheck();
      console.debug('DetectionThrottler: Periodic detection resumed via Guard');
    } catch (error) {
      console.warn('DetectionThrottler: Failed to resume periodic detection via Guard:', error);
    }
  } else if (window.popupDetector && !window.popupDetector.periodicCheckInterval && typeof window.popupDetector.setupPeriodicCheck === 'function') {
    try {
      window.popupDetector.setupPeriodicCheck();
      console.debug('DetectionThrottler: Periodic detection resumed directly');
    } catch (error) {
      console.warn('DetectionThrottler: Failed to resume periodic detection:', error);
    }
  }

  // MutationObserverを再開
  if (window.PopupDetectorGuard && typeof window.PopupDetectorGuard.safeSetupMutationObserver === 'function') {
    try {
      // 既存のobserverがある場合は一度切断してから再設定
      if (window.popupDetector && window.popupDetector.observer) {
        window.popupDetector.observer.disconnect();
      }
      window.PopupDetectorGuard.safeSetupMutationObserver();
      console.debug('DetectionThrottler: MutationObserver resumed via Guard');
    } catch (error) {
      console.warn('DetectionThrottler: Failed to resume MutationObserver via Guard:', error);
    }
  }
}
```

## テスト方法

### 基本テスト
1. 拡張機能をリロード
2. コンソールで「observeDOM called before initialization」エラーが発生しないことを確認
3. DetectionThrottlerの停止・再開が正常に動作することを確認

### 詳細テスト（テストページ使用）
1. `test-observe-dom-fix.html` をブラウザで開く
2. "全テスト実行" ボタンをクリック
3. すべてのテストが成功することを確認
4. 特に以下のテストに注目：
   - PopupDetectorGuard メソッドテスト
   - DetectionThrottler テスト
   - メソッド呼び出しテスト
   - 早期呼び出しシミュレーション
   - キューイング機能テスト

## 期待される結果

- 「observeDOM called before initialization」エラーが発生しない
- DetectionThrottlerが正しいメソッドを呼び出す
- 初期化前の呼び出しが適切にキューイングされる
- PopupDetectorGuardの安全なメソッドが正常に動作する
- エラーログが大幅に減少する

## 注意事項

- この修正により、DetectionThrottlerとPopupDetectorの連携が改善されますが、初期化タイミングの根本的な問題も確認することを推奨します
- キューイング機能により、初期化前の呼び出しが保持されますが、古すぎる呼び出し（5秒以上）は自動的に破棄されます
- PopupDetectorGuardの安全なメソッドを使用することで、より堅牢な動作が期待できます