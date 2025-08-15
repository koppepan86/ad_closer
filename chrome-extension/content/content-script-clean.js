/**
 * Content Script - Chrome拡張機能のメインコンテンツスクリプト
 * PopupDetectorクラスは popup-detector-safe.js で定義されています
 */

// ユーザー選択ダイアログシステムを読み込み
(function() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content/user-choice-dialog.js');
  script.onload = function() {
    console.log('Content Script: UserChoiceDialog loaded');
  };
  (document.head || document.documentElement).appendChild(script);
})();

// 広告検出通知システム
class AdDetectionNotifier {
    constructor() {
        this.notificationCount = 0;
        this.lastNotificationTime = 0;
        this.notificationThrottle = 3000; // 3秒間隔
        this.setupEventListeners();
    }

    setupEventListeners() {
        // PopupDetectorからの検出イベントをリッスン
        document.addEventListener('popupsDetected', (event) => {
            this.handlePopupDetection(event.detail);
        });

        // 初期化完了イベントをリッスン
        document.addEventListener('popupDetectorInitialized', () => {
            console.log('AdDetectionNotifier: PopupDetector initialized');
        });
    }

    handlePopupDetection(detail) {
        try {
            const { popups, timestamp } = detail;
            
            if (!popups || popups.length === 0) {
                return;
            }

            // 通知のスロットリング
            if (timestamp - this.lastNotificationTime < this.notificationThrottle) {
                console.debug('AdDetectionNotifier: Notification throttled');
                return;
            }

            this.lastNotificationTime = timestamp;
            this.notificationCount++;

            // 通知を表示
            this.showDetectionNotification(popups);

            // バックグラウンドスクリプトに通知
            this.notifyBackground(popups);

            // 統計を更新
            this.updateStatistics(popups);

        } catch (error) {
            console.error('AdDetectionNotifier: Error handling detection:', error);
        }
    }

    showDetectionNotification(popups) {
        try {
            const count = popups.length;
            const message = count === 1 ? 
                '広告要素を1個検出しました' : 
                `広告要素を${count}個検出しました`;

            // ユーザーフィードバックシステムを使用
            if (window.userFeedbackSystem) {
                window.userFeedbackSystem.showInfo(message, {
                    detectedElements: popups.map(p => ({
                        tag: p.element.tagName,
                        id: p.element.id,
                        className: p.element.className,
                        type: p.type
                    }))
                });
            } else {
                // フォールバック: ブラウザ通知
                this.showBrowserNotification(message, popups);
            }

            console.log(`AdDetectionNotifier: ${message}`, popups);

        } catch (error) {
            console.error('AdDetectionNotifier: Error showing notification:', error);
        }
    }

    showBrowserNotification(message, popups) {
        try {
            // Chrome通知APIを使用
            if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                const notificationMessage = {
                    type: 'SHOW_NOTIFICATION',
                    data: {
                        title: 'ポップアップ広告ブロッカー',
                        message: message,
                        iconUrl: 'icons/icon48.png',
                        type: 'basic',
                        priority: 1
                    }
                };

                // Promise を安全に処理
                const result = chrome.runtime.sendMessage(notificationMessage);
                if (result && typeof result.catch === 'function') {
                    result.catch(error => {
                        console.debug('AdDetectionNotifier: Chrome notification failed:', error);
                        this.showFallbackNotification(message);
                    });
                } else {
                    // Promise が返されない場合のフォールバック
                    setTimeout(() => {
                        if (chrome.runtime.lastError) {
                            console.debug('AdDetectionNotifier: Chrome notification failed:', chrome.runtime.lastError);
                            this.showFallbackNotification(message);
                        }
                    }, 100);
                }
            } else {
                this.showFallbackNotification(message);
            }
        } catch (error) {
            console.error('AdDetectionNotifier: Browser notification error:', error);
            this.showFallbackNotification(message);
        }
    }

    showFallbackNotification(message) {
        try {
            // DOM通知を作成
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                z-index: 999999;
                font-family: Arial, sans-serif;
                font-size: 14px;
                max-width: 300px;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
            `;
            notification.textContent = message;

            document.body.appendChild(notification);

            // アニメーション表示
            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(0)';
            }, 100);

            // 自動削除
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 4000);

        } catch (error) {
            console.error('AdDetectionNotifier: Fallback notification error:', error);
        }
    }

    notifyBackground(popups) {
        try {
            if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                const message = {
                    type: 'POPUP_DETECTED',
                    data: {
                        count: popups.length,
                        timestamp: Date.now(),
                        url: window.location.href,
                        domain: window.location.hostname,
                        popups: popups.map(p => ({
                            tag: p.element.tagName,
                            id: p.element.id,
                            className: p.element.className,
                            type: p.type,
                            selector: p.selector,
                            zIndex: p.zIndex
                        }))
                    }
                };

                // Promise を安全に処理
                const result = chrome.runtime.sendMessage(message);
                if (result && typeof result.catch === 'function') {
                    result.catch(error => {
                        console.debug('AdDetectionNotifier: Background notification failed:', error);
                    });
                }
            }
        } catch (error) {
            console.error('AdDetectionNotifier: Background notification error:', error);
        }
    }

    updateStatistics(popups) {
        try {
            if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                const message = {
                    type: 'UPDATE_STATISTICS',
                    data: {
                        detected: popups.length,
                        timestamp: Date.now(),
                        domain: window.location.hostname
                    }
                };

                // Promise を安全に処理
                const result = chrome.runtime.sendMessage(message);
                if (result && typeof result.catch === 'function') {
                    result.catch(error => {
                        console.debug('AdDetectionNotifier: Statistics update failed:', error);
                    });
                }
            }
        } catch (error) {
            console.error('AdDetectionNotifier: Statistics update error:', error);
        }
    }

    getStats() {
        return {
            notificationCount: this.notificationCount,
            lastNotificationTime: this.lastNotificationTime
        };
    }
}

// 安全な要素プロパティ取得関数
function getSafeClassName(element) {
    try {
        return element.className || '';
    } catch (error) {
        console.debug('Error getting className:', error);
        return '';
    }
}

function getSafeId(element) {
    try {
        return element.id || '';
    } catch (error) {
        console.debug('Error getting id:', error);
        return '';
    }
}

function getSafeTextContent(element) {
    try {
        return element.textContent || '';
    } catch (error) {
        console.debug('Error getting textContent:', error);
        return '';
    }
}

/**
 * フレームワーク検出器
 */
class FrameworkDetector {
    constructor() {
        this.detectedFrameworks = new Set();
        this.detectFrameworks();
    }

    detectFrameworks() {
        try {
            // React検出
            if (window.React || document.querySelector('[data-reactroot]')) {
                this.detectedFrameworks.add('react');
            }

            // Vue検出
            if (window.Vue || document.querySelector('[data-v-]')) {
                this.detectedFrameworks.add('vue');
            }

            // Angular検出
            if (window.angular || document.querySelector('[ng-app]')) {
                this.detectedFrameworks.add('angular');
            }

            // jQuery検出
            if (window.jQuery || window.$) {
                this.detectedFrameworks.add('jquery');
            }

            console.log('FrameworkDetector: Detected frameworks:', Array.from(this.detectedFrameworks));
        } catch (error) {
            console.error('FrameworkDetector: Error detecting frameworks:', error);
        }
    }

    hasFramework(framework) {
        return this.detectedFrameworks.has(framework.toLowerCase());
    }

    getDetectedFrameworks() {
        return Array.from(this.detectedFrameworks);
    }
}

/**
 * ユニバーサルポップアップ検出器
 */
class UniversalPopupDetector {
    constructor() {
        this.selectors = [
            '[class*="popup"]',
            '[class*="modal"]',
            '[class*="overlay"]',
            '[class*="dialog"]',
            '[id*="popup"]',
            '[id*="modal"]',
            '[role="dialog"]',
            '.popup',
            '.modal',
            '.overlay'
        ];
    }

    detectPopups() {
        try {
            const detectedElements = [];
            
            for (const selector of this.selectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        if (this.isVisiblePopup(element)) {
                            detectedElements.push({
                                element,
                                selector,
                                type: 'universal'
                            });
                        }
                    }
                } catch (selectorError) {
                    console.debug('UniversalPopupDetector: Selector error:', selector, selectorError);
                }
            }
            
            return detectedElements;
        } catch (error) {
            console.error('UniversalPopupDetector: Detection error:', error);
            return [];
        }
    }

    isVisiblePopup(element) {
        try {
            if (!element) return false;
            
            const style = window.getComputedStyle(element);
            
            // 非表示要素を除外
            if (style.display === 'none' || 
                style.visibility === 'hidden' || 
                style.opacity === '0') {
                return false;
            }
            
            // サイズチェック
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                return false;
            }
            
            return true;
        } catch (error) {
            console.debug('UniversalPopupDetector: Visibility check error:', error);
            return false;
        }
    }
}

/**
 * フォールバック検出器
 */
class FallbackDetector {
    constructor() {
        this.highZIndexThreshold = 1000;
    }

    detectPopups() {
        try {
            const detectedElements = [];
            const allElements = document.querySelectorAll('*');
            
            for (const element of allElements) {
                if (this.isHighZIndexPopup(element)) {
                    detectedElements.push({
                        element,
                        type: 'fallback',
                        zIndex: window.getComputedStyle(element).zIndex
                    });
                }
            }
            
            return detectedElements;
        } catch (error) {
            console.error('FallbackDetector: Detection error:', error);
            return [];
        }
    }

    isHighZIndexPopup(element) {
        try {
            const style = window.getComputedStyle(element);
            const zIndex = parseInt(style.zIndex) || 0;
            
            return zIndex > this.highZIndexThreshold &&
                   (style.position === 'fixed' || style.position === 'absolute') &&
                   style.display !== 'none' &&
                   style.visibility !== 'hidden';
        } catch (error) {
            return false;
        }
    }
}

// コンテンツスクリプトの初期化
function initializePopupDetector() {
    try {
        console.log('Content Script: Initializing PopupDetector...');
        
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
        
        // 既にインスタンスが存在する場合はスキップ
        if (window.popupDetector) {
            console.log('Content Script: PopupDetector instance already exists');
            return;
        }
        
        // PopupDetectorインスタンスを作成
        window.popupDetector = new PopupDetector({
            debugMode: true,
            enableMutationObserver: true,
            enablePeriodicCheck: true
        });
        
        console.log('Content Script: PopupDetector initialized and set globally');
        
        // 初期化完了イベントを待機
        document.addEventListener('popupDetectorInitialized', () => {
            console.log('Content Script: PopupDetector initialization completed');
        });
        
        document.addEventListener('popupDetectorInitializationError', (event) => {
            console.error('Content Script: PopupDetector initialization failed:', event.detail);
        });
        
    } catch (error) {
        console.error('Content Script: Failed to initialize PopupDetector:', error);
        
        // エラーハンドラーに報告
        const errorHandler = window['globalErrorHandler'] || window['GlobalErrorHandler'];
        const errorTypes = window['ERROR_TYPES'] || {};
        const errorSeverity = window['ERROR_SEVERITY'] || {};
        
        if (errorHandler && errorHandler.handleError) {
            errorHandler.handleError(
                error,
                errorTypes.COMPONENT_FAILURE || 'COMPONENT_FAILURE',
                errorSeverity.HIGH || 'HIGH',
                { component: 'popupDetector', operation: 'initialization' }
            );
        }
    }
}

// DOM準備完了後に初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePopupDetector);
} else {
    initializePopupDetector();
}

// AdDetectionNotifierを初期化
let adDetectionNotifier = null;

try {
    adDetectionNotifier = new AdDetectionNotifier();
    window.adDetectionNotifier = adDetectionNotifier;
    console.log('Content Script: AdDetectionNotifier initialized');
} catch (error) {
    console.error('Content Script: Failed to initialize AdDetectionNotifier:', error);
}

console.log('Content Script: Loaded successfully');