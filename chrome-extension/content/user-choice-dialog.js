/**
 * ダイアログ用アクセシビリティヘルパークラス
 */
class DialogAccessibilityHelper {
  constructor() {
    this.keyboardNavigationEnabled = true;
    this.highContrastMode = false;
    this.reducedMotion = false;
  }

  /**
   * 初期化
   */
  init() {
    this.detectUserPreferences();
    this.setupGlobalKeyboardHandlers();
    console.log('DialogAccessibilityHelper: 初期化完了');
  }

  /**
   * ユーザー設定を検出
   */
  detectUserPreferences() {
    // 高コントラストモードの検出
    if (window.matchMedia) {
      const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
      this.highContrastMode = highContrastQuery.matches;
      
      highContrastQuery.addEventListener('change', (e) => {
        this.highContrastMode = e.matches;
        this.applyHighContrastStyles();
      });

      // 動きを減らす設定の検出
      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = reducedMotionQuery.matches;
      
      reducedMotionQuery.addEventListener('change', (e) => {
        this.reducedMotion = e.matches;
        this.applyReducedMotionStyles();
      });
    }

    // 初期スタイルを適用
    this.applyHighContrastStyles();
    this.applyReducedMotionStyles();
  }

  /**
   * グローバルキーボードハンドラーを設定
   */
  setupGlobalKeyboardHandlers() {
    document.addEventListener('keydown', (event) => {
      // Escキーでダイアログを閉じる
      if (event.key === 'Escape') {
        const activeDialog = document.querySelector('.ad-choice-dialog[aria-modal="true"]');
        if (activeDialog) {
          const closeButton = activeDialog.querySelector('.ad-choice-close');
          if (closeButton) {
            closeButton.click();
          }
        }
      }
    });
  }

  /**
   * 高コントラストスタイルを適用
   */
  applyHighContrastStyles() {
    const styleId = 'ad-choice-high-contrast-styles';
    let style = document.getElementById(styleId);
    
    if (this.highContrastMode) {
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .ad-choice-dialog {
            border: 3px solid !important;
            box-shadow: none !important;
          }
          
          .ad-choice-button:focus {
            outline: 3px solid !important;
            outline-offset: 3px !important;
          }
          
          .info-action-btn:focus {
            outline: 3px solid !important;
            outline-offset: 2px !important;
          }
        `;
        document.head.appendChild(style);
      }
    } else {
      if (style) {
        style.remove();
      }
    }
  }

  /**
   * 動きを減らすスタイルを適用
   */
  applyReducedMotionStyles() {
    const styleId = 'ad-choice-reduced-motion-styles';
    let style = document.getElementById(styleId);
    
    if (this.reducedMotion) {
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .ad-choice-dialog {
            animation: none !important;
          }
          
          .ad-choice-button,
          .info-action-btn,
          .continue-button,
          .wait-button {
            transition: none !important;
          }
          
          .basic-info-item {
            transition: none !important;
          }
        `;
        document.head.appendChild(style);
      }
    } else {
      if (style) {
        style.remove();
      }
    }
  }

  /**
   * キーボードナビゲーションの有効/無効を切り替え
   */
  toggleKeyboardNavigation(enabled) {
    this.keyboardNavigationEnabled = enabled;
  }

  /**
   * 破棄
   */
  destroy() {
    const highContrastStyle = document.getElementById('ad-choice-high-contrast-styles');
    const reducedMotionStyle = document.getElementById('ad-choice-reduced-motion-styles');
    
    if (highContrastStyle) highContrastStyle.remove();
    if (reducedMotionStyle) reducedMotionStyle.remove();
  }
}

/**
 * ユーザー選択ダイアログシステム
 * 広告検出時にユーザーにブロックするかどうかの選択を求める
 */
class UserChoiceDialog {
  constructor() {
    this.activeDialogs = new Map();
    this.dialogCounter = 0;
    this.previewGallery = null;
    this.adPreviewCapture = null;
    this.accessibilityHelper = null;
    this.init();
  }

  /**
   * 初期化
   */
  init() {
    this.injectStyles();
    this.initializePreviewComponents();
    this.initializeAccessibility();
    console.log('UserChoiceDialog: 初期化完了');
  }

  /**
   * アクセシビリティ機能を初期化
   */
  initializeAccessibility() {
    try {
      this.accessibilityHelper = new DialogAccessibilityHelper();
      this.accessibilityHelper.init();
      console.log('UserChoiceDialog: アクセシビリティ機能初期化完了');
    } catch (error) {
      console.warn('UserChoiceDialog: アクセシビリティ初期化エラー:', error);
    }
  }

  /**
   * プレビューコンポーネントを初期化
   */
  initializePreviewComponents() {
    try {
      // PreviewGalleryが利用可能な場合のみ初期化
      if (typeof PreviewGallery !== 'undefined') {
        this.previewGallery = new PreviewGallery({
          enableIndividualSelection: true,
          showElementInfo: true,
          debugMode: false,
          onIndividualSelection: this.handlePreviewSelection.bind(this)
        });
      }

      // AdPreviewCaptureが利用可能な場合のみ初期化
      if (typeof AdPreviewCapture !== 'undefined') {
        this.adPreviewCapture = new AdPreviewCapture({
          debugMode: false
        });
      }

      console.log('UserChoiceDialog: プレビューコンポーネント初期化完了', {
        previewGallery: !!this.previewGallery,
        adPreviewCapture: !!this.adPreviewCapture
      });
    } catch (error) {
      console.warn('UserChoiceDialog: プレビューコンポーネント初期化エラー:', error);
    }
  }

  /**
   * スタイルを注入
   */
  injectStyles() {
    if (document.getElementById('user-choice-dialog-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'user-choice-dialog-styles';
    style.textContent = `
      .ad-choice-overlay {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 480px;
        max-width: calc(100vw - 40px);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        pointer-events: none;
      }

      @media (max-width: 600px) {
        .ad-choice-overlay {
          top: 10px;
          right: 10px;
          left: 10px;
          width: auto;
          max-width: none;
        }
        
        .ad-choice-preview-container {
          margin: 8px 0;
        }
        
        .ad-choice-bulk-actions {
          flex-direction: column;
          gap: 6px;
        }
        
        .ad-choice-bulk-button {
          padding: 8px 12px;
        }
      }

      .ad-choice-dialog {
        background: white;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(0, 0, 0, 0.1);
        animation: slideInFromRight 0.3s ease-out;
        pointer-events: auto;
        position: relative;
      }

      @keyframes slideInFromRight {
        from {
          opacity: 0;
          transform: translateX(100%) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }

      .ad-choice-dialog::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #ff6b6b, #ff8e8e);
        border-radius: 12px 12px 0 0;
      }

      .ad-choice-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .ad-choice-header-left {
        display: flex;
        align-items: center;
      }

      .ad-choice-icon {
        width: 24px;
        height: 24px;
        background: #ff6b6b;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 8px;
        color: white;
        font-weight: bold;
        font-size: 14px;
      }

      .ad-choice-title {
        font-size: 16px;
        font-weight: 600;
        color: #333;
        margin: 0;
      }

      .ad-choice-close {
        width: 24px;
        height: 24px;
        border: none;
        background: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
        font-size: 18px;
        border-radius: 4px;
        transition: background-color 0.2s;
      }

      .ad-choice-close:hover {
        background-color: #f0f0f0;
        color: #333;
      }

      .ad-choice-content {
        margin-bottom: 16px;
      }

      .ad-choice-message {
        color: #555;
        line-height: 1.4;
        margin-bottom: 10px;
        font-size: 14px;
      }

      .ad-choice-details {
        background: #f8f9fa;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 12px;
        color: #666;
        margin-bottom: 10px;
      }

      .ad-choice-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 12px;
      }

      .ad-choice-button {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .ad-choice-button-block {
        background: #ff6b6b;
        color: white;
      }

      .ad-choice-button-block:hover {
        background: #ff5252;
      }

      .ad-choice-button-allow {
        background: #e9ecef;
        color: #495057;
      }

      .ad-choice-button-allow:hover {
        background: #dee2e6;
      }

      .ad-choice-button-settings {
        background: #6c757d;
        color: white;
        font-size: 12px;
        padding: 6px 12px;
      }

      .ad-choice-button-settings:hover {
        background: #5a6268;
      }

      .ad-choice-options {
        margin: 12px 0 8px 0;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 6px;
      }

      .ad-choice-checkbox {
        display: flex;
        align-items: center;
        margin-bottom: 6px;
        font-size: 12px;
        color: #666;
      }

      .ad-choice-checkbox:last-child {
        margin-bottom: 0;
      }

      .ad-choice-checkbox input {
        margin-right: 6px;
        transform: scale(0.9);
      }

      .ad-choice-timer {
        font-size: 11px;
        color: #999;
        text-align: center;
        margin-top: 8px;
        padding: 4px 8px;
        background: #f8f9fa;
        border-radius: 4px;
      }

      .ad-choice-preview-container {
        margin: 12px 0;
        border-radius: 8px;
        overflow: hidden;
        background: #f8f9fa;
      }

      .ad-choice-preview-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        color: #666;
        font-size: 13px;
      }

      .ad-choice-preview-loading-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #e0e0e0;
        border-top: 2px solid #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 8px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .ad-choice-preview-error {
        padding: 12px;
        color: #666;
        font-size: 12px;
        text-align: center;
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 6px;
        margin: 8px 0;
      }

      .ad-choice-bulk-actions {
        display: flex;
        gap: 8px;
        margin: 12px 0 8px 0;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 6px;
        border-top: 1px solid #e0e0e0;
      }

      .ad-choice-bulk-button {
        flex: 1;
        padding: 6px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .ad-choice-bulk-button:hover {
        background: #f0f0f0;
      }

      .ad-choice-bulk-button.allow {
        color: #28a745;
        border-color: #28a745;
      }

      .ad-choice-bulk-button.allow:hover {
        background: #28a745;
        color: white;
      }

      .ad-choice-bulk-button.block {
        color: #dc3545;
        border-color: #dc3545;
      }

      .ad-choice-bulk-button.block:hover {
        background: #dc3545;
        color: white;
      }

      .ad-choice-selection-summary {
        display: flex;
        justify-content: space-around;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 6px;
        margin: 8px 0;
        border: 1px solid #e0e0e0;
      }

      .selection-summary-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }

      .summary-label {
        font-size: 11px;
        color: #666;
        font-weight: 500;
      }

      .summary-value {
        font-size: 16px;
        font-weight: bold;
        padding: 2px 8px;
        border-radius: 12px;
        min-width: 24px;
        text-align: center;
      }

      .summary-value.allow {
        color: #28a745;
        background: #d4edda;
      }

      .summary-value.block {
        color: #dc3545;
        background: #f8d7da;
      }

      .summary-value.none {
        color: #6c757d;
        background: #e2e3e5;
      }

      .selection-progress-container {
        margin: 8px 0;
      }

      .selection-progress-bar {
        width: 100%;
        height: 4px;
        background: #e0e0e0;
        border-radius: 2px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #28a745, #20c997);
        width: 0%;
        transition: width 0.3s ease;
      }

      .selection-completion-message {
        display: none;
        padding: 8px 12px;
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
        border-radius: 4px;
        font-size: 12px;
        text-align: center;
        margin: 8px 0;
        animation: fadeInOut 3s ease;
      }

      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(-10px); }
        20% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
      }

      /* 一括操作確認ダイアログ */
      .bulk-action-confirmation {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000000;
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .bulk-action-confirmation.show {
        opacity: 1;
      }

      .bulk-confirmation-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .bulk-confirmation-dialog {
        background: white;
        border-radius: 12px;
        max-width: 480px;
        width: 100%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        transform: scale(0.9) translateY(20px);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .bulk-action-confirmation.show .bulk-confirmation-dialog {
        transform: scale(1) translateY(0);
      }

      .bulk-confirmation-header {
        display: flex;
        align-items: center;
        padding: 20px 20px 16px 20px;
        border-bottom: 1px solid #e0e0e0;
      }

      .bulk-confirmation-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 20px;
        font-weight: bold;
        margin-right: 12px;
      }

      .bulk-confirmation-title {
        font-size: 18px;
        font-weight: 600;
        color: #333;
        margin: 0;
      }

      .bulk-confirmation-content {
        padding: 20px;
      }

      .bulk-confirmation-message {
        font-size: 16px;
        color: #333;
        margin-bottom: 16px;
        line-height: 1.5;
      }

      .bulk-confirmation-details {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
      }

      .confirmation-detail-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 14px;
      }

      .confirmation-detail-item:last-child {
        margin-bottom: 0;
      }

      .detail-label {
        color: #666;
        font-weight: 500;
      }

      .detail-value {
        color: #333;
        font-weight: 600;
      }

      .bulk-confirmation-warning {
        display: flex;
        align-items: flex-start;
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 16px;
      }

      .warning-icon {
        font-size: 16px;
        margin-right: 8px;
        margin-top: 1px;
      }

      .warning-text {
        font-size: 13px;
        color: #856404;
        line-height: 1.4;
      }

      .bulk-confirmation-actions {
        display: flex;
        gap: 12px;
        padding: 16px 20px 20px 20px;
        border-top: 1px solid #e0e0e0;
      }

      .bulk-confirmation-btn {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .bulk-confirmation-btn.cancel {
        background: #e9ecef;
        color: #495057;
      }

      .bulk-confirmation-btn.cancel:hover {
        background: #dee2e6;
      }

      .bulk-confirmation-btn.confirm {
        color: white;
      }

      .bulk-confirmation-btn.confirm:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      /* 一括操作結果表示 */
      .bulk-action-result {
        margin: 12px 0;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease;
      }

      .bulk-action-result.show {
        opacity: 1;
        transform: translateY(0);
      }

      .bulk-result-content {
        display: flex;
        align-items: center;
        background: #d4edda;
        border: 1px solid #c3e6cb;
        border-radius: 8px;
        padding: 12px 16px;
      }

      .bulk-result-content.error {
        background: #f8d7da;
        border-color: #f5c6cb;
      }

      .bulk-result-icon {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 16px;
        font-weight: bold;
        margin-right: 12px;
      }

      .bulk-result-text {
        flex: 1;
      }

      .result-title {
        font-size: 14px;
        font-weight: 600;
        color: #155724;
        margin-bottom: 2px;
      }

      .bulk-result-content.error .result-title {
        color: #721c24;
      }

      .result-details {
        font-size: 12px;
        color: #155724;
        opacity: 0.8;
      }

      .bulk-result-content.error .result-details {
        color: #721c24;
      }

      .error-message {
        font-size: 11px;
        margin-top: 4px;
        padding: 4px 8px;
        background: rgba(114, 28, 36, 0.1);
        border-radius: 4px;
        font-family: monospace;
      }

      .result-time {
        font-size: 11px;
        opacity: 0.7;
        margin-left: 4px;
      }

      /* レスポンシブ対応 */
      @media (max-width: 600px) {
        .bulk-confirmation-dialog {
          margin: 20px;
          max-width: none;
        }

        .bulk-confirmation-header {
          padding: 16px;
        }

        .bulk-confirmation-content {
          padding: 16px;
        }

        .bulk-confirmation-actions {
          padding: 12px 16px 16px 16px;
          flex-direction: column;
        }

        .bulk-confirmation-btn {
          margin-bottom: 8px;
        }

        .bulk-confirmation-btn:last-child {
          margin-bottom: 0;
        }
      }

      /* プレビューなし続行機能のスタイル */
      .continue-without-preview {
        margin: 12px 0 8px 0;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 6px;
        border-top: 1px solid #e0e0e0;
        text-align: center;
      }

      .continue-button, .wait-button {
        margin: 4px;
        padding: 8px 16px;
        border: 1px solid #007bff;
        border-radius: 4px;
        background: white;
        color: #007bff;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .continue-button:hover, .wait-button:hover {
        background: #007bff;
        color: white;
      }

      .continue-button:focus, .wait-button:focus {
        outline: 2px solid #007bff;
        outline-offset: 2px;
      }

      .ad-choice-basic-info {
        margin: 12px 0;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        background: #f8f9fa;
      }

      .basic-info-header {
        padding: 12px 16px 8px 16px;
        border-bottom: 1px solid #e0e0e0;
        background: #ffffff;
        border-radius: 8px 8px 0 0;
      }

      .basic-info-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #333;
      }

      .basic-info-list {
        padding: 8px;
      }

      .basic-info-item {
        display: flex;
        align-items: center;
        padding: 12px;
        margin-bottom: 8px;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        transition: all 0.2s ease;
      }

      .basic-info-item:last-child {
        margin-bottom: 0;
      }

      .basic-info-item:hover {
        border-color: #007bff;
        box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
      }

      .info-icon {
        font-size: 24px;
        margin-right: 12px;
        width: 32px;
        text-align: center;
      }

      .info-details {
        flex: 1;
        margin-right: 12px;
      }

      .info-type {
        font-weight: 600;
        color: #333;
        margin-bottom: 2px;
      }

      .info-size, .info-position {
        font-size: 12px;
        color: #666;
        margin-bottom: 1px;
      }

      .info-actions {
        display: flex;
        gap: 6px;
      }

      .info-action-btn {
        padding: 6px 12px;
        border: 1px solid;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .info-action-btn.allow {
        border-color: #28a745;
        color: #28a745;
        background: white;
      }

      .info-action-btn.allow:hover {
        background: #28a745;
        color: white;
      }

      .info-action-btn.block {
        border-color: #dc3545;
        color: #dc3545;
        background: white;
      }

      .info-action-btn.block:hover {
        background: #dc3545;
        color: white;
      }

      .info-action-btn:focus {
        outline: 2px solid currentColor;
        outline-offset: 2px;
      }

      /* アクセシビリティ強化 */
      .ad-choice-dialog[aria-hidden="false"] {
        display: block;
      }

      .ad-choice-dialog[aria-hidden="true"] {
        display: none;
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .focus-trap {
        outline: none;
      }

      /* 高コントラストモード対応 */
      @media (prefers-contrast: high) {
        .ad-choice-dialog {
          border: 2px solid;
        }
        
        .ad-choice-button:focus {
          outline: 3px solid;
          outline-offset: 2px;
        }
      }

      /* 動きを減らす設定への対応 */
      @media (prefers-reduced-motion: reduce) {
        .ad-choice-dialog {
          animation: none;
        }
        
        .ad-choice-button {
          transition: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * ユーザー選択ダイアログを表示
   */
  async showChoiceDialog(detectedAds) {
    // 既存のダイアログを閉じる（複数表示防止）
    this.closeAllDialogs();
    
    return new Promise((resolve) => {
      const dialogId = `dialog-${++this.dialogCounter}`;
      
      // オーバーレイを作成
      const overlay = document.createElement('div');
      overlay.className = 'ad-choice-overlay';
      overlay.id = dialogId;

      // ダイアログを作成
      const dialog = document.createElement('div');
      dialog.className = 'ad-choice-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', `dialog-title-${dialogId}`);
      dialog.setAttribute('aria-describedby', `dialog-description-${dialogId}`);
      dialog.setAttribute('tabindex', '-1');

      const adCount = detectedAds.length;
      const domain = window.location.hostname;

      // 基本ダイアログ構造を作成
      dialog.innerHTML = `
        <div class="ad-choice-header">
          <div class="ad-choice-header-left">
            <div class="ad-choice-icon" aria-hidden="true">⚠</div>
            <h3 class="ad-choice-title" id="dialog-title-${dialogId}">広告を検出 (${adCount}個)</h3>
          </div>
          <button class="ad-choice-close" data-action="allow" title="閉じる" 
                  aria-label="ダイアログを閉じる">×</button>
        </div>
        
        <div class="ad-choice-content">
          <div class="ad-choice-message" id="dialog-description-${dialogId}">
            検出された広告の詳細を確認してください
          </div>
          
          <div class="ad-choice-details">
            ${domain} • ${detectedAds.map(ad => ad.type).join(', ')}
          </div>
          
          <div class="ad-choice-preview-container" id="preview-container-${dialogId}">
            <div class="ad-choice-preview-loading">
              <div class="ad-choice-preview-loading-spinner"></div>
              プレビューを生成中...
            </div>
          </div>
          
          <div class="ad-choice-selection-summary">
            <div class="selection-summary-item">
              <span class="summary-label">許可</span>
              <span class="summary-value allow">0</span>
            </div>
            <div class="selection-summary-item">
              <span class="summary-label">ブロック</span>
              <span class="summary-value block">0</span>
            </div>
            <div class="selection-summary-item">
              <span class="summary-label">未選択</span>
              <span class="summary-value none">${adCount}</span>
            </div>
          </div>

          <div class="selection-progress-container">
            <div class="selection-progress-bar">
              <div class="progress-fill"></div>
            </div>
          </div>

          <div class="selection-completion-message"></div>

          <div class="ad-choice-options">
            <label class="ad-choice-checkbox">
              <input type="checkbox" id="remember-choice-${dialogId}">
              このサイトで記憶
            </label>
            <label class="ad-choice-checkbox">
              <input type="checkbox" id="auto-block-${dialogId}">
              今後自動ブロック
            </label>
          </div>
        </div>
        
        <div class="ad-choice-actions">
          <button class="ad-choice-button ad-choice-button-settings" data-action="settings"
                  aria-label="設定を開く">
            設定
          </button>
          <button class="ad-choice-button ad-choice-button-allow" data-action="allow"
                  aria-label="すべての広告を許可">
            許可
          </button>
          <button class="ad-choice-button ad-choice-button-block" data-action="block"
                  aria-label="すべての広告をブロック">
            ブロック
          </button>
        </div>
        
        <div class="ad-choice-timer" id="timer-${dialogId}">
          10秒後に自動許可
        </div>
      `;

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // ダイアログを記録
      this.activeDialogs.set(dialogId, {
        overlay,
        resolve,
        detectedAds,
        startTime: Date.now(),
        individualSelections: new Map()
      });

      // イベントリスナーを設定
      this.setupDialogEvents(dialogId);

      // アクセシビリティ機能を設定
      this.setupDialogAccessibility(dialogId);

      // 自動タイマーを開始
      this.startAutoTimer(dialogId);

      // プレビューを非同期で生成
      this.generatePreviews(dialogId, detectedAds);

      console.log(`UserChoiceDialog: ダイアログ表示 (${adCount}個の広告)`);
    });
  }

  /**
   * ダイアログのアクセシビリティ機能を設定
   */
  setupDialogAccessibility(dialogId) {
    const overlay = document.getElementById(dialogId);
    const dialog = overlay.querySelector('.ad-choice-dialog');
    
    if (!dialog) return;

    // フォーカストラップを設定
    this.setupFocusTrap(dialog);

    // 初期フォーカスを設定
    setTimeout(() => {
      const firstFocusable = dialog.querySelector('button, input, [tabindex]:not([tabindex="-1"])');
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        dialog.focus();
      }
    }, 100);

    // スクリーンリーダーに通知
    this.announceToScreenReader(`広告検出ダイアログが開きました。${this.activeDialogs.get(dialogId).detectedAds.length}個の広告が検出されています。`);
  }

  /**
   * フォーカストラップを設定
   */
  setupFocusTrap(dialog) {
    const focusableElements = dialog.querySelectorAll(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const trapFocus = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    };

    dialog.addEventListener('keydown', trapFocus);

    // ダイアログが閉じられる時にイベントリスナーを削除
    const originalClose = this.closeDialog.bind(this);
    this.closeDialog = (dialogId) => {
      dialog.removeEventListener('keydown', trapFocus);
      originalClose(dialogId);
    };
  }

  /**
   * スクリーンリーダーへのアナウンス
   */
  announceToScreenReader(message) {
    if (!this.accessibilityHelper) return;

    // ライブリージョンを作成または取得
    let liveRegion = document.getElementById('ad-choice-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'ad-choice-live-region';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }

    // メッセージを設定
    liveRegion.textContent = message;

    // メッセージをクリア（次のアナウンスのため）
    setTimeout(() => {
      liveRegion.textContent = '';
    }, 1000);
  }

  /**
   * ダイアログのイベントリスナーを設定
   */
  setupDialogEvents(dialogId) {
    const dialogData = this.activeDialogs.get(dialogId);
    if (!dialogData) return;

    const { overlay } = dialogData;

    // ボタンクリックイベント
    overlay.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action) {
        e.preventDefault();
        e.stopPropagation();
        this.handleUserChoice(dialogId, action);
      }
    });

    // オーバーレイクリックでは閉じない（誤操作防止）

    // Escキーで閉じる
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.handleUserChoice(dialogId, 'allow');
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * 自動タイマーを開始
   */
  startAutoTimer(dialogId, duration = 10000) {
    const dialogData = this.activeDialogs.get(dialogId);
    if (!dialogData) return;

    const timerElement = document.getElementById(`timer-${dialogId}`);
    const startTime = Date.now();

    const updateTimer = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      const seconds = Math.ceil(remaining / 1000);

      if (timerElement) {
        timerElement.textContent = `${seconds}秒後に自動許可`;
      }

      if (remaining <= 0) {
        this.handleUserChoice(dialogId, 'allow');
      } else {
        setTimeout(updateTimer, 100);
      }
    };

    updateTimer();
  }

  /**
   * プレビューを生成
   */
  async generatePreviews(dialogId, detectedAds) {
    const dialogData = this.activeDialogs.get(dialogId);
    if (!dialogData) return;

    const previewContainer = document.getElementById(`preview-container-${dialogId}`);
    if (!previewContainer) return;

    // プレビュー生成タイムアウト（5秒）
    const previewTimeout = setTimeout(() => {
      this.showPreviewTimeout(previewContainer, dialogId, detectedAds);
    }, 5000);

    try {
      // AdPreviewCaptureが利用可能でない場合はフォールバック表示
      if (!this.adPreviewCapture) {
        clearTimeout(previewTimeout);
        this.showPreviewFallback(previewContainer, detectedAds, dialogId);
        return;
      }

      // 初期化を待つ
      await this.adPreviewCapture.waitForInit();

      // 広告要素からプレビューデータを生成
      const previewPromises = detectedAds.map(async (ad, index) => {
        try {
          if (ad.element) {
            const previewData = await this.adPreviewCapture.captureElement(ad.element, {
              id: `ad_${index}`,
              type: ad.type
            });
            return previewData;
          } else {
            return this.adPreviewCapture.generateFallbackPreview({
              id: `ad_${index}`,
              type: ad.type,
              ...ad
            });
          }
        } catch (error) {
          console.warn('UserChoiceDialog: プレビュー生成エラー:', error);
          return this.adPreviewCapture.generateFallbackPreview({
            id: `ad_${index}`,
            type: ad.type,
            ...ad
          });
        }
      });

      const previewDataArray = await Promise.all(previewPromises);
      clearTimeout(previewTimeout);

      // プレビューギャラリーを表示
      if (this.previewGallery && previewDataArray.length > 0) {
        previewContainer.innerHTML = '';
        await this.previewGallery.renderPreviews(previewDataArray, previewContainer);
        
        // 一括操作ボタンを追加
        this.addBulkActions(dialogId, previewContainer);
      } else {
        this.showPreviewFallback(previewContainer, detectedAds, dialogId);
      }

    } catch (error) {
      clearTimeout(previewTimeout);
      console.error('UserChoiceDialog: プレビュー生成エラー:', error);
      this.showPreviewError(previewContainer, dialogId);
    }
  }

  /**
   * プレビューフォールバック表示
   */
  showPreviewFallback(container, detectedAds, dialogId) {
    container.innerHTML = `
      <div class="ad-choice-preview-error">
        プレビューを生成できませんでした<br>
        <small>検出された広告: ${detectedAds.map(ad => ad.type).join(', ')}</small>
        <div class="continue-without-preview">
          <button class="continue-button" data-action="continue-without-preview" 
                  aria-label="プレビューなしで選択を続行">
            プレビューなしで続行
          </button>
        </div>
      </div>
    `;
    
    // 続行ボタンのイベントリスナーを追加
    const continueButton = container.querySelector('.continue-button');
    if (continueButton) {
      continueButton.addEventListener('click', () => {
        this.enableContinueWithoutPreview(dialogId);
      });
    }
  }

  /**
   * プレビューエラー表示
   */
  showPreviewError(container, dialogId) {
    container.innerHTML = `
      <div class="ad-choice-preview-error">
        プレビューの生成中にエラーが発生しました
        <div class="continue-without-preview">
          <button class="continue-button" data-action="continue-without-preview"
                  aria-label="プレビューなしで選択を続行">
            プレビューなしで続行
          </button>
        </div>
      </div>
    `;
    
    // 続行ボタンのイベントリスナーを追加
    const continueButton = container.querySelector('.continue-button');
    if (continueButton) {
      continueButton.addEventListener('click', () => {
        this.enableContinueWithoutPreview(dialogId);
      });
    }
  }

  /**
   * プレビュータイムアウト表示
   */
  showPreviewTimeout(container, dialogId, detectedAds) {
    container.innerHTML = `
      <div class="ad-choice-preview-error">
        プレビューの生成に時間がかかっています<br>
        <small>検出された広告: ${detectedAds.map(ad => ad.type).join(', ')}</small>
        <div class="continue-without-preview">
          <button class="continue-button" data-action="continue-without-preview"
                  aria-label="プレビューなしで選択を続行">
            プレビューなしで続行
          </button>
          <button class="wait-button" data-action="wait-for-preview"
                  aria-label="プレビューの完了を待つ">
            もう少し待つ
          </button>
        </div>
      </div>
    `;
    
    // ボタンのイベントリスナーを追加
    const continueButton = container.querySelector('.continue-button');
    const waitButton = container.querySelector('.wait-button');
    
    if (continueButton) {
      continueButton.addEventListener('click', () => {
        this.enableContinueWithoutPreview(dialogId);
      });
    }
    
    if (waitButton) {
      waitButton.addEventListener('click', () => {
        // プレビュー生成を再試行
        this.generatePreviews(dialogId, detectedAds);
      });
    }
  }

  /**
   * プレビューなしでの続行を有効化
   */
  enableContinueWithoutPreview(dialogId) {
    const dialogData = this.activeDialogs.get(dialogId);
    if (!dialogData) return;

    const overlay = document.getElementById(dialogId);
    if (!overlay) return;

    // プレビューコンテナを非表示にし、基本的な選択UIを表示
    const previewContainer = overlay.querySelector('.ad-choice-preview-container');
    if (previewContainer) {
      previewContainer.style.display = 'none';
    }

    // 基本的な広告情報を表示
    const content = overlay.querySelector('.ad-choice-content');
    if (content) {
      const basicInfo = document.createElement('div');
      basicInfo.className = 'ad-choice-basic-info';
      basicInfo.innerHTML = `
        <div class="basic-info-header">
          <h4>検出された広告の詳細:</h4>
        </div>
        <div class="basic-info-list">
          ${dialogData.detectedAds.map((ad, index) => `
            <div class="basic-info-item" data-ad-index="${index}">
              <div class="info-icon">📄</div>
              <div class="info-details">
                <div class="info-type">${ad.type}</div>
                <div class="info-size">${ad.width || '不明'}x${ad.height || '不明'}px</div>
                <div class="info-position">位置: (${ad.x || '不明'}, ${ad.y || '不明'})</div>
              </div>
              <div class="info-actions">
                <button class="info-action-btn allow" data-action="allow" data-ad-index="${index}"
                        aria-label="この広告を許可">許可</button>
                <button class="info-action-btn block" data-action="block" data-ad-index="${index}"
                        aria-label="この広告をブロック">ブロック</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // プレビューコンテナの後に挿入
      previewContainer.parentNode.insertBefore(basicInfo, previewContainer.nextSibling);

      // 個別選択のイベントリスナーを追加
      basicInfo.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const adIndex = parseInt(e.target.dataset.adIndex);
        
        if (action && !isNaN(adIndex)) {
          this.handleIndividualSelection(dialogId, adIndex, action);
        }
      });
    }

    // アクセシビリティ通知
    this.announceToScreenReader('プレビューなしモードが有効になりました。個別に広告を選択できます。');
  }

  /**
   * 一括操作ボタンを追加
   */
  addBulkActions(dialogId, container) {
    const bulkActions = document.createElement('div');
    bulkActions.className = 'ad-choice-bulk-actions';
    bulkActions.innerHTML = `
      <button class="ad-choice-bulk-button allow" data-bulk-action="allow">
        すべて許可
      </button>
      <button class="ad-choice-bulk-button block" data-bulk-action="block">
        すべてブロック
      </button>
    `;

    // イベントリスナーを追加
    bulkActions.addEventListener('click', (e) => {
      const bulkAction = e.target.dataset.bulkAction;
      if (bulkAction) {
        this.handleBulkAction(dialogId, bulkAction);
      }
    });

    container.appendChild(bulkActions);
  }

  /**
   * 一括操作を処理
   */
  handleBulkAction(dialogId, action) {
    const dialogData = this.activeDialogs.get(dialogId);
    if (!dialogData) return;

    // 確認ダイアログを表示
    this.showBulkActionConfirmation(dialogId, action);
  }

  /**
   * 一括操作の確認ダイアログを表示
   */
  showBulkActionConfirmation(dialogId, action) {
    const dialogData = this.activeDialogs.get(dialogId);
    if (!dialogData) return;

    const overlay = document.getElementById(dialogId);
    if (!overlay) return;

    // 既存の確認ダイアログがあれば削除
    const existingConfirmation = overlay.querySelector('.bulk-action-confirmation');
    if (existingConfirmation) {
      existingConfirmation.remove();
    }

    // 確認ダイアログを作成
    const confirmation = document.createElement('div');
    confirmation.className = 'bulk-action-confirmation';
    
    const adCount = dialogData.detectedAds.length;
    const actionText = action === 'allow' ? '許可' : 'ブロック';
    const actionColor = action === 'allow' ? '#28a745' : '#dc3545';

    confirmation.innerHTML = `
      <div class="bulk-confirmation-overlay">
        <div class="bulk-confirmation-dialog">
          <div class="bulk-confirmation-header">
            <div class="bulk-confirmation-icon" style="background: ${actionColor};">
              ${action === 'allow' ? '✓' : '✕'}
            </div>
            <h3 class="bulk-confirmation-title">一括${actionText}の確認</h3>
          </div>
          
          <div class="bulk-confirmation-content">
            <p class="bulk-confirmation-message">
              検出された<strong>${adCount}個すべての広告</strong>を<strong>${actionText}</strong>しますか？
            </p>
            
            <div class="bulk-confirmation-details">
              <div class="confirmation-detail-item">
                <span class="detail-label">対象:</span>
                <span class="detail-value">${adCount}個の広告</span>
              </div>
              <div class="confirmation-detail-item">
                <span class="detail-label">アクション:</span>
                <span class="detail-value" style="color: ${actionColor}; font-weight: bold;">${actionText}</span>
              </div>
            </div>
            
            <div class="bulk-confirmation-warning">
              <div class="warning-icon">⚠️</div>
              <div class="warning-text">
                この操作は元に戻すことができます。個別に変更したい場合は、後から各広告の設定を変更できます。
              </div>
            </div>
          </div>
          
          <div class="bulk-confirmation-actions">
            <button class="bulk-confirmation-btn cancel">キャンセル</button>
            <button class="bulk-confirmation-btn confirm" style="background: ${actionColor};">
              ${actionText}を実行
            </button>
          </div>
        </div>
      </div>
    `;

    // イベントリスナーを追加
    const cancelBtn = confirmation.querySelector('.bulk-confirmation-btn.cancel');
    const confirmBtn = confirmation.querySelector('.bulk-confirmation-btn.confirm');

    cancelBtn.addEventListener('click', () => {
      this.closeBulkActionConfirmation(dialogId);
    });

    confirmBtn.addEventListener('click', () => {
      this.executeBulkAction(dialogId, action);
      this.closeBulkActionConfirmation(dialogId);
    });

    // ESCキーで閉じる
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeBulkActionConfirmation(dialogId);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // オーバーレイクリックで閉じる
    const overlayClickHandler = (e) => {
      if (e.target.classList.contains('bulk-confirmation-overlay')) {
        this.closeBulkActionConfirmation(dialogId);
      }
    };
    confirmation.addEventListener('click', overlayClickHandler);

    // ダイアログに追加
    overlay.appendChild(confirmation);

    // アニメーション付きで表示
    requestAnimationFrame(() => {
      confirmation.classList.add('show');
    });

    console.log(`UserChoiceDialog: 一括操作確認ダイアログ表示 - ${action}`);
  }

  /**
   * 一括操作確認ダイアログを閉じる
   */
  closeBulkActionConfirmation(dialogId) {
    const overlay = document.getElementById(dialogId);
    if (!overlay) return;

    const confirmation = overlay.querySelector('.bulk-action-confirmation');
    if (confirmation) {
      confirmation.classList.remove('show');
      setTimeout(() => {
        if (confirmation.parentNode) {
          confirmation.remove();
        }
      }, 300);
    }
  }

  /**
   * 一括操作を実行
   */
  executeBulkAction(dialogId, action) {
    const dialogData = this.activeDialogs.get(dialogId);
    if (!dialogData) return;

    const startTime = Date.now();
    let processedCount = 0;

    try {
      // PreviewGalleryの一括選択機能を使用
      if (this.previewGallery && this.previewGallery.previewData) {
        // 処理前の状態を記録
        const previousStates = new Map();
        for (const [previewId] of this.previewGallery.previewData) {
          previousStates.set(previewId, this.previewGallery.getPreviewState(previewId));
        }

        // 一括選択を実行
        this.previewGallery.selectAll(action);

        // 個別選択状態を更新
        for (const [previewId] of this.previewGallery.previewData) {
          dialogData.individualSelections.set(previewId, action);
          processedCount++;

          // 個別選択イベントハンドラーを呼び出し（統計更新のため）
          const previewData = this.previewGallery.getPreviewData(previewId);
          const previousState = previousStates.get(previewId);
          
          if (previewData && this.previewGallery.eventHandlers.onIndividualSelection) {
            this.previewGallery.eventHandlers.onIndividualSelection(previewData, action, previousState);
          }
        }

        // 統計を更新
        this.previewGallery.updateSelectionStats();
      }

      const processingTime = Date.now() - startTime;

      // 結果を表示
      this.showBulkActionResult(dialogId, action, processedCount, processingTime);

      console.log(`UserChoiceDialog: 一括操作実行完了 - ${action}, ${processedCount}個処理, ${processingTime}ms`);

    } catch (error) {
      console.error('UserChoiceDialog: 一括操作実行エラー:', error);
      
      // エラー時の結果表示
      this.showBulkActionError(dialogId, action, error.message);
    }
  }

  /**
   * 一括操作の結果を表示
   */
  showBulkActionResult(dialogId, action, processedCount, processingTime) {
    const overlay = document.getElementById(dialogId);
    if (!overlay) return;

    // 既存の結果表示があれば削除
    const existingResult = overlay.querySelector('.bulk-action-result');
    if (existingResult) {
      existingResult.remove();
    }

    // 結果表示を作成
    const result = document.createElement('div');
    result.className = 'bulk-action-result';
    
    const actionText = action === 'allow' ? '許可' : 'ブロック';
    const actionColor = action === 'allow' ? '#28a745' : '#dc3545';

    result.innerHTML = `
      <div class="bulk-result-content">
        <div class="bulk-result-icon" style="background: ${actionColor};">
          ${action === 'allow' ? '✓' : '✕'}
        </div>
        <div class="bulk-result-text">
          <div class="result-title">一括${actionText}完了</div>
          <div class="result-details">
            ${processedCount}個の広告を${actionText}しました
            <span class="result-time">(${processingTime}ms)</span>
          </div>
        </div>
      </div>
    `;

    // 適切な位置に挿入（プレビューコンテナの後）
    const previewContainer = overlay.querySelector('.ad-choice-preview-container');
    if (previewContainer && previewContainer.nextSibling) {
      overlay.insertBefore(result, previewContainer.nextSibling);
    } else {
      const content = overlay.querySelector('.ad-choice-content');
      if (content) {
        content.appendChild(result);
      }
    }

    // アニメーション付きで表示
    requestAnimationFrame(() => {
      result.classList.add('show');
    });

    // 3秒後に自動で非表示
    setTimeout(() => {
      if (result.parentNode) {
        result.classList.remove('show');
        setTimeout(() => {
          if (result.parentNode) {
            result.remove();
          }
        }, 300);
      }
    }, 3000);
  }

  /**
   * 一括操作のエラーを表示
   */
  showBulkActionError(dialogId, action, errorMessage) {
    const overlay = document.getElementById(dialogId);
    if (!overlay) return;

    // 既存の結果表示があれば削除
    const existingResult = overlay.querySelector('.bulk-action-result');
    if (existingResult) {
      existingResult.remove();
    }

    // エラー表示を作成
    const result = document.createElement('div');
    result.className = 'bulk-action-result error';
    
    const actionText = action === 'allow' ? '許可' : 'ブロック';

    result.innerHTML = `
      <div class="bulk-result-content error">
        <div class="bulk-result-icon" style="background: #dc3545;">
          ✕
        </div>
        <div class="bulk-result-text">
          <div class="result-title">一括${actionText}エラー</div>
          <div class="result-details">
            操作中にエラーが発生しました
            <div class="error-message">${errorMessage}</div>
          </div>
        </div>
      </div>
    `;

    // 適切な位置に挿入
    const previewContainer = overlay.querySelector('.ad-choice-preview-container');
    if (previewContainer && previewContainer.nextSibling) {
      overlay.insertBefore(result, previewContainer.nextSibling);
    } else {
      const content = overlay.querySelector('.ad-choice-content');
      if (content) {
        content.appendChild(result);
      }
    }

    // アニメーション付きで表示
    requestAnimationFrame(() => {
      result.classList.add('show');
    });

    // 5秒後に自動で非表示
    setTimeout(() => {
      if (result.parentNode) {
        result.classList.remove('show');
        setTimeout(() => {
          if (result.parentNode) {
            result.remove();
          }
        }, 300);
      }
    }, 5000);
  }

  /**
   * プレビュー個別選択を処理
   */
  handlePreviewSelection(previewData, newState, previousState) {
    // 現在アクティブなダイアログを見つける
    for (const [dialogId, dialogData] of this.activeDialogs) {
      if (dialogData.individualSelections) {
        // 選択状態を更新
        if (newState === 'none') {
          dialogData.individualSelections.delete(previewData.id);
        } else {
          dialogData.individualSelections.set(previewData.id, newState);
        }

        // 選択状態の統計を更新
        this.updateDialogSelectionStats(dialogId);

        console.log(`UserChoiceDialog: 個別選択更新 - ${previewData.id}: ${previousState} → ${newState}`);
        
        // 選択完了の確認
        this.checkSelectionCompletion(dialogId);
        break;
      }
    }
  }

  /**
   * ユーザーの選択を処理
   */
  async handleUserChoice(dialogId, action) {
    const dialogData = this.activeDialogs.get(dialogId);
    if (!dialogData) return;

    const { overlay, resolve, detectedAds, individualSelections } = dialogData;

    // チェックボックスの状態を取得
    const rememberChoice = document.getElementById(`remember-choice-${dialogId}`)?.checked || false;
    const autoBlock = document.getElementById(`auto-block-${dialogId}`)?.checked || false;

    // 個別選択がある場合は、それを優先
    let finalAction = action;
    let individualChoices = null;
    
    if (individualSelections && individualSelections.size > 0) {
      individualChoices = Object.fromEntries(individualSelections);
      
      // 個別選択がある場合は、全体のアクションを'individual'に設定
      if (Object.values(individualChoices).some(choice => choice !== 'none')) {
        finalAction = 'individual';
      }
    }

    // 選択結果を作成
    const result = {
      action: finalAction,
      detectedAds,
      individualChoices,
      options: {
        rememberChoice,
        autoBlock
      },
      timestamp: Date.now(),
      responseTime: Date.now() - dialogData.startTime
    };

    // 設定アクションの場合
    if (action === 'settings') {
      this.openSettings();
      // 設定を開いた後はダイアログを閉じずに待機
      return;
    }

    // ダイアログを削除
    this.removeDialog(dialogId);

    // 選択を記録
    await this.recordUserChoice(result);

    // 結果を返す
    resolve(result);

    console.log('UserChoiceDialog: ユーザー選択完了', result);
  }

  /**
   * ダイアログを削除
   */
  removeDialog(dialogId) {
    const dialogData = this.activeDialogs.get(dialogId);
    if (dialogData) {
      const { overlay } = dialogData;
      if (overlay && overlay.parentNode) {
        overlay.remove();
      }
      this.activeDialogs.delete(dialogId);
    }
  }

  /**
   * ユーザーの選択を記録
   */
  async recordUserChoice(result) {
    try {
      // バックグラウンドスクリプトに選択を送信
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'USER_CHOICE_RECORDED',
          data: result
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.debug('UserChoiceDialog: 選択記録エラー:', chrome.runtime.lastError.message);
          } else {
            console.debug('UserChoiceDialog: 選択記録完了');
          }
        });
      }

      // ローカルストレージにも保存
      const choices = JSON.parse(localStorage.getItem('adBlockChoices') || '[]');
      choices.push({
        ...result,
        domain: window.location.hostname,
        url: window.location.href
      });

      // 最新の100件のみ保持
      if (choices.length > 100) {
        choices.splice(0, choices.length - 100);
      }

      localStorage.setItem('adBlockChoices', JSON.stringify(choices));

    } catch (error) {
      console.error('UserChoiceDialog: 選択記録エラー:', error);
    }
  }

  /**
   * 設定を開く
   */
  openSettings() {
    try {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'OPEN_SETTINGS'
        });
      }
    } catch (error) {
      console.error('UserChoiceDialog: 設定オープンエラー:', error);
    }
  }

  /**
   * ダイアログを閉じる
   */
  closeDialog(dialogId) {
    const dialogData = this.activeDialogs.get(dialogId);
    if (!dialogData) return;

    const { overlay } = dialogData;
    
    // アクセシビリティクリーンアップ
    const liveRegion = document.getElementById('ad-choice-live-region');
    if (liveRegion) {
      liveRegion.remove();
    }

    // ダイアログを削除
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    // データを削除
    this.activeDialogs.delete(dialogId);

    console.log(`UserChoiceDialog: ダイアログ閉鎖 - ${dialogId}`);
  }

  /**
   * ダイアログを削除（closeDialogのエイリアス）
   */
  removeDialog(dialogId) {
    this.closeDialog(dialogId);
  }

  /**
   * 全てのダイアログを閉じる
   */
  closeAllDialogs() {
    const dialogIds = Array.from(this.activeDialogs.keys());
    dialogIds.forEach(dialogId => {
      this.closeDialog(dialogId);
    });
  }

  /**
   * ダイアログの選択状態統計を更新
   */
  updateDialogSelectionStats(dialogId) {
    const dialogData = this.activeDialogs.get(dialogId);
    if (!dialogData) return;

    const overlay = document.getElementById(dialogId);
    if (!overlay) return;

    const statsElement = overlay.querySelector('.ad-choice-selection-summary');
    if (!statsElement) return;

    const stats = {
      total: dialogData.detectedAds.length,
      allowed: 0,
      blocked: 0,
      none: 0
    };

    // 個別選択の統計を計算
    dialogData.detectedAds.forEach((ad, index) => {
      const previewId = `ad_${index}`;
      const state = dialogData.individualSelections.get(previewId) || 'none';
      
      if (state === 'allow') stats.allowed++;
      else if (state === 'block') stats.blocked++;
      else stats.none++;
    });

    // 統計表示を更新
    statsElement.innerHTML = `
      <div class="selection-summary-item">
        <span class="summary-label">許可:</span>
        <span class="summary-value allow">${stats.allowed}</span>
      </div>
      <div class="selection-summary-item">
        <span class="summary-label">ブロック:</span>
        <span class="summary-value block">${stats.blocked}</span>
      </div>
      <div class="selection-summary-item">
        <span class="summary-label">未選択:</span>
        <span class="summary-value none">${stats.none}</span>
      </div>
    `;

    // 進捗バーを更新
    const progressBar = overlay.querySelector('.selection-progress-bar');
    if (progressBar) {
      const selectedCount = stats.allowed + stats.blocked;
      const progress = (selectedCount / stats.total) * 100;
      
      const progressFill = progressBar.querySelector('.progress-fill');
      if (progressFill) {
        progressFill.style.width = `${progress}%`;
      }
    }
  }

  /**
   * 選択完了の確認
   */
  checkSelectionCompletion(dialogId) {
    const dialogData = this.activeDialogs.get(dialogId);
    if (!dialogData) return;

    const totalAds = dialogData.detectedAds.length;
    const selectedCount = dialogData.individualSelections.size;

    // 全て選択された場合の処理
    if (selectedCount === totalAds) {
      const overlay = document.getElementById(dialogId);
      if (overlay) {
        const completionMessage = overlay.querySelector('.selection-completion-message');
        if (completionMessage) {
          completionMessage.style.display = 'block';
          completionMessage.textContent = '全ての広告の選択が完了しました';
          
          // 3秒後に非表示
          setTimeout(() => {
            completionMessage.style.display = 'none';
          }, 3000);
        }
      }
    }
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    this.closeAllDialogs();
    
    // プレビューコンポーネントのクリーンアップ
    if (this.previewGallery) {
      this.previewGallery.cleanup();
    }
    
    if (this.adPreviewCapture) {
      this.adPreviewCapture.cleanup();
    }
    
    const styles = document.getElementById('user-choice-dialog-styles');
    if (styles) {
      styles.remove();
    }
  }
}

// グローバルインスタンス
window.userChoiceDialog = new UserChoiceDialog();

console.log('UserChoiceDialog: システム初期化完了');

// グローバルに利用可能にする
if (typeof window !== 'undefined') {
  window.UserChoiceDialog = UserChoiceDialog;
  window.DialogAccessibilityHelper = DialogAccessibilityHelper;
}