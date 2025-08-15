/**
 * 包括的なログとデバッグシステム
 * Chrome拡張機能のポップアップ広告ブロッカー用
 */

/**
 * ログレベルの定義
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
};

/**
 * ログカテゴリの定義
 */
const LOG_CATEGORIES = {
  POPUP_DETECTION: 'popup_detection',
  DOM_MONITORING: 'dom_monitoring',
  USER_INTERACTION: 'user_interaction',
  COMMUNICATION: 'communication',
  PERFORMANCE: 'performance',
  ERROR_HANDLING: 'error_handling',
  STORAGE: 'storage',
  SYSTEM: 'system'
};

/**
 * パフォーマンス監視メトリクス
 */
const PERFORMANCE_METRICS = {
  POPUP_DETECTION_TIME: 'popup_detection_time',
  DOM_SCAN_TIME: 'dom_scan_time',
  ANALYSIS_TIME: 'analysis_time',
  NOTIFICATION_TIME: 'notification_time',
  MEMORY_USAGE: 'memory_usage',
  CPU_USAGE: 'cpu_usage',
  EXTENSION_IMPACT: 'extension_impact'
};

/**
 * 包括的ログシステムクラス
 */
class Logger {
  constructor() {
    this.logs = [];
    this.maxLogSize = 2000;
    this.currentLogLevel = LOG_LEVELS.INFO;
    this.enabledCategories = new Set(Object.values(LOG_CATEGORIES));
    this.performanceMetrics = new Map();
    this.debugSessions = new Map();
    this.errorReports = [];
    this.userFeedback = [];
    
    this.initializeLogger();
    this.setupPerformanceMonitoring();
    this.setupDebugInterface();
  }

  /**
   * ログシステムの初期化
   */
  initializeLogger() {
    // ログレベルを設定から読み込み
    this.loadLogSettings();
    
    // コンソールメソッドをオーバーライド
    this.setupConsoleOverride();
    
    // 定期的なログクリーンアップ
    setInterval(() => {
      this.cleanupOldLogs();
    }, 60000); // 1分ごと

    // 定期的なパフォーマンス監視
    setInterval(() => {
      this.collectPerformanceMetrics();
    }, 5000); // 5秒ごと
  }

  /**
   * パフォーマンス監視の設定
   */
  setupPerformanceMonitoring() {
    // Performance Observer の設定
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordPerformanceEntry(entry);
          }
        });
        
        observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
      } catch (error) {
        this.warn('パフォーマンス監視の設定に失敗', { error: error.message });
      }
    }

    // メモリ使用量監視
    if (typeof performance !== 'undefined' && performance.memory) {
      setInterval(() => {
        this.recordMemoryUsage();
      }, 10000); // 10秒ごと
    }
  }

  /**
   * デバッグインターフェースの設定
   */
  setupDebugInterface() {
    // デバッグコマンドをグローバルに公開
    if (typeof window !== 'undefined') {
      window.debugLogger = {
        getLogs: (category, level) => this.getLogs(category, level),
        getPerformanceMetrics: () => this.getPerformanceMetrics(),
        getErrorReports: () => this.getErrorReports(),
        setLogLevel: (level) => this.setLogLevel(level),
        enableCategory: (category) => this.enableCategory(category),
        disableCategory: (category) => this.disableCategory(category),
        exportLogs: () => this.exportLogs(),
        clearLogs: () => this.clearLogs(),
        startDebugSession: (name) => this.startDebugSession(name),
        endDebugSession: (name) => this.endDebugSession(name)
      };
    }
  }

  /**
   * ログ設定を読み込み
   */
  async loadLogSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(['logSettings'], resolve);
        });

        if (result.logSettings) {
          this.currentLogLevel = result.logSettings.level || LOG_LEVELS.INFO;
          this.enabledCategories = new Set(result.logSettings.categories || Object.values(LOG_CATEGORIES));
        }
      }
    } catch (error) {
      console.warn('ログ設定の読み込みに失敗:', error);
    }
  }

  /**
   * コンソールメソッドのオーバーライド
   */
  setupConsoleOverride() {
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    // console.log をオーバーライド
    console.log = (...args) => {
      this.info('CONSOLE', args.join(' '));
      originalConsole.log(...args);
    };

    console.info = (...args) => {
      this.info('CONSOLE', args.join(' '));
      originalConsole.info(...args);
    };

    console.warn = (...args) => {
      this.warn('CONSOLE', args.join(' '));
      originalConsole.warn(...args);
    };

    console.error = (...args) => {
      this.error('CONSOLE', args.join(' '));
      originalConsole.error(...args);
    };

    console.debug = (...args) => {
      this.debug('CONSOLE', args.join(' '));
      originalConsole.debug(...args);
    };
  }

  /**
   * ログエントリを作成
   */
  createLogEntry(level, category, message, data = {}) {
    return {
      id: this.generateLogId(),
      timestamp: Date.now(),
      level,
      category,
      message,
      data: this.sanitizeData(data),
      url: typeof location !== 'undefined' ? location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      stackTrace: this.getStackTrace()
    };
  }

  /**
   * ログIDを生成
   */
  generateLogId() {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * データをサニタイズ
   */
  sanitizeData(data) {
    try {
      // 循環参照を除去
      return JSON.parse(JSON.stringify(data, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (value instanceof HTMLElement) {
            return {
              tagName: value.tagName,
              className: value.className,
              id: value.id,
              innerHTML: value.innerHTML.substring(0, 100)
            };
          }
          if (value instanceof Error) {
            return {
              name: value.name,
              message: value.message,
              stack: value.stack
            };
          }
        }
        return value;
      }));
    } catch (error) {
      return { error: 'データのサニタイズに失敗', original: String(data) };
    }
  }

  /**
   * スタックトレースを取得
   */
  getStackTrace() {
    try {
      throw new Error();
    } catch (error) {
      return error.stack;
    }
  }

  /**
   * ログを記録
   */
  log(level, category, message, data = {}) {
    // ログレベルとカテゴリのフィルタリング
    if (level < this.currentLogLevel || !this.enabledCategories.has(category)) {
      return;
    }

    const logEntry = this.createLogEntry(level, category, message, data);
    this.logs.push(logEntry);

    // ログサイズを制限
    if (this.logs.length > this.maxLogSize) {
      this.logs.splice(0, this.logs.length - this.maxLogSize);
    }

    // 重要なログは即座に永続化
    if (level >= LOG_LEVELS.ERROR) {
      this.persistLog(logEntry);
    }

    // コンソールにも出力
    this.outputToConsole(logEntry);
  }

  /**
   * デバッグログ
   */
  debug(category, message, data = {}) {
    this.log(LOG_LEVELS.DEBUG, category, message, data);
  }

  /**
   * 情報ログ
   */
  info(category, message, data = {}) {
    this.log(LOG_LEVELS.INFO, category, message, data);
  }

  /**
   * 警告ログ
   */
  warn(category, message, data = {}) {
    this.log(LOG_LEVELS.WARN, category, message, data);
  }

  /**
   * エラーログ
   */
  error(category, message, data = {}) {
    this.log(LOG_LEVELS.ERROR, category, message, data);
  }

  /**
   * 重要ログ
   */
  critical(category, message, data = {}) {
    this.log(LOG_LEVELS.CRITICAL, category, message, data);
    
    // 重要なエラーは即座にエラーレポートを作成
    this.createErrorReport(message, data);
  }

  /**
   * コンソールに出力
   */
  outputToConsole(logEntry) {
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
    const levelName = levelNames[logEntry.level] || 'UNKNOWN';
    const timestamp = new Date(logEntry.timestamp).toISOString();
    
    const prefix = `[${timestamp}] [${levelName}] [${logEntry.category}]`;
    const message = `${prefix} ${logEntry.message}`;

    switch (logEntry.level) {
      case LOG_LEVELS.DEBUG:
        console.debug(message, logEntry.data);
        break;
      case LOG_LEVELS.INFO:
        console.info(message, logEntry.data);
        break;
      case LOG_LEVELS.WARN:
        console.warn(message, logEntry.data);
        break;
      case LOG_LEVELS.ERROR:
      case LOG_LEVELS.CRITICAL:
        console.error(message, logEntry.data);
        break;
    }
  }

  /**
   * ログを永続化
   */
  async persistLog(logEntry) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const key = `log_${logEntry.id}`;
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ [key]: logEntry }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }
    } catch (error) {
      console.error('ログの永続化に失敗:', error);
    }
  }

  /**
   * パフォーマンスエントリを記録
   */
  recordPerformanceEntry(entry) {
    const metric = {
      name: entry.name,
      type: entry.entryType,
      startTime: entry.startTime,
      duration: entry.duration,
      timestamp: Date.now()
    };

    if (!this.performanceMetrics.has(entry.name)) {
      this.performanceMetrics.set(entry.name, []);
    }

    const metrics = this.performanceMetrics.get(entry.name);
    metrics.push(metric);

    // 最大100件まで保持
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }

    this.debug(LOG_CATEGORIES.PERFORMANCE, 'パフォーマンスメトリクス記録', metric);
  }

  /**
   * メモリ使用量を記録
   */
  recordMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      const memoryInfo = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        timestamp: Date.now()
      };

      this.recordPerformanceMetric(PERFORMANCE_METRICS.MEMORY_USAGE, memoryInfo);
    }
  }

  /**
   * パフォーマンスメトリクスを収集
   */
  collectPerformanceMetrics() {
    try {
      // メモリ使用量を記録
      this.recordMemoryUsage();

      // CPU使用量の推定（利用可能な場合）
      if (typeof performance !== 'undefined' && performance.now) {
        const startTime = performance.now();
        
        // 軽量な処理を実行してCPU使用量を推定
        setTimeout(() => {
          const endTime = performance.now();
          const processingTime = endTime - startTime;
          
          this.recordPerformanceMetric(PERFORMANCE_METRICS.CPU_USAGE, {
            processingTime,
            timestamp: Date.now()
          });
        }, 0);
      }

      // DOM要素数の監視
      if (typeof document !== 'undefined') {
        const domMetrics = {
          totalElements: document.querySelectorAll('*').length,
          bodyChildren: document.body?.children.length || 0,
          headChildren: document.head?.children.length || 0,
          timestamp: Date.now()
        };

        this.recordPerformanceMetric('dom_complexity', domMetrics);
      }

      // 拡張機能の影響を測定
      const extensionMetrics = {
        activeTimers: this.getActiveTimersCount(),
        memoryFootprint: this.getExtensionMemoryFootprint(),
        timestamp: Date.now()
      };

      this.recordPerformanceMetric(PERFORMANCE_METRICS.EXTENSION_IMPACT, extensionMetrics);

    } catch (error) {
      this.warn(LOG_CATEGORIES.PERFORMANCE, 'パフォーマンスメトリクス収集エラー', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * アクティブなタイマー数を取得
   */
  getActiveTimersCount() {
    // この値は推定値（実際のタイマー数を正確に取得するのは困難）
    return {
      estimated: 'タイマー数の正確な取得は制限されています',
      loggerTimers: 2 // このロガー自体が使用するタイマー数
    };
  }

  /**
   * 拡張機能のメモリフットプリントを取得
   */
  getExtensionMemoryFootprint() {
    try {
      const footprint = {
        logsCount: this.logs.length,
        performanceMetricsCount: this.performanceMetrics.size,
        errorReportsCount: this.errorReports.length,
        debugSessionsCount: this.debugSessions.size,
        estimatedMemoryUsage: this.estimateMemoryUsage()
      };

      return footprint;
    } catch (error) {
      return {
        error: 'メモリフットプリントの取得に失敗',
        message: error.message
      };
    }
  }

  /**
   * メモリ使用量を推定
   */
  estimateMemoryUsage() {
    try {
      // JSON文字列化してサイズを推定
      const logsSize = JSON.stringify(this.logs).length;
      const metricsSize = JSON.stringify(Array.from(this.performanceMetrics.entries())).length;
      const errorsSize = JSON.stringify(this.errorReports).length;

      return {
        logs: `${Math.round(logsSize / 1024)}KB`,
        metrics: `${Math.round(metricsSize / 1024)}KB`,
        errors: `${Math.round(errorsSize / 1024)}KB`,
        total: `${Math.round((logsSize + metricsSize + errorsSize) / 1024)}KB`
      };
    } catch (error) {
      return {
        error: 'メモリ使用量の推定に失敗',
        message: error.message
      };
    }
  }

  /**
   * パフォーマンスメトリクスを記録
   */
  recordPerformanceMetric(metricName, value) {
    if (!this.performanceMetrics.has(metricName)) {
      this.performanceMetrics.set(metricName, []);
    }

    const metrics = this.performanceMetrics.get(metricName);
    metrics.push({
      value,
      timestamp: Date.now()
    });

    // 最大100件まで保持
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }
  }

  /**
   * ポップアップ検出失敗のデバッグ情報を記録
   */
  logPopupDetectionFailure(element, reason, context = {}) {
    const debugInfo = {
      element: {
        tagName: element?.tagName,
        className: element?.className,
        id: element?.id,
        innerHTML: element?.innerHTML?.substring(0, 200)
      },
      reason,
      context,
      domState: this.captureDOMState(),
      performanceSnapshot: this.getPerformanceSnapshot(),
      timestamp: Date.now()
    };

    this.error(LOG_CATEGORIES.POPUP_DETECTION, 'ポップアップ検出失敗', debugInfo);
    
    // 詳細なデバッグセッションを開始
    this.startDebugSession(`popup_detection_failure_${Date.now()}`);
  }

  /**
   * DOM状態をキャプチャ
   */
  captureDOMState() {
    try {
      return {
        documentReadyState: document.readyState,
        elementsCount: document.querySelectorAll('*').length,
        bodyChildren: document.body?.children.length || 0,
        headChildren: document.head?.children.length || 0,
        scripts: document.querySelectorAll('script').length,
        styles: document.querySelectorAll('style, link[rel="stylesheet"]').length,
        iframes: document.querySelectorAll('iframe').length,
        modals: document.querySelectorAll('[role="dialog"], .modal, .popup').length,
        highZIndexElements: Array.from(document.querySelectorAll('*')).filter(el => {
          const zIndex = parseInt(window.getComputedStyle(el).zIndex) || 0;
          return zIndex > 1000;
        }).length
      };
    } catch (error) {
      return { error: 'DOM状態のキャプチャに失敗', message: error.message };
    }
  }

  /**
   * パフォーマンススナップショットを取得
   */
  getPerformanceSnapshot() {
    try {
      const snapshot = {
        timestamp: Date.now(),
        timing: {},
        memory: {},
        navigation: {}
      };

      // タイミング情報
      if (typeof performance !== 'undefined' && performance.timing) {
        snapshot.timing = {
          loadEventEnd: performance.timing.loadEventEnd,
          domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd,
          responseEnd: performance.timing.responseEnd
        };
      }

      // メモリ情報
      if (typeof performance !== 'undefined' && performance.memory) {
        snapshot.memory = {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }

      // ナビゲーション情報
      if (typeof performance !== 'undefined' && performance.navigation) {
        snapshot.navigation = {
          type: performance.navigation.type,
          redirectCount: performance.navigation.redirectCount
        };
      }

      return snapshot;
    } catch (error) {
      return { error: 'パフォーマンススナップショットの取得に失敗', message: error.message };
    }
  }

  /**
   * 拡張機能の影響を監視
   */
  monitorExtensionImpact() {
    const startTime = performance.now();
    
    return {
      end: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.recordPerformanceMetric(PERFORMANCE_METRICS.EXTENSION_IMPACT, {
          duration,
          startTime,
          endTime
        });

        if (duration > 100) { // 100ms以上の場合は警告
          this.warn(LOG_CATEGORIES.PERFORMANCE, '拡張機能の処理時間が長い', {
            duration,
            threshold: 100
          });
        }

        return duration;
      }
    };
  }

  /**
   * デバッグセッションを開始
   */
  startDebugSession(sessionName) {
    const session = {
      name: sessionName,
      startTime: Date.now(),
      logs: [],
      metrics: new Map(),
      active: true
    };

    this.debugSessions.set(sessionName, session);
    this.info(LOG_CATEGORIES.SYSTEM, 'デバッグセッション開始', { sessionName });

    return session;
  }

  /**
   * デバッグセッションを終了
   */
  endDebugSession(sessionName) {
    const session = this.debugSessions.get(sessionName);
    if (!session) {
      this.warn(LOG_CATEGORIES.SYSTEM, 'デバッグセッションが見つからない', { sessionName });
      return null;
    }

    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;
    session.active = false;

    this.info(LOG_CATEGORIES.SYSTEM, 'デバッグセッション終了', {
      sessionName,
      duration: session.duration,
      logsCount: session.logs.length
    });

    return session;
  }

  /**
   * エラーレポートを作成
   */
  createErrorReport(message, data = {}) {
    const report = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      message,
      data: this.sanitizeData(data),
      context: {
        url: typeof location !== 'undefined' ? location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        domState: this.captureDOMState(),
        performanceSnapshot: this.getPerformanceSnapshot(),
        recentLogs: this.logs.slice(-10) // 最新10件のログ
      },
      userFriendlyMessage: this.generateUserFriendlyMessage(message, data),
      recoveryActions: this.generateRecoveryActions(message, data)
    };

    this.errorReports.push(report);

    // 最大50件まで保持
    if (this.errorReports.length > 50) {
      this.errorReports.splice(0, this.errorReports.length - 50);
    }

    // エラーレポートを永続化
    this.persistErrorReport(report);

    return report;
  }

  /**
   * ユーザーフレンドリーなメッセージを生成
   */
  generateUserFriendlyMessage(message, data) {
    const messageMap = {
      'DOM access denied': 'ウェブページへのアクセスが制限されています。ページを再読み込みしてみてください。',
      'Communication failed': '拡張機能の通信に問題が発生しました。拡張機能を再起動してみてください。',
      'Permission denied': '必要な権限が不足しています。拡張機能の設定を確認してください。',
      'Storage error': 'データの保存に失敗しました。ブラウザの容量を確認してください。',
      'Popup detection failed': 'ポップアップの検出に失敗しました。ウェブサイトの構造が複雑な可能性があります。'
    };

    // メッセージの一部マッチング
    for (const [key, friendlyMessage] of Object.entries(messageMap)) {
      if (message.toLowerCase().includes(key.toLowerCase())) {
        return friendlyMessage;
      }
    }

    return '予期しない問題が発生しました。問題が続く場合は、拡張機能を再起動してください。';
  }

  /**
   * 回復アクションを生成
   */
  generateRecoveryActions(message, data) {
    const actions = [];

    if (message.toLowerCase().includes('dom')) {
      actions.push({
        action: 'reload_page',
        description: 'ページを再読み込みする',
        priority: 'high'
      });
    }

    if (message.toLowerCase().includes('communication')) {
      actions.push({
        action: 'restart_extension',
        description: '拡張機能を再起動する',
        priority: 'medium'
      });
    }

    if (message.toLowerCase().includes('permission')) {
      actions.push({
        action: 'check_permissions',
        description: '拡張機能の権限を確認する',
        priority: 'high'
      });
    }

    if (message.toLowerCase().includes('storage')) {
      actions.push({
        action: 'clear_storage',
        description: '拡張機能のデータをクリアする',
        priority: 'low'
      });
    }

    // デフォルトアクション
    if (actions.length === 0) {
      actions.push({
        action: 'general_troubleshooting',
        description: '一般的なトラブルシューティングを実行する',
        priority: 'medium'
      });
    }

    return actions;
  }

  /**
   * エラーレポートを永続化
   */
  async persistErrorReport(report) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const key = `error_report_${report.id}`;
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ [key]: report }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }
    } catch (error) {
      console.error('エラーレポートの永続化に失敗:', error);
    }
  }

  /**
   * 古いログをクリーンアップ
   */
  cleanupOldLogs() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24時間

    // メモリ内のログをクリーンアップ
    this.logs = this.logs.filter(log => now - log.timestamp < maxAge);

    // パフォーマンスメトリクスをクリーンアップ
    for (const [key, metrics] of this.performanceMetrics.entries()) {
      const filteredMetrics = metrics.filter(metric => now - metric.timestamp < maxAge);
      this.performanceMetrics.set(key, filteredMetrics);
    }

    // エラーレポートをクリーンアップ
    this.errorReports = this.errorReports.filter(report => now - report.timestamp < maxAge);
  }

  /**
   * ログを取得
   */
  getLogs(category = null, level = null) {
    let filteredLogs = this.logs;

    if (category) {
      filteredLogs = filteredLogs.filter(log => log.category === category);
    }

    if (level !== null) {
      filteredLogs = filteredLogs.filter(log => log.level >= level);
    }

    return filteredLogs;
  }

  /**
   * パフォーマンスメトリクスを取得
   */
  getPerformanceMetrics() {
    const metrics = {};
    
    for (const [key, values] of this.performanceMetrics.entries()) {
      metrics[key] = {
        count: values.length,
        latest: values[values.length - 1],
        average: values.reduce((sum, v) => sum + (v.value?.duration || v.duration || 0), 0) / values.length,
        values: values.slice(-10) // 最新10件
      };
    }

    return metrics;
  }

  /**
   * エラーレポートを取得
   */
  getErrorReports() {
    return this.errorReports;
  }

  /**
   * ログレベルを設定
   */
  setLogLevel(level) {
    this.currentLogLevel = level;
    this.saveLogSettings();
  }

  /**
   * カテゴリを有効化
   */
  enableCategory(category) {
    this.enabledCategories.add(category);
    this.saveLogSettings();
  }

  /**
   * カテゴリを無効化
   */
  disableCategory(category) {
    this.enabledCategories.delete(category);
    this.saveLogSettings();
  }

  /**
   * ログ設定を保存
   */
  async saveLogSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const settings = {
          level: this.currentLogLevel,
          categories: Array.from(this.enabledCategories)
        };

        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ logSettings: settings }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }
    } catch (error) {
      console.error('ログ設定の保存に失敗:', error);
    }
  }

  /**
   * ログをエクスポート
   */
  exportLogs() {
    const exportData = {
      logs: this.logs,
      performanceMetrics: Object.fromEntries(this.performanceMetrics),
      errorReports: this.errorReports,
      settings: {
        logLevel: this.currentLogLevel,
        enabledCategories: Array.from(this.enabledCategories)
      },
      exportTimestamp: Date.now()
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * ログをクリア
   */
  clearLogs() {
    this.logs = [];
    this.performanceMetrics.clear();
    this.errorReports = [];
    this.debugSessions.clear();
    
    this.info(LOG_CATEGORIES.SYSTEM, 'ログがクリアされました');
  }
}

// グローバルロガーのインスタンスを作成
const globalLogger = new Logger();

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    Logger, 
    LOG_LEVELS, 
    LOG_CATEGORIES, 
    PERFORMANCE_METRICS, 
    globalLogger 
  };
} else if (typeof window !== 'undefined') {
  window.Logger = Logger;
  window.LOG_LEVELS = LOG_LEVELS;
  window.LOG_CATEGORIES = LOG_CATEGORIES;
  window.PERFORMANCE_METRICS = PERFORMANCE_METRICS;
  window.globalLogger = globalLogger;
}