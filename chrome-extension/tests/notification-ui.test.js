/**
 * 通知システムのUIテスト
 * Task 9.1.5: UIコンポーネントのテスト - 通知システム部分
 */

const { 
  createMockElement,
  createMockUserPreferences,
  createChromeApiMock,
  resetTestData,
  TimerHelpers
} = require('./test-helpers');

describe('通知システムのUIテスト', () => {
  let mockChrome;
  let mockDocument;
  let mockWindow;
  let notificationUI;

  beforeEach(() => {
    resetTestData();
    TimerHelpers.mockSetTimeout();
    
    // Chrome API モックを設定
    mockChrome = createChromeApiMock();
    global.chrome = mockChrome;
    
    // DOM環境をモック
    mockDocument = {
      getElementById: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(),
      createElement: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      body: createMockElement('body'),
      head: createMockElement('head')
    };
    
    mockWindow = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      location: { href: 'https://example.com' },
      innerWidth: 1200,
      innerHeight: 800
    };
    
    global.document = mockDocument;
    global.window = mockWindow;

    notificationUI = new NotificationUI();
  });

  afterEach(() => {
    TimerHelpers.useRealTimers();
  });

  /**
   * 通知UIクラス
   * ポップアップ検出時のユーザー通知を管理
   */
  class NotificationUI {
    constructor() {
      this.activeNotifications = new Map();
      this.notificationContainer = null;
    }

    /**
     * 通知システムを初期化
     */
    init() {
      this.createNotificationContainer();
      this.setupStyles();
    }

    /**
     * 通知コンテナを作成
     */
    createNotificationContainer() {
      this.notificationContainer = createMockElement('div', {
        id: 'popup-blocker-notifications',
        className: 'notification-container'
      });

      // ページに追加
      document.body.appendChild(this.notificationContainer);
    }

    /**
     * 通知スタイルを設定
     */
    setupStyles() {
      const style = createMockElement('style', {
        textContent: `
          .notification-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
          }
          .notification {
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            max-width: 300px;
          }
        `
      });

      document.head.appendChild(style);
    }

    /**
     * 通知を表示
     */
    showNotification(popupData, options = {}) {
      const notificationId = `notification-${popupData.id}`;
      
      if (this.activeNotifications.has(notificationId)) {
        return; // 既に表示中
      }

      const notification = this.createNotificationElement(popupData, options);
      this.notificationContainer.appendChild(notification);
      this.activeNotifications.set(notificationId, notification);

      // 自動削除タイマー
      if (options.duration) {
        setTimeout(() => {
          this.removeNotification(notificationId);
        }, options.duration);
      }

      return notificationId;
    }

    /**
     * 通知要素を作成
     */
    createNotificationElement(popupData, options) {
      const notification = createMockElement('div', {
        className: 'notification',
        innerHTML: `
          <div class="notification-header">
            <strong>ポップアップを検出しました</strong>
            <button class="notification-close" aria-label="通知を閉じる">×</button>
          </div>
          <div class="notification-body">
            <p>ドメイン: ${this.sanitizeText(popupData.domain)}</p>
            <p>信頼度: ${Math.round(popupData.confidence * 100)}%</p>
          </div>
          <div class="notification-actions">
            <button class="notification-action close-popup" data-popup-id="${popupData.id}">
              自動的に閉じる
            </button>
            <button class="notification-action keep-popup" data-popup-id="${popupData.id}">
              開いたままにする
            </button>
          </div>
        `
      });

      // イベントリスナーを設定
      this.setupNotificationEventListeners(notification, popupData);

      return notification;
    }

    /**
     * 通知のイベントリスナーを設定
     */
    setupNotificationEventListeners(notification, popupData) {
      const closeButton = notification.querySelector('.notification-close');
      const closePopupButton = notification.querySelector('.close-popup');
      const keepPopupButton = notification.querySelector('.keep-popup');

      if (closeButton) {
        closeButton.addEventListener('click', () => {
          this.removeNotification(`notification-${popupData.id}`);
        });
      }

      if (closePopupButton) {
        closePopupButton.addEventListener('click', () => {
          this.handleUserDecision(popupData.id, 'close');
        });
      }

      if (keepPopupButton) {
        keepPopupButton.addEventListener('click', () => {
          this.handleUserDecision(popupData.id, 'keep');
        });
      }
    }

    /**
     * ユーザーの決定を処理
     */
    async handleUserDecision(popupId, decision) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'USER_DECISION',
          data: {
            popupId: popupId,
            decision: decision,
            timestamp: Date.now()
          }
        });

        if (response.success) {
          this.removeNotification(`notification-${popupId}`);
          console.log(`ユーザー決定: ${decision} for popup ${popupId}`);
        }
      } catch (error) {
        console.error('ユーザー決定処理エラー:', error);
      }
    }

    /**
     * 通知を削除
     */
    removeNotification(notificationId) {
      const notification = this.activeNotifications.get(notificationId);
      if (notification && this.notificationContainer.contains(notification)) {
        this.notificationContainer.removeChild(notification);
        this.activeNotifications.delete(notificationId);
      }
    }

    /**
     * すべての通知をクリア
     */
    clearAllNotifications() {
      this.activeNotifications.forEach((notification, id) => {
        this.removeNotification(id);
      });
    }

    /**
     * テキストをサニタイズ
     */
    sanitizeText(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * 通知システムを破棄
     */
    destroy() {
      this.clearAllNotifications();
      
      if (this.notificationContainer && document.body.contains(this.notificationContainer)) {
        document.body.removeChild(this.notificationContainer);
      }
      
      this.notificationContainer = null;
    }
  }

  test('通知システムの初期化', () => {
    notificationUI.init();

    expect(notificationUI.notificationContainer).toBeDefined();
    expect(notificationUI.notificationContainer.className).toBe('notification-container');
    expect(document.body.appendChild).toHaveBeenCalledWith(notificationUI.notificationContainer);
  });

  test('通知の表示', () => {
    notificationUI.init();

    const popupData = {
      id: 'popup-123',
      domain: 'example.com',
      confidence: 0.85,
      element: createMockElement('div')
    };

    const notificationId = notificationUI.showNotification(popupData);

    expect(notificationId).toBe('notification-popup-123');
    expect(notificationUI.activeNotifications.has(notificationId)).toBe(true);
    expect(notificationUI.notificationContainer.appendChild).toHaveBeenCalled();
  });

  test('重複通知の防止', () => {
    notificationUI.init();

    const popupData = {
      id: 'popup-123',
      domain: 'example.com',
      confidence: 0.85,
      element: createMockElement('div')
    };

    // 同じポップアップの通知を2回表示しようとする
    const firstId = notificationUI.showNotification(popupData);
    const secondId = notificationUI.showNotification(popupData);

    expect(firstId).toBe('notification-popup-123');
    expect(secondId).toBeUndefined(); // 2回目は表示されない
    expect(notificationUI.activeNotifications.size).toBe(1);
  });

  test('自動削除タイマー', (done) => {
    notificationUI.init();

    const popupData = {
      id: 'popup-123',
      domain: 'example.com',
      confidence: 0.85,
      element: createMockElement('div')
    };

    const notificationId = notificationUI.showNotification(popupData, { duration: 100 });

    expect(notificationUI.activeNotifications.has(notificationId)).toBe(true);

    // 100ms後に自動削除されることを確認
    setTimeout(() => {
      expect(notificationUI.activeNotifications.has(notificationId)).toBe(false);
      done();
    }, 150);
  });

  test('ユーザー決定の処理 - 閉じる', async () => {
    notificationUI.init();

    const popupData = {
      id: 'popup-123',
      domain: 'example.com',
      confidence: 0.85,
      element: createMockElement('div')
    };

    mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

    await notificationUI.handleUserDecision('popup-123', 'close');

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'USER_DECISION',
      data: {
        popupId: 'popup-123',
        decision: 'close',
        timestamp: expect.any(Number)
      }
    });
  });

  test('ユーザー決定の処理 - 保持', async () => {
    notificationUI.init();

    const popupData = {
      id: 'popup-123',
      domain: 'example.com',
      confidence: 0.85,
      element: createMockElement('div')
    };

    mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

    await notificationUI.handleUserDecision('popup-123', 'keep');

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'USER_DECISION',
      data: {
        popupId: 'popup-123',
        decision: 'keep',
        timestamp: expect.any(Number)
      }
    });
  });

  test('通知の手動削除', () => {
    notificationUI.init();

    const popupData = {
      id: 'popup-123',
      domain: 'example.com',
      confidence: 0.85,
      element: createMockElement('div')
    };

    const notificationId = notificationUI.showNotification(popupData);
    expect(notificationUI.activeNotifications.has(notificationId)).toBe(true);

    notificationUI.removeNotification(notificationId);
    expect(notificationUI.activeNotifications.has(notificationId)).toBe(false);
  });

  test('すべての通知のクリア', () => {
    notificationUI.init();

    // 複数の通知を作成
    const popupData1 = { id: 'popup-1', domain: 'example1.com', confidence: 0.8 };
    const popupData2 = { id: 'popup-2', domain: 'example2.com', confidence: 0.9 };

    notificationUI.showNotification(popupData1);
    notificationUI.showNotification(popupData2);

    expect(notificationUI.activeNotifications.size).toBe(2);

    notificationUI.clearAllNotifications();

    expect(notificationUI.activeNotifications.size).toBe(0);
  });

  test('テキストのサニタイズ', () => {
    notificationUI.init();

    const maliciousText = '<script>alert("xss")</script>test';
    const sanitized = notificationUI.sanitizeText(maliciousText);

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('test');
  });

  test('通知システムの破棄', () => {
    notificationUI.init();

    const popupData = {
      id: 'popup-123',
      domain: 'example.com',
      confidence: 0.85,
      element: createMockElement('div')
    };

    notificationUI.showNotification(popupData);
    expect(notificationUI.activeNotifications.size).toBe(1);

    notificationUI.destroy();

    expect(notificationUI.activeNotifications.size).toBe(0);
    expect(notificationUI.notificationContainer).toBeNull();
  });

  test('エラーハンドリング - API通信失敗', async () => {
    notificationUI.init();

    mockChrome.runtime.sendMessage.mockRejectedValue(new Error('API Error'));

    // エラーが発生してもクラッシュしないことを確認
    await expect(notificationUI.handleUserDecision('popup-123', 'close')).resolves.not.toThrow();
  });

  test('通知要素のイベントリスナー設定', () => {
    notificationUI.init();

    const popupData = {
      id: 'popup-123',
      domain: 'example.com',
      confidence: 0.85,
      element: createMockElement('div')
    };

    const notification = notificationUI.createNotificationElement(popupData, {});

    // ボタンが正しく作成されていることを確認
    const closeButton = notification.querySelector('.notification-close');
    const closePopupButton = notification.querySelector('.close-popup');
    const keepPopupButton = notification.querySelector('.keep-popup');

    expect(closeButton).toBeDefined();
    expect(closePopupButton).toBeDefined();
    expect(keepPopupButton).toBeDefined();
    expect(closePopupButton.getAttribute('data-popup-id')).toBe('popup-123');
    expect(keepPopupButton.getAttribute('data-popup-id')).toBe('popup-123');
  });
});