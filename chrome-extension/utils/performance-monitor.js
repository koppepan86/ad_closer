/**
 * パフォーマンス監視システム
 * 拡張機能の影響とパフォーマンスメトリクスを監視
 */

/**
 * パフォーマンス監視クラス
 */
class PerformanceMonitor {
  constructor(logger) {
    this.logger = logger;
    this.metrics = new Map();
    this.observers = new Map();
    this.timers = new Map();
    this.thresholds = new Map();
    this.alerts = [];
    this.isMonitoring = false;
    
    this.initializeMonitoring();
    this.setupThresholds();
    this.setupPerformanceObservers();
  }

  /**
   * 監視システムの初期化
   */
  initializeMonitoring() {
    // 基本メトリクスの初期化
    this.metrics.set('extension_load_time', []);
    this.metrics.set('popup_detection_time', []);
    this.metrics.set('dom_scan_time', []);
    this.metrics.set('analysis_time', []);
    this.metrics.set('notification_time', []);
    this.metrics.set('memory_usage', []);
    this.metrics.set('cpu_usage', []);
    this.metrics.set('page_impact', []);
    this.metrics.set('user_interaction_delay', []);
    this.metrics.set('storage_operation_time', []);
    this.metrics.set('communication_latency', []);

    // 定期的なメトリクス収集
    this.startPeriodicCollection();
  }

  /**
   * パフォーマンス閾値を設定
   */
  setupThresholds() {
    this.thresholds.set('popup_detection_time', { warning: 100, critical: 500 }); // ms
    this.thresholds.set('dom_scan_time', { warning: 50, critical: 200 }); // ms
    this.thresholds.set('analysis_time', { warning: 30, critical: 100 }); // ms
    this.thresholds.set('notification_time', { warning: 20, critical: 50 }); // ms
    this.thresholds.set('memory_usage', { warning: 50, critical: 100 }); // MB
    this.thresholds.set('page_impact', { warning: 10, critical: 50 }); // ms
    this.thresholds.set('user_interaction_delay', { warning: 16, critical: 33 }); // ms (60fps, 30fps)
    this.thresholds.set('storage_operation_time', { warning: 100, critical: 500 }); // ms
    this.thresholds.set('communication_latency', { warning: 200, critical: 1000 }); // ms
  }

  /**
   * Performance Observer を設定
   */
  setupPerformanceObservers() {
    if (typeof PerformanceObserver === 'undefined') {
      this.logger.warn('PERFORMANCE', 'PerformanceObserver が利用できません');
      return;
    }

    try {
      // Long Task Observer
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordLongTask(entry);
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.set('longtask', longTaskObserver);

      // Navigation Observer
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordNavigationTiming(entry);
        }
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.set('navigation', navigationObserver);

      // Resource Observer
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordResourceTiming(entry);
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.set('resource', resourceObserver);

      // Measure Observer
      const measureObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMeasure(entry);
        }
      });
      measureObserver.observe({ entryTypes: ['measure'] });
      this.observers.set('measure', measureObserver);

    } catch (error) {
      this.logger.error('PERFORMANCE', 'Performance Observer の設定に失敗', { error: error.message });
    }
  }

  /**
   * 定期的なメトリクス収集を開始
   */
  startPeriodicCollection() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // メモリ使用量監視 (5秒間隔)
    const memoryTimer = setInterval(() => {
      this.collectMemoryMetrics();
    }, 5000);
    this.timers.set('memory', memoryTimer);

    // CPU使用量監視 (10秒間隔)
    const cpuTimer = setInterval(() => {
      this.collectCPUMetrics();
    }, 10000);
    this.timers.set('cpu', cpuTimer);

    // ページ影響監視 (1秒間隔)
    const pageImpactTimer = setInterval(() => {
      this.collectPageImpactMetrics();
    }, 1000);
    this.timers.set('pageImpact', pageImpactTimer);

    // ストレージ監視 (30秒間隔)
    const storageTimer = setInterval(() => {
      this.collectStorageMetrics();
    }, 30000);
    this.timers.set('storage', storageTimer);

    this.logger.info('PERFORMANCE', 'パフォーマンス監視を開始しました');
  }

  /**
   * 定期的なメトリクス収集を停止
   */
  stopPeriodicCollection() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    // すべてのタイマーを停止
    for (const [name, timer] of this.timers.entries()) {
      clearInterval(timer);
    }
    this.timers.clear();

    this.logger.info('PERFORMANCE', 'パフォーマンス監視を停止しました');
  }

  /**
   * パフォーマンス測定を開始
   */
  startMeasure(name, category = 'general') {
    const measureName = `${category}_${name}`;
    const startMark = `${measureName}_start`;
    
    try {
      performance.mark(startMark);
      
      return {
        end: () => this.endMeasure(measureName, startMark),
        name: measureName
      };
    } catch (error) {
      this.logger.warn('PERFORMANCE', 'パフォーマンス測定開始に失敗', { 
        name: measureName, 
        error: error.message 
      });
      
      // フォールバック: 手動タイマー
      const startTime = Date.now();
      return {
        end: () => {
          const duration = Date.now() - startTime;
          this.recordMetric(name, duration, category);
          return duration;
        },
        name: measureName
      };
    }
  }

  /**
   * パフォーマンス測定を終了
   */
  endMeasure(measureName, startMark) {
    const endMark = `${measureName}_end`;
    
    try {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);
      
      const measure = performance.getEntriesByName(measureName, 'measure')[0];
      if (measure) {
        const category = measureName.split('_')[0];
        const name = measureName.substring(category.length + 1);
        this.recordMetric(name, measure.duration, category);
        
        // マークとメジャーをクリーンアップ
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(measureName);
        
        return measure.duration;
      }
    } catch (error) {
      this.logger.warn('PERFORMANCE', 'パフォーマンス測定終了に失敗', { 
        measureName, 
        error: error.message 
      });
    }
    
    return 0;
  }

  /**
   * メトリクスを記録
   */
  recordMetric(name, value, category = 'general', metadata = {}) {
    const metricEntry = {
      name,
      value,
      category,
      timestamp: Date.now(),
      metadata
    };

    // メトリクス配列に追加
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metricArray = this.metrics.get(name);
    metricArray.push(metricEntry);

    // 最大1000件まで保持
    if (metricArray.length > 1000) {
      metricArray.splice(0, metricArray.length - 1000);
    }

    // 閾値チェック
    this.checkThreshold(name, value);

    // ロガーにも記録
    this.logger.recordPerformanceMetric(name, metricEntry);

    this.logger.debug('PERFORMANCE', `メトリクス記録: ${name}`, {
      value,
      category,
      metadata
    });
  }

  /**
   * 閾値チェック
   */
  checkThreshold(metricName, value) {
    const threshold = this.thresholds.get(metricName);
    if (!threshold) return;

    let alertLevel = null;
    let message = '';

    if (value >= threshold.critical) {
      alertLevel = 'critical';
      message = `${metricName} が重要な閾値を超えました: ${value}`;
    } else if (value >= threshold.warning) {
      alertLevel = 'warning';
      message = `${metricName} が警告閾値を超えました: ${value}`;
    }

    if (alertLevel) {
      const alert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        level: alertLevel,
        metric: metricName,
        value,
        threshold: threshold[alertLevel],
        message
      };

      this.alerts.push(alert);

      // 最大100件まで保持
      if (this.alerts.length > 100) {
        this.alerts.splice(0, this.alerts.length - 100);
      }

      // ログに記録
      const logLevel = alertLevel === 'critical' ? 'ERROR' : 'WARN';
      this.logger[logLevel.toLowerCase()]('PERFORMANCE', message, {
        metric: metricName,
        value,
        threshold: threshold[alertLevel]
      });
    }
  }

  /**
   * Long Task を記録
   */
  recordLongTask(entry) {
    this.recordMetric('long_task_duration', entry.duration, 'longtask', {
      name: entry.name,
      startTime: entry.startTime,
      attribution: entry.attribution
    });

    // 長時間タスクは常に警告
    this.logger.warn('PERFORMANCE', 'Long Task が検出されました', {
      duration: entry.duration,
      name: entry.name,
      startTime: entry.startTime
    });
  }

  /**
   * ナビゲーションタイミングを記録
   */
  recordNavigationTiming(entry) {
    const metrics = {
      'dns_lookup_time': entry.domainLookupEnd - entry.domainLookupStart,
      'tcp_connect_time': entry.connectEnd - entry.connectStart,
      'request_time': entry.responseStart - entry.requestStart,
      'response_time': entry.responseEnd - entry.responseStart,
      'dom_processing_time': entry.domContentLoadedEventStart - entry.responseEnd,
      'load_event_time': entry.loadEventEnd - entry.loadEventStart
    };

    for (const [name, value] of Object.entries(metrics)) {
      if (value >= 0) {
        this.recordMetric(name, value, 'navigation');
      }
    }
  }

  /**
   * リソースタイミングを記録
   */
  recordResourceTiming(entry) {
    // 拡張機能のリソースのみ監視
    if (entry.name.includes('chrome-extension://')) {
      const loadTime = entry.responseEnd - entry.startTime;
      this.recordMetric('extension_resource_load_time', loadTime, 'resource', {
        name: entry.name,
        size: entry.transferSize || entry.encodedBodySize,
        type: entry.initiatorType
      });
    }
  }

  /**
   * カスタムメジャーを記録
   */
  recordMeasure(entry) {
    // 拡張機能関連のメジャーのみ処理
    if (entry.name.includes('popup_blocker') || entry.name.includes('extension')) {
      const category = entry.name.split('_')[0] || 'custom';
      this.recordMetric(entry.name, entry.duration, category);
    }
  }

  /**
   * メモリメトリクスを収集
   */
  collectMemoryMetrics() {
    if (typeof performance === 'undefined' || !performance.memory) {
      return;
    }

    const memory = performance.memory;
    const usedMB = memory.usedJSHeapSize / (1024 * 1024);
    const totalMB = memory.totalJSHeapSize / (1024 * 1024);
    const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);

    this.recordMetric('memory_used', usedMB, 'memory');
    this.recordMetric('memory_total', totalMB, 'memory');
    this.recordMetric('memory_limit', limitMB, 'memory');
    this.recordMetric('memory_usage_percentage', (usedMB / limitMB) * 100, 'memory');
  }

  /**
   * CPU使用量メトリクスを収集
   */
  collectCPUMetrics() {
    // CPU使用量の直接測定は困難なため、間接的な指標を使用
    const startTime = performance.now();
    
    // 短時間の計算集約的なタスクを実行
    let iterations = 0;
    const endTime = startTime + 10; // 10ms間実行
    
    while (performance.now() < endTime) {
      iterations++;
    }
    
    const actualTime = performance.now() - startTime;
    const efficiency = iterations / actualTime; // 1ms当たりの反復数
    
    this.recordMetric('cpu_efficiency', efficiency, 'cpu', {
      iterations,
      actualTime,
      expectedTime: 10
    });

    // システム負荷の推定
    if (actualTime > 15) { // 期待値より50%以上遅い
      this.recordMetric('system_load', 'high', 'cpu');
    } else if (actualTime > 12) {
      this.recordMetric('system_load', 'medium', 'cpu');
    } else {
      this.recordMetric('system_load', 'low', 'cpu');
    }
  }

  /**
   * ページ影響メトリクスを収集
   */
  collectPageImpactMetrics() {
    // DOM要素数の変化を監視
    const elementCount = document.querySelectorAll('*').length;
    this.recordMetric('dom_element_count', elementCount, 'page_impact');

    // 拡張機能が追加した要素数
    const extensionElements = document.querySelectorAll('[data-popup-blocker], [id*="popup-blocker"]').length;
    this.recordMetric('extension_dom_elements', extensionElements, 'page_impact');

    // スクロール性能の測定
    this.measureScrollPerformance();

    // レンダリング性能の測定
    this.measureRenderingPerformance();
  }

  /**
   * スクロール性能を測定
   */
  measureScrollPerformance() {
    if (typeof requestAnimationFrame === 'undefined') return;

    let frameCount = 0;
    let startTime = performance.now();
    
    const measureFrame = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - startTime >= 1000) { // 1秒間測定
        const fps = frameCount;
        this.recordMetric('scroll_fps', fps, 'page_impact');
        
        if (fps < 30) {
          this.logger.warn('PERFORMANCE', 'スクロール性能が低下しています', { fps });
        }
        
        return;
      }
      
      requestAnimationFrame(measureFrame);
    };
    
    // スクロールイベント中のみ測定
    let isScrolling = false;
    const scrollHandler = () => {
      if (!isScrolling) {
        isScrolling = true;
        frameCount = 0;
        startTime = performance.now();
        requestAnimationFrame(measureFrame);
        
        setTimeout(() => {
          isScrolling = false;
        }, 1000);
      }
    };
    
    // 一時的にスクロールリスナーを追加
    window.addEventListener('scroll', scrollHandler, { passive: true, once: true });
  }

  /**
   * レンダリング性能を測定
   */
  measureRenderingPerformance() {
    if (typeof requestAnimationFrame === 'undefined') return;

    const startTime = performance.now();
    
    requestAnimationFrame(() => {
      const renderTime = performance.now() - startTime;
      this.recordMetric('render_frame_time', renderTime, 'page_impact');
      
      if (renderTime > 16.67) { // 60fps threshold
        this.recordMetric('dropped_frames', 1, 'page_impact');
      }
    });
  }

  /**
   * ストレージメトリクスを収集
   */
  async collectStorageMetrics() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    try {
      const startTime = performance.now();
      
      // ストレージ使用量を取得
      const usage = await new Promise((resolve, reject) => {
        chrome.storage.local.getBytesInUse(null, (bytes) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(bytes);
          }
        });
      });
      
      const operationTime = performance.now() - startTime;
      
      this.recordMetric('storage_usage_bytes', usage, 'storage');
      this.recordMetric('storage_operation_time', operationTime, 'storage');
      
      // ストレージ使用量が多い場合は警告
      const usageMB = usage / (1024 * 1024);
      if (usageMB > 5) { // 5MB以上
        this.logger.warn('PERFORMANCE', 'ストレージ使用量が多くなっています', { 
          usageMB: usageMB.toFixed(2) 
        });
      }
      
    } catch (error) {
      this.logger.error('PERFORMANCE', 'ストレージメトリクス収集に失敗', { 
        error: error.message 
      });
    }
  }

  /**
   * 通信遅延を測定
   */
  async measureCommunicationLatency() {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;

    const startTime = performance.now();
    
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('通信タイムアウト'));
        }, 5000);
        
        chrome.runtime.sendMessage({ type: 'PING', timestamp: startTime }, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      const latency = performance.now() - startTime;
      this.recordMetric('communication_latency', latency, 'communication');
      
    } catch (error) {
      this.recordMetric('communication_error', 1, 'communication');
      this.logger.error('PERFORMANCE', '通信遅延測定に失敗', { error: error.message });
    }
  }

  /**
   * ユーザーインタラクション遅延を測定
   */
  measureUserInteractionDelay(eventType, callback) {
    const startTime = performance.now();
    
    return (...args) => {
      const delay = performance.now() - startTime;
      this.recordMetric('user_interaction_delay', delay, 'interaction', {
        eventType,
        delay
      });
      
      if (delay > 100) { // 100ms以上の遅延
        this.logger.warn('PERFORMANCE', 'ユーザーインタラクションに遅延が発生', {
          eventType,
          delay
        });
      }
      
      return callback(...args);
    };
  }

  /**
   * パフォーマンスレポートを生成
   */
  generatePerformanceReport() {
    const report = {
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent,
      summary: this.generateSummary(),
      metrics: this.getMetricsSummary(),
      alerts: this.alerts.slice(-20), // 最新20件のアラート
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * サマリーを生成
   */
  generateSummary() {
    const summary = {
      totalMetrics: this.metrics.size,
      totalAlerts: this.alerts.length,
      criticalAlerts: this.alerts.filter(a => a.level === 'critical').length,
      warningAlerts: this.alerts.filter(a => a.level === 'warning').length,
      monitoringDuration: this.isMonitoring ? Date.now() - (this.startTime || Date.now()) : 0
    };

    // 主要メトリクスの平均値
    const keyMetrics = ['popup_detection_time', 'memory_used', 'communication_latency'];
    for (const metric of keyMetrics) {
      const values = this.metrics.get(metric);
      if (values && values.length > 0) {
        const average = values.reduce((sum, entry) => sum + entry.value, 0) / values.length;
        summary[`${metric}_average`] = average;
      }
    }

    return summary;
  }

  /**
   * メトリクスサマリーを取得
   */
  getMetricsSummary() {
    const summary = {};
    
    for (const [name, entries] of this.metrics.entries()) {
      if (entries.length === 0) continue;
      
      const values = entries.map(e => e.value).filter(v => typeof v === 'number');
      if (values.length === 0) continue;
      
      summary[name] = {
        count: values.length,
        average: values.reduce((sum, v) => sum + v, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        latest: entries[entries.length - 1].value,
        trend: this.calculateTrend(values)
      };
    }
    
    return summary;
  }

  /**
   * トレンドを計算
   */
  calculateTrend(values) {
    if (values.length < 2) return 'insufficient_data';
    
    const recent = values.slice(-10); // 最新10件
    const older = values.slice(-20, -10); // その前の10件
    
    if (older.length === 0) return 'insufficient_data';
    
    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * 推奨事項を生成
   */
  generateRecommendations() {
    const recommendations = [];
    const summary = this.getMetricsSummary();
    
    // メモリ使用量の推奨事項
    if (summary.memory_used && summary.memory_used.average > 50) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'メモリ使用量が高くなっています。不要なデータのクリーンアップを検討してください。',
        action: 'cleanup_memory'
      });
    }
    
    // ポップアップ検出時間の推奨事項
    if (summary.popup_detection_time && summary.popup_detection_time.average > 100) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'ポップアップ検出に時間がかかっています。検出アルゴリズムの最適化を検討してください。',
        action: 'optimize_detection'
      });
    }
    
    // 通信遅延の推奨事項
    if (summary.communication_latency && summary.communication_latency.average > 200) {
      recommendations.push({
        type: 'communication',
        priority: 'medium',
        message: '通信遅延が発生しています。メッセージパッシングの最適化を検討してください。',
        action: 'optimize_communication'
      });
    }
    
    // アラート数の推奨事項
    if (this.alerts.length > 50) {
      recommendations.push({
        type: 'monitoring',
        priority: 'low',
        message: 'アラートが多数発生しています。閾値の調整を検討してください。',
        action: 'adjust_thresholds'
      });
    }
    
    return recommendations;
  }

  /**
   * メトリクスをクリア
   */
  clearMetrics() {
    this.metrics.clear();
    this.alerts = [];
    this.initializeMonitoring();
    this.logger.info('PERFORMANCE', 'パフォーマンスメトリクスをクリアしました');
  }

  /**
   * 監視を停止してクリーンアップ
   */
  destroy() {
    this.stopPeriodicCollection();
    
    // Performance Observer を停止
    for (const [name, observer] of this.observers.entries()) {
      try {
        observer.disconnect();
      } catch (error) {
        this.logger.warn('PERFORMANCE', `Observer停止に失敗: ${name}`, { error: error.message });
      }
    }
    this.observers.clear();
    
    this.logger.info('PERFORMANCE', 'パフォーマンス監視を終了しました');
  }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PerformanceMonitor };
} else if (typeof window !== 'undefined') {
  window.PerformanceMonitor = PerformanceMonitor;
}