# PopupDetectorクラス利用可能性問題の修正

## 問題の概要

PopupDetectorクラスが利用できないエラーが発生していました：

```
PopupDetector health check failed
Reason: PopupDetector class not available
Details: { "popupDetectorClassExists": false, ... }
```

## 根本原因

manifest.jsonでの**スクリプト読み込み順序**が不適切でした：

### 修正前（問題のある順序）
```json
"js": [
  "utils/popup-detector-guard.js",    // ← PopupDetectorクラスより先に読み込み
  "utils/component-recovery.js",      // ← PopupDetectorクラスより先に読み込み
  "content/popup-detector-safe.js",   // ← PopupDetectorクラス定義
  "content/content-script-clean.js"
]
```

### 修正後（正しい順序）
```json
"js": [
  "content/popup-detector-safe.js",   // ← 最初にPopupDetectorクラス定義
  "utils/popup-detector-guard.js",    // ← クラス定義後にGuard
  "utils/component-recovery.js",      // ← クラス定義後にRecovery
  "content/content-script-clean.js"
]
```

## 実施した修正

### 1. **manifest.json読み込み順序の修正**

PopupDetectorクラスを最初に読み込むように順序を変更：

```json
{
  "content_scripts": [{
    "js": [
      "utils/chrome-api-guard.js",
      "utils/simple-permission-checker.js",
      "utils/detection-throttler.js",
      "utils/promise-error-handler.js",
      "utils/extension-context-guard.js",
      "utils/logger.js",
      "utils/debug-interface.js",
      "utils/performance-monitor.js",
      "utils/user-feedback-system.js",
      "utils/error-handler.js",
      "utils/dom-error-handler.js",
      "utils/communication-error-handler.js",
      "utils/permission-error-handler.js",
      "utils/user-action-detector.js",
      "utils/logging-integration.js",
      "content/popup-detector-safe.js",     // ← 最優先で読み込み
      "utils/popup-detector-guard.js",      // ← クラス定義後
      "utils/component-recovery.js",        // ← クラス定義後
      "content/performance-optimizer.js",
      "content/spa-handler.js",
      "content/website-adaptations.js",
      "content/content-script-clean.js"
    ]
  }]
}
```

### 2. **PopupDetectorGuardの待機機能強化**

PopupDetectorクラスが利用可能になるまで待機する機能を追加：

```javascript
/**
 * PopupDetectorクラスが利用可能になるまで待機
 */
function waitForPopupDetectorClass() {
  return new Promise((resolve, reject) => {
    const maxWaitTime = 10000; // 10秒
    const checkInterval = 100; // 100ms
    let elapsedTime = 0;

    const checkClass = () => {
      if (checkPopupDetectorClass()) {
        resolve();
        return;
      }

      elapsedTime += checkInterval;
      if (elapsedTime >= maxWaitTime) {
        reject(new Error('PopupDetector class availability timeout'));
        return;
      }

      setTimeout(checkClass, checkInterval);
    };

    checkClass();
  });
}
```

### 3. **ComponentRecoveryの回復処理改善**

PopupDetectorクラスが利用できない場合の回復処理を強化：

```javascript
// PopupDetectorクラスの存在チェック
if (typeof PopupDetector !== 'function') {
  healthCheckDetails.error = 'PopupDetector class not available';
  console.warn('ComponentRecovery: PopupDetector class not available, attempting recovery...');
  
  // PopupDetectorクラスが利用できない場合は回復を試行
  setTimeout(() => {
    this.recoverPopupDetector(null, new Error('PopupDetector class not available'));
  }, 1000);
  
  this.logHealthCheckFailure('PopupDetector', healthCheckDetails);
  return false;
}
```

### 4. **PopupDetector回復処理の待機機能**

回復処理でもクラスが利用可能になるまで待機：

```javascript
// PopupDetectorクラスが利用可能かチェック
if (typeof PopupDetector === 'undefined') {
  console.error('PopupDetector recovery: PopupDetector class not available, waiting...');
  
  // PopupDetectorクラスが利用可能になるまで待機
  const maxWaitTime = 5000; // 5秒
  const checkInterval = 100; // 100ms
  let elapsedTime = 0;
  
  while (typeof PopupDetector === 'undefined' && elapsedTime < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsedTime += checkInterval;
  }
  
  // 再度チェック
  if (typeof PopupDetector === 'undefined') {
    console.error('PopupDetector recovery: PopupDetector class still not available after waiting');
    return false;
  }
  
  console.log('PopupDetector recovery: PopupDetector class became available');
}
```

### 5. **content-script-cleanの初期化改善**

PopupDetectorクラスが利用できない場合の再試行機能を追加：

```javascript
// PopupDetectorクラスが利用可能かチェック
if (typeof PopupDetector === 'undefined') {
  console.warn('Content Script: PopupDetector class not available, waiting...');
  
  // PopupDetectorクラスが利用可能になるまで待機
  setTimeout(() => {
    if (typeof PopupDetector !== 'undefined') {
      console.log('Content Script: PopupDetector class became available, retrying initialization');
      initializePopupDetector();
    } else {
      console.error('Content Script: PopupDetector class still not available after waiting');
    }
  }, 1000);
  return;
}
```

## 修正効果

### 修正前の問題
- ❌ PopupDetectorクラスが利用できないエラー
- ❌ PopupDetectorGuardが正常に動作しない
- ❌ ComponentRecoveryが機能しない
- ❌ 初期化プロセスが失敗する

### 修正後の状態
- ✅ **正しい読み込み順序**: PopupDetectorクラスが最初に読み込まれる
- ✅ **待機機能**: クラスが利用可能になるまで適切に待機
- ✅ **自動回復**: クラスが利用できない場合の自動回復機能
- ✅ **エラー耐性**: 一時的な読み込み遅延に対する耐性
- ✅ **詳細ログ**: 問題の早期発見と診断

## テスト方法

### 1. **包括的テストページ**
```bash
# ブラウザで以下を開く
chrome-extension/test-popup-detector-class-availability.html
```

### 2. **手動確認**
```javascript
// コンソールで確認
console.log('PopupDetector class:', typeof PopupDetector);
console.log('PopupDetector instance:', typeof window.popupDetector);
console.log('Guard ready:', window.PopupDetectorGuard?.isReady());
```

### 3. **ヘルスチェック確認**
```javascript
// ComponentRecoveryのヘルスチェック
if (window.ComponentRecoveryManager) {
  const recovery = new ComponentRecoveryManager();
  recovery.checkPopupDetectorHealth().then(result => {
    console.log('Health check result:', result);
  });
}
```

## 技術的詳細

### 読み込み順序の重要性

Chrome拡張機能のcontent_scriptsでは、配列の順序通りにスクリプトが読み込まれます：

1. **依存関係の解決**: 依存するクラス・関数は先に読み込む必要がある
2. **グローバル変数**: `window.PopupDetector`は定義後に参照可能
3. **初期化タイミング**: クラス定義後に初期化処理を実行

### 非同期待機パターン

```javascript
// ポーリングベースの待機
async function waitForClass(className, maxWait = 10000) {
  const start = Date.now();
  while (typeof window[className] === 'undefined') {
    if (Date.now() - start > maxWait) {
      throw new Error(`${className} availability timeout`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return window[className];
}
```

### エラーハンドリング戦略

1. **早期検出**: クラス利用可能性の事前チェック
2. **グレースフルデグラデーション**: 部分的な機能停止でも継続動作
3. **自動回復**: 一時的な問題からの自動復旧
4. **詳細ログ**: 問題の根本原因特定

## 今後の保守指針

### 1. **依存関係管理**
- 新しいスクリプト追加時は依存関係を明確にする
- manifest.jsonの読み込み順序を慎重に決定する

### 2. **初期化パターン**
- クラス定義と初期化処理を分離する
- 非同期初期化には適切な待機機能を実装する

### 3. **テスト戦略**
- 読み込み順序のテストを定期的に実行する
- 異なる環境での動作確認を行う

### 6. **ComponentRecoveryの初期化タイミング改善**

PopupDetectorコンポーネントの登録を遅延実行し、クラス読み込み完了を待機：

```javascript
// PopupDetectorコンポーネントを遅延登録（クラス読み込み完了を待つ）
this.waitForPopupDetectorClass().then(() => {
  console.log('ComponentRecovery: PopupDetector class available, registering component...');
  this.registerComponent('popupDetector', null, {
    healthCheckEnabled: true,
    healthCheckInterval: 30000,
    maxRecoveryAttempts: 3,
    autoRecover: true
  });
}).catch(error => {
  console.error('ComponentRecovery: Failed to wait for PopupDetector class:', error);
  // フォールバックとして遅延登録
  setTimeout(() => {
    console.log('ComponentRecovery: Fallback registration of PopupDetector component...');
    this.registerComponent('popupDetector', null, {
      healthCheckEnabled: true,
      healthCheckInterval: 30000,
      maxRecoveryAttempts: 3,
      autoRecover: true
    });
  }, 5000);
});
```

### 7. **診断スクリプトの提供**

PopupDetectorの読み込み状況を詳細に診断するスクリプトを作成：
- `chrome-extension/diagnose-popup-detector-loading.js`
- ブラウザコンソールで実行可能
- クラス、インスタンス、Guard、ComponentRecoveryの状況を包括的に診断

## 結論

この修正により、PopupDetectorクラスの利用可能性問題が根本的に解決されました：

- **安定した読み込み**: 正しい順序でのスクリプト読み込み
- **堅牢な初期化**: 待機機能による確実な初期化
- **自動回復機能**: 問題発生時の自動復旧
- **包括的な監視**: 詳細なログと診断機能
- **遅延初期化**: ComponentRecoveryの適切なタイミング調整
- **診断ツール**: 問題の早期発見と詳細分析

Chrome拡張機能全体の安定性と信頼性が大幅に向上し、PopupDetectorクラスが常に利用可能な状態が保証されます。