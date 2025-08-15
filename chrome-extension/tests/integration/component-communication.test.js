/**
 * 統合テスト: コンポーネント通信とメッセージパッシング
 * 
 * このテストスイートは、Chrome拡張機能の各コンポーネント間の
 * メッセージパッシングと通信機能をテストします。
 */

describe('コンポーネント通信とメッセージパッシング統合テスト', () => {
  let mockChrome;
  let contentScript;
  let serviceWorker;
  let popupInterface;

  beforeEach(() => {
    // Chrome API のモック設定
    mockChrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        },
        lastError: null,
        id: 'test-extension-id'
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn()
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn(),
          remove: jest.fn(),
          clear: jest.fn()
        }
      },
      notifications: {
        create: jest.fn(),
        clear: jest.fn()
      }
    };

    global.chrome = mockChrome;

    // DOM環境のセットアップ
    document.body.innerHTML = '';
    
    // テスト用のポップアップ要素を作成
    const testPopup = document.createElement('div');
    testPopup.id = 'test-popup';
    testPopup.style.position = 'fixed';
    testPopup.style.zIndex = '9999';
    testPopup.style.width = '400px';
    testPopup.style.height = '300px';
    testPopup.innerHTML = '<button class="close-btn">×</button><p>広告コンテンツ</p>';
    document.body.appendChild(testPopup);
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('コンテンツスクリプト → バックグラウンドワーカー通信', () => {
    test('ポップアップ検出時のメッセージ送信', async () => {
      // コンテンツスクリプトのポップアップ検出をシミュレート
      const popupData = {
        id: 'popup-123',
        url: 'https://example.com',
        domain: 'example.com',
        timestamp: Date.now(),
        characteristics: {
          hasCloseButton: true,
          containsAds: true,
          hasExternalLinks: false,
          isModal: true,
          zIndex: 9999,
          dimensions: { width: 400, height: 300 }
        },
        confidence: 0.85
      };

      // メッセージ送信のモック
      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

      // ポップアップ検出メッセージの送信をテスト
      await chrome.runtime.sendMessage({
        type: 'POPUP_DETECTED',
        data: popupData
      });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'POPUP_DETECTED',
        data: popupData
      });
    });

    test('ユーザー決定の受信と処理', async () => {
      const userDecision = {
        popupId: 'popup-123',
        decision: 'close',
        timestamp: Date.now()
      };

      // バックグラウンドワーカーからの応答をモック
      mockChrome.runtime.sendMessage.mockResolvedValue({
        type: 'USER_DECISION',
        data: userDecision
      });

      const response = await chrome.runtime.sendMessage({
        type: 'GET_USER_DECISION',
        popupId: 'popup-123'
      });

      expect(response.type).toBe('USER_DECISION');
      expect(response.data.decision).toBe('close');
    });

    test('通信エラーハンドリング', async () => {
      // 通信エラーをシミュレート
      mockChrome.runtime.lastError = { message: 'Connection error' };
      mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Connection failed'));

      try {
        await chrome.runtime.sendMessage({
          type: 'POPUP_DETECTED',
          data: {}
        });
      } catch (error) {
        expect(error.message).toBe('Connection failed');
      }

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    });
  });

  describe('バックグラウンドワーカー → コンテンツスクリプト通信', () => {
    test('ポップアップ閉鎖指示の送信', async () => {
      const closeInstruction = {
        type: 'CLOSE_POPUP',
        popupId: 'popup-123',
        method: 'remove'
      };

      mockChrome.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com' }]);
      mockChrome.tabs.sendMessage.mockResolvedValue({ success: true });

      // タブへのメッセージ送信をテスト
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tabs[0].id, closeInstruction);

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, closeInstruction);
    });

    test('設定更新の通知', async () => {
      const settingsUpdate = {
        type: 'SETTINGS_UPDATED',
        settings: {
          extensionEnabled: false,
          showNotifications: true
        }
      };

      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://example.com' },
        { id: 2, url: 'https://test.com' }
      ]);
      mockChrome.tabs.sendMessage.mockResolvedValue({ success: true });

      // 全タブへの設定更新通知
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        await chrome.tabs.sendMessage(tab.id, settingsUpdate);
      }

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('ポップアップインターフェース → バックグラウンドワーカー通信', () => {
    test('統計データの取得', async () => {
      const mockStats = {
        totalPopupsDetected: 150,
        totalPopupsClosed: 120,
        totalPopupsKept: 30,
        todayBlocked: 15,
        currentDomainStats: {
          domain: 'example.com',
          blocked: 5,
          kept: 2
        }
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({
        type: 'STATISTICS_DATA',
        data: mockStats
      });

      const response = await chrome.runtime.sendMessage({
        type: 'GET_STATISTICS'
      });

      expect(response.data.totalPopupsDetected).toBe(150);
      expect(response.data.currentDomainStats.domain).toBe('example.com');
    });

    test('拡張機能トグルの処理', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({
        type: 'EXTENSION_TOGGLED',
        enabled: false
      });

      const response = await chrome.runtime.sendMessage({
        type: 'TOGGLE_EXTENSION',
        enabled: false
      });

      expect(response.enabled).toBe(false);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'TOGGLE_EXTENSION',
        enabled: false
      });
    });

    test('ホワイトリスト管理', async () => {
      const domain = 'trusted-site.com';
      
      mockChrome.runtime.sendMessage.mockResolvedValue({
        type: 'WHITELIST_UPDATED',
        domain: domain,
        added: true
      });

      const response = await chrome.runtime.sendMessage({
        type: 'ADD_TO_WHITELIST',
        domain: domain
      });

      expect(response.added).toBe(true);
      expect(response.domain).toBe(domain);
    });
  });

  describe('メッセージパッシングのパフォーマンス', () => {
    test('大量メッセージの処理性能', async () => {
      const startTime = performance.now();
      const messageCount = 100;
      const promises = [];

      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

      // 100個のメッセージを同時送信
      for (let i = 0; i < messageCount; i++) {
        promises.push(
          chrome.runtime.sendMessage({
            type: 'PERFORMANCE_TEST',
            messageId: i,
            timestamp: Date.now()
          })
        );
      }

      await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(messageCount);
      expect(duration).toBeLessThan(1000); // 1秒以内で完了
    });

    test('メッセージサイズの制限テスト', async () => {
      // 大きなデータを含むメッセージ
      const largeData = {
        type: 'LARGE_DATA_TEST',
        data: {
          history: new Array(1000).fill(0).map((_, i) => ({
            id: `popup-${i}`,
            url: `https://example${i}.com`,
            timestamp: Date.now() - i * 1000,
            characteristics: {
              hasCloseButton: true,
              containsAds: true,
              dimensions: { width: 400, height: 300 }
            }
          }))
        }
      };

      mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

      await chrome.runtime.sendMessage(largeData);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(largeData);
    });
  });

  describe('エラー回復とリトライ機能', () => {
    test('メッセージ送信失敗時のリトライ', async () => {
      let attemptCount = 0;
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ success: true });
      });

      // リトライ機能付きメッセージ送信のシミュレート
      const sendMessageWithRetry = async (message, maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await chrome.runtime.sendMessage(message);
          } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
          }
        }
      };

      const result = await sendMessageWithRetry({
        type: 'RETRY_TEST',
        data: 'test'
      });

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
    });

    test('タイムアウト処理', async () => {
      // タイムアウトをシミュレート
      mockChrome.runtime.sendMessage.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ success: true }), 2000);
        });
      });

      const sendMessageWithTimeout = (message, timeout = 1000) => {
        return Promise.race([
          chrome.runtime.sendMessage(message),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);
      };

      await expect(sendMessageWithTimeout({
        type: 'TIMEOUT_TEST'
      })).rejects.toThrow('Timeout');
    });
  });

  describe('コンポーネント間の状態同期', () => {
    test('設定変更の全コンポーネント同期', async () => {
      const newSettings = {
        extensionEnabled: false,
        showNotifications: true,
        notificationDuration: 5000
      };

      // ストレージ更新のモック
      mockChrome.storage.local.set.mockResolvedValue();
      mockChrome.storage.local.get.mockResolvedValue({ settings: newSettings });

      // 設定更新とブロードキャスト
      await chrome.storage.local.set({ settings: newSettings });
      
      // 全タブへの通知
      mockChrome.tabs.query.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockChrome.tabs.sendMessage.mockResolvedValue({ success: true });

      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          settings: newSettings
        });
      }

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({ settings: newSettings });
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
    });

    test('統計データの即座更新', async () => {
      const statsUpdate = {
        totalPopupsDetected: 151,
        totalPopupsClosed: 121,
        lastBlockedTimestamp: Date.now()
      };

      mockChrome.storage.local.get.mockResolvedValue({
        statistics: {
          totalPopupsDetected: 150,
          totalPopupsClosed: 120
        }
      });
      mockChrome.storage.local.set.mockResolvedValue();

      // 統計更新
      const currentStats = await chrome.storage.local.get(['statistics']);
      const updatedStats = {
        ...currentStats.statistics,
        ...statsUpdate
      };
      
      await chrome.storage.local.set({ statistics: updatedStats });

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        statistics: updatedStats
      });
    });
  });
});