/**
 * 広告プレビューシステム用デバッグ・ログシステム
 * 開発・本番環境での効率的なデバッグとログ出力を提供
 */

class DebugLogger {
  constructor(component, options = {}) {
    this.component = component;
    this.options = {
      debugMode: options.debugMode || false,
      logLevel: options.logLevel || 'info', // 'debug', 'info', 'warn', 'error'
      maxLogEntries: options.maxLogEntries || 1000,
      enablePerformanceLogging: options.enablePerformanceLogging || false,
      enableMemoryLogging: options.enableMemoryLogging || false,
      logToStorage: options.logToStorage || false,
      storageKey: options.storageKey || 'adPreviewLogs',
      ...options
    };

    this.logEntries = [];
    this.performanceMarkers = new Map();
    this.memorySnapshots = [];
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    this.currentLogLevel = this.logLevels[this.options.logLevel] || 1;
    
    // ログ出力の初期化
    this.initializeLogging();
  }

  /**
   * ログシステムの初期化
   */
  initializeLogging() {
    // コンソールログのスタイル設定
    this.styles = {
      debug: 'color: #6c757d; font-weight: normal;',
      info: 'color: #007bff; font-weight: normal;',
      warn: 'color: #ffc107; font-weight: bold;',
      error: 'color: #dc3545; font-weight: bold;',
      performance: 'color: #28a745; font-weight: bold;',
      memory: 'color: #17a2b8; font-weight: bold;'
    };

    // グローバルエラーハンドラーの設定
    if (this.options.debugMode) {
      this.setupGlobalErrorHandler();
    }

    // パフォーマンス監視の開始
    if (this.options.enablePerformanceLogging) {
      this.startPerformanceMonitoring();
    }

    // メモリ監視の開始
    if (this.options.enableMemoryLogging) {
      this.startMemoryMonitoring();
    }

    this.info('Debug logger initialized', {
      component: this.component,
      debugMode: this.options.debugMode,
      logLevel: this.options.logLevel
    });
  }

  /**
   * デバッグログ出力
   */
  debug(message, data = {}, options = {}) {
    if (this.currentLogLevel <= this.logLevels.debug) {
      this.log('debug', message, data, options);
    }
  }

  /**
   * 情報ログ出力
   */
  info(message, data = {}, options = {}) {
    if (this.currentLogLevel <= this.logLevels.info) {
      this.log('info', message, data, options);
    }
  }

  /**
   * 警告ログ出力
   */
  warn(message, data = {}, options = {}) {
    if (this.currentLogLevel <= this.logLevels.warn) {
      this.log('warn', message, data, options);
    }
  }

  /**
   * エラーログ出力
   */
  error(message, data = {}, options = {}) {
    if (this.currentLogLevel <= this.logLevels.error) {
      this.log('error', message, data, options);
    }
  }

  /**
   * 基本ログ出力メソッド
   */
  log(level, message, data = {}, options = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      component: this.component,
      message,
      data: this.sanitizeData(data),
      stack: options.includeStack ? new Error().stack : null,
      sessionId: this.getSessionId(),
      url: window.location?.href || 'unknown'
    };

    // ログエントリーを保存
    this.addLogEntry(logEntry);

    // コンソール出力
    this.outputToConsole(logEntry);

    // ストレージ保存
    if (this.options.logToStorage) {
      this.saveToStorage(logEntry);
    }

    // カスタムハンドラー実行
    if (options.customHandler) {
      options.customHandler(logEntry);
    }
  }

  /**
   * パフォーマンスログ出力
   */
  performance(operation, duration, data = {}) {
    if (!this.options.enablePerformanceLogging) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'performance',
      component: this.component,
      operation,
      duration,
      data: this.sanitizeData(data)
    };

    this.addLogEntry(logEntry);
    
    console.log(
      `%c[${this.component}] PERF: ${operation} (${duration}ms)`,
      this.styles.performance,
      data
    );
  }

  /**
   * メモリ使用量ログ出力
   */
  memory(operation, memoryInfo = {}) {
    if (!this.options.enableMemoryLogging) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'memory',
      component: this.component,
      operation,
      memoryInfo: this.getMemoryInfo(memoryInfo)
    };

    this.addLogEntry(logEntry);
    
    console.log(
      `%c[${this.component}] MEM: ${operation}`,
      this.styles.memory,
      logEntry.memoryInfo
    );
  }

  /**
   * パフォーマンス測定開始
   */
  startPerformanceMeasure(operation) {
    const startTime = performance.now();
    this.performanceMarkers.set(operation, {
      startTime,
      operation
    });

    if (this.options.debugMode) {
      this.debug(`Performance measure started: ${operation}`);
    }

    return operation;
  }

  /**
   * パフォーマンス測定終了
   */
  endPerformanceMeasure(operation, data = {}) {
    const marker = this.performanceMarkers.get(operation);
    if (!marker) {
      this.warn(`Performance marker not found: ${operation}`);
      return null;
    }

    const endTime = performance.now();
    const duration = Math.round(endTime - marker.startTime);

    this.performanceMarkers.delete(operation);
    this.performance(operation, duration, data);

    return duration;
  }

  /**
   * 関数実行時間の測定
   */
  async measureFunction(fn, operation, context = null) {
    const startTime = performance.now();
    
    try {
      const result = context ? await fn.call(context) : await fn();
      const duration = Math.round(performance.now() - startTime);
      
      this.performance(operation, duration, {
        success: true,
        resultType: typeof result
      });
      
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      
      this.performance(operation, duration, {
        success: false,
        error: error.message
      });
      
      this.error(`Function execution failed: ${operation}`, {
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }

  /**
   * メモリスナップショットの取得
   */
  takeMemorySnapshot(label = 'snapshot') {
    const memoryInfo = this.getMemoryInfo();
    const snapshot = {
      timestamp: new Date().toISOString(),
      label,
      memoryInfo
    };

    this.memorySnapshots.push(snapshot);
    
    // スナップショット数を制限
    if (this.memorySnapshots.length > 50) {
      this.memorySnapshots = this.memorySnapshots.slice(-25);
    }

    this.memory(`Memory snapshot: ${label}`, memoryInfo);
    
    return snapshot;
  }

  /**
   * メモリリーク検出
   */
  detectMemoryLeaks() {
    if (this.memorySnapshots.length < 2) {
      this.warn('Insufficient memory snapshots for leak detection');
      return null;
    }

    const recent = this.memorySnapshots.slice(-5);
    const growthRate = this.calculateMemoryGrowthRate(recent);

    if (growthRate > 10) { // 10MB/分以上の増加
      this.warn('Potential memory leak detected', {
        growthRate: `${growthRate.toFixed(2)} MB/min`,
        recentSnapshots: recent.length
      });
      
      return {
        detected: true,
        growthRate,
        snapshots: recent
      };
    }

    return {
      detected: false,
      growthRate
    };
  }

  /**
   * ログエントリーの追加
   */
  addLogEntry(entry) {
    this.logEntries.push(entry);
    
    // ログエントリー数を制限
    if (this.logEntries.length > this.options.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-Math.floor(this.options.maxLogEntries * 0.8));
    }
  }

  /**
   * コンソール出力
   */
  outputToConsole(entry) {
    const prefix = `[${entry.component}] ${entry.level.toUpperCase()}:`;
    const style = this.styles[entry.level] || '';
    
    if (entry.level === 'error') {
      console.error(`%c${prefix}`, style, entry.message, entry.data);
      if (entry.stack) {
        console.error('Stack trace:', entry.stack);
      }
    } else if (entry.level === 'warn') {
      console.warn(`%c${prefix}`, style, entry.message, entry.data);
    } else {
      console.log(`%c${prefix}`, style, entry.message, entry.data);
    }
  }

  /**
   * ストレージへの保存
   */
  async saveToStorage(entry) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // Chrome拡張機能環境
        const existingLogs = await this.getStoredLogs();
        const updatedLogs = [...existingLogs, entry].slice(-this.options.maxLogEntries);
        
        await chrome.storage.local.set({
          [this.options.storageKey]: updatedLogs
        });
      } else {
        // ブラウザ環境
        const existingLogs = JSON.parse(
          localStorage.getItem(this.options.storageKey) || '[]'
        );
        const updatedLogs = [...existingLogs, entry].slice(-this.options.maxLogEntries);
        
        localStorage.setItem(this.options.storageKey, JSON.stringify(updatedLogs));
      }
    } catch (error) {
      console.error('Failed to save log to storage:', error);
    }
  }

  /**
   * ストレージからのログ取得
   */
  async getStoredLogs() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get([this.options.storageKey]);
        return result[this.options.storageKey] || [];
      } else {
        return JSON.parse(localStorage.getItem(this.options.storageKey) || '[]');
      }
    } catch (error) {
      console.error('Failed to get stored logs:', error);
      return [];
    }
  }

  /**
   * データのサニタイズ
   */
  sanitizeData(data) {
    try {
      // 循環参照の除去
      const seen = new WeakSet();
      return JSON.parse(JSON.stringify(data, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        
        // 大きなデータの切り詰め
        if (typeof value === 'string' && value.length > 1000) {
          return value.substring(0, 1000) + '... [truncated]';
        }
        
        // 機密情報のマスク
        if (typeof key === 'string' && this.isSensitiveKey(key)) {
          return '[MASKED]';
        }
        
        return value;
      }));
    } catch (error) {
      return { error: 'Failed to sanitize data', original: String(data) };
    }
  }

  /**
   * 機密キーの判定
   */
  isSensitiveKey(key) {
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'auth',
      'credential', 'private', 'confidential'
    ];
    
    return sensitiveKeys.some(sensitive => 
      key.toLowerCase().includes(sensitive)
    );
  }

  /**
   * メモリ情報の取得
   */
  getMemoryInfo(additional = {}) {
    const memoryInfo = {
      timestamp: Date.now(),
      ...additional
    };

    // Performance Memory API
    if (performance.memory) {
      memoryInfo.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
      memoryInfo.totalJSHeapSize = performance.memory.totalJSHeapSize;
      memoryInfo.usedJSHeapSize = performance.memory.usedJSHeapSize;
      memoryInfo.usedJSHeapSizeMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }

    // Navigator Memory API (実験的)
    if (navigator.memory) {
      memoryInfo.deviceMemory = navigator.memory.deviceMemory;
    }

    return memoryInfo;
  }

  /**
   * メモリ増加率の計算
   */
  calculateMemoryGrowthRate(snapshots) {
    if (snapshots.length < 2) return 0;

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    
    const timeDiff = (new Date(last.timestamp) - new Date(first.timestamp)) / 1000 / 60; // 分
    const memoryDiff = (last.memoryInfo.usedJSHeapSizeMB - first.memoryInfo.usedJSHeapSizeMB);
    
    return timeDiff > 0 ? memoryDiff / timeDiff : 0;
  }

  /**
   * セッションIDの取得
   */
  getSessionId() {
    if (!this.sessionId) {
      this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return this.sessionId;
  }

  /**
   * グローバルエラーハンドラーの設定
   */
  setupGlobalErrorHandler() {
    // 未処理エラーのキャッチ
    window.addEventListener('error', (event) => {
      this.error('Uncaught error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    // 未処理Promise拒否のキャッチ
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', {
        reason: event.reason,
        stack: event.reason?.stack
      });
    });
  }

  /**
   * パフォーマンス監視の開始
   */
  startPerformanceMonitoring() {
    // ページロード時間の監視
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.performance('DOMContentLoaded', performance.now());
      });
    }

    // リソース読み込み時間の監視
    window.addEventListener('load', () => {
      this.performance('WindowLoad', performance.now());
      
      // リソースタイミングの記録
      const resources = performance.getEntriesByType('resource');
      resources.forEach(resource => {
        if (resource.duration > 100) { // 100ms以上のリソースのみ
          this.performance(`Resource: ${resource.name}`, Math.round(resource.duration));
        }
      });
    });
  }

  /**
   * メモリ監視の開始
   */
  startMemoryMonitoring() {
    // 初期スナップショット
    this.takeMemorySnapshot('initial');

    // 定期的なメモリチェック
    setInterval(() => {
      this.takeMemorySnapshot('periodic');
      this.detectMemoryLeaks();
    }, 60000); // 1分間隔

    // ページアンロード時のスナップショット
    window.addEventListener('beforeunload', () => {
      this.takeMemorySnapshot('beforeunload');
    });
  }

  /**
   * ログレベルの変更
   */
  setLogLevel(level) {
    if (this.logLevels.hasOwnProperty(level)) {
      this.currentLogLevel = this.logLevels[level];
      this.options.logLevel = level;
      this.info(`Log level changed to: ${level}`);
    } else {
      this.warn(`Invalid log level: ${level}`);
    }
  }

  /**
   * デバッグモードの切り替え
   */
  toggleDebugMode() {
    this.options.debugMode = !this.options.debugMode;
    this.info(`Debug mode ${this.options.debugMode ? 'enabled' : 'disabled'}`);
    
    if (this.options.debugMode) {
      this.setupGlobalErrorHandler();
    }
  }

  /**
   * ログの検索
   */
  searchLogs(query, options = {}) {
    const {
      level = null,
      component = null,
      startTime = null,
      endTime = null,
      limit = 100
    } = options;

    let results = this.logEntries.filter(entry => {
      // テキスト検索
      const matchesQuery = !query || 
        entry.message.toLowerCase().includes(query.toLowerCase()) ||
        JSON.stringify(entry.data).toLowerCase().includes(query.toLowerCase());

      // レベルフィルター
      const matchesLevel = !level || entry.level === level;

      // コンポーネントフィルター
      const matchesComponent = !component || entry.component === component;

      // 時間範囲フィルター
      const entryTime = new Date(entry.timestamp);
      const matchesTimeRange = (!startTime || entryTime >= startTime) &&
                              (!endTime || entryTime <= endTime);

      return matchesQuery && matchesLevel && matchesComponent && matchesTimeRange;
    });

    // 結果数を制限
    if (results.length > limit) {
      results = results.slice(-limit);
    }

    return results;
  }

  /**
   * ログ統計の取得
   */
  getLogStatistics() {
    const stats = {
      total: this.logEntries.length,
      byLevel: {},
      byComponent: {},
      timeRange: {
        start: null,
        end: null
      },
      performanceMetrics: {
        averageDuration: 0,
        slowestOperations: []
      },
      memoryMetrics: {
        snapshots: this.memorySnapshots.length,
        currentUsage: null,
        leakDetected: false
      }
    };

    // レベル別統計
    this.logEntries.forEach(entry => {
      stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;
      stats.byComponent[entry.component] = (stats.byComponent[entry.component] || 0) + 1;
    });

    // 時間範囲
    if (this.logEntries.length > 0) {
      stats.timeRange.start = this.logEntries[0].timestamp;
      stats.timeRange.end = this.logEntries[this.logEntries.length - 1].timestamp;
    }

    // パフォーマンス統計
    const perfEntries = this.logEntries.filter(entry => entry.level === 'performance');
    if (perfEntries.length > 0) {
      const totalDuration = perfEntries.reduce((sum, entry) => sum + entry.duration, 0);
      stats.performanceMetrics.averageDuration = Math.round(totalDuration / perfEntries.length);
      
      stats.performanceMetrics.slowestOperations = perfEntries
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map(entry => ({
          operation: entry.operation,
          duration: entry.duration,
          timestamp: entry.timestamp
        }));
    }

    // メモリ統計
    if (this.memorySnapshots.length > 0) {
      const latest = this.memorySnapshots[this.memorySnapshots.length - 1];
      stats.memoryMetrics.currentUsage = latest.memoryInfo.usedJSHeapSizeMB;
      
      const leakDetection = this.detectMemoryLeaks();
      stats.memoryMetrics.leakDetected = leakDetection?.detected || false;
    }

    return stats;
  }

  /**
   * ログのエクスポート
   */
  async exportLogs(format = 'json') {
    const logs = {
      metadata: {
        exportTime: new Date().toISOString(),
        component: this.component,
        sessionId: this.sessionId,
        totalEntries: this.logEntries.length
      },
      logs: this.logEntries,
      statistics: this.getLogStatistics(),
      memorySnapshots: this.memorySnapshots
    };

    switch (format) {
      case 'json':
        return JSON.stringify(logs, null, 2);
      
      case 'csv':
        return this.convertToCSV(this.logEntries);
      
      case 'text':
        return this.convertToText(this.logEntries);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * CSV形式への変換
   */
  convertToCSV(entries) {
    const headers = ['timestamp', 'level', 'component', 'message', 'data'];
    const csvRows = [headers.join(',')];

    entries.forEach(entry => {
      const row = [
        entry.timestamp,
        entry.level,
        entry.component,
        `"${entry.message.replace(/"/g, '""')}"`,
        `"${JSON.stringify(entry.data).replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * テキスト形式への変換
   */
  convertToText(entries) {
    return entries.map(entry => {
      const dataStr = Object.keys(entry.data).length > 0 ? 
        `\n  Data: ${JSON.stringify(entry.data, null, 2)}` : '';
      
      return `[${entry.timestamp}] ${entry.level.toUpperCase()} [${entry.component}]: ${entry.message}${dataStr}`;
    }).join('\n\n');
  }

  /**
   * ログのクリア
   */
  clearLogs() {
    const clearedCount = this.logEntries.length;
    this.logEntries = [];
    this.memorySnapshots = [];
    this.performanceMarkers.clear();
    
    this.info(`Logs cleared (${clearedCount} entries removed)`);
    
    // ストレージからもクリア
    if (this.options.logToStorage) {
      this.clearStoredLogs();
    }
  }

  /**
   * ストレージログのクリア
   */
  async clearStoredLogs() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.remove([this.options.storageKey]);
      } else {
        localStorage.removeItem(this.options.storageKey);
      }
    } catch (error) {
      this.error('Failed to clear stored logs', { error: error.message });
    }
  }

  /**
   * リソースのクリーンアップ
   */
  cleanup() {
    this.clearLogs();
    
    // イベントリスナーの削除
    if (this.options.debugMode) {
      window.removeEventListener('error', this.globalErrorHandler);
      window.removeEventListener('unhandledrejection', this.globalRejectionHandler);
    }
    
    this.info('Debug logger cleaned up');
  }
}

// グローバルデバッグロガーインスタンス
let globalDebugLogger = null;

/**
 * グローバルデバッグロガーの取得/作成
 */
function getDebugLogger(component = 'Global', options = {}) {
  if (!globalDebugLogger) {
    globalDebugLogger = new DebugLogger(component, {
      debugMode: true,
      logLevel: 'debug',
      enablePerformanceLogging: true,
      enableMemoryLogging: true,
      logToStorage: true,
      ...options
    });
  }
  
  return globalDebugLogger;
}

/**
 * コンポーネント専用デバッグロガーの作成
 */
function createComponentLogger(component, options = {}) {
  return new DebugLogger(component, {
    debugMode: false,
    logLevel: 'info',
    enablePerformanceLogging: false,
    enableMemoryLogging: false,
    logToStorage: false,
    ...options
  });
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DebugLogger, getDebugLogger, createComponentLogger };
} else if (typeof window !== 'undefined') {
  window.DebugLogger = DebugLogger;
  window.getDebugLogger = getDebugLogger;
  window.createComponentLogger = createComponentLogger;
}