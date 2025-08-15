/**
 * PopupDetector - ポップアップ検出システム（重複定義防止版）
 * 様々なタイプのポップアップを検出し、適切に処理する
 */

(function (global) {
  'use strict';

  // 既にPopupDetectorが定義されている場合はスキップ
  if (typeof global.PopupDetector !== 'undefined') {
    console.log('PopupDetector class already defined, skipping redefinition');
    return;
  }

  class PopupDetector {
    constructor(options = {}) {
      this.options = {
        detectionInterval: options.detectionInterval || 1000,
        maxDetectionAttempts: options.maxDetectionAttempts || 10,
        enableMutationObserver: options.enableMutationObserver !== false,
        enablePeriodicCheck: options.enablePeriodicCheck !== false,
        debugMode: options.debugMode || false,
        ...options
      };

      // 内部状態
      this.initialized = false;
      this.observer = null;
      this.universalDetector = null;
      this.detectionCount = 0;
      this.lastDetectionTime = 0;
      this.detectedPopups = new Set();
      this.detectionHistory = [];

      // 重複防止とスロットリング
      this.processedElements = new Set();
      this.pendingUserChoices = new Map();
      this.lastUserChoiceTime = 0;
      this.userChoiceCooldown = 30000; // 30秒のクールダウン
      this.periodicCheckInterval = null;

      // バインドされたメソッド
      this.handleMutations = this.handleMutations.bind(this);
      this.detectPopups = this.detectPopups.bind(this);
      this.periodicCheck = this.periodicCheck.bind(this);

      // 初期化
      this.initialize();
    }

    /**
     * PopupDetectorを初期化
     */
    initialize() {
      try {
        console.log('PopupDetector: Initializing...');

        // DOM準備完了を確認
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            this.performInitialization();
          });
        } else {
          this.performInitialization();
        }

      } catch (error) {
        console.error('PopupDetector: Initialization error:', error);
        this.initialized = false;
      }
    }

    /**
     * 実際の初期化処理を実行
     */
    performInitialization() {
      try {
        console.log('PopupDetector: Performing initialization...');

        // MutationObserverを設定
        if (this.options.enableMutationObserver) {
          this.setupMutationObserver();
        }

        // 定期チェックを設定
        if (this.options.enablePeriodicCheck) {
          this.setupPeriodicCheck();
        }

        // ユニバーサル検出器を設定
        this.setupUniversalDetector();

        // 初期化完了フラグを設定
        this.initialized = true;
        console.log('PopupDetector: Initialization complete');

        // 初期化完了イベントを発火
        this.dispatchInitializationEvent();

        // 初回検出を実行
        setTimeout(async () => {
          if (this.initialized) {
            await this.detectPopups();
          }
        }, 100);

      } catch (error) {
        console.error('PopupDetector: Initialization error:', error);
        this.initialized = false;

        // 初期化エラーイベントを発火
        this.dispatchInitializationErrorEvent(error);
      }
    }

    /**
     * 初期化完了イベントを発火
     */
    dispatchInitializationEvent() {
      try {
        const event = new CustomEvent('popupDetectorInitialized', {
          detail: {
            detector: this,
            timestamp: Date.now(),
            stats: this.getStats()
          }
        });

        document.dispatchEvent(event);
        console.log('PopupDetector: Initialization event dispatched');

      } catch (error) {
        console.error('PopupDetector: Error dispatching initialization event:', error);
      }
    }

    /**
     * 初期化エラーイベントを発火
     */
    dispatchInitializationErrorEvent(error) {
      try {
        const event = new CustomEvent('popupDetectorInitializationError', {
          detail: {
            error: error.message,
            stack: error.stack,
            timestamp: Date.now()
          }
        });

        document.dispatchEvent(event);
        console.error('PopupDetector: Initialization error event dispatched');

      } catch (eventError) {
        console.error('PopupDetector: Error dispatching initialization error event:', eventError);
      }
    }

    /**
     * MutationObserverを設定
     */
    setupMutationObserver() {
      try {
        if (typeof MutationObserver === 'undefined') {
          console.warn('PopupDetector: MutationObserver not available');
          return;
        }

        this.observer = new MutationObserver(this.handleMutations);

        // DOM全体を監視
        this.observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class', 'id']
        });

        console.log('PopupDetector: MutationObserver setup complete');

      } catch (error) {
        console.error('PopupDetector: MutationObserver setup error:', error);
      }
    }

    /**
     * 定期チェックを設定
     */
    setupPeriodicCheck() {
      try {
        this.periodicCheckInterval = setInterval(
          async () => await this.periodicCheck(),
          this.options.detectionInterval
        );

        console.log('PopupDetector: Periodic check setup complete');

      } catch (error) {
        console.error('PopupDetector: Periodic check setup error:', error);
      }
    }

    /**
     * ユニバーサル検出器を設定
     */
    setupUniversalDetector() {
      try {
        this.universalDetector = {
          // 一般的なポップアップセレクタ
          selectors: [
            '[class*="popup"]',
            '[class*="modal"]',
            '[class*="overlay"]',
            '[class*="dialog"]',
            '[id*="popup"]',
            '[id*="modal"]',
            '[role="dialog"]',
            '.popup',
            '.modal',
            '.overlay'
          ],

          // 広告特有のセレクタ
          adSelectors: [
            '[id*="ad"]',
            '[id*="banner"]',
            '[id*="bnc_ad"]',
            '[class*="ad"]',
            '[class*="banner"]',
            '[class*="advertisement"]',
            'iframe[id*="ad"]',
            'iframe[src*="ads"]',
            'iframe[src*="doubleclick"]',
            'iframe[src*="googlesyndication"]',
            '[data-ad-slot]',
            '[data-google-ad-client]'
          ],

          // z-indexベースの検出
          highZIndexThreshold: 1000,

          // 広告用の低いz-indexしきい値
          adZIndexThreshold: 500,

          // 位置ベースの検出
          positionTypes: ['fixed', 'absolute'],

          // 広告の一般的なサイズ
          commonAdSizes: [
            { width: 728, height: 90 },   // Leaderboard
            { width: 300, height: 250 },  // Medium Rectangle
            { width: 320, height: 50 },   // Mobile Banner
            { width: 160, height: 600 },  // Wide Skyscraper
            { width: 300, height: 600 },  // Half Page
            { width: 970, height: 250 },  // Billboard
            { width: 320, height: 100 }   // Large Mobile Banner
          ]
        };

        console.log('PopupDetector: Universal detector setup complete');

      } catch (error) {
        console.error('PopupDetector: Universal detector setup error:', error);
      }
    }

    /**
     * DOM変更を処理
     */
    handleMutations(mutations) {
      try {
        if (!mutations || mutations.length === 0) {
          return;
        }

        let shouldDetect = false;

        for (const mutation of mutations) {
          // 新しい要素の追加をチェック
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // ポップアップらしい要素かチェック
                if (this.isLikelyPopup(node)) {
                  shouldDetect = true;
                  break;
                }
              }
            }
          }

          // スタイル変更をチェック
          if (mutation.type === 'attributes' &&
            (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
            if (this.isLikelyPopup(mutation.target)) {
              shouldDetect = true;
            }
          }

          if (shouldDetect) break;
        }

        if (shouldDetect) {
          // スロットリング（より厳格に）
          const now = Date.now();
          if (now - this.lastDetectionTime > 2000 && this.pendingUserChoices.size === 0) {
            this.lastDetectionTime = now;
            setTimeout(async () => await this.detectPopups(), 100);
          }
        }

      } catch (error) {
        console.error('PopupDetector: Mutation handling error:', error);
      }
    }

    /**
     * 要素がポップアップらしいかチェック
     */
    isLikelyPopup(element) {
      try {
        if (!element || !element.tagName) {
          return false;
        }

        const tagName = element.tagName.toLowerCase();
        const className = element.className || '';
        const id = element.id || '';

        // 基本的なポップアップパターン
        const popupPatterns = [
          /popup/i,
          /modal/i,
          /overlay/i,
          /dialog/i,
          /lightbox/i,
          /tooltip/i
        ];

        // 広告パターン
        const adPatterns = [
          /ad[_-]?/i,
          /banner/i,
          /advertisement/i,
          /bnc_ad/i,
          /google.*ad/i,
          /doubleclick/i,
          /adsystem/i
        ];

        // クラス名やIDでチェック
        for (const pattern of popupPatterns) {
          if (pattern.test(className) || pattern.test(id)) {
            return true;
          }
        }

        // 広告パターンでチェック
        for (const pattern of adPatterns) {
          if (pattern.test(className) || pattern.test(id)) {
            return true;
          }
        }

        // スタイルベースのチェック
        const style = window.getComputedStyle(element);
        if (style.position === 'fixed' || style.position === 'absolute') {
          const zIndex = parseInt(style.zIndex) || 0;

          // 高いz-indexのチェック
          if (zIndex > this.universalDetector.highZIndexThreshold) {
            return true;
          }

          // 広告用の低いz-indexしきい値もチェック
          if (zIndex > this.universalDetector.adZIndexThreshold) {
            // 広告らしい特徴があるかチェック
            if (this.hasAdCharacteristics(element)) {
              return true;
            }
          }
        }

        // iframeの特別チェック
        if (tagName === 'iframe' || element.querySelector('iframe')) {
          if (this.hasAdCharacteristics(element)) {
            return true;
          }
        }

        return false;

      } catch (error) {
        console.error('PopupDetector: isLikelyPopup error:', error);
        return false;
      }
    }

    /**
     * 要素が広告の特徴を持つかチェック
     */
    hasAdCharacteristics(element) {
      try {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        // 一般的な広告サイズかチェック
        for (const adSize of this.universalDetector.commonAdSizes) {
          if (Math.abs(rect.width - adSize.width) <= 10 &&
            Math.abs(rect.height - adSize.height) <= 10) {
            return true;
          }
        }

        // 画面の端に配置されているかチェック
        const isAtEdge = rect.top <= 10 || rect.bottom >= window.innerHeight - 10 ||
          rect.left <= 10 || rect.right >= window.innerWidth - 10;

        // 全幅に近いかチェック
        const isFullWidth = rect.width >= window.innerWidth * 0.8;

        // 固定位置で端に配置されている場合
        if ((style.position === 'fixed' || style.position === 'absolute') &&
          (isAtEdge || isFullWidth)) {
          return true;
        }

        // iframeを含む場合
        const iframe = element.querySelector('iframe');
        if (iframe) {
          const iframeSrc = iframe.src || '';
          const iframeId = iframe.id || '';

          // 広告関連のURLやIDパターン
          const adUrlPatterns = [
            /ads/i,
            /doubleclick/i,
            /googlesyndication/i,
            /adsystem/i,
            /ad.*server/i
          ];

          for (const pattern of adUrlPatterns) {
            if (pattern.test(iframeSrc) || pattern.test(iframeId)) {
              return true;
            }
          }
        }

        return false;

      } catch (error) {
        console.debug('PopupDetector: hasAdCharacteristics error:', error);
        return false;
      }
    }

    /**
     * ポップアップを検出
     */
    async detectPopups() {
      try {
        const detectedPopups = [];

        if (!this.universalDetector) {
          console.warn('PopupDetector: Universal detector not initialized');
          return detectedPopups;
        }

        // セレクタベースの検出
        for (const selector of this.universalDetector.selectors) {
          try {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              if (this.isVisiblePopup(element)) {
                detectedPopups.push({
                  element,
                  type: 'selector',
                  selector,
                  timestamp: Date.now()
                });
              }
            }
          } catch (selectorError) {
            console.debug('PopupDetector: Selector error:', selector, selectorError);
          }
        }

        // 広告セレクタベースの検出
        for (const selector of this.universalDetector.adSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              if (this.isVisiblePopup(element)) {
                detectedPopups.push({
                  element,
                  type: 'ad-selector',
                  selector,
                  timestamp: Date.now()
                });
              }
            }
          } catch (selectorError) {
            console.debug('PopupDetector: Ad selector error:', selector, selectorError);
          }
        }

        // z-indexベースの検出
        const highZElements = this.findHighZIndexElements();
        for (const element of highZElements) {
          if (this.isVisiblePopup(element)) {
            detectedPopups.push({
              element,
              type: 'zindex',
              zIndex: window.getComputedStyle(element).zIndex,
              timestamp: Date.now()
            });
          }
        }

        // 検出結果を処理
        await this.processDetectionResults(detectedPopups);

        return detectedPopups;

      } catch (error) {
        console.error('PopupDetector: Detection error:', error);
        return [];
      }
    }

    /**
     * 高いz-indexを持つ要素を検索
     */
    findHighZIndexElements() {
      try {
        const elements = [];
        const allElements = document.querySelectorAll('*');

        for (const element of allElements) {
          const style = window.getComputedStyle(element);
          const zIndex = parseInt(style.zIndex) || 0;

          if (zIndex > this.universalDetector.highZIndexThreshold &&
            (style.position === 'fixed' || style.position === 'absolute')) {
            elements.push(element);
          }
        }

        return elements;

      } catch (error) {
        console.error('PopupDetector: High z-index search error:', error);
        return [];
      }
    }

    /**
     * 要素が可視のポップアップかチェック
     */
    isVisiblePopup(element) {
      try {
        if (!element) return false;

        const style = window.getComputedStyle(element);

        // 非表示要素を除外
        if (style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0') {
          return false;
        }

        // サイズチェック
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          return false;
        }

        // 画面外要素を除外
        if (rect.bottom < 0 || rect.right < 0 ||
          rect.top > window.innerHeight || rect.left > window.innerWidth) {
          return false;
        }

        return true;

      } catch (error) {
        console.error('PopupDetector: Visibility check error:', error);
        return false;
      }
    }

    /**
     * 検出結果を処理
     */
    async processDetectionResults(detectedPopups) {
      try {
        if (detectedPopups.length === 0) {
          return;
        }

        // 重複を除去
        const uniquePopups = this.deduplicatePopups(detectedPopups);

        // 検出履歴に追加
        this.detectionHistory.push({
          timestamp: Date.now(),
          count: uniquePopups.length,
          popups: uniquePopups
        });

        // 履歴サイズを制限
        if (this.detectionHistory.length > 100) {
          this.detectionHistory = this.detectionHistory.slice(-50);
        }

        // デバッグログ
        // デバッグモードが有効、または実際にポップアップが検出された場合にログを出力
        // debugMode: 開発時やトラブルシューティング時に詳細なログを確認するため
        // uniquePopups.length > 0: 実際にポップアップが検出された場合のみログを出力してパフォーマンスを考慮
        if (this.options.debugMode || uniquePopups.length > 0) {
          console.log('PopupDetector: Detected popups:', uniquePopups.map(popup => ({
            element: popup.element.tagName + (popup.element.id ? '#' + popup.element.id : '') + (popup.element.className ? '.' + popup.element.className.split(' ').join('.') : ''),
            type: popup.type,
            selector: popup.selector,
            zIndex: popup.zIndex,
            dimensions: {
              width: popup.element.offsetWidth,
              height: popup.element.offsetHeight
            },
            position: {
              top: popup.element.offsetTop,
              left: popup.element.offsetLeft
            }
          })));
        }

        // ユーザーに選択を求める
        await this.requestUserChoice(uniquePopups);

        // 検出イベントを発火
        this.dispatchDetectionEvent(uniquePopups);

        // 統計カウンターを更新
        this.detectionCount += uniquePopups.length;

      } catch (error) {
        console.error('PopupDetector: Result processing error:', error);
      }
    }

    /**
     * ポップアップの重複を除去
     */
    deduplicatePopups(popups) {
      try {
        const seen = new Set();
        const unique = [];

        for (const popup of popups) {
          const key = this.getPopupKey(popup.element);

          // 既に処理済みの要素はスキップ
          if (this.processedElements.has(key)) {
            continue;
          }

          if (!seen.has(key)) {
            seen.add(key);
            unique.push(popup);

            // 処理済みとしてマーク（1時間後に自動削除）
            this.processedElements.add(key);
            setTimeout(() => {
              this.processedElements.delete(key);
            }, 3600000); // 1時間
          }
        }

        return unique;

      } catch (error) {
        console.error('PopupDetector: Deduplication error:', error);
        return popups;
      }
    }

    /**
     * ポップアップのユニークキーを生成
     */
    getPopupKey(element) {
      try {
        return `${element.tagName}-${element.className}-${element.id}-${element.getBoundingClientRect().top}`;
      } catch (error) {
        return Math.random().toString();
      }
    }

    /**
     * ユーザーに選択を求める
     */
    async requestUserChoice(detectedPopups) {
      try {
        // ユーザー選択ダイアログが利用可能かチェック
        if (!window.userChoiceDialog) {
          console.warn('PopupDetector: UserChoiceDialog not available, skipping user choice');
          return;
        }

        // クールダウン期間中はスキップ
        const now = Date.now();
        if (now - this.lastUserChoiceTime < this.userChoiceCooldown) {
          console.log('PopupDetector: User choice cooldown active, skipping');
          await this.allowDetectedAds(detectedPopups, 'cooldown');
          return;
        }

        // 既に同じ要素に対してユーザー選択が進行中の場合はスキップ
        const elementKeys = detectedPopups.map(popup => this.getPopupKey(popup.element));
        const hasPendingChoice = elementKeys.some(key => this.pendingUserChoices.has(key));
        if (hasPendingChoice) {
          console.log('PopupDetector: User choice already pending for these elements');
          return;
        }

        // 進行中のユーザー選択として記録
        elementKeys.forEach(key => this.pendingUserChoices.set(key, now));

        // ユーザー設定を確認
        const preferences = await this.getUserPreferences();

        // 自動ブロックが有効な場合はダイアログをスキップ
        if (preferences.autoBlockEnabled) {
          console.log('PopupDetector: Auto-block enabled, blocking ads automatically');
          await this.blockDetectedAds(detectedPopups, 'auto');
          return;
        }

        // サイト別設定を確認
        const domain = window.location.hostname;
        const siteSettings = preferences.siteSettings?.[domain];

        if (siteSettings?.autoAction) {
          console.log(`PopupDetector: Site-specific setting found for ${domain}: ${siteSettings.autoAction}`);
          if (siteSettings.autoAction === 'block') {
            await this.blockDetectedAds(detectedPopups, 'site-setting');
          } else {
            await this.allowDetectedAds(detectedPopups, 'site-setting');
          }
          return;
        }

        // プレビュー生成を開始
        let previewData = null;
        try {
          previewData = await this.generateAdPreviews(detectedPopups);
        } catch (previewError) {
          console.warn('PopupDetector: Preview generation failed, continuing without previews:', previewError);
        }

        // ユーザーに選択を求める（プレビューデータ付き）
        console.log('PopupDetector: Requesting user choice for', detectedPopups.length, 'ads');
        const userChoice = await window.userChoiceDialog.showChoiceDialog(detectedPopups, previewData);

        // クールダウンタイマーを設定
        this.lastUserChoiceTime = Date.now();

        // 進行中のユーザー選択を削除
        elementKeys.forEach(key => this.pendingUserChoices.delete(key));

        // ユーザーの選択に基づいて処理
        if (userChoice.action === 'block') {
          await this.blockDetectedAds(detectedPopups, 'user-choice', userChoice);
        } else {
          await this.allowDetectedAds(detectedPopups, 'user-choice', userChoice);
        }

        // 選択を記憶する設定の場合、サイト設定を更新
        if (userChoice.options.rememberChoice) {
          await this.updateSiteSettings(domain, userChoice.action, userChoice.options);
        }

      } catch (error) {
        console.error('PopupDetector: User choice request error:', error);

        // 進行中のユーザー選択をクリア
        const elementKeys = detectedPopups.map(popup => this.getPopupKey(popup.element));
        elementKeys.forEach(key => this.pendingUserChoices.delete(key));

        // エラーの場合はデフォルトで許可
        await this.allowDetectedAds(detectedPopups, 'error');
      }
    }

    /**
     * 広告プレビューを生成
     */
    async generateAdPreviews(detectedPopups) {
      try {
        // AdPreviewCaptureが利用可能かチェック
        if (!window.AdPreviewCapture) {
          console.warn('PopupDetector: AdPreviewCapture not available');
          return null;
        }

        // AdPreviewCaptureのインスタンスを取得または作成
        let adPreviewCapture = window.adPreviewCapture;
        if (!adPreviewCapture) {
          adPreviewCapture = new window.AdPreviewCapture({
            debugMode: this.options.debugMode,
            privacyEnabled: true,
            privacyLevel: 'medium'
          });
          window.adPreviewCapture = adPreviewCapture;
        }

        // 初期化完了を待つ
        await adPreviewCapture.waitForInit();

        // プレビュー生成の進行状況を表示
        this.showPreviewGenerationProgress(detectedPopups.length);

        // 検出された要素からプレビューを生成
        const elements = detectedPopups.map(popup => popup.element);
        const previewResults = await adPreviewCapture.captureMultipleElements(elements, {
          showProgress: true,
          onProgress: (progress) => {
            this.updatePreviewGenerationProgress(progress);
          }
        });

        // プレビュー生成完了
        this.hidePreviewGenerationProgress();

        // 結果をログ出力
        const successCount = previewResults.filter(result => !result.fallback).length;
        console.log(`PopupDetector: Generated ${successCount}/${previewResults.length} previews successfully`);

        return {
          previews: previewResults,
          totalCount: detectedPopups.length,
          successCount: successCount,
          generationTime: Date.now()
        };

      } catch (error) {
        console.error('PopupDetector: Preview generation error:', error);
        this.hidePreviewGenerationProgress();
        return null;
      }
    }

    /**
     * プレビュー生成の進行状況表示を開始
     */
    showPreviewGenerationProgress(totalCount) {
      try {
        // プレビュー生成中の表示を作成
        const progressIndicator = document.createElement('div');
        progressIndicator.id = 'ad-preview-progress';
        progressIndicator.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          transition: opacity 0.3s ease;
        `;
        progressIndicator.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 16px; height: 16px; border: 2px solid #fff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span>広告プレビューを生成中... (0/${totalCount})</span>
          </div>
        `;

        // スピンアニメーションのCSSを追加
        if (!document.getElementById('ad-preview-progress-styles')) {
          const style = document.createElement('style');
          style.id = 'ad-preview-progress-styles';
          style.textContent = `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `;
          document.head.appendChild(style);
        }

        document.body.appendChild(progressIndicator);

        if (this.options.debugMode) {
          console.log('PopupDetector: Preview generation progress indicator shown');
        }

      } catch (error) {
        console.error('PopupDetector: Failed to show preview progress:', error);
      }
    }

    /**
     * プレビュー生成の進行状況を更新
     */
    updatePreviewGenerationProgress(progress) {
      try {
        const progressIndicator = document.getElementById('ad-preview-progress');
        if (progressIndicator) {
          const span = progressIndicator.querySelector('span');
          if (span) {
            span.textContent = `広告プレビューを生成中... (${progress.completed}/${progress.total})`;
          }
        }

        if (this.options.debugMode) {
          console.log('PopupDetector: Preview generation progress updated:', progress);
        }

      } catch (error) {
        console.error('PopupDetector: Failed to update preview progress:', error);
      }
    }

    /**
     * プレビュー生成の進行状況表示を隠す
     */
    hidePreviewGenerationProgress() {
      try {
        const progressIndicator = document.getElementById('ad-preview-progress');
        if (progressIndicator) {
          progressIndicator.style.opacity = '0';
          setTimeout(() => {
            if (progressIndicator.parentNode) {
              progressIndicator.parentNode.removeChild(progressIndicator);
            }
          }, 300);
        }

        if (this.options.debugMode) {
          console.log('PopupDetector: Preview generation progress indicator hidden');
        }

      } catch (error) {
        console.error('PopupDetector: Failed to hide preview progress:', error);
      }
    }

    /**
     * 検出された広告をブロック
     */
    async blockDetectedAds(detectedPopups, reason, userChoice = null) {
      try {
        console.log(`PopupDetector: Blocking ${detectedPopups.length} ads (reason: ${reason})`);

        let blockedCount = 0;
        for (const popup of detectedPopups) {
          try {
            // 要素を非表示にする
            if (popup.element && popup.element.parentNode) {
              popup.element.style.display = 'none';
              popup.element.style.visibility = 'hidden';
              popup.element.style.opacity = '0';
              popup.element.setAttribute('data-ad-blocked', 'true');
              blockedCount++;
            }
          } catch (elementError) {
            console.warn('PopupDetector: Failed to block element:', elementError);
          }
        }

        // バックグラウンドスクリプトに通知
        await this.notifyBackgroundScript(detectedPopups, 'blocked', reason, userChoice);

        console.log(`PopupDetector: Successfully blocked ${blockedCount}/${detectedPopups.length} ads`);

      } catch (error) {
        console.error('PopupDetector: Block ads error:', error);
      }
    }

    /**
     * 検出された広告を許可
     */
    async allowDetectedAds(detectedPopups, reason, userChoice = null) {
      try {
        console.log(`PopupDetector: Allowing ${detectedPopups.length} ads (reason: ${reason})`);

        // バックグラウンドスクリプトに通知（統計目的）
        await this.notifyBackgroundScript(detectedPopups, 'allowed', reason, userChoice);

        console.log(`PopupDetector: Allowed ${detectedPopups.length} ads`);

      } catch (error) {
        console.error('PopupDetector: Allow ads error:', error);
      }
    }

    /**
     * サイト設定を更新
     */
    async updateSiteSettings(domain, action, options) {
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'UPDATE_SITE_SETTINGS',
            data: {
              domain,
              action,
              options,
              timestamp: Date.now()
            }
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.debug('PopupDetector: Site settings update error:', chrome.runtime.lastError.message);
            } else {
              console.debug('PopupDetector: Site settings updated for', domain);
            }
          });
        }
      } catch (error) {
        console.error('PopupDetector: Update site settings error:', error);
      }
    }

    /**
     * ユーザー設定を取得
     */
    async getUserPreferences() {
      try {
        return new Promise((resolve) => {
          if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              type: 'GET_USER_PREFERENCES'
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.debug('PopupDetector: Get preferences error:', chrome.runtime.lastError.message);
                resolve({});
              } else {
                resolve(response?.data || {});
              }
            });
          } else {
            resolve({});
          }
        });
      } catch (error) {
        console.error('PopupDetector: Get user preferences error:', error);
        return {};
      }
    }

    /**
     * バックグラウンドスクリプトに通知
     */
    async notifyBackgroundScript(detectedPopups, action, reason, userChoice = null) {
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          const notificationData = {
            count: detectedPopups.length,
            action, // 'blocked' or 'allowed'
            reason, // 'user-choice', 'auto', 'site-setting', 'error'
            popups: detectedPopups.map(popup => ({
              type: popup.type,
              selector: popup.selector,
              timestamp: popup.timestamp,
              element: {
                tagName: popup.element.tagName,
                id: popup.element.id,
                className: popup.element.className
              }
            })),
            url: window.location.href,
            domain: window.location.hostname,
            timestamp: Date.now(),
            userChoice: userChoice
          };

          chrome.runtime.sendMessage({
            type: 'POPUP_DETECTED',
            data: notificationData
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.debug('PopupDetector: Background notification error:', chrome.runtime.lastError.message);
            } else {
              console.debug('PopupDetector: Background notified:', action, detectedPopups.length, 'popups');
            }
          });
        } else {
          console.debug('PopupDetector: Chrome runtime not available for background notification');
        }
      } catch (error) {
        console.error('PopupDetector: Error notifying background script:', error);
      }
    }

    /**
     * 検出イベントを発火
     */
    dispatchDetectionEvent(popups) {
      try {
        if (popups.length === 0) {
          return;
        }

        const event = new CustomEvent('popupsDetected', {
          detail: {
            popups,
            timestamp: Date.now(),
            detector: this,
            count: popups.length,
            url: window.location.href,
            domain: window.location.hostname
          }
        });

        document.dispatchEvent(event);

        // デバッグログ
        console.log(`PopupDetector: Detection event dispatched - ${popups.length} popups detected`);

        // 初期化完了イベントも発火（通知システムが確実に動作するように）
        if (this.initialized) {
          const initEvent = new CustomEvent('popupDetectorReady', {
            detail: {
              detector: this,
              timestamp: Date.now()
            }
          });
          document.dispatchEvent(initEvent);
        }

      } catch (error) {
        console.error('PopupDetector: Event dispatch error:', error);
      }
    }

    /**
     * 定期チェック
     */
    async periodicCheck() {
      try {
        // 最大検出回数に達した場合は定期チェックを停止
        if (this.detectionCount >= this.options.maxDetectionAttempts) {
          console.log('PopupDetector: Max detection attempts reached, stopping periodic check');
          this.stopPeriodicCheck();
          return;
        }

        // ユーザー選択が進行中の場合はスキップ
        if (this.pendingUserChoices.size > 0) {
          console.log('PopupDetector: User choice pending, skipping periodic check');
          return;
        }

        // 最後の検出から十分な時間が経過している場合のみ実行
        const now = Date.now();
        if (now - this.lastDetectionTime < this.options.detectionInterval) {
          return;
        }

        await this.detectPopups();
        this.detectionCount++;
      } catch (error) {
        console.error('PopupDetector: Periodic check error:', error);
      }
    }

    /**
     * 定期チェックを停止
     */
    stopPeriodicCheck() {
      if (this.periodicCheckInterval) {
        clearInterval(this.periodicCheckInterval);
        this.periodicCheckInterval = null;
        console.log('PopupDetector: Periodic check stopped');
      }
    }

    /**
     * 統計情報を取得
     */
    getStats() {
      try {
        return {
          initialized: this.initialized,
          detectionCount: this.detectionCount,
          historyLength: this.detectionHistory.length,
          lastDetectionTime: this.lastDetectionTime,
          hasObserver: !!this.observer,
          hasUniversalDetector: !!this.universalDetector,
          options: this.options
        };
      } catch (error) {
        console.error('PopupDetector: Stats error:', error);
        return {};
      }
    }

    /**
     * クリーンアップ
     */
    cleanup() {
      try {
        console.log('PopupDetector: Cleaning up...');

        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }

        this.stopPeriodicCheck();

        // 新しい状態をクリア
        this.processedElements.clear();
        this.pendingUserChoices.clear();
        this.lastUserChoiceTime = 0;

        this.detectedPopups.clear();
        this.detectionHistory = [];
        this.initialized = false;

        console.log('PopupDetector: Cleanup complete');

      } catch (error) {
        console.error('PopupDetector: Cleanup error:', error);
      }
    }

    /**
     * 破棄
     */
    destroy() {
      this.cleanup();
    }
  }

  // グローバルエクスポート
  global.PopupDetector = PopupDetector;
  console.log('PopupDetector class exported to global scope');

  // 自動初期化（オプション）
  if (!global.popupDetector) {
    try {
      global.popupDetector = new PopupDetector();
      console.log('PopupDetector instance created automatically');
    } catch (error) {
      console.error('PopupDetector: Failed to create automatic instance:', error);
    }
  } else {
    console.log('PopupDetector instance already exists, skipping auto-creation');
  }

  console.log('PopupDetector class loaded successfully');

})(typeof window !== 'undefined' ? window : this);