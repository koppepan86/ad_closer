/**
 * パフォーマンス最適化システム
 * メモリ使用量とCPU使用率を最適化し、拡張機能の影響を最小限に抑える
 */

/**
 * パフォーマンス最適化クラス
 */
class PerformanceOptimizer {
  constructor(logger) {
    this.logger = logger;
    this.config = {
      // メモリ管理設定
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      memoryCleanupInterval: 300000, // 5分
      maxCacheSize: 1000,
      maxHistorySize: 500,
      
      // CPU使用率設定
      maxCPUUsage: 10, // 10%
      throttleDelay: 16, // 60fps
      batchSize: 10,
      
      // DOM操作最適化
      debounceDelay: 100,
      maxDOMObservations: 100,
      observerThrottle: 50,
      
      // ストレージ最適化
      storageCompressionThreshold: 1024, // 1KB
      maxStorageOperationsPerSecond: 10,
      
      // 通信最適化
      messageQueueSize: 50,
      communicationTimeout: 5000,
      retryAttempts: 3
    };
    
    this.state = {
      memoryUsage: 0,
      cpuUsage: 0,
      isOptimizing: false,
      lastCleanup: Date.now(),
      operationQueue: [],
      throttledOperations: new Map(),
      debouncedOperations: new Map()
    };
    
    this.caches = new Map();
    this.timers = new Map();
    
    this.initializeOptimization();
  }

  /**
   * 最適化システムの初期化
   */
  initializeOptimization() {
    // メモリクリーンアップタイマー
    const cleanupTimer = setInterval(() => {
      this.performMemoryCleanup();
    }, this.config.memoryCleanupInterval);
    this.timers.set('cleanup', cleanupTimer);
    
    // パフォーマンス監視タイマー
    const monitorTimer = setInterval(() => {
      this.monitorPerformance();
    }, 10000); // 10秒間隔
    this.timers.set('monitor', monitorTimer);
    
    // 操作キュー処理タイマー
    const queueTimer = setInterval(() => {
      this.processOperationQueue();
    }, 100); // 100ms間隔
    this.timers.set('queue', queueTimer);
    
    this.logger.info('PERFORMANCE_OPTIMIZER', '最適化システムを初期化しました');
  }

  /**
   * メモリクリーンアップを実行
   */
  performMemoryCleanup() {
    if (this.state.isOptimizing) return;
    
    this.state.isOptimizing = true;
    const startTime = performance.now();
    
    try {
      let cleanedBytes = 0;
      
      // キャッシュクリーンアップ
      cleanedBytes += this.cleanupCaches();
      
      // DOM要素クリーンアップ
      cleanedBytes += this.cleanupDOMElements();
      
      // イベントリスナークリーンアップ
      cleanedBytes += this.cleanupEventListeners();
      
      // ストレージクリーンアップ
      cleanedBytes += this.cleanupStorage();
      
      // ガベージコレクション促進
      this.forceGarbageCollection();
      
      const duration = performance.now() - startTime;
      this.state.lastCleanup = Date.now();
      
      this.logger.info('PERFORMANCE_OPTIMIZER', 'メモリクリーンアップ完了', {
        cleanedBytes,
        duration,
        memoryBefore: this.state.memoryUsage
      });
      
    } catch (error) {
      this.logger.error('PERFORMANCE_OPTIMIZER', 'メモリクリーンアップに失敗', {
        error: error.message
      });
    } finally {
      this.state.isOptimizing = false;
    }
  }

  /**
   * キャッシュクリーンアップ
   */
  cleanupCaches() {
    let cleanedBytes = 0;
    
    for (const [name, cache] of this.caches.entries()) {
      if (cache.size > this.config.maxCacheSize) {
        const oldSize = cache.size;
        
        // LRU方式でクリーンアップ
        const entries = Array.from(cache.entries());
        entries.sort((a, b) => (a[1].lastAccess || 0) - (b[1].lastAccess || 0));
        
        const toRemove = entries.slice(0, oldSize - this.config.maxCacheSize);
        for (const [key] of toRemove) {
          cache.delete(key);
        }
        
        cleanedBytes += (oldSize - cache.size) * 100; // 推定サイズ
        
        this.logger.debug('PERFORMANCE_OPTIMIZER', `キャッシュクリーンアップ: ${name}`, {
          oldSize,
          newSize: cache.size,
          removed: toRemove.length
        });
      }
    }
    
    return cleanedBytes;
  }

  /**
   * DOM要素クリーンアップ
   */
  cleanupDOMElements() {
    let cleanedBytes = 0;
    
    try {
      // 拡張機能が作成した不要な要素を削除
      const extensionElements = document.querySelectorAll('[data-popup-blocker-temp="true"]');
      for (const element of extensionElements) {
        element.remove();
        cleanedBytes += 50; // 推定サイズ
      }
      
      // 古い通知要素を削除
      const oldNotifications = document.querySelectorAll('[data-popup-blocker-notification]');
      const now = Date.now();
      for (const notification of oldNotifications) {
        const timestamp = parseInt(notification.dataset.timestamp || '0');
        if (now - timestamp > 300000) { // 5分以上古い
          notification.remove();
          cleanedBytes += 100; // 推定サイズ
        }
      }
      
    } catch (error) {
      this.logger.warn('PERFORMANCE_OPTIMIZER', 'DOM要素クリーンアップに失敗', {
        error: error.message
      });
    }
    
    return cleanedBytes;
  }

  /**
   * イベントリスナークリーンアップ
   */
  cleanupEventListeners() {
    let cleanedBytes = 0;
    
    // 使用されていないイベントリスナーを削除
    // （実装は具体的なイベントリスナー管理システムに依存）
    
    return cleanedBytes;
  }

  /**
   * ストレージクリーンアップ
   */
  async cleanupStorage() {
    let cleanedBytes = 0;
    
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // 古いデータを削除
        const data = await new Promise((resolve) => {
          chrome.storage.local.get(null, resolve);
        });
        
        const now = Date.now();
        const toRemove = [];
        
        for (const [key, value] of Object.entries(data)) {
          // 一時データの削除
          if (key.startsWith('temp_') && value.timestamp && now - value.timestamp > 3600000) { // 1時間
            toRemove.push(key);
          }
          
          // 古い統計データの削除
          if (key.startsWith('stats_') && value.timestamp && now - value.timestamp > 2592000000) { // 30日
            toRemove.push(key);
          }
        }
        
        if (toRemove.length > 0) {
          await new Promise((resolve) => {
            chrome.storage.local.remove(toRemove, resolve);
          });
          
          cleanedBytes = toRemove.length * 100; // 推定サイズ
          
          this.logger.debug('PERFORMANCE_OPTIMIZER', 'ストレージクリーンアップ完了', {
            removedKeys: toRemove.length
          });
        }
      }
    } catch (error) {
      this.logger.warn('PERFORMANCE_OPTIMIZER', 'ストレージクリーンアップに失敗', {
        error: error.message
      });
    }
    
    return cleanedBytes;
  }

  /**
   * ガベージコレクション促進
   */
  forceGarbageCollection() {
    // 参照を削除してGCを促進
    if (typeof window !== 'undefined' && window.gc) {
      try {
        window.gc();
      } catch (error) {
        // GCが利用できない場合は無視
      }
    }
    
    // 手動でnull参照を作成
    let temp = new Array(1000).fill(null);
    temp = null;
  }

  /**
   * パフォーマンス監視
   */
  monitorPerformance() {
    // メモリ使用量チェック
    if (typeof performance !== 'undefined' && performance.memory) {
      this.state.memoryUsage = performance.memory.usedJSHeapSize;
      
      if (this.state.memoryUsage > this.config.maxMemoryUsage) {
        this.logger.warn('PERFORMANCE_OPTIMIZER', 'メモリ使用量が上限を超えています', {
          current: this.state.memoryUsage,
          limit: this.config.maxMemoryUsage
        });
        
        // 緊急クリーンアップ
        this.performMemoryCleanup();
      }
    }
    
    // CPU使用量の推定
    this.estimateCPUUsage();
  }

  /**
   * CPU使用量の推定
   */
  estimateCPUUsage() {
    const startTime = performance.now();
    let iterations = 0;
    const testDuration = 10; // 10ms
    
    const endTime = startTime + testDuration;
    while (performance.now() < endTime) {
      iterations++;
    }
    
    const actualDuration = performance.now() - startTime;
    const efficiency = iterations / actualDuration;
    
    // 基準値と比較してCPU使用率を推定
    const baselineEfficiency = 10000; // 基準値（調整が必要）
    const estimatedUsage = Math.max(0, 100 - (efficiency / baselineEfficiency * 100));
    
    this.state.cpuUsage = estimatedUsage;
    
    if (estimatedUsage > this.config.maxCPUUsage) {
      this.logger.warn('PERFORMANCE_OPTIMIZER', 'CPU使用率が高くなっています', {
        estimated: estimatedUsage,
        limit: this.config.maxCPUUsage
      });
      
      // スロットリング強化
      this.increaseThrottling();
    }
  }

  /**
   * スロットリング強化
   */
  increaseThrottling() {
    // 操作間隔を増加
    this.config.throttleDelay = Math.min(this.config.throttleDelay * 1.5, 100);
    this.config.batchSize = Math.max(this.config.batchSize * 0.8, 5);
    
    this.logger.info('PERFORMANCE_OPTIMIZER', 'スロットリングを強化しました', {
      throttleDelay: this.config.throttleDelay,
      batchSize: this.config.batchSize
    });
  }

  /**
   * 操作をスロットリング
   */
  throttle(key, operation, delay = this.config.throttleDelay) {
    if (this.state.throttledOperations.has(key)) {
      return; // 既にスロットリング中
    }
    
    this.state.throttledOperations.set(key, true);
    
    setTimeout(() => {
      try {
        operation();
      } catch (error) {
        this.logger.error('PERFORMANCE_OPTIMIZER', 'スロットリング操作でエラー', {
          key,
          error: error.message
        });
      } finally {
        this.state.throttledOperations.delete(key);
      }
    }, delay);
  }

  /**
   * 操作をデバウンス
   */
  debounce(key, operation, delay = this.config.debounceDelay) {
    // 既存のタイマーをクリア
    if (this.state.debouncedOperations.has(key)) {
      clearTimeout(this.state.debouncedOperations.get(key));
    }
    
    const timer = setTimeout(() => {
      try {
        operation();
      } catch (error) {
        this.logger.error('PERFORMANCE_OPTIMIZER', 'デバウンス操作でエラー', {
          key,
          error: error.message
        });
      } finally {
        this.state.debouncedOperations.delete(key);
      }
    }, delay);
    
    this.state.debouncedOperations.set(key, timer);
  }

  /**
   * 操作をキューに追加
   */
  queueOperation(operation, priority = 'normal') {
    if (this.state.operationQueue.length >= this.config.messageQueueSize) {
      // キューが満杯の場合、低優先度の操作を削除
      const lowPriorityIndex = this.state.operationQueue.findIndex(op => op.priority === 'low');
      if (lowPriorityIndex !== -1) {
        this.state.operationQueue.splice(lowPriorityIndex, 1);
      } else {
        this.logger.warn('PERFORMANCE_OPTIMIZER', '操作キューが満杯です');
        return false;
      }
    }
    
    this.state.operationQueue.push({
      operation,
      priority,
      timestamp: Date.now()
    });
    
    // 優先度でソート
    this.state.operationQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    return true;
  }

  /**
   * 操作キューを処理
   */
  processOperationQueue() {
    if (this.state.operationQueue.length === 0) return;
    
    const batchSize = Math.min(this.config.batchSize, this.state.operationQueue.length);
    const batch = this.state.operationQueue.splice(0, batchSize);
    
    for (const { operation, priority, timestamp } of batch) {
      try {
        // タイムアウトチェック
        if (Date.now() - timestamp > this.config.communicationTimeout) {
          this.logger.warn('PERFORMANCE_OPTIMIZER', '操作がタイムアウトしました', { priority });
          continue;
        }
        
        operation();
      } catch (error) {
        this.logger.error('PERFORMANCE_OPTIMIZER', 'キュー操作でエラー', {
          priority,
          error: error.message
        });
      }
    }
  }

  /**
   * キャッシュを取得または作成
   */
  getCache(name, maxSize = this.config.maxCacheSize) {
    if (!this.caches.has(name)) {
      this.caches.set(name, new Map());
    }
    
    const cache = this.caches.get(name);
    
    // サイズ制限チェック
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => (a[1].lastAccess || 0) - (b[1].lastAccess || 0));
      
      const toRemove = entries.slice(0, cache.size - maxSize);
      for (const [key] of toRemove) {
        cache.delete(key);
      }
    }
    
    return cache;
  }

  /**
   * キャッシュから値を取得
   */
  getCachedValue(cacheName, key) {
    const cache = this.getCache(cacheName);
    const entry = cache.get(key);
    
    if (entry) {
      entry.lastAccess = Date.now();
      entry.accessCount = (entry.accessCount || 0) + 1;
      return entry.value;
    }
    
    return null;
  }

  /**
   * キャッシュに値を設定
   */
  setCachedValue(cacheName, key, value, ttl = 300000) { // 5分のTTL
    const cache = this.getCache(cacheName);
    
    cache.set(key, {
      value,
      timestamp: Date.now(),
      lastAccess: Date.now(),
      accessCount: 1,
      ttl
    });
  }

  /**
   * 期限切れキャッシュエントリを削除
   */
  cleanExpiredCache(cacheName) {
    const cache = this.getCache(cacheName);
    const now = Date.now();
    
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        cache.delete(key);
      }
    }
  }

  /**
   * DOM操作を最適化
   */
  optimizeDOMOperation(operation) {
    return this.throttle('dom_operation', () => {
      // DocumentFragmentを使用してDOM操作を最適化
      const fragment = document.createDocumentFragment();
      
      try {
        operation(fragment);
        
        // 一度にDOMに追加
        if (fragment.children.length > 0) {
          document.body.appendChild(fragment);
        }
      } catch (error) {
        this.logger.error('PERFORMANCE_OPTIMIZER', 'DOM操作の最適化でエラー', {
          error: error.message
        });
      }
    });
  }

  /**
   * ストレージ操作を最適化
   */
  async optimizedStorageOperation(operation) {
    return new Promise((resolve, reject) => {
      this.queueOperation(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, 'normal');
    });
  }

  /**
   * 最適化統計を取得
   */
  getOptimizationStats() {
    return {
      memoryUsage: this.state.memoryUsage,
      cpuUsage: this.state.cpuUsage,
      lastCleanup: this.state.lastCleanup,
      operationQueueSize: this.state.operationQueue.length,
      throttledOperations: this.state.throttledOperations.size,
      debouncedOperations: this.state.debouncedOperations.size,
      cacheCount: this.caches.size,
      config: { ...this.config }
    };
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('PERFORMANCE_OPTIMIZER', '設定を更新しました', { newConfig });
  }

  /**
   * 最適化システムを停止
   */
  destroy() {
    // すべてのタイマーを停止
    for (const [name, timer] of this.timers.entries()) {
      clearInterval(timer);
    }
    this.timers.clear();
    
    // デバウンスタイマーを停止
    for (const timer of this.state.debouncedOperations.values()) {
      clearTimeout(timer);
    }
    this.state.debouncedOperations.clear();
    
    // キャッシュをクリア
    this.caches.clear();
    
    // 操作キューをクリア
    this.state.operationQueue = [];
    
    this.logger.info('PERFORMANCE_OPTIMIZER', '最適化システムを停止しました');
  }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PerformanceOptimizer };
} else if (typeof window !== 'undefined') {
  window.PerformanceOptimizer = PerformanceOptimizer;
}