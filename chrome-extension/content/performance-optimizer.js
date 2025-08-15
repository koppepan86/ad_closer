/**
 * パフォーマンス最適化システム
 * 異なるウェブサイトタイプに応じた最適化を実装
 */

/**
 * パフォーマンス最適化クラス
 * ウェブサイトタイプに応じた検出頻度、監視範囲、処理優先度の最適化
 */
class PerformanceOptimizer {
    constructor() {
        this.websiteType = null;
        this.domain = null;
        this.optimizationProfile = null;
        this.performanceMetrics = new Map();
        this.throttledFunctions = new Map();
        this.initialized = false;
        this.observationTargets = new Set();
        this.detectionQueue = [];
        this.processingQueue = false;
    }

    /**
     * パフォーマンス最適化を初期化
     */
    async initialize(websiteType, domain) {
        this.websiteType = websiteType;
        this.domain = domain;
        
        try {
            // 最適化プロファイルを設定
            this.setOptimizationProfile();
            
            // パフォーマンス監視を開始
            this.startPerformanceMonitoring();
            
            // 最適化された関数を作成
            this.createOptimizedFunctions();
            
            // 動的最適化を設定
            this.setupDynamicOptimization();
            
            this.initialized = true;
            console.log(`パフォーマンス最適化を初期化: ${websiteType} (${domain})`);
            
        } catch (error) {
            console.error('パフォーマンス最適化初期化エラー:', error);
        }
    }

    /**
     * パフォーマンス最適化を実行
     * @param {string} websiteType - ウェブサイトタイプ
     * @param {string} domain - ドメイン名
     */
    async optimize(websiteType, domain) {
        try {
            console.log(`パフォーマンス最適化を開始: ${websiteType} (${domain})`);
            
            // ウェブサイトタイプとドメインを設定
            this.websiteType = websiteType;
            this.domain = domain;
            
            // 最適化プロファイルを設定
            this.setOptimizationProfile();
            
            // パフォーマンス監視を開始
            this.startPerformanceMonitoring();
            
            // 最適化された関数を作成
            this.createOptimizedFunctions();
            
            // 動的最適化を設定
            this.setupDynamicOptimization();
            
            // 初期パフォーマンス測定
            await this.performInitialPerformanceAssessment();
            
            this.initialized = true;
            console.log(`パフォーマンス最適化完了: ${websiteType} (${domain})`);
            
        } catch (error) {
            console.error('パフォーマンス最適化エラー:', error);
            // エラーが発生しても初期化は完了とする
            this.initialized = true;
        }
    }

    /**
     * 初期パフォーマンス評価を実行
     */
    async performInitialPerformanceAssessment() {
        try {
            // DOM の複雑さを評価
            const domComplexity = this.assessDOMComplexity();
            
            // ページの読み込み状況を評価
            const loadingState = this.assessLoadingState();
            
            // 最適化レベルを調整
            this.adjustOptimizationLevel(domComplexity, loadingState);
            
            console.debug('Initial performance assessment completed', {
                domComplexity,
                loadingState,
                optimizationProfile: this.optimizationProfile
            });
            
        } catch (error) {
            console.warn('Initial performance assessment failed:', error);
        }
    }

    /**
     * DOM の複雑さを評価
     */
    assessDOMComplexity() {
        try {
            const elementCount = document.querySelectorAll('*').length;
            const depth = this.calculateDOMDepth();
            const dynamicElements = document.querySelectorAll('[data-react-root], [data-v-], [ng-version]').length;
            
            return {
                elementCount,
                depth,
                dynamicElements,
                complexity: elementCount > 1000 ? 'high' : elementCount > 500 ? 'medium' : 'low'
            };
        } catch (error) {
            console.warn('DOM complexity assessment failed:', error);
            return { complexity: 'medium' };
        }
    }

    /**
     * DOM の深度を計算
     */
    calculateDOMDepth() {
        try {
            let maxDepth = 0;
            
            function getDepth(element, currentDepth = 0) {
                maxDepth = Math.max(maxDepth, currentDepth);
                
                for (const child of element.children) {
                    getDepth(child, currentDepth + 1);
                }
            }
            
            getDepth(document.body);
            return maxDepth;
        } catch (error) {
            return 10; // デフォルト値
        }
    }

    /**
     * ページの読み込み状況を評価
     */
    assessLoadingState() {
        try {
            return {
                readyState: document.readyState,
                loadTime: performance.timing ? 
                    performance.timing.loadEventEnd - performance.timing.navigationStart : 0,
                resourceCount: performance.getEntriesByType ? 
                    performance.getEntriesByType('resource').length : 0
            };
        } catch (error) {
            console.warn('Loading state assessment failed:', error);
            return { readyState: 'complete' };
        }
    }

    /**
     * 最適化レベルを調整
     */
    adjustOptimizationLevel(domComplexity, loadingState) {
        try {
            // DOM が複雑な場合は最適化を強化
            if (domComplexity.complexity === 'high') {
                this.optimizationProfile.detectionInterval *= 1.5;
                this.optimizationProfile.batchSize = Math.max(2, this.optimizationProfile.batchSize - 2);
                console.debug('Optimization adjusted for high DOM complexity');
            }
            
            // 読み込みが遅い場合は最適化を強化
            if (loadingState.loadTime > 3000) {
                this.optimizationProfile.detectionInterval *= 1.2;
                console.debug('Optimization adjusted for slow loading');
            }
            
        } catch (error) {
            console.warn('Optimization level adjustment failed:', error);
        }
    }

    /**
     * 最適化プロファイルを設定
     */
    setOptimizationProfile() {
        const profiles = {
            'spa-react': {
                detectionInterval: 100,
                throttleDelay: 50,
                maxObservationTargets: 5,
                prioritySelectors: ['[data-reactroot]', '[role="dialog"]'],
                skipSelectors: ['[data-react-text]', '.react-text'],
                batchSize: 10,
                useIntersectionObserver: true,
                enableVirtualScrolling: true
            },
            
            'spa-vue': {
                detectionInterval: 120,
                throttleDelay: 60,
                maxObservationTargets: 4,
                prioritySelectors: ['[data-v-]', '.v-dialog'],
                skipSelectors: ['.v-text', '[data-v-text]'],
                batchSize: 8,
                useIntersectionObserver: true,
                enableVirtualScrolling: true
            },
            
            'spa-angular': {
                detectionInterval: 150,
                throttleDelay: 75,
                maxObservationTargets: 6,
                prioritySelectors: ['[ng-version]', 'mat-dialog-container'],
                skipSelectors: ['.ng-binding', '.ng-scope'],
                batchSize: 12,
                useIntersectionObserver: true,
                enableVirtualScrolling: false
            },
            
            'static': {
                detectionInterval: 500,
                throttleDelay: 200,
                maxObservationTargets: 2,
                prioritySelectors: ['.modal', '.popup', '[role="dialog"]'],
                skipSelectors: ['.static-content', '.no-js'],
                batchSize: 5,
                useIntersectionObserver: false,
                enableVirtualScrolling: false
            },
            
            'cms-wordpress': {
                detectionInterval: 300,
                throttleDelay: 150,
                maxObservationTargets: 3,
                prioritySelectors: ['.wp-content', '.modal'],
                skipSelectors: ['.wp-admin-bar', '.wp-toolbar'],
                batchSize: 6,
                useIntersectionObserver: false,
                enableVirtualScrolling: false
            },
            
            'ecommerce': {
                detectionInterval: 200,
                throttleDelay: 100,
                maxObservationTargets: 4,
                prioritySelectors: ['.cart-popup', '.promo-modal'],
                skipSelectors: ['.product-list', '.price-display'],
                batchSize: 8,
                useIntersectionObserver: true,
                enableVirtualScrolling: false
            }
        };

        this.optimizationProfile = profiles[this.websiteType] || profiles['static'];
        
        // ドメイン固有の調整
        this.applyDomainSpecificOptimizations();
    }

    /**
     * ドメイン固有の最適化を適用
     */
    applyDomainSpecificOptimizations() {
        const domainOptimizations = {
            'amazon.com': {
                detectionInterval: 150,
                prioritySelectors: ['.a-modal', '.a-popover'],
                skipSelectors: ['.a-price', '.a-button']
            },
            'youtube.com': {
                detectionInterval: 100,
                prioritySelectors: ['#movie_player', '.ytp-popup'],
                skipSelectors: ['.ytp-progress-bar', '.ytp-time-display']
            },
            'twitter.com': {
                detectionInterval: 80,
                prioritySelectors: ['[role="dialog"]', '.modal'],
                skipSelectors: ['[data-testid="tweet"]', '.timeline']
            },
            'facebook.com': {
                detectionInterval: 120,
                prioritySelectors: ['[role="dialog"]', '._5v-0'],
                skipSelectors: ['[data-pagelet]', '.feed']
            }
        };

        const domainConfig = domainOptimizations[this.domain];
        if (domainConfig) {
            Object.assign(this.optimizationProfile, domainConfig);
        }
    }

    /**
     * パフォーマンス監視を開始
     */
    startPerformanceMonitoring() {
        // パフォーマンスメトリクスを初期化
        this.performanceMetrics.set('detectionTime', []);
        this.performanceMetrics.set('processingTime', []);
        this.performanceMetrics.set('memoryUsage', []);
        this.performanceMetrics.set('domMutations', []);

        // 定期的なメトリクス収集
        setInterval(() => {
            this.collectPerformanceMetrics();
        }, 5000);

        // メモリ使用量監視
        if (performance.memory) {
            setInterval(() => {
                this.monitorMemoryUsage();
            }, 10000);
        }
    }

    /**
     * パフォーマンスメトリクスを収集
     */
    collectPerformanceMetrics() {
        const metrics = {
            timestamp: Date.now(),
            heapUsed: performance.memory?.usedJSHeapSize || 0,
            heapTotal: performance.memory?.totalJSHeapSize || 0,
            domNodes: document.querySelectorAll('*').length,
            observationTargets: this.observationTargets.size,
            queueLength: this.detectionQueue.length
        };

        // メトリクス履歴を更新
        const memoryMetrics = this.performanceMetrics.get('memoryUsage');
        memoryMetrics.push(metrics);
        
        // 履歴サイズを制限
        if (memoryMetrics.length > 100) {
            memoryMetrics.splice(0, memoryMetrics.length - 100);
        }

        // パフォーマンス劣化を検出
        this.detectPerformanceDegradation(metrics);
    }

    /**
     * メモリ使用量を監視
     */
    monitorMemoryUsage() {
        if (!performance.memory) return;

        const memoryInfo = {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
        };

        const usageRatio = memoryInfo.used / memoryInfo.limit;
        
        // メモリ使用量が高い場合は最適化を強化
        if (usageRatio > 0.8) {
            this.enableAggressiveOptimization();
        } else if (usageRatio < 0.5) {
            this.relaxOptimization();
        }
    }

    /**
     * パフォーマンス劣化を検出
     */
    detectPerformanceDegradation(currentMetrics) {
        const memoryMetrics = this.performanceMetrics.get('memoryUsage');
        
        if (memoryMetrics.length < 5) return;

        // 最近5回の平均と比較
        const recentMetrics = memoryMetrics.slice(-5);
        const avgHeapUsed = recentMetrics.reduce((sum, m) => sum + m.heapUsed, 0) / recentMetrics.length;
        const avgDomNodes = recentMetrics.reduce((sum, m) => sum + m.domNodes, 0) / recentMetrics.length;

        // 劣化の閾値
        const heapIncrease = (currentMetrics.heapUsed - avgHeapUsed) / avgHeapUsed;
        const domIncrease = (currentMetrics.domNodes - avgDomNodes) / avgDomNodes;

        if (heapIncrease > 0.2 || domIncrease > 0.3) {
            console.warn('パフォーマンス劣化を検出:', {
                heapIncrease: Math.round(heapIncrease * 100),
                domIncrease: Math.round(domIncrease * 100)
            });
            
            this.applyPerformanceCountermeasures();
        }
    }

    /**
     * パフォーマンス対策を適用
     */
    applyPerformanceCountermeasures() {
        // 検出間隔を延長
        this.optimizationProfile.detectionInterval *= 1.5;
        
        // バッチサイズを削減
        this.optimizationProfile.batchSize = Math.max(3, this.optimizationProfile.batchSize - 2);
        
        // 監視対象を削減
        this.optimizationProfile.maxObservationTargets = Math.max(1, this.optimizationProfile.maxObservationTargets - 1);
        
        // 不要な監視を停止
        this.cleanupObservationTargets();
        
        console.log('パフォーマンス対策を適用:', this.optimizationProfile);
    }

    /**
     * 最適化された関数を作成
     */
    createOptimizedFunctions() {
        try {
            // スロットル化された検出関数
            if (typeof this.performDetection === 'function') {
                this.throttledFunctions.set('detection', this.throttle(
                    this.performDetection.bind(this),
                    this.optimizationProfile.throttleDelay
                ));
            } else {
                console.warn('PerformanceOptimizer: performDetection method not found, skipping detection throttling');
            }

            // デバウンス化された処理関数
            if (typeof this.processDetectionQueue === 'function') {
                this.throttledFunctions.set('processing', this.debounce(
                    this.processDetectionQueue.bind(this),
                    this.optimizationProfile.throttleDelay / 2
                ));
            } else {
                console.warn('PerformanceOptimizer: processDetectionQueue method not found, skipping processing debouncing');
            }

            // バッチ処理関数
            if (typeof this.batchProcess === 'function') {
                this.throttledFunctions.set('batchProcessing', this.batchProcess.bind(this));
            } else {
                console.warn('PerformanceOptimizer: batchProcess method not found, skipping batch processing');
            }

            // 遅延実行関数
            if (typeof this.deferExecution === 'function') {
                this.throttledFunctions.set('deferredExecution', this.deferExecution.bind(this));
            } else {
                console.warn('PerformanceOptimizer: deferExecution method not found, skipping deferred execution');
            }
        } catch (error) {
            console.error('PerformanceOptimizer: Error creating optimized functions:', error);
        }
    }

    /**
     * スロットル関数
     */
    throttle(func, delay) {
        let lastCall = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return func.apply(this, args);
            }
        };
    }

    /**
     * デバウンス関数
     */
    debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * 最適化された検出を実行
     */
    optimizedDetection() {
        if (!this.initialized) return [];

        // 検出頻度制限をチェック
        if (!window.detectionThrottler?.canDetect('performance')) {
            return []; // 制限により検出をスキップ
        }

        const startTime = performance.now();
        
        try {
            // 優先度ベースの検出
            const results = this.performPriorityBasedDetection();
            
            // パフォーマンスメトリクスを記録
            const detectionTime = performance.now() - startTime;
            this.recordDetectionTime(detectionTime);
            
            // 検出実行を記録
            window.detectionThrottler?.recordDetection('performance');
            
            return results;
            
        } catch (error) {
            console.error('最適化検出エラー:', error);
            return [];
        }
    }

    /**
     * 優先度ベースの検出を実行
     */
    performPriorityBasedDetection() {
        const detectedElements = [];

        // 高優先度セレクターから検出
        for (const selector of this.optimizationProfile.prioritySelectors) {
            try {
                const elements = this.selectElementsOptimized(selector);
                detectedElements.push(...elements);
                
                // バッチサイズに達したら停止
                if (detectedElements.length >= this.optimizationProfile.batchSize) {
                    break;
                }
            } catch (error) {
                console.debug('優先度検出エラー:', selector, error);
            }
        }

        // スキップセレクターで除外
        return this.filterSkippedElements(detectedElements);
    }

    /**
     * 最適化された要素選択
     */
    selectElementsOptimized(selector) {
        const elements = [];

        if (this.optimizationProfile.useIntersectionObserver) {
            // Intersection Observer を使用した効率的な検出
            elements.push(...this.selectWithIntersectionObserver(selector));
        } else {
            // 通常のquerySelectorAllを使用
            const nodeList = document.querySelectorAll(selector);
            elements.push(...Array.from(nodeList));
        }

        return elements.filter(element => this.isValidDetectionTarget(element));
    }

    /**
     * Intersection Observer を使用した選択
     */
    selectWithIntersectionObserver(selector) {
        const elements = [];
        const candidates = document.querySelectorAll(selector);

        candidates.forEach(element => {
            // 要素が表示領域内にある場合のみ処理
            const rect = element.getBoundingClientRect();
            const isInViewport = rect.top < window.innerHeight && 
                               rect.bottom > 0 && 
                               rect.left < window.innerWidth && 
                               rect.right > 0;

            if (isInViewport) {
                elements.push(element);
            }
        });

        return elements;
    }

    /**
     * 有効な検出対象かチェック
     */
    isValidDetectionTarget(element) {
        // スキップセレクターに該当する場合は除外
        for (const skipSelector of this.optimizationProfile.skipSelectors) {
            try {
                if (element.matches(skipSelector) || element.querySelector(skipSelector)) {
                    return false;
                }
            } catch (error) {
                // セレクターエラーは無視
            }
        }

        // 基本的な可視性チェック
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               parseFloat(style.opacity) > 0;
    }

    /**
     * スキップ要素をフィルタリング
     */
    filterSkippedElements(elements) {
        return elements.filter(element => {
            return !this.optimizationProfile.skipSelectors.some(skipSelector => {
                try {
                    return element.matches(skipSelector) || 
                           element.closest(skipSelector) ||
                           element.querySelector(skipSelector);
                } catch {
                    return false;
                }
            });
        });
    }

    /**
     * バッチ処理を実行
     */
    batchProcess(items, processor) {
        const batchSize = this.optimizationProfile.batchSize;
        const results = [];

        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            
            // バッチを処理
            const batchResults = batch.map(item => {
                try {
                    return processor(item);
                } catch (error) {
                    console.warn('バッチ処理エラー:', error);
                    return null;
                }
            }).filter(result => result !== null);

            results.push(...batchResults);

            // 次のバッチまで少し待機（UIブロッキングを防ぐ）
            if (i + batchSize < items.length) {
                setTimeout(() => {}, 0);
            }
        }

        return results;
    }

    /**
     * 遅延実行
     */
    deferExecution(func, priority = 'normal') {
        const delays = {
            high: 0,
            normal: 16, // 1フレーム
            low: 100
        };

        const delay = delays[priority] || delays.normal;

        if (delay === 0) {
            return func();
        } else {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(func());
                }, delay);
            });
        }
    }

    /**
     * 動的最適化を設定
     */
    setupDynamicOptimization() {
        // パフォーマンス状況に応じて最適化レベルを調整
        setInterval(() => {
            this.adjustOptimizationLevel();
        }, 30000); // 30秒間隔

        // ページの可視性変更に応じて最適化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.enableBackgroundOptimization();
            } else {
                this.enableForegroundOptimization();
            }
        });
    }

    /**
     * 最適化レベルを調整
     */
    adjustOptimizationLevel() {
        const metrics = this.getAverageMetrics();
        
        if (metrics.avgDetectionTime > 50) {
            // 検出時間が長い場合は最適化を強化
            this.optimizationProfile.detectionInterval *= 1.2;
            this.optimizationProfile.batchSize = Math.max(3, this.optimizationProfile.batchSize - 1);
        } else if (metrics.avgDetectionTime < 10) {
            // 検出時間が短い場合は最適化を緩和
            this.optimizationProfile.detectionInterval *= 0.9;
            this.optimizationProfile.batchSize = Math.min(20, this.optimizationProfile.batchSize + 1);
        }
    }

    /**
     * バックグラウンド最適化を有効化
     */
    enableBackgroundOptimization() {
        // 検出間隔を大幅に延長
        this.optimizationProfile.detectionInterval *= 5;
        
        // バッチサイズを削減
        this.optimizationProfile.batchSize = Math.max(1, this.optimizationProfile.batchSize / 2);
        
        console.log('バックグラウンド最適化を有効化');
    }

    /**
     * フォアグラウンド最適化を有効化
     */
    enableForegroundOptimization() {
        // 元の設定に戻す
        this.setOptimizationProfile();
        
        console.log('フォアグラウンド最適化を有効化');
    }

    /**
     * 積極的最適化を有効化
     */
    enableAggressiveOptimization() {
        this.optimizationProfile.detectionInterval *= 2;
        this.optimizationProfile.batchSize = Math.max(2, this.optimizationProfile.batchSize / 2);
        this.optimizationProfile.maxObservationTargets = Math.max(1, this.optimizationProfile.maxObservationTargets - 1);
        
        console.log('積極的最適化を有効化');
    }

    /**
     * 最適化を緩和
     */
    relaxOptimization() {
        this.optimizationProfile.detectionInterval *= 0.8;
        this.optimizationProfile.batchSize = Math.min(15, this.optimizationProfile.batchSize + 2);
        this.optimizationProfile.maxObservationTargets = Math.min(8, this.optimizationProfile.maxObservationTargets + 1);
        
        console.log('最適化を緩和');
    }

    /**
     * 監視対象をクリーンアップ
     */
    cleanupObservationTargets() {
        const targetsToRemove = [];
        
        this.observationTargets.forEach(target => {
            // 存在しない要素を削除
            if (!document.contains(target)) {
                targetsToRemove.push(target);
            }
        });

        targetsToRemove.forEach(target => {
            this.observationTargets.delete(target);
        });

        console.log(`監視対象をクリーンアップ: ${targetsToRemove.length}件削除`);
    }

    /**
     * 検出時間を記録
     */
    recordDetectionTime(time) {
        const detectionTimes = this.performanceMetrics.get('detectionTime');
        detectionTimes.push({
            time,
            timestamp: Date.now()
        });

        // 履歴サイズを制限
        if (detectionTimes.length > 100) {
            detectionTimes.splice(0, detectionTimes.length - 100);
        }
    }

    /**
     * 平均メトリクスを取得
     */
    getAverageMetrics() {
        const detectionTimes = this.performanceMetrics.get('detectionTime');
        const processingTimes = this.performanceMetrics.get('processingTime');

        const avgDetectionTime = detectionTimes.length > 0 ?
            detectionTimes.reduce((sum, item) => sum + item.time, 0) / detectionTimes.length : 0;

        const avgProcessingTime = processingTimes.length > 0 ?
            processingTimes.reduce((sum, item) => sum + item.time, 0) / processingTimes.length : 0;

        return {
            avgDetectionTime,
            avgProcessingTime,
            totalDetections: detectionTimes.length,
            totalProcessing: processingTimes.length
        };
    }

    /**
     * 統計情報を取得
     */
    getStatistics() {
        const metrics = this.getAverageMetrics();
        
        return {
            websiteType: this.websiteType,
            domain: this.domain,
            optimizationProfile: { ...this.optimizationProfile },
            performanceMetrics: metrics,
            observationTargets: this.observationTargets.size,
            queueLength: this.detectionQueue.length,
            initialized: this.initialized
        };
    }

    /**
     * 最適化プロファイルを更新
     */
    updateOptimizationProfile(updates) {
        Object.assign(this.optimizationProfile, updates);
        console.log('最適化プロファイルを更新:', updates);
    }

    /**
     * クリーンアップ
     */
    cleanup() {
        // スロットル化された関数をクリア
        this.throttledFunctions.clear();
        
        // 監視対象をクリア
        this.observationTargets.clear();
        
        // キューをクリア
        this.detectionQueue = [];
        
        // メトリクスをクリア
        this.performanceMetrics.clear();
        
        this.initialized = false;
        console.log('パフォーマンス最適化をクリーンアップ');
    }

    /**
     * 検出処理を実行
     */
    performDetection() {
        try {
            // 基本的な検出処理
            console.debug('PerformanceOptimizer: Performing detection');
            
            // DOM要素の検出
            const elements = document.querySelectorAll('*');
            const visibleElements = Array.from(elements).filter(el => this.isElementVisible(el));
            
            // 検出結果をキューに追加
            this.detectionQueue.push({
                timestamp: Date.now(),
                elementCount: elements.length,
                visibleElementCount: visibleElements.length
            });
            
            // キューサイズを制限
            if (this.detectionQueue.length > 100) {
                this.detectionQueue = this.detectionQueue.slice(-50);
            }
            
        } catch (error) {
            console.warn('PerformanceOptimizer: Detection error:', error);
        }
    }

    /**
     * 検出キューを処理
     */
    processDetectionQueue() {
        try {
            if (this.detectionQueue.length === 0) {
                return;
            }
            
            console.debug(`PerformanceOptimizer: Processing ${this.detectionQueue.length} detection results`);
            
            // 最新の検出結果を処理
            const latestResults = this.detectionQueue.slice(-10);
            
            // 平均値を計算
            const avgElementCount = latestResults.reduce((sum, result) => sum + result.elementCount, 0) / latestResults.length;
            const avgVisibleCount = latestResults.reduce((sum, result) => sum + result.visibleElementCount, 0) / latestResults.length;
            
            // パフォーマンスメトリクスを更新
            this.performanceMetrics.set('avgElementCount', avgElementCount);
            this.performanceMetrics.set('avgVisibleCount', avgVisibleCount);
            this.performanceMetrics.set('lastProcessed', Date.now());
            
            // 処理済みの結果をクリア
            this.detectionQueue = [];
            
        } catch (error) {
            console.warn('PerformanceOptimizer: Queue processing error:', error);
        }
    }

    /**
     * 遅延実行
     */
    deferExecution(callback, delay = 100) {
        try {
            if (typeof callback !== 'function') {
                console.warn('PerformanceOptimizer: deferExecution requires a function');
                return;
            }
            
            return new Promise((resolve) => {
                setTimeout(() => {
                    try {
                        const result = callback();
                        resolve(result);
                    } catch (error) {
                        console.warn('PerformanceOptimizer: Deferred execution error:', error);
                        resolve(null);
                    }
                }, delay);
            });
            
        } catch (error) {
            console.warn('PerformanceOptimizer: deferExecution error:', error);
            return Promise.resolve(null);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PerformanceOptimizer };
} else {
    window.PerformanceOptimizer = PerformanceOptimizer;
}