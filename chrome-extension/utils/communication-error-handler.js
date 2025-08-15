/**
 * 通信失敗のフォールバックメカニズム
 * Chrome拡張機能のメッセージパッシング用
 */

/**
 * 通信エラーハンドラークラス
 */
class CommunicationErrorHandler {
  constructor() {
    this.messageQueue = new Map();
    this.retryQueue = new Map();
    this.connectionStatus = 'unknown';
    this.maxRetries = 5;
    this.retryDelay = 1000;
    this.maxRetryDelay = 30000;
    this.messageTimeout = 10000;
    this.fallbackStorage = new Map();
    this.listeners = new Map();
    
    this.initializeCommunication();
    this.setupHeartbeat();
  }

  /**
   * 通信システムの初期化
   */
  initializeCommunication() {
    // Chrome runtime の状態を確認
    this.checkRuntimeConnection();
    
    // メッセージリスナーを設定（Chrome API Guardを使用）
    if (typeof window !== 'undefined' && window.safeAddListener) {
      // 安全なaddListener呼び出しを使用
      window.safeAddListener('runtime.onMessage', (message, sender, sendResponse) => {
        this.handleIncomingMessage(message, sender, sendResponse);
        return true; // 非同期レスポンスを示す
      });

      // 接続状態の監視
      window.safeAddListener('runtime.onConnect', (port) => {
        console.log('Runtime connection established');
        this.connectionStatus = 'connected';
        this.processQueuedMessages();
      });

      // Note: runtime.onSuspend is not available in Manifest V3 service workers
      // Service workers can be terminated at any time without warning
      // Instead, we rely on periodic connection checks and error handling
      
      // Note: runtime.onStartup and runtime.onInstalled are only available in background scripts
      // In content scripts, we rely on message-based communication and periodic checks
    } else {
      // フォールバック: 従来の方法
      if (typeof chrome !== 'undefined' && 
          chrome.runtime && 
          chrome.runtime.onMessage && 
          typeof chrome.runtime.onMessage.addListener === 'function') {
        try {
          chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleIncomingMessage(message, sender, sendResponse);
            return true;
          });

          if (chrome.runtime.onConnect && typeof chrome.runtime.onConnect.addListener === 'function') {
            chrome.runtime.onConnect.addListener((port) => {
              console.log('Runtime connection established');
              this.connectionStatus = 'connected';
              this.processQueuedMessages();
            });
          }

          // Note: runtime.onSuspend is not available in Manifest V3 service workers
          // Service workers are ephemeral and can be terminated without warning
          
          // Note: runtime.onStartup and runtime.onInstalled are only available in background scripts
          // In content scripts, we rely on message-based communication and periodic checks
        } catch (error) {
          console.error('Communication Error Handler: Failed to register listeners:', error);
        }
      } else {
        console.warn('Communication Error Handler: Chrome runtime APIs not available');
      }
    }

    // ページアンロード時のクリーンアップ
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
  }

  /**
   * ハートビートシステムの設定
   */
  setupHeartbeat() {
    // 定期的な接続確認（30秒間隔）
    setInterval(() => {
      this.checkRuntimeConnection();
    }, 30000);
  }

  /**
   * Runtime 接続状態を確認
   */
  async checkRuntimeConnection() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        // 簡単な ping テスト
        const response = await this.sendMessageWithTimeout({
          type: 'PING',
          timestamp: Date.now()
        }, 5000);
        
        this.connectionStatus = response ? 'connected' : 'disconnected';
      } else {
        this.connectionStatus = 'unavailable';
      }
    } catch (error) {
      console.debug('Runtime connection check failed:', error);
      this.connectionStatus = 'disconnected';
    }
  }

  /**
   * 安全なメッセージ送信
   */
  async sendMessage(message, options = {}) {
    const messageId = this.generateMessageId();
    const messageWithId = {
      ...message,
      _messageId: messageId,
      _timestamp: Date.now()
    };

    try {
      // 接続状態を確認
      if (this.connectionStatus === 'disconnected' || this.connectionStatus === 'unavailable') {
        throw new Error('Runtime connection not available');
      }

      // タイムアウト付きでメッセージを送信
      const response = await this.sendMessageWithTimeout(messageWithId, options.timeout || this.messageTimeout);
      
      // 成功した場合、再試行キューから削除
      this.retryQueue.delete(messageId);
      
      return response;
    } catch (error) {
      console.warn('Message sending failed:', error);
      
      // 再試行可能なエラーの場合、キューに追加
      if (this.isRetryableError(error) && !options.noRetry) {
        this.queueForRetry(messageWithId, options);
      }
      
      // フォールバック機能を試行
      if (options.fallback !== false) {
        return await this.tryFallbackCommunication(messageWithId, options);
      }
      
      throw error;
    }
  }

  /**
   * タイムアウト付きメッセージ送信
   */
  sendMessageWithTimeout(message, timeout = this.messageTimeout) {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime) {
        reject(new Error('Chrome runtime not available'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeout);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * 再試行可能なエラーかチェック
   */
  isRetryableError(error) {
    const retryableErrors = [
      'Could not establish connection',
      'Extension context invalidated',
      'Message timeout',
      'The message port closed before a response was received'
    ];

    return retryableErrors.some(retryableError => 
      error.message.includes(retryableError)
    );
  }

  /**
   * メッセージを再試行キューに追加
   */
  queueForRetry(message, options = {}) {
    const messageId = message._messageId;
    const currentRetries = this.retryQueue.get(messageId)?.retries || 0;
    
    if (currentRetries >= this.maxRetries) {
      console.warn(`Max retries reached for message: ${messageId}`);
      return;
    }

    const retryDelay = Math.min(
      this.retryDelay * Math.pow(2, currentRetries), // 指数バックオフ
      this.maxRetryDelay
    );

    this.retryQueue.set(messageId, {
      message,
      options,
      retries: currentRetries + 1,
      nextRetry: Date.now() + retryDelay
    });

    // 再試行をスケジュール
    setTimeout(() => {
      this.processRetryQueue();
    }, retryDelay);

    console.debug(`Message queued for retry: ${messageId}, attempt: ${currentRetries + 1}`);
  }

  /**
   * 再試行キューを処理
   */
  async processRetryQueue() {
    const now = Date.now();
    
    for (const [messageId, retryInfo] of this.retryQueue.entries()) {
      if (now >= retryInfo.nextRetry) {
        try {
          console.debug(`Retrying message: ${messageId}`);
          const response = await this.sendMessage(retryInfo.message, {
            ...retryInfo.options,
            noRetry: true // 無限ループを防ぐ
          });
          
          // 成功した場合、キューから削除
          this.retryQueue.delete(messageId);
          
          // 元のコールバックがあれば呼び出し
          if (retryInfo.options.callback) {
            retryInfo.options.callback(null, response);
          }
        } catch (error) {
          console.debug(`Retry failed for message: ${messageId}`, error);
          
          // 最大再試行回数に達した場合
          if (retryInfo.retries >= this.maxRetries) {
            this.retryQueue.delete(messageId);
            
            if (retryInfo.options.callback) {
              retryInfo.options.callback(error, null);
            }
          }
        }
      }
    }
  }

  /**
   * フォールバック通信を試行
   */
  async tryFallbackCommunication(message, options = {}) {
    console.log('Trying fallback communication methods...');
    
    try {
      // 方法1: ローカルストレージを使用した通信
      const storageResult = await this.tryStorageCommunication(message, options);
      if (storageResult) {
        return storageResult;
      }

      // 方法2: DOM イベントを使用した通信
      const eventResult = await this.tryEventCommunication(message, options);
      if (eventResult) {
        return eventResult;
      }

      // 方法3: ポーリングベースの通信
      const pollingResult = await this.tryPollingCommunication(message, options);
      if (pollingResult) {
        return pollingResult;
      }

      throw new Error('All fallback communication methods failed');
    } catch (error) {
      console.error('Fallback communication failed:', error);
      
      // エラーハンドラーに報告
      if (typeof window !== 'undefined' && window.globalErrorHandler) {
        window.globalErrorHandler.handleError(
          error,
          window.ERROR_TYPES.COMMUNICATION,
          window.ERROR_SEVERITY.HIGH,
          { messageType: message.type, fallback: true }
        );
      }
      
      throw error;
    }
  }

  /**
   * ストレージベースの通信
   */
  async tryStorageCommunication(message, options = {}) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const messageId = message._messageId;
        const storageKey = `comm_${messageId}`;
        
        // メッセージをストレージに保存
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({
            [storageKey]: {
              message,
              timestamp: Date.now(),
              status: 'pending'
            }
          }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });

        // レスポンスを待機（ポーリング）
        const response = await this.waitForStorageResponse(storageKey, options.timeout || 10000);
        
        // クリーンアップ
        chrome.storage.local.remove([storageKey, `${storageKey}_response`]);
        
        return response;
      }
      
      return null;
    } catch (error) {
      console.debug('Storage communication failed:', error);
      return null;
    }
  }

  /**
   * ストレージレスポンスを待機
   */
  waitForStorageResponse(storageKey, timeout) {
    return new Promise((resolve, reject) => {
      const responseKey = `${storageKey}_response`;
      const startTime = Date.now();
      
      const checkResponse = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Storage communication timeout'));
          return;
        }

        chrome.storage.local.get([responseKey], (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (result[responseKey]) {
            resolve(result[responseKey]);
          } else {
            setTimeout(checkResponse, 100);
          }
        });
      };

      checkResponse();
    });
  }

  /**
   * DOM イベントベースの通信
   */
  async tryEventCommunication(message, options = {}) {
    try {
      if (typeof document !== 'undefined') {
        const messageId = message._messageId;
        
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            document.removeEventListener(`comm_response_${messageId}`, responseHandler);
            reject(new Error('Event communication timeout'));
          }, options.timeout || 10000);

          const responseHandler = (event) => {
            clearTimeout(timeout);
            document.removeEventListener(`comm_response_${messageId}`, responseHandler);
            resolve(event.detail);
          };

          document.addEventListener(`comm_response_${messageId}`, responseHandler);

          // カスタムイベントを発火
          const event = new CustomEvent('extension_message', {
            detail: message
          });
          document.dispatchEvent(event);
        });
      }
      
      return null;
    } catch (error) {
      console.debug('Event communication failed:', error);
      return null;
    }
  }

  /**
   * ポーリングベースの通信
   */
  async tryPollingCommunication(message, options = {}) {
    try {
      // フォールバックストレージにメッセージを保存
      const messageId = message._messageId;
      this.fallbackStorage.set(messageId, {
        message,
        timestamp: Date.now(),
        status: 'pending'
      });

      // ポーリングでレスポンスを待機
      const response = await this.pollForResponse(messageId, options.timeout || 10000);
      
      // クリーンアップ
      this.fallbackStorage.delete(messageId);
      this.fallbackStorage.delete(`${messageId}_response`);
      
      return response;
    } catch (error) {
      console.debug('Polling communication failed:', error);
      return null;
    }
  }

  /**
   * ポーリングでレスポンスを待機
   */
  pollForResponse(messageId, timeout) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const responseKey = `${messageId}_response`;
      
      const poll = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Polling communication timeout'));
          return;
        }

        const response = this.fallbackStorage.get(responseKey);
        if (response) {
          resolve(response);
        } else {
          setTimeout(poll, 200);
        }
      };

      poll();
    });
  }

  /**
   * 受信メッセージを処理
   */
  handleIncomingMessage(message, sender, sendResponse) {
    try {
      // メッセージタイプに応じた処理
      if (message.type === 'PING') {
        sendResponse({ pong: true, timestamp: Date.now() });
        return;
      }

      // 登録されたリスナーを呼び出し
      const listeners = this.listeners.get(message.type) || [];
      
      if (listeners.length === 0) {
        console.debug(`No listeners for message type: ${message.type}`);
        sendResponse({ error: 'No handler found' });
        return;
      }

      // 最初のリスナーを呼び出し（複数ある場合は最初のもの）
      const listener = listeners[0];
      
      try {
        const result = listener(message, sender);
        
        // Promise の場合は待機
        if (result && typeof result.then === 'function') {
          result
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ error: error.message }));
        } else {
          sendResponse(result);
        }
      } catch (error) {
        console.error('Message listener error:', error);
        sendResponse({ error: error.message });
      }
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({ error: 'Message handling failed' });
    }
  }

  /**
   * メッセージリスナーを追加
   */
  addMessageListener(messageType, listener) {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, []);
    }
    
    this.listeners.get(messageType).push(listener);
  }

  /**
   * メッセージリスナーを削除
   */
  removeMessageListener(messageType, listener) {
    const listeners = this.listeners.get(messageType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * キューに入っているメッセージを処理
   */
  async processQueuedMessages() {
    console.log('Processing queued messages...');
    
    // 再試行キューを処理
    await this.processRetryQueue();
    
    // 通常のメッセージキューを処理
    for (const [messageId, messageInfo] of this.messageQueue.entries()) {
      try {
        const response = await this.sendMessage(messageInfo.message, messageInfo.options);
        
        if (messageInfo.callback) {
          messageInfo.callback(null, response);
        }
        
        this.messageQueue.delete(messageId);
      } catch (error) {
        console.error(`Queued message processing failed: ${messageId}`, error);
        
        if (messageInfo.callback) {
          messageInfo.callback(error, null);
        }
      }
    }
  }

  /**
   * メッセージIDを生成
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 通信統計を取得
   */
  getCommunicationStatistics() {
    return {
      connectionStatus: this.connectionStatus,
      queuedMessages: this.messageQueue.size,
      retryQueue: this.retryQueue.size,
      fallbackStorage: this.fallbackStorage.size,
      registeredListeners: Array.from(this.listeners.keys())
    };
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    // キューをクリア
    this.messageQueue.clear();
    this.retryQueue.clear();
    this.fallbackStorage.clear();
    
    // リスナーをクリア
    this.listeners.clear();
    
    console.log('Communication error handler cleaned up');
  }
}

// グローバルインスタンスを作成
const communicationErrorHandler = new CommunicationErrorHandler();

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CommunicationErrorHandler, communicationErrorHandler };
} else if (typeof window !== 'undefined') {
  window.CommunicationErrorHandler = CommunicationErrorHandler;
  window.communicationErrorHandler = communicationErrorHandler;
}