/**
 * ユーザーフィードバックシステム
 * エラー報告と回復提案のユーザーフレンドリーなインターフェース
 */

/**
 * ユーザーフィードバックシステムクラス
 */
class UserFeedbackSystem {
  constructor(logger, errorHandler) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.feedbackQueue = [];
    this.activeNotifications = new Map();
    this.userPreferences = {
      showNotifications: true,
      notificationDuration: 5000,
      autoHideSuccess: true,
      showTechnicalDetails: false
    };
    
    this.initializeFeedbackSystem();
    this.loadUserPreferences();
  }

  /**
   * フィードバックシステムの初期化
   */
  initializeFeedbackSystem() {
    // 通知スタイルを追加
    this.injectNotificationStyles();
    
    // 通知コンテナを作成
    this.createNotificationContainer();
    
    // エラーハンドラーとの連携を設定
    this.setupErrorHandlerIntegration();
  }

  /**
   * 通知スタイルを注入
   */
  injectNotificationStyles() {
    const styleId = 'popup-blocker-feedback-styles';
    if (document.getElementById(styleId)) return;

    const styles = `
      .popup-blocker-notification-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        pointer-events: none;
      }

      .popup-blocker-notification {
        background: #ffffff;
        border: 1px solid #e1e5e9;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        margin-bottom: 12px;
        max-width: 400px;
        min-width: 300px;
        opacity: 0;
        pointer-events: auto;
        transform: translateX(100%);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .popup-blocker-notification.show {
        opacity: 1;
        transform: translateX(0);
      }

      .popup-blocker-notification.success {
        border-left: 4px solid #28a745;
      }

      .popup-blocker-notification.warning {
        border-left: 4px solid #ffc107;
      }

      .popup-blocker-notification.error {
        border-left: 4px solid #dc3545;
      }

      .popup-blocker-notification.info {
        border-left: 4px solid #007bff;
      }

      .popup-blocker-notification-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px 8px;
        border-bottom: 1px solid #f1f3f4;
      }

      .popup-blocker-notification-title {
        display: flex;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
        color: #202124;
      }

      .popup-blocker-notification-icon {
        margin-right: 8px;
        font-size: 16px;
      }

      .popup-blocker-notification-close {
        background: none;
        border: none;
        color: #5f6368;
        cursor: pointer;
        font-size: 18px;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s;
      }

      .popup-blocker-notification-close:hover {
        background-color: #f1f3f4;
      }

      .popup-blocker-notification-body {
        padding: 8px 16px 12px;
      }

      .popup-blocker-notification-message {
        color: #3c4043;
        font-size: 13px;
        line-height: 1.4;
        margin-bottom: 8px;
      }

      .popup-blocker-notification-details {
        background: #f8f9fa;
        border-radius: 4px;
        color: #5f6368;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        margin-top: 8px;
        padding: 8px;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .popup-blocker-notification-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .popup-blocker-notification-button {
        background: #1a73e8;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 12px;
        padding: 6px 12px;
        transition: background-color 0.2s;
      }

      .popup-blocker-notification-button:hover {
        background: #1557b0;
      }

      .popup-blocker-notification-button.secondary {
        background: #f8f9fa;
        border: 1px solid #dadce0;
        color: #3c4043;
      }

      .popup-blocker-notification-button.secondary:hover {
        background: #f1f3f4;
      }

      .popup-blocker-notification-progress {
        background: #e8f0fe;
        border-radius: 2px;
        height: 4px;
        margin-top: 8px;
        overflow: hidden;
      }

      .popup-blocker-notification-progress-bar {
        background: #1a73e8;
        height: 100%;
        transition: width 0.1s linear;
        width: 100%;
      }

      .popup-blocker-notification-toggle {
        color: #1a73e8;
        cursor: pointer;
        font-size: 12px;
        text-decoration: underline;
        margin-top: 4px;
      }

      .popup-blocker-notification-toggle:hover {
        color: #1557b0;
      }

      @media (max-width: 480px) {
        .popup-blocker-notification-container {
          left: 20px;
          right: 20px;
          top: 20px;
        }

        .popup-blocker-notification {
          max-width: none;
          min-width: auto;
        }
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  /**
   * 通知コンテナを作成
   */
  createNotificationContainer() {
    const containerId = 'popup-blocker-notification-container';
    if (document.getElementById(containerId)) return;

    const container = document.createElement('div');
    container.id = containerId;
    container.className = 'popup-blocker-notification-container';
    document.body.appendChild(container);
  }

  /**
   * エラーハンドラーとの連携を設定
   */
  setupErrorHandlerIntegration() {
    // エラーハンドラーからの通知を受信
    if (typeof window !== 'undefined') {
      window.addEventListener('popup-blocker-error', (event) => {
        this.handleError(event.detail);
      });

      window.addEventListener('popup-blocker-success', (event) => {
        this.showSuccess(event.detail.message, event.detail.details);
      });

      window.addEventListener('popup-blocker-warning', (event) => {
        this.showWarning(event.detail.message, event.detail.details);
      });
    }
  }

  /**
   * ユーザー設定を読み込み
   */
  async loadUserPreferences() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(['userFeedbackPreferences'], resolve);
        });

        if (result.userFeedbackPreferences) {
          this.userPreferences = { ...this.userPreferences, ...result.userFeedbackPreferences };
        }
      }
    } catch (error) {
      this.logger.warn('USER_FEEDBACK', 'ユーザー設定の読み込みに失敗', { error: error.message });
    }
  }

  /**
   * ユーザー設定を保存
   */
  async saveUserPreferences() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ userFeedbackPreferences: this.userPreferences }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }
    } catch (error) {
      this.logger.warn('USER_FEEDBACK', 'ユーザー設定の保存に失敗', { error: error.message });
    }
  }

  /**
   * エラーを処理
   */
  handleError(errorData) {
    const { message, technicalDetails, recoveryActions, severity } = errorData;
    
    // ユーザーフレンドリーなメッセージを生成
    const userMessage = this.generateUserFriendlyMessage(message, severity);
    
    // 回復アクションボタンを作成
    const actions = this.createRecoveryActions(recoveryActions);
    
    this.showNotification({
      type: severity === 'critical' ? 'error' : 'warning',
      title: severity === 'critical' ? '重要なエラー' : '問題が発生しました',
      message: userMessage,
      technicalDetails,
      actions,
      persistent: severity === 'critical',
      showTechnicalToggle: true
    });
  }

  /**
   * 成功メッセージを表示
   */
  showSuccess(message, details = null) {
    if (!this.userPreferences.showNotifications) return;

    this.showNotification({
      type: 'success',
      title: '成功',
      message,
      technicalDetails: details,
      autoHide: this.userPreferences.autoHideSuccess,
      duration: 3000
    });
  }

  /**
   * 警告メッセージを表示
   */
  showWarning(message, details = null) {
    if (!this.userPreferences.showNotifications) return;

    this.showNotification({
      type: 'warning',
      title: '注意',
      message,
      technicalDetails: details,
      duration: this.userPreferences.notificationDuration
    });
  }

  /**
   * 情報メッセージを表示
   */
  showInfo(message, details = null) {
    if (!this.userPreferences.showNotifications) return;

    this.showNotification({
      type: 'info',
      title: '情報',
      message,
      technicalDetails: details,
      duration: this.userPreferences.notificationDuration
    });
  }

  /**
   * 通知を表示
   */
  showNotification(options) {
    const {
      type = 'info',
      title,
      message,
      technicalDetails = null,
      actions = [],
      persistent = false,
      autoHide = true,
      duration = this.userPreferences.notificationDuration,
      showTechnicalToggle = false
    } = options;

    const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const container = document.getElementById('popup-blocker-notification-container');
    
    if (!container) {
      this.createNotificationContainer();
      return this.showNotification(options);
    }

    // 通知要素を作成
    const notification = this.createNotificationElement({
      id: notificationId,
      type,
      title,
      message,
      technicalDetails,
      actions,
      showTechnicalToggle
    });

    // コンテナに追加
    container.appendChild(notification);

    // アニメーション表示
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // アクティブ通知として記録
    this.activeNotifications.set(notificationId, {
      element: notification,
      type,
      timestamp: Date.now(),
      persistent
    });

    // 自動非表示の設定
    if (!persistent && autoHide && duration > 0) {
      setTimeout(() => {
        this.hideNotification(notificationId);
      }, duration);
    }

    // ログに記録
    this.logger.info('USER_FEEDBACK', '通知を表示', {
      type,
      title,
      message,
      persistent,
      duration
    });

    return notificationId;
  }

  /**
   * 通知要素を作成
   */
  createNotificationElement(options) {
    const { id, type, title, message, technicalDetails, actions, showTechnicalToggle } = options;
    
    const notification = document.createElement('div');
    notification.id = id;
    notification.className = `popup-blocker-notification ${type}`;

    const iconMap = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    };

    notification.innerHTML = `
      <div class="popup-blocker-notification-header">
        <div class="popup-blocker-notification-title">
          <span class="popup-blocker-notification-icon">${iconMap[type] || 'ℹ️'}</span>
          ${title}
        </div>
        <button class="popup-blocker-notification-close" onclick="window.userFeedbackSystem?.hideNotification('${id}')">
          ×
        </button>
      </div>
      <div class="popup-blocker-notification-body">
        <div class="popup-blocker-notification-message">${message}</div>
        
        ${showTechnicalToggle && technicalDetails ? `
          <div class="popup-blocker-notification-toggle" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
            技術的な詳細を表示
          </div>
          <div class="popup-blocker-notification-details" style="display: none;">${technicalDetails}</div>
        ` : ''}
        
        ${!showTechnicalToggle && technicalDetails ? `
          <div class="popup-blocker-notification-details">${technicalDetails}</div>
        ` : ''}
        
        ${actions.length > 0 ? `
          <div class="popup-blocker-notification-actions">
            ${actions.map(action => `
              <button class="popup-blocker-notification-button ${action.secondary ? 'secondary' : ''}" 
                      onclick="${action.onclick}">
                ${action.label}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    return notification;
  }

  /**
   * 通知を非表示
   */
  hideNotification(notificationId) {
    const notificationData = this.activeNotifications.get(notificationId);
    if (!notificationData) return;

    const { element } = notificationData;
    
    // アニメーション非表示
    element.classList.remove('show');
    
    // DOM から削除
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.activeNotifications.delete(notificationId);
    }, 300);

    this.logger.debug('USER_FEEDBACK', '通知を非表示', { notificationId });
  }

  /**
   * すべての通知を非表示
   */
  hideAllNotifications() {
    for (const notificationId of this.activeNotifications.keys()) {
      this.hideNotification(notificationId);
    }
  }

  /**
   * ユーザーフレンドリーなメッセージを生成
   */
  generateUserFriendlyMessage(technicalMessage, severity = 'medium') {
    const messageMap = {
      // DOM関連エラー
      'dom access': 'ウェブページの内容にアクセスできませんでした。ページを再読み込みしてみてください。',
      'dom manipulation': 'ページの要素を操作できませんでした。ページの構造が変更された可能性があります。',
      'element not found': '対象の要素が見つかりませんでした。ページが完全に読み込まれていない可能性があります。',
      
      // 通信関連エラー
      'communication failed': '拡張機能の内部通信に問題が発生しました。拡張機能を再起動してみてください。',
      'message timeout': '処理に時間がかかりすぎています。しばらく待ってから再試行してください。',
      'connection lost': '接続が失われました。ネットワーク接続を確認してください。',
      
      // 権限関連エラー
      'permission denied': '必要な権限が不足しています。拡張機能の設定を確認してください。',
      'access restricted': 'このページでは一部の機能が制限されています。',
      
      // ストレージ関連エラー
      'storage full': 'ストレージの容量が不足しています。不要なデータを削除してください。',
      'storage error': 'データの保存に失敗しました。ブラウザを再起動してみてください。',
      
      // ポップアップ検出関連
      'popup detection failed': 'ポップアップの検出に失敗しました。ページの構造が複雑な可能性があります。',
      'analysis timeout': 'ポップアップの分析に時間がかかりすぎています。',
      
      // パフォーマンス関連
      'performance degraded': 'パフォーマンスが低下しています。他のタブを閉じることを検討してください。',
      'memory limit': 'メモリ使用量が多くなっています。ブラウザを再起動することをお勧めします。'
    };

    // 部分マッチングでメッセージを検索
    const lowerMessage = technicalMessage.toLowerCase();
    for (const [key, friendlyMessage] of Object.entries(messageMap)) {
      if (lowerMessage.includes(key)) {
        return friendlyMessage;
      }
    }

    // デフォルトメッセージ
    switch (severity) {
      case 'critical':
        return '重要な問題が発生しました。拡張機能を再起動するか、ページを再読み込みしてください。';
      case 'high':
        return '問題が発生しました。しばらく待ってから再試行してください。';
      case 'medium':
        return '軽微な問題が発生しましたが、機能は継続して利用できます。';
      default:
        return '予期しない問題が発生しました。問題が続く場合は、拡張機能を再起動してください。';
    }
  }

  /**
   * 回復アクションを作成
   */
  createRecoveryActions(recoveryActions = []) {
    const actions = [];

    for (const action of recoveryActions) {
      switch (action.action) {
        case 'reload_page':
          actions.push({
            label: 'ページを再読み込み',
            onclick: `window.location.reload()`,
            secondary: false
          });
          break;

        case 'restart_extension':
          actions.push({
            label: '拡張機能を再起動',
            onclick: `window.userFeedbackSystem?.restartExtension()`,
            secondary: false
          });
          break;

        case 'check_permissions':
          actions.push({
            label: '権限を確認',
            onclick: `window.userFeedbackSystem?.checkPermissions()`,
            secondary: true
          });
          break;

        case 'clear_storage':
          actions.push({
            label: 'データをクリア',
            onclick: `window.userFeedbackSystem?.clearStorage()`,
            secondary: true
          });
          break;

        case 'report_issue':
          actions.push({
            label: '問題を報告',
            onclick: `window.userFeedbackSystem?.reportIssue()`,
            secondary: true
          });
          break;

        case 'general_troubleshooting':
          actions.push({
            label: 'トラブルシューティング',
            onclick: `window.userFeedbackSystem?.showTroubleshooting()`,
            secondary: true
          });
          break;
      }
    }

    // 常に「閉じる」アクションを追加
    actions.push({
      label: '閉じる',
      onclick: `window.userFeedbackSystem?.hideNotification('${Date.now()}')`,
      secondary: true
    });

    return actions;
  }

  /**
   * 拡張機能を再起動
   */
  async restartExtension() {
    try {
      this.showInfo('拡張機能を再起動しています...');
      
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.reload();
      } else {
        // フォールバック: ページリロード
        window.location.reload();
      }
    } catch (error) {
      this.showWarning('拡張機能の再起動に失敗しました。ページを再読み込みしてください。');
    }
  }

  /**
   * 権限を確認
   */
  async checkPermissions() {
    try {
      if (typeof chrome !== 'undefined' && chrome.permissions) {
        const requiredPermissions = ['activeTab', 'storage', 'notifications'];
        const missingPermissions = [];

        for (const permission of requiredPermissions) {
          const hasPermission = await new Promise(resolve => {
            chrome.permissions.contains({ permissions: [permission] }, resolve);
          });
          
          if (!hasPermission) {
            missingPermissions.push(permission);
          }
        }

        if (missingPermissions.length === 0) {
          this.showSuccess('すべての必要な権限が付与されています。');
        } else {
          this.showWarning(`不足している権限: ${missingPermissions.join(', ')}`);
        }
      } else {
        this.showWarning('権限APIが利用できません。');
      }
    } catch (error) {
      this.showWarning('権限の確認に失敗しました。');
    }
  }

  /**
   * ストレージをクリア
   */
  async clearStorage() {
    try {
      const confirmed = confirm('拡張機能のデータをすべてクリアしますか？この操作は元に戻せません。');
      if (!confirmed) return;

      if (typeof chrome !== 'undefined' && chrome.storage) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.clear(() => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });

        this.showSuccess('データをクリアしました。ページを再読み込みしてください。');
        
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        this.showWarning('ストレージAPIが利用できません。');
      }
    } catch (error) {
      this.showWarning('データのクリアに失敗しました。');
    }
  }

  /**
   * 問題を報告
   */
  reportIssue() {
    // エラーレポートを生成
    const errorReport = this.logger.exportLogs();
    
    // レポートをダウンロード
    const blob = new Blob([errorReport], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `popup-blocker-error-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.showInfo('エラーレポートをダウンロードしました。開発者に送信してください。');
  }

  /**
   * トラブルシューティングを表示
   */
  showTroubleshooting() {
    const troubleshootingSteps = [
      '1. ページを再読み込みしてください',
      '2. 他のタブを閉じてメモリを解放してください',
      '3. ブラウザを再起動してください',
      '4. 拡張機能を無効にして再度有効にしてください',
      '5. 問題が続く場合は、エラーレポートを送信してください'
    ];

    this.showNotification({
      type: 'info',
      title: 'トラブルシューティング',
      message: troubleshootingSteps.join('\n'),
      persistent: true,
      actions: [
        {
          label: 'エラーレポート',
          onclick: 'window.userFeedbackSystem?.reportIssue()',
          secondary: false
        }
      ]
    });
  }

  /**
   * 進行状況を表示
   */
  showProgress(message, progressCallback) {
    const notificationId = this.showNotification({
      type: 'info',
      title: '処理中',
      message,
      persistent: true,
      autoHide: false
    });

    const notification = this.activeNotifications.get(notificationId);
    if (!notification) return;

    // 進行状況バーを追加
    const progressBar = document.createElement('div');
    progressBar.className = 'popup-blocker-notification-progress';
    progressBar.innerHTML = '<div class="popup-blocker-notification-progress-bar"></div>';
    
    const body = notification.element.querySelector('.popup-blocker-notification-body');
    body.appendChild(progressBar);

    const progressBarElement = progressBar.querySelector('.popup-blocker-notification-progress-bar');

    // 進行状況更新関数を返す
    return {
      update: (progress) => {
        progressBarElement.style.width = `${Math.max(0, Math.min(100, progress))}%`;
      },
      complete: (successMessage) => {
        this.hideNotification(notificationId);
        if (successMessage) {
          this.showSuccess(successMessage);
        }
      },
      error: (errorMessage) => {
        this.hideNotification(notificationId);
        this.showWarning(errorMessage);
      }
    };
  }

  /**
   * 設定を更新
   */
  updatePreferences(newPreferences) {
    this.userPreferences = { ...this.userPreferences, ...newPreferences };
    this.saveUserPreferences();
  }

  /**
   * フィードバックシステムを破棄
   */
  destroy() {
    this.hideAllNotifications();
    
    // スタイルを削除
    const styleElement = document.getElementById('popup-blocker-feedback-styles');
    if (styleElement) {
      styleElement.remove();
    }

    // コンテナを削除
    const container = document.getElementById('popup-blocker-notification-container');
    if (container) {
      container.remove();
    }

    this.logger.info('USER_FEEDBACK', 'フィードバックシステムを終了しました');
  }
}

// グローバルインスタンスを作成
if (typeof window !== 'undefined' && window.globalLogger) {
  window.userFeedbackSystem = new UserFeedbackSystem(window.globalLogger, window.globalErrorHandler);
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UserFeedbackSystem };
} else if (typeof window !== 'undefined') {
  window.UserFeedbackSystem = UserFeedbackSystem;
}