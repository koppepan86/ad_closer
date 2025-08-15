/**
 * 検出頻度制限機能
 * バックグラウンドタブでの検出完全停止と1分間30回の制限を実装
 */

class DetectionThrottler {
    constructor() {
        // 設定値
        this.maxDetectionsPerMinute = 30;  // 1分間の最大検出回数
        this.detectionCount = 0;           // 現在の分での検出回数
        this.lastResetTime = Date.now();   // 最後にカウンターをリセットした時刻
        this.isBackgroundTab = document.hidden; // タブがバックグラウンドかどうか
        
        // 統計情報
        this.statistics = {
            totalDetections: 0,
            blockedDetections: 0,
            backgroundBlocks: 0,
            limitBlocks: 0
        };
        
        // タブ状態の監視を開始
        this.setupTabStateMonitoring();
        
        console.info('DetectionThrottler initialized', {
            maxPerMinute: this.maxDetectionsPerMinute,
            isBackground: this.isBackgroundTab
        });
    }

    /**
     * タブ状態の監視を設定
     */
    setupTabStateMonitoring() {
        // Page Visibility API を使用
        document.addEventListener('visibilitychange', () => {
            const wasBackground = this.isBackgroundTab;
            this.isBackgroundTab = document.hidden;
            
            if (wasBackground !== this.isBackgroundTab) {
                if (this.isBackgroundTab) {
                    console.info('DetectionThrottler: Tab went to background - all detection stopped');
                    this.stopAllDetection();
                } else {
                    console.info('DetectionThrottler: Tab became active - detection resumed');
                    this.resumeDetection();
                }
            }
        });

        // フォールバック: focus/blur イベント
        window.addEventListener('blur', () => {
            if (!document.hidden) { // Page Visibility APIが利用できない場合のフォールバック
                this.isBackgroundTab = true;
                console.info('DetectionThrottler: Window lost focus - detection stopped (fallback)');
                this.stopAllDetection();
            }
        });

        window.addEventListener('focus', () => {
            if (!document.hidden) {
                this.isBackgroundTab = false;
                console.info('DetectionThrottler: Window gained focus - detection resumed (fallback)');
                this.resumeDetection();
            }
        });
    }

    /**
     * 検出実行可能かどうかをチェック
     * @param {string} detectionType - 検出タイプ（'periodic', 'mutation', 'performance'など）
     * @returns {boolean} 検出実行可能な場合true
     */
    canDetect(detectionType = 'unknown') {
        // バックグラウンドタブでは完全に停止
        if (this.isBackgroundTab) {
            this.statistics.blockedDetections++;
            this.statistics.backgroundBlocks++;
            console.debug(`DetectionThrottler: ${detectionType} detection blocked (background tab)`);
            return false;
        }

        // 1分間の制限をチェック
        const now = Date.now();
        if (now - this.lastResetTime >= 60000) {
            // 新しい分が開始された場合、カウンターをリセット
            this.detectionCount = 0;
            this.lastResetTime = now;
            console.debug('DetectionThrottler: Detection counter reset for new minute');
        }

        // 制限に達している場合は拒否
        if (this.detectionCount >= this.maxDetectionsPerMinute) {
            this.statistics.blockedDetections++;
            this.statistics.limitBlocks++;
            console.debug(`DetectionThrottler: ${detectionType} detection blocked (limit reached: ${this.detectionCount}/${this.maxDetectionsPerMinute})`);
            return false;
        }

        return true;
    }

    /**
     * 検出実行を記録
     * @param {string} detectionType - 検出タイプ
     */
    recordDetection(detectionType = 'unknown') {
        if (!this.isBackgroundTab) {
            this.detectionCount++;
            this.statistics.totalDetections++;
            
            console.debug(`DetectionThrottler: ${detectionType} detection recorded (${this.detectionCount}/${this.maxDetectionsPerMinute})`);
            
            // 制限に近づいた場合の警告
            if (this.detectionCount >= this.maxDetectionsPerMinute * 0.8) {
                console.warn(`DetectionThrottler: Approaching detection limit (${this.detectionCount}/${this.maxDetectionsPerMinute})`);
            }
        }
    }

    /**
     * 現在の検出状況を取得
     * @returns {Object} 検出状況の詳細
     */
    getStatus() {
        const now = Date.now();
        const timeUntilReset = 60000 - (now - this.lastResetTime);
        
        return {
            isActive: !this.isBackgroundTab,
            currentCount: this.detectionCount,
            maxCount: this.maxDetectionsPerMinute,
            remaining: Math.max(0, this.maxDetectionsPerMinute - this.detectionCount),
            timeUntilReset: Math.max(0, timeUntilReset),
            statistics: { ...this.statistics }
        };
    }

    /**
     * MutationObserverを安全に切断
     */
    safeDisconnectObserver(observer, context = '') {
        if (!observer) {
            return false;
        }
        
        if (typeof observer.disconnect === 'function') {
            try {
                observer.disconnect();
                console.debug(`DetectionThrottler: Observer disconnected${context ? ' (' + context + ')' : ''}`);
                return true;
            } catch (error) {
                console.warn(`DetectionThrottler: Failed to disconnect observer${context ? ' (' + context + ')' : ''}:`, error);
                return false;
            }
        } else {
            console.debug(`DetectionThrottler: Observer exists but disconnect method not available${context ? ' (' + context + ')' : ''}`);
            return false;
        }
    }

    /**
     * 全ての検出を停止
     */
    stopAllDetection() {
        // PopupDetectorの定期検出を停止
        if (window.popupDetector && window.popupDetector.periodicCheckInterval) {
            clearInterval(window.popupDetector.periodicCheckInterval);
            window.popupDetector.periodicCheckInterval = null;
            console.debug('DetectionThrottler: Periodic detection stopped');
        }

        // MutationObserverを停止
        if (window.popupDetector && window.popupDetector.observer) {
            this.safeDisconnectObserver(window.popupDetector.observer, 'stop');
        }

        // Performance Optimizerを一時停止
        if (window.performanceOptimizer && typeof window.performanceOptimizer.pause === 'function') {
            window.performanceOptimizer.pause();
            console.debug('DetectionThrottler: Performance optimizer paused');
        }

        // Component Recovery Managerのヘルスチェックを停止
        if (window.componentRecoveryManager && window.componentRecoveryManager.healthCheckInterval) {
            clearInterval(window.componentRecoveryManager.healthCheckInterval);
            console.debug('DetectionThrottler: Component health checks stopped');
        }
    }

    /**
     * 検出を再開
     */
    resumeDetection() {
        // PopupDetectorの定期検出を再開
        if (window.PopupDetectorGuard && typeof window.PopupDetectorGuard.safeSetupPeriodicCheck === 'function') {
            try {
                window.PopupDetectorGuard.safeSetupPeriodicCheck();
                console.debug('DetectionThrottler: Periodic detection resumed via Guard');
            } catch (error) {
                console.warn('DetectionThrottler: Failed to resume periodic detection via Guard:', error);
            }
        } else if (window.popupDetector && !window.popupDetector.periodicCheckInterval && typeof window.popupDetector.setupPeriodicCheck === 'function') {
            try {
                window.popupDetector.setupPeriodicCheck();
                console.debug('DetectionThrottler: Periodic detection resumed directly');
            } catch (error) {
                console.warn('DetectionThrottler: Failed to resume periodic detection:', error);
            }
        } else if (window.popupDetector && window.popupDetector.periodicCheckInterval) {
            console.debug('DetectionThrottler: Periodic detection already running');
        }

        // MutationObserverを再開
        if (window.PopupDetectorGuard && typeof window.PopupDetectorGuard.safeSetupMutationObserver === 'function') {
            try {
                // 既存のobserverがある場合は一度切断してから再設定
                if (window.popupDetector && window.popupDetector.observer) {
                    this.safeDisconnectObserver(window.popupDetector.observer, 'resume via Guard');
                }
                
                window.PopupDetectorGuard.safeSetupMutationObserver();
                console.debug('DetectionThrottler: MutationObserver resumed via Guard');
            } catch (error) {
                console.warn('DetectionThrottler: Failed to resume MutationObserver via Guard:', error);
            }
        } else if (window.popupDetector && typeof window.popupDetector.setupMutationObserver === 'function') {
            try {
                // 既存のobserverがある場合は一度切断してから再設定
                if (window.popupDetector.observer) {
                    this.safeDisconnectObserver(window.popupDetector.observer, 'resume direct');
                }
                
                window.popupDetector.setupMutationObserver();
                console.debug('DetectionThrottler: MutationObserver resumed directly');
            } catch (error) {
                console.warn('DetectionThrottler: Failed to resume MutationObserver:', error);
            }
        } else {
            console.debug('DetectionThrottler: No suitable method found to resume MutationObserver');
        }

        // Performance Optimizerを再開
        if (window.performanceOptimizer && typeof window.performanceOptimizer.resume === 'function') {
            window.performanceOptimizer.resume();
            console.debug('DetectionThrottler: Performance optimizer resumed');
        }

        // Component Recovery Managerのヘルスチェックを再開
        if (window.componentRecoveryManager && !window.componentRecoveryManager.healthCheckInterval) {
            window.componentRecoveryManager.setupHealthMonitoring();
            console.debug('DetectionThrottler: Component health checks resumed');
        }
    }

    /**
     * 設定を更新
     * @param {Object} config - 新しい設定
     */
    updateConfig(config) {
        if (config.maxDetectionsPerMinute && config.maxDetectionsPerMinute > 0) {
            this.maxDetectionsPerMinute = config.maxDetectionsPerMinute;
            console.info('DetectionThrottler: Max detections per minute updated to', this.maxDetectionsPerMinute);
        }
    }

    /**
     * 統計情報をリセット
     */
    resetStatistics() {
        this.statistics = {
            totalDetections: 0,
            blockedDetections: 0,
            backgroundBlocks: 0,
            limitBlocks: 0
        };
        console.info('DetectionThrottler: Statistics reset');
    }

    /**
     * デバッグ情報を出力
     */
    debug() {
        const status = this.getStatus();
        console.group('DetectionThrottler Debug Information');
        console.log('Current Status:', status);
        console.log('Tab State:', {
            isBackground: this.isBackgroundTab,
            documentHidden: document.hidden,
            documentVisibilityState: document.visibilityState
        });
        console.log('Timing:', {
            lastResetTime: new Date(this.lastResetTime).toLocaleTimeString(),
            timeUntilReset: `${Math.round(status.timeUntilReset / 1000)}s`
        });
        console.groupEnd();
    }

    /**
     * クリーンアップ処理
     */
    cleanup() {
        // イベントリスナーを削除
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('blur', this.handleBlur);
        window.removeEventListener('focus', this.handleFocus);
        
        console.debug('DetectionThrottler: Cleanup completed');
    }
}

// グローバルインスタンスを作成
const detectionThrottler = new DetectionThrottler();

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DetectionThrottler, detectionThrottler };
} else if (typeof window !== 'undefined') {
    window.DetectionThrottler = DetectionThrottler;
    window.detectionThrottler = detectionThrottler;
}