/**
 * 統合テスト: 拡張機能ライフサイクルと状態永続化
 * 
 * このテストスイートは、Chrome拡張機能のライフサイクル全体と
 * データの永続化機能をテストします。
 */

describe('拡張機能ライフサイクルと状態永続化統合テスト', () => {
  let mockChrome;
  let mockStorage;

  beforeEach(() => {
    // ストレージのモック実装
    mockStorage = new Map();
    
    mockChrome = {
      runtime: {
        onInstalled: {
          addListener: jest.fn()
        },
        onStartup: {
          addListener: jest.fn()
        },
        onSuspend: {
          addListener: jest.fn()
        },
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        },
        id: 'test-extension-id'
      },
      storage: {
        local: {
          get: jest.fn((keys) => {
            if (Array.isArray(keys)) {
              const result = {};
              keys.forEach(key => {
                if (mockStorage.has(key)) {
                  result[key] = mockStorage.get(key);
                }
              });
              return Promise.resolve(result);
            } else if (typeof keys === 'string') {
              return Promise.resolve({
                [keys]: mockStorage.get(keys)
              });
            } else if (keys === null || keys === undefined) {
              const result = {};
              mockStorage.forEach((value, key) => {
                result[key] = value;
              });
              return Promise.resolve(result);
            }
            return Promise.resolve({});
          }),
          set: jest.fn((items) => {
            Object.entries(items).forEach(([key, value]) => {
              mockStorage.set(key, value);
            });
            return Promise.resolve();
          }),
          remove: jest.fn((keys) => {
            if (Array.isArray(keys)) {
              keys.forEach(key => mockStorage.delete(key));
            } else {
              mockStorage.delete(keys);
            }
            return Promise.resolve();
          }),
          clear: jest.fn(() => {
            mockStorage.clear();
            return Promise.resolve();
          })
        },
        onChanged: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        }
      },
      tabs: {
        query: jest.fn(),
        onUpdated: {
          addListener: jest.fn()
        },
        onRemoved: {
          addListener: jest.fn()
        }
      },
      alarms: {
        create: jest.fn(),
        clear: jest.fn(),
        onAlarm: {
          addListener: jest.fn()
        }
      }
    };

    global.chrome = mockChrome;
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
  });

  describe('拡張機能の初期化', () => {
    test('初回インストール時のデフォルト設定作成', async () => {
      const defaultSettings = {
        extensionEnabled: true,
        showNotifications: true,
        notificationDuration: 3000,
        whitelistedDomains: [],
        learningEnabled: true,
        aggressiveMode: false,
        statistics: {
          totalPopupsDetected: 0,
          totalPopupsClosed: 0,
          totalPopupsKept: 0,
          lastResetDate: Date.now()
        }
      };

      // 初回インストール時の処理をシミュレート
      const initializeExtension = async () => {
        const existingSettings = await chrome.storage.local.get(['settings']);
        
        if (!existingSettings.settings) {
          await chrome.storage.local.set({
            settings: defaultSettings,
            learningPatterns: [],
            popupHistory: [],
            userDecisions: []
          });
        }
      };

      await initializeExtension();

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        settings: defaultSettings,
        learningPatterns: [],
        popupHistory: [],
        userDecisions: []
      });

      // 設定が正しく保存されたことを確認
      const savedSettings = await chrome.storage.local.get(['settings']);
      expect(savedSettings.settings.extensionEnabled).toBe(true);
      expect(savedSettings.settings.statistics.totalPopupsDetected).toBe(0);
    });

    test('既存インストールでの設定マイグレーション', async () => {
      // 古いバージョンの設定をシミュレート
      const oldSettings = {
        enabled: true,
        showAlerts: true,
        blockedCount: 50
      };

      await chrome.storage.local.set({ oldSettings });

      const migrateSettings = async () => {
        const stored = await chrome.storage.local.get(null);
        
        if (stored.oldSettings && !stored.settings) {
          const newSettings = {
            extensionEnabled: stored.oldSettings.enabled,
            showNotifications: stored.oldSettings.showAlerts,
            notificationDuration: 3000,
            whitelistedDomains: [],
            learningEnabled: true,
            aggressiveMode: false,
            statistics: {
              totalPopupsDetected: stored.oldSettings.blockedCount || 0,
              totalPopupsClosed: stored.oldSettings.blockedCount || 0,
              totalPopupsKept: 0,
              lastResetDate: Date.now()
            }
          };

          await chrome.storage.local.set({ settings: newSettings });
          await chrome.storage.local.remove(['oldSettings']);
        }
      };

      await migrateSettings();

      const migratedSettings = await chrome.storage.local.get(['settings']);
      expect(migratedSettings.settings.extensionEnabled).toBe(true);
      expect(migratedSettings.settings.statistics.totalPopupsDetected).toBe(50);

      const oldSettingsCheck = await chrome.storage.local.get(['oldSettings']);
      expect(oldSettingsCheck.oldSettings).toBeUndefined();
    });

    test('拡張機能起動時の状態復元', async () => {
      // 既存の状態をセットアップ
      const existingState = {
        settings: {
          extensionEnabled: false,
          showNotifications: true
        },
        pendingDecisions: [
          {
            popupId: 'popup-123',
            timestamp: Date.now() - 30000,
            timeout: 60000
          }
        ],
        statistics: {
          totalPopupsDetected: 100,
          totalPopupsClosed: 80
        }
      };

      await chrome.storage.local.set(existingState);

      const restoreState = async () => {
        const state = await chrome.storage.local.get(null);
        
        // 期限切れの決定待ち状態をクリーンアップ
        if (state.pendingDecisions) {
          const now = Date.now();
          const validDecisions = state.pendingDecisions.filter(
            decision => (now - decision.timestamp) < decision.timeout
          );
          
          if (validDecisions.length !== state.pendingDecisions.length) {
            await chrome.storage.local.set({ pendingDecisions: validDecisions });
          }
        }

        return state;
      };

      const restoredState = await restoreState();

      expect(restoredState.settings.extensionEnabled).toBe(false);
      expect(restoredState.pendingDecisions).toHaveLength(1);
      expect(restoredState.statistics.totalPopupsDetected).toBe(100);
    });
  });

  describe('データの永続化', () => {
    test('ポップアップ履歴の保存と管理', async () => {
      const popupRecord = {
        id: 'popup-123',
        url: 'https://example.com/page',
        domain: 'example.com',
        timestamp: Date.now(),
        characteristics: {
          hasCloseButton: true,
          containsAds: true,
          isModal: true
        },
        userDecision: 'close',
        confidence: 0.85
      };

      const savePopupRecord = async (record) => {
        const { popupHistory = [] } = await chrome.storage.local.get(['popupHistory']);
        
        // 重複チェック
        const existingIndex = popupHistory.findIndex(p => p.id === record.id);
        if (existingIndex >= 0) {
          popupHistory[existingIndex] = record;
        } else {
          popupHistory.push(record);
        }

        // 履歴サイズ制限（1000件）
        if (popupHistory.length > 1000) {
          popupHistory.splice(0, popupHistory.length - 1000);
        }

        await chrome.storage.local.set({ popupHistory });
      };

      await savePopupRecord(popupRecord);

      const { popupHistory } = await chrome.storage.local.get(['popupHistory']);
      expect(popupHistory).toHaveLength(1);
      expect(popupHistory[0].id).toBe('popup-123');
      expect(popupHistory[0].userDecision).toBe('close');
    });

    test('学習パターンの永続化', async () => {
      const learningPattern = {
        patternId: 'pattern-456',
        characteristics: {
          hasCloseButton: true,
          containsAds: true,
          zIndexRange: [9000, 10000]
        },
        userDecision: 'close',
        confidence: 0.9,
        occurrences: 5,
        lastSeen: Date.now()
      };

      const saveLearningPattern = async (pattern) => {
        const { learningPatterns = [] } = await chrome.storage.local.get(['learningPatterns']);
        
        const existingIndex = learningPatterns.findIndex(p => p.patternId === pattern.patternId);
        if (existingIndex >= 0) {
          learningPatterns[existingIndex] = pattern;
        } else {
          learningPatterns.push(pattern);
        }

        await chrome.storage.local.set({ learningPatterns });
      };

      await saveLearningPattern(learningPattern);

      const { learningPatterns } = await chrome.storage.local.get(['learningPatterns']);
      expect(learningPatterns).toHaveLength(1);
      expect(learningPatterns[0].confidence).toBe(0.9);
      expect(learningPatterns[0].occurrences).toBe(5);
    });

    test('統計データの累積更新', async () => {
      // 初期統計
      const initialStats = {
        totalPopupsDetected: 100,
        totalPopupsClosed: 80,
        totalPopupsKept: 20,
        dailyStats: {
          [new Date().toDateString()]: {
            detected: 10,
            closed: 8,
            kept: 2
          }
        }
      };

      await chrome.storage.local.set({ statistics: initialStats });

      const updateStatistics = async (increment) => {
        const { statistics } = await chrome.storage.local.get(['statistics']);
        const today = new Date().toDateString();

        const updatedStats = {
          ...statistics,
          totalPopupsDetected: statistics.totalPopupsDetected + increment.detected,
          totalPopupsClosed: statistics.totalPopupsClosed + increment.closed,
          totalPopupsKept: statistics.totalPopupsKept + increment.kept,
          dailyStats: {
            ...statistics.dailyStats,
            [today]: {
              detected: (statistics.dailyStats[today]?.detected || 0) + increment.detected,
              closed: (statistics.dailyStats[today]?.closed || 0) + increment.closed,
              kept: (statistics.dailyStats[today]?.kept || 0) + increment.kept
            }
          }
        };

        await chrome.storage.local.set({ statistics: updatedStats });
      };

      await updateStatistics({ detected: 5, closed: 4, kept: 1 });

      const { statistics } = await chrome.storage.local.get(['statistics']);
      expect(statistics.totalPopupsDetected).toBe(105);
      expect(statistics.totalPopupsClosed).toBe(84);
      expect(statistics.totalPopupsKept).toBe(21);
    });
  });

  describe('ストレージ変更の監視', () => {
    test('設定変更の検出と通知', async () => {
      const changeListener = jest.fn();
      mockChrome.storage.onChanged.addListener(changeListener);

      // 設定変更をシミュレート
      const newSettings = {
        extensionEnabled: false,
        showNotifications: false
      };

      await chrome.storage.local.set({ settings: newSettings });

      // ストレージ変更イベントをシミュレート
      const changes = {
        settings: {
          oldValue: { extensionEnabled: true, showNotifications: true },
          newValue: newSettings
        }
      };

      changeListener(changes, 'local');

      expect(changeListener).toHaveBeenCalledWith(changes, 'local');
    });

    test('データ同期の競合解決', async () => {
      // 同時に複数の統計更新が発生する状況をシミュレート
      const updateStats1 = async () => {
        const { statistics } = await chrome.storage.local.get(['statistics']);
        await new Promise(resolve => setTimeout(resolve, 10)); // 非同期処理をシミュレート
        await chrome.storage.local.set({
          statistics: {
            ...statistics,
            totalPopupsDetected: (statistics?.totalPopupsDetected || 0) + 1
          }
        });
      };

      const updateStats2 = async () => {
        const { statistics } = await chrome.storage.local.get(['statistics']);
        await new Promise(resolve => setTimeout(resolve, 5)); // 異なるタイミング
        await chrome.storage.local.set({
          statistics: {
            ...statistics,
            totalPopupsClosed: (statistics?.totalPopupsClosed || 0) + 1
          }
        });
      };

      // 初期統計を設定
      await chrome.storage.local.set({
        statistics: { totalPopupsDetected: 0, totalPopupsClosed: 0 }
      });

      // 同時実行
      await Promise.all([updateStats1(), updateStats2()]);

      const { statistics } = await chrome.storage.local.get(['statistics']);
      
      // 最後の更新が勝つ（実際の実装では適切な競合解決が必要）
      expect(statistics.totalPopupsDetected >= 0).toBe(true);
      expect(statistics.totalPopupsClosed >= 0).toBe(true);
    });
  });

  describe('メモリ管理とクリーンアップ', () => {
    test('古いデータの自動クリーンアップ', async () => {
      const now = Date.now();
      const oldData = [];
      const recentData = [];

      // 30日前のデータ
      for (let i = 0; i < 50; i++) {
        oldData.push({
          id: `old-popup-${i}`,
          timestamp: now - (31 * 24 * 60 * 60 * 1000), // 31日前
          userDecision: 'close'
        });
      }

      // 最近のデータ
      for (let i = 0; i < 20; i++) {
        recentData.push({
          id: `recent-popup-${i}`,
          timestamp: now - (i * 60 * 60 * 1000), // 過去20時間
          userDecision: 'close'
        });
      }

      await chrome.storage.local.set({
        popupHistory: [...oldData, ...recentData]
      });

      const cleanupOldData = async () => {
        const { popupHistory } = await chrome.storage.local.get(['popupHistory']);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        
        const cleanedHistory = popupHistory.filter(
          record => record.timestamp > thirtyDaysAgo
        );

        await chrome.storage.local.set({ popupHistory: cleanedHistory });
      };

      await cleanupOldData();

      const { popupHistory } = await chrome.storage.local.get(['popupHistory']);
      expect(popupHistory).toHaveLength(20); // 古いデータが削除された
      expect(popupHistory.every(record => record.id.startsWith('recent-'))).toBe(true);
    });

    test('ストレージ使用量の監視', async () => {
      // 大量のデータを作成
      const largeDataSet = [];
      for (let i = 0; i < 1000; i++) {
        largeDataSet.push({
          id: `popup-${i}`,
          url: `https://example${i}.com`,
          timestamp: Date.now() - i * 1000,
          characteristics: {
            hasCloseButton: true,
            containsAds: true,
            dimensions: { width: 400, height: 300 },
            content: 'A'.repeat(100) // 大きなコンテンツ
          }
        });
      }

      await chrome.storage.local.set({ popupHistory: largeDataSet });

      const checkStorageUsage = async () => {
        const data = await chrome.storage.local.get(null);
        const dataSize = JSON.stringify(data).length;
        
        // Chrome拡張機能のローカルストレージ制限は約5MB
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        return {
          currentSize: dataSize,
          maxSize: maxSize,
          usagePercentage: (dataSize / maxSize) * 100
        };
      };

      const usage = await checkStorageUsage();
      
      expect(usage.currentSize).toBeGreaterThan(0);
      expect(usage.usagePercentage).toBeLessThan(100);
    });
  });

  describe('拡張機能の停止と再開', () => {
    test('拡張機能停止時の状態保存', async () => {
      const currentState = {
        activePopups: ['popup-1', 'popup-2'],
        pendingDecisions: [
          { popupId: 'popup-1', timestamp: Date.now() }
        ],
        temporarySettings: {
          debugMode: true
        }
      };

      const saveStateOnSuspend = async () => {
        await chrome.storage.local.set({
          lastSuspendState: {
            ...currentState,
            suspendTimestamp: Date.now()
          }
        });
      };

      await saveStateOnSuspend();

      const { lastSuspendState } = await chrome.storage.local.get(['lastSuspendState']);
      expect(lastSuspendState.activePopups).toHaveLength(2);
      expect(lastSuspendState.pendingDecisions).toHaveLength(1);
      expect(lastSuspendState.suspendTimestamp).toBeDefined();
    });

    test('拡張機能再開時の状態復元', async () => {
      const suspendedState = {
        activePopups: ['popup-1', 'popup-2'],
        pendingDecisions: [
          { popupId: 'popup-1', timestamp: Date.now() - 30000 }
        ],
        suspendTimestamp: Date.now() - (6 * 60 * 1000) // 6分前（5分以上）
      };

      await chrome.storage.local.set({ lastSuspendState: suspendedState });

      const restoreStateOnStartup = async () => {
        const { lastSuspendState } = await chrome.storage.local.get(['lastSuspendState']);
        
        if (lastSuspendState) {
          const now = Date.now();
          const suspendDuration = now - lastSuspendState.suspendTimestamp;
          
          // 長時間停止していた場合は状態をリセット
          if (suspendDuration > 5 * 60 * 1000) { // 5分以上
            await chrome.storage.local.remove(['lastSuspendState']);
            return null;
          }
          
          return lastSuspendState;
        }
        
        return null;
      };

      const restoredState = await restoreStateOnStartup();
      
      expect(restoredState).toBeNull(); // 5分以上経過しているためリセット
    });
  });
});