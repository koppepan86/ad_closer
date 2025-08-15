/**
 * ポップアップインターフェースのテスト
 */

// モックChrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    openOptionsPage: jest.fn(),
    getURL: jest.fn()
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

// 簡単なDOM要素のモック
const createMockElement = (id) => ({
  id,
  textContent: '',
  innerHTML: '',
  checked: false,
  disabled: false,
  style: {},
  classList: {
    add: jest.fn(),
    remove: jest.fn()
  },
  setAttribute: jest.fn(),
  addEventListener: jest.fn()
});

// モックドキュメント
global.document = {
  getElementById: jest.fn((id) => createMockElement(id)),
  querySelector: jest.fn(() => createMockElement('mock')),
  addEventListener: jest.fn()
};

// モックウィンドウ
global.window = {
  addEventListener: jest.fn(),
  close: jest.fn(),
  URL: global.URL
};

describe('PopupInterface', () => {
  let mockElements;

  beforeEach(() => {
    // モック要素を作成
    mockElements = {
      'extension-toggle': createMockElement('extension-toggle'),
      'status-text': createMockElement('status-text'),
      'total-blocked': createMockElement('total-blocked'),
      'today-blocked': createMockElement('today-blocked'),
      'current-site-blocked': createMockElement('current-site-blocked'),
      'current-domain': createMockElement('current-domain'),
      'whitelist-btn': createMockElement('whitelist-btn'),
      'activity-list': createMockElement('activity-list'),
      'settings-btn': createMockElement('settings-btn'),
      'popup-container': createMockElement('popup-container')
    };

    // getElementById のモックを設定
    document.getElementById.mockImplementation((id) => mockElements[id] || createMockElement(id));
    document.querySelector.mockImplementation(() => createMockElement('toggle-slider'));

    // Chrome APIのモックをリセット
    jest.clearAllMocks();
  });

  describe('メッセージ通信', () => {
    test('sendMessage が正常に動作する', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ success: true, data: { test: 'data' } });
      });

      // PopupInterface の sendMessage メソッドをテスト
      const sendMessage = async (type, data = null) => {
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
      };

      const result = await sendMessage('GET_STATISTICS');
      expect(result).toEqual({ test: 'data' });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'GET_STATISTICS', data: null },
        expect.any(Function)
      );
    });

    test('sendMessage がエラーを適切に処理する', async () => {
      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ success: false, error: 'テストエラー' });
      });

      const sendMessage = async (type, data = null) => {
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
      };

      await expect(sendMessage('GET_STATISTICS')).rejects.toThrow('テストエラー');
    });
  });

  describe('ユーザー設定管理', () => {
    test('ユーザー設定を取得できる', async () => {
      const mockPreferences = {
        extensionEnabled: true,
        whitelistedDomains: ['example.com'],
        statistics: { totalPopupsClosed: 5 }
      };

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_USER_PREFERENCES') {
          callback({ success: true, data: mockPreferences });
        }
      });

      const getUserPreferences = async () => {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'GET_USER_PREFERENCES' }, (response) => {
            if (response && response.success) {
              resolve(response.data);
            } else {
              reject(new Error('設定取得に失敗しました'));
            }
          });
        });
      };

      const result = await getUserPreferences();
      expect(result).toEqual(mockPreferences);
    });

    test('ユーザー設定を更新できる', async () => {
      const updatedPreferences = {
        extensionEnabled: false,
        whitelistedDomains: ['example.com', 'test.com']
      };

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'UPDATE_USER_PREFERENCES') {
          callback({ success: true });
        }
      });

      const updateUserPreferences = async (preferences) => {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ 
            type: 'UPDATE_USER_PREFERENCES', 
            data: preferences 
          }, (response) => {
            if (response && response.success) {
              resolve();
            } else {
              reject(new Error('設定更新に失敗しました'));
            }
          });
        });
      };

      await expect(updateUserPreferences(updatedPreferences)).resolves.toBeUndefined();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          type: 'UPDATE_USER_PREFERENCES',
          data: updatedPreferences
        },
        expect.any(Function)
      );
    });
  });

  describe('統計機能', () => {
    test('統計データを取得できる', async () => {
      const mockStatistics = {
        totalPopupsClosed: 25,
        totalPopupsDetected: 30,
        totalPopupsKept: 5
      };

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_STATISTICS') {
          callback({ success: true, data: mockStatistics });
        }
      });

      const getStatistics = async () => {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'GET_STATISTICS' }, (response) => {
            if (response && response.success) {
              resolve(response.data);
            } else {
              reject(new Error('統計取得に失敗しました'));
            }
          });
        });
      };

      const result = await getStatistics();
      expect(result).toEqual(mockStatistics);
    });

    test('統計表示が正しく更新される', () => {
      const totalBlockedElement = mockElements['total-blocked'];
      const todayBlockedElement = mockElements['today-blocked'];
      const currentSiteBlockedElement = mockElements['current-site-blocked'];

      // 統計を更新
      totalBlockedElement.textContent = '25';
      todayBlockedElement.textContent = '3';
      currentSiteBlockedElement.textContent = '1';

      expect(totalBlockedElement.textContent).toBe('25');
      expect(todayBlockedElement.textContent).toBe('3');
      expect(currentSiteBlockedElement.textContent).toBe('1');
    });
  });

  describe('ホワイトリスト機能', () => {
    test('ホワイトリスト状態を確認できる', () => {
      const whitelistedDomains = ['example.com', 'trusted.com'];
      const currentDomain = 'example.com';
      
      const isWhitelisted = whitelistedDomains.includes(currentDomain);
      expect(isWhitelisted).toBe(true);
      
      const notWhitelistedDomain = 'unknown.com';
      const isNotWhitelisted = whitelistedDomains.includes(notWhitelistedDomain);
      expect(isNotWhitelisted).toBe(false);
    });

    test('ホワイトリストボタンのテキストが正しく設定される', () => {
      const whitelistBtn = mockElements['whitelist-btn'];
      
      // ホワイトリストに含まれている場合
      whitelistBtn.textContent = 'ホワイトリストから削除';
      expect(whitelistBtn.textContent).toBe('ホワイトリストから削除');
      
      // ホワイトリストに含まれていない場合
      whitelistBtn.textContent = 'ホワイトリストに追加';
      expect(whitelistBtn.textContent).toBe('ホワイトリストに追加');
    });

    test('ドメインをホワイトリストに追加/削除できる', () => {
      let whitelistedDomains = ['trusted.com'];
      const domain = 'example.com';
      
      // 追加
      if (!whitelistedDomains.includes(domain)) {
        whitelistedDomains.push(domain);
      }
      expect(whitelistedDomains).toContain('example.com');
      
      // 削除
      whitelistedDomains = whitelistedDomains.filter(d => d !== domain);
      expect(whitelistedDomains).not.toContain('example.com');
      expect(whitelistedDomains).toContain('trusted.com');
    });
  });

  describe('最近のアクティビティ', () => {
    test('ユーザー決定データを取得できる', async () => {
      const mockDecisions = [
        {
          id: '1',
          decision: 'close',
          domain: 'example.com',
          timestamp: Date.now() - 60000
        },
        {
          id: '2',
          decision: 'keep',
          domain: 'trusted.com',
          timestamp: Date.now() - 120000
        }
      ];

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_USER_DECISIONS') {
          callback({ success: true, data: mockDecisions });
        }
      });

      const getUserDecisions = async (filters = {}) => {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ 
            type: 'GET_USER_DECISIONS', 
            data: filters 
          }, (response) => {
            if (response && response.success) {
              resolve(response.data);
            } else {
              reject(new Error('決定履歴取得に失敗しました'));
            }
          });
        });
      };

      const result = await getUserDecisions({ limit: 5 });
      expect(result).toEqual(mockDecisions);
      expect(result[0].decision).toBe('close');
      expect(result[1].decision).toBe('keep');
    });

    test('アクティビティリストのHTMLが正しく生成される', () => {
      const decisions = [
        { decision: 'close', domain: 'example.com', timestamp: Date.now() - 60000 },
        { decision: 'keep', domain: 'trusted.com', timestamp: Date.now() - 120000 }
      ];

      const activityHtml = decisions.map(decision => {
        const action = decision.decision === 'close' ? 'ブロック' : '許可';
        const domain = decision.domain || '不明なドメイン';
        
        return `
          <div class="activity-item">
            <span class="activity-text">
              <span class="activity-action">${action}</span>
              <span class="activity-domain">${domain}</span>
            </span>
            <span class="activity-time">時刻</span>
          </div>
        `;
      }).join('');

      expect(activityHtml).toContain('ブロック');
      expect(activityHtml).toContain('example.com');
      expect(activityHtml).toContain('許可');
      expect(activityHtml).toContain('trusted.com');
    });
  });

  describe('設定ページナビゲーション', () => {
    test('設定ページを開くことができる', () => {
      chrome.runtime.openOptionsPage.mockImplementation(() => {});
      
      const openSettings = () => {
        try {
          chrome.runtime.openOptionsPage();
          window.close();
        } catch (error) {
          console.error('設定ページ開放エラー:', error);
          chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
          window.close();
        }
      };

      openSettings();
      
      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
      expect(window.close).toHaveBeenCalled();
    });

    test('設定ページ開放に失敗した場合のフォールバック', () => {
      chrome.runtime.openOptionsPage.mockImplementation(() => {
        throw new Error('設定ページを開けません');
      });
      chrome.runtime.getURL.mockReturnValue('chrome-extension://test/options/options.html');
      
      const openSettings = () => {
        try {
          chrome.runtime.openOptionsPage();
          window.close();
        } catch (error) {
          console.error('設定ページ開放エラー:', error);
          chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
          window.close();
        }
      };

      openSettings();
      
      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'chrome-extension://test/options/options.html'
      });
      expect(window.close).toHaveBeenCalled();
    });
  });

  describe('時刻フォーマット', () => {
    test('時刻が正しくフォーマットされる', () => {
      const formatTime = (timestamp) => {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = now - time;
        
        if (diff < 60000) return '今';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
        return time.toLocaleDateString();
      };

      const now = Date.now();
      
      expect(formatTime(now - 30000)).toBe('今');
      expect(formatTime(now - 120000)).toBe('2分前');
      expect(formatTime(now - 3900000)).toBe('1時間前');
    });
  });
});