/**
 * ログとデバッグシステムのテスト
 */

// テスト用のモック環境を設定
const mockChrome = {
  storage: {
    local: {
      set: jest.fn((data, callback) => callback && callback()),
      get: jest.fn((keys, callback) => callback && callback({})),
      remove: jest.fn((keys, callback) => callback && callback()),
      clear: jest.fn((callback) => callback && callback()),
      getBytesInUse: jest.fn((keys, callback) => callback && callback(1024))
    }
  },
  runtime: {
    sendMessage: jest.fn((message, callback) => callback && callback({})),
    lastError: null
  },
  notifications: {
    create: jest.fn()
  }
};

// グローバルモックを設定
global.chrome = mockChrome;
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => [{ duration: 100 }]),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
  memory: {
    usedJSHeapSize: 1024 * 1024 * 10, // 10MB
    totalJSHeapSize: 1024 * 1024 * 20, // 20MB
    jsHeapSizeLimit: 1024 * 1024 * 100 // 100MB
  }
};

global.PerformanceObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn(),
  disconnect: jest.fn()
}));

global.requestAnimationFrame = jest.fn((callback) => setTimeout(callback, 16));

// テスト対象のモジュールを読み込み
const { Logger, LOG_LEVELS, LOG_CATEGORIES, PERFORMANCE_METRICS } = require('../utils/logger.js');
const { DebugInterface } = require('../utils/debug-interface.js');
const { PerformanceMonitor } = require('../utils/performance-monitor.js');
const { UserFeedbackSystem } = require('../utils/user-feedback-system.js');

describe('ログとデバッグシステム', () => {
  let logger;
  let debugInterface;
  let performanceMonitor;
  let userFeedbackSystem;

  beforeEach(() => {
    // DOM環境をセットアップ
    document.body.innerHTML = '';
    
    // モックをリセット
    jest.clearAllMocks();
    
    // インスタンスを作成
    logger = new Logger();
    performanceMonitor = new PerformanceMonitor(logger);
    debugInterface = new DebugInterface(logger);
    userFeedbackSystem = new UserFeedbackSystem(logger, null);
  });

  afterEach(() => {
    // クリーンアップ
    if (debugInterface) {
      debugInterface.hideDebugPanel();
    }
    if (userFeedbackSystem) {
      userFeedbackSystem.destroy();
    }
    if (performanceMonitor) {
      performanceMonitor.destroy();
    }
  });

  describe('Logger', () => {
    test('ログエントリを正しく作成する', () => {
      const message = 'テストメッセージ';
      const data = { test: 'data' };
      
      logger.info(LOG_CATEGORIES.POPUP_DETECTION, message, data);
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe(message);
      expect(logs[0].category).toBe(LOG_CATEGORIES.POPUP_DETECTION);
      expect(logs[0].level).toBe(LOG_LEVELS.INFO);
      expect(logs[0].data).toEqual(data);
    });

    test('ログレベルフィルタリングが動作する', () => {
      logger.setLogLevel(LOG_LEVELS.WARN);
      
      logger.debug(LOG_CATEGORIES.SYSTEM, 'デバッグメッセージ');
      logger.info(LOG_CATEGORIES.SYSTEM, '情報メッセージ');
      logger.warn(LOG_CATEGORIES.SYSTEM, '警告メッセージ');
      logger.error(LOG_CATEGORIES.SYSTEM, 'エラーメッセージ');
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(2); // WARN と ERROR のみ
      expect(logs[0].level).toBe(LOG_LEVELS.WARN);
      expect(logs[1].level).toBe(LOG_LEVELS.ERROR);
    });

    test('カテゴリフィルタリングが動作する', () => {
      logger.enableCategory(LOG_CATEGORIES.POPUP_DETECTION);
      logger.disableCategory(LOG_CATEGORIES.SYSTEM);
      
      logger.info(LOG_CATEGORIES.POPUP_DETECTION, 'ポップアップメッセージ');
      logger.info(LOG_CATEGORIES.SYSTEM, 'システムメッセージ');
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].category).toBe(LOG_CATEGORIES.POPUP_DETECTION);
    });

    test('パフォーマンスメトリクスを記録する', () => {
      const metricName = 'test_metric';
      const value = 123.45;
      
      logger.recordPerformanceMetric(metricName, { value, timestamp: Date.now() });
      
      const metrics = logger.getPerformanceMetrics();
      expect(metrics[metricName]).toBeDefined();
      expect(metrics[metricName].count).toBe(1);
      expect(metrics[metricName].latest.value).toBe(value);
    });

    test('ポップアップ検出失敗のデバッグ情報を記録する', () => {
      const mockElement = {
        tagName: 'DIV',
        className: 'test-popup',
        id: 'test-id',
        innerHTML: '<p>Test content</p>'
      };
      
      logger.logPopupDetectionFailure(mockElement, 'テスト失敗理由', { context: 'test' });
      
      const logs = logger.getLogs(LOG_CATEGORIES.POPUP_DETECTION, LOG_LEVELS.ERROR);
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('ポップアップ検出失敗');
      expect(logs[0].data.reason).toBe('テスト失敗理由');
      expect(logs[0].data.element.tagName).toBe('DIV');
    });

    test('エラーレポートを作成する', () => {
      const message = 'テストエラー';
      const data = { error: 'test error data' };
      
      const report = logger.createErrorReport(message, data);
      
      expect(report.message).toBe(message);
      expect(report.data).toEqual(data);
      expect(report.userFriendlyMessage).toBeDefined();
      expect(report.recoveryActions).toBeDefined();
      expect(Array.isArray(report.recoveryActions)).toBe(true);
    });

    test('ログをエクスポートできる', () => {
      logger.info(LOG_CATEGORIES.SYSTEM, 'テストメッセージ');
      
      const exportData = logger.exportLogs();
      const parsed = JSON.parse(exportData);
      
      expect(parsed.logs).toBeDefined();
      expect(parsed.performanceMetrics).toBeDefined();
      expect(parsed.errorReports).toBeDefined();
      expect(parsed.exportTimestamp).toBeDefined();
    });
  });

  describe('PerformanceMonitor', () => {
    test('パフォーマンス測定を開始・終了できる', () => {
      const measure = performanceMonitor.startMeasure('test_operation', 'test_category');
      
      expect(measure.name).toBe('test_category_test_operation');
      expect(typeof measure.end).toBe('function');
      
      const duration = measure.end();
      expect(typeof duration).toBe('number');
    });

    test('メトリクスを記録する', () => {
      const metricName = 'test_metric';
      const value = 100;
      const category = 'test';
      
      performanceMonitor.recordMetric(metricName, value, category);
      
      const metrics = performanceMonitor.getMetricsSummary();
      expect(metrics[metricName]).toBeDefined();
      expect(metrics[metricName].average).toBe(value);
      expect(metrics[metricName].count).toBe(1);
    });

    test('閾値チェックが動作する', () => {
      // 警告閾値を超える値を記録
      performanceMonitor.recordMetric('popup_detection_time', 150); // 警告閾値: 100ms
      
      expect(performanceMonitor.alerts.length).toBe(1);
      expect(performanceMonitor.alerts[0].level).toBe('warning');
      expect(performanceMonitor.alerts[0].metric).toBe('popup_detection_time');
    });

    test('メモリメトリクスを収集する', () => {
      performanceMonitor.collectMemoryMetrics();
      
      const metrics = performanceMonitor.getMetricsSummary();
      expect(metrics.memory_used).toBeDefined();
      expect(metrics.memory_total).toBeDefined();
      expect(metrics.memory_usage_percentage).toBeDefined();
    });

    test('通信遅延を測定する', async () => {
      await performanceMonitor.measureCommunicationLatency();
      
      const metrics = performanceMonitor.getMetricsSummary();
      expect(metrics.communication_latency || metrics.communication_error).toBeDefined();
    });

    test('パフォーマンスレポートを生成する', () => {
      performanceMonitor.recordMetric('test_metric', 100);
      
      const report = performanceMonitor.generatePerformanceReport();
      
      expect(report.timestamp).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('DebugInterface', () => {
    test('デバッグパネルを作成する', () => {
      expect(document.getElementById('popup-blocker-debug-panel')).toBeTruthy();
    });

    test('デバッグパネルの表示/非表示を切り替える', () => {
      const panel = document.getElementById('popup-blocker-debug-panel');
      
      debugInterface.showDebugPanel();
      expect(panel.style.display).toBe('block');
      
      debugInterface.hideDebugPanel();
      expect(panel.style.display).toBe('none');
    });

    test('タブを切り替える', () => {
      debugInterface.showDebugPanel();
      debugInterface.switchTab('performance');
      
      const activeTab = document.querySelector('.debug-tab.active');
      expect(activeTab.dataset.tab).toBe('performance');
      
      const activeContent = document.getElementById('debug-tab-performance');
      expect(activeContent.style.display).toBe('block');
    });

    test('診断を実行する', async () => {
      debugInterface.showDebugPanel();
      
      await debugInterface.runDiagnostics();
      
      const diagnosticsContainer = document.getElementById('diagnostics-results');
      expect(diagnosticsContainer.innerHTML).toContain('dom_state');
      expect(diagnosticsContainer.innerHTML).toContain('extension_state');
    });

    test('ヘルスチェックを実行する', async () => {
      debugInterface.showDebugPanel();
      
      await debugInterface.runHealthCheck();
      
      const diagnosticsContainer = document.getElementById('diagnostics-results');
      expect(diagnosticsContainer.innerHTML).toContain('ヘルスチェック');
    });
  });

  describe('UserFeedbackSystem', () => {
    test('通知スタイルを注入する', () => {
      const styleElement = document.getElementById('popup-blocker-feedback-styles');
      expect(styleElement).toBeTruthy();
      expect(styleElement.textContent).toContain('popup-blocker-notification');
    });

    test('通知コンテナを作成する', () => {
      const container = document.getElementById('popup-blocker-notification-container');
      expect(container).toBeTruthy();
      expect(container.className).toBe('popup-blocker-notification-container');
    });

    test('成功通知を表示する', () => {
      const message = 'テスト成功メッセージ';
      
      const notificationId = userFeedbackSystem.showSuccess(message);
      
      expect(notificationId).toBeDefined();
      expect(userFeedbackSystem.activeNotifications.has(notificationId)).toBe(true);
      
      const notification = userFeedbackSystem.activeNotifications.get(notificationId);
      expect(notification.type).toBe('success');
    });

    test('エラー通知を表示する', () => {
      const errorData = {
        message: 'テストエラー',
        technicalDetails: 'Technical details',
        recoveryActions: [{ action: 'reload_page', priority: 'high' }],
        severity: 'high'
      };
      
      userFeedbackSystem.handleError(errorData);
      
      expect(userFeedbackSystem.activeNotifications.size).toBe(1);
    });

    test('ユーザーフレンドリーなメッセージを生成する', () => {
      const technicalMessage = 'DOM access denied';
      const friendlyMessage = userFeedbackSystem.generateUserFriendlyMessage(technicalMessage);
      
      expect(friendlyMessage).toContain('ウェブページへのアクセスが制限されています');
    });

    test('回復アクションを作成する', () => {
      const recoveryActions = [
        { action: 'reload_page', priority: 'high' },
        { action: 'restart_extension', priority: 'medium' }
      ];
      
      const actions = userFeedbackSystem.createRecoveryActions(recoveryActions);
      
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some(action => action.label === 'ページを再読み込み')).toBe(true);
      expect(actions.some(action => action.label === '拡張機能を再起動')).toBe(true);
    });

    test('進行状況を表示する', () => {
      const message = 'テスト処理中';
      
      const progress = userFeedbackSystem.showProgress(message);
      
      expect(typeof progress.update).toBe('function');
      expect(typeof progress.complete).toBe('function');
      expect(typeof progress.error).toBe('function');
    });

    test('通知を非表示にする', () => {
      const notificationId = userFeedbackSystem.showInfo('テストメッセージ');
      
      userFeedbackSystem.hideNotification(notificationId);
      
      // アニメーション後に削除されるため、少し待つ
      setTimeout(() => {
        expect(userFeedbackSystem.activeNotifications.has(notificationId)).toBe(false);
      }, 350);
    });
  });

  describe('統合テスト', () => {
    test('ログシステムとパフォーマンス監視の連携', () => {
      const measure = performanceMonitor.startMeasure('integration_test');
      
      // 何らかの処理をシミュレート
      setTimeout(() => {
        const duration = measure.end();
        
        // ログにパフォーマンスメトリクスが記録されることを確認
        const logs = logger.getLogs(LOG_CATEGORIES.PERFORMANCE);
        expect(logs.length).toBeGreaterThan(0);
      }, 10);
    });

    test('エラーハンドリングとユーザーフィードバックの連携', () => {
      const errorMessage = 'テスト統合エラー';
      
      // エラーイベントを発火
      const errorEvent = new CustomEvent('popup-blocker-error', {
        detail: {
          message: errorMessage,
          severity: 'high',
          recoveryActions: [{ action: 'reload_page', priority: 'high' }]
        }
      });
      
      window.dispatchEvent(errorEvent);
      
      // 通知が表示されることを確認
      expect(userFeedbackSystem.activeNotifications.size).toBe(1);
    });

    test('デバッグインターフェースとログシステムの連携', () => {
      // ログを追加
      logger.info(LOG_CATEGORIES.POPUP_DETECTION, 'テストログメッセージ');
      logger.error(LOG_CATEGORIES.SYSTEM, 'テストエラーメッセージ');
      
      // デバッグパネルを表示
      debugInterface.showDebugPanel();
      debugInterface.switchTab('logs');
      
      // ログが表示されることを確認
      const logEntries = document.getElementById('log-entries');
      expect(logEntries.innerHTML).toContain('テストログメッセージ');
      expect(logEntries.innerHTML).toContain('テストエラーメッセージ');
    });

    test('パフォーマンス監視とアラートシステムの連携', () => {
      // 閾値を超えるメトリクスを記録
      performanceMonitor.recordMetric('popup_detection_time', 600); // 重要閾値: 500ms
      
      // アラートが生成されることを確認
      expect(performanceMonitor.alerts.length).toBe(1);
      expect(performanceMonitor.alerts[0].level).toBe('critical');
      
      // ログにも記録されることを確認
      const errorLogs = logger.getLogs(LOG_CATEGORIES.PERFORMANCE, LOG_LEVELS.ERROR);
      expect(errorLogs.length).toBe(1);
    });
  });

  describe('エラーケース', () => {
    test('Chrome APIが利用できない場合の処理', () => {
      // Chrome APIを無効化
      global.chrome = undefined;
      
      const testLogger = new Logger();
      
      // エラーが発生せずに動作することを確認
      expect(() => {
        testLogger.info(LOG_CATEGORIES.SYSTEM, 'テストメッセージ');
      }).not.toThrow();
    });

    test('Performance APIが利用できない場合の処理', () => {
      // Performance APIを無効化
      global.performance = undefined;
      global.PerformanceObserver = undefined;
      
      const testMonitor = new PerformanceMonitor(logger);
      
      // エラーが発生せずに動作することを確認
      expect(() => {
        testMonitor.collectMemoryMetrics();
      }).not.toThrow();
    });

    test('DOM操作が失敗した場合の処理', () => {
      // document.body を無効化
      Object.defineProperty(document, 'body', {
        value: null,
        writable: true
      });
      
      // エラーが発生せずに動作することを確認
      expect(() => {
        const testFeedback = new UserFeedbackSystem(logger, null);
      }).not.toThrow();
    });
  });
});

// テスト実行時の設定
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // テストヘルパー関数をエクスポート
    createMockElement: (tagName = 'div', className = '', id = '') => ({
      tagName: tagName.toUpperCase(),
      className,
      id,
      innerHTML: '<p>Mock content</p>',
      getBoundingClientRect: () => ({ width: 100, height: 100, top: 0, left: 0 })
    }),
    
    createMockPerformanceEntry: (name, duration = 100) => ({
      name,
      duration,
      startTime: Date.now(),
      entryType: 'measure'
    }),
    
    waitForAsync: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms))
  };
}