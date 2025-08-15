/**
 * Extension Context Guard
 * Chrome拡張機能のコンテキスト無効化エラーを防ぐためのユーティリティ
 */

class ExtensionContextGuard {
    constructor() {
        this.contextValid = true;
        this.invalidationCallbacks = new Set();
        this.setupContextMonitoring();
    }

    /**
     * コンテキスト監視を設定
     */
    setupContextMonitoring() {
        // Extension context の状態を定期的にチェック（頻度を下げる）
        this.contextCheckInterval = setInterval(() => {
            this.checkContextValidity();
        }, 10000); // 10秒間隔に変更

        // Page unload 時のクリーンアップ
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Extension の無効化を検出
        this.detectExtensionInvalidation();
    }

    /**
     * Extension の無効化を検出
     */
    detectExtensionInvalidation() {
        // Chrome runtime の状態を監視
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            // Runtime の onSuspend イベントを監視（可能な場合）
            try {
                if (chrome.runtime.onSuspend) {
                    chrome.runtime.onSuspend.addListener(() => {
                        console.debug('Extension context: onSuspend detected');
                        this.handleContextInvalidation();
                    });
                }
            } catch (error) {
                console.debug('Cannot listen to onSuspend:', error);
            }

            // Runtime connect の状態を監視
            try {
                const port = chrome.runtime.connect({ name: 'context-monitor' });
                port.onDisconnect.addListener(() => {
                    if (chrome.runtime.lastError) {
                        console.debug('Extension context: Port disconnected:', chrome.runtime.lastError.message);
                        if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                            this.handleContextInvalidation();
                        }
                    }
                });
            } catch (error) {
                console.debug('Cannot create monitoring port:', error);
            }
        }
    }

    /**
     * コンテキストの有効性をチェック
     */
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
                // 非同期でテストメッセージを送信（レスポンスは期待しない）
                chrome.runtime.sendMessage({ type: 'CONTEXT_CHECK', timestamp: Date.now() }, (response) => {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message;
                        if (errorMessage && errorMessage.includes('Extension context invalidated')) {
                            console.debug('Extension context: Context invalidation detected via message test');
                            this.handleContextInvalidation();
                        } else {
                            console.debug('Extension context: Message test error (non-critical):', errorMessage);
                        }
                    }
                });
            } catch (messageError) {
                const errorMessage = messageError.message || String(messageError);
                if (errorMessage.includes('Extension context invalidated')) {
                    console.debug('Extension context: Context invalidation detected via message exception');
                    this.handleContextInvalidation();
                    return false;
                } else {
                    console.debug('Extension context: Message test exception (non-critical):', errorMessage);
                }
            }

            return true;
        } catch (error) {
            console.debug('Extension context: Validity check error:', error);
            // 一般的なエラーでは無効化しない（false positiveを避ける）
            return true;
        }
    }

    /**
     * コンテキスト無効化を処理
     */
    handleContextInvalidation() {
        if (this.contextValid) {
            this.contextValid = false;
            console.info('Extension context has been invalidated (extension was likely reloaded or updated)');
            
            // 登録されたコールバックを実行
            this.invalidationCallbacks.forEach(callback => {
                try {
                    callback();
                } catch (error) {
                    console.error('Error in invalidation callback:', error);
                }
            });

            // 拡張機能の動作を停止
            this.stopExtensionOperations();
            
            // クリーンアップを実行
            this.cleanup();
        }
    }

    /**
     * 拡張機能の動作を停止
     */
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

    /**
     * コンテキスト無効化時のコールバックを登録
     * @param {Function} callback - 無効化時に実行するコールバック
     */
    onInvalidation(callback) {
        if (typeof callback === 'function') {
            this.invalidationCallbacks.add(callback);
        }
    }

    /**
     * コンテキスト無効化時のコールバックを削除
     * @param {Function} callback - 削除するコールバック
     */
    offInvalidation(callback) {
        this.invalidationCallbacks.delete(callback);
    }

    /**
     * コンテキストが有効かどうかを取得
     * @returns {boolean} コンテキストが有効な場合true
     */
    isValid() {
        return this.contextValid;
    }

    /**
     * 操作を続行すべきかどうかを判定
     * @returns {boolean} 操作を続行すべき場合true
     */
    shouldContinueOperation() {
        if (!this.contextValid) {
            console.debug('Extension context: Operation skipped due to invalid context');
            return false;
        }
        return true;
    }

    /**
     * 安全にChrome APIを実行
     * @param {Function} operation - 実行する操作
     * @param {string} operationName - 操作名（ログ用）
     * @returns {Promise} 操作の結果
     */
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

    /**
     * 安全なChrome Runtime メッセージ送信
     * @param {Object} message - 送信するメッセージ
     * @param {string} context - エラー発生時のコンテキスト
     * @returns {Promise} 送信結果のPromise
     */
    async safeSendMessage(message, context = 'unknown') {
        if (!this.isValid()) {
            console.debug(`Extension context invalid, skipping message in ${context}`);
            return { success: false, error: 'Extension context invalidated' };
        }

        try {
            return await new Promise((resolve) => {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        const error = chrome.runtime.lastError.message;
                        if (error.includes('Extension context invalidated')) {
                            console.debug(`Extension context invalidated in ${context}`);
                            this.handleContextInvalidation();
                        } else {
                            console.warn(`Runtime error in ${context}:`, error);
                        }
                        resolve({ success: false, error });
                    } else {
                        resolve(response || { success: true });
                    }
                });
            });
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.debug(`Extension context invalidated during message send in ${context}`);
                this.handleContextInvalidation();
            } else {
                console.error(`Error sending message in ${context}:`, error);
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * 安全なChrome Storage アクセス
     * @param {string} operation - 操作タイプ ('get', 'set', 'remove')
     * @param {*} data - 操作データ
     * @param {string} context - エラー発生時のコンテキスト
     * @returns {Promise} 操作結果のPromise
     */
    async safeStorageAccess(operation, data, context = 'unknown') {
        if (!this.isValid()) {
            console.debug(`Extension context invalid, skipping storage ${operation} in ${context}`);
            return { success: false, error: 'Extension context invalidated' };
        }

        try {
            if (!chrome.storage || !chrome.storage.local) {
                return { success: false, error: 'Chrome storage not available' };
            }

            return await new Promise((resolve) => {
                const callback = (result) => {
                    if (chrome.runtime.lastError) {
                        const error = chrome.runtime.lastError.message;
                        if (error.includes('Extension context invalidated')) {
                            console.debug(`Extension context invalidated during storage ${operation} in ${context}`);
                            this.handleContextInvalidation();
                        }
                        resolve({ success: false, error });
                    } else {
                        resolve({ success: true, data: result });
                    }
                };

                switch (operation) {
                    case 'get':
                        chrome.storage.local.get(data, callback);
                        break;
                    case 'set':
                        chrome.storage.local.set(data, callback);
                        break;
                    case 'remove':
                        chrome.storage.local.remove(data, callback);
                        break;
                    default:
                        resolve({ success: false, error: 'Unknown storage operation' });
                }
            });
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.debug(`Extension context invalidated during storage ${operation} in ${context}`);
                this.handleContextInvalidation();
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * クリーンアップ処理
     */
    cleanup() {
        if (this.contextCheckInterval) {
            clearInterval(this.contextCheckInterval);
            this.contextCheckInterval = null;
        }

        // コールバックをクリア
        this.invalidationCallbacks.clear();

        console.debug('Extension Context Guard cleaned up');
    }

    /**
     * デバッグ情報を出力
     */
    debug() {
        console.group('Extension Context Guard Debug');
        console.log('Context Valid:', this.contextValid);
        console.log('Chrome Runtime Available:', !!(typeof chrome !== 'undefined' && chrome.runtime));
        console.log('Runtime ID:', chrome?.runtime?.id);
        console.log('Invalidation Callbacks:', this.invalidationCallbacks.size);
        console.log('Current URL:', window.location.href);
        console.log('Timestamp:', new Date().toISOString());
        console.groupEnd();
    }
}

// グローバルインスタンスを作成
const extensionContextGuard = new ExtensionContextGuard();

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExtensionContextGuard, extensionContextGuard };
} else if (typeof window !== 'undefined') {
    window.ExtensionContextGuard = ExtensionContextGuard;
    window.extensionContextGuard = extensionContextGuard;
}