/**
 * Promise エラーハンドラー
 * undefinedのcatchエラーを防ぐためのユーティリティ
 */

class PromiseErrorHandler {
    constructor() {
        this.setupGlobalErrorHandling();
    }

    /**
     * グローバルエラーハンドリングを設定
     */
    setupGlobalErrorHandling() {
        // Unhandled Promise Rejection を捕捉
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled Promise Rejection:', event.reason);
            
            // 特定のエラーパターンをチェック
            if (event.reason && event.reason.message) {
                if (event.reason.message.includes("Cannot read properties of undefined (reading 'catch')")) {
                    console.warn('Promise catch error detected - likely undefined Promise');
                    event.preventDefault(); // エラーの伝播を防ぐ
                }
            }
        });

        // Global Error Handler
        window.addEventListener('error', (event) => {
            if (event.error && event.error.message) {
                if (event.error.message.includes("Cannot read properties of undefined (reading 'catch')")) {
                    console.error('Catch method error:', {
                        message: event.error.message,
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno
                    });
                    
                    // エラーの詳細をログ出力
                    this.logCatchError(event);
                }
            }
        });
    }

    /**
     * Catchエラーの詳細をログ出力
     * @param {ErrorEvent} event - エラーイベント
     */
    logCatchError(event) {
        console.group('Promise Catch Error Details');
        console.log('Error Message:', event.error.message);
        console.log('File:', event.filename);
        console.log('Line:', event.lineno);
        console.log('Column:', event.colno);
        console.log('Stack:', event.error.stack);
        console.log('Timestamp:', new Date().toISOString());
        console.log('URL:', window.location.href);
        console.groupEnd();
    }

    /**
     * 安全なPromise実行
     * @param {Function} promiseFunction - Promise を返す関数
     * @param {string} context - エラー発生時のコンテキスト
     * @returns {Promise} 安全に実行されるPromise
     */
    static safePromise(promiseFunction, context = 'unknown') {
        try {
            const result = promiseFunction();
            
            // 結果がPromiseかどうかをチェック
            if (result && typeof result.then === 'function') {
                return result.catch(error => {
                    console.warn(`Promise error in ${context}:`, error);
                    return { success: false, error: error.message };
                });
            } else {
                console.warn(`Function in ${context} did not return a Promise:`, typeof result);
                return Promise.resolve({ success: false, error: 'Not a Promise' });
            }
        } catch (error) {
            console.error(`Error executing promise function in ${context}:`, error);
            return Promise.resolve({ success: false, error: error.message });
        }
    }

    /**
     * 安全なcatch実行
     * @param {*} promiseOrValue - Promise または値
     * @param {Function} catchHandler - catchハンドラー
     * @param {string} context - エラー発生時のコンテキスト
     */
    static safeCatch(promiseOrValue, catchHandler, context = 'unknown') {
        try {
            if (promiseOrValue && typeof promiseOrValue.catch === 'function') {
                promiseOrValue.catch(error => {
                    try {
                        catchHandler(error);
                    } catch (handlerError) {
                        console.error(`Error in catch handler for ${context}:`, handlerError);
                    }
                });
            } else {
                console.debug(`Value in ${context} is not a Promise with catch method:`, typeof promiseOrValue);
            }
        } catch (error) {
            console.error(`Error setting up catch for ${context}:`, error);
        }
    }

    /**
     * Chrome Runtime SendMessage の安全なラッパー
     * @param {Object} message - 送信するメッセージ
     * @param {string} context - エラー発生時のコンテキスト
     * @returns {Promise} 安全に実行されるPromise
     */
    static safeSendMessage(message, context = 'unknown') {
        return new Promise((resolve, reject) => {
            try {
                if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                    console.warn(`Chrome runtime not available in ${context}`);
                    resolve({ success: false, error: 'Chrome runtime not available' });
                    return;
                }

                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn(`Chrome runtime error in ${context}:`, chrome.runtime.lastError);
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve(response || { success: true });
                    }
                });
            } catch (error) {
                console.error(`Error sending message in ${context}:`, error);
                resolve({ success: false, error: error.message });
            }
        });
    }

    /**
     * デバッグ情報を出力
     */
    debug() {
        console.group('Promise Error Handler Debug');
        console.log('Global error handlers set up');
        console.log('Current URL:', window.location.href);
        console.log('Chrome runtime available:', !!(typeof chrome !== 'undefined' && chrome.runtime));
        console.log('Timestamp:', new Date().toISOString());
        console.groupEnd();
    }
}

// グローバルインスタンスを作成
const promiseErrorHandler = new PromiseErrorHandler();

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PromiseErrorHandler, promiseErrorHandler };
} else if (typeof window !== 'undefined') {
    window.PromiseErrorHandler = PromiseErrorHandler;
    window.promiseErrorHandler = promiseErrorHandler;
}