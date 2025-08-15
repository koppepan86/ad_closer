/**
 * シングルページアプリケーション（SPA）ハンドラー
 * 動的コンテンツとSPAの特殊な動作に対応したポップアップ検出
 */

/**
 * SPAハンドラークラス
 * React、Vue、Angular等のSPAフレームワークに対応
 */
class SPAHandler {
    constructor() {
        this.websiteType = null;
        this.routeChangeListeners = [];
        this.virtualDOMObserver = null;
        this.portalContainers = new Set();
        this.componentMountObserver = null;
        this.initialized = false;
        this.routeHistory = [];
        this.componentLifecycleHooks = new Map();
    }

    /**
     * SPAハンドラーを初期化
     */
    async initialize(websiteType) {
        this.websiteType = websiteType;
        
        try {
            // フレームワーク固有の初期化
            await this.initializeFrameworkSpecific();
            
            // ルート変更監視を設定
            this.setupRouteChangeDetection();
            
            // ポータルコンテナを検出
            this.detectPortalContainers();
            
            // 仮想DOM変更監視を設定
            this.setupVirtualDOMObservation();
            
            // コンポーネントライフサイクル監視を設定
            this.setupComponentLifecycleMonitoring();
            
            this.initialized = true;
            console.log(`SPAハンドラーを初期化: ${websiteType}`);
            
        } catch (error) {
            console.error('SPAハンドラー初期化エラー:', error);
        }
    }

    /**
     * フレームワーク固有の初期化
     */
    async initializeFrameworkSpecific() {
        switch (this.websiteType) {
            case 'spa-react':
                await this.initializeReactSupport();
                break;
            case 'spa-vue':
                await this.initializeVueSupport();
                break;
            case 'spa-angular':
                await this.initializeAngularSupport();
                break;
            case 'spa-nextjs':
                await this.initializeNextJSSupport();
                break;
            case 'spa-nuxt':
                await this.initializeNuxtSupport();
                break;
            default:
                await this.initializeGenericSPASupport();
        }
    }

    /**
     * React サポートを初期化
     */
    async initializeReactSupport() {
        // React DevTools フックを利用
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
            
            // React コンポーネントのマウント/アンマウントを監視
            hook.onCommitFiberRoot = (id, root, priorityLevel) => {
                this.handleReactCommit(root);
            };
        }

        // React Router の変更を監視
        this.setupReactRouterDetection();
        
        // React Portal の検出
        this.detectReactPortals();
    }

    /**
     * Vue サポートを初期化
     */
    async initializeVueSupport() {
        // Vue DevTools フックを利用
        if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
            const hook = window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
            
            hook.Vue = hook.Vue || window.Vue;
            if (hook.Vue) {
                // Vue コンポーネントのライフサイクルを監視
                this.setupVueLifecycleHooks(hook.Vue);
            }
        }

        // Vue Router の変更を監視
        this.setupVueRouterDetection();
        
        // Vue Teleport の検出
        this.detectVueTeleports();
    }

    /**
     * Angular サポートを初期化
     */
    async initializeAngularSupport() {
        // Angular の ng プローブを利用
        if (window.ng) {
            // Angular コンポーネントの変更を監視
            this.setupAngularChangeDetection();
        }

        // Angular Router の変更を監視
        this.setupAngularRouterDetection();
        
        // Angular CDK Overlay の検出
        this.detectAngularOverlays();
    }

    /**
     * Next.js サポートを初期化
     */
    async initializeNextJSSupport() {
        // Next.js Router を監視
        if (window.next && window.next.router) {
            const router = window.next.router;
            
            router.events.on('routeChangeStart', (url) => {
                this.handleRouteChange('start', url);
            });
            
            router.events.on('routeChangeComplete', (url) => {
                this.handleRouteChange('complete', url);
            });
        }

        // React サポートも有効化
        await this.initializeReactSupport();
    }

    /**
     * Nuxt サポートを初期化
     */
    async initializeNuxtSupport() {
        // Nuxt Router を監視
        if (window.$nuxt && window.$nuxt.$router) {
            const router = window.$nuxt.$router;
            
            router.beforeEach((to, from, next) => {
                this.handleRouteChange('before', to.path);
                next();
            });
            
            router.afterEach((to, from) => {
                this.handleRouteChange('after', to.path);
            });
        }

        // Vue サポートも有効化
        await this.initializeVueSupport();
    }

    /**
     * 汎用SPA サポートを初期化
     */
    async initializeGenericSPASupport() {
        // History API の変更を監視
        this.setupHistoryAPIMonitoring();
        
        // Hash 変更を監視
        this.setupHashChangeMonitoring();
        
        // 動的コンテンツの変更を監視
        this.setupDynamicContentMonitoring();
    }

    /**
     * History API 監視を設定
     */
    setupHistoryAPIMonitoring() {
        try {
            // History API のオーバーライド
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            
            // pushState のオーバーライド
            history.pushState = (...args) => {
                originalPushState.apply(history, args);
                this.handleHistoryChange('pushState', args);
            };
            
            // replaceState のオーバーライド
            history.replaceState = (...args) => {
                originalReplaceState.apply(history, args);
                this.handleHistoryChange('replaceState', args);
            };
            
            // popstate イベントの監視
            window.addEventListener('popstate', (event) => {
                this.handleHistoryChange('popstate', event);
            });
            
            console.debug('SPAHandler: History API monitoring setup complete');
        } catch (error) {
            console.error('SPAHandler: Error setting up History API monitoring:', error);
        }
    }

    /**
     * History 変更を処理
     * @param {string} type - 変更タイプ
     * @param {*} data - 変更データ
     */
    handleHistoryChange(type, data) {
        try {
            console.debug(`SPAHandler: History change detected - ${type}`, data);
            
            // ルート変更を記録
            this.routeChangeListeners.forEach(listener => {
                try {
                    listener({
                        type,
                        timestamp: Date.now(),
                        url: window.location.href,
                        data
                    });
                } catch (error) {
                    console.error('SPAHandler: Error in route change listener:', error);
                }
            });
            
            // 遅延検出を実行
            setTimeout(() => {
                this.performPostRouteChangeDetection();
            }, 100);
            
        } catch (error) {
            console.error('SPAHandler: Error handling history change:', error);
        }
    }

    /**
     * Hash 変更監視を設定
     */
    setupHashChangeMonitoring() {
        try {
            window.addEventListener('hashchange', (event) => {
                console.debug('SPAHandler: Hash change detected', {
                    oldURL: event.oldURL,
                    newURL: event.newURL
                });
                
                // ルート変更リスナーに通知
                this.routeChangeListeners.forEach(listener => {
                    try {
                        listener({
                            type: 'hashchange',
                            timestamp: Date.now(),
                            oldURL: event.oldURL,
                            newURL: event.newURL
                        });
                    } catch (error) {
                        console.error('SPAHandler: Error in hash change listener:', error);
                    }
                });
                
                // 遅延検出を実行
                setTimeout(() => {
                    this.performPostRouteChangeDetection();
                }, 100);
            });
            
            console.debug('SPAHandler: Hash change monitoring setup complete');
        } catch (error) {
            console.error('SPAHandler: Error setting up hash change monitoring:', error);
        }
    }

    /**
     * 動的コンテンツ監視を設定
     */
    setupDynamicContentMonitoring() {
        try {
            // DOM変更の監視（軽量版）
            if (this.virtualDOMObserver) {
                this.virtualDOMObserver.disconnect();
            }
            
            this.virtualDOMObserver = new MutationObserver((mutations) => {
                try {
                    // 大量の変更がある場合はスロットリング
                    if (mutations.length > 10) {
                        this.throttledDynamicContentCheck();
                    } else {
                        this.handleDynamicContentChange(mutations);
                    }
                } catch (error) {
                    console.error('SPAHandler: Error in dynamic content observer:', error);
                }
            });
            
            // 監視開始
            this.virtualDOMObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: false // パフォーマンスのため属性変更は監視しない
            });
            
            console.debug('SPAHandler: Dynamic content monitoring setup complete');
        } catch (error) {
            console.error('SPAHandler: Error setting up dynamic content monitoring:', error);
        }
    }

    /**
     * 動的コンテンツ変更を処理
     * @param {Array} mutations - DOM変更の配列
     */
    handleDynamicContentChange(mutations) {
        try {
            const addedElements = [];
            
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        addedElements.push(node);
                    }
                });
            });
            
            if (addedElements.length > 0) {
                // SPA特有のポップアップパターンをチェック
                const spaPopups = this.checkForSPAPopups(addedElements);
                
                if (spaPopups.length > 0) {
                    this.notifyDetection(spaPopups, 'dynamic-content');
                }
            }
        } catch (error) {
            console.error('SPAHandler: Error handling dynamic content change:', error);
        }
    }

    /**
     * スロットル化された動的コンテンツチェック
     */
    throttledDynamicContentCheck() {
        if (this.dynamicContentCheckTimeout) {
            clearTimeout(this.dynamicContentCheckTimeout);
        }
        
        this.dynamicContentCheckTimeout = setTimeout(() => {
            try {
                this.performPostRouteChangeDetection();
            } catch (error) {
                console.error('SPAHandler: Error in throttled dynamic content check:', error);
            }
        }, 200);
    }

    /**
     * SPA特有のポップアップをチェック
     * @param {Array} elements - チェック対象の要素配列
     * @returns {Array} 検出されたポップアップ要素
     */
    checkForSPAPopups(elements) {
        const spaPopups = [];
        
        try {
            elements.forEach(element => {
                // SPA特有のポップアップパターンをチェック
                if (this.isSPAPopup(element)) {
                    spaPopups.push(element);
                }
                
                // 子要素もチェック（深度制限あり）
                const children = element.querySelectorAll('*');
                Array.from(children).slice(0, 20).forEach(child => {
                    if (this.isSPAPopup(child)) {
                        spaPopups.push(child);
                    }
                });
            });
        } catch (error) {
            console.error('SPAHandler: Error checking for SPA popups:', error);
        }
        
        return spaPopups;
    }

    /**
     * 要素がSPA特有のポップアップかどうかを判定
     * @param {Element} element - 判定対象の要素
     * @returns {boolean} SPA特有のポップアップの場合true
     */
    isSPAPopup(element) {
        try {
            if (!element || element.nodeType !== Node.ELEMENT_NODE) {
                return false;
            }
            
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            
            // SPA特有のポップアップパターン
            const spaPatterns = [
                // React/Vue/Angular のモーダル
                element.matches('[role="dialog"]'),
                element.matches('[aria-modal="true"]'),
                element.matches('.modal, .popup, .overlay'),
                element.matches('[data-testid*="modal"], [data-testid*="popup"]'),
                
                // 動的に生成されたオーバーレイ
                (style.position === 'fixed' && 
                 parseInt(style.zIndex) > 1000 && 
                 rect.width > 200 && rect.height > 100),
                
                // ポータルコンテナ内の要素
                this.isInPortalContainer(element)
            ];
            
            return spaPatterns.some(pattern => pattern);
            
        } catch (error) {
            console.debug('SPAHandler: Error checking SPA popup pattern:', error);
            return false;
        }
    }

    /**
     * 要素がポータルコンテナ内にあるかチェック
     * @param {Element} element - チェック対象の要素
     * @returns {boolean} ポータルコンテナ内の場合true
     */
    isInPortalContainer(element) {
        try {
            // ポータルコンテナの一般的なセレクター
            const portalSelectors = [
                '#root-portal',
                '#modal-root',
                '.portal-container',
                '[data-portal]',
                '.ReactModalPortal'
            ];
            
            return portalSelectors.some(selector => {
                const container = document.querySelector(selector);
                return container && container.contains(element);
            });
        } catch (error) {
            return false;
        }
    }

    /**
     * ルート変更検出を設定
     */
    setupRouteChangeDetection() {
        // History API のオーバーライド
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = (...args) => {
            this.handleRouteChange('pushState', args[2]);
            return originalPushState.apply(history, args);
        };

        history.replaceState = (...args) => {
            this.handleRouteChange('replaceState', args[2]);
            return originalReplaceState.apply(history, args);
        };

        // popstate イベントを監視
        window.addEventListener('popstate', (event) => {
            this.handleRouteChange('popstate', window.location.pathname);
        });

        // hashchange イベントを監視
        window.addEventListener('hashchange', (event) => {
            this.handleRouteChange('hashchange', window.location.hash);
        });
    }

    /**
     * ルート変更を処理
     */
    handleRouteChange(type, url) {
        const routeChange = {
            type,
            url,
            timestamp: Date.now(),
            previousUrl: this.routeHistory.length > 0 ? 
                this.routeHistory[this.routeHistory.length - 1].url : null
        };

        this.routeHistory.push(routeChange);
        
        // 履歴サイズを制限
        if (this.routeHistory.length > 50) {
            this.routeHistory.splice(0, this.routeHistory.length - 50);
        }

        // ルート変更リスナーに通知
        this.routeChangeListeners.forEach(listener => {
            try {
                listener(routeChange);
            } catch (error) {
                console.warn('ルート変更リスナーエラー:', error);
            }
        });

        // ルート変更後の遅延検出を実行
        setTimeout(() => {
            this.performPostRouteChangeDetection();
        }, 500);
    }

    /**
     * ルート変更後の検出を実行
     */
    performPostRouteChangeDetection() {
        // 新しく追加された要素を検出
        const recentElements = this.detectRecentlyAddedElements();
        
        // SPA特有のポップアップパターンを検出
        const spaPopups = this.detectSPASpecificPopups();
        
        // 検出結果を統合
        const allDetected = [...recentElements, ...spaPopups];
        
        if (allDetected.length > 0) {
            // 検出結果を親に通知
            this.notifyDetection(allDetected, 'route-change');
        }
    }

    /**
     * 最近追加された要素を検出
     */
    detectRecentlyAddedElements() {
        const recentElements = [];
        const now = Date.now();
        const threshold = 2000; // 2秒以内

        // data-recently-added 属性を持つ要素を検索
        const markedElements = document.querySelectorAll('[data-recently-added]');
        
        markedElements.forEach(element => {
            const addedTime = parseInt(element.dataset.recentlyAdded);
            if (now - addedTime < threshold) {
                recentElements.push(element);
            }
        });

        return recentElements;
    }

    /**
     * SPA特有のポップアップパターンを検出
     */
    detectSPASpecificPopups() {
        const spaPopups = [];

        // フレームワーク固有の検出
        switch (this.websiteType) {
            case 'spa-react':
                spaPopups.push(...this.detectReactSpecificPopups());
                break;
            case 'spa-vue':
                spaPopups.push(...this.detectVueSpecificPopups());
                break;
            case 'spa-angular':
                spaPopups.push(...this.detectAngularSpecificPopups());
                break;
        }

        // 汎用SPA検出
        spaPopups.push(...this.detectGenericSPAPopups());

        return spaPopups;
    }

    /**
     * React 固有のポップアップを検出
     */
    detectReactSpecificPopups() {
        const reactPopups = [];

        // React Portal を検索
        const portals = document.querySelectorAll('[data-react-portal], .ReactModalPortal');
        portals.forEach(portal => {
            const popupElements = portal.querySelectorAll('[role="dialog"], .modal, .popup');
            reactPopups.push(...Array.from(popupElements));
        });

        // React コンポーネントの data 属性を検索
        const reactComponents = document.querySelectorAll('[data-reactroot] [class*="Modal"], [data-reactroot] [class*="Popup"]');
        reactPopups.push(...Array.from(reactComponents));

        return reactPopups;
    }

    /**
     * Vue 固有のポップアップを検出
     */
    detectVueSpecificPopups() {
        const vuePopups = [];

        // Vue Teleport を検索
        const teleports = document.querySelectorAll('[data-v-] [role="dialog"], .v-dialog, .v-overlay');
        vuePopups.push(...Array.from(teleports));

        // Vue コンポーネントのクラスを検索
        const vueComponents = document.querySelectorAll('[class*="v-"], [data-v-]');
        vueComponents.forEach(component => {
            if (this.isVuePopupComponent(component)) {
                vuePopups.push(component);
            }
        });

        return vuePopups;
    }

    /**
     * Angular 固有のポップアップを検出
     */
    detectAngularSpecificPopups() {
        const angularPopups = [];

        // Angular CDK Overlay を検索
        const overlays = document.querySelectorAll('.cdk-overlay-container, .cdk-global-overlay-wrapper');
        overlays.forEach(overlay => {
            const popupElements = overlay.querySelectorAll('.cdk-overlay-pane, mat-dialog-container');
            angularPopups.push(...Array.from(popupElements));
        });

        // Angular Material コンポーネントを検索
        const matComponents = document.querySelectorAll('mat-dialog-container, mat-snack-bar-container');
        angularPopups.push(...Array.from(matComponents));

        return angularPopups;
    }

    /**
     * 汎用SPA ポップアップを検出
     */
    detectGenericSPAPopups() {
        const genericPopups = [];

        // 動的に追加されたモーダル要素
        const dynamicModals = document.querySelectorAll('[role="dialog"]:not([data-spa-processed])');
        dynamicModals.forEach(modal => {
            if (this.isDynamicallyAdded(modal)) {
                modal.dataset.spaProcessed = 'true';
                genericPopups.push(modal);
            }
        });

        // 高いz-indexを持つ最近の要素
        const highZElements = document.querySelectorAll('*');
        highZElements.forEach(element => {
            const style = window.getComputedStyle(element);
            const zIndex = parseInt(style.zIndex) || 0;
            
            if (zIndex > 1000 && this.isDynamicallyAdded(element) && this.isVisiblePopup(element)) {
                genericPopups.push(element);
            }
        });

        return genericPopups;
    }

    /**
     * 動的に追加された要素かチェック
     */
    isDynamicallyAdded(element) {
        // 要素が最近のルート変更後に追加されたかチェック
        const lastRouteChange = this.routeHistory[this.routeHistory.length - 1];
        if (!lastRouteChange) return false;

        const timeSinceRouteChange = Date.now() - lastRouteChange.timestamp;
        return timeSinceRouteChange < 5000; // 5秒以内
    }

    /**
     * 見えるポップアップかチェック
     */
    isVisiblePopup(element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               parseFloat(style.opacity) > 0 &&
               rect.width > 50 &&
               rect.height > 50;
    }

    /**
     * Vue ポップアップコンポーネントかチェック
     */
    isVuePopupComponent(element) {
        const classList = Array.from(element.classList);
        const popupClasses = ['v-dialog', 'v-overlay', 'v-menu', 'v-tooltip'];
        
        return popupClasses.some(cls => classList.some(c => c.includes(cls)));
    }

    /**
     * MutationObserver の変更を処理
     */
    handleMutations(mutations) {
        if (!this.initialized) return [];

        const detectedElements = [];
        const processedNodes = new Set();

        mutations.forEach(mutation => {
            // 追加されたノードを処理
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE && !processedNodes.has(node)) {
                    processedNodes.add(node);
                    
                    // 要素に追加時刻をマーク
                    node.dataset.recentlyAdded = Date.now().toString();
                    
                    // SPA特有の検出を実行
                    const spaElements = this.analyzeSPAElement(node);
                    detectedElements.push(...spaElements);
                }
            });

            // 属性変更を処理（SPA での動的表示切り替え）
            if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
                const element = mutation.target;
                
                // 表示状態の変更をチェック
                if (mutation.attributeName === 'style' || 
                    mutation.attributeName === 'class' ||
                    mutation.attributeName === 'aria-hidden') {
                    
                    if (this.isVisiblePopup(element) && this.isSPAPopup(element)) {
                        detectedElements.push(element);
                    }
                }
            }
        });

        return detectedElements;
    }

    /**
     * SPA要素を分析
     */
    analyzeSPAElement(element) {
        const spaElements = [];

        // 要素自体をチェック
        if (this.isSPAPopup(element)) {
            spaElements.push(element);
        }

        // 子要素をチェック
        const children = element.querySelectorAll('*');
        children.forEach(child => {
            if (this.isSPAPopup(child)) {
                spaElements.push(child);
            }
        });

        return spaElements;
    }

    /**
     * SPA ポップアップかチェック
     */
    isSPAPopup(element) {
        // フレームワーク固有のチェック
        if (this.isFrameworkSpecificPopup(element)) return true;

        // 汎用SPA特徴のチェック
        return this.hasGenericSPAPopupFeatures(element);
    }

    /**
     * フレームワーク固有のポップアップかチェック
     */
    isFrameworkSpecificPopup(element) {
        const checks = {
            'spa-react': () => this.isReactPopup(element),
            'spa-vue': () => this.isVuePopup(element),
            'spa-angular': () => this.isAngularPopup(element)
        };

        const checker = checks[this.websiteType];
        return checker ? checker() : false;
    }

    /**
     * React ポップアップかチェック
     */
    isReactPopup(element) {
        // React Portal 内にある
        if (element.closest('[data-react-portal], .ReactModalPortal')) return true;

        // React コンポーネントの特徴
        const hasReactProps = element.hasAttribute('data-reactroot') || 
                             element.closest('[data-reactroot]');
        const hasModalClasses = element.className.includes('Modal') || 
                               element.className.includes('Popup');

        return hasReactProps && hasModalClasses;
    }

    /**
     * Vue ポップアップかチェック
     */
    isVuePopup(element) {
        // Vue の data 属性を持つ
        const hasVueData = Array.from(element.attributes).some(attr => 
            attr.name.startsWith('data-v-')
        );

        // Vue コンポーネントクラス
        const hasVueClasses = ['v-dialog', 'v-overlay', 'v-menu'].some(cls =>
            element.classList.contains(cls)
        );

        return hasVueData && (hasVueClasses || element.tagName.includes('-'));
    }

    /**
     * Angular ポップアップかチェック
     */
    isAngularPopup(element) {
        // Angular CDK Overlay 内にある
        if (element.closest('.cdk-overlay-container')) return true;

        // Angular Material コンポーネント
        const angularComponents = ['mat-dialog-container', 'mat-snack-bar-container'];
        return angularComponents.includes(element.tagName.toLowerCase());
    }

    /**
     * 汎用SPA ポップアップ特徴をチェック
     */
    hasGenericSPAPopupFeatures(element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        // 基本的なポップアップ特徴
        const isPositioned = style.position === 'fixed' || style.position === 'absolute';
        const hasHighZIndex = (parseInt(style.zIndex) || 0) > 100;
        const isVisible = this.isVisiblePopup(element);
        const hasReasonableSize = rect.width > 100 && rect.height > 100;

        // SPA特有の特徴
        const wasRecentlyAdded = element.dataset.recentlyAdded && 
                               (Date.now() - parseInt(element.dataset.recentlyAdded)) < 3000;
        const hasAnimation = style.animation !== 'none' || style.transition !== 'none';
        const hasModalRole = element.getAttribute('role') === 'dialog' || 
                            element.getAttribute('aria-modal') === 'true';

        const basicScore = [isPositioned, hasHighZIndex, isVisible, hasReasonableSize]
                          .filter(Boolean).length;
        const spaScore = [wasRecentlyAdded, hasAnimation, hasModalRole]
                        .filter(Boolean).length;

        return basicScore >= 3 && spaScore >= 1;
    }

    /**
     * ポータルコンテナを検出
     */
    detectPortalContainers() {
        const portalSelectors = [
            // React
            '[data-react-portal]', '.ReactModalPortal',
            // Vue
            '[data-v-] .v-application--wrap',
            // Angular
            '.cdk-overlay-container', '.cdk-global-overlay-wrapper',
            // 汎用
            '#modal-root', '#popup-root', '.portal-container'
        ];

        portalSelectors.forEach(selector => {
            const containers = document.querySelectorAll(selector);
            containers.forEach(container => {
                this.portalContainers.add(container);
            });
        });
    }

    /**
     * 仮想DOM観察を設定
     */
    setupVirtualDOMObservation() {
        // ポータルコンテナを監視
        this.portalContainers.forEach(container => {
            const observer = new MutationObserver((mutations) => {
                const detectedElements = this.handleMutations(mutations);
                if (detectedElements.length > 0) {
                    this.notifyDetection(detectedElements, 'virtual-dom');
                }
            });

            observer.observe(container, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class', 'aria-hidden']
            });
        });
    }

    /**
     * コンポーネントライフサイクル監視を設定
     */
    setupComponentLifecycleMonitoring() {
        // フレームワーク固有のライフサイクルフックを設定
        switch (this.websiteType) {
            case 'spa-react':
                this.setupReactLifecycleHooks();
                break;
            case 'spa-vue':
                this.setupVueLifecycleHooks();
                break;
            case 'spa-angular':
                this.setupAngularLifecycleHooks();
                break;
        }
    }

    /**
     * React ライフサイクルフックを設定
     */
    setupReactLifecycleHooks() {
        // React DevTools フックを利用してコンポーネントの変更を監視
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
            
            const originalOnCommitFiberRoot = hook.onCommitFiberRoot;
            hook.onCommitFiberRoot = (id, root, priorityLevel) => {
                if (originalOnCommitFiberRoot) {
                    originalOnCommitFiberRoot(id, root, priorityLevel);
                }
                
                // コンポーネントの変更を処理
                this.handleReactCommit(root);
            };
        }
    }

    /**
     * React コミットを処理
     */
    handleReactCommit(root) {
        // React Fiber ツリーから新しいポップアップを検出
        setTimeout(() => {
            const newPopups = this.detectReactSpecificPopups();
            if (newPopups.length > 0) {
                this.notifyDetection(newPopups, 'react-commit');
            }
        }, 100);
    }

    /**
     * 検出結果を通知
     */
    notifyDetection(elements, source) {
        // カスタムイベントを発火
        const event = new CustomEvent('spaPopupDetected', {
            detail: {
                elements,
                source,
                timestamp: Date.now(),
                websiteType: this.websiteType
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * ルート変更リスナーを追加
     */
    addRouteChangeListener(listener) {
        this.routeChangeListeners.push(listener);
    }

    /**
     * ルート変更リスナーを削除
     */
    removeRouteChangeListener(listener) {
        const index = this.routeChangeListeners.indexOf(listener);
        if (index > -1) {
            this.routeChangeListeners.splice(index, 1);
        }
    }

    /**
     * 統計情報を取得
     */
    getStatistics() {
        return {
            websiteType: this.websiteType,
            routeChanges: this.routeHistory.length,
            portalContainers: this.portalContainers.size,
            listeners: this.routeChangeListeners.length,
            initialized: this.initialized,
            lastRouteChange: this.routeHistory.length > 0 ? 
                this.routeHistory[this.routeHistory.length - 1] : null
        };
    }

    /**
     * クリーンアップ
     */
    cleanup() {
        // オブザーバーを停止
        if (this.virtualDOMObserver) {
            this.virtualDOMObserver.disconnect();
        }
        
        if (this.componentMountObserver) {
            this.componentMountObserver.disconnect();
        }

        // リスナーをクリア
        this.routeChangeListeners = [];
        this.portalContainers.clear();
        this.componentLifecycleHooks.clear();
        
        this.initialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SPAHandler };
} else {
    window.SPAHandler = SPAHandler;
}