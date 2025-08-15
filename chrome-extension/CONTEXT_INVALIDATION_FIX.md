# Extension Context Invalidation Fix

## 問題の概要

「Extension context has been invalidated」エラーが発生していました。これは、Chrome拡張機能のコンテキストが無効化された（通常は拡張機能のリロードや更新時）際に発生する正常な現象ですが、適切に処理されていませんでした。

## 根本原因の分析

1. **コンテキスト無効化の検出**: 拡張機能のリロード時にコンテキストが無効化される
2. **不適切なログレベル**: 正常な現象を警告として表示していた
3. **操作の継続**: コンテキスト無効化後も不要な操作が継続されていた
4. **リソースの未解放**: 無効化時に適切なクリーンアップが行われていなかった

## 実施した修正

### 1. **ログレベルの改善**

#### 修正前の問題
```javascript
console.warn('Extension context has been invalidated');
```

#### 修正後の改善
```javascript
console.info('Extension context has been invalidated (extension was likely reloaded or updated)');
```

### 2. **コンテキスト検証の改善**

#### 修正前の問題
- 過度に頻繁なチェック（5秒間隔）
- false positiveが発生しやすい検証ロジック

#### 修正後の改善
```javascript
checkContextValidity() {
  // 既に無効化されている場合はスキップ
  if (!this.contextValid) {
    return false;
  }

  try {
    // Chrome runtime の基本的な存在チェック
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.debug('Extension context: Chrome runtime not available');
      this.handleContextInvalidation();
      return false;
    }

    // Runtime ID の存在をチェック
    if (chrome.runtime.id === undefined || chrome.runtime.id === null) {
      console.debug('Extension context: Runtime ID not available');
      this.handleContextInvalidation();
      return false;
    }

    // より安全なメッセージ送信テスト
    try {
      chrome.runtime.sendMessage({ type: 'CONTEXT_CHECK', timestamp: Date.now() }, (response) => {
        if (chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message;
          if (errorMessage && errorMessage.includes('Extension context invalidated')) {
            console.debug('Extension context: Context invalidation detected via message test');
            this.handleContextInvalidation();
          }
        }
      });
    } catch (messageError) {
      const errorMessage = messageError.message || String(messageError);
      if (errorMessage.includes('Extension context invalidated')) {
        console.debug('Extension context: Context invalidation detected via message exception');
        this.handleContextInvalidation();
        return false;
      }
    }

    return true;
  } catch (error) {
    console.debug('Extension context: Validity check error:', error);
    // 一般的なエラーでは無効化しない（false positiveを避ける）
    return true;
  }
}
```

### 3. **グレースフルシャットダウンの実装**

#### 新機能: `stopExtensionOperations`メソッド
```javascript
stopExtensionOperations() {
  try {
    // DetectionThrottlerを停止
    if (window.DetectionThrottler && typeof window.DetectionThrottler.stopAllDetection === 'function') {
      window.DetectionThrottler.stopAllDetection();
      console.debug('Extension context: DetectionThrottler stopped');
    }

    // PopupDetectorをクリーンアップ
    if (window.popupDetector && typeof window.popupDetector.cleanup === 'function') {
      window.popupDetector.cleanup();
      console.debug('Extension context: PopupDetector cleaned up');
    }

    // MutationObserverを停止
    if (window.popupDetector && window.popupDetector.observer && typeof window.popupDetector.observer.disconnect === 'function') {
      window.popupDetector.observer.disconnect();
      console.debug('Extension context: MutationObserver disconnected');
    }

    // Performance Optimizerを停止
    if (window.performanceOptimizer && typeof window.performanceOptimizer.cleanup === 'function') {
      window.performanceOptimizer.cleanup();
      console.debug('Extension context: Performance Optimizer cleaned up');
    }

    // Component Recovery Managerを停止
    if (window.componentRecoveryManager && typeof window.componentRecoveryManager.cleanup === 'function') {
      window.componentRecoveryManager.cleanup();
      console.debug('Extension context: Component Recovery Manager cleaned up');
    }

    console.info('Extension context: All operations stopped due to context invalidation');
  } catch (error) {
    console.error('Extension context: Error stopping operations:', error);
  }
}
```

### 4. **安全な操作実行機能の追加**

#### 新機能: `shouldContinueOperation`と`safeExecute`メソッド
```javascript
shouldContinueOperation() {
  if (!this.contextValid) {
    console.debug('Extension context: Operation skipped due to invalid context');
    return false;
  }
  return true;
}

async safeExecute(operation, operationName = 'unknown') {
  if (!this.shouldContinueOperation()) {
    console.debug(`Extension context: Skipping ${operationName} due to invalid context`);
    return null;
  }

  try {
    return await operation();
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.debug(`Extension context: Context invalidation detected during ${operationName}`);
      this.handleContextInvalidation();
      return null;
    }
    throw error;
  }
}
```

### 5. **監視頻度の最適化**

#### 改善点
- チェック間隔を5秒から10秒に変更
- 不要なリソース消費を削減

```javascript
setupContextMonitoring() {
  // Extension context の状態を定期的にチェック（頻度を下げる）
  this.contextCheckInterval = setInterval(() => {
    this.checkContextValidity();
  }, 10000); // 10秒間隔に変更
}
```

## 使用方法

### 他のコンポーネントでの使用例

```javascript
// 操作を実行する前にコンテキストをチェック
if (window.ExtensionContextGuard && !window.ExtensionContextGuard.shouldContinueOperation()) {
  return; // コンテキストが無効な場合は操作をスキップ
}

// 安全にChrome APIを実行
if (window.ExtensionContextGuard) {
  const result = await window.ExtensionContextGuard.safeExecute(async () => {
    return chrome.runtime.sendMessage({ type: 'some_message' });
  }, 'send message operation');
}

// コンテキスト無効化時のコールバックを登録
if (window.ExtensionContextGuard) {
  window.ExtensionContextGuard.onInvalidation(() => {
    console.log('Extension context invalidated, cleaning up...');
    // クリーンアップ処理
  });
}
```

## テスト方法

### 基本テスト
1. 拡張機能をリロード
2. コンソールで警告レベルのメッセージが情報レベルに変更されていることを確認
3. 拡張機能の動作が適切に停止されることを確認

### 詳細テスト（テストページ使用）
1. `test-context-invalidation-fix.html` をブラウザで開く
2. "全テスト実行" ボタンをクリック
3. すべてのテストが成功することを確認
4. 特に以下のテストに注目：
   - Context Guard テスト
   - コンテキスト検証テスト
   - 安全実行テスト
   - 無効化コールバックテスト

### コンテキスト無効化のシミュレーション
テストページの「コンテキスト無効化シミュレーション」ボタンを使用して、意図的にコンテキストを無効化し、適切に処理されることを確認できます。

## 期待される結果

- 「Extension context has been invalidated」が警告ではなく情報レベルで表示される
- コンテキスト無効化時に全ての拡張機能操作が適切に停止される
- 無効化後の不要な操作が実行されない
- リソースが適切に解放される
- false positiveによる誤った無効化が減少する

## 注意事項

- この修正により、コンテキスト無効化の処理が改善されますが、拡張機能のリロード時には一時的に機能が停止します
- `safeExecute`メソッドを使用することで、コンテキスト無効化に対してより堅牢なコードを書くことができます
- コンテキスト無効化は正常な現象であり、エラーではありません
- 他のコンポーネントでも`shouldContinueOperation()`を使用してコンテキストの有効性をチェックすることを推奨します