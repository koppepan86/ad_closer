/**
 * ログとデバッグシステムの統合スクリプト
 * 既存のコンポーネントにログ機能を統合
 */

(function() {
  'use strict';

  // ログシステムが読み込まれるまで待機
  function waitForLogSystem() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (typeof window !== 'undefined' && 
            window.globalLogger && 
            window.PerformanceMonitor && 
            window.DebugInterface && 
            window.UserFeedbackSystem) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  // ログシステムを初期化
  async function initializeLoggingSystem() {
    try {
      await waitForLogSystem();

      // パフォーマンス監視を開始
      if (!window.performanceMonitor) {
        window.performanceMonitor = new window.PerformanceMonitor(window.globalLogger);
      }

      // デバッグインターフェースを初期化
      if (!window.debugInterface) {
        window.debugInterface = new window.DebugInterface(window.globalLogger);
      }

      // ユーザーフィードバックシステムを初期化
      if (!window.userFeedbackSystem) {
        window.userFeedbackSystem = new window.UserFeedbackSystem(
          window.globalLogger, 
          window.globalErrorHandler
        );
      }

      // 既存のコンポーネントにログ機能を統合
      integrateWithExistingComponents();

      // グローバルエラーハンドラーを設定
      setupGlobalErrorHandling();

      // パフォーマンス監視を開始
      startPerformanceMonitoring();

      window.globalLogger.info('SYSTEM', 'ログとデバッグシステムが初期化されました');

    } catch (error) {
      console.error('ログシステムの初期化に失敗:', error);
    }
  }

  // 既存のコンポーネントにログ機能を統合
  function integrateWithExistingComponents() {
    // PopupDetector にログ機能を追加
    if (typeof window !== 'undefined' && window.PopupDetector) {
      const originalDetector = window.PopupDetector;
      
      // analyzePopup メソッドにログを追加
      if (originalDetector.prototype.analyzePopup) {
        const originalAnalyze = originalDetector.prototype.analyzePopup;
        originalDetector.prototype.analyzePopup = function(element) {
          const measure = window.performanceMonitor.startMeasure('popup_analysis', 'detection');
          
          try {
            window.globalLogger.debug('POPUP_DETECTION', 'ポップアップ分析開始', {
              element: {
                tagName: element.tagName,
                className: element.className,
                id: element.id
              }
            });

            const result = originalAnalyze.call(this, element);
            
            window.globalLogger.info('POPUP_DETECTION', 'ポップアップ分析完了', {
              result,
              confidence: result.confidence
            });

            return result;
          } catch (error) {
            window.globalLogger.error('POPUP_DETECTION', 'ポップアップ分析エラー', {
              error: error.message,
              element: element.tagName
            });
            
            // ポップアップ検出失敗のデバッグ情報を記録
            window.globalLogger.logPopupDetectionFailure(element, error.message, {
              method: 'analyzePopup'
            });
            
            throw error;
          } finally {
            measure.end();
          }
        };
      }

      // showNotification メソッドにログを追加
      if (originalDetector.prototype.showNotification) {
        const originalShow = originalDetector.prototype.showNotification;
        originalDetector.prototype.showNotification = function(popup) {
          const measure = window.performanceMonitor.startMeasure('notification_display', 'ui');
          
          try {
            window.globalLogger.info('USER_INTERACTION', '通知表示開始', {
              popup: popup.id || 'unknown'
            });

            const result = originalShow.call(this, popup);
            
            window.globalLogger.info('USER_INTERACTION', '通知表示完了');
            
            return result;
          } catch (error) {
            window.globalLogger.error('USER_INTERACTION', '通知表示エラー', {
              error: error.message
            });
            
            // ユーザーフレンドリーなエラー通知
            window.userFeedbackSystem.showWarning(
              '通知の表示に失敗しました',
              error.message
            );
            
            throw error;
          } finally {
            measure.end();
          }
        };
      }
    }

    // DOM監視にログ機能を追加
    if (typeof window !== 'undefined' && window.MutationObserver) {
      const originalObserver = window.MutationObserver;
      window.MutationObserver = function(callback) {
        const wrappedCallback = function(mutations) {
          const measure = window.performanceMonitor.startMeasure('dom_mutation_processing', 'dom');
          
          try {
            window.globalLogger.debug('DOM_MONITORING', 'DOM変更検出', {
              mutationCount: mutations.length
            });

            const result = callback.call(this, mutations);
            
            window.globalLogger.debug('DOM_MONITORING', 'DOM変更処理完了');
            
            return result;
          } catch (error) {
            window.globalLogger.error('DOM_MONITORING', 'DOM変更処理エラー', {
              error: error.message,
              mutationCount: mutations.length
            });
            throw error;
          } finally {
            measure.end();
          }
        };
        
        return new originalObserver(wrappedCallback);
      };
    }

    // Chrome API呼び出しにログ機能を追加
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      const originalSendMessage = chrome.runtime.sendMessage;
      chrome.runtime.sendMessage = function(message, callback) {
        const measure = window.performanceMonitor.startMeasure('chrome_message', 'communication');
        
        window.globalLogger.debug('COMMUNICATION', 'メッセージ送信開始', {
          messageType: message.type || 'unknown'
        });

        const wrappedCallback = function(response) {
          measure.end();
          
          if (chrome.runtime.lastError) {
            window.globalLogger.error('COMMUNICATION', 'メッセージ送信エラー', {
              error: chrome.runtime.lastError.message,
              messageType: message.type
            });
          } else {
            window.globalLogger.debug('COMMUNICATION', 'メッセージ送信完了', {
              messageType: message.type,
              hasResponse: !!response
            });
          }
          
          if (callback) {
            callback(response);
          }
        };

        return originalSendMessage.call(this, message, wrappedCallback);
      };
    }
  }

  // グローバルエラーハンドリングを設定
  function setupGlobalErrorHandling() {
    // 未処理のエラーをキャッチ
    window.addEventListener('error', (event) => {
      window.globalLogger.error('SYSTEM', 'グローバルエラー', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });

      // ユーザーフレンドリーなエラー通知
      window.userFeedbackSystem.handleError({
        message: event.message,
        technicalDetails: event.error?.stack,
        severity: 'high',
        recoveryActions: [
          { action: 'reload_page', priority: 'high' },
          { action: 'report_issue', priority: 'medium' }
        ]
      });
    });

    // 未処理のPromise拒否をキャッチ
    window.addEventListener('unhandledrejection', (event) => {
      window.globalLogger.error('SYSTEM', '未処理のPromise拒否', {
        reason: event.reason?.message || event.reason,
        stack: event.reason?.stack
      });

      // ユーザーフレンドリーなエラー通知
      window.userFeedbackSystem.handleError({
        message: event.reason?.message || 'Promise処理でエラーが発生しました',
        technicalDetails: event.reason?.stack,
        severity: 'medium',
        recoveryActions: [
          { action: 'general_troubleshooting', priority: 'medium' }
        ]
      });
    });

    // Chrome拡張機能固有のエラーハンドリング
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'ERROR_REPORT') {
          window.globalLogger.error('COMMUNICATION', 'リモートエラー受信', {
            error: message.error,
            sender: sender.tab?.url || 'background'
          });

          // ユーザーフレンドリーなエラー通知
          window.userFeedbackSystem.handleError({
            message: message.error.message,
            technicalDetails: message.error.stack,
            severity: message.error.severity || 'medium',
            recoveryActions: message.error.recoveryActions || []
          });
        }
      });
    }
  }

  // パフォーマンス監視を開始
  function startPerformanceMonitoring() {
    // ページ読み込み完了時のメトリクスを記録
    if (document.readyState === 'complete') {
      recordPageLoadMetrics();
    } else {
      window.addEventListener('load', recordPageLoadMetrics);
    }

    // 定期的なヘルスチェック
    setInterval(() => {
      performHealthCheck();
    }, 30000); // 30秒ごと

    // メモリ使用量の監視
    setInterval(() => {
      checkMemoryUsage();
    }, 10000); // 10秒ごと
  }

  // ページ読み込みメトリクスを記録
  function recordPageLoadMetrics() {
    if (typeof performance !== 'undefined' && performance.timing) {
      const timing = performance.timing;
      
      window.performanceMonitor.recordMetric('page_load_time', 
        timing.loadEventEnd - timing.navigationStart, 'page');
      
      window.performanceMonitor.recordMetric('dom_ready_time', 
        timing.domContentLoadedEventEnd - timing.navigationStart, 'page');
      
      window.performanceMonitor.recordMetric('first_paint_time', 
        timing.responseEnd - timing.navigationStart, 'page');

      window.globalLogger.info('PERFORMANCE', 'ページ読み込みメトリクス記録完了', {
        loadTime: timing.loadEventEnd - timing.navigationStart,
        domReadyTime: timing.domContentLoadedEventEnd - timing.navigationStart
      });
    }
  }

  // ヘルスチェックを実行
  function performHealthCheck() {
    const healthStatus = {
      timestamp: Date.now(),
      memoryUsage: 'unknown',
      domElements: document.querySelectorAll('*').length,
      activeNotifications: window.userFeedbackSystem?.activeNotifications.size || 0,
      errorCount: window.globalLogger?.errorReports.length || 0
    };

    // メモリ使用量チェック
    if (typeof performance !== 'undefined' && performance.memory) {
      const memoryMB = performance.memory.usedJSHeapSize / (1024 * 1024);
      healthStatus.memoryUsage = memoryMB.toFixed(2) + 'MB';
      
      if (memoryMB > 100) {
        window.globalLogger.warn('PERFORMANCE', 'メモリ使用量が高くなっています', {
          memoryUsage: memoryMB
        });
      }
    }

    // DOM要素数チェック
    if (healthStatus.domElements > 10000) {
      window.globalLogger.warn('PERFORMANCE', 'DOM要素数が多くなっています', {
        elementCount: healthStatus.domElements
      });
    }

    window.globalLogger.debug('SYSTEM', 'ヘルスチェック完了', healthStatus);
  }

  // メモリ使用量をチェック
  function checkMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      const memory = performance.memory;
      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);
      const usagePercent = (usedMB / limitMB) * 100;

      window.performanceMonitor.recordMetric('memory_usage_percent', usagePercent, 'memory');

      if (usagePercent > 80) {
        window.globalLogger.warn('PERFORMANCE', 'メモリ使用率が高くなっています', {
          usagePercent: usagePercent.toFixed(1),
          usedMB: usedMB.toFixed(1),
          limitMB: limitMB.toFixed(1)
        });

        // ユーザーに警告を表示
        window.userFeedbackSystem.showWarning(
          'メモリ使用量が多くなっています',
          `使用率: ${usagePercent.toFixed(1)}% (${usedMB.toFixed(1)}MB / ${limitMB.toFixed(1)}MB)`
        );
      }
    }
  }

  // デバッグ用のヘルパー関数を公開
  window.debugHelpers = {
    // ログレベルを変更
    setLogLevel: (level) => {
      window.globalLogger.setLogLevel(level);
      window.userFeedbackSystem.showInfo(`ログレベルを ${level} に設定しました`);
    },

    // デバッグパネルを表示
    showDebugPanel: () => {
      window.debugInterface.showDebugPanel();
    },

    // パフォーマンスレポートを生成
    generatePerformanceReport: () => {
      const report = window.performanceMonitor.generatePerformanceReport();
      console.log('パフォーマンスレポート:', report);
      return report;
    },

    // エラーレポートをエクスポート
    exportErrorReport: () => {
      window.userFeedbackSystem.reportIssue();
    },

    // テスト用のエラーを発生
    triggerTestError: (severity = 'medium') => {
      const error = new Error('テスト用エラー');
      window.globalErrorHandler.handleError(
        error,
        window.ERROR_TYPES.UNKNOWN,
        severity === 'critical' ? window.ERROR_SEVERITY.CRITICAL : window.ERROR_SEVERITY.MEDIUM,
        { component: 'debug_helper', test: true }
      );
    },

    // メトリクスをクリア
    clearMetrics: () => {
      window.performanceMonitor.clearMetrics();
      window.globalLogger.clearLogs();
      window.userFeedbackSystem.showSuccess('メトリクスとログをクリアしました');
    }
  };

  // 初期化を実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLoggingSystem);
  } else {
    initializeLoggingSystem();
  }

  // コンソールにヘルプメッセージを表示
  console.log(`
🔍 ポップアップブロッカー デバッグシステム

利用可能なコマンド:
- debugHelpers.showDebugPanel() : デバッグパネルを表示
- debugHelpers.setLogLevel(level) : ログレベルを設定 (0-4)
- debugHelpers.generatePerformanceReport() : パフォーマンスレポートを生成
- debugHelpers.exportErrorReport() : エラーレポートをエクスポート
- debugHelpers.triggerTestError() : テスト用エラーを発生
- debugHelpers.clearMetrics() : メトリクスとログをクリア

キーボードショートカット:
- Ctrl+Shift+D : デバッグパネルの表示/非表示切り替え

詳細な情報は window.globalLogger, window.performanceMonitor, 
window.debugInterface, window.userFeedbackSystem を参照してください。
  `);

})();