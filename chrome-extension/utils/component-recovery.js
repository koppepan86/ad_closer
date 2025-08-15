/**
 * コンポーネント障害の自動回復システム
 * Chrome拡張機能のコンポーネント管理用
 */

/**
 * コンポーネント回復マネージャークラス
 */
class ComponentRecoveryManager {
  constructor() {
    this.components = new Map();
    this.componentStatus = new Map();
    this.recoveryStrategies = new Map();
    this.healthChecks = new Map();
    this.recoveryAttempts = new Map();
    this.maxRecoveryAttempts = 3;
    this.healthCheckInterval = 30000; // 30秒
    this.componentDependencies = new Map();
    
    this.initializeRecoverySystem();
    this.setupHealthMonitoring();
  }

  /**
   * 回復システムの初期化
   */
  initializeRecoverySystem() {
    // 標準的な回復戦略を設定
    this.setupStandardRecoveryStrategies();
    
    // コンポーネント依存関係を設定
    this.setupComponentDependencies();
    
    // グローバルエラーハンドラーと連携
    if (typeof window !== 'undefined' && window.globalErrorHandler) {
      window.globalErrorHandler.componentRecoveryManager = this;
    }
  }

  /**
   * 標準的な回復戦略を設定
   */
  setupStandardRecoveryStrategies() {
    // DOM 監視コンポーネントの回復戦略は不要（PopupDetectorが独自のMutationObserverを持つため）
    // this.recoveryStrategies.set('domObserver', { ... }); // 削除

    // ポップアップ検出コンポーネントの回復戦略
    this.recoveryStrategies.set('popupDetector', {
      recover: this.recoverPopupDetector.bind(this),
      healthCheck: this.checkPopupDetectorHealth.bind(this),
      dependencies: [], // domObserverへの依存を削除
      priority: 2
    });

    // 通信コンポーネントの回復戦略
    this.recoveryStrategies.set('communication', {
      recover: this.recoverCommunication.bind(this),
      healthCheck: this.checkCommunicationHealth.bind(this),
      dependencies: [],
      priority: 1
    });

    // ストレージコンポーネントの回復戦略
    this.recoveryStrategies.set('storage', {
      recover: this.recoverStorage.bind(this),
      healthCheck: this.checkStorageHealth.bind(this),
      dependencies: [],
      priority: 1
    });

    // UI コンポーネントの回復戦略
    this.recoveryStrategies.set('ui', {
      recover: this.recoverUI.bind(this),
      healthCheck: this.checkUIHealth.bind(this),
      dependencies: ['communication', 'storage'],
      priority: 3
    });

    // 学習システムの回復戦略
    this.recoveryStrategies.set('learningSystem', {
      recover: this.recoverLearningSystem.bind(this),
      healthCheck: this.checkLearningSystemHealth.bind(this),
      dependencies: ['storage', 'communication'],
      priority: 4
    });
    
    // 初期コンポーネントを登録
    this.registerInitialComponents();
  }

  /**
   * 初期コンポーネントを登録
   */
  registerInitialComponents() {
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
    
    // DOMObserverコンポーネントは不要（PopupDetectorが独自のMutationObserverを持つため）
    console.debug('ComponentRecoveryManager: domObserver not needed (PopupDetector has its own MutationObserver)');
    
    console.log('ComponentRecoveryManager: Initial components registered');
  }

  /**
   * PopupDetectorクラスが利用可能になるまで待機
   */
  waitForPopupDetectorClass() {
    return new Promise((resolve, reject) => {
      const maxWaitTime = 10000; // 10秒
      const checkInterval = 100; // 100ms
      let elapsedTime = 0;

      const checkClass = () => {
        console.debug('ComponentRecovery: Checking PopupDetector class availability...');
        
        if (typeof PopupDetector === 'function') {
          console.log('ComponentRecovery: PopupDetector class is now available');
          resolve();
          return;
        }

        elapsedTime += checkInterval;
        if (elapsedTime >= maxWaitTime) {
          console.error('ComponentRecovery: PopupDetector class availability timeout');
          reject(new Error('PopupDetector class availability timeout'));
          return;
        }

        setTimeout(checkClass, checkInterval);
      };

      // 既に利用可能な場合は即座に解決
      if (typeof PopupDetector === 'function') {
        console.log('ComponentRecovery: PopupDetector class already available');
        resolve();
        return;
      }

      console.log('ComponentRecovery: Waiting for PopupDetector class...');
      checkClass();
    });
  }

  /**
   * DOM Observer が必要かどうかを判定
   * 現在は不要（PopupDetectorが独自のMutationObserverを持つため）
   */
  isDOMObserverNeeded() {
    // PopupDetectorが独自のMutationObserverを持つため、domObserverは不要
    return false;
  }

  /**
   * コンポーネント依存関係を設定
   */
  setupComponentDependencies() {
    // popupDetectorは独自のMutationObserverを持つため、domObserverに依存しない
    // this.componentDependencies.set('popupDetector', ['domObserver']); // 削除
    
    // 実際の依存関係のみを設定
    this.componentDependencies.set('ui', ['communication', 'storage']);
    this.componentDependencies.set('learningSystem', ['storage', 'communication']);
    
    // より適切な依存関係を設定
    this.componentDependencies.set('websiteAdaptation', ['popupDetector']);
    this.componentDependencies.set('performanceOptimizer', ['popupDetector']);
  }

  /**
   * ヘルス監視を設定
   */
  setupHealthMonitoring() {
    // 定期的なヘルスチェック
    setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckInterval);

    // ページ可視性変更時のチェック
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          setTimeout(() => this.performHealthChecks(), 1000);
        }
      });
    }
  }

  /**
   * コンポーネントを登録
   */
  registerComponent(name, component, options = {}) {
    try {
      this.components.set(name, {
        instance: component,
        options: {
          autoRecover: true,
          healthCheckEnabled: true,
          maxRecoveryAttempts: this.maxRecoveryAttempts,
          ...options
        },
        registeredAt: Date.now()
      });

      this.componentStatus.set(name, {
        status: 'healthy',
        lastHealthCheck: Date.now(),
        lastError: null,
        recoveryCount: 0
      });

      console.log(`Component registered: ${name}`);
      
      // 初期ヘルスチェック（PopupDetectorの場合は遅延実行）
      const delay = name === 'popupDetector' ? 3000 : 1000; // PopupDetectorは3秒後
      setTimeout(() => this.checkComponentHealth(name), delay);
    } catch (error) {
      console.error(`Component registration failed: ${name}`, error);
    }
  }

  /**
   * コンポーネントの登録を解除
   */
  unregisterComponent(name) {
    try {
      this.components.delete(name);
      this.componentStatus.delete(name);
      this.recoveryAttempts.delete(name);
      
      console.log(`Component unregistered: ${name}`);
    } catch (error) {
      console.error(`Component unregistration failed: ${name}`, error);
    }
  }

  /**
   * コンポーネントの障害を報告
   */
  reportComponentFailure(name, error, context = {}) {
    try {
      // エラーの詳細情報を文字列として整形
      const errorDetails = this.formatErrorDetails(error);
      const contextDetails = this.formatObjectDetails(context);
      
      // 1つのログにまとめて出力
      const consolidatedLog = [
        `🔴 Component failure reported: ${name}`,
        `📋 Error: ${errorDetails}`,
        `🔍 Context: ${contextDetails}`,
        `⏰ Timestamp: ${new Date().toISOString()}`,
        `🌐 URL: ${window.location?.href}`
      ].join('\n');
      
      console.error(consolidatedLog);
      
      // 開発者向けの詳細オブジェクト（デバッグ時のみ）
      if (typeof window !== 'undefined' && window.location?.hostname === 'localhost' || 
          (typeof chrome !== 'undefined' && chrome.runtime?.getManifest()?.version_name?.includes('dev'))) {
        console.group(`🔧 Component Failure Debug Details: ${name}`);
        console.error('Error object:', error);
        console.error('Context object:', context);
        console.error('Stack trace:', error?.stack);
        console.groupEnd();
      }
      
      // ステータスを更新
      const status = this.componentStatus.get(name);
      if (status) {
        status.status = 'failed';
        status.lastError = {
          message: error?.message || String(error),
          stack: error?.stack,
          timestamp: Date.now(),
          context,
          url: window.location?.href
        };
        status.failureCount = (status.failureCount || 0) + 1;
      }

      // 頻繁な障害の場合は自動回復を制限
      const component = this.components.get(name);
      if (component && component.options.autoRecover) {
        const failureCount = status?.failureCount || 0;
        const recentFailures = this.getRecentFailureCount(name, 60000); // 1分以内
        
        if (recentFailures < 3) { // 1分以内に3回未満の障害の場合のみ自動回復
          console.info(`Attempting auto-recovery for ${name} (failure count: ${failureCount})`);
          this.attemptComponentRecovery(name);
        } else {
          console.warn(`Auto-recovery disabled for ${name} due to frequent failures (${recentFailures} in last minute)`);
        }
      }

      // 依存コンポーネントに影響を通知
      this.notifyDependentComponents(name);
    } catch (recoveryError) {
      console.error(`Error reporting component failure: ${name}`, recoveryError);
    }
  }

  /**
   * コンポーネントの回復を試行
   */
  async attemptComponentRecovery(name) {
    try {
      const component = this.components.get(name);
      const status = this.componentStatus.get(name);
      
      if (!component || !status) {
        console.warn(`Component not found for recovery: ${name}, attempting to register it`);
        
        // コンポーネントが登録されていない場合、自動登録を試行
        if (name === 'popupDetector') {
          this.registerComponent('popupDetector', window.popupDetector || null, {
            healthCheckEnabled: true,
            healthCheckInterval: 30000,
            maxRecoveryAttempts: 3,
            autoRecover: true
          });
          
          // 再度取得を試行
          const retryComponent = this.components.get(name);
          const retryStatus = this.componentStatus.get(name);
          
          if (!retryComponent || !retryStatus) {
            console.error(`Component registration failed for recovery: ${name}`);
            return false;
          }
          
          console.log(`Component auto-registered for recovery: ${name}`);
        } else {
          console.error(`Component not found for recovery: ${name}`);
          return false;
        }
      }

      const currentAttempts = this.recoveryAttempts.get(name) || 0;
      
      if (currentAttempts >= component.options.maxRecoveryAttempts) {
        console.error(`Max recovery attempts reached for component: ${name}`);
        status.status = 'permanently_failed';
        return false;
      }

      console.log(`Attempting recovery for component: ${name} (attempt ${currentAttempts + 1})`);
      
      // 回復戦略を取得
      const strategy = this.recoveryStrategies.get(name);
      if (!strategy) {
        console.error(`No recovery strategy found for component: ${name}`);
        return false;
      }

      // 依存関係をチェック
      const dependenciesHealthy = await this.checkDependencies(name);
      if (!dependenciesHealthy) {
        console.warn(`Dependencies not healthy for component: ${name}`);
        // 依存関係の回復を試行
        await this.recoverDependencies(name);
      }

      // 回復を実行
      const recovered = await strategy.recover(component.instance, status.lastError);
      
      if (recovered) {
        status.status = 'healthy';
        status.lastError = null;
        status.recoveryCount++;
        this.recoveryAttempts.delete(name);
        
        console.log(`Component recovery successful: ${name}`);
        
        // ヘルスチェックを実行
        setTimeout(() => this.checkComponentHealth(name), 2000);
        
        return true;
      } else {
        this.recoveryAttempts.set(name, currentAttempts + 1);
        
        // 指数バックオフで再試行をスケジュール
        const delay = Math.min(1000 * Math.pow(2, currentAttempts), 30000);
        setTimeout(() => this.attemptComponentRecovery(name), delay);
        
        return false;
      }
    } catch (error) {
      console.error(`Component recovery failed: ${name}`, error);
      return false;
    }
  }

  /**
   * 依存関係をチェック
   */
  async checkDependencies(componentName) {
    const dependencies = this.componentDependencies.get(componentName) || [];
    
    for (const dependency of dependencies) {
      const status = this.componentStatus.get(dependency);
      if (!status || status.status !== 'healthy') {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 依存関係を回復
   */
  async recoverDependencies(componentName) {
    const dependencies = this.componentDependencies.get(componentName) || [];
    
    // 優先度順にソート
    const sortedDependencies = dependencies.sort((a, b) => {
      const strategyA = this.recoveryStrategies.get(a);
      const strategyB = this.recoveryStrategies.get(b);
      return (strategyA?.priority || 999) - (strategyB?.priority || 999);
    });

    for (const dependency of sortedDependencies) {
      const status = this.componentStatus.get(dependency);
      if (status && status.status !== 'healthy') {
        console.log(`Recovering dependency: ${dependency} for ${componentName}`);
        await this.attemptComponentRecovery(dependency);
      }
    }
  }

  /**
   * DOM変更を他のコンポーネントに通知
   * 現在は不要（PopupDetectorが独自のMutationObserverを持つため）
   */
  notifyDOMChanges(mutations) {
    // PopupDetectorが独自のMutationObserverを持つため、この通知は不要
    console.debug('DOM changes notification skipped - PopupDetector handles its own mutations');
  }

  /**
   * 依存コンポーネントに通知
   */
  notifyDependentComponents(failedComponent) {
    for (const [componentName, dependencies] of this.componentDependencies.entries()) {
      if (dependencies.includes(failedComponent)) {
        const status = this.componentStatus.get(componentName);
        if (status && status.status === 'healthy') {
          console.warn(`Component ${componentName} may be affected by ${failedComponent} failure`);
          // 依存コンポーネントのヘルスチェックを実行
          setTimeout(() => this.checkComponentHealth(componentName), 1000);
        }
      }
    }
  }

  /**
   * すべてのコンポーネントのヘルスチェックを実行
   */
  async performHealthChecks() {
    console.debug('Performing health checks...');
    
    for (const componentName of this.components.keys()) {
      await this.checkComponentHealth(componentName);
    }
  }

  /**
   * 特定のコンポーネントのヘルスチェック
   */
  async checkComponentHealth(name) {
    try {
      const component = this.components.get(name);
      const status = this.componentStatus.get(name);
      
      if (!component || !status || !component.options.healthCheckEnabled) {
        return;
      }

      const strategy = this.recoveryStrategies.get(name);
      if (!strategy || !strategy.healthCheck) {
        return;
      }

      const isHealthy = await strategy.healthCheck(component.instance);
      
      status.lastHealthCheck = Date.now();
      
      if (!isHealthy && status.status === 'healthy') {
        console.warn(`Health check failed for component: ${name}`);
        const healthCheckError = new Error('Health check failed');
        const context = {
          componentName: name,
          previousStatus: status.status,
          lastHealthCheck: status.lastHealthCheck,
          componentInstance: component.instance ? 'Available' : 'Not Available',
          strategyType: this.getStrategyTypeInfo(strategy),
          strategyMethods: this.getStrategyMethods(strategy),
          componentOptions: component.options || {}
        };
        this.reportComponentFailure(name, healthCheckError, context);
      } else if (isHealthy && status.status === 'failed') {
        console.log(`Component recovered naturally: ${name}`);
        status.status = 'healthy';
        status.lastError = null;
      }
    } catch (error) {
      console.error(`Health check error for component: ${name}`);
      const component = this.components.get(name);
      const strategy = this.recoveryStrategies.get(name);
      const context = {
        componentName: name,
        errorType: error.constructor?.name || 'Unknown',
        componentAvailable: !!component,
        statusAvailable: !!this.componentStatus.get(name),
        strategyType: strategy ? this.getStrategyTypeInfo(strategy) : 'No Strategy',
        strategyMethods: strategy ? this.getStrategyMethods(strategy) : [],
        componentOptions: component?.options || {}
      };
      this.reportComponentFailure(name, error, context);
    }
  }

  /**
   * DOM Observer の回復
   */
  async recoverDOMObserver(instance, lastError) {
    // DOM Observer の回復は不要（PopupDetectorが独自のMutationObserverを持つため）
    console.log('DOM Observer recovery skipped - not needed');
    return true;
    try {
      console.log('Recovering DOM Observer...', { lastError: lastError?.message });
      
      // 既存のオブザーバーを停止
      if (instance && typeof instance.disconnect === 'function') {
        try {
          instance.disconnect();
          console.debug('Existing DOM Observer disconnected');
        } catch (disconnectError) {
          console.warn('Error disconnecting existing observer:', disconnectError);
        }
      }

      // DOM の準備を待機
      if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
          console.debug('Waiting for DOM to be ready...');
          await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
          });
        }

        // 新しいオブザーバーを作成
        let newObserver;
        
        // 1. domErrorHandlerが利用可能な場合
        if (typeof window !== 'undefined' && window.domErrorHandler && 
            typeof window.domErrorHandler.createSafeMutationObserver === 'function') {
          try {
            newObserver = window.domErrorHandler.createSafeMutationObserver(
              (mutations) => {
                // domObserver専用の処理
                console.debug(`DOM Observer: Detected ${mutations.length} mutations`);
                
                // 基本的なDOM変更ログ
                mutations.forEach((mutation, index) => {
                  if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    console.debug(`DOM Observer: Mutation ${index + 1} - ${mutation.addedNodes.length} nodes added`);
                  }
                  if (mutation.type === 'attributes') {
                    console.debug(`DOM Observer: Mutation ${index + 1} - attribute '${mutation.attributeName}' changed`);
                  }
                });
                
                // 他のコンポーネントに通知（必要に応じて）
                if (typeof window.componentRecoveryManager !== 'undefined' && 
                    typeof window.componentRecoveryManager.notifyDOMChanges === 'function') {
                  window.componentRecoveryManager.notifyDOMChanges(mutations);
                }
              }
            );
            console.debug('DOM Observer created using domErrorHandler');
          } catch (error) {
            console.warn('Failed to create observer using domErrorHandler:', error);
          }
        }
        
        // 2. フォールバック: 直接MutationObserverを作成
        if (!newObserver) {
          try {
            newObserver = new MutationObserver((mutations) => {
              console.debug(`DOM Observer (fallback): Detected ${mutations.length} mutations`);
              
              // 基本的な処理のみ
              mutations.forEach((mutation, index) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                  console.debug(`DOM Observer: Mutation ${index + 1} - ${mutation.addedNodes.length} nodes added`);
                }
              });
            });
            
            // 監視を開始
            newObserver.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeOldValue: false,
              characterData: false
            });
            
            console.debug('DOM Observer created using fallback method');
          } catch (error) {
            console.error('Failed to create fallback observer:', error);
            return false;
          }
        }

        if (newObserver) {
          // グローバルスコープに新しいオブザーバーを設定
          window.domObserver = newObserver;
          console.log('DOM Observer recovery successful');
          return true;
        }
      }
      
      console.warn('DOM Observer recovery failed: Unable to create observer');
      return false;
    } catch (error) {
      console.error('DOM Observer recovery failed:', error);
      return false;
    }
  }

  /**
   * DOM Observer のヘルスチェック
   */
  async checkDOMObserverHealth(instance) {
    // DOM Observer のヘルスチェックは不要（PopupDetectorが独自のMutationObserverを持つため）
    console.debug('DOM Observer health check skipped - not needed');
    return true;
    const healthCheckDetails = {
      observerExists: false,
      isMutationObserver: false,
      isConnected: false,
      error: null
    };

    try {
      // 1. オブザーバーが存在するかチェック
      const observer = instance || window.domObserver;
      healthCheckDetails.observerExists = !!observer;
      
      if (!observer) {
        healthCheckDetails.error = 'Observer not found';
        console.debug('DOM Observer health check failed:', this.formatObjectDetails(healthCheckDetails));
        return false;
      }

      // 2. MutationObserverのインスタンスかチェック
      healthCheckDetails.isMutationObserver = observer instanceof MutationObserver;
      
      if (!healthCheckDetails.isMutationObserver) {
        healthCheckDetails.error = 'Not a MutationObserver instance';
        healthCheckDetails.observerType = typeof observer;
        healthCheckDetails.observerConstructor = observer.constructor?.name;
        console.debug('DOM Observer health check failed:', this.formatObjectDetails(healthCheckDetails));
        return false;
      }

      // 3. 基本的な機能テスト（簡略化）
      try {
        // MutationObserverの基本的なプロパティをチェック
        healthCheckDetails.hasObserveMethod = typeof observer.observe === 'function';
        healthCheckDetails.hasDisconnectMethod = typeof observer.disconnect === 'function';
        
        if (healthCheckDetails.hasObserveMethod && healthCheckDetails.hasDisconnectMethod) {
          console.debug('DOM Observer health check passed:', this.formatObjectDetails(healthCheckDetails));
          return true;
        } else {
          healthCheckDetails.error = 'Missing required methods';
          console.debug('DOM Observer health check failed:', this.formatObjectDetails(healthCheckDetails));
          return false;
        }
      } catch (methodError) {
        healthCheckDetails.error = `Method check failed: ${methodError.message}`;
        console.debug('DOM Observer health check failed:', this.formatObjectDetails(healthCheckDetails));
        return false;
      }

    } catch (error) {
      healthCheckDetails.error = `Unexpected error: ${error.message}`;
      console.debug('DOM Observer health check failed with error:', this.formatObjectDetails(healthCheckDetails));
      return false;
    }
  }

  /**
   * ポップアップ検出器の回復
   */
  async recoverPopupDetector(instance, lastError) {
    try {
      console.log('ComponentRecovery: Recovering PopupDetector...');
      
      if (typeof window === 'undefined') {
        console.error('PopupDetector recovery: window object not available');
        return false;
      }

      // 既存のインスタンスをクリーンアップ
      if (window.popupDetector) {
        try {
          if (typeof window.popupDetector.cleanup === 'function') {
            window.popupDetector.cleanup();
          }
          if (typeof window.popupDetector.destroy === 'function') {
            window.popupDetector.destroy();
          }
        } catch (cleanupError) {
          console.warn('PopupDetector recovery: cleanup error:', cleanupError);
        }
        
        // 既存のインスタンスを削除
        window.popupDetector = null;
      }

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

      // 新しいインスタンスを作成
      try {
        console.log('PopupDetector recovery: Creating new PopupDetector instance...');
        window.popupDetector = new PopupDetector({
          debugMode: true,
          enableMutationObserver: true,
          enablePeriodicCheck: true,
          detectionInterval: 1000,
          maxDetectionAttempts: 10
        });
        
        console.log('PopupDetector recovery: new instance created successfully');
        
        // 初期化の完了を待機（イベントベース）
        const initializationPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            document.removeEventListener('popupDetectorInitialized', successHandler);
            document.removeEventListener('popupDetectorInitializationError', errorHandler);
            reject(new Error('PopupDetector initialization timeout'));
          }, 5000);
          
          const successHandler = () => {
            clearTimeout(timeout);
            document.removeEventListener('popupDetectorInitializationError', errorHandler);
            resolve();
          };
          
          const errorHandler = (event) => {
            clearTimeout(timeout);
            document.removeEventListener('popupDetectorInitialized', successHandler);
            reject(new Error(`PopupDetector initialization failed: ${event.detail.error}`));
          };
          
          // 既に初期化済みの場合
          if (window.popupDetector.initialized) {
            clearTimeout(timeout);
            resolve();
            return;
          }
          
          document.addEventListener('popupDetectorInitialized', successHandler, { once: true });
          document.addEventListener('popupDetectorInitializationError', errorHandler, { once: true });
        });
        
        await initializationPromise;
        console.log('PopupDetector recovery: initialization completed');
        
        // ヘルスチェックを実行
        const isHealthy = await this.checkPopupDetectorHealth(window.popupDetector);
        if (!isHealthy) {
          console.error('PopupDetector recovery: health check failed after recovery');
          return false;
        }
        
        console.log('PopupDetector recovery: recovery completed successfully');
        return true;
        
      } catch (creationError) {
        console.error('PopupDetector recovery: failed to create new instance:', creationError);
        return false;
      }
    } catch (error) {
      console.error('PopupDetector recovery: unexpected error:', error);
      return false;
    }
  }

  /**
   * ポップアップ検出器のヘルスチェック
   */
  async checkPopupDetectorHealth(instance) {
    const healthCheckDetails = {
      windowAvailable: typeof window !== 'undefined',
      popupDetectorClassExists: typeof PopupDetector === 'function',
      popupDetectorExists: false,
      isInitialized: false,
      guardReady: false,
      methodsAvailable: {},
      functionalTests: {},
      internalProperties: {},
      error: null
    };

    try {
      // 基本的な存在チェック
      if (typeof window === 'undefined') {
        healthCheckDetails.error = 'window object not available';
        this.logHealthCheckFailure('PopupDetector', healthCheckDetails);
        return false;
      }

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

      if (!window.popupDetector) {
        healthCheckDetails.error = 'window.popupDetector not found';
        healthCheckDetails.windowPopupDetector = window.popupDetector;
        this.logHealthCheckFailure('PopupDetector', healthCheckDetails);
        return false;
      }

      healthCheckDetails.popupDetectorExists = true;
      const detector = window.popupDetector;

      // 初期化状態のチェック
      healthCheckDetails.isInitialized = !!detector.initialized;
      if (!detector.initialized) {
        healthCheckDetails.error = 'PopupDetector not initialized';
        this.logHealthCheckFailure('PopupDetector', healthCheckDetails);
        return false;
      }

      // PopupDetectorGuardのプロキシかどうかをチェック
      if (typeof window.PopupDetectorGuard !== 'undefined') {
        healthCheckDetails.guardReady = window.PopupDetectorGuard.isReady();
        if (!healthCheckDetails.guardReady) {
          healthCheckDetails.error = 'PopupDetectorGuard indicates not ready';
          this.logHealthCheckFailure('PopupDetector', healthCheckDetails);
          return false;
        }
      } else {
        healthCheckDetails.guardReady = 'Guard not available';
      }

      // 必要なメソッドの存在チェック
      const requiredMethods = ['detectPopups', 'handleMutations', 'getStats', 'cleanup'];
      for (const method of requiredMethods) {
        healthCheckDetails.methodsAvailable[method] = {
          exists: typeof detector[method] === 'function',
          type: typeof detector[method]
        };
        
        if (typeof detector[method] !== 'function') {
          healthCheckDetails.error = `${method} method not found or not a function`;
          this.logHealthCheckFailure('PopupDetector', healthCheckDetails);
          return false;
        }
      }

      // 内部プロパティのチェック
      healthCheckDetails.internalProperties = {
        hasObserver: !!detector.observer,
        hasUniversalDetector: !!detector.universalDetector,
        detectionCount: detector.detectionCount || 0,
        lastDetectionTime: detector.lastDetectionTime || 0
      };

      // 基本的な機能テスト（より安全に）
      try {
        // detectPopupsメソッドが呼び出し可能かテスト
        const testResult = await detector.detectPopups();
        healthCheckDetails.functionalTests.detectPopups = {
          success: true,
          resultType: typeof testResult,
          isArray: Array.isArray(testResult),
          resultLength: Array.isArray(testResult) ? testResult.length : 'N/A'
        };
        
        if (!Array.isArray(testResult)) {
          healthCheckDetails.error = 'detectPopups did not return array';
          this.logHealthCheckFailure('PopupDetector', healthCheckDetails);
          return false;
        }
      } catch (methodError) {
        healthCheckDetails.functionalTests.detectPopups = {
          success: false,
          error: methodError.message,
          stack: methodError.stack
        };
        healthCheckDetails.error = `detectPopups method failed: ${methodError.message}`;
        this.logHealthCheckFailure('PopupDetector', healthCheckDetails);
        return false;
      }

      // handleMutationsメソッドのテスト（空の配列で）
      try {
        detector.handleMutations([]);
        healthCheckDetails.functionalTests.handleMutations = {
          success: true,
          testInput: 'empty array'
        };
      } catch (mutationError) {
        healthCheckDetails.functionalTests.handleMutations = {
          success: false,
          error: mutationError.message,
          stack: mutationError.stack
        };
        healthCheckDetails.error = `handleMutations test failed: ${mutationError.message}`;
        this.logHealthCheckFailure('PopupDetector', healthCheckDetails);
        return false;
      }

      // getStatsメソッドのテスト
      try {
        const stats = detector.getStats();
        healthCheckDetails.functionalTests.getStats = {
          success: true,
          statsType: typeof stats,
          hasInitialized: stats && typeof stats.initialized === 'boolean'
        };
        
        if (!stats || typeof stats !== 'object') {
          healthCheckDetails.error = 'getStats did not return valid object';
          this.logHealthCheckFailure('PopupDetector', healthCheckDetails);
          return false;
        }
      } catch (statsError) {
        healthCheckDetails.functionalTests.getStats = {
          success: false,
          error: statsError.message
        };
        healthCheckDetails.error = `getStats method failed: ${statsError.message}`;
        this.logHealthCheckFailure('PopupDetector', healthCheckDetails);
        return false;
      }

      // 追加のプロパティチェック（PopupDetectorの内部状態）
      healthCheckDetails.internalProperties = {
        observer: detector.observer !== undefined ? 'Available' : 'Missing',
        universalDetector: detector.universalDetector !== undefined ? 'Available' : 'Missing',
        observerType: typeof detector.observer,
        universalDetectorType: typeof detector.universalDetector
      };

      if (detector.observer === undefined && detector.universalDetector === undefined) {
        healthCheckDetails.error = 'internal properties missing, may be proxy';
        this.logHealthCheckFailure('PopupDetector', healthCheckDetails);
        return false;
      }

      this.logHealthCheckSuccess('PopupDetector', healthCheckDetails);
      return true;
    } catch (error) {
      healthCheckDetails.error = `unexpected error: ${error.message}`;
      healthCheckDetails.stack = error.stack;
      this.logHealthCheckFailure('PopupDetector', healthCheckDetails);
      return false;
    }
  }

  /**
   * 通信コンポーネントの回復
   */
  async recoverCommunication(instance, lastError) {
    try {
      console.log('Recovering Communication...');
      
      // 通信エラーハンドラーを再初期化
      if (typeof window !== 'undefined' && window.communicationErrorHandler) {
        // 接続状態をリセット
        window.communicationErrorHandler.connectionStatus = 'unknown';
        
        // 接続を再確認
        await window.communicationErrorHandler.checkRuntimeConnection();
        
        // キューに入っているメッセージを処理
        await window.communicationErrorHandler.processQueuedMessages();
        
        return window.communicationErrorHandler.connectionStatus === 'connected';
      }
      
      return false;
    } catch (error) {
      console.error('Communication recovery failed:', error);
      return false;
    }
  }

  /**
   * 通信のヘルスチェック
   */
  async checkCommunicationHealth(instance) {
    try {
      if (typeof window !== 'undefined' && window.communicationErrorHandler) {
        return window.communicationErrorHandler.connectionStatus === 'connected';
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * ストレージコンポーネントの回復
   */
  async recoverStorage(instance, lastError) {
    try {
      console.log('Recovering Storage...');
      
      // ストレージの基本テスト
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const testKey = 'recovery_test';
        const testValue = { timestamp: Date.now() };
        
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ [testKey]: testValue }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
        
        await new Promise((resolve, reject) => {
          chrome.storage.local.remove([testKey], () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Storage recovery failed:', error);
      return false;
    }
  }

  /**
   * ストレージのヘルスチェック
   */
  async checkStorageHealth(instance) {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.storage && 
             chrome.storage.local;
    } catch (error) {
      return false;
    }
  }

  /**
   * UI コンポーネントの回復
   */
  async recoverUI(instance, lastError) {
    try {
      console.log('Recovering UI...');
      
      // UI コンポーネントを再初期化
      if (typeof window !== 'undefined') {
        // ポップアップインターフェースの回復
        if (typeof PopupInterface !== 'undefined' && document.getElementById('popup-container')) {
          window.popupInterface = new PopupInterface();
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('UI recovery failed:', error);
      return false;
    }
  }

  /**
   * UI のヘルスチェック
   */
  async checkUIHealth(instance) {
    try {
      return typeof document !== 'undefined' && 
             document.getElementById('popup-container') !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * 学習システムの回復
   */
  async recoverLearningSystem(instance, lastError) {
    try {
      console.log('Recovering Learning System...');
      
      // 学習システムの基本機能をテスト
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // 学習パターンの読み込みテスト
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(['learningPatterns'], resolve);
        });
        
        return result.learningPatterns !== undefined;
      }
      
      return false;
    } catch (error) {
      console.error('Learning System recovery failed:', error);
      return false;
    }
  }

  /**
   * 学習システムのヘルスチェック
   */
  async checkLearningSystemHealth(instance) {
    try {
      return typeof chrome !== 'undefined' && chrome.storage;
    } catch (error) {
      return false;
    }
  }

  /**
   * すべてのコンポーネントの状態を取得
   */
  getComponentStatuses() {
    const statuses = {};
    
    for (const [name, status] of this.componentStatus.entries()) {
      statuses[name] = {
        ...status,
        recoveryAttempts: this.recoveryAttempts.get(name) || 0,
        hasRecoveryStrategy: this.recoveryStrategies.has(name)
      };
    }
    
    return statuses;
  }

  /**
   * 回復統計を取得
   */
  getRecoveryStatistics() {
    const stats = {
      totalComponents: this.components.size,
      healthyComponents: 0,
      failedComponents: 0,
      recoveringComponents: 0,
      totalRecoveries: 0
    };

    for (const status of this.componentStatus.values()) {
      switch (status.status) {
        case 'healthy':
          stats.healthyComponents++;
          break;
        case 'failed':
        case 'permanently_failed':
          stats.failedComponents++;
          break;
        case 'recovering':
          stats.recoveringComponents++;
          break;
      }
      
      stats.totalRecoveries += status.recoveryCount || 0;
    }

    return stats;
  }

  /**
   * 指定時間内の障害回数を取得
   */
  getRecentFailureCount(componentName, timeWindowMs) {
    const status = this.componentStatus.get(componentName);
    if (!status || !status.lastError) {
      return 0;
    }

    const now = Date.now();
    const cutoffTime = now - timeWindowMs;
    
    // 簡単な実装: 最後のエラーが時間窓内かどうかをチェック
    // より詳細な実装では、エラー履歴の配列を保持することもできる
    if (status.lastError.timestamp > cutoffTime) {
      return status.failureCount || 1;
    }
    
    return 0;
  }

  /**
   * 回復マネージャーをリセット
   */
  reset() {
    this.components.clear();
    this.componentStatus.clear();
    this.recoveryAttempts.clear();
  }

  /**
   * エラーオブジェクトの詳細を文字列として整形
   */
  formatErrorDetails(error) {
    if (!error) return 'No error provided';
    
    if (typeof error === 'string') return error;
    
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    
    if (typeof error === 'object') {
      try {
        return JSON.stringify(error, null, 2);
      } catch (e) {
        return `[Object: ${Object.prototype.toString.call(error)}]`;
      }
    }
    
    return String(error);
  }

  /**
   * オブジェクトの詳細を文字列として整形
   */
  formatObjectDetails(obj) {
    if (!obj) return 'No context provided';
    
    if (typeof obj === 'string') return obj;
    
    if (typeof obj === 'object') {
      try {
        // 循環参照を避けるために安全にシリアライズ
        const seen = new WeakSet();
        const replacer = (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular Reference]';
            }
            seen.add(value);
          }
          return value;
        };
        
        return JSON.stringify(obj, replacer, 2);
      } catch (e) {
        // JSON.stringifyが失敗した場合の代替手段
        const result = [];
        for (const [key, value] of Object.entries(obj)) {
          try {
            result.push(`${key}: ${this.safeStringify(value)}`);
          } catch (err) {
            result.push(`${key}: [Unable to stringify]`);
          }
        }
        return result.join(', ');
      }
    }
    
    return String(obj);
  }

  /**
   * 安全な文字列化
   */
  safeStringify(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'function') return '[Function]';
    if (typeof value === 'symbol') return value.toString();
    if (typeof value === 'object') {
      if (value instanceof Error) {
        return `Error: ${value.message}`;
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (Array.isArray(value)) {
        return `[Array(${value.length})]`;
      }
      return `[Object: ${Object.prototype.toString.call(value)}]`;
    }
    return String(value);
  }

  /**
   * ヘルスチェック失敗ログを統一形式で出力
   */
  logHealthCheckFailure(componentName, details) {
    const consolidatedLog = [
      `🔴 ${componentName} health check failed`,
      `📋 Reason: ${details.error || 'Unknown error'}`,
      `🔍 Details: ${this.formatObjectDetails(details)}`,
      `⏰ Timestamp: ${new Date().toISOString()}`,
      `🌐 URL: ${window.location?.href}`
    ].join('\n');
    
    console.error(consolidatedLog);
  }

  /**
   * ヘルスチェック成功ログを統一形式で出力
   */
  logHealthCheckSuccess(componentName, details) {
    const consolidatedLog = [
      `✅ ${componentName} health check passed`,
      `🔍 Details: ${this.formatObjectDetails(details)}`,
      `⏰ Timestamp: ${new Date().toISOString()}`
    ].join('\n');
    
    console.log(consolidatedLog);
  }

  /**
   * 戦略タイプの詳細情報を取得
   */
  getStrategyTypeInfo(strategy) {
    if (!strategy) return 'No Strategy';
    
    const info = {
      constructorName: strategy.constructor?.name || 'Unknown',
      type: typeof strategy,
      isObject: typeof strategy === 'object',
      hasPrototype: !!strategy.constructor?.prototype
    };
    
    // 戦略が関数オブジェクトの場合の詳細情報
    if (typeof strategy === 'object') {
      info.keys = Object.keys(strategy);
      info.hasRecover = typeof strategy.recover === 'function';
      info.hasHealthCheck = typeof strategy.healthCheck === 'function';
    }
    
    return info;
  }

  /**
   * 戦略のメソッド情報を取得
   */
  getStrategyMethods(strategy) {
    if (!strategy || typeof strategy !== 'object') return [];
    
    const methods = [];
    for (const key in strategy) {
      if (typeof strategy[key] === 'function') {
        methods.push({
          name: key,
          type: 'function',
          bound: strategy[key].name.includes('bound') || key === 'recover' || key === 'healthCheck'
        });
      }
    }
    
    return methods;
  }
}

// グローバルインスタンスを作成
const componentRecoveryManager = new ComponentRecoveryManager();

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ComponentRecoveryManager, componentRecoveryManager };
} else if (typeof window !== 'undefined') {
  window.ComponentRecoveryManager = ComponentRecoveryManager;
  window.componentRecoveryManager = componentRecoveryManager;
}