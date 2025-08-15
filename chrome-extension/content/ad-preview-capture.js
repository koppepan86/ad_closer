/**
 * AdPreviewCapture - 広告要素のスクリーンショット取得クラス
 * 広告要素の画像プレビューを生成し、ユーザー選択ダイアログで表示するための機能を提供
 */

class AdPreviewCapture {
  constructor(options = {}) {
    this.options = {
      // スクリーンショット設定
      thumbnailWidth: options.thumbnailWidth || 300,
      thumbnailHeight: options.thumbnailHeight || 200,
      fullSizeWidth: options.fullSizeWidth || 800,
      fullSizeHeight: options.fullSizeHeight || 600,
      
      // 画像品質設定
      imageQuality: options.imageQuality || 0.8,
      imageFormat: options.imageFormat || 'webp',
      fallbackFormat: options.fallbackFormat || 'png',
      
      // パフォーマンス設定
      captureTimeout: options.captureTimeout || 500,
      maxConcurrentCaptures: options.maxConcurrentCaptures || 3,
      
      // パフォーマンス最適化設定
      targetProcessingTime: options.targetProcessingTime || 500, // 500ms目標
      memoryCleanupThreshold: options.memoryCleanupThreshold || 50 * 1024 * 1024, // 50MB
      memoryCleanupInterval: options.memoryCleanupInterval || 300000, // 5分
      lazyLoadingEnabled: options.lazyLoadingEnabled !== false,
      loadingIndicatorEnabled: options.loadingIndicatorEnabled !== false,
      
      // デバッグ設定
      debugMode: options.debugMode || false,
      
      ...options
    };

    // 内部状態
    this.captureQueue = [];
    this.activeCaptureCount = 0;
    this.previewCache = new Map();
    this.initialized = false;

    // パフォーマンス最適化状態
    this.performanceMonitor = {
      processingTimes: [],
      memoryUsage: [],
      lastCleanup: Date.now(),
      isOptimizing: false
    };
    
    // 遅延読み込み管理
    this.lazyLoadManager = {
      pendingLoads: new Map(),
      loadingStates: new Map(),
      intersectionObserver: null
    };

    // プライバシー保護機能の初期化
    this.privacyManager = null;
    this.privacyEnabled = options.privacyEnabled !== false;

    // バインドされたメソッド
    this.captureElement = this.captureElement.bind(this);
    this.captureMultipleElements = this.captureMultipleElements.bind(this);
    this.processImage = this.processImage.bind(this);
    this.generateFallbackPreview = this.generateFallbackPreview.bind(this);

    // 非同期初期化
    this.initPromise = this.init();
    
    // 初期化完了を待つためのヘルパー
    this.waitForInit = () => this.initPromise;
    
    // パフォーマンス最適化の初期化
    this.initPerformanceOptimization();
  }

  /**
   * 初期化
   */
  async init() {
    try {
      // html2canvasの利用可能性をチェック
      if (typeof html2canvas === 'undefined') {
        console.warn('AdPreviewCapture: html2canvas library not available');
        return;
      }

      // プライバシーマネージャーの初期化
      if (this.privacyEnabled && typeof PrivacyManager !== 'undefined') {
        this.privacyManager = new PrivacyManager({
          debugMode: this.options.debugMode,
          privacyLevel: this.options.privacyLevel || 'medium',
          temporaryStorageEnabled: this.options.temporaryStorageEnabled !== false,
          autoDeleteOnDialogClose: this.options.autoDeleteOnDialogClose !== false,
          personalInfoDetectionEnabled: this.options.personalInfoDetectionEnabled !== false,
          blurSensitiveContent: this.options.blurSensitiveContent !== false
        });
        
        if (this.options.debugMode) {
          console.log('AdPreviewCapture: Privacy manager initialized');
        }
      }

      // WebP対応チェック（非同期）
      await this.checkWebPSupport();

      this.initialized = true;
      console.log('AdPreviewCapture: Initialized successfully', {
        webpSupported: this.webpSupported,
        webpQualitySupport: this.webpQualitySupport,
        privacyEnabled: this.privacyEnabled && !!this.privacyManager
      });

    } catch (error) {
      console.error('AdPreviewCapture: Initialization error:', error);
    }
  }

  /**
   * パフォーマンス最適化の初期化
   */
  initPerformanceOptimization() {
    try {
      // メモリ使用量監視の開始
      this.startMemoryMonitoring();
      
      // 自動クリーンアップの設定
      this.setupAutoCleanup();
      
      // 遅延読み込みの初期化
      if (this.options.lazyLoadingEnabled) {
        this.initLazyLoading();
      }
      
      // パフォーマンス統計の初期化
      this.initPerformanceStats();
      
      if (this.options.debugMode) {
        console.log('AdPreviewCapture: Performance optimization initialized');
      }
    } catch (error) {
      console.error('AdPreviewCapture: Performance optimization initialization failed:', error);
    }
  }

  /**
   * メモリ使用量監視の開始
   */
  startMemoryMonitoring() {
    // 定期的なメモリ使用量チェック
    setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // 30秒間隔
    
    // ページの可視性変更時のメモリ管理
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performBackgroundCleanup();
      }
    });
  }

  /**
   * 自動クリーンアップの設定
   */
  setupAutoCleanup() {
    // 定期的な自動クリーンアップ
    setInterval(() => {
      this.performScheduledCleanup();
    }, this.options.memoryCleanupInterval);
    
    // ページアンロード時のクリーンアップ
    window.addEventListener('beforeunload', () => {
      this.performEmergencyCleanup();
    });
  }

  /**
   * 遅延読み込みの初期化
   */
  initLazyLoading() {
    if ('IntersectionObserver' in window) {
      this.lazyLoadManager.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.loadLazyPreview(entry.target);
            }
          });
        },
        {
          rootMargin: '50px',
          threshold: 0.1
        }
      );
    }
  }

  /**
   * パフォーマンス統計の初期化
   */
  initPerformanceStats() {
    this.performanceStats = {
      totalCaptures: 0,
      successfulCaptures: 0,
      failedCaptures: 0,
      averageProcessingTime: 0,
      memoryPeakUsage: 0,
      cacheHitRate: 0,
      optimizationEvents: []
    };
  }

  /**
   * WebP対応チェック
   */
  checkWebPSupport() {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      
      try {
        // WebP生成テスト
        const webpData = canvas.toDataURL('image/webp', 0.8);
        
        // WebPデータが正常に生成されたかチェック
        if (webpData.indexOf('data:image/webp') === 0) {
          // さらに詳細なテスト：実際に画像を読み込んでみる
          const img = new Image();
          img.onload = () => {
            this.webpSupported = true;
            this.webpQualitySupport = true;
            if (this.options.debugMode) {
              console.log('AdPreviewCapture: WebP support confirmed with quality control');
            }
            resolve();
          };
          img.onerror = () => {
            this.webpSupported = false;
            this.webpQualitySupport = false;
            if (this.options.debugMode) {
              console.log('AdPreviewCapture: WebP generation succeeded but loading failed');
            }
            resolve();
          };
          img.src = webpData;
        } else {
          this.webpSupported = false;
          this.webpQualitySupport = false;
          if (this.options.debugMode) {
            console.log('AdPreviewCapture: WebP not supported');
          }
          resolve();
        }
      } catch (error) {
        this.webpSupported = false;
        this.webpQualitySupport = false;
        if (this.options.debugMode) {
          console.log('AdPreviewCapture: WebP check failed:', error);
        }
        resolve();
      }
    });
  }

  /**
   * 単一要素のスクリーンショット取得（拡張版）
   * @param {HTMLElement} element - 対象要素
   * @param {Object} options - オプション設定
   * @returns {Promise<Object>} プレビューデータ
   */
  async captureElement(element, options = {}) {
    // 初期化完了を待つ
    await this.waitForInit();
    
    if (!this.initialized) {
      throw new Error('AdPreviewCapture not initialized');
    }

    if (!element || !element.nodeType) {
      throw new Error('Invalid element provided');
    }

    const captureId = this.generateCaptureId(element);
    const startTime = Date.now();
    
    // パフォーマンス統計を更新
    this.performanceStats.totalCaptures++;
    
    // キャッシュチェック
    if (this.previewCache.has(captureId) && !options.forceRefresh) {
      const cachedPreview = this.previewCache.get(captureId);
      // アクセス回数を増加
      cachedPreview.accessCount = (cachedPreview.accessCount || 0) + 1;
      cachedPreview.lastAccessed = Date.now();
      
      this.logDebug('Using cached preview for element', { captureId });
      this.updateCacheHitRate(true);
      return cachedPreview;
    }
    
    this.updateCacheHitRate(false);
    
    // 遅延読み込みが有効で、要素が画面外の場合
    if (this.options.lazyLoadingEnabled && options.enableLazyLoading !== false) {
      const isInViewport = this.isElementInViewport(element);
      if (!isInViewport && !options.forceCapture) {
        return this.createLazyLoadPlaceholder(element, captureId, options);
      }
    }
    
    // ローディング表示を開始
    if (this.options.loadingIndicatorEnabled && options.showLoadingIndicator !== false) {
      this.showLoadingIndicator(captureId, element);
    }

    try {
      // パフォーマンス追跡開始
      this.recordPerformanceMetric('capture_start', startTime, { captureId });

      // 要素情報の取得（既に前処理されている場合は使用）
      const elementInfo = options.elementInfo || this.getElementInfo(element);
      
      // 可視性チェック（より詳細）
      const viewport = this.getViewportInfo();
      const visibilityInfo = this.analyzeElementVisibility(element, viewport);
      
      if (!visibilityInfo.visible) {
        this.logWarning('Element is not visible, generating fallback', {
          captureId,
          visibilityInfo
        });
        return this.generateFallbackPreview(element, 'not_visible');
      }

      // スクロール情報がある場合は記録
      if (options.scrollInfo) {
        this.logDebug('Element capture with scroll info', {
          captureId,
          scrolled: options.scrollInfo.scrolled,
          scrollTime: options.scrollInfo.scrollTime
        });
      }

      // スクリーンショット取得（エラーハンドリング強化）
      let canvas;
      try {
        canvas = await this.captureElementCanvas(element, options);
        this.recordPerformanceMetric('canvas_capture', startTime, { captureId });
      } catch (canvasError) {
        this.logError('Canvas capture failed', {
          captureId,
          error: canvasError.message,
          elementInfo: {
            tagName: element.tagName,
            size: elementInfo.size,
            position: elementInfo.position
          }
        });
        throw new Error(`Canvas capture failed: ${canvasError.message}`);
      }
      
      // 画像処理（エラーハンドリング強化）
      let processedImages;
      try {
        processedImages = await this.processImage(canvas, options);
        this.recordPerformanceMetric('image_processing', startTime, { captureId });
      } catch (processingError) {
        this.logError('Image processing failed', {
          captureId,
          error: processingError.message,
          canvasSize: { width: canvas.width, height: canvas.height }
        });
        throw new Error(`Image processing failed: ${processingError.message}`);
      }

      // プレビューデータ作成
      const captureTime = Date.now() - startTime;
      let previewData = {
        id: captureId,
        element: element,
        screenshot: processedImages,
        elementInfo: {
          ...elementInfo,
          visibility: visibilityInfo
        },
        captureTime: captureTime,
        timestamp: Date.now(),
        scrollInfo: options.scrollInfo || null,
        batchInfo: options.batchId ? {
          batchId: options.batchId,
          elementIndex: options.elementIndex
        } : null
      };

      // プライバシー保護の適用
      if (this.privacyManager && !options.skipPrivacyProtection) {
        try {
          const protectionResult = await this.privacyManager.applyPrivacyProtection(element, previewData);
          
          if (protectionResult.blocked) {
            // プレビューがブロックされた場合
            previewData = protectionResult.protectedData;
            this.logDebug('Preview blocked by privacy protection', {
              captureId,
              protections: protectionResult.protections
            });
          } else {
            // プライバシー保護が適用された場合
            previewData = protectionResult.protectedData;
            if (protectionResult.protections.length > 0) {
              this.logDebug('Privacy protection applied', {
                captureId,
                protections: protectionResult.protections
              });
            }
          }
        } catch (privacyError) {
          this.logError('Privacy protection failed', {
            captureId,
            error: privacyError.message
          });
          // プライバシー保護に失敗した場合は元のデータを使用
        }
      }

      // キャッシュに保存
      this.previewCache.set(captureId, previewData);

      // 成功ログ
      this.logDebug('Element capture successful', {
        captureId,
        captureTime,
        imageSize: {
          thumbnail: processedImages.thumbnailSize,
          fullSize: processedImages.fullSizeSize
        },
        compression: processedImages.compression
      });

      // パフォーマンス記録
      this.recordPerformanceMetric('capture_complete', startTime, {
        captureId,
        success: true,
        captureTime
      });
      
      // パフォーマンス統計を更新
      this.performanceStats.successfulCaptures++;
      this.updateProcessingTimeStats(captureTime);
      
      // ローディング表示を隠す
      if (this.options.loadingIndicatorEnabled) {
        this.hideLoadingIndicator(captureId);
      }

      return previewData;

    } catch (error) {
      const captureTime = Date.now() - startTime;
      
      // パフォーマンス統計を更新
      this.performanceStats.failedCaptures++;
      
      // 詳細エラーログ
      this.logError('Element capture failed', {
        captureId,
        error: error.message,
        stack: error.stack,
        captureTime,
        elementInfo: {
          tagName: element.tagName,
          className: element.className,
          id: element.id
        },
        options: {
          hasScrollInfo: !!options.scrollInfo,
          hasBatchId: !!options.batchId,
          forceRefresh: !!options.forceRefresh
        }
      });

      // パフォーマンス記録（失敗）
      this.recordPerformanceMetric('capture_complete', startTime, {
        captureId,
        success: false,
        error: error.message,
        captureTime
      });
      
      // ローディング表示を隠す
      if (this.options.loadingIndicatorEnabled) {
        this.hideLoadingIndicator(captureId);
      }

      // フォールバック生成
      return this.generateFallbackPreview(element, 'capture_failed', error);
    }
  }

  /**
   * 要素がビューポート内にあるかチェック
   */
  isElementInViewport(element) {
    try {
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const windowWidth = window.innerWidth || document.documentElement.clientWidth;
      
      return (
        rect.top < windowHeight &&
        rect.bottom > 0 &&
        rect.left < windowWidth &&
        rect.right > 0
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * 遅延読み込みプレースホルダーを作成
   */
  createLazyLoadPlaceholder(element, captureId, options = {}) {
    const placeholder = {
      id: captureId,
      element: element,
      elementInfo: this.getElementInfo(element),
      isLazyLoad: true,
      lazyLoadOptions: options,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now()
    };
    
    // 遅延読み込み管理に追加
    this.lazyLoadManager.pendingLoads.set(captureId, {
      element,
      options,
      placeholder
    });
    
    // Intersection Observerに要素を追加
    if (this.lazyLoadManager.intersectionObserver) {
      element.dataset.lazyLoadId = captureId;
      this.lazyLoadManager.intersectionObserver.observe(element);
    }
    
    // キャッシュに保存
    this.previewCache.set(captureId, placeholder);
    
    this.logDebug('Created lazy load placeholder', { captureId });
    
    return placeholder;
  }

  /**
   * 遅延読み込みプレビューを読み込み
   */
  async loadLazyPreview(element) {
    const captureId = element.dataset.lazyLoadId;
    if (!captureId || !this.lazyLoadManager.pendingLoads.has(captureId)) {
      return;
    }
    
    // 既に読み込み中の場合はスキップ
    if (this.lazyLoadManager.loadingStates.has(captureId)) {
      return;
    }
    
    this.lazyLoadManager.loadingStates.set(captureId, true);
    
    try {
      const pendingLoad = this.lazyLoadManager.pendingLoads.get(captureId);
      
      this.logDebug('Loading lazy preview', { captureId });
      
      // 実際のキャプチャを実行
      const previewData = await this.captureElement(pendingLoad.element, {
        ...pendingLoad.options,
        forceCapture: true,
        enableLazyLoading: false
      });
      
      // プレースホルダーを実際のデータで置き換え
      this.previewCache.set(captureId, previewData);
      
      // 遅延読み込み管理から削除
      this.lazyLoadManager.pendingLoads.delete(captureId);
      this.lazyLoadManager.loadingStates.delete(captureId);
      
      // Intersection Observerから削除
      if (this.lazyLoadManager.intersectionObserver) {
        this.lazyLoadManager.intersectionObserver.unobserve(element);
        delete element.dataset.lazyLoadId;
      }
      
      this.logDebug('Lazy preview loaded successfully', { captureId });
      
      // コールバックがあれば実行
      if (pendingLoad.options.onLazyLoad) {
        pendingLoad.options.onLazyLoad(previewData);
      }
      
    } catch (error) {
      this.logError('Lazy preview loading failed', {
        captureId,
        error: error.message
      });
      
      this.lazyLoadManager.loadingStates.delete(captureId);
    }
  }

  /**
   * ローディング表示を表示
   */
  showLoadingIndicator(captureId, element) {
    try {
      // ローディング状態を記録
      this.lazyLoadManager.loadingStates.set(captureId, {
        startTime: Date.now(),
        element: element
      });
      
      // カスタムローディングコールバックがあれば実行
      if (this.options.onLoadingStart) {
        this.options.onLoadingStart(captureId, element);
      }
      
      this.logDebug('Loading indicator shown', { captureId });
      
    } catch (error) {
      this.logError('Failed to show loading indicator', {
        captureId,
        error: error.message
      });
    }
  }

  /**
   * ローディング表示を隠す
   */
  hideLoadingIndicator(captureId) {
    try {
      const loadingState = this.lazyLoadManager.loadingStates.get(captureId);
      if (loadingState) {
        const loadingTime = Date.now() - loadingState.startTime;
        
        // ローディング時間を記録
        this.recordLoadingTime(loadingTime);
        
        // ローディング状態を削除
        this.lazyLoadManager.loadingStates.delete(captureId);
        
        // カスタムローディングコールバックがあれば実行
        if (this.options.onLoadingEnd) {
          this.options.onLoadingEnd(captureId, loadingTime);
        }
        
        this.logDebug('Loading indicator hidden', { captureId, loadingTime });
      }
      
    } catch (error) {
      this.logError('Failed to hide loading indicator', {
        captureId,
        error: error.message
      });
    }
  }

  /**
   * キャッシュヒット率を更新
   */
  updateCacheHitRate(isHit) {
    if (!this.performanceStats.cacheRequests) {
      this.performanceStats.cacheRequests = 0;
      this.performanceStats.cacheHits = 0;
    }
    
    this.performanceStats.cacheRequests++;
    if (isHit) {
      this.performanceStats.cacheHits++;
    }
    
    this.performanceStats.cacheHitRate = 
      (this.performanceStats.cacheHits / this.performanceStats.cacheRequests) * 100;
  }

  /**
   * 処理時間統計を更新
   */
  updateProcessingTimeStats(processingTime) {
    this.performanceMonitor.processingTimes.push({
      time: processingTime,
      timestamp: Date.now()
    });
    
    // 履歴サイズを制限
    if (this.performanceMonitor.processingTimes.length > 100) {
      this.performanceMonitor.processingTimes = this.performanceMonitor.processingTimes.slice(-50);
    }
    
    // 平均処理時間を計算
    const times = this.performanceMonitor.processingTimes.map(p => p.time);
    this.performanceStats.averageProcessingTime = 
      times.reduce((sum, time) => sum + time, 0) / times.length;
    
    // 500ms目標を超えた場合の最適化
    if (processingTime > this.options.targetProcessingTime) {
      this.handleSlowProcessing(processingTime);
    }
  }

  /**
   * 遅い処理への対処
   */
  handleSlowProcessing(processingTime) {
    if (this.performanceMonitor.isOptimizing) {
      return; // 既に最適化中
    }
    
    this.performanceMonitor.isOptimizing = true;
    
    try {
      this.logWarning('Slow processing detected, applying optimizations', {
        processingTime,
        target: this.options.targetProcessingTime
      });
      
      // 画像品質を一時的に下げる
      const originalQuality = this.options.imageQuality;
      this.options.imageQuality = Math.max(0.5, originalQuality - 0.2);
      
      // 並列処理数を減らす
      const originalConcurrent = this.options.maxConcurrentCaptures;
      this.options.maxConcurrentCaptures = Math.max(1, originalConcurrent - 1);
      
      // 一定時間後に元に戻す
      setTimeout(() => {
        this.options.imageQuality = originalQuality;
        this.options.maxConcurrentCaptures = originalConcurrent;
        this.performanceMonitor.isOptimizing = false;
        
        this.logDebug('Performance optimization reverted');
      }, 30000); // 30秒後
      
      // 最適化イベントを記録
      this.performanceStats.optimizationEvents.push({
        type: 'slow_processing',
        processingTime,
        timestamp: Date.now(),
        actions: ['reduced_quality', 'reduced_concurrency']
      });
      
    } catch (error) {
      this.logError('Failed to handle slow processing', {
        error: error.message,
        processingTime
      });
      this.performanceMonitor.isOptimizing = false;
    }
  }

  /**
   * ローディング時間を記録
   */
  recordLoadingTime(loadingTime) {
    if (!this.performanceStats.loadingTimes) {
      this.performanceStats.loadingTimes = [];
    }
    
    this.performanceStats.loadingTimes.push({
      time: loadingTime,
      timestamp: Date.now()
    });
    
    // 履歴サイズを制限
    if (this.performanceStats.loadingTimes.length > 100) {
      this.performanceStats.loadingTimes = this.performanceStats.loadingTimes.slice(-50);
    }
  }

  /**
   * 要素を優先度順に並び替え
   */
  prioritizeElements(elements, maxCount) {
    try {
      // 要素に優先度スコアを付与
      const elementsWithPriority = elements.map(element => ({
        element,
        priority: this.calculateElementPriority(element)
      }));
      
      // 優先度順にソート（高い順）
      elementsWithPriority.sort((a, b) => b.priority - a.priority);
      
      // 上位maxCount個を返す
      return elementsWithPriority.slice(0, maxCount).map(item => item.element);
      
    } catch (error) {
      this.logError('Element prioritization failed', { error: error.message });
      return elements.slice(0, maxCount);
    }
  }

  /**
   * 要素の優先度を計算
   */
  calculateElementPriority(element) {
    let priority = 0;
    
    try {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      
      // ビューポート内にある要素は高優先度
      if (this.isElementInViewport(element)) {
        priority += 100;
      }
      
      // 大きな要素は高優先度
      const area = rect.width * rect.height;
      priority += Math.min(50, area / 1000);
      
      // z-indexが高い要素は高優先度
      const zIndex = parseInt(style.zIndex) || 0;
      if (zIndex > 0) {
        priority += Math.min(30, zIndex / 10);
      }
      
      // 特定のクラス名やタグ名で優先度調整
      if (element.classList.contains('modal') || element.classList.contains('popup')) {
        priority += 50;
      }
      
      if (element.tagName === 'IFRAME') {
        priority += 30;
      }
      
      // 透明度が低い要素は低優先度
      const opacity = parseFloat(style.opacity) || 1;
      priority *= opacity;
      
    } catch (error) {
      // エラーが発生した場合はデフォルト優先度
      priority = 10;
    }
    
    return priority;
  }

  /**
   * バッチローディング表示を開始
   */
  showBatchLoadingIndicator(batchId, elementCount) {
    try {
      this.lazyLoadManager.loadingStates.set(batchId, {
        type: 'batch',
        startTime: Date.now(),
        elementCount: elementCount,
        processedCount: 0
      });
      
      if (this.options.onBatchLoadingStart) {
        this.options.onBatchLoadingStart(batchId, elementCount);
      }
      
      this.logDebug('Batch loading indicator shown', { batchId, elementCount });
      
    } catch (error) {
      this.logError('Failed to show batch loading indicator', {
        batchId,
        error: error.message
      });
    }
  }

  /**
   * バッチローディング表示を隠す
   */
  hideBatchLoadingIndicator(batchId) {
    try {
      const loadingState = this.lazyLoadManager.loadingStates.get(batchId);
      if (loadingState && loadingState.type === 'batch') {
        const loadingTime = Date.now() - loadingState.startTime;
        
        this.lazyLoadManager.loadingStates.delete(batchId);
        
        if (this.options.onBatchLoadingEnd) {
          this.options.onBatchLoadingEnd(batchId, loadingTime, loadingState.elementCount);
        }
        
        this.logDebug('Batch loading indicator hidden', { batchId, loadingTime });
      }
      
    } catch (error) {
      this.logError('Failed to hide batch loading indicator', {
        batchId,
        error: error.message
      });
    }
  }

  /**
   * バッチ処理統計を更新
   */
  updateBatchProcessingStats(totalTime, elementCount, successCount) {
    if (!this.performanceStats.batchStats) {
      this.performanceStats.batchStats = {
        totalBatches: 0,
        totalElements: 0,
        totalTime: 0,
        averageTimePerBatch: 0,
        averageTimePerElement: 0,
        averageSuccessRate: 0
      };
    }
    
    const stats = this.performanceStats.batchStats;
    stats.totalBatches++;
    stats.totalElements += elementCount;
    stats.totalTime += totalTime;
    
    stats.averageTimePerBatch = stats.totalTime / stats.totalBatches;
    stats.averageTimePerElement = stats.totalTime / stats.totalElements;
    stats.averageSuccessRate = ((stats.averageSuccessRate * (stats.totalBatches - 1)) + 
                               (successCount / elementCount * 100)) / stats.totalBatches;
  }

  /**
   * バッチ処理を最適化
   */
  optimizeBatchProcessing(actualTime, elementCount) {
    try {
      const targetTime = this.options.targetProcessingTime;
      const timeRatio = actualTime / targetTime;
      
      if (timeRatio > 1.5) {
        // 大幅に遅い場合は積極的に最適化
        this.options.maxConcurrentCaptures = Math.max(1, 
          Math.floor(this.options.maxConcurrentCaptures * 0.7));
        this.options.imageQuality = Math.max(0.4, this.options.imageQuality - 0.3);
        
        this.logWarning('Aggressive batch optimization applied', {
          newConcurrency: this.options.maxConcurrentCaptures,
          newQuality: this.options.imageQuality
        });
        
      } else if (timeRatio > 1.2) {
        // 少し遅い場合は軽微な最適化
        this.options.maxConcurrentCaptures = Math.max(1, 
          Math.floor(this.options.maxConcurrentCaptures * 0.8));
        this.options.imageQuality = Math.max(0.5, this.options.imageQuality - 0.1);
        
        this.logDebug('Mild batch optimization applied', {
          newConcurrency: this.options.maxConcurrentCaptures,
          newQuality: this.options.imageQuality
        });
      }
      
      // 最適化イベントを記録
      this.performanceStats.optimizationEvents.push({
        type: 'batch_optimization',
        actualTime,
        targetTime,
        elementCount,
        timeRatio,
        timestamp: Date.now()
      });
      
      // 一定時間後に設定を元に戻す
      setTimeout(() => {
        this.resetOptimizationSettings();
      }, 60000); // 1分後
      
    } catch (error) {
      this.logError('Batch processing optimization failed', {
        error: error.message,
        actualTime,
        elementCount
      });
    }
  }

  /**
   * 最適化設定をリセット
   */
  resetOptimizationSettings() {
    // 元の設定値を復元（コンストラクタで設定された値）
    const originalOptions = {
      maxConcurrentCaptures: 3,
      imageQuality: 0.8
    };
    
    this.options.maxConcurrentCaptures = originalOptions.maxConcurrentCaptures;
    this.options.imageQuality = originalOptions.imageQuality;
    this.performanceMonitor.isOptimizing = false;
    
    this.logDebug('Optimization settings reset to defaults');
  }

  /**
   * html2canvasを使用してcanvasを生成
   * @param {HTMLElement} element - 対象要素
   * @param {Object} options - オプション設定
   * @returns {Promise<HTMLCanvasElement>} canvas要素
   */
  async captureElementCanvas(element, options = {}) {
    const html2canvasOptions = {
      backgroundColor: options.backgroundColor || null,
      scale: options.scale || 1,
      useCORS: true,
      allowTaint: false,
      timeout: this.options.captureTimeout,
      logging: this.options.debugMode,
      ...options.html2canvasOptions
    };

    // タイムアウト付きでhtml2canvasを実行
    return Promise.race([
      html2canvas(element, html2canvasOptions),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Capture timeout')), this.options.captureTimeout)
      )
    ]);
  }

  /**
   * 複数要素の並列スクリーンショット取得（拡張版）
   * @param {HTMLElement[]} elements - 対象要素配列
   * @param {Object} options - オプション設定
   * @returns {Promise<Object[]>} プレビューデータ配列
   */
  async captureMultipleElements(elements, options = {}) {
    if (!Array.isArray(elements) || elements.length === 0) {
      return [];
    }

    const startTime = Date.now();
    const captureId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logDebug('Starting multiple element capture', {
      batchId: captureId,
      elementCount: elements.length,
      options: options
    });

    // パフォーマンス最適化：500ms目標に向けた調整
    const targetTime = this.options.targetProcessingTime;
    const estimatedTimePerElement = this.performanceStats.averageProcessingTime || 100;
    const maxElementsForTarget = Math.floor(targetTime / estimatedTimePerElement);
    
    // 要素数が多すぎる場合は優先度順に制限
    let processElements = elements;
    if (elements.length > maxElementsForTarget && maxElementsForTarget > 0) {
      processElements = this.prioritizeElements(elements, maxElementsForTarget);
      this.logWarning('Element count limited for performance', {
        originalCount: elements.length,
        limitedCount: processElements.length,
        estimatedTime: estimatedTimePerElement * processElements.length
      });
    }

    // 並列処理の制限とタイムアウト設定
    const maxConcurrent = Math.min(
      options.maxConcurrent || this.options.maxConcurrentCaptures,
      Math.max(1, Math.floor(targetTime / estimatedTimePerElement / 2)) // 動的調整
    );
    const batchTimeout = options.batchTimeout || Math.min(targetTime, this.options.captureTimeout * 2);
    const enableScrollHandling = options.enableScrollHandling !== false;
    
    const results = [];
    const errors = [];
    const scrolledElements = new Set(); // スクロールした要素を追跡
    
    // ローディング表示を開始
    if (this.options.loadingIndicatorEnabled && options.showLoadingIndicator !== false) {
      this.showBatchLoadingIndicator(captureId, processElements.length);
    }

    try {
      // 要素の前処理：画面外要素の検出とスクロール準備
      const elementData = await this.preprocessElements(elements, {
        enableScrollHandling,
        batchId: captureId
      });

      // バッチ処理で並列実行
      for (let i = 0; i < elementData.length; i += maxConcurrent) {
        const batch = elementData.slice(i, i + maxConcurrent);
        const batchStartTime = Date.now();
        
        this.logDebug(`Processing batch ${Math.floor(i / maxConcurrent) + 1}`, {
          batchId: captureId,
          batchSize: batch.length,
          batchIndex: Math.floor(i / maxConcurrent)
        });

        // 並列キャプチャ実行（タイムアウト付き）
        const batchPromises = batch.map(async (elementInfo, index) => {
          const elementStartTime = Date.now();
          
          try {
            // 画面外要素の一時スクロール処理
            const scrollInfo = await this.handleOffScreenElement(elementInfo, enableScrollHandling);
            if (scrollInfo.scrolled) {
              scrolledElements.add(elementInfo.element);
            }

            // スクリーンショット取得
            const result = await Promise.race([
              this.captureElement(elementInfo.element, {
                ...options,
                elementInfo: elementInfo,
                scrollInfo: scrollInfo
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Element capture timeout')), batchTimeout)
              )
            ]);

            // 成功ログ
            this.logDebug('Element capture successful', {
              batchId: captureId,
              elementIndex: i + index,
              captureTime: Date.now() - elementStartTime,
              scrolled: scrollInfo.scrolled
            });

            return result;

          } catch (error) {
            // エラーログ記録
            const errorInfo = {
              batchId: captureId,
              elementIndex: i + index,
              error: error.message,
              stack: error.stack,
              captureTime: Date.now() - elementStartTime,
              elementInfo: {
                tagName: elementInfo.element.tagName,
                className: elementInfo.element.className,
                position: elementInfo.position,
                size: elementInfo.size
              }
            };
            
            errors.push(errorInfo);
            this.logError('Element capture failed', errorInfo);

            // フォールバック生成
            return this.generateFallbackPreview(
              elementInfo.element, 
              'parallel_capture_failed', 
              error
            );
          }
        });

        // バッチ結果を待機
        const batchResults = await Promise.allSettled(batchPromises);
        
        // 結果を処理
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            const errorInfo = {
              batchId: captureId,
              elementIndex: i + index,
              error: result.reason?.message || 'Unknown batch error',
              batchError: true
            };
            
            errors.push(errorInfo);
            this.logError('Batch promise failed', errorInfo);
            
            // 緊急フォールバック
            results.push(this.generateEmergencyFallback(batch[index]?.element, result.reason));
          }
        });

        this.logDebug(`Batch ${Math.floor(i / maxConcurrent) + 1} completed`, {
          batchId: captureId,
          batchTime: Date.now() - batchStartTime,
          successCount: batchResults.filter(r => r.status === 'fulfilled').length,
          errorCount: batchResults.filter(r => r.status === 'rejected').length
        });
      }

    } catch (error) {
      this.logError('Critical error in multiple element capture', {
        batchId: captureId,
        error: error.message,
        stack: error.stack
      });
      
      // 全体的な失敗の場合、各要素に対してフォールバックを生成
      elements.forEach((element, index) => {
        if (!results[index]) {
          results[index] = this.generateFallbackPreview(element, 'batch_critical_error', error);
        }
      });

    } finally {
      // スクロールした要素を元に戻す
      await this.restoreScrolledElements(scrolledElements);
    }

    const totalTime = Date.now() - startTime;
    const successCount = results.filter(r => r.screenshot && !r.fallback).length;
    const fallbackCount = results.filter(r => r.fallback).length;

    // ローディング表示を隠す
    if (this.options.loadingIndicatorEnabled) {
      this.hideBatchLoadingIndicator(captureId);
    }

    // 最終統計ログ
    this.logDebug('Multiple element capture completed', {
      batchId: captureId,
      totalTime: totalTime,
      elementCount: processElements.length,
      originalElementCount: elements.length,
      successCount: successCount,
      fallbackCount: fallbackCount,
      errorCount: errors.length,
      averageTimePerElement: Math.round(totalTime / processElements.length),
      successRate: Math.round((successCount / processElements.length) * 100),
      withinTarget: totalTime <= targetTime
    });

    // パフォーマンス統計を更新
    this.updateBatchProcessingStats(totalTime, processElements.length, successCount);

    // パフォーマンス警告と最適化
    if (totalTime > targetTime) {
      this.logWarning('Batch processing exceeded target time', {
        batchId: captureId,
        totalTime: totalTime,
        targetTime: targetTime,
        elementCount: processElements.length,
        recommendation: 'Consider reducing batch size or enabling more aggressive optimization'
      });
      
      // 次回のバッチ処理を最適化
      this.optimizeBatchProcessing(totalTime, processElements.length);
    }

    return results;
  }

  /**
   * 画像処理とリサイズ
   * @param {HTMLCanvasElement} canvas - 元のcanvas
   * @param {Object} options - オプション設定
   * @returns {Promise<Object>} 処理済み画像データ
   */
  async processImage(canvas, options = {}) {
    try {
      const startTime = Date.now();
      
      // フォーマット決定（WebP優先、フォールバックでPNG）
      const primaryFormat = this.webpSupported ? 'webp' : 'png';
      const fallbackFormat = 'png';
      
      // 品質設定
      const thumbnailQuality = options.thumbnailQuality || this.options.imageQuality;
      const fullSizeQuality = options.fullSizeQuality || this.options.imageQuality;

      // サムネイル生成（300x200px）
      const thumbnailCanvas = this.generateThumbnail(canvas, options);
      const thumbnailData = await this.generateImageWithFallback(
        thumbnailCanvas, 
        primaryFormat, 
        fallbackFormat, 
        thumbnailQuality,
        'thumbnail'
      );

      // 拡大表示用画像生成（800x600px）
      const fullSizeCanvas = this.generateFullSizeImage(canvas, options);
      const fullSizeData = await this.generateImageWithFallback(
        fullSizeCanvas, 
        primaryFormat, 
        fallbackFormat, 
        fullSizeQuality,
        'fullSize'
      );

      // 圧縮統計
      const compressionStats = this.calculateCompressionStats(canvas, thumbnailCanvas, fullSizeCanvas);

      const processingTime = Date.now() - startTime;

      if (this.options.debugMode) {
        console.log('AdPreviewCapture: Image processing completed:', {
          processingTime,
          originalSize: `${canvas.width}x${canvas.height}`,
          thumbnailSize: `${thumbnailCanvas.width}x${thumbnailCanvas.height}`,
          fullSizeSize: `${fullSizeCanvas.width}x${fullSizeCanvas.height}`,
          format: primaryFormat,
          compressionStats
        });
      }

      return {
        thumbnail: thumbnailData.dataUrl,
        thumbnailFormat: thumbnailData.format,
        thumbnailSize: {
          width: thumbnailCanvas.width,
          height: thumbnailCanvas.height
        },
        fullSize: fullSizeData.dataUrl,
        fullSizeFormat: fullSizeData.format,
        fullSizeSize: {
          width: fullSizeCanvas.width,
          height: fullSizeCanvas.height
        },
        original: {
          width: canvas.width,
          height: canvas.height
        },
        compression: compressionStats,
        processingTime: processingTime,
        quality: {
          thumbnail: thumbnailQuality,
          fullSize: fullSizeQuality
        }
      };

    } catch (error) {
      console.error('AdPreviewCapture: Image processing failed:', error);
      throw new Error(`Image processing failed: ${error.message}`);
    }
  }

  /**
   * サムネイル生成（300x200px）
   * @param {HTMLCanvasElement} sourceCanvas - 元のcanvas
   * @param {Object} options - オプション設定
   * @returns {HTMLCanvasElement} サムネイルcanvas
   */
  generateThumbnail(sourceCanvas, options = {}) {
    const maxWidth = options.thumbnailWidth || this.options.thumbnailWidth;
    const maxHeight = options.thumbnailHeight || this.options.thumbnailHeight;
    
    return this.resizeCanvasWithQuality(sourceCanvas, maxWidth, maxHeight, {
      algorithm: 'lanczos',
      sharpen: true,
      ...options.thumbnailOptions
    });
  }

  /**
   * 拡大表示用画像生成（800x600px）
   * @param {HTMLCanvasElement} sourceCanvas - 元のcanvas
   * @param {Object} options - オプション設定
   * @returns {HTMLCanvasElement} 拡大表示用canvas
   */
  generateFullSizeImage(sourceCanvas, options = {}) {
    const maxWidth = options.fullSizeWidth || this.options.fullSizeWidth;
    const maxHeight = options.fullSizeHeight || this.options.fullSizeHeight;
    
    // 元画像が既に小さい場合はそのまま使用
    if (sourceCanvas.width <= maxWidth && sourceCanvas.height <= maxHeight) {
      return sourceCanvas;
    }
    
    return this.resizeCanvasWithQuality(sourceCanvas, maxWidth, maxHeight, {
      algorithm: 'bicubic',
      preserveDetails: true,
      ...options.fullSizeOptions
    });
  }

  /**
   * フォーマット対応画像生成（WebP/PNG自動切り替え）
   * @param {HTMLCanvasElement} canvas - 対象canvas
   * @param {string} primaryFormat - 優先フォーマット
   * @param {string} fallbackFormat - フォールバックフォーマット
   * @param {number} quality - 画像品質
   * @param {string} imageType - 画像タイプ（'thumbnail' | 'fullSize'）
   * @returns {Promise<Object>} 画像データ
   */
  async generateImageWithFallback(canvas, primaryFormat, fallbackFormat, quality, imageType = 'thumbnail') {
    try {
      // 適応的品質調整
      const adaptiveQuality = this.getAdaptiveQuality(canvas, primaryFormat, imageType);
      const finalQuality = quality || adaptiveQuality;
      
      // 優先フォーマットで生成を試行
      const primaryDataUrl = canvas.toDataURL(`image/${primaryFormat}`, finalQuality);
      
      // WebPの場合、正常に生成されたかチェック
      if (primaryFormat === 'webp' && !primaryDataUrl.startsWith('data:image/webp')) {
        throw new Error('WebP generation failed');
      }
      
      const primarySize = this.estimateImageSize(primaryDataUrl);
      
      return {
        dataUrl: primaryDataUrl,
        format: primaryFormat,
        size: primarySize,
        quality: finalQuality,
        sizeKB: (primarySize / 1024).toFixed(1)
      };
      
    } catch (error) {
      if (this.options.debugMode) {
        console.warn(`AdPreviewCapture: ${primaryFormat} generation failed, using ${fallbackFormat}:`, error);
      }
      
      // フォールバックフォーマットで適応的品質
      const fallbackQuality = this.getAdaptiveQuality(canvas, fallbackFormat, imageType);
      const finalFallbackQuality = quality || fallbackQuality;
      
      // フォールバックフォーマットで生成
      const fallbackDataUrl = canvas.toDataURL(`image/${fallbackFormat}`, finalFallbackQuality);
      const fallbackSize = this.estimateImageSize(fallbackDataUrl);
      
      return {
        dataUrl: fallbackDataUrl,
        format: fallbackFormat,
        size: fallbackSize,
        quality: finalFallbackQuality,
        sizeKB: (fallbackSize / 1024).toFixed(1)
      };
    }
  }

  /**
   * 高品質リサイズ
   * @param {HTMLCanvasElement} sourceCanvas - 元のcanvas
   * @param {number} maxWidth - 最大幅
   * @param {number} maxHeight - 最大高さ
   * @param {Object} options - リサイズオプション
   * @returns {HTMLCanvasElement} リサイズされたcanvas
   */
  resizeCanvasWithQuality(sourceCanvas, maxWidth, maxHeight, options = {}) {
    const sourceWidth = sourceCanvas.width;
    const sourceHeight = sourceCanvas.height;

    // アスペクト比を保持してサイズ計算
    const aspectRatio = sourceWidth / sourceHeight;
    let targetWidth = maxWidth;
    let targetHeight = maxHeight;

    if (aspectRatio > maxWidth / maxHeight) {
      targetHeight = Math.round(maxWidth / aspectRatio);
    } else {
      targetWidth = Math.round(maxHeight * aspectRatio);
    }

    // 新しいcanvasを作成
    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = targetWidth;
    targetCanvas.height = targetHeight;

    const ctx = targetCanvas.getContext('2d');
    
    // 高品質レンダリング設定
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // アルゴリズム別処理
    if (options.algorithm === 'lanczos' && targetWidth < sourceWidth) {
      // ダウンサンプリング用のLanczos風処理
      this.drawWithLanczosApproximation(ctx, sourceCanvas, targetWidth, targetHeight);
    } else {
      // 標準的な描画
      ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    }
    
    // シャープニング適用
    if (options.sharpen && targetWidth < sourceWidth) {
      this.applySharpenFilter(ctx, targetWidth, targetHeight);
    }

    return targetCanvas;
  }

  /**
   * Lanczos風リサンプリング近似
   * @param {CanvasRenderingContext2D} ctx - 描画コンテキスト
   * @param {HTMLCanvasElement} sourceCanvas - 元のcanvas
   * @param {number} targetWidth - 目標幅
   * @param {number} targetHeight - 目標高さ
   */
  drawWithLanczosApproximation(ctx, sourceCanvas, targetWidth, targetHeight) {
    // 段階的ダウンサンプリングでLanczos風の効果を近似
    const sourceWidth = sourceCanvas.width;
    const sourceHeight = sourceCanvas.height;
    
    let currentCanvas = sourceCanvas;
    let currentWidth = sourceWidth;
    let currentHeight = sourceHeight;
    
    // 50%ずつ段階的にリサイズ
    while (currentWidth > targetWidth * 2 || currentHeight > targetHeight * 2) {
      const stepWidth = Math.max(targetWidth, Math.floor(currentWidth * 0.5));
      const stepHeight = Math.max(targetHeight, Math.floor(currentHeight * 0.5));
      
      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = stepWidth;
      stepCanvas.height = stepHeight;
      
      const stepCtx = stepCanvas.getContext('2d');
      stepCtx.imageSmoothingEnabled = true;
      stepCtx.imageSmoothingQuality = 'high';
      stepCtx.drawImage(currentCanvas, 0, 0, stepWidth, stepHeight);
      
      if (currentCanvas !== sourceCanvas) {
        // 中間canvasをクリーンアップ
        currentCanvas.width = 0;
        currentCanvas.height = 0;
      }
      
      currentCanvas = stepCanvas;
      currentWidth = stepWidth;
      currentHeight = stepHeight;
    }
    
    // 最終リサイズ
    ctx.drawImage(currentCanvas, 0, 0, targetWidth, targetHeight);
    
    if (currentCanvas !== sourceCanvas) {
      currentCanvas.width = 0;
      currentCanvas.height = 0;
    }
  }

  /**
   * シャープニングフィルター適用
   * @param {CanvasRenderingContext2D} ctx - 描画コンテキスト
   * @param {number} width - 幅
   * @param {number} height - 高さ
   */
  applySharpenFilter(ctx, width, height) {
    try {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const sharpened = new Uint8ClampedArray(data);
      
      // 簡単なアンシャープマスク
      const kernel = [
        0, -0.25, 0,
        -0.25, 2, -0.25,
        0, -0.25, 0
      ];
      
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          for (let c = 0; c < 3; c++) { // RGB only
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
              }
            }
            const idx = (y * width + x) * 4 + c;
            sharpened[idx] = Math.max(0, Math.min(255, sum));
          }
        }
      }
      
      const sharpenedImageData = new ImageData(sharpened, width, height);
      ctx.putImageData(sharpenedImageData, 0, 0);
      
    } catch (error) {
      if (this.options.debugMode) {
        console.warn('AdPreviewCapture: Sharpening failed:', error);
      }
    }
  }

  /**
   * 圧縮統計計算
   * @param {HTMLCanvasElement} originalCanvas - 元のcanvas
   * @param {HTMLCanvasElement} thumbnailCanvas - サムネイルcanvas
   * @param {HTMLCanvasElement} fullSizeCanvas - 拡大表示用canvas
   * @returns {Object} 圧縮統計
   */
  calculateCompressionStats(originalCanvas, thumbnailCanvas, fullSizeCanvas) {
    const originalPixels = originalCanvas.width * originalCanvas.height;
    const thumbnailPixels = thumbnailCanvas.width * thumbnailCanvas.height;
    const fullSizePixels = fullSizeCanvas.width * fullSizeCanvas.height;
    
    return {
      originalPixels,
      thumbnailPixels,
      fullSizePixels,
      thumbnailReduction: ((originalPixels - thumbnailPixels) / originalPixels * 100).toFixed(1),
      fullSizeReduction: ((originalPixels - fullSizePixels) / originalPixels * 100).toFixed(1),
      thumbnailRatio: (thumbnailPixels / originalPixels).toFixed(3),
      fullSizeRatio: (fullSizePixels / originalPixels).toFixed(3)
    };
  }

  /**
   * 画像サイズ推定
   * @param {string} dataUrl - データURL
   * @returns {number} 推定サイズ（バイト）
   */
  estimateImageSize(dataUrl) {
    // Base64データ部分のサイズを推定
    const base64Data = dataUrl.split(',')[1];
    return Math.floor(base64Data.length * 0.75); // Base64は約33%のオーバーヘッド
  }

  /**
   * 最適な画像品質を自動決定
   * @param {HTMLCanvasElement} canvas - 対象canvas
   * @param {string} targetFormat - 目標フォーマット
   * @param {number} maxSizeKB - 最大サイズ（KB）
   * @returns {number} 最適品質値
   */
  findOptimalQuality(canvas, targetFormat, maxSizeKB = 100) {
    let quality = 0.8;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      const testDataUrl = canvas.toDataURL(`image/${targetFormat}`, quality);
      const sizeKB = this.estimateImageSize(testDataUrl) / 1024;
      
      if (sizeKB <= maxSizeKB || quality <= 0.3) {
        break;
      }
      
      quality -= 0.1;
      attempts++;
    }
    
    return Math.max(0.3, quality);
  }

  /**
   * 画像の複雑度を分析
   * @param {HTMLCanvasElement} canvas - 対象canvas
   * @returns {Object} 複雑度情報
   */
  analyzeImageComplexity(canvas) {
    try {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100));
      const data = imageData.data;
      
      let colorVariance = 0;
      let edgeCount = 0;
      const colors = new Set();
      
      // 色の分散と エッジ検出
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        colors.add(`${r},${g},${b}`);
        
        // 簡単なエッジ検出
        if (i > 0) {
          const prevR = data[i - 4];
          const prevG = data[i - 3];
          const prevB = data[i - 2];
          
          const diff = Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB);
          if (diff > 30) {
            edgeCount++;
          }
        }
      }
      
      const pixelCount = data.length / 4;
      const uniqueColorRatio = colors.size / pixelCount;
      const edgeRatio = edgeCount / pixelCount;
      
      return {
        uniqueColors: colors.size,
        uniqueColorRatio: uniqueColorRatio,
        edgeCount: edgeCount,
        edgeRatio: edgeRatio,
        complexity: uniqueColorRatio * 0.7 + edgeRatio * 0.3 // 複雑度スコア
      };
      
    } catch (error) {
      if (this.options.debugMode) {
        console.warn('AdPreviewCapture: Image complexity analysis failed:', error);
      }
      return {
        uniqueColors: 0,
        uniqueColorRatio: 0.5,
        edgeCount: 0,
        edgeRatio: 0.5,
        complexity: 0.5
      };
    }
  }

  /**
   * 適応的品質調整
   * @param {HTMLCanvasElement} canvas - 対象canvas
   * @param {string} format - 画像フォーマット
   * @param {string} imageType - 画像タイプ（'thumbnail' | 'fullSize'）
   * @returns {number} 調整された品質値
   */
  getAdaptiveQuality(canvas, format, imageType) {
    const complexity = this.analyzeImageComplexity(canvas);
    const baseQuality = this.options.imageQuality;
    
    let qualityAdjustment = 0;
    
    // 複雑度に基づく調整
    if (complexity.complexity > 0.7) {
      // 複雑な画像は品質を上げる
      qualityAdjustment += 0.1;
    } else if (complexity.complexity < 0.3) {
      // シンプルな画像は品質を下げても良い
      qualityAdjustment -= 0.1;
    }
    
    // 画像タイプに基づく調整
    if (imageType === 'thumbnail') {
      qualityAdjustment -= 0.05; // サムネイルは少し品質を下げる
    }
    
    // フォーマットに基づく調整
    if (format === 'webp') {
      qualityAdjustment += 0.05; // WebPは効率が良いので品質を上げる
    }
    
    const adjustedQuality = Math.max(0.3, Math.min(0.95, baseQuality + qualityAdjustment));
    
    if (this.options.debugMode) {
      console.log('AdPreviewCapture: Adaptive quality adjustment:', {
        complexity: complexity.complexity,
        baseQuality,
        adjustment: qualityAdjustment,
        finalQuality: adjustedQuality,
        imageType,
        format
      });
    }
    
    return adjustedQuality;
  }

  /**
   * canvasのリサイズ（基本版）
   * @param {HTMLCanvasElement} sourceCanvas - 元のcanvas
   * @param {number} maxWidth - 最大幅
   * @param {number} maxHeight - 最大高さ
   * @returns {HTMLCanvasElement} リサイズされたcanvas
   */
  resizeCanvas(sourceCanvas, maxWidth, maxHeight) {
    // 高品質リサイズを使用
    return this.resizeCanvasWithQuality(sourceCanvas, maxWidth, maxHeight, {
      algorithm: 'standard',
      sharpen: false
    });
  }

  /**
   * 要素情報の取得
   * @param {HTMLElement} element - 対象要素
   * @returns {Object} 要素情報
   */
  getElementInfo(element) {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);

    return {
      tagName: element.tagName,
      className: element.className,
      id: element.id,
      position: {
        x: rect.left,
        y: rect.top
      },
      size: {
        width: rect.width,
        height: rect.height
      },
      zIndex: computedStyle.zIndex,
      isVisible: rect.width > 0 && rect.height > 0 && computedStyle.display !== 'none',
      opacity: computedStyle.opacity,
      visibility: computedStyle.visibility
    };
  }

  /**
   * フォールバック表示の生成
   * @param {HTMLElement} element - 対象要素
   * @param {string} reason - フォールバック理由
   * @param {Error} error - エラー情報（オプション）
   * @returns {Object} フォールバックプレビューデータ
   */
  generateFallbackPreview(element, reason = 'unknown', error = null) {
    const elementInfo = this.getElementInfo(element);
    const captureId = this.generateCaptureId(element);

    // フォールバック用のcanvasを生成
    const canvas = document.createElement('canvas');
    canvas.width = this.options.thumbnailWidth;
    canvas.height = this.options.thumbnailHeight;
    
    const ctx = canvas.getContext('2d');
    
    // 背景
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 境界線
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    
    // アイコン
    ctx.fillStyle = '#999';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('📄', canvas.width / 2, 80);
    
    // テキスト情報
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(elementInfo.tagName, canvas.width / 2, 120);
    ctx.fillText(`${elementInfo.size.width}×${elementInfo.size.height}`, canvas.width / 2, 140);
    
    if (elementInfo.className) {
      ctx.font = '12px Arial';
      const className = elementInfo.className.length > 20 
        ? elementInfo.className.substring(0, 20) + '...' 
        : elementInfo.className;
      ctx.fillText(className, canvas.width / 2, 160);
    }

    // フォールバック画像を基本的な方法で処理
    const basicDataUrl = canvas.toDataURL('image/png', 0.8);
    const fallbackImages = {
      thumbnail: basicDataUrl,
      thumbnailFormat: 'png',
      fullSize: basicDataUrl,
      fullSizeFormat: 'png',
      thumbnailSize: { width: canvas.width, height: canvas.height },
      fullSizeSize: { width: canvas.width, height: canvas.height }
    };

    return {
      id: captureId,
      element: element,
      elementInfo: elementInfo,
      fallback: {
        reason: reason,
        description: this.getFallbackDescription(reason),
        error: error ? error.message : null,
        images: fallbackImages
      },
      timestamp: Date.now()
    };
  }

  /**
   * フォールバック理由の説明を取得
   * @param {string} reason - 理由コード
   * @returns {string} 説明文
   */
  getFallbackDescription(reason) {
    const descriptions = {
      'not_visible': '要素が表示されていません',
      'capture_failed': 'スクリーンショットの取得に失敗しました',
      'batch_failed': '一括処理中にエラーが発生しました',
      'parallel_capture_failed': '並列処理中にキャプチャが失敗しました',
      'batch_critical_error': '一括処理で重大なエラーが発生しました',
      'emergency_fallback': '緊急フォールバック：処理中に重大なエラーが発生しました',
      'scroll_failed': 'スクロール処理中にエラーが発生しました',
      'timeout': 'タイムアウトが発生しました',
      'element_not_found': '要素が見つかりません',
      'invalid_element': '無効な要素です',
      'processing_error': '画像処理中にエラーが発生しました',
      'unknown': '不明なエラーが発生しました'
    };

    return descriptions[reason] || descriptions['unknown'];
  }

  /**
   * キャプチャIDの生成
   * @param {HTMLElement} element - 対象要素
   * @returns {string} ユニークID
   */
  generateCaptureId(element) {
    const rect = element.getBoundingClientRect();
    const identifier = `${element.tagName}_${element.className}_${rect.left}_${rect.top}_${rect.width}_${rect.height}`;
    return btoa(identifier).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * キャッシュクリア
   */
  clearCache() {
    this.previewCache.clear();
    if (this.options.debugMode) {
      console.log('AdPreviewCapture: Cache cleared');
    }
  }

  /**
   * 要素の前処理：画面外要素の検出とメタデータ収集
   * @param {HTMLElement[]} elements - 対象要素配列
   * @param {Object} options - オプション設定
   * @returns {Promise<Object[]>} 前処理済み要素データ
   */
  async preprocessElements(elements, options = {}) {
    const { enableScrollHandling = true, batchId } = options;
    
    this.logDebug('Preprocessing elements', {
      batchId,
      elementCount: elements.length,
      enableScrollHandling
    });

    const elementData = [];
    const viewport = this.getViewportInfo();

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      
      try {
        const elementInfo = this.getElementInfo(element);
        const visibilityInfo = this.analyzeElementVisibility(element, viewport);
        
        elementData.push({
          element: element,
          index: i,
          ...elementInfo,
          visibility: visibilityInfo,
          needsScroll: enableScrollHandling && !visibilityInfo.inViewport,
          preprocessTime: Date.now()
        });

        this.logDebug(`Element ${i} preprocessed`, {
          batchId,
          elementIndex: i,
          tagName: element.tagName,
          inViewport: visibilityInfo.inViewport,
          needsScroll: enableScrollHandling && !visibilityInfo.inViewport
        });

      } catch (error) {
        this.logError(`Element ${i} preprocessing failed`, {
          batchId,
          elementIndex: i,
          error: error.message
        });
        
        // 最小限の情報で続行
        elementData.push({
          element: element,
          index: i,
          tagName: element.tagName || 'UNKNOWN',
          position: { x: 0, y: 0 },
          size: { width: 0, height: 0 },
          visibility: { inViewport: false, visible: false },
          needsScroll: false,
          preprocessError: error.message
        });
      }
    }

    return elementData;
  }

  /**
   * 画面外要素の一時スクロール処理
   * @param {Object} elementInfo - 要素情報
   * @param {boolean} enableScrollHandling - スクロール処理を有効にするか
   * @returns {Promise<Object>} スクロール情報
   */
  async handleOffScreenElement(elementInfo, enableScrollHandling = true) {
    const scrollInfo = {
      scrolled: false,
      originalScrollX: window.scrollX,
      originalScrollY: window.scrollY,
      targetScrollX: window.scrollX,
      targetScrollY: window.scrollY,
      scrollTime: 0
    };

    if (!enableScrollHandling || !elementInfo.needsScroll) {
      return scrollInfo;
    }

    try {
      const startTime = Date.now();
      const element = elementInfo.element;
      const rect = element.getBoundingClientRect();

      // 要素が画面外にある場合のスクロール計算
      if (rect.bottom < 0 || rect.top > window.innerHeight || 
          rect.right < 0 || rect.left > window.innerWidth) {
        
        // スクロール目標位置を計算
        const targetX = Math.max(0, rect.left + window.scrollX - window.innerWidth / 2);
        const targetY = Math.max(0, rect.top + window.scrollY - window.innerHeight / 2);

        scrollInfo.targetScrollX = targetX;
        scrollInfo.targetScrollY = targetY;

        // スムーズスクロール実行
        await this.smoothScrollTo(targetX, targetY);
        
        scrollInfo.scrolled = true;
        scrollInfo.scrollTime = Date.now() - startTime;

        this.logDebug('Element scrolled into view', {
          elementIndex: elementInfo.index,
          originalPosition: { x: scrollInfo.originalScrollX, y: scrollInfo.originalScrollY },
          targetPosition: { x: targetX, y: targetY },
          scrollTime: scrollInfo.scrollTime
        });

        // スクロール後の安定化待機
        await this.waitForScrollStabilization();
      }

    } catch (error) {
      this.logError('Scroll handling failed', {
        elementIndex: elementInfo.index,
        error: error.message
      });
    }

    return scrollInfo;
  }

  /**
   * スムーズスクロール実行
   * @param {number} targetX - 目標X座標
   * @param {number} targetY - 目標Y座標
   * @returns {Promise<void>}
   */
  async smoothScrollTo(targetX, targetY) {
    return new Promise((resolve) => {
      const startX = window.scrollX;
      const startY = window.scrollY;
      const distanceX = targetX - startX;
      const distanceY = targetY - startY;
      const duration = 200; // 200ms でスクロール
      const startTime = Date.now();

      const animateScroll = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // イージング関数（ease-out）
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        const currentX = startX + (distanceX * easeOut);
        const currentY = startY + (distanceY * easeOut);
        
        window.scrollTo(currentX, currentY);
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animateScroll);
    });
  }

  /**
   * スクロール安定化待機
   * @returns {Promise<void>}
   */
  async waitForScrollStabilization() {
    return new Promise(resolve => {
      setTimeout(resolve, 50); // 50ms 待機
    });
  }

  /**
   * スクロールした要素を元の位置に戻す
   * @param {Set<HTMLElement>} scrolledElements - スクロールした要素のセット
   * @returns {Promise<void>}
   */
  async restoreScrolledElements(scrolledElements) {
    if (scrolledElements.size === 0) {
      return;
    }

    try {
      // 元のスクロール位置に戻す
      const firstScrollInfo = Array.from(scrolledElements)[0]?.scrollInfo;
      if (firstScrollInfo) {
        await this.smoothScrollTo(firstScrollInfo.originalScrollX, firstScrollInfo.originalScrollY);
        await this.waitForScrollStabilization();
        
        this.logDebug('Scroll position restored', {
          restoredElements: scrolledElements.size,
          position: { x: firstScrollInfo.originalScrollX, y: firstScrollInfo.originalScrollY }
        });
      }
    } catch (error) {
      this.logError('Failed to restore scroll position', {
        error: error.message,
        scrolledElementCount: scrolledElements.size
      });
    }
  }

  /**
   * ビューポート情報の取得
   * @returns {Object} ビューポート情報
   */
  getViewportInfo() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight
    };
  }

  /**
   * 要素の可視性分析
   * @param {HTMLElement} element - 対象要素
   * @param {Object} viewport - ビューポート情報
   * @returns {Object} 可視性情報
   */
  analyzeElementVisibility(element, viewport) {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);

    const inViewport = (
      rect.top < viewport.height &&
      rect.bottom > 0 &&
      rect.left < viewport.width &&
      rect.right > 0
    );

    const visible = (
      rect.width > 0 &&
      rect.height > 0 &&
      computedStyle.display !== 'none' &&
      computedStyle.visibility !== 'hidden' &&
      parseFloat(computedStyle.opacity) > 0
    );

    const partiallyVisible = inViewport && visible;
    const fullyVisible = partiallyVisible && (
      rect.top >= 0 &&
      rect.bottom <= viewport.height &&
      rect.left >= 0 &&
      rect.right <= viewport.width
    );

    return {
      inViewport,
      visible,
      partiallyVisible,
      fullyVisible,
      rect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height
      },
      computedStyle: {
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        zIndex: computedStyle.zIndex
      }
    };
  }

  /**
   * 緊急フォールバック生成
   * @param {HTMLElement} element - 対象要素
   * @param {Error} error - エラー情報
   * @returns {Object} 緊急フォールバックデータ
   */
  generateEmergencyFallback(element, error) {
    const captureId = this.generateCaptureId(element);
    
    return {
      id: captureId,
      element: element,
      elementInfo: {
        tagName: element?.tagName || 'UNKNOWN',
        className: element?.className || '',
        id: element?.id || '',
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 }
      },
      fallback: {
        reason: 'emergency_fallback',
        description: '緊急フォールバック：処理中に重大なエラーが発生しました',
        error: error?.message || 'Unknown emergency error',
        emergency: true
      },
      timestamp: Date.now()
    };
  }

  /**
   * デバッグログ出力
   * @param {string} message - ログメッセージ
   * @param {Object} data - ログデータ
   */
  logDebug(message, data = {}) {
    if (this.options.debugMode) {
      console.log(`[AdPreviewCapture:DEBUG] ${message}`, {
        timestamp: new Date().toISOString(),
        ...data
      });
    }
  }

  /**
   * 警告ログ出力
   * @param {string} message - ログメッセージ
   * @param {Object} data - ログデータ
   */
  logWarning(message, data = {}) {
    console.warn(`[AdPreviewCapture:WARNING] ${message}`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * エラーログ出力
   * @param {string} message - ログメッセージ
   * @param {Object} data - ログデータ
   */
  logError(message, data = {}) {
    console.error(`[AdPreviewCapture:ERROR] ${message}`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * パフォーマンス統計の収集
   * @param {string} operation - 操作名
   * @param {number} startTime - 開始時間
   * @param {Object} metadata - メタデータ
   */
  recordPerformanceMetric(operation, startTime, metadata = {}) {
    if (!this.performanceMetrics) {
      this.performanceMetrics = [];
    }

    const metric = {
      operation,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
      ...metadata
    };

    this.performanceMetrics.push(metric);

    // メトリクス配列のサイズ制限
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics = this.performanceMetrics.slice(-50);
    }

    if (this.options.debugMode) {
      this.logDebug(`Performance metric recorded: ${operation}`, metric);
    }
  }

  /**
   * パフォーマンス統計の取得
   * @returns {Object} パフォーマンス統計
   */
  getPerformanceStats() {
    const memoryInfo = this.getMemoryInfo();
    const recentProcessingTimes = this.performanceMonitor.processingTimes.slice(-10);
    
    return {
      // 基本統計
      totalCaptures: this.performanceStats.totalCaptures,
      successfulCaptures: this.performanceStats.successfulCaptures,
      failedCaptures: this.performanceStats.failedCaptures,
      successRate: this.performanceStats.totalCaptures > 0 ? 
        (this.performanceStats.successfulCaptures / this.performanceStats.totalCaptures) * 100 : 0,
      
      // パフォーマンス統計
      averageProcessingTime: this.performanceStats.averageProcessingTime,
      targetProcessingTime: this.options.targetProcessingTime,
      isWithinTarget: this.performanceStats.averageProcessingTime <= this.options.targetProcessingTime,
      
      // メモリ統計
      currentMemoryUsage: memoryInfo.estimated,
      memoryPeakUsage: this.performanceStats.memoryPeakUsage,
      memoryThreshold: this.options.memoryCleanupThreshold,
      
      // キャッシュ統計
      cacheSize: this.previewCache.size,
      cacheHitRate: this.performanceStats.cacheHitRate || 0,
      cacheRequests: this.performanceStats.cacheRequests || 0,
      cacheHits: this.performanceStats.cacheHits || 0,
      
      // 遅延読み込み統計
      lazyLoadEnabled: this.options.lazyLoadingEnabled,
      pendingLazyLoads: this.lazyLoadManager.pendingLoads.size,
      activeLoadings: this.lazyLoadManager.loadingStates.size,
      
      // 最適化統計
      optimizationEvents: this.performanceStats.optimizationEvents.length,
      isOptimizing: this.performanceMonitor.isOptimizing,
      lastCleanup: this.performanceMonitor.lastCleanup,
      
      // 最近のメトリクス
      recentProcessingTimes: recentProcessingTimes.map(p => p.time),
      recentMemoryUsage: this.performanceMonitor.memoryUsage.slice(-5),
      
      // 設定情報
      configuration: {
        targetProcessingTime: this.options.targetProcessingTime,
        memoryCleanupThreshold: this.options.memoryCleanupThreshold,
        memoryCleanupInterval: this.options.memoryCleanupInterval,
        lazyLoadingEnabled: this.options.lazyLoadingEnabled,
        loadingIndicatorEnabled: this.options.loadingIndicatorEnabled,
        maxConcurrentCaptures: this.options.maxConcurrentCaptures
      }
    };
  }

  /**
   * パフォーマンス最適化の状態を取得
   */
  getOptimizationStatus() {
    const stats = this.getPerformanceStats();
    
    return {
      status: this.determineOptimizationStatus(stats),
      recommendations: this.generateOptimizationRecommendations(stats),
      metrics: stats
    };
  }

  /**
   * 最適化状態を判定
   */
  determineOptimizationStatus(stats) {
    const issues = [];
    
    if (!stats.isWithinTarget) {
      issues.push('processing_time_exceeded');
    }
    
    if (stats.currentMemoryUsage > stats.memoryThreshold * 0.8) {
      issues.push('high_memory_usage');
    }
    
    if (stats.cacheHitRate < 50) {
      issues.push('low_cache_efficiency');
    }
    
    if (stats.successRate < 80) {
      issues.push('high_failure_rate');
    }
    
    if (issues.length === 0) {
      return 'optimal';
    } else if (issues.length <= 2) {
      return 'good';
    } else {
      return 'needs_optimization';
    }
  }

  /**
   * 最適化推奨事項を生成
   */
  generateOptimizationRecommendations(stats) {
    const recommendations = [];
    
    if (!stats.isWithinTarget) {
      recommendations.push({
        type: 'performance',
        message: '処理時間が目標を超えています。画像品質を下げるか、並列処理数を減らすことを検討してください。',
        action: 'reduce_quality_or_concurrency'
      });
    }
    
    if (stats.currentMemoryUsage > stats.memoryThreshold * 0.8) {
      recommendations.push({
        type: 'memory',
        message: 'メモリ使用量が高くなっています。キャッシュクリーンアップを実行することを推奨します。',
        action: 'cleanup_cache'
      });
    }
    
    if (stats.cacheHitRate < 50) {
      recommendations.push({
        type: 'cache',
        message: 'キャッシュ効率が低くなっています。キャッシュサイズを増やすか、キャッシュ戦略を見直してください。',
        action: 'optimize_cache_strategy'
      });
    }
    
    if (stats.pendingLazyLoads > 10) {
      recommendations.push({
        type: 'lazy_loading',
        message: '遅延読み込み待ちが多くなっています。優先度の高い要素から処理することを検討してください。',
        action: 'prioritize_lazy_loading'
      });
    }
    
    return recommendations;
  }

  /**
   * メモリ使用量をチェック
   */
  checkMemoryUsage() {
    try {
      const memoryInfo = this.getMemoryInfo();
      this.performanceMonitor.memoryUsage.push({
        timestamp: Date.now(),
        ...memoryInfo
      });
      
      // 履歴サイズを制限
      if (this.performanceMonitor.memoryUsage.length > 100) {
        this.performanceMonitor.memoryUsage = this.performanceMonitor.memoryUsage.slice(-50);
      }
      
      // メモリ使用量が閾値を超えた場合の対処
      if (memoryInfo.estimated > this.options.memoryCleanupThreshold) {
        this.performMemoryCleanup('threshold_exceeded');
      }
      
      // パフォーマンス統計を更新
      this.performanceStats.memoryPeakUsage = Math.max(
        this.performanceStats.memoryPeakUsage,
        memoryInfo.estimated
      );
      
    } catch (error) {
      this.logError('Memory usage check failed', { error: error.message });
    }
  }

  /**
   * メモリ情報を取得
   */
  getMemoryInfo() {
    const info = {
      timestamp: Date.now(),
      cacheSize: this.previewCache.size,
      estimated: 0
    };
    
    // ブラウザのメモリ情報が利用可能な場合
    if (performance.memory) {
      info.heapUsed = performance.memory.usedJSHeapSize;
      info.heapTotal = performance.memory.totalJSHeapSize;
      info.heapLimit = performance.memory.jsHeapSizeLimit;
      info.estimated = info.heapUsed;
    } else {
      // キャッシュサイズから推定
      let estimatedSize = 0;
      this.previewCache.forEach(preview => {
        if (preview.screenshot) {
          estimatedSize += this.estimatePreviewSize(preview);
        }
      });
      info.estimated = estimatedSize;
    }
    
    return info;
  }

  /**
   * プレビューのサイズを推定
   */
  estimatePreviewSize(preview) {
    let size = 0;
    
    if (preview.screenshot) {
      if (preview.screenshot.thumbnail) {
        size += this.estimateImageSize(preview.screenshot.thumbnail);
      }
      if (preview.screenshot.fullSize) {
        size += this.estimateImageSize(preview.screenshot.fullSize);
      }
    }
    
    // メタデータのサイズも加算
    size += JSON.stringify(preview.elementInfo || {}).length * 2; // UTF-16
    
    return size;
  }

  /**
   * メモリクリーンアップを実行
   */
  performMemoryCleanup(reason = 'manual') {
    const startTime = Date.now();
    const initialCacheSize = this.previewCache.size;
    const initialMemory = this.getMemoryInfo();
    
    try {
      this.logDebug('Starting memory cleanup', { reason, initialCacheSize });
      
      // 古いキャッシュエントリを削除
      this.cleanupOldCacheEntries();
      
      // 使用頻度の低いエントリを削除
      this.cleanupLowUsageEntries();
      
      // 大きなサイズのエントリを削除
      this.cleanupLargeSizeEntries();
      
      // ガベージコレクションを促進
      this.forceGarbageCollection();
      
      const finalCacheSize = this.previewCache.size;
      const finalMemory = this.getMemoryInfo();
      const cleanupTime = Date.now() - startTime;
      
      // クリーンアップ統計を記録
      const cleanupStats = {
        reason,
        cleanupTime,
        entriesRemoved: initialCacheSize - finalCacheSize,
        memoryFreed: initialMemory.estimated - finalMemory.estimated,
        timestamp: Date.now()
      };
      
      this.performanceStats.optimizationEvents.push(cleanupStats);
      this.performanceMonitor.lastCleanup = Date.now();
      
      this.logDebug('Memory cleanup completed', cleanupStats);
      
    } catch (error) {
      this.logError('Memory cleanup failed', { error: error.message, reason });
    }
  }

  /**
   * 古いキャッシュエントリを削除
   */
  cleanupOldCacheEntries() {
    const maxAge = 10 * 60 * 1000; // 10分
    const now = Date.now();
    const entriesToDelete = [];
    
    this.previewCache.forEach((preview, key) => {
      if (preview.timestamp && (now - preview.timestamp) > maxAge) {
        entriesToDelete.push(key);
      }
    });
    
    entriesToDelete.forEach(key => {
      this.previewCache.delete(key);
    });
    
    if (entriesToDelete.length > 0) {
      this.logDebug('Cleaned up old cache entries', { count: entriesToDelete.length });
    }
  }

  /**
   * 使用頻度の低いエントリを削除
   */
  cleanupLowUsageEntries() {
    if (this.previewCache.size <= 10) return; // 最小キャッシュサイズを維持
    
    const entries = Array.from(this.previewCache.entries());
    const sortedEntries = entries.sort((a, b) => {
      const aUsage = a[1].accessCount || 0;
      const bUsage = b[1].accessCount || 0;
      return aUsage - bUsage;
    });
    
    // 下位25%を削除
    const deleteCount = Math.floor(entries.length * 0.25);
    const entriesToDelete = sortedEntries.slice(0, deleteCount);
    
    entriesToDelete.forEach(([key]) => {
      this.previewCache.delete(key);
    });
    
    if (entriesToDelete.length > 0) {
      this.logDebug('Cleaned up low usage entries', { count: entriesToDelete.length });
    }
  }

  /**
   * 大きなサイズのエントリを削除
   */
  cleanupLargeSizeEntries() {
    const entries = Array.from(this.previewCache.entries());
    const entriesWithSize = entries.map(([key, preview]) => ({
      key,
      preview,
      size: this.estimatePreviewSize(preview)
    }));
    
    // サイズでソート（大きい順）
    entriesWithSize.sort((a, b) => b.size - a.size);
    
    // 上位10%の大きなエントリを削除
    const deleteCount = Math.max(1, Math.floor(entries.length * 0.1));
    const entriesToDelete = entriesWithSize.slice(0, deleteCount);
    
    entriesToDelete.forEach(({ key }) => {
      this.previewCache.delete(key);
    });
    
    if (entriesToDelete.length > 0) {
      this.logDebug('Cleaned up large size entries', { count: entriesToDelete.length });
    }
  }

  /**
   * ガベージコレクションを促進
   */
  forceGarbageCollection() {
    // 明示的なガベージコレクションは不可能だが、参照を削除してGCを促進
    if (this.performanceMonitor.memoryUsage.length > 50) {
      this.performanceMonitor.memoryUsage = this.performanceMonitor.memoryUsage.slice(-25);
    }
    
    if (this.performanceMonitor.processingTimes.length > 50) {
      this.performanceMonitor.processingTimes = this.performanceMonitor.processingTimes.slice(-25);
    }
  }

  /**
   * スケジュールされたクリーンアップを実行
   */
  performScheduledCleanup() {
    const timeSinceLastCleanup = Date.now() - this.performanceMonitor.lastCleanup;
    
    if (timeSinceLastCleanup >= this.options.memoryCleanupInterval) {
      this.performMemoryCleanup('scheduled');
    }
  }

  /**
   * バックグラウンドクリーンアップを実行
   */
  performBackgroundCleanup() {
    // ページが非表示の時により積極的にクリーンアップ
    this.performMemoryCleanup('background');
    
    // 処理キューもクリア
    this.captureQueue = [];
    this.activeCaptureCount = 0;
  }

  /**
   * 緊急クリーンアップを実行
   */
  performEmergencyCleanup() {
    try {
      // すべてのキャッシュをクリア
      this.previewCache.clear();
      
      // 処理キューをクリア
      this.captureQueue = [];
      this.activeCaptureCount = 0;
      
      // 遅延読み込み管理をクリア
      this.lazyLoadManager.pendingLoads.clear();
      this.lazyLoadManager.loadingStates.clear();
      
      // Intersection Observerを停止
      if (this.lazyLoadManager.intersectionObserver) {
        this.lazyLoadManager.intersectionObserver.disconnect();
      }
      
      this.logDebug('Emergency cleanup completed');
      
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
    }
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    this.performEmergencyCleanup();
    
    // パフォーマンスメトリクスもクリア
    if (this.performanceMetrics) {
      this.performanceMetrics = [];
    }
    
    // パフォーマンス監視もクリア
    this.performanceMonitor = {
      processingTimes: [],
      memoryUsage: [],
      lastCleanup: Date.now(),
      isOptimizing: false
    };
    
    this.logDebug('Cleanup completed');
  }

  /**
   * プライバシー保護機能の有効/無効を切り替え
   */
  setPrivacyEnabled(enabled) {
    this.privacyEnabled = enabled;
    
    if (enabled && !this.privacyManager && typeof PrivacyManager !== 'undefined') {
      this.privacyManager = new PrivacyManager({
        debugMode: this.options.debugMode,
        privacyLevel: this.options.privacyLevel || 'medium'
      });
    }
    
    this.logDebug('Privacy protection toggled', { enabled });
  }

  /**
   * プライバシー設定を更新
   */
  async updatePrivacySettings(settings) {
    if (this.privacyManager) {
      await this.privacyManager.updatePrivacySettings(settings);
      this.logDebug('Privacy settings updated', settings);
    }
  }

  /**
   * プライバシー設定を取得
   */
  getPrivacySettings() {
    return this.privacyManager ? this.privacyManager.getPrivacySettings() : null;
  }

  /**
   * プライバシー統計を取得
   */
  getPrivacyStats() {
    return this.privacyManager ? this.privacyManager.getPrivacyStats() : null;
  }

  /**
   * 機密サイトかどうかをチェック
   */
  checkSensitiveSite(url) {
    return this.privacyManager ? this.privacyManager.checkSensitiveSite(url) : { isSensitive: false };
  }

  /**
   * 要素の個人情報を検出
   */
  detectPersonalInfo(element) {
    return this.privacyManager ? this.privacyManager.detectPersonalInfo(element) : { hasPersonalInfo: false };
  }

  /**
   * 一時画像をクリーンアップ
   */
  cleanupTemporaryImages(imageIds = null) {
    if (this.privacyManager) {
      this.privacyManager.cleanupTemporaryImages(imageIds);
    }
  }

  /**
   * プライバシー保護のデバッグ情報を取得
   */
  getPrivacyDebugInfo() {
    return this.privacyManager ? this.privacyManager.getDebugInfo() : null;
  }

  /**
   * プライバシー保護を手動で適用
   */
  async applyPrivacyProtection(element, previewData) {
    if (this.privacyManager) {
      return await this.privacyManager.applyPrivacyProtection(element, previewData);
    }
    return {
      originalData: previewData,
      protectedData: previewData,
      protections: [],
      blocked: false
    };
  }
}

// グローバルに公開
if (typeof window !== 'undefined') {
  window.AdPreviewCapture = AdPreviewCapture;
}

console.log('AdPreviewCapture: Class loaded successfully');