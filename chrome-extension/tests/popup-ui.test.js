/**
 * ポップアップインターフェースのユニットテスト
 * Task 9.1.5: UIコンポーネントのテスト - ポップアップUI部分
 */

const { 
  createMockElement,
  createMockUserPreferences,
  createChromeApiMock,
  resetTestData,
  TimerHelpers
} = require('./test-helpers');

describe('ポップアップインターフェースのテスト', () => {
  let mockChrome;
  let mockDocument;
  let mockWindow;
  let popupUI;

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
      location: { href: 'chrome-extension://test/popup.html' },
      innerWidth: 400,
      innerHeight: 600
    };
    
    global.document = mockDocument;
    global.window = mockWindow;

    popupUI = new PopupUI();
  });

  afterEach(() => {
    TimerHelpers.useRealTimers();
  });

  /**
   * 拡張機能ポップアップUIクラス
   * トグルコントロール、統計表示、設定アクセスを提供
   */
  class PopupUI {
    constructor() {
      this.elements = {};
      this.isInitialized = false;
      this.statistics = null;
    }

    /**
     * UIを初期化
     */
    async init() {
      try {
        this.setupElements();
        this.setupEventListeners();
        await this.loadData();
        this.render();
        this.isInitialized = true;
        
        console.log('ポップアップUIが初期化されました');
      } catch (error) {
        console.error('ポップアップUI初期化エラー:', error);
        throw error;
      }
    }

    /**
     * DOM要素を設定
     */
    setupElements() {
      this.elements = {
        toggleSwitch: createMockElement('input', { 
          type: 'checkbox', 
          id: 'extension-toggle' 
        }),
        statusText: createMockElement('span', { 
          id: 'status-text',
          textContent: '有効'
        }),
        statsContainer: createMockElement('div', { 
          id: 'stats-container' 
        }),
        detectedCount: createMockElement('span', { 
          id: 'detected-count',
          textContent: '0'
        }),
        blockedCount: createMockElement('span', { 
          id: 'blocked-count',
          textContent: '0'
        }),
        settingsButton: createMockElement('button', { 
          id: 'settings-button',
          textContent: '設定'
        }),
        whitelistButton: createMockElement('button', { 
          id: 'whitelist-button',
          textContent: 'このサイトを許可'
        }),
        activityList: createMockElement('ul', { 
          id: 'activity-list' 
        })
      };

      // モックのquerySelector実装
      mockDocument.getElementById.mockImplementation((id) => {
        return Object.values(this.elements).find(el => el.id === id) || null;
      });
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
      this.elements.toggleSwitch.addEventListener('change', (e) => {
        this.handleToggleChange(e.target.checked);
      });

      this.elements.settingsButton.addEventListener('click', () => {
        this.openSettings();
      });

      this.elements.whitelistButton.addEventListener('click', () => {
        this.addToWhitelist();
      });
    }

    /**
     * データを読み込み
     */
    async loadData() {
      try {
        // ユーザー設定を取得
        const preferencesResponse = await chrome.runtime.sendMessage({
          type: 'GET_USER_PREFERENCES'
        });
        
        if (preferencesResponse.success) {
          this.preferences = preferencesResponse.data;
        }

        // 統計を取得
        const statsResponse = await chrome.runtime.sendMessage({
          type: 'GET_STATISTICS'
        });
        
        if (statsResponse.success) {
          this.statistics = statsResponse.data;
        }

        // 現在のタブ情報を取得
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0) {
          this.currentTab = tabs[0];
        }

      } catch (error) {
        console.error('データ読み込みエラー:', error);
        // デフォルト値を設定
        this.preferences = createMockUserPreferences();
        this.statistics = {
          totalPopupsDetected: 0,
          totalPopupsClosed: 0,
          totalPopupsKept: 0
        };
      }
    }

    /**
     * UIをレンダリング
     */
    render() {
      // トグルスイッチの状態を更新
      this.elements.toggleSwitch.checked = this.preferences.extensionEnabled;
      this.elements.statusText.textContent = this.preferences.extensionEnabled ? '有効' : '無効';

      // 統計を表示
      this.elements.detectedCount.textContent = this.statistics.totalPopupsDetected.toString();
      this.elements.blockedCount.textContent = this.statistics.totalPopupsClosed.toString();

      // ホワイトリストボタンの状態を更新
      if (this.currentTab) {
        const domain = new URL(this.currentTab.url).hostname;
        const isWhitelisted = this.preferences.whitelistedDomains.includes(domain);
        this.elements.whitelistButton.textContent = isWhitelisted ? 
          'このサイトの許可を解除' : 'このサイトを許可';
        this.elements.whitelistButton.disabled = false;
      } else {
        this.elements.whitelistButton.disabled = true;
      }

      // 最近のアクティビティを表示
      this.renderRecentActivity();
    }

    /**
     * 最近のアクティビティを表示
     */
    renderRecentActivity() {
      // アクティビティリストをクリア
      this.elements.activityList.innerHTML = '';

      if (this.statistics.recentActivity) {
        this.statistics.recentActivity.slice(0, 5).forEach(activity => {
          const listItem = createMockElement('li', {
            className: 'activity-item',
            innerHTML: `
              <span class="activity-domain">${activity.domain}</span>
              <span class="activity-action">${activity.action}</span>
              <span class="activity-time">${this.formatTime(activity.timestamp)}</span>
            `
          });
          this.elements.activityList.appendChild(listItem);
        });
      }
    }

    /**
     * 時刻をフォーマット
     */
    formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }

    /**
     * トグルスイッチの変更を処理
     */
    async handleToggleChange(enabled) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'UPDATE_USER_PREFERENCES',
          data: { extensionEnabled: enabled }
        });

        if (response.success) {
          this.preferences.extensionEnabled = enabled;
          this.elements.statusText.textContent = enabled ? '有効' : '無効';
          console.log('拡張機能の状態を変更:', enabled);
        } else {
          // エラーの場合は元の状態に戻す
          this.elements.toggleSwitch.checked = !enabled;
          throw new Error('設定の更新に失敗しました');
        }
      } catch (error) {
        console.error('トグル変更エラー:', error);
        this.showError('設定の変更に失敗しました');
      }
    }

    /**
     * 設定ページを開く
     */
    openSettings() {
      chrome.runtime.openOptionsPage();
    }

    /**
     * ホワイトリストに追加/削除
     */
    async addToWhitelist() {
      if (!this.currentTab) return;

      try {
        const domain = new URL(this.currentTab.url).hostname;
        const isWhitelisted = this.preferences.whitelistedDomains.includes(domain);
        
        let newWhitelistedDomains;
        if (isWhitelisted) {
          newWhitelistedDomains = this.preferences.whitelistedDomains.filter(d => d !== domain);
        } else {
          newWhitelistedDomains = [...this.preferences.whitelistedDomains, domain];
        }

        const response = await chrome.runtime.sendMessage({
          type: 'UPDATE_USER_PREFERENCES',
          data: { whitelistedDomains: newWhitelistedDomains }
        });

        if (response.success) {
          this.preferences.whitelistedDomains = newWhitelistedDomains;
          this.render(); // UIを再描画
          console.log('ホワイトリストを更新:', domain, !isWhitelisted);
        }
      } catch (error) {
        console.error('ホワイトリスト更新エラー:', error);
        this.showError('ホワイトリストの更新に失敗しました');
      }
    }

    /**
     * エラーメッセージを表示
     */
    showError(message) {
      // エラー表示の実装（実際のUIでは通知やアラートを表示）
      console.error('UI Error:', message);
    }

    /**
     * UIを破棄
     */
    destroy() {
      // イベントリスナーを削除
      Object.values(this.elements).forEach(element => {
        if (element.removeEventListener) {
          element.removeEventListener('click', null);
          element.removeEventListener('change', null);
        }
      });

      this.isInitialized = false;
    }
  }

  test('ポップアップUIの初期化', async () => {
    // Chrome APIのレスポンスを設定
    mockChrome.runtime.sendMessage
      .mockResolvedValueOnce({ success: true, data: createMockUserPreferences() })
      .mockResolvedValueOnce({ success: true, data: { totalPopupsDetected: 10, totalPopupsClosed: 7 } });
    
    mockChrome.tabs.query.mockResolvedValue([{ 
      url: 'https://example.com/page',
      id: 1 
    }]);

    await popupUI.init();

    expect(popupUI.isInitialized).toBe(true);
    expect(popupUI.preferences).toBeDefined();
    expect(popupUI.statistics).toBeDefined();
  });

  test('トグルスイッチの動作', async () => {
    await popupUI.init();
    
    mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

    // トグルスイッチをクリック
    await popupUI.handleToggleChange(false);

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'UPDATE_USER_PREFERENCES',
      data: { extensionEnabled: false }
    });
  });

  test('統計表示の更新', async () => {
    const mockStats = {
      totalPopupsDetected: 25,
      totalPopupsClosed: 20,
      totalPopupsKept: 5
    };

    // Reset the mock before setting up new responses
    mockChrome.runtime.sendMessage.mockClear();
    mockChrome.runtime.sendMessage
      .mockResolvedValueOnce({ success: true, data: createMockUserPreferences() })
      .mockResolvedValueOnce({ success: true, data: mockStats });

    mockChrome.tabs.query.mockResolvedValue([{ 
      url: 'https://example.com/page',
      id: 1 
    }]);

    await popupUI.init();

    expect(popupUI.elements.detectedCount.textContent).toBe('25');
    expect(popupUI.elements.blockedCount.textContent).toBe('20');
  });

  test('ホワイトリスト機能', async () => {
    mockChrome.tabs.query.mockResolvedValue([{ 
      url: 'https://example.com/page',
      id: 1 
    }]);

    // Setup initial responses for init
    mockChrome.runtime.sendMessage
      .mockResolvedValueOnce({ success: true, data: createMockUserPreferences() })
      .mockResolvedValueOnce({ success: true, data: { totalPopupsDetected: 10, totalPopupsClosed: 7 } })
      .mockResolvedValue({ success: true }); // For the whitelist update

    await popupUI.init();
    
    await popupUI.addToWhitelist();

    // Check that the last call was for updating whitelist
    const lastCall = mockChrome.runtime.sendMessage.mock.calls[mockChrome.runtime.sendMessage.mock.calls.length - 1];
    expect(lastCall[0]).toEqual({
      type: 'UPDATE_USER_PREFERENCES',
      data: { whitelistedDomains: ['example.com'] }
    });
  });

  test('設定ページの開く', async () => {
    await popupUI.init();

    popupUI.openSettings();

    expect(mockChrome.runtime.openOptionsPage).toHaveBeenCalled();
  });

  test('エラーハンドリング', async () => {
    mockChrome.runtime.sendMessage.mockRejectedValue(new Error('API Error'));

    await popupUI.init();

    // デフォルト値が設定されていることを確認
    expect(popupUI.preferences).toBeDefined();
    expect(popupUI.statistics).toBeDefined();
  });

  test('UIの破棄', async () => {
    await popupUI.init();
    
    popupUI.destroy();

    expect(popupUI.isInitialized).toBe(false);
  });
});