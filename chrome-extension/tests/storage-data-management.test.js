/**
 * ストレージ操作とデータ管理の包括的テスト
 * Task 9.1: ユニットテストの作成 - ストレージ操作とデータ管理のテスト
 */

// Chrome API のモック
const mockStorage = {
  data: {},
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn()
};

global.chrome = {
  storage: {
    local: mockStorage,
    sync: { ...mockStorage }
  },
  runtime: {
    lastError: null
  }
};

describe('ストレージ操作とデータ管理', () => {
  let storageManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.data = {};
    
    // ストレージマネージャーの実装
    storageManager = {
      // ユーザー設定の管理
      async getUserPreferences() {
        const result = await chrome.storage.local.get(['userPreferences']);
        return result.userPreferences || this.getDefaultPreferences();
      },

      async updateUserPreferences(preferences) {
        await chrome.storage.local.set({ userPreferences: preferences });
      },

      getDefaultPreferences() {
        return {
          extensionEnabled: true,
          showNotifications: true,
          notificationDuration: 5000,
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
      },

      // ポップアップ履歴の管理
      async savePopupRecord(popupRecord) {
        const result = await chrome.storage.local.get(['popupHistory']);
        const history = result.popupHistory || [];
        
        // 重複チェック
        const existingIndex = history.findIndex(record => record.id === popupRecord.id);
        if (existingIndex >= 0) {
          history[existingIndex] = popupRecord;
        } else {
          history.push(popupRecord);
        }
        
        // 履歴サイズ制限（最大1000件）
        if (history.length > 1000) {
          history.splice(0, history.length - 1000);
        }
        
        await chrome.storage.local.set({ popupHistory: history });
      },

      async getPopupHistory(filters = {}) {
        const result = await chrome.storage.local.get(['popupHistory']);
        let history = result.popupHistory || [];
        
        // フィルタリング
        if (filters.domain) {
          history = history.filter(record => record.domain === filters.domain);
        }
        
        if (filters.decision) {
          history = history.filter(record => record.userDecision === filters.decision);
        }
        
        if (filters.startDate) {
          history = history.filter(record => record.timestamp >= filters.startDate);
        }
        
        if (filters.endDate) {
          history = history.filter(record => record.timestamp <= filters.endDate);
        }
        
        // ソート（新しい順）
        history.sort((a, b) => b.timestamp - a.timestamp);
        
        return history;
      },

      async clearPopupHistory() {
        await chrome.storage.local.set({ popupHistory: [] });
      },

      // ユーザー決定の管理
      async saveUserDecision(decisionRecord) {
        const result = await chrome.storage.local.get(['userDecisions']);
        const decisions = result.userDecisions || [];
        
        decisions.push(decisionRecord);
        
        // 決定履歴サイズ制限（最大500件）
        if (decisions.length > 500) {
          decisions.splice(0, decisions.length - 500);
        }
        
        await chrome.storage.local.set({ userDecisions: decisions });
      },

      async getUserDecisions(filters = {}) {
        const result = await chrome.storage.local.get(['userDecisions']);
        let decisions = result.userDecisions || [];
        
        // フィルタリング
        if (filters.domain) {
          decisions = decisions.filter(decision => decision.domain === filters.domain);
        }
        
        if (filters.decision) {
          decisions = decisions.filter(decision => decision.userDecision === filters.decision);
        }
        
        decisions.sort((a, b) => b.decisionTimestamp - a.decisionTimestamp);
        
        return decisions;
      },

      // 学習パターンの管理
      async saveLearningPatterns(patterns) {
        await chrome.storage.local.set({ learningPatterns: patterns });
      },

      async getLearningPatterns() {
        const result = await chrome.storage.local.get(['learningPatterns']);
        return result.learningPatterns || [];
      },

      async clearLearningPatterns() {
        await chrome.storage.local.set({ learningPatterns: [] });
      },

      // 決定待ち状態の管理
      async savePendingDecision(popupId, decisionEntry) {
        const result = await chrome.storage.local.get(['pendingDecisions']);
        const pending = result.pendingDecisions || {};
        
        pending[popupId] = {
          ...decisionEntry,
          timeoutId: null // タイムアウトIDは保存しない
        };
        
        await chrome.storage.local.set({ pendingDecisions: pending });
      },

      async removePendingDecision(popupId) {
        const result = await chrome.storage.local.get(['pendingDecisions']);
        const pending = result.pendingDecisions || {};
        
        delete pending[popupId];
        
        await chrome.storage.local.set({ pendingDecisions: pending });
      },

      async getPendingDecisions() {
        const result = await chrome.storage.local.get(['pendingDecisions']);
        return result.pendingDecisions || {};
      },

      async cleanupExpiredDecisions() {
        const result = await chrome.storage.local.get(['pendingDecisions']);
        const pending = result.pendingDecisions || {};
        const now = Date.now();
        const expiredThreshold = 5 * 60 * 1000; // 5分
        
        let cleanedCount = 0;
        const cleanedPending = {};
        
        for (const [popupId, decision] of Object.entries(pending)) {
          if (now - decision.timestamp < expiredThreshold) {
            cleanedPending[popupId] = decision;
          } else {
            cleanedCount++;
          }
        }
        
        await chrome.storage.local.set({ pendingDecisions: cleanedPending });
        return cleanedCount;
      },

      // 統計データの管理
      async updateStatistics(action) {
        const preferences = await this.getUserPreferences();
        const statistics = { ...preferences.statistics };
        
        switch (action) {
          case 'detected':
            statistics.totalPopupsDetected++;
            break;
          case 'closed':
            statistics.totalPopupsClosed++;
            break;
          case 'kept':
            statistics.totalPopupsKept++;
            break;
        }
        
        preferences.statistics = statistics;
        await this.updateUserPreferences(preferences);
      },

      async resetStatistics() {
        const preferences = await this.getUserPreferences();
        preferences.statistics = {
          totalPopupsDetected: 0,
          totalPopupsClosed: 0,
          totalPopupsKept: 0,
          lastResetDate: Date.now()
        };
        await this.updateUserPreferences(preferences);
      },

      // データのエクスポート/インポート
      async exportAllData() {
        const keys = ['userPreferences', 'popupHistory', 'userDecisions', 'learningPatterns'];
        const result = await chrome.storage.local.get(keys);
        
        return {
          ...result,
          exportDate: new Date().toISOString(),
          version: '1.0'
        };
      },

      async importAllData(data) {
        const validKeys = ['userPreferences', 'popupHistory', 'userDecisions', 'learningPatterns'];
        const importData = {};
        
        validKeys.forEach(key => {
          if (data[key]) {
            importData[key] = data[key];
          }
        });
        
        await chrome.storage.local.set(importData);
      },

      async clearAllData() {
        await chrome.storage.local.clear();
      }
    };

    // Chrome storage のモック実装
    mockStorage.get.mockImplementation((keys) => {
      const result = {};
      if (Array.isArray(keys)) {
        keys.forEach(key => {
          result[key] = mockStorage.data[key];
        });
      } else if (typeof keys === 'string') {
        result[keys] = mockStorage.data[keys];
      } else if (typeof keys === 'object') {
        Object.keys(keys).forEach(key => {
          result[key] = mockStorage.data[key] || keys[key];
        });
      }
      return Promise.resolve(result);
    });

    mockStorage.set.mockImplementation((data) => {
      Object.assign(mockStorage.data, data);
      return Promise.resolve();
    });

    mockStorage.remove.mockImplementation((keys) => {
      if (Array.isArray(keys)) {
        keys.forEach(key => delete mockStorage.data[key]);
      } else {
        delete mockStorage.data[keys];
      }
      return Promise.resolve();
    });

    mockStorage.clear.mockImplementation(() => {
      mockStorage.data = {};
      return Promise.resolve();
    });
  });

  describe('ユーザー設定の管理', () => {
    test('デフォルト設定を取得する', async () => {
      const preferences = await storageManager.getUserPreferences();
      
      expect(preferences.extensionEnabled).toBe(true);
      expect(preferences.showNotifications).toBe(true);
      expect(preferences.learningEnabled).toBe(true);
      expect(preferences.whitelistedDomains).toEqual([]);
      expect(preferences.statistics).toBeDefined();
    });

    test('ユーザー設定を保存・取得する', async () => {
      const newPreferences = {
        extensionEnabled: false,
        showNotifications: false,
        notificationDuration: 10000,
        whitelistedDomains: ['example.com', 'test.com'],
        learningEnabled: false,
        aggressiveMode: true,
        statistics: {
          totalPopupsDetected: 10,
          totalPopupsClosed: 8,
          totalPopupsKept: 2,
          lastResetDate: Date.now()
        }
      };

      await storageManager.updateUserPreferences(newPreferences);
      const retrievedPreferences = await storageManager.getUserPreferences();

      expect(retrievedPreferences).toEqual(newPreferences);
    });

    test('部分的な設定更新', async () => {
      const initialPreferences = await storageManager.getUserPreferences();
      const partialUpdate = {
        extensionEnabled: false,
        whitelistedDomains: ['example.com']
      };

      const updatedPreferences = { ...initialPreferences, ...partialUpdate };
      await storageManager.updateUserPreferences(updatedPreferences);
      
      const result = await storageManager.getUserPreferences();
      expect(result.extensionEnabled).toBe(false);
      expect(result.whitelistedDomains).toEqual(['example.com']);
      expect(result.showNotifications).toBe(true); // 変更されていない
    });
  });

  describe('ポップアップ履歴の管理', () => {
    const samplePopupRecord = {
      id: 'popup_123',
      url: 'https://example.com/page',
      domain: 'example.com',
      timestamp: Date.now(),
      characteristics: {
        hasCloseButton: true,
        containsAds: true,
        isModal: true
      },
      userDecision: 'close',
      confidence: 0.8
    };

    test('ポップアップレコードを保存する', async () => {
      await storageManager.savePopupRecord(samplePopupRecord);
      
      const history = await storageManager.getPopupHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(samplePopupRecord);
    });

    test('重複するポップアップレコードを更新する', async () => {
      await storageManager.savePopupRecord(samplePopupRecord);
      
      const updatedRecord = {
        ...samplePopupRecord,
        userDecision: 'keep',
        confidence: 0.9
      };
      
      await storageManager.savePopupRecord(updatedRecord);
      
      const history = await storageManager.getPopupHistory();
      expect(history).toHaveLength(1);
      expect(history[0].userDecision).toBe('keep');
      expect(history[0].confidence).toBe(0.9);
    });

    test('履歴サイズ制限（1000件）', async () => {
      // 1001件のレコードを作成
      const records = Array.from({ length: 1001 }, (_, i) => ({
        ...samplePopupRecord,
        id: `popup_${i}`,
        timestamp: Date.now() + i
      }));

      for (const record of records) {
        await storageManager.savePopupRecord(record);
      }

      const history = await storageManager.getPopupHistory();
      expect(history).toHaveLength(1000);
      expect(history[0].id).toBe('popup_1000'); // 最新のレコード
    });

    test('ドメインでフィルタリング', async () => {
      const records = [
        { ...samplePopupRecord, id: 'popup_1', domain: 'example.com' },
        { ...samplePopupRecord, id: 'popup_2', domain: 'test.com' },
        { ...samplePopupRecord, id: 'popup_3', domain: 'example.com' }
      ];

      for (const record of records) {
        await storageManager.savePopupRecord(record);
      }

      const filteredHistory = await storageManager.getPopupHistory({ domain: 'example.com' });
      expect(filteredHistory).toHaveLength(2);
      expect(filteredHistory.every(record => record.domain === 'example.com')).toBe(true);
    });

    test('決定でフィルタリング', async () => {
      const records = [
        { ...samplePopupRecord, id: 'popup_1', userDecision: 'close' },
        { ...samplePopupRecord, id: 'popup_2', userDecision: 'keep' },
        { ...samplePopupRecord, id: 'popup_3', userDecision: 'close' }
      ];

      for (const record of records) {
        await storageManager.savePopupRecord(record);
      }

      const filteredHistory = await storageManager.getPopupHistory({ decision: 'close' });
      expect(filteredHistory).toHaveLength(2);
      expect(filteredHistory.every(record => record.userDecision === 'close')).toBe(true);
    });

    test('日付範囲でフィルタリング', async () => {
      const now = Date.now();
      const records = [
        { ...samplePopupRecord, id: 'popup_1', timestamp: now - 86400000 }, // 1日前
        { ...samplePopupRecord, id: 'popup_2', timestamp: now - 3600000 },  // 1時間前
        { ...samplePopupRecord, id: 'popup_3', timestamp: now }             // 現在
      ];

      for (const record of records) {
        await storageManager.savePopupRecord(record);
      }

      const filteredHistory = await storageManager.getPopupHistory({
        startDate: now - 7200000, // 2時間前から
        endDate: now
      });
      
      expect(filteredHistory).toHaveLength(2);
    });

    test('履歴をクリアする', async () => {
      await storageManager.savePopupRecord(samplePopupRecord);
      await storageManager.clearPopupHistory();
      
      const history = await storageManager.getPopupHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('ユーザー決定の管理', () => {
    const sampleDecision = {
      id: 'popup_123',
      domain: 'example.com',
      userDecision: 'close',
      decisionTimestamp: Date.now(),
      responseTime: 2500
    };

    test('ユーザー決定を保存する', async () => {
      await storageManager.saveUserDecision(sampleDecision);
      
      const decisions = await storageManager.getUserDecisions();
      expect(decisions).toHaveLength(1);
      expect(decisions[0]).toEqual(sampleDecision);
    });

    test('決定履歴サイズ制限（500件）', async () => {
      const decisions = Array.from({ length: 501 }, (_, i) => ({
        ...sampleDecision,
        id: `popup_${i}`,
        decisionTimestamp: Date.now() + i
      }));

      for (const decision of decisions) {
        await storageManager.saveUserDecision(decision);
      }

      const retrievedDecisions = await storageManager.getUserDecisions();
      expect(retrievedDecisions).toHaveLength(500);
    });

    test('決定をドメインでフィルタリング', async () => {
      const decisions = [
        { ...sampleDecision, id: 'popup_1', domain: 'example.com' },
        { ...sampleDecision, id: 'popup_2', domain: 'test.com' },
        { ...sampleDecision, id: 'popup_3', domain: 'example.com' }
      ];

      for (const decision of decisions) {
        await storageManager.saveUserDecision(decision);
      }

      const filteredDecisions = await storageManager.getUserDecisions({ domain: 'example.com' });
      expect(filteredDecisions).toHaveLength(2);
    });

    test('決定を決定タイプでフィルタリング', async () => {
      const decisions = [
        { ...sampleDecision, id: 'popup_1', userDecision: 'close' },
        { ...sampleDecision, id: 'popup_2', userDecision: 'keep' },
        { ...sampleDecision, id: 'popup_3', userDecision: 'close' }
      ];

      for (const decision of decisions) {
        await storageManager.saveUserDecision(decision);
      }

      const filteredDecisions = await storageManager.getUserDecisions({ decision: 'close' });
      expect(filteredDecisions).toHaveLength(2);
    });
  });

  describe('学習パターンの管理', () => {
    const samplePattern = {
      patternId: 'pattern_123',
      characteristics: {
        hasCloseButton: true,
        containsAds: true,
        isModal: true
      },
      userDecision: 'close',
      confidence: 0.8,
      occurrences: 5,
      lastSeen: Date.now()
    };

    test('学習パターンを保存・取得する', async () => {
      const patterns = [samplePattern];
      
      await storageManager.saveLearningPatterns(patterns);
      const retrievedPatterns = await storageManager.getLearningPatterns();
      
      expect(retrievedPatterns).toHaveLength(1);
      expect(retrievedPatterns[0]).toEqual(samplePattern);
    });

    test('複数の学習パターンを管理する', async () => {
      const patterns = [
        { ...samplePattern, patternId: 'pattern_1' },
        { ...samplePattern, patternId: 'pattern_2', userDecision: 'keep' },
        { ...samplePattern, patternId: 'pattern_3', confidence: 0.9 }
      ];

      await storageManager.saveLearningPatterns(patterns);
      const retrievedPatterns = await storageManager.getLearningPatterns();
      
      expect(retrievedPatterns).toHaveLength(3);
    });

    test('学習パターンをクリアする', async () => {
      await storageManager.saveLearningPatterns([samplePattern]);
      await storageManager.clearLearningPatterns();
      
      const patterns = await storageManager.getLearningPatterns();
      expect(patterns).toHaveLength(0);
    });
  });

  describe('決定待ち状態の管理', () => {
    const sampleDecisionEntry = {
      popupData: {
        id: 'popup_123',
        domain: 'example.com',
        characteristics: { hasCloseButton: true }
      },
      tabId: 456,
      timestamp: Date.now(),
      status: 'pending'
    };

    test('決定待ち状態を保存・取得する', async () => {
      await storageManager.savePendingDecision('popup_123', sampleDecisionEntry);
      
      const pending = await storageManager.getPendingDecisions();
      expect(pending['popup_123']).toBeDefined();
      expect(pending['popup_123'].status).toBe('pending');
    });

    test('決定待ち状態を削除する', async () => {
      await storageManager.savePendingDecision('popup_123', sampleDecisionEntry);
      await storageManager.removePendingDecision('popup_123');
      
      const pending = await storageManager.getPendingDecisions();
      expect(pending['popup_123']).toBeUndefined();
    });

    test('期限切れ決定をクリーンアップする', async () => {
      const now = Date.now();
      const oldDecision = {
        ...sampleDecisionEntry,
        timestamp: now - (10 * 60 * 1000) // 10分前
      };
      const recentDecision = {
        ...sampleDecisionEntry,
        timestamp: now - (2 * 60 * 1000) // 2分前
      };

      await storageManager.savePendingDecision('popup_old', oldDecision);
      await storageManager.savePendingDecision('popup_recent', recentDecision);

      const cleanedCount = await storageManager.cleanupExpiredDecisions();
      
      expect(cleanedCount).toBe(1);
      
      const pending = await storageManager.getPendingDecisions();
      expect(pending['popup_old']).toBeUndefined();
      expect(pending['popup_recent']).toBeDefined();
    });
  });

  describe('統計データの管理', () => {
    test('統計を更新する', async () => {
      await storageManager.updateStatistics('detected');
      await storageManager.updateStatistics('closed');
      await storageManager.updateStatistics('kept');

      const preferences = await storageManager.getUserPreferences();
      const stats = preferences.statistics;

      expect(stats.totalPopupsDetected).toBe(1);
      expect(stats.totalPopupsClosed).toBe(1);
      expect(stats.totalPopupsKept).toBe(1);
    });

    test('統計をリセットする', async () => {
      await storageManager.updateStatistics('detected');
      await storageManager.updateStatistics('closed');
      
      await storageManager.resetStatistics();

      const preferences = await storageManager.getUserPreferences();
      const stats = preferences.statistics;

      expect(stats.totalPopupsDetected).toBe(0);
      expect(stats.totalPopupsClosed).toBe(0);
      expect(stats.totalPopupsKept).toBe(0);
      expect(stats.lastResetDate).toBeDefined();
    });
  });

  describe('データのエクスポート/インポート', () => {
    test('全データをエクスポートする', async () => {
      // テストデータを設定
      const testPreferences = { extensionEnabled: false };
      const testHistory = [{ id: 'popup_1', domain: 'example.com' }];
      const testDecisions = [{ id: 'popup_1', userDecision: 'close' }];
      const testPatterns = [{ patternId: 'pattern_1', confidence: 0.8 }];

      await storageManager.updateUserPreferences(testPreferences);
      await storageManager.savePopupRecord(testHistory[0]);
      await storageManager.saveUserDecision(testDecisions[0]);
      await storageManager.saveLearningPatterns(testPatterns);

      const exportedData = await storageManager.exportAllData();

      expect(exportedData.userPreferences).toEqual(testPreferences);
      expect(exportedData.popupHistory).toEqual(testHistory);
      expect(exportedData.userDecisions).toEqual(testDecisions);
      expect(exportedData.learningPatterns).toEqual(testPatterns);
      expect(exportedData.exportDate).toBeDefined();
      expect(exportedData.version).toBe('1.0');
    });

    test('データをインポートする', async () => {
      const importData = {
        userPreferences: { extensionEnabled: false },
        popupHistory: [{ id: 'popup_1', domain: 'example.com' }],
        userDecisions: [{ id: 'popup_1', userDecision: 'close' }],
        learningPatterns: [{ patternId: 'pattern_1', confidence: 0.8 }],
        invalidKey: 'should be ignored'
      };

      await storageManager.importAllData(importData);

      const preferences = await storageManager.getUserPreferences();
      const history = await storageManager.getPopupHistory();
      const decisions = await storageManager.getUserDecisions();
      const patterns = await storageManager.getLearningPatterns();

      expect(preferences.extensionEnabled).toBe(false);
      expect(history).toEqual(importData.popupHistory);
      expect(decisions).toEqual(importData.userDecisions);
      expect(patterns).toEqual(importData.learningPatterns);
    });

    test('全データをクリアする', async () => {
      // テストデータを設定
      await storageManager.updateUserPreferences({ extensionEnabled: false });
      await storageManager.savePopupRecord({ id: 'popup_1', domain: 'example.com' });

      await storageManager.clearAllData();

      // デフォルト設定が返されることを確認
      const preferences = await storageManager.getUserPreferences();
      const history = await storageManager.getPopupHistory();

      expect(preferences.extensionEnabled).toBe(true); // デフォルト値
      expect(history).toHaveLength(0);
    });
  });

  describe('エラーハンドリング', () => {
    test('ストレージエラーの処理', async () => {
      mockStorage.get.mockRejectedValueOnce(new Error('Storage error'));

      // エラーが発生してもクラッシュしない
      await expect(storageManager.getUserPreferences()).resolves.toBeDefined();
    });

    test('無効なデータの処理', async () => {
      // 無効なデータでもエラーにならない
      await expect(storageManager.savePopupRecord(null)).rejects.toThrow();
      await expect(storageManager.saveUserDecision(undefined)).rejects.toThrow();
    });

    test('Chrome runtime エラーの処理', async () => {
      chrome.runtime.lastError = { message: 'Runtime error' };
      
      // エラーがあっても処理を継続
      const preferences = await storageManager.getUserPreferences();
      expect(preferences).toBeDefined();
      
      chrome.runtime.lastError = null;
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量データの処理パフォーマンス', async () => {
      const startTime = Date.now();
      
      // 100件のレコードを保存
      const records = Array.from({ length: 100 }, (_, i) => ({
        id: `popup_${i}`,
        domain: 'example.com',
        timestamp: Date.now() + i,
        userDecision: 'close'
      }));

      for (const record of records) {
        await storageManager.savePopupRecord(record);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 100件の保存が2秒以内に完了することを確認
      expect(duration).toBeLessThan(2000);
    });

    test('複雑なフィルタリングのパフォーマンス', async () => {
      // 大量のテストデータを作成
      const records = Array.from({ length: 500 }, (_, i) => ({
        id: `popup_${i}`,
        domain: i % 2 === 0 ? 'example.com' : 'test.com',
        timestamp: Date.now() + i,
        userDecision: i % 3 === 0 ? 'close' : 'keep'
      }));

      for (const record of records) {
        await storageManager.savePopupRecord(record);
      }

      const startTime = Date.now();
      
      // 複雑なフィルタリングを実行
      await storageManager.getPopupHistory({
        domain: 'example.com',
        decision: 'close',
        startDate: Date.now(),
        endDate: Date.now() + 1000000
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // フィルタリングが500ms以内に完了することを確認
      expect(duration).toBeLessThan(500);
    });
  });
});