/**
 * 包括的なエラーハンドリングシステム
 * Chrome拡張機能のポップアップ広告ブロッカー用
 */

/**
 * エラータイプの定義
 */
const ERROR_TYPES = {
  DOM_ACCESS: 'DOM_ACCESS_ERROR',
  COMMUNICATION: 'COMMUNICATION_ERROR', 
  PERMISSION: 'PERMISSION_ERROR',
  COMPONENT_FAILURE: 'COMPONENT_FAILURE',
  STORAGE: 'STORAGE_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

/**
 * エラー重要度レベル
 */
const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * 包括的エラーハンドラークラス
 */
class GlobalErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 1000;
    this.retryAttempts = new Map();
    this.maxRetryAttempts = 3;
    this.componentStatus = new Map();
    this.recoveryStrategies = new Map();
    this.fallbackMechanisms = new Map();
    
    this.initializeErrorHandling();
    this.setupRecoveryStrategies();
    this.setupFallbackMechanisms();
  }

  /**
   * エラーハンドリングシステムの初期化
   */
  initializeErrorHandling() {
    // グローバルエラーハンドラーを設定
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.handleError(event.error, ERROR_TYPES.UNKNOWN, ERROR_SEVERITY.MEDIUM, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(event.reason, ERROR_TYPES.UNKNOWN, ERROR_SEVERITY.HIGH, {
          type: 'unhandled_promise_rejection'
        });
      });
    }

    // Chrome拡張機能固有のエラーハンドリング
    if (typeof chrome !== 'undefined' && 
        chrome.runtime && 
        chrome.runtime.onMessage && 
        typeof chrome.runtime.onMessage.addListener === 'function') {
      try {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if (message.type === 'ERROR_REPORT') {
            this.handleError(
              new Error(message.error.message),
              message.error.type || ERROR_TYPES.UNKNOWN,
              message.error.severity || ERROR_SEVERITY.MEDIUM,
              message.error.context
            );
          }
        });
        console.log('Error Handler: Chrome runtime message listener registered');
      } catch (error) {
        console.error('Error Handler: Failed to register Chrome runtime message listener:', error);
      }
    } else {
      console.warn('Error Handler: Chrome runtime message API not available');
    }
  }

  /**
   * 回復戦略を設定
   */
  setupRecoveryStrategies() {
    // DOM アクセスエラーの回復戦略
    this.recoveryStrategies.set(ERROR_TYPES.DOM_ACCESS, {
      strategy: this.recoverFromDOMError.bind(this),
      maxAttempts: 3,
      delay: 1000
    });

    // 通信エラーの回復戦略
    this.recoveryStrategies.set(ERROR_TYPES.COMMUNICATION, {
      strategy: this.recoverFromCommunicationError.bind(this),
      maxAttempts: 5,
      delay: 2000
    });

    // 権限エラーの回復戦略
    this.recoveryStrategies.set(ERROR_TYPES.PERMISSION, {
      strategy: this.recoverFromPermissionError.bind(this),
      maxAttempts: 1,
      delay: 0
    });

    // コンポーネント障害の回復戦略
    this.recoveryStrategies.set(ERROR_TYPES.COMPONENT_FAILURE, {
      strategy: this.recoverFromComponentFailure.bind(this),
      maxAttempts: 2,
      delay: 3000
    });

    // ストレージエラーの回復戦略
    this.recoveryStrategies.set(ERROR_TYPES.STORAGE, {
      strategy: this.recoverFromStorageError.bind(this),
      maxAttempts: 3,
      delay: 1500
    });
  }

  /**
   * フォールバックメカニズムを設定
   */
  setupFallbackMechanisms() {
    // DOM アクセスのフォールバック
    this.fallbackMechanisms.set(ERROR_TYPES.DOM_ACCESS, {
      fallback: this.domAccessFallback.bind(this),
      description: 'DOM アクセス制限時の代替処理'
    });

    // 通信のフォールバック
    this.fallbackMechanisms.set(ERROR_TYPES.COMMUNICATION, {
      fallback: this.communicationFallback.bind(this),
      description: '通信失敗時の代替処理'
    });

    // 権限のフォールバック
    this.fallbackMechanisms.set(ERROR_TYPES.PERMISSION, {
      fallback: this.permissionFallback.bind(this),
      description: '権限エラー時の機能縮小'
    });

    // ストレージのフォールバック
    this.fallbackMechanisms.set(ERROR_TYPES.STORAGE, {
      fallback: this.storageFallback.bind(this),
      description: 'ストレージエラー時の代替処理'
    });
  }

  /**
   * メインエラーハンドリング関数
   */
  async handleError(error, type = ERROR_TYPES.UNKNOWN, severity = ERROR_SEVERITY.MEDIUM, context = {}) {
    try {
      // エラーログに記録
      const errorRecord = this.createErrorRecord(error, type, severity, context);
      this.logError(errorRecord);

      // 重要度に応じた処理
      if (severity === ERROR_SEVERITY.CRITICAL) {
        await this.handleCriticalError(errorRecord);
      }

      // 回復戦略を試行
      const recovered = await this.attemptRecovery(errorRecord);
      
      if (!recovered) {
        // フォールバックメカニズムを実行
        await this.executeFallback(errorRecord);
      }

      // エラー通知（必要に応じて）
      if (severity === ERROR_SEVERITY.HIGH || severity === ERROR_SEVERITY.CRITICAL) {
        this.notifyError(errorRecord);
      }

      return errorRecord;
    } catch (handlingError) {
      console.error('エラーハンドリング中にエラーが発生:', handlingError);
      // 最後の手段として基本的なログ出力
      console.error('元のエラー:', error);
    }
  }

  /**
   * エラーレコードを作成
   */
  createErrorRecord(error, type, severity, context) {
    return {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      error: {
        message: error.message || 'Unknown error',
        stack: error.stack || '',
        name: error.name || 'Error'
      },
      type,
      severity,
      context: {
        ...context,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        url: typeof location !== 'undefined' ? location.href : '',
        component: context.component || 'unknown'
      },
      recovered: false,
      fallbackUsed: false,
      retryCount: 0
    };
  }

  /**
   * エラーIDを生成
   */
  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * エラーをログに記録
   */
  logError(errorRecord) {
    this.errorLog.push(errorRecord);
    
    // ログサイズを制限
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.splice(0, this.errorLog.length - this.maxLogSize);
    }

    // コンソールにも出力
    console.error(`[${errorRecord.type}] ${errorRecord.error.message}`, errorRecord);

    // ストレージに永続化（非同期）
    this.persistErrorLog().catch(err => {
      console.warn('エラーログの永続化に失敗:', err);
    });
  }

  /**
   * 重要なエラーの処理
   */
  async handleCriticalError(errorRecord) {
    console.error('重要なエラーが発生しました:', errorRecord);
    
    // 拡張機能の状態を安全モードに切り替え
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        await chrome.runtime.sendMessage({
          type: 'ENTER_SAFE_MODE',
          reason: errorRecord
        });
      }
    } catch (err) {
      console.error('安全モード切り替えに失敗:', err);
    }

    // 重要なコンポーネントを無効化
    this.disableCriticalComponents();
  }

  /**
   * 回復を試行
   */
  async attemptRecovery(errorRecord) {
    const recoveryStrategy = this.recoveryStrategies.get(errorRecord.type);
    if (!recoveryStrategy) {
      return false;
    }

    const retryKey = `${errorRecord.type}_${errorRecord.context.component}`;
    const currentAttempts = this.retryAttempts.get(retryKey) || 0;

    if (currentAttempts >= recoveryStrategy.maxAttempts) {
      console.warn(`最大再試行回数に達しました: ${errorRecord.type}`);
      return false;
    }

    try {
      // 遅延を追加
      if (recoveryStrategy.delay > 0) {
        await this.delay(recoveryStrategy.delay);
      }

      // 回復戦略を実行
      const recovered = await recoveryStrategy.strategy(errorRecord);
      
      if (recovered) {
        errorRecord.recovered = true;
        errorRecord.retryCount = currentAttempts + 1;
        this.retryAttempts.delete(retryKey); // 成功したらリセット
        console.log(`回復成功: ${errorRecord.type}`);
        return true;
      } else {
        this.retryAttempts.set(retryKey, currentAttempts + 1);
        return false;
      }
    } catch (recoveryError) {
      console.error('回復戦略の実行中にエラー:', recoveryError);
      this.retryAttempts.set(retryKey, currentAttempts + 1);
      return false;
    }
  }

  /**
   * フォールバックメカニズムを実行
   */
  async executeFallback(errorRecord) {
    const fallbackMechanism = this.fallbackMechanisms.get(errorRecord.type);
    if (!fallbackMechanism) {
      console.warn(`フォールバックメカニズムが見つかりません: ${errorRecord.type}`);
      return false;
    }

    try {
      console.log(`フォールバック実行: ${fallbackMechanism.description}`);
      const result = await fallbackMechanism.fallback(errorRecord);
      errorRecord.fallbackUsed = true;
      return result;
    } catch (fallbackError) {
      console.error('フォールバック実行中にエラー:', fallbackError);
      return false;
    }
  }

  /**
   * DOM アクセスエラーからの回復
   */
  async recoverFromDOMError(errorRecord) {
    console.log('DOM アクセスエラーからの回復を試行中...');
    
    try {
      // DOM の準備状態を確認
      if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
          // DOM の読み込み完了を待機
          await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
          });
        }

        // 基本的な DOM アクセステスト
        const testElement = document.createElement('div');
        document.body.appendChild(testElement);
        document.body.removeChild(testElement);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('DOM 回復に失敗:', error);
      return false;
    }
  }

  /**
   * 通信エラーからの回復
   */
  async recoverFromCommunicationError(errorRecord) {
    console.log('通信エラーからの回復を試行中...');
    
    try {
      // Chrome runtime の状態を確認
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        // 簡単な ping テスト
        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('通信テストタイムアウト'));
          }, 5000);

          chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });

        return response !== undefined;
      }
      return false;
    } catch (error) {
      console.error('通信回復に失敗:', error);
      return false;
    }
  }

  /**
   * 権限エラーからの回復
   */
  async recoverFromPermissionError(errorRecord) {
    console.log('権限エラーからの回復を試行中...');
    
    try {
      // 権限の再確認
      if (typeof chrome !== 'undefined' && chrome.permissions) {
        const requiredPermissions = ['activeTab', 'storage'];
        
        for (const permission of requiredPermissions) {
          const hasPermission = await new Promise(resolve => {
            chrome.permissions.contains({ permissions: [permission] }, resolve);
          });
          
          if (!hasPermission) {
            console.warn(`権限が不足しています: ${permission}`);
            return false;
          }
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('権限回復に失敗:', error);
      return false;
    }
  }

  /**
   * コンポーネント障害からの回復
   */
  async recoverFromComponentFailure(errorRecord) {
    console.log('コンポーネント障害からの回復を試行中...');
    
    try {
      const component = errorRecord.context.component;
      
      // コンポーネントの再初期化を試行
      if (component && typeof window !== 'undefined') {
        // グローバルスコープでコンポーネントの再初期化関数を探す
        const reinitFunction = window[`reinit${component}`];
        if (typeof reinitFunction === 'function') {
          await reinitFunction();
          this.componentStatus.set(component, 'recovered');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('コンポーネント回復に失敗:', error);
      return false;
    }
  }

  /**
   * ストレージエラーからの回復
   */
  async recoverFromStorageError(errorRecord) {
    console.log('ストレージエラーからの回復を試行中...');
    
    try {
      // ストレージの基本テスト
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const testKey = 'error_handler_test';
        const testValue = { timestamp: Date.now() };
        
        // 書き込みテスト
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ [testKey]: testValue }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
        
        // 読み込みテスト
        await new Promise((resolve, reject) => {
          chrome.storage.local.get([testKey], (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
        
        // テストデータを削除
        await new Promise((resolve) => {
          chrome.storage.local.remove([testKey], resolve);
        });
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('ストレージ回復に失敗:', error);
      return false;
    }
  }

  /**
   * DOM アクセスのフォールバック
   */
  async domAccessFallback(errorRecord) {
    console.log('DOM アクセスフォールバックを実行中...');
    
    try {
      // 制限された環境での基本的な操作のみ実行
      if (typeof document !== 'undefined') {
        // セーフモードでの最小限の DOM 操作
        const safeOperations = {
          querySelector: (selector) => {
            try {
              return document.querySelector(selector);
            } catch {
              return null;
            }
          },
          createElement: (tagName) => {
            try {
              return document.createElement(tagName);
            } catch {
              return null;
            }
          }
        };
        
        // フォールバック操作を提供
        if (typeof window !== 'undefined') {
          window.safeDOMOperations = safeOperations;
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('DOM フォールバックに失敗:', error);
      return false;
    }
  }

  /**
   * 通信のフォールバック
   */
  async communicationFallback(errorRecord) {
    console.log('通信フォールバックを実行中...');
    
    try {
      // ローカルストレージを使用した代替通信
      if (typeof localStorage !== 'undefined') {
        const fallbackComm = {
          send: (message) => {
            const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem(`fallback_message_${messageId}`, JSON.stringify({
              ...message,
              timestamp: Date.now(),
              id: messageId
            }));
            return messageId;
          },
          
          receive: (callback) => {
            const checkMessages = () => {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('fallback_message_')) {
                  const message = JSON.parse(localStorage.getItem(key));
                  if (Date.now() - message.timestamp < 30000) { // 30秒以内
                    callback(message);
                    localStorage.removeItem(key);
                  }
                }
              }
            };
            
            setInterval(checkMessages, 1000);
          }
        };
        
        if (typeof window !== 'undefined') {
          window.fallbackCommunication = fallbackComm;
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('通信フォールバックに失敗:', error);
      return false;
    }
  }

  /**
   * 権限のフォールバック
   */
  async permissionFallback(errorRecord) {
    console.log('権限フォールバックを実行中...');
    
    try {
      // 機能を制限モードで実行
      const restrictedMode = {
        enabled: true,
        availableFeatures: [],
        restrictions: []
      };
      
      // 利用可能な権限を確認
      if (typeof chrome !== 'undefined') {
        if (chrome.storage) {
          restrictedMode.availableFeatures.push('storage');
        } else {
          restrictedMode.restrictions.push('storage_disabled');
        }
        
        if (chrome.tabs) {
          restrictedMode.availableFeatures.push('tabs');
        } else {
          restrictedMode.restrictions.push('tabs_disabled');
        }
      }
      
      // 制限モード情報を保存
      if (typeof window !== 'undefined') {
        window.extensionRestrictedMode = restrictedMode;
      }
      
      // ユーザーに制限モードを通知
      this.notifyRestrictedMode(restrictedMode);
      
      return true;
    } catch (error) {
      console.error('権限フォールバックに失敗:', error);
      return false;
    }
  }

  /**
   * ストレージのフォールバック
   */
  async storageFallback(errorRecord) {
    console.log('ストレージフォールバックを実行中...');
    
    try {
      // localStorage を使用した代替ストレージ
      if (typeof localStorage !== 'undefined') {
        const fallbackStorage = {
          get: (keys) => {
            return new Promise((resolve) => {
              const result = {};
              const keyArray = Array.isArray(keys) ? keys : [keys];
              
              keyArray.forEach(key => {
                const value = localStorage.getItem(`extension_${key}`);
                if (value) {
                  try {
                    result[key] = JSON.parse(value);
                  } catch {
                    result[key] = value;
                  }
                }
              });
              
              resolve(result);
            });
          },
          
          set: (data) => {
            return new Promise((resolve) => {
              Object.entries(data).forEach(([key, value]) => {
                localStorage.setItem(`extension_${key}`, JSON.stringify(value));
              });
              resolve();
            });
          },
          
          remove: (keys) => {
            return new Promise((resolve) => {
              const keyArray = Array.isArray(keys) ? keys : [keys];
              keyArray.forEach(key => {
                localStorage.removeItem(`extension_${key}`);
              });
              resolve();
            });
          }
        };
        
        if (typeof window !== 'undefined') {
          window.fallbackStorage = fallbackStorage;
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('ストレージフォールバックに失敗:', error);
      return false;
    }
  }

  /**
   * 重要なコンポーネントを無効化
   */
  disableCriticalComponents() {
    console.log('重要なコンポーネントを無効化中...');
    
    try {
      // DOM 監視を停止
      if (typeof window !== 'undefined' && window.popupDetector) {
        if (typeof window.popupDetector.stop === 'function') {
          window.popupDetector.stop();
        }
      }
      
      // 自動処理を停止
      if (typeof window !== 'undefined' && window.autoProcessor) {
        if (typeof window.autoProcessor.disable === 'function') {
          window.autoProcessor.disable();
        }
      }
      
      console.log('重要なコンポーネントが無効化されました');
    } catch (error) {
      console.error('コンポーネント無効化に失敗:', error);
    }
  }

  /**
   * エラー通知
   */
  notifyError(errorRecord) {
    try {
      // Chrome 通知 API を使用
      if (typeof chrome !== 'undefined' && chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'ポップアップブロッカー エラー',
          message: `エラーが発生しました: ${errorRecord.error.message}`
        });
      }
      
      // コンソール通知
      console.error(`[通知] ${errorRecord.type}: ${errorRecord.error.message}`);
    } catch (error) {
      console.error('エラー通知に失敗:', error);
    }
  }

  /**
   * 制限モード通知
   */
  notifyRestrictedMode(restrictedMode) {
    try {
      console.warn('拡張機能が制限モードで動作しています:', restrictedMode);
      
      if (typeof chrome !== 'undefined' && chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'ポップアップブロッカー 制限モード',
          message: '一部の機能が制限されています。詳細はコンソールを確認してください。'
        });
      }
    } catch (error) {
      console.error('制限モード通知に失敗:', error);
    }
  }

  /**
   * エラーログを永続化
   */
  async persistErrorLog() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // 最新の100件のみ保存
        const recentErrors = this.errorLog.slice(-100);
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ errorLog: recentErrors }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }
    } catch (error) {
      console.warn('エラーログの永続化に失敗:', error);
    }
  }

  /**
   * 遅延ユーティリティ
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * エラー統計を取得
   */
  getErrorStatistics() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      bySeverity: {},
      recoveryRate: 0,
      fallbackRate: 0
    };

    let recoveredCount = 0;
    let fallbackCount = 0;

    this.errorLog.forEach(error => {
      // タイプ別統計
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      
      // 重要度別統計
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      
      // 回復・フォールバック統計
      if (error.recovered) recoveredCount++;
      if (error.fallbackUsed) fallbackCount++;
    });

    stats.recoveryRate = stats.total > 0 ? (recoveredCount / stats.total) * 100 : 0;
    stats.fallbackRate = stats.total > 0 ? (fallbackCount / stats.total) * 100 : 0;

    return stats;
  }

  /**
   * エラーログをクリア
   */
  clearErrorLog() {
    this.errorLog = [];
    this.retryAttempts.clear();
    
    // ストレージからも削除
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['errorLog']);
    }
  }
}

// グローバルエラーハンドラーのインスタンスを作成
const globalErrorHandler = new GlobalErrorHandler();

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GlobalErrorHandler, ERROR_TYPES, ERROR_SEVERITY, globalErrorHandler };
} else if (typeof window !== 'undefined') {
  window.GlobalErrorHandler = GlobalErrorHandler;
  window.ERROR_TYPES = ERROR_TYPES;
  window.ERROR_SEVERITY = ERROR_SEVERITY;
  window.globalErrorHandler = globalErrorHandler;
}