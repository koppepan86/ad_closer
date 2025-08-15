/**
 * PopupDetector統合管理システム
 * PopupDetector関連の全ての機能を統合管理し、エラーを根本的に解決
 */

(function () {
  'use strict';

  /**
   * PopupDetector統合マネージャー
   */
  class PopupDetectorManager {
    constructor() {
      this.initialized = false;
      this.initializing = false;
      this.initializationPromise = null;
      this.components = {
        popupDetector: null,
        popupDetectorGuard: null,
        componentRecovery: null
      };
      this.status = {
        phase: 'not_started',
        lastError: null,
        initializationAttempts: 0,
        maxAttempts: 3
      };
      this.config = {
        initializationTimeout: 10000,
        healthCheckInterval: 30000,
        retryDelay: 1000
      };
    }

    /**
     * PopupDetectorシステム全体を初期化
     */
    async initialize() {
      if (this.initialized) {
        return this.components.popupDetector;
      }

      if (this.initializing) {
        return this.initializationPromise;
      }

      this.initializing = true;
      this.initializationPromise = this._performInitialization();

      try {
        const result = await this.initializationPromise;
        return result;
      } finally {
        this.initializing = false;
      }
    }

    /**
     * 初期化プロセスを実行
     */
    async _performInitialization() {
      console.log('PopupDetectorManager: Starting comprehensive initialization');

      try {
        // Phase 1: 基本環境チェック
        await this._checkEnvironment();

        // Phase 2: PopupDetectorGuard初期化
        await this._initializeGuard();

        // Phase 3: PopupDetector本体初期化
        await this._initializePopupDetector();

        // Phase 4: ComponentRecoveryManager登録
        await this._registerWithRecoveryManager();

        // Phase 5: 最終検証
        await this._performFinalValidation();

        this.initialized = true;
        this.status.phase = 'completed';
        console.log('PopupDetectorManager: Initialization completed successfully');

        // ヘルスチェックを開始
        this._startHealthMonitoring();

        return this.components.popupDetector;

      } catch (error) {
        this.status.lastError = error;
        this.status.initializationAttempts++;

        console.error('PopupDetectorManager: Initialization failed:', error);

        // 最大試行回数に達していない場合は再試行
        if (this.status.initializationAttempts < this.config.maxAttempts) {
          console.log(`PopupDetectorManager: Retrying initialization (attempt ${this.status.initializationAttempts + 1}/${this.config.maxAttempts})`);

          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
          return this._performInitialization();
        }

        // 最大試行回数に達した場合はフォールバック
        return this._initializeFallback();
      }
    }

    /**
     * 基本環境をチェック
     */
    async _checkEnvironment() {
      this.status.phase = 'environment_check';
      console.debug('PopupDetectorManager: Checking environment');

      // 基本的なブラウザ機能をチェック
      if (typeof window === 'undefined') {
        throw new Error('Window object not available');
      }

      if (typeof document === 'undefined') {
        throw new Error('Document object not available');
      }

      if (typeof MutationObserver === 'undefined') {
        throw new Error('MutationObserver not supported');
      }

      console.debug('PopupDetectorManager: Environment check passed');
    }

    /**
     * PopupDetectorGuardを初期化
     */
    async _initializeGuard() {
      this.status.phase = 'guard_initialization';
      console.debug('PopupDetectorManager: Initializing PopupDetectorGuard');

      // PopupDetectorGuardが既に存在するかチェック
      if (window.PopupDetectorGuard) {
        this.components.popupDetectorGuard = window.PopupDetectorGuard;
        console.debug('PopupDetectorManager: PopupDetectorGuard already available');
        return;
      }

      // PopupDetectorGuardの初期化を待機
      let attempts = 0;
      const maxAttempts = 50; // 5秒間待機

      while (attempts < maxAttempts) {
        if (window.PopupDetectorGuard) {
          this.components.popupDetectorGuard = window.PopupDetectorGuard;
          console.debug('PopupDetectorManager: PopupDetectorGuard initialized');
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      console.warn('PopupDetectorManager: PopupDetectorGuard not available, continuing without guard');
    }

    /**
     * PopupDetector本体を初期化
     */
    async _initializePopupDetector() {
      this.status.phase = 'popup_detector_initialization';
      console.debug('PopupDetectorManager: Initializing PopupDetector');

      // 既存のPopupDetectorをチェック
      if (window.popupDetector) {
        if (await this._validatePopupDetector(window.popupDetector)) {
          this.components.popupDetector = window.popupDetector;
          console.debug('PopupDetectorManager: Existing PopupDetector is valid');
          return;
        } else {
          console.warn('PopupDetectorManager: Existing PopupDetector is invalid, recreating');
          window.popupDetector = null;
        }
      }

      // PopupDetectorクラスが利用可能かチェック
      if (typeof PopupDetector === 'function') {
        try {
          const newDetector = new PopupDetector();

          if (await this._validatePopupDetector(newDetector)) {
            window.popupDetector = newDetector;
            this.components.popupDetector = newDetector;
            console.debug('PopupDetectorManager: New PopupDetector created successfully');
            return;
          }
        } catch (error) {
          console.warn('PopupDetectorManager: Failed to create PopupDetector:', error);
        }
      }

      // PopupDetectorGuardのプロキシを使用
      if (this.components.popupDetectorGuard) {
        const proxyDetector = this._createProxyDetector();
        window.popupDetector = proxyDetector;
        this.components.popupDetector = proxyDetector;
        console.debug('PopupDetectorManager: Using PopupDetectorGuard proxy');
        return;
      }

      throw new Error('Unable to initialize PopupDetector');
    }

    /**
     * PopupDetectorを検証
     */
    async _validatePopupDetector(detector) {
      try {
        // 基本的なメソッドの存在をチェック
        if (typeof detector.detectPopups !== 'function') {
          return false;
        }

        if (typeof detector.handleMutations !== 'function') {
          return false;
        }

        // 基本的な機能テスト
        const testResult = await detector.detectPopups();
        if (!Array.isArray(testResult)) {
          return false;
        }

        // handleMutationsテスト
        detector.handleMutations([]);

        return true;
      } catch (error) {
        console.debug('PopupDetectorManager: PopupDetector validation failed:', error);
        return false;
      }
    }

    /**
     * プロキシDetectorを作成
     */
    _createProxyDetector() {
      const manager = this;

      return {
        detectPopups: async function () {
          try {
            if (manager.components.popupDetectorGuard &&
              typeof manager.components.popupDetectorGuard.safeDetectPopups === 'function') {
              return await manager.components.popupDetectorGuard.safeDetectPopups();
            }
            return [];
          } catch (error) {
            console.warn('PopupDetectorManager: Proxy detectPopups error:', error);
            return [];
          }
        },

        handleMutations: function (mutations) {
          try {
            if (manager.components.popupDetectorGuard &&
              typeof manager.components.popupDetectorGuard.safeHandleMutations === 'function') {
              return manager.components.popupDetectorGuard.safeHandleMutations(mutations);
            }
          } catch (error) {
            console.warn('PopupDetectorManager: Proxy handleMutations error:', error);
          }
        },

        // 追加のメソッド
        cleanup: function () {
          console.debug('PopupDetectorManager: Proxy cleanup called');
        },

        destroy: function () {
          console.debug('PopupDetectorManager: Proxy destroy called');
        }
      };
    }

    /**
     * ComponentRecoveryManagerに登録
     */
    async _registerWithRecoveryManager() {
      this.status.phase = 'recovery_registration';
      console.debug('PopupDetectorManager: Registering with ComponentRecoveryManager');

      if (window.componentRecoveryManager) {
        try {
          // 既存の登録を確認
          if (!window.componentRecoveryManager.components.has('popupDetector')) {
            window.componentRecoveryManager.registerComponent('popupDetector', this.components.popupDetector, {
              healthCheckEnabled: true,
              healthCheckInterval: this.config.healthCheckInterval,
              maxRecoveryAttempts: 3,
              autoRecover: true
            });
            console.debug('PopupDetectorManager: Registered with ComponentRecoveryManager');
          } else {
            console.debug('PopupDetectorManager: Already registered with ComponentRecoveryManager');
          }

          this.components.componentRecovery = window.componentRecoveryManager;
        } catch (error) {
          console.warn('PopupDetectorManager: Failed to register with ComponentRecoveryManager:', error);
        }
      } else {
        console.debug('PopupDetectorManager: ComponentRecoveryManager not available');
      }
    }

    /**
     * 最終検証を実行
     */
    async _performFinalValidation() {
      this.status.phase = 'final_validation';
      console.debug('PopupDetectorManager: Performing final validation');

      // PopupDetectorの最終チェック
      if (!this.components.popupDetector) {
        throw new Error('PopupDetector not initialized');
      }

      if (!await this._validatePopupDetector(this.components.popupDetector)) {
        throw new Error('PopupDetector validation failed');
      }

      // グローバル参照の確認
      if (window.popupDetector !== this.components.popupDetector) {
        console.warn('PopupDetectorManager: Global reference mismatch, correcting');
        window.popupDetector = this.components.popupDetector;
      }

      console.debug('PopupDetectorManager: Final validation passed');
    }

    /**
     * フォールバック初期化
     */
    async _initializeFallback() {
      console.warn('PopupDetectorManager: Initializing fallback system');

      const fallbackDetector = {
        detectPopups: () => {
          console.debug('PopupDetectorManager: Fallback detectPopups called');
          return [];
        },

        handleMutations: (mutations) => {
          console.debug('PopupDetectorManager: Fallback handleMutations called with', mutations.length, 'mutations');
        },

        cleanup: () => {
          console.debug('PopupDetectorManager: Fallback cleanup called');
        },

        destroy: () => {
          console.debug('PopupDetectorManager: Fallback destroy called');
        }
      };

      window.popupDetector = fallbackDetector;
      this.components.popupDetector = fallbackDetector;
      this.status.phase = 'fallback_active';

      console.log('PopupDetectorManager: Fallback system initialized');
      return fallbackDetector;
    }

    /**
     * ヘルス監視を開始
     */
    _startHealthMonitoring() {
      setInterval(() => {
        this._performHealthCheck();
      }, this.config.healthCheckInterval);
    }

    /**
     * ヘルスチェックを実行
     */
    async _performHealthCheck() {
      try {
        if (!this.components.popupDetector) {
          console.warn('PopupDetectorManager: Health check failed - PopupDetector not available');
          return;
        }

        const isHealthy = await this._validatePopupDetector(this.components.popupDetector);

        if (!isHealthy) {
          console.warn('PopupDetectorManager: Health check failed - attempting recovery');
          await this._attemptRecovery();
        }
      } catch (error) {
        console.error('PopupDetectorManager: Health check error:', error);
      }
    }

    /**
     * 回復を試行
     */
    async _attemptRecovery() {
      console.log('PopupDetectorManager: Attempting recovery');

      try {
        // 初期化状態をリセット
        this.initialized = false;
        this.status.phase = 'recovery';

        // 再初期化を実行
        await this.initialize();

        console.log('PopupDetectorManager: Recovery successful');
      } catch (error) {
        console.error('PopupDetectorManager: Recovery failed:', error);

        // フォールバックシステムを有効化
        await this._initializeFallback();
      }
    }

    /**
     * 現在の状態を取得
     */
    getStatus() {
      return {
        initialized: this.initialized,
        initializing: this.initializing,
        phase: this.status.phase,
        lastError: this.status.lastError?.message,
        initializationAttempts: this.status.initializationAttempts,
        components: {
          popupDetector: !!this.components.popupDetector,
          popupDetectorGuard: !!this.components.popupDetectorGuard,
          componentRecovery: !!this.components.componentRecovery
        }
      };
    }

    /**
     * 手動で再初期化
     */
    async reinitialize() {
      console.log('PopupDetectorManager: Manual reinitialization requested');

      this.initialized = false;
      this.initializing = false;
      this.initializationPromise = null;
      this.status.initializationAttempts = 0;

      return this.initialize();
    }
  }

  // グローバルインスタンスを作成
  const popupDetectorManager = new PopupDetectorManager();

  // エクスポート
  if (typeof window !== 'undefined') {
    window.PopupDetectorManager = PopupDetectorManager;
    window.popupDetectorManager = popupDetectorManager;

    // 自動初期化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        popupDetectorManager.initialize();
      });
    } else {
      // DOM already loaded
      setTimeout(() => {
        popupDetectorManager.initialize();
      }, 100);
    }
  }

  console.log('PopupDetectorManager: System loaded');
})();