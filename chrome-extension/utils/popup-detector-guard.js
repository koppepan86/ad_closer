/**
 * PopupDetector Guard System
 * PopupDetectorの初期化を確実にし、安全な呼び出しを提供する
 */

(function() {
  'use strict';

  // PopupDetector初期化状態の管理
  let popupDetectorInitialized = false;
  let popupDetectorInitializing = false;
  let initializationPromise = null;
  const pendingCalls = [];

  /**
   * PopupDetectorクラスの可用性をチェック
   */
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

  /**
   * PopupDetectorの初期化を待機
   */
  function waitForPopupDetector() {
    if (popupDetectorInitialized && window.popupDetector) {
      return Promise.resolve(window.popupDetector);
    }

    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = new Promise((resolve, reject) => {
      const maxWaitTime = 10000; // 10秒
      const checkInterval = 100; // 100ms
      let elapsedTime = 0;

      const checkInitialization = () => {
        // PopupDetectorクラスが利用可能でない場合、自動初期化を試行
        if (!checkPopupDetectorClass()) {
          console.debug('PopupDetector Guard: PopupDetector class not available, waiting...');
        } else if (!window.popupDetector) {
          console.log('PopupDetector Guard: Creating PopupDetector instance');
          try {
            window.popupDetector = new PopupDetector();
            
            // 初期化完了イベントを待機
            const initializationHandler = () => {
              console.log('PopupDetector Guard: Initialization event received');
              document.removeEventListener('popupDetectorInitialized', initializationHandler);
              if (isPopupDetectorReady()) {
                popupDetectorInitialized = true;
                resolve(window.popupDetector);
              }
            };
            
            const errorHandler = (event) => {
              console.error('PopupDetector Guard: Initialization error event received', event.detail);
              document.removeEventListener('popupDetectorInitializationError', errorHandler);
              document.removeEventListener('popupDetectorInitialized', initializationHandler);
              reject(new Error(`PopupDetector initialization failed: ${event.detail.error}`));
            };
            
            document.addEventListener('popupDetectorInitialized', initializationHandler, { once: true });
            document.addEventListener('popupDetectorInitializationError', errorHandler, { once: true });
            
          } catch (error) {
            console.error('PopupDetector Guard: Failed to create PopupDetector instance:', error);
            reject(error);
            return;
          }
        }
        
        if (isPopupDetectorReady()) {
          popupDetectorInitialized = true;
          console.log('PopupDetector Guard: PopupDetector is ready');
          resolve(window.popupDetector);
          return;
        }

        elapsedTime += checkInterval;
        if (elapsedTime >= maxWaitTime) {
          console.error('PopupDetector Guard: Timeout waiting for PopupDetector initialization');
          reject(new Error('PopupDetector initialization timeout'));
          return;
        }

        setTimeout(checkInitialization, checkInterval);
      };

      checkInitialization();
    });

    return initializationPromise;
  }

  /**
   * 安全なdetectPopups呼び出し
   */
  async function safeDetectPopups() {
    if (popupDetectorInitialized && 
        window.popupDetector && 
        typeof window.popupDetector.detectPopups === 'function') {
      try {
        return await window.popupDetector.detectPopups();
      } catch (error) {
        console.error('PopupDetector Guard: Error in detectPopups:', error);
        return [];
      }
    }

    // PopupDetectorが初期化されていない場合は空配列を返す
    console.warn('PopupDetector Guard: PopupDetector not ready, returning empty array for detectPopups');
    return [];
  }

  /**
   * フォールバックメソッドの作成
   */
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

  /**
   * 安全なhandleMutations呼び出し
   */
  function safeHandleMutations(mutations) {
    if (popupDetectorInitialized && 
        window.popupDetector && 
        typeof window.popupDetector.handleMutations === 'function') {
      try {
        return window.popupDetector.handleMutations(mutations);
      } catch (error) {
        console.error('PopupDetector Guard: Error in handleMutations:', error);
        return null;
      }
    }

    // PopupDetectorが初期化されていない場合は呼び出しをキューに追加
    console.warn('PopupDetector Guard: PopupDetector not ready, queueing mutations');
    pendingCalls.push({ method: 'handleMutations', args: [mutations], timestamp: Date.now() });
    
    // 初期化を待機して処理
    waitForPopupDetector().then(() => {
      processPendingCalls();
    }).catch(error => {
      console.error('PopupDetector Guard: Failed to initialize PopupDetector:', error);
    });

    return null;
  }

  /**
   * 保留中の呼び出しを処理
   */
  function processPendingCalls() {
    if (!popupDetectorInitialized || !window.popupDetector) {
      return;
    }

    console.log(`PopupDetector Guard: Processing ${pendingCalls.length} pending calls`);

    const currentTime = Date.now();
    const maxAge = 5000; // 5秒以上古い呼び出しは破棄

    while (pendingCalls.length > 0) {
      const call = pendingCalls.shift();
      
      // 古すぎる呼び出しは破棄
      if (currentTime - call.timestamp > maxAge) {
        console.warn('PopupDetector Guard: Discarding old pending call');
        continue;
      }

      try {
        if (typeof window.popupDetector[call.method] === 'function') {
          window.popupDetector[call.method].apply(window.popupDetector, call.args);
        }
      } catch (error) {
        console.error('PopupDetector Guard: Error processing pending call:', error);
      }
    }
  }

  /**
   * PopupDetectorプロキシの作成
   */
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

        // 特別なメソッドの処理
        if (property === 'handleMutations') {
          return safeHandleMutations;
        }

        if (property === 'detectPopups') {
          return safeDetectPopups;
        }

        // 内部プロパティへのアクセス
        if (property === '_realInstance' || property === '_fallbackMode') {
          return target[property];
        }

        // その他のメソッドの場合
        if (popupDetectorInitialized && target._realInstance) {
          const value = target._realInstance[property];
          if (typeof value === 'function') {
            return value.bind(target._realInstance);
          }
          return value;
        }

        // PopupDetectorが初期化されていない場合のフォールバック
        if (typeof property === 'string' && property.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
          // メソッド名らしいプロパティの場合はフォールバック関数を返す
          return createFallbackMethod(property);
        }

        console.debug(`PopupDetector Guard: Accessing ${property} in fallback mode`);
        return undefined;
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

        // フォールバックモードでは設定を無視
        console.debug(`PopupDetector Guard: Ignoring property set in fallback mode: ${property}`);
        return true;
      }
    });
  }

  /**
   * グローバルガード関数の設定
   */
  function setupGlobalGuards() {
    // 安全なhandleMutations関数をグローバルに提供
    window.safeHandleMutations = safeHandleMutations;
    
    // PopupDetectorの初期化チェック関数
    window.isPopupDetectorReady = function() {
      return popupDetectorInitialized && 
             window.popupDetector && 
             typeof window.popupDetector.handleMutations === 'function';
    };

    // PopupDetectorの初期化待機関数
    window.waitForPopupDetector = waitForPopupDetector;

    // 初期化状態のリセット関数（テスト用）
    window.resetPopupDetectorGuard = function() {
      popupDetectorInitialized = false;
      popupDetectorInitializing = false;
      initializationPromise = null;
      pendingCalls.length = 0;
      console.log('PopupDetector Guard: State reset');
    };
  }

  /**
   * PopupDetectorの初期化監視
   */
  function monitorPopupDetectorInitialization() {
    // 既に初期化されている場合
    if (isPopupDetectorReady()) {
      popupDetectorInitialized = true;
      console.log('PopupDetector Guard: PopupDetector already initialized');
      return;
    }

    // 定期的にチェック
    const checkInterval = setInterval(() => {
      if (isPopupDetectorReady()) {
        popupDetectorInitialized = true;
        clearInterval(checkInterval);
        console.log('PopupDetector Guard: PopupDetector initialization detected');
        
        // 保留中の呼び出しを処理
        processPendingCalls();
      }
    }, 100);

    // 最大10秒後にチェックを停止
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!popupDetectorInitialized) {
        console.error('PopupDetector Guard: PopupDetector initialization timeout');
      }
    }, 10000);
  }

  /**
   * PopupDetectorが実際に準備完了かチェック
   */
  function isPopupDetectorReady() {
    const hasPopupDetectorClass = checkPopupDetectorClass();
    const hasPopupDetector = !!window.popupDetector;
    const hasHandleMutations = hasPopupDetector && typeof window.popupDetector.handleMutations === 'function';
    const hasDetectPopups = hasPopupDetector && typeof window.popupDetector.detectPopups === 'function';
    const isInitialized = hasPopupDetector && window.popupDetector.initialized;
    
    // デバッグ情報をログ出力
    if (!hasPopupDetectorClass || !hasPopupDetector || !hasHandleMutations || !hasDetectPopups || !isInitialized) {
      console.debug('PopupDetector Guard: Readiness check failed', {
        hasPopupDetectorClass,
        hasPopupDetector,
        hasHandleMutations,
        hasDetectPopups,
        isInitialized,
        popupDetectorType: typeof window.popupDetector,
        handleMutationsType: hasPopupDetector ? typeof window.popupDetector.handleMutations : 'N/A',
        detectPopupsType: hasPopupDetector ? typeof window.popupDetector.detectPopups : 'N/A'
      });
    }
    
    return hasPopupDetectorClass && hasPopupDetector && hasHandleMutations && hasDetectPopups && isInitialized;
  }

  /**
   * 初期化
   */
  function initialize() {
    console.log('PopupDetector Guard: Initializing...');
    
    setupGlobalGuards();
    
    // PopupDetectorクラスが利用可能かチェック
    if (checkPopupDetectorClass()) {
      console.log('PopupDetector Guard: PopupDetector class is available');
      
      // PopupDetectorが既に存在し、準備完了の場合
      if (window.popupDetector && isPopupDetectorReady()) {
        popupDetectorInitialized = true;
        console.log('PopupDetector Guard: PopupDetector already ready');
      } else {
        // 監視を開始
        monitorPopupDetectorInitialization();
        
        // PopupDetectorが存在しない場合は、一時的なプロキシを設定
        if (!window.popupDetector) {
          window.popupDetector = createPopupDetectorProxy();
          console.log('PopupDetector Guard: Temporary proxy created');
        }
      }
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
        // 既存のプロキシを置き換えずに、内部的に実際のインスタンスを作成
        try {
          const realDetector = new PopupDetector();
          if (realDetector && typeof realDetector.handleMutations === 'function') {
            // プロキシの内部で実際のインスタンスを使用するように更新
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

  /**
   * プロキシを実際のインスタンスで更新
   */
  function updateProxyWithRealInstance(realInstance) {
    if (window.popupDetector && typeof window.popupDetector === 'object') {
      try {
        // プロキシオブジェクトの内部状態を更新
        window.popupDetector._realInstance = realInstance;
        window.popupDetector._fallbackMode = false;
        popupDetectorInitialized = true;
        
        // 保留中の呼び出しを処理
        processPendingCalls();
        
        console.log('PopupDetector Guard: Proxy updated with real instance');
        
        // 初期化完了イベントを発火
        try {
          const event = new CustomEvent('popupDetectorGuardReady', {
            detail: { 
              realInstance: true,
              fallbackMode: false,
              timestamp: Date.now()
            }
          });
          document.dispatchEvent(event);
        } catch (eventError) {
          console.debug('PopupDetector Guard: Failed to dispatch ready event:', eventError);
        }
        
      } catch (updateError) {
        console.error('PopupDetector Guard: Failed to update proxy:', updateError);
      }
    }
  }

  /**
   * PopupDetectorクラスが利用可能になるまで待機
   */
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

      // 即座にチェックを開始
      checkClass();
    });
  }

  // DOM読み込み完了後に初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  /**
   * PopupDetectorの準備状態を詳細にチェック
   */
  function isReady() {
    return popupDetectorInitialized && isPopupDetectorReady();
  }

  /**
   * PopupDetectorの状態情報を取得
   */
  function getStatus() {
    const hasPopupDetector = !!window.popupDetector;
    const hasHandleMutations = hasPopupDetector && typeof window.popupDetector.handleMutations === 'function';
    const hasDetectPopups = hasPopupDetector && typeof window.popupDetector.detectPopups === 'function';
    const isActuallyReady = isPopupDetectorReady();
    
    return {
      initialized: popupDetectorInitialized,
      initializing: popupDetectorInitializing,
      popupDetectorExists: hasPopupDetector,
      detectPopupsAvailable: hasDetectPopups,
      handleMutationsAvailable: hasHandleMutations,
      actuallyReady: isActuallyReady,
      pendingCallsCount: pendingCalls.length,
      debug: {
        popupDetectorType: typeof window.popupDetector,
        handleMutationsType: hasPopupDetector ? typeof window.popupDetector.handleMutations : 'N/A',
        detectPopupsType: hasPopupDetector ? typeof window.popupDetector.detectPopups : 'N/A',
        flagMismatch: popupDetectorInitialized !== isActuallyReady
      }
    };
  }

  /**
   * MutationObserverを安全に切断
   */
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

  /**
   * 安全なsetupMutationObserver呼び出し
   */
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

  /**
   * 安全なsetupPeriodicCheck呼び出し
   */
  function safeSetupPeriodicCheck() {
    if (popupDetectorInitialized && 
        window.popupDetector && 
        typeof window.popupDetector.setupPeriodicCheck === 'function') {
      try {
        return window.popupDetector.setupPeriodicCheck();
      } catch (error) {
        console.error('PopupDetector Guard: Error in setupPeriodicCheck:', error);
        return null;
      }
    }

    // PopupDetectorが初期化されていない場合は呼び出しをキューに追加
    console.debug('PopupDetector Guard: setupPeriodicCheck called before initialization, queuing');
    pendingCalls.push({ method: 'setupPeriodicCheck', args: [], timestamp: Date.now() });
    return null;
  }

  // エクスポート
  if (typeof window !== 'undefined') {
    window.PopupDetectorGuard = {
      safeHandleMutations,
      safeDetectPopups,
      safeSetupMutationObserver,
      safeSetupPeriodicCheck,
      safeDisconnectObserver,
      waitForPopupDetector,
      isReady,
      getStatus
    };
  }

  console.log('PopupDetector Guard System loaded');
})();