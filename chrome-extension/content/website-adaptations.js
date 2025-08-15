/**
 * ウェブサイト固有の適応システム
 * ドメイン固有のポップアップ検出ルール、適応学習、SPA対応、パフォーマンス最適化を提供
 */

/**
 * ウェブサイト適応マネージャー
 * ドメイン固有のルールと適応学習を管理
 */
class WebsiteAdaptationManager {
    constructor() {
        this.domainRules = new Map();
        this.adaptiveLearning = new AdaptiveLearningSystem();
        this.spaHandler = new SPAHandler();
        // PerformanceOptimizerを安全に初期化
        try {
            if (typeof PerformanceOptimizer === 'function') {
                this.performanceOptimizer = new PerformanceOptimizer();
            } else {
                console.warn('PerformanceOptimizer class not available, will try to initialize later');
                this.performanceOptimizer = null;
            }
        } catch (error) {
            console.warn('Failed to initialize PerformanceOptimizer:', error);
            this.performanceOptimizer = null;
        }
        this.currentDomain = this.getCurrentDomain();
        this.websiteType = null;
        this.initialized = false;
    }

    /**
     * 適応システムを初期化
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // ドメイン固有ルールを読み込み
            await this.loadDomainSpecificRules();
            
            // ウェブサイトタイプを検出
            this.websiteType = await this.detectWebsiteType();
            
            // 適応学習システムを初期化
            await this.adaptiveLearning.initialize(this.currentDomain);
            
            // SPA ハンドラーを初期化
            await this.spaHandler.initialize(this.websiteType);
            
            // パフォーマンス最適化を適用
            await this.initializePerformanceOptimizer();
            
            this.initialized = true;
            console.log(`ウェブサイト適応システムを初期化: ${this.currentDomain} (${this.websiteType})`);
            
        } catch (error) {
            console.error('ウェブサイト適応システム初期化エラー:', error);
        }
    }

    /**
     * パフォーマンス最適化を安全に初期化
     */
    async initializePerformanceOptimizer() {
        try {
            // 既存のperformanceOptimizerが利用可能かチェック
            if (this.performanceOptimizer && typeof this.performanceOptimizer.optimize === 'function') {
                await this.performanceOptimizer.optimize(this.websiteType, this.currentDomain);
                console.debug('Performance optimizer initialized successfully');
                return;
            }

            // PerformanceOptimizerクラスが利用可能になるまで待機
            await this.waitForPerformanceOptimizer();

            // performanceOptimizerが利用できない場合、再初期化を試行
            if (typeof PerformanceOptimizer === 'function') {
                try {
                    this.performanceOptimizer = new PerformanceOptimizer();
                    await this.performanceOptimizer.optimize(this.websiteType, this.currentDomain);
                    console.debug('Performance optimizer re-initialized successfully');
                    return;
                } catch (error) {
                    console.warn('Failed to re-initialize performance optimizer:', error);
                }
            }

            // グローバルなperformanceOptimizerインスタンスをチェック
            if (window.performanceOptimizer && typeof window.performanceOptimizer.optimize === 'function') {
                try {
                    this.performanceOptimizer = window.performanceOptimizer;
                    await this.performanceOptimizer.optimize(this.websiteType, this.currentDomain);
                    console.debug('Performance optimizer initialized from global instance');
                    return;
                } catch (error) {
                    console.warn('Failed to use global performance optimizer:', error);
                }
            }

            // すべての初期化方法が失敗した場合
            console.warn('Performance optimizer not available, continuing without optimization');
            this.performanceOptimizer = null;

        } catch (error) {
            console.error('Performance optimizer initialization error:', error);
            this.performanceOptimizer = null;
        }
    }

    /**
     * PerformanceOptimizerクラスが利用可能になるまで待機
     */
    async waitForPerformanceOptimizer(maxWaitTime = 2000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            if (typeof PerformanceOptimizer === 'function') {
                console.debug('PerformanceOptimizer class is now available');
                return true;
            }
            
            // 50ms待機してから再チェック
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        console.warn('PerformanceOptimizer class not available after waiting');
        return false;
    }

    /**
     * 現在のドメインを取得
     */
    getCurrentDomain() {
        try {
            return window.location.hostname;
        } catch (error) {
            console.warn('ドメイン取得エラー:', error);
            return 'unknown';
        }
    }

    /**
     * ドメイン固有のルールを読み込み
     */
    async loadDomainSpecificRules() {
        try {
            // Chrome runtime が利用可能かチェック
            if (!chrome?.runtime?.sendMessage) {
                console.debug('Chrome runtime not available, using default rules');
                this.setDefaultDomainRules();
                return;
            }

            // Extension Context Guard を使用して安全に送信
            const response = await Promise.race([
                window.extensionContextGuard ? 
                    window.extensionContextGuard.safeSendMessage({
                        type: 'GET_DOMAIN_RULES',
                        domain: this.currentDomain
                    }, 'loadDomainSpecificRules') :
                    chrome.runtime.sendMessage({
                        type: 'GET_DOMAIN_RULES',
                        domain: this.currentDomain
                    }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Message timeout')), 5000)
                )
            ]);

            // responseがundefinedまたはnullの場合の処理を追加
            if (response && response.success && response.data) {
                this.domainRules.set(this.currentDomain, response.data);
                console.debug(`ドメインルール読み込み成功: ${this.currentDomain}`);
            } else if (response && response.success === false) {
                console.warn(`ドメインルール読み込み失敗: ${this.currentDomain}`, response.error);
            } else {
                console.debug(`ドメインルールが見つからないか、応答が無効: ${this.currentDomain}`, response);
            }

            // デフォルトルールを設定
            this.setDefaultDomainRules();
            
        } catch (error) {
            console.warn('ドメインルール読み込みエラー:', error);
            // エラーの詳細情報をログに出力
            console.debug('エラー詳細:', {
                domain: this.currentDomain,
                error: error.message,
                stack: error.stack,
                chromeRuntimeAvailable: !!chrome?.runtime,
                sendMessageAvailable: !!chrome?.runtime?.sendMessage
            });
            this.setDefaultDomainRules();
        }
    }

    /**
     * デフォルトのドメイン固有ルールを設定
     */
    setDefaultDomainRules() {
        const defaultRules = {
            // 一般的なニュースサイト
            'news': {
                selectors: ['.modal-overlay', '.newsletter-popup', '.subscription-modal'],
                excludeSelectors: ['.breaking-news', '.alert-banner'],
                characteristics: {
                    minWidth: 300,
                    minHeight: 200,
                    maxZIndex: 9999
                }
            },
            
            // ECサイト
            'ecommerce': {
                selectors: ['.cart-popup', '.promo-modal', '.discount-popup'],
                excludeSelectors: ['.product-quick-view', '.size-guide'],
                characteristics: {
                    minWidth: 250,
                    minHeight: 150,
                    hasCloseButton: true
                }
            },
            
            // ソーシャルメディア
            'social': {
                selectors: ['.share-modal', '.login-popup', '.notification-popup'],
                excludeSelectors: ['.post-modal', '.comment-popup'],
                characteristics: {
                    centerPositioned: true,
                    hasOverlay: true
                }
            },
            
            // ブログ・メディア
            'blog': {
                selectors: ['.newsletter-signup', '.email-capture', '.content-gate'],
                excludeSelectors: ['.image-lightbox', '.video-player'],
                characteristics: {
                    appearsAfterScroll: true,
                    hasFormElements: true
                }
            }
        };

        // ドメインベースでルールを適用
        const websiteCategory = this.categorizeWebsite(this.currentDomain);
        if (defaultRules[websiteCategory]) {
            this.domainRules.set(this.currentDomain, defaultRules[websiteCategory]);
        }
    }

    /**
     * ウェブサイトをカテゴリ分類
     */
    categorizeWebsite(domain) {
        const categories = {
            news: ['news', 'nikkei', 'asahi', 'mainichi', 'yomiuri', 'sankei', 'nhk'],
            ecommerce: ['amazon', 'rakuten', 'yahoo', 'mercari', 'zozo', 'shop'],
            social: ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok'],
            blog: ['blog', 'medium', 'note', 'qiita', 'zenn']
        };

        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => domain.includes(keyword))) {
                return category;
            }
        }

        return 'general';
    }

    /**
     * ウェブサイトタイプを検出
     */
    async detectWebsiteType() {
        const detectionMethods = [
            this.detectByFramework.bind(this),
            this.detectByMetaTags.bind(this),
            this.detectByDOMStructure.bind(this),
            this.detectByBehavior.bind(this)
        ];

        const results = [];
        
        for (const method of detectionMethods) {
            try {
                const result = await method();
                if (result) results.push(result);
            } catch (error) {
                console.debug('ウェブサイトタイプ検出エラー:', error);
            }
        }

        // 最も確信度の高い結果を選択
        return results.length > 0 ? results[0] : 'static';
    }

    /**
     * フレームワークによる検出
     */
    detectByFramework() {
        const frameworks = {
            react: () => window.React || document.querySelector('[data-reactroot]'),
            vue: () => window.Vue || document.querySelector('[data-server-rendered]'),
            angular: () => window.ng || document.querySelector('[ng-version]'),
            jquery: () => window.jQuery || window.$,
            nextjs: () => window.__NEXT_DATA__,
            nuxt: () => window.__NUXT__,
            gatsby: () => window.___gatsby
        };

        for (const [framework, detector] of Object.entries(frameworks)) {
            if (detector()) {
                return `spa-${framework}`;
            }
        }

        return null;
    }

    /**
     * メタタグによる検出
     */
    detectByMetaTags() {
        const generators = document.querySelectorAll('meta[name="generator"]');
        const frameworks = document.querySelectorAll('meta[name="framework"]');
        
        for (const meta of [...generators, ...frameworks]) {
            const content = meta.content.toLowerCase();
            if (content.includes('react') || content.includes('next')) return 'spa-react';
            if (content.includes('vue') || content.includes('nuxt')) return 'spa-vue';
            if (content.includes('angular')) return 'spa-angular';
            if (content.includes('wordpress')) return 'cms-wordpress';
            if (content.includes('drupal')) return 'cms-drupal';
        }

        return null;
    }

    /**
     * DOM構造による検出
     */
    detectByDOMStructure() {
        const indicators = {
            'spa-react': ['#root', '#__next', '[data-reactroot]'],
            'spa-vue': ['#app', '[data-server-rendered]', '.nuxt-progress'],
            'spa-angular': ['app-root', '[ng-version]', '.ng-scope'],
            'cms-wordpress': ['.wp-content', '#wp-admin-bar', '.wordpress'],
            'static': ['html']
        };

        for (const [type, selectors] of Object.entries(indicators)) {
            if (selectors.some(selector => document.querySelector(selector))) {
                return type;
            }
        }

        return 'static';
    }

    /**
     * 動作による検出
     */
    async detectByBehavior() {
        return new Promise((resolve) => {
            let routeChanges = 0;
            let dynamicContent = 0;

            // ルート変更を監視
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;

            history.pushState = function(...args) {
                routeChanges++;
                return originalPushState.apply(this, args);
            };

            history.replaceState = function(...args) {
                routeChanges++;
                return originalReplaceState.apply(this, args);
            };

            // 動的コンテンツを監視
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        dynamicContent++;
                    }
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // 3秒後に結果を判定
            setTimeout(() => {
                observer.disconnect();
                
                // 履歴を復元
                history.pushState = originalPushState;
                history.replaceState = originalReplaceState;

                if (routeChanges > 0 || dynamicContent > 10) {
                    resolve('spa-dynamic');
                } else {
                    resolve('static');
                }
            }, 3000);
        });
    }

    /**
     * ドメイン固有のポップアップ検出を実行
     */
    detectDomainSpecificPopups() {
        const domainRule = this.domainRules.get(this.currentDomain);
        if (!domainRule) return [];

        const detectedElements = [];

        // ドメイン固有セレクターで検出
        if (domainRule.selectors) {
            domainRule.selectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        if (this.validateDomainSpecificElement(element, domainRule)) {
                            detectedElements.push(element);
                        }
                    });
                } catch (error) {
                    console.debug('ドメイン固有セレクターエラー:', selector, error);
                }
            });
        }

        // 除外セレクターをチェック
        if (domainRule.excludeSelectors) {
            return detectedElements.filter(element => {
                return !domainRule.excludeSelectors.some(excludeSelector => {
                    try {
                        return element.matches(excludeSelector) || 
                               element.querySelector(excludeSelector);
                    } catch {
                        return false;
                    }
                });
            });
        }

        return detectedElements;
    }

    /**
     * ドメイン固有要素を検証
     */
    validateDomainSpecificElement(element, rule) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        // 特性チェック
        if (rule.characteristics) {
            const chars = rule.characteristics;

            if (chars.minWidth && rect.width < chars.minWidth) return false;
            if (chars.minHeight && rect.height < chars.minHeight) return false;
            if (chars.maxZIndex && (parseInt(style.zIndex) || 0) > chars.maxZIndex) return false;
            
            if (chars.hasCloseButton && !this.hasCloseButton(element)) return false;
            if (chars.centerPositioned && !this.isCenterPositioned(element)) return false;
            if (chars.hasOverlay && !this.hasOverlay(element)) return false;
            if (chars.hasFormElements && !this.hasFormElements(element)) return false;
        }

        return true;
    }

    /**
     * 閉じるボタンの存在チェック
     */
    hasCloseButton(element) {
        const closeSelectors = [
            '[class*="close"]', '[id*="close"]',
            '[aria-label*="close"]', '[aria-label*="閉じる"]',
            'button:contains("×")', 'button:contains("✕")',
            '.modal-close', '.popup-close'
        ];

        return closeSelectors.some(selector => {
            try {
                return element.querySelector(selector) !== null;
            } catch {
                return false;
            }
        });
    }

    /**
     * 中央配置チェック
     */
    isCenterPositioned(element) {
        const rect = element.getBoundingClientRect();
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const elementCenterX = rect.left + rect.width / 2;
        const elementCenterY = rect.top + rect.height / 2;

        const tolerance = 0.3;
        return Math.abs(elementCenterX - centerX) < window.innerWidth * tolerance &&
               Math.abs(elementCenterY - centerY) < window.innerHeight * tolerance;
    }

    /**
     * オーバーレイの存在チェック
     */
    hasOverlay(element) {
        const parent = element.parentElement;
        if (!parent) return false;

        const parentStyle = window.getComputedStyle(parent);
        return parentStyle.backgroundColor.includes('rgba') ||
               parentStyle.background.includes('rgba') ||
               parent.classList.contains('overlay') ||
               parent.classList.contains('backdrop');
    }

    /**
     * フォーム要素の存在チェック
     */
    hasFormElements(element) {
        const formElements = element.querySelectorAll('input, textarea, select, button[type="submit"]');
        return formElements.length > 0;
    }

    /**
     * 適応学習結果を適用
     */
    async applyAdaptiveLearning(element) {
        if (!this.adaptiveLearning.initialized) return null;

        return await this.adaptiveLearning.analyzeAndLearn(element);
    }

    /**
     * SPA対応の検出を実行
     */
    handleSPADetection(mutations) {
        if (!this.spaHandler.initialized) return [];

        return this.spaHandler.handleMutations(mutations);
    }

    /**
     * パフォーマンス最適化された検出を実行
     */
    performOptimizedDetection() {
        if (!this.performanceOptimizer.initialized) return [];

        return this.performanceOptimizer.optimizedDetection();
    }

    /**
     * ドメインルールを更新
     */
    async updateDomainRule(rule) {
        this.domainRules.set(this.currentDomain, rule);
        
        try {
            if (window.extensionContextGuard) {
                await window.extensionContextGuard.safeSendMessage({
                    type: 'UPDATE_DOMAIN_RULE',
                    domain: this.currentDomain,
                    rule: rule
                }, 'updateDomainRule');
            } else {
                await chrome.runtime.sendMessage({
                    type: 'UPDATE_DOMAIN_RULE',
                    domain: this.currentDomain,
                    rule: rule
                });
            }
        } catch (error) {
            console.warn('ドメインルール更新エラー:', error);
        }
    }

    /**
     * 統計情報を取得
     */
    getAdaptationStatistics() {
        return {
            domain: this.currentDomain,
            websiteType: this.websiteType,
            rulesCount: this.domainRules.size,
            adaptiveLearning: this.adaptiveLearning.getStatistics(),
            spaHandler: this.spaHandler.getStatistics(),
            performanceOptimizer: this.performanceOptimizer.getStatistics()
        };
    }
}

/**
 * 適応学習システム
 * ウェブサイトの更新から学習し、検出精度を向上させる
 */
class AdaptiveLearningSystem {
    constructor() {
        this.domain = null;
        this.learningData = new Map();
        this.patternHistory = [];
        this.initialized = false;
        this.learningThreshold = 3; // 学習に必要な最小サンプル数
    }

    /**
     * 適応学習システムを初期化
     */
    async initialize(domain) {
        this.domain = domain;
        
        try {
            // 既存の学習データを読み込み
            await this.loadLearningData();
            this.initialized = true;
            console.log(`適応学習システムを初期化: ${domain}`);
        } catch (error) {
            console.error('適応学習システム初期化エラー:', error);
        }
    }

    /**
     * 学習データを読み込み
     */
    async loadLearningData() {
        try {
            // Chrome runtime の可用性をチェック
            if (!chrome?.runtime?.sendMessage) {
                console.debug('Chrome runtime not available for learning data');
                return;
            }

            // Extension context が有効かチェック
            if (chrome.runtime.id === undefined) {
                console.debug('Extension context invalidated, skipping learning data load');
                return;
            }

            // Extension Context Guard を使用して安全に送信
            if (window.extensionContextGuard) {
                const response = await window.extensionContextGuard.safeSendMessage({
                    type: 'GET_ADAPTIVE_LEARNING_DATA',
                    domain: this.domain
                }, 'loadLearningData');

                if (response.success && response.data) {
                    this.learningData = new Map(Object.entries(response.data.patterns || {}));
                    this.patternHistory = response.data.history || [];
                    console.debug('Learning data loaded successfully');
                } else if (response.error && response.error.includes('Extension context invalidated')) {
                    console.debug('Extension context invalidated during learning data load');
                }
            } else if (window.PromiseErrorHandler) {
                const response = await window.PromiseErrorHandler.safeSendMessage({
                    type: 'GET_ADAPTIVE_LEARNING_DATA',
                    domain: this.domain
                }, 'loadLearningData');

                if (response.success && response.data) {
                    this.learningData = new Map(Object.entries(response.data.patterns || {}));
                    this.patternHistory = response.data.history || [];
                    console.debug('Learning data loaded successfully');
                } else if (response.error && response.error.includes('Extension context invalidated')) {
                    console.debug('Extension context invalidated during learning data load');
                }
            } else {
                // フォールバック: 従来の方法（より安全に）
                const response = await new Promise((resolve) => {
                    try {
                        chrome.runtime.sendMessage({
                            type: 'GET_ADAPTIVE_LEARNING_DATA',
                            domain: this.domain
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                                    console.debug('Extension context invalidated:', chrome.runtime.lastError.message);
                                } else {
                                    console.warn('Runtime error loading learning data:', chrome.runtime.lastError.message);
                                }
                                resolve({ success: false, error: chrome.runtime.lastError.message });
                            } else {
                                resolve(response || { success: false });
                            }
                        });
                    } catch (error) {
                        console.warn('Error sending learning data request:', error);
                        resolve({ success: false, error: error.message });
                    }
                });

                if (response.success && response.data) {
                    this.learningData = new Map(Object.entries(response.data.patterns || {}));
                    this.patternHistory = response.data.history || [];
                    console.debug('Learning data loaded successfully (fallback)');
                }
            }
        } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
                console.debug('Extension context invalidated during learning data load:', error.message);
            } else {
                console.warn('学習データ読み込みエラー:', error);
            }
        }
    }

    /**
     * 要素を分析して学習
     */
    async analyzeAndLearn(element) {
        if (!this.initialized) return null;

        try {
            // 要素の特徴を抽出
            const features = this.extractFeatures(element);
            
            // パターンを生成
            const pattern = this.generatePattern(features);
            
            // 学習データを更新
            await this.updateLearningData(pattern, element);
            
            // 予測を実行
            const prediction = this.predictPopupType(pattern);
            
            return {
                features,
                pattern,
                prediction,
                confidence: prediction.confidence
            };
            
        } catch (error) {
            console.error('適応学習エラー:', error);
            return null;
        }
    }

    /**
     * 要素の特徴を抽出
     */
    extractFeatures(element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        return {
            // 位置とサイズ
            position: style.position,
            zIndex: parseInt(style.zIndex) || 0,
            width: rect.width,
            height: rect.height,
            left: rect.left,
            top: rect.top,
            
            // スタイル
            backgroundColor: style.backgroundColor,
            opacity: parseFloat(style.opacity),
            display: style.display,
            visibility: style.visibility,
            
            // DOM構造
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            childrenCount: element.children.length,
            
            // コンテンツ
            textContent: element.textContent.substring(0, 100),
            hasImages: element.querySelectorAll('img').length > 0,
            hasLinks: element.querySelectorAll('a').length > 0,
            hasButtons: element.querySelectorAll('button').length > 0,
            hasForms: element.querySelectorAll('form, input').length > 0,
            
            // 時間的特徴
            timestamp: Date.now(),
            pageLoadTime: performance.now(),
            
            // コンテキスト
            parentTagName: element.parentElement?.tagName,
            siblingCount: element.parentElement?.children.length || 0,
            
            // 動的特徴
            wasRecentlyAdded: this.wasRecentlyAdded(element),
            hasAnimation: this.hasAnimation(element),
            isInteractive: this.isInteractive(element)
        };
    }

    /**
     * 最近追加された要素かチェック
     */
    wasRecentlyAdded(element) {
        // MutationObserver の記録から判定（簡易実装）
        return element.dataset.recentlyAdded === 'true';
    }

    /**
     * アニメーションを持つかチェック
     */
    hasAnimation(element) {
        const style = window.getComputedStyle(element);
        return style.animation !== 'none' || style.transition !== 'none';
    }

    /**
     * インタラクティブかチェック
     */
    isInteractive(element) {
        const interactiveElements = element.querySelectorAll(
            'button, input, select, textarea, a[href], [onclick], [tabindex]'
        );
        return interactiveElements.length > 0;
    }

    /**
     * パターンを生成
     */
    generatePattern(features) {
        // 特徴を正規化してパターンを作成
        return {
            id: this.generatePatternId(features),
            positionType: this.categorizePosition(features),
            sizeCategory: this.categorizeSize(features),
            styleSignature: this.generateStyleSignature(features),
            contentType: this.categorizeContent(features),
            behaviorType: this.categorizeBehavior(features),
            contextSignature: this.generateContextSignature(features),
            timestamp: features.timestamp
        };
    }

    /**
     * パターンIDを生成
     */
    generatePatternId(features) {
        const key = `${features.tagName}-${features.position}-${Math.floor(features.width/100)}-${Math.floor(features.height/100)}`;
        return btoa(key).substring(0, 16);
    }

    /**
     * 位置をカテゴリ化
     */
    categorizePosition(features) {
        if (features.position === 'fixed') {
            if (features.left < 100 && features.top < 100) return 'top-left';
            if (features.left > window.innerWidth - 200 && features.top < 100) return 'top-right';
            if (Math.abs(features.left + features.width/2 - window.innerWidth/2) < 100) return 'center';
            return 'fixed-other';
        }
        return features.position;
    }

    /**
     * サイズをカテゴリ化
     */
    categorizeSize(features) {
        const area = features.width * features.height;
        const screenArea = window.innerWidth * window.innerHeight;
        const ratio = area / screenArea;

        if (ratio > 0.8) return 'fullscreen';
        if (ratio > 0.4) return 'large';
        if (ratio > 0.1) return 'medium';
        return 'small';
    }

    /**
     * スタイルシグネチャを生成
     */
    generateStyleSignature(features) {
        return {
            hasBackground: features.backgroundColor !== 'rgba(0, 0, 0, 0)',
            isTransparent: features.opacity < 1,
            zIndexRange: Math.floor(features.zIndex / 1000) * 1000,
            hasAnimation: features.hasAnimation
        };
    }

    /**
     * コンテンツタイプをカテゴリ化
     */
    categorizeContent(features) {
        if (features.hasForms) return 'form';
        if (features.hasButtons && features.hasLinks) return 'interactive';
        if (features.hasImages) return 'media';
        if (features.textContent.length > 50) return 'text';
        return 'minimal';
    }

    /**
     * 動作タイプをカテゴリ化
     */
    categorizeBehavior(features) {
        if (features.wasRecentlyAdded && features.hasAnimation) return 'animated-popup';
        if (features.wasRecentlyAdded) return 'instant-popup';
        if (features.hasAnimation) return 'animated-static';
        return 'static';
    }

    /**
     * コンテキストシグネチャを生成
     */
    generateContextSignature(features) {
        return {
            parentType: features.parentTagName,
            siblingCount: Math.floor(features.siblingCount / 5) * 5,
            pageLoadTiming: features.pageLoadTime < 3000 ? 'early' : 'late',
            childrenComplexity: features.childrenCount > 10 ? 'complex' : 'simple'
        };
    }

    /**
     * 学習データを更新
     */
    async updateLearningData(pattern, element) {
        const patternId = pattern.id;
        
        if (!this.learningData.has(patternId)) {
            this.learningData.set(patternId, {
                pattern: pattern,
                occurrences: 0,
                userDecisions: [],
                confidence: 0,
                lastSeen: Date.now(),
                evolution: []
            });
        }

        const data = this.learningData.get(patternId);
        data.occurrences++;
        data.lastSeen = Date.now();
        
        // パターンの進化を記録
        data.evolution.push({
            timestamp: Date.now(),
            pattern: { ...pattern }
        });

        // 進化履歴を制限
        if (data.evolution.length > 10) {
            data.evolution.splice(0, data.evolution.length - 10);
        }

        // パターン履歴を更新
        this.patternHistory.push({
            patternId,
            timestamp: Date.now(),
            domain: this.domain
        });

        // 履歴サイズを制限
        if (this.patternHistory.length > 100) {
            this.patternHistory.splice(0, this.patternHistory.length - 100);
        }

        // 学習データを保存
        await this.saveLearningData();
    }

    /**
     * ポップアップタイプを予測
     */
    predictPopupType(pattern) {
        const patternId = pattern.id;
        const data = this.learningData.get(patternId);

        if (!data || data.occurrences < this.learningThreshold) {
            return {
                type: 'unknown',
                confidence: 0.1,
                reason: 'insufficient_data'
            };
        }

        // ユーザー決定履歴から予測
        const decisions = data.userDecisions;
        if (decisions.length > 0) {
            const closeCount = decisions.filter(d => d === 'close').length;
            const keepCount = decisions.filter(d => d === 'keep').length;
            const total = decisions.length;

            if (closeCount / total > 0.7) {
                return {
                    type: 'likely_ad',
                    confidence: Math.min(0.9, closeCount / total),
                    reason: 'user_history'
                };
            } else if (keepCount / total > 0.7) {
                return {
                    type: 'likely_legitimate',
                    confidence: Math.min(0.9, keepCount / total),
                    reason: 'user_history'
                };
            }
        }

        // パターン特徴から予測
        return this.predictFromFeatures(pattern, data);
    }

    /**
     * 特徴からポップアップタイプを予測
     */
    predictFromFeatures(pattern, data) {
        let score = 0;
        let confidence = 0.5;

        // 位置による判定
        if (pattern.positionType === 'center') score += 0.3;
        if (pattern.positionType === 'fixed-other') score += 0.2;

        // サイズによる判定
        if (pattern.sizeCategory === 'medium') score += 0.2;
        if (pattern.sizeCategory === 'large') score += 0.1;
        if (pattern.sizeCategory === 'fullscreen') score -= 0.2;

        // コンテンツによる判定
        if (pattern.contentType === 'form') score += 0.3;
        if (pattern.contentType === 'interactive') score += 0.2;

        // 動作による判定
        if (pattern.behaviorType === 'animated-popup') score += 0.4;
        if (pattern.behaviorType === 'instant-popup') score += 0.3;

        // スタイルによる判定
        if (pattern.styleSignature.zIndexRange > 1000) score += 0.2;
        if (pattern.styleSignature.hasAnimation) score += 0.1;

        // 出現頻度による調整
        const frequencyFactor = Math.min(1, data.occurrences / 10);
        confidence = Math.min(0.8, 0.3 + frequencyFactor * 0.5);

        if (score > 0.6) {
            return {
                type: 'likely_ad',
                confidence: confidence,
                reason: 'feature_analysis'
            };
        } else if (score < 0.3) {
            return {
                type: 'likely_legitimate',
                confidence: confidence,
                reason: 'feature_analysis'
            };
        } else {
            return {
                type: 'uncertain',
                confidence: 0.3,
                reason: 'ambiguous_features'
            };
        }
    }

    /**
     * ユーザー決定を学習に反映
     */
    async learnFromUserDecision(patternId, decision) {
        const data = this.learningData.get(patternId);
        if (!data) return;

        data.userDecisions.push(decision);
        
        // 決定履歴を制限
        if (data.userDecisions.length > 20) {
            data.userDecisions.splice(0, data.userDecisions.length - 20);
        }

        // 信頼度を更新
        const closeCount = data.userDecisions.filter(d => d === 'close').length;
        const total = data.userDecisions.length;
        data.confidence = total > 0 ? closeCount / total : 0;

        await this.saveLearningData();
    }

    /**
     * 学習データを保存
     */
    async saveLearningData() {
        try {
            const dataToSave = {
                patterns: Object.fromEntries(this.learningData),
                history: this.patternHistory
            };

            if (window.extensionContextGuard) {
                await window.extensionContextGuard.safeSendMessage({
                    type: 'SAVE_ADAPTIVE_LEARNING_DATA',
                    domain: this.domain,
                    data: dataToSave
                }, 'saveLearningData');
            } else {
                await chrome.runtime.sendMessage({
                    type: 'SAVE_ADAPTIVE_LEARNING_DATA',
                    domain: this.domain,
                    data: dataToSave
                });
            }
        } catch (error) {
            console.warn('学習データ保存エラー:', error);
        }
    }

    /**
     * 統計情報を取得
     */
    getStatistics() {
        return {
            domain: this.domain,
            patternsCount: this.learningData.size,
            totalOccurrences: Array.from(this.learningData.values())
                .reduce((sum, data) => sum + data.occurrences, 0),
            historyLength: this.patternHistory.length,
            averageConfidence: this.calculateAverageConfidence(),
            initialized: this.initialized
        };
    }

    /**
     * 平均信頼度を計算
     */
    calculateAverageConfidence() {
        const confidences = Array.from(this.learningData.values())
            .map(data => data.confidence)
            .filter(conf => conf > 0);
        
        return confidences.length > 0 ? 
            confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length : 0;
    }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WebsiteAdaptationManager, AdaptiveLearningSystem };
} else {
    window.WebsiteAdaptationManager = WebsiteAdaptationManager;
    window.AdaptiveLearningSystem = AdaptiveLearningSystem;
}