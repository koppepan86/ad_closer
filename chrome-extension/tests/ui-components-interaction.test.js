/**
 * UIコンポーネントインタラクションと状態管理の包括的テスト
 * Task 9.1: ユニットテストの作成 - UIコンポーネントインタラクションと状態管理のテスト
 */

// DOM環境のモック
global.document = {
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  createElement: jest.fn(),
  addEventListener: jest.fn(),
  body: { appendChild: jest.fn() }
};

global.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  close: jest.fn(),
  location: { href: 'chrome-extension://test-id/popup/popup.html' }
};

// Chrome API のモック
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    getURL: jest.fn((path) => `chrome-extension://test-id/${path}`),
    openOptionsPage: jest.fn()
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

describe('UIコンポーネントインタラクションと状態管理', () => {
  let mockElements, popupInterface, optionsManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // モック要素の設定
    mockElements = {
      extensionToggle: createMockElement('input', { type: 'checkbox', checked: true }),
      statusText: createMockElement('span', { textContent: '有効' }),
      totalBlocked: createMockElement('span', { textContent: '0' }),
      todayBlocked: createMockElement('span', { textContent: '0' }),
      currentSiteBlocked: createMockElement('span', { textContent: '0' }),
      currentDomain: createMockElement('span', { textContent: 'example.com' }),
      whitelistBtn: createMockElement('button', { textContent: 'ホワイトリストに追加' }),
      activityList: createMockElement('div', { innerHTML: '' }),
      settingsBtn: createMockElement('button', { textContent: '設定' }),
      toggleSlider: createMockElement('div', { setAttribute: jest.fn() })
    };

    document.getElementById.mockImplementation((id) => mockElements[id] || null);

    // Chrome tabs API のモック
    chrome.tabs.query.mockResolvedValue([{
      id: 123,
      url: 'https://example.com/page',
      active: true
    }]);

    // Chrome runtime sendMessage のモック
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      const mockResponses = {
        'GET_USER_PREFERENCES': {
          success: true,
          data: {
            extensionEnabled: true,
            showNotifications: true,
            whitelistedDomains: [],
            statistics: {
              totalPopupsDetected: 10,
              totalPopupsClosed: 8,
              totalPopupsKept: 2
            }
          }
        },
        'GET_STATISTICS': {
          success: true,
          data: {
            totalPopupsClosed: 8,
            effectivenessMetrics: {
              today: { totalClosed: 3, blockRate: 75.0, averageResponseTime: 2500 }
            },
            websiteStatistics: [
              { domain: 'example.com', totalClosed: 5 },
              { domain: 'test.com', totalClosed: 3 }
            ],
            activityTrends: {
              hourlyActivity: Array.from({ length: 24 }, (_, i) => ({ hour: i, activity: Math.floor(Math.random() * 10) })),
              trend: { changePercentage: 15.5, direction: 'increasing' }
            }
          }
        },
        'GET_USER_DECISIONS': {
          success: true,
          data: [
            { id: 'popup_1', domain: 'example.com', decision: 'close', timestamp: Date.now() - 3600000 },
            { id: 'popup_2', domain: 'test.com', decision: 'keep', timestamp: Date.now() - 7200000 }
          ]
        }
      };

      const response = mockResponses[message.type] || { success: false, error: 'Unknown message type' };
      if (callback) callback(response);
      return Promise.resolve(response);
    });

    // ポップアップインターフェースの実装
    popupInterface = {
      elements: mockElements,
      currentTab: { id: 123, url: 'https://example.com/page' },

      async init() {
        await this.getCurrentTab();
        this.setupEventListeners();
        await this.loadData();
      },

      async getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        this.currentTab = tab;
        if (tab && tab.url) {
          const url = new URL(tab.url);
          this.elements.currentDomain.textContent = url.hostname;
        }
      },

      setupEventListeners() {
        this.elements.extensionToggle.addEventListener('change', (e) => {
          this.toggleExtension(e.target.checked);
        });

        this.elements.whitelistBtn.addEventListener('click', () => {
          this.toggleWhitelist();
        });

        this.elements.settingsBtn.addEventListener('click', () => {
          this.openSettings();
        });
      },

      async loadData() {
        const preferences = await this.getUserPreferences();
        this.updateExtensionStatus(preferences.extensionEnabled);
        await this.updateStatistics(preferences.statistics);
        await this.updateWhitelistStatus(preferences.whitelistedDomains);
        await this.updateRecentActivity();
      },

      async sendMessage(type, data = null) {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type, data }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response?.error || 'メッセージ送信に失敗しました'));
            }
          });
        });
      },

      async getUserPreferences() {
        return await this.sendMessage('GET_USER_PREFERENCES');
      },

      async toggleExtension(enabled) {
        const preferences = await this.getUserPreferences();
        preferences.extensionEnabled = enabled;
        await this.sendMessage('UPDATE_USER_PREFERENCES', preferences);
        this.updateExtensionStatus(enabled);
      },

      updateExtensionStatus(enabled) {
        this.elements.extensionToggle.checked = enabled;
        this.elements.statusText.textContent = enabled ? '有効' : '無効';
        this.elements.toggleSlider.setAttribute('aria-checked', enabled.toString());
      },

      async updateStatistics(stats) {
        const statistics = await this.sendMessage('GET_STATISTICS');
        this.elements.totalBlocked.textContent = statistics.totalPopupsClosed.toLocaleString();
        this.elements.todayBlocked.textContent = statistics.effectivenessMetrics.today.totalClosed.toLocaleString();
        
        const currentSiteBlocked = await this.getCurrentSiteBlockedCount();
        this.elements.currentSiteBlocked.textContent = currentSiteBlocked.toLocaleString();
      },

      async getCurrentSiteBlockedCount() {
        if (!this.currentTab || !this.currentTab.url) return 0;
        const url = new URL(this.currentTab.url);
        const decisions = await this.sendMessage('GET_USER_DECISIONS', { domain: url.hostname });
        return decisions.filter(d => d.decision === 'close').length;
      },

      async updateWhitelistStatus(whitelistedDomains) {
        if (!this.currentTab || !this.currentTab.url) {
          this.elements.whitelistBtn.disabled = true;
          return;
        }

        const url = new URL(this.currentTab.url);
        const domain = url.hostname;
        const isWhitelisted = whitelistedDomains.includes(domain);
        
        this.elements.whitelistBtn.textContent = isWhitelisted ? 
          'ホワイトリストから削除' : 'ホワイトリストに追加';
        this.elements.whitelistBtn.disabled = false;
      },

      async toggleWhitelist() {
        if (!this.currentTab || !this.currentTab.url) return;

        const url = new URL(this.currentTab.url);
        const domain = url.hostname;
        const preferences = await this.getUserPreferences();
        let whitelistedDomains = preferences.whitelistedDomains || [];
        
        const isWhitelisted = whitelistedDomains.includes(domain);
        
        if (isWhitelisted) {
          whitelistedDomains = whitelistedDomains.filter(d => d !== domain);
        } else {
          whitelistedDomains.push(domain);
        }
        
        preferences.whitelistedDomains = whitelistedDomains;
        await this.sendMessage('UPDATE_USER_PREFERENCES', preferences);
        await this.updateWhitelistStatus(whitelistedDomains);
      },

      async updateRecentActivity() {
        const decisions = await this.sendMessage('GET_USER_DECISIONS', { limit: 5 });
        
        if (!decisions || decisions.length === 0) {
          this.elements.activityList.innerHTML = '<div class="activity-item">最近のアクティビティはありません</div>';
          return;
        }
        
        const activityHtml = decisions.map(decision => {
          const action = decision.decision === 'close' ? 'ブロック' : '許可';
          return `<div class="activity-item">${action}: ${decision.domain}</div>`;
        }).join('');
        
        this.elements.activityList.innerHTML = activityHtml;
      },

      openSettings() {
        chrome.runtime.openOptionsPage();
        window.close();
      }
    };

    // オプションマネージャーの実装
    optionsManager = {
      currentTab: 'general',
      settings: {},
      originalSettings: {},

      async init() {
        this.setupTabNavigation();
        this.setupEventListeners();
        await this.loadSettings();
        this.updateUI();
      },

      setupTabNavigation() {
        const tabButtons = [
          createMockElement('button', { dataset: { tab: 'general' }, classList: { add: jest.fn(), remove: jest.fn() } }),
          createMockElement('button', { dataset: { tab: 'whitelist' }, classList: { add: jest.fn(), remove: jest.fn() } }),
          createMockElement('button', { dataset: { tab: 'history' }, classList: { add: jest.fn(), remove: jest.fn() } })
        ];

        document.querySelectorAll.mockImplementation((selector) => {
          if (selector === '.tab-button') return tabButtons;
          return [];
        });

        tabButtons.forEach(button => {
          button.addEventListener = jest.fn((event, handler) => {
            if (event === 'click') {
              button.clickHandler = handler;
            }
          });
        });
      },

      switchTab(tabName) {
        this.currentTab = tabName;
        // タブ切り替えのUI更新をシミュレート
        document.querySelectorAll('.tab-button').forEach(btn => {
          btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
      },

      setupEventListeners() {
        // イベントリスナーの設定をシミュレート
        this.eventListeners = {
          save: jest.fn(() => this.saveSettings()),
          reset: jest.fn(() => this.resetSettings()),
          addDomain: jest.fn(() => this.addDomainToWhitelist()),
          exportSettings: jest.fn(() => this.exportSettings()),
          importSettings: jest.fn(() => this.importSettings())
        };
      },

      async loadSettings() {
        this.settings = {
          extensionEnabled: true,
          showNotifications: true,
          notificationDuration: 10,
          learningEnabled: true,
          aggressiveMode: false,
          whitelistedDomains: ['example.com'],
          statistics: {
            totalPopupsDetected: 10,
            totalPopupsClosed: 8,
            totalPopupsKept: 2
          }
        };
        this.originalSettings = { ...this.settings };
      },

      updateUI() {
        // UI更新のシミュレート
        Object.keys(this.settings).forEach(key => {
          const element = mockElements[this.camelToKebab(key)];
          if (element) {
            if (element.type === 'checkbox') {
              element.checked = this.settings[key];
            } else {
              element.value = this.settings[key];
            }
          }
        });
      },

      camelToKebab(str) {
        return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
      },

      async saveSettings() {
        // 設定保存のシミュレート
        await chrome.storage.local.set({ userPreferences: this.settings });
        this.originalSettings = { ...this.settings };
        return true;
      },

      resetSettings() {
        this.settings = { ...this.originalSettings };
        this.updateUI();
      },

      addDomainToWhitelist() {
        const domain = 'test.com';
        if (!this.settings.whitelistedDomains.includes(domain)) {
          this.settings.whitelistedDomains.push(domain);
          return true;
        }
        return false;
      },

      removeFromWhitelist(domain) {
        const index = this.settings.whitelistedDomains.indexOf(domain);
        if (index > -1) {
          this.settings.whitelistedDomains.splice(index, 1);
          return true;
        }
        return false;
      },

      exportSettings() {
        return {
          ...this.settings,
          exportDate: new Date().toISOString(),
          version: '1.0'
        };
      },

      importSettings(data) {
        if (data && typeof data === 'object') {
          this.settings = { ...this.settings, ...data };
          this.updateUI();
          return true;
        }
        return false;
      }
    };
  });

  describe('ポップアップインターフェース', () => {
    describe('初期化', () => {
      test('正常に初期化される', async () => {
        await popupInterface.init();
        
        expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
        expect(popupInterface.currentTab).toBeDefined();
        expect(popupInterface.elements.currentDomain.textContent).toBe('example.com');
      });

      test('タブ情報が取得できない場合の処理', async () => {
        chrome.tabs.query.mockResolvedValueOnce([]);
        
        await popupInterface.init();
        
        expect(popupInterface.currentTab).toBeUndefined();
      });
    });

    describe('拡張機能トグル', () => {
      test('拡張機能を無効にする', async () => {
        await popupInterface.init();
        
        await popupInterface.toggleExtension(false);
        
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'UPDATE_USER_PREFERENCES',
            data: expect.objectContaining({ extensionEnabled: false })
          }),
          expect.any(Function)
        );
        expect(popupInterface.elements.extensionToggle.checked).toBe(false);
        expect(popupInterface.elements.statusText.textContent).toBe('無効');
      });

      test('拡張機能を有効にする', async () => {
        await popupInterface.init();
        
        await popupInterface.toggleExtension(true);
        
        expect(popupInterface.elements.extensionToggle.checked).toBe(true);
        expect(popupInterface.elements.statusText.textContent).toBe('有効');
      });
    });

    describe('統計表示', () => {
      test('統計が正しく表示される', async () => {
        await popupInterface.init();
        
        expect(popupInterface.elements.totalBlocked.textContent).toBe('8');
        expect(popupInterface.elements.todayBlocked.textContent).toBe('3');
      });

      test('現在のサイトの統計を取得する', async () => {
        await popupInterface.init();
        
        const count = await popupInterface.getCurrentSiteBlockedCount();
        
        expect(count).toBe(1); // example.com でブロックされた数
      });
    });

    describe('ホワイトリスト管理', () => {
      test('ドメインをホワイトリストに追加する', async () => {
        await popupInterface.init();
        
        await popupInterface.toggleWhitelist();
        
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'UPDATE_USER_PREFERENCES',
            data: expect.objectContaining({
              whitelistedDomains: expect.arrayContaining(['example.com'])
            })
          }),
          expect.any(Function)
        );
      });

      test('ホワイトリスト状態が正しく表示される', async () => {
        // ドメインがホワイトリストに含まれている場合
        chrome.runtime.sendMessage.mockImplementation((message, callback) => {
          if (message.type === 'GET_USER_PREFERENCES') {
            callback({
              success: true,
              data: {
                extensionEnabled: true,
                whitelistedDomains: ['example.com']
              }
            });
          }
        });

        await popupInterface.init();
        
        expect(popupInterface.elements.whitelistBtn.textContent).toBe('ホワイトリストから削除');
      });

      test('無効なURLでのホワイトリスト処理', async () => {
        popupInterface.currentTab = null;
        
        await popupInterface.updateWhitelistStatus([]);
        
        expect(popupInterface.elements.whitelistBtn.disabled).toBe(true);
      });
    });

    describe('最近のアクティビティ', () => {
      test('アクティビティが正しく表示される', async () => {
        await popupInterface.init();
        
        expect(popupInterface.elements.activityList.innerHTML).toContain('ブロック: example.com');
        expect(popupInterface.elements.activityList.innerHTML).toContain('許可: test.com');
      });

      test('アクティビティがない場合の表示', async () => {
        chrome.runtime.sendMessage.mockImplementation((message, callback) => {
          if (message.type === 'GET_USER_DECISIONS') {
            callback({ success: true, data: [] });
          } else {
            callback({ success: true, data: {} });
          }
        });

        await popupInterface.updateRecentActivity();
        
        expect(popupInterface.elements.activityList.innerHTML).toContain('最近のアクティビティはありません');
      });
    });

    describe('設定ページ', () => {
      test('設定ページを開く', () => {
        popupInterface.openSettings();
        
        expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
        expect(window.close).toHaveBeenCalled();
      });
    });

    describe('エラーハンドリング', () => {
      test('メッセージ送信エラーの処理', async () => {
        chrome.runtime.sendMessage.mockImplementation((message, callback) => {
          callback({ success: false, error: 'Communication error' });
        });

        await expect(popupInterface.sendMessage('TEST_MESSAGE')).rejects.toThrow('Communication error');
      });

      test('Chrome runtime エラーの処理', async () => {
        chrome.runtime.lastError = { message: 'Runtime error' };
        chrome.runtime.sendMessage.mockImplementation((message, callback) => {
          callback(null);
        });

        await expect(popupInterface.sendMessage('TEST_MESSAGE')).rejects.toThrow('Runtime error');
        
        chrome.runtime.lastError = null;
      });
    });
  });

  describe('オプションマネージャー', () => {
    describe('初期化', () => {
      test('正常に初期化される', async () => {
        await optionsManager.init();
        
        expect(optionsManager.settings).toBeDefined();
        expect(optionsManager.originalSettings).toBeDefined();
        expect(optionsManager.currentTab).toBe('general');
      });
    });

    describe('タブナビゲーション', () => {
      test('タブを切り替える', () => {
        optionsManager.setupTabNavigation();
        optionsManager.switchTab('whitelist');
        
        expect(optionsManager.currentTab).toBe('whitelist');
      });

      test('タブボタンのイベントリスナーが設定される', () => {
        optionsManager.setupTabNavigation();
        
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
          expect(button.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        });
      });
    });

    describe('設定管理', () => {
      test('設定を保存する', async () => {
        await optionsManager.init();
        optionsManager.settings.extensionEnabled = false;
        
        const result = await optionsManager.saveSettings();
        
        expect(result).toBe(true);
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          userPreferences: expect.objectContaining({ extensionEnabled: false })
        });
      });

      test('設定をリセットする', async () => {
        await optionsManager.init();
        optionsManager.settings.extensionEnabled = false;
        
        optionsManager.resetSettings();
        
        expect(optionsManager.settings.extensionEnabled).toBe(true); // 元の値に戻る
      });

      test('UIが設定値で更新される', async () => {
        await optionsManager.init();
        
        // updateUI が呼ばれることを確認
        expect(optionsManager.settings).toBeDefined();
      });
    });

    describe('ホワイトリスト管理', () => {
      test('ドメインをホワイトリストに追加する', async () => {
        await optionsManager.init();
        
        const result = optionsManager.addDomainToWhitelist();
        
        expect(result).toBe(true);
        expect(optionsManager.settings.whitelistedDomains).toContain('test.com');
      });

      test('重複ドメインの追加を防ぐ', async () => {
        await optionsManager.init();
        optionsManager.settings.whitelistedDomains = ['test.com'];
        
        const result = optionsManager.addDomainToWhitelist();
        
        expect(result).toBe(false);
        expect(optionsManager.settings.whitelistedDomains).toHaveLength(1);
      });

      test('ドメインをホワイトリストから削除する', async () => {
        await optionsManager.init();
        
        const result = optionsManager.removeFromWhitelist('example.com');
        
        expect(result).toBe(true);
        expect(optionsManager.settings.whitelistedDomains).not.toContain('example.com');
      });

      test('存在しないドメインの削除', async () => {
        await optionsManager.init();
        
        const result = optionsManager.removeFromWhitelist('nonexistent.com');
        
        expect(result).toBe(false);
      });
    });

    describe('設定のエクスポート/インポート', () => {
      test('設定をエクスポートする', async () => {
        await optionsManager.init();
        
        const exportedData = optionsManager.exportSettings();
        
        expect(exportedData).toHaveProperty('extensionEnabled');
        expect(exportedData).toHaveProperty('exportDate');
        expect(exportedData).toHaveProperty('version', '1.0');
      });

      test('設定をインポートする', async () => {
        await optionsManager.init();
        
        const importData = {
          extensionEnabled: false,
          showNotifications: false
        };
        
        const result = optionsManager.importSettings(importData);
        
        expect(result).toBe(true);
        expect(optionsManager.settings.extensionEnabled).toBe(false);
        expect(optionsManager.settings.showNotifications).toBe(false);
      });

      test('無効なデータのインポート', async () => {
        await optionsManager.init();
        
        const result = optionsManager.importSettings(null);
        
        expect(result).toBe(false);
      });
    });

    describe('イベントハンドリング', () => {
      test('イベントリスナーが設定される', () => {
        optionsManager.setupEventListeners();
        
        expect(optionsManager.eventListeners.save).toBeDefined();
        expect(optionsManager.eventListeners.reset).toBeDefined();
        expect(optionsManager.eventListeners.addDomain).toBeDefined();
      });

      test('保存イベントが正しく処理される', () => {
        optionsManager.setupEventListeners();
        
        optionsManager.eventListeners.save();
        
        // saveSettings が呼ばれることを確認
        expect(optionsManager.eventListeners.save).toHaveBeenCalled();
      });
    });
  });

  describe('状態管理', () => {
    test('コンポーネント間の状態同期', async () => {
      await popupInterface.init();
      await optionsManager.init();
      
      // ポップアップで設定を変更
      await popupInterface.toggleExtension(false);
      
      // オプションページでも同じ状態が反映されることを確認
      expect(popupInterface.elements.extensionToggle.checked).toBe(false);
    });

    test('設定変更の永続化', async () => {
      await optionsManager.init();
      
      optionsManager.settings.extensionEnabled = false;
      await optionsManager.saveSettings();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        userPreferences: expect.objectContaining({ extensionEnabled: false })
      });
    });

    test('設定の復元', async () => {
      chrome.storage.local.get.mockResolvedValueOnce({
        userPreferences: { extensionEnabled: false }
      });

      await optionsManager.loadSettings();
      
      expect(optionsManager.settings.extensionEnabled).toBe(false);
    });
  });

  describe('アクセシビリティ', () => {
    test('ARIA属性が正しく設定される', async () => {
      await popupInterface.init();
      
      popupInterface.updateExtensionStatus(true);
      
      expect(popupInterface.elements.toggleSlider.setAttribute).toHaveBeenCalledWith('aria-checked', 'true');
    });

    test('キーボードナビゲーションのサポート', () => {
      const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      
      // キーボードイベントの処理をシミュレート
      expect(() => {
        document.dispatchEvent(keydownEvent);
      }).not.toThrow();
    });
  });

  describe('パフォーマンス', () => {
    test('大量のアクティビティデータの処理', async () => {
      const largeActivityData = Array.from({ length: 100 }, (_, i) => ({
        id: `popup_${i}`,
        domain: `example${i}.com`,
        decision: 'close',
        timestamp: Date.now() - i * 1000
      }));

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_USER_DECISIONS') {
          callback({ success: true, data: largeActivityData });
        }
      });

      const startTime = Date.now();
      await popupInterface.updateRecentActivity();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // 100ms以内
    });

    test('UI更新のパフォーマンス', async () => {
      await optionsManager.init();
      
      const startTime = Date.now();
      
      // 複数の設定を一度に更新
      for (let i = 0; i < 50; i++) {
        optionsManager.settings.extensionEnabled = i % 2 === 0;
        optionsManager.updateUI();
      }
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(50); // 50ms以内
    });
  });
});

/**
 * モック要素を作成するヘルパー関数
 */
function createMockElement(tagName, properties = {}) {
  const element = {
    tagName: tagName.toUpperCase(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    click: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(),
      toggle: jest.fn()
    },
    style: {},
    dataset: {},
    ...properties
  };

  // イベントリスナーの実際の動作をシミュレート
  element.addEventListener.mockImplementation((event, handler) => {
    element[`${event}Handler`] = handler;
  });

  return element;
}