# PopupDetector Timeout Fix

## 問題の概要

PopupDetectorGuardが「PopupDetector class availability timeout」エラーでタイムアウトする問題が発生していました。これは、PopupDetectorクラスの読み込みを待機する際に、10秒のタイムアウト期間内にクラスが利用可能にならないことが原因でした。

## 実施した修正

### 1. **タイムアウト期間の延長と詳細なログ追加**

#### 修正前の問題
- タイムアウト期間が10秒と短すぎる場合があった
- チェック間隔が100msと粗く、詳細な状態が把握できなかった
- エラー時の診断情報が不足していた

#### 修正後の改善
```javascript
function waitForPopupDetectorClass() {
  return new Promise((resolve, reject) => {
    const maxWaitTime = 15000; // 15秒に延長
    const checkInterval = 50; // 50msに短縮してより頻繁にチェック
    let elapsedTime = 0;
    let lastLogTime = 0;

    const checkClass = () => {
      // より詳細なクラス存在チェック
      const classExists = checkPopupDetectorClass();
      const globalExists = typeof window.PopupDetector !== 'undefined';
      const constructorExists = window.PopupDetector && typeof window.PopupDetector === 'function';
      
      // デバッグ情報を定期的にログ出力（1秒ごと）
      if (elapsedTime - lastLogTime >= 1000) {
        console.debug('PopupDetector Guard: Waiting for class...', {
          elapsedTime,
          classExists,
          globalExists,
          constructorExists,
          documentReady: document.readyState,
          scriptsLoaded: document.scripts.length
        });
        lastLogTime = elapsedTime;
      }
      
      if (classExists && globalExists && constructorExists) {
        console.log('PopupDetector Guard: PopupDetector class is now available');
        resolve();
        return;
      }

      elapsedTime += checkInterval;
      if (elapsedTime >= maxWaitTime) {
        const errorDetails = {
          elapsedTime,
          classExists,
          globalExists,
          constructorExists,
          documentReady: document.readyState,
          scriptsLoaded: document.scripts.length,
          windowKeys: Object.keys(window).filter(key => key.toLowerCase().includes('popup')),
          lastError: 'PopupDetector class availability timeout after ' + maxWaitTime + 'ms'
        };
        
        console.error('PopupDetector Guard: Class availability timeout', errorDetails);
        reject(new Error('PopupDetector class availability timeout: ' + JSON.stringify(errorDetails)));
        return;
      }

      setTimeout(checkClass, checkInterval);
    };

    checkClass();
  });
}
```

### 2. **クラス存在チェックの強化**

#### 修正前の問題
- 単純な`typeof PopupDetector === 'function'`チェックのみ
- 異なるスコープでの定義を検出できない

#### 修正後の改善
```javascript
function checkPopupDetectorClass() {
  try {
    // 複数の方法でPopupDetectorクラスの存在を確認
    const directCheck = typeof PopupDetector === 'function';
    const windowCheck = typeof window.PopupDetector === 'function';
    const globalCheck = typeof global !== 'undefined' && typeof global.PopupDetector === 'function';
    
    // いずれかの方法で存在が確認できればOK
    const exists = directCheck || windowCheck || globalCheck;
    
    if (exists) {
      // さらに詳細なチェック：コンストラクタとして機能するか
      try {
        const PopupDetectorClass = PopupDetector || window.PopupDetector || (typeof global !== 'undefined' ? global.PopupDetector : null);
        if (PopupDetectorClass && PopupDetectorClass.prototype) {
          return true;
        }
      } catch (constructorError) {
        console.debug('PopupDetector Guard: Constructor check failed:', constructorError);
      }
    }
    
    return exists;
  } catch (error) {
    console.debug('PopupDetector Guard: Class check error:', error);
    return false;
  }
}
```

### 3. **フォールバック機能の強化**

#### 新機能
- クラスが利用可能になる前でも即座にプロキシを提供
- バックグラウンドでクラスの読み込みを待機
- 実際のインスタンスが利用可能になったら自動的に切り替え

```javascript
function initialize() {
  console.log('PopupDetector Guard: Initializing...');
  
  setupGlobalGuards();
  
  if (checkPopupDetectorClass()) {
    // クラスが利用可能な場合の処理
    console.log('PopupDetector Guard: PopupDetector class is available');
    // ... 既存の処理
  } else {
    console.log('PopupDetector Guard: PopupDetector class not yet available, setting up fallback...');
    
    // 即座にプロキシを設定してフォールバック機能を提供
    if (!window.popupDetector) {
      window.popupDetector = createPopupDetectorProxy();
      console.log('PopupDetector Guard: Fallback proxy created');
    }
    
    // バックグラウンドでPopupDetectorクラスが利用可能になるまで待機
    waitForPopupDetectorClass().then(() => {
      console.log('PopupDetector Guard: PopupDetector class became available, reinitializing...');
      try {
        const realDetector = new PopupDetector();
        if (realDetector && typeof realDetector.handleMutations === 'function') {
          updateProxyWithRealInstance(realDetector);
          console.log('PopupDetector Guard: Real instance integrated with proxy');
        }
      } catch (creationError) {
        console.warn('PopupDetector Guard: Failed to create real instance:', creationError);
      }
    }).catch(error => {
      console.error('PopupDetector Guard: Failed to wait for PopupDetector class:', error);
      console.log('PopupDetector Guard: Continuing with fallback proxy');
    });
  }

  console.log('PopupDetector Guard: Initialization complete');
}
```

### 4. **改良されたプロキシシステム**

#### 新機能
- 実際のインスタンスとフォールバックモードの自動切り替え
- 内部状態の管理（`_realInstance`, `_fallbackMode`）
- シームレスな機能提供

```javascript
function createPopupDetectorProxy() {
  const proxyTarget = {
    _realInstance: null,
    _fallbackMode: true
  };

  return new Proxy(proxyTarget, {
    get: function(target, property) {
      // 実際のインスタンスが利用可能な場合はそれを使用
      if (target._realInstance && typeof target._realInstance[property] !== 'undefined') {
        const value = target._realInstance[property];
        if (typeof value === 'function') {
          return value.bind(target._realInstance);
        }
        return value;
      }

      // フォールバックメソッドの処理
      if (property === 'handleMutations') {
        return safeHandleMutations;
      }

      if (property === 'detectPopups') {
        return safeDetectPopups;
      }

      // その他のフォールバック処理...
    },

    set: function(target, property, value) {
      // 内部プロパティの設定
      if (property === '_realInstance' || property === '_fallbackMode') {
        target[property] = value;
        if (property === '_realInstance' && value) {
          target._fallbackMode = false;
          console.log('PopupDetector Guard: Switched from fallback to real instance');
        }
        return true;
      }

      // 実際のインスタンスが利用可能な場合はそれに設定
      if (target._realInstance) {
        target._realInstance[property] = value;
        return true;
      }

      return true;
    }
  });
}
```

## テスト方法

### 基本テスト
1. 拡張機能をリロード
2. コンソールでタイムアウトエラーが発生しないことを確認
3. `window.popupDetector`が利用可能であることを確認
4. `window.popupDetector.detectPopups()`が正常に動作することを確認

### 詳細テスト（テストページ使用）
1. `test-popup-detector-timeout-fix.html` をブラウザで開く
2. "全テスト実行" ボタンをクリック
3. すべてのテストが成功することを確認
4. 特に以下のテストに注目：
   - PopupDetector可用性テスト
   - Guard機能テスト
   - フォールバックモードテスト
   - プロキシ機能テスト

### タイムアウトシミュレーション
1. テストページで "タイムアウトシミュレーション" ボタンをクリック
2. PopupDetectorクラスが一時的に隠された状態でもプロキシが動作することを確認
3. 5秒後にクラスが復元され、実際のインスタンスに切り替わることを確認

## 期待される結果

- PopupDetectorクラスの読み込み待機時にタイムアウトエラーが発生しない
- クラスが利用可能になる前でもフォールバック機能が提供される
- 実際のインスタンスが利用可能になったら自動的に切り替わる
- 詳細な診断情報により問題の特定が容易になる

## 注意事項

- この修正により、PopupDetectorの初期化がより堅牢になりますが、根本的な原因（スクリプトの読み込み順序など）も確認することを推奨します
- フォールバックモードでは機能が制限される場合があります
- 実際のインスタンスへの切り替えは自動的に行われますが、切り替えタイミングでの一時的な動作の違いに注意してください