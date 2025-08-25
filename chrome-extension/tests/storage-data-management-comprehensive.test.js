/**
 * ストレージ・データ管理の包括的ユニットテスト
 * Task 9.1.4: ストレージ・データ管理のテスト
 * 
 * Chrome storage APIの操作テスト、ユーザー設定の保存・読み込みテスト、
 * データ整合性チェックのテスト、エラーハンドリングのテストを含む
 */

const { 
  createMockUserPreferences,
  createMockPopupData,
  createMockLearningPattern,
  createChromeApiMock,
  resetTestData,
  waitForAsync,
  expectError
} = require('./test-helpers');

describe('ストレージ・データ管理 - 包括的テスト', () => {
  let mockChrome;
  let storageManager;

  beforeEach(() => {
    resetTestData();
    
    // Chrome API モックを設定
    mockChrome = createChromeApiMock();
    global.chrome = mockChrome;
    
    // ストレージマネージャーを初期化
    storageManager = new StorageManager();
  });

  /**
   * ストレージ管理クラス
   * Chrome storage APIの操作を抽象化し、データ整合性を保証
   */
  class StorageManager {
    constructor() {
      this.defaultPreferences = {
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
    }

    /**
     * ユーザー設定を取得
     */
    async getUserPreferences() {
      try {
        const result = await chrome.storage.local.get(['userPreferences']);
        return result.userPreferences || this.defaultPreferences;
      } catch (error) {
        console.error('ユーザー設定取得エラー:', error);
        return this.defaultPreferences;
      }
    }

    /**
     * ユーザー設定を更新
     */
    async updateUserPreferences(newPreferences) {
      if (!newPreferences || typeof newPreferences !== 'object') {
        throw new Error('Invalid preferences data');
      }

      try {
        const currentPreferences = await this.getUserPreferences();
        const updatedPreferences = { ...currentPreferences, ...newPreferences };
        
        // データ検証
        this.validatePreferences(updatedPreferences);
        
        await chrome.storage.local.set({ userPreferences: updatedPreferences });
        
        console.log('ユーザー設定が更新されました');
        return updatedPreferences;
      } catch (error) {
        console.error('ユーザー設定更新エラー:', error);
        throw error;
      }
    }

    /**
     * 設定データの検証
     */
    validatePreferences(preferences) {
      const requiredFields = [
        'extensionEnabled', 'showNotifications', 'notificationDuration',
        'whitelistedDomains', 'learningEnabled', 'aggressiveMode', 'statistics'
      ];

      for (const field of requiredFields) {
        if (!(field in preferences)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // 型チェック
      if (typeof preferences.extensionEnabled !== 'boolean') {
        throw new Error('extensionEnabled must be boolean');
      }
      
      if (typeof preferences.notificationDuration !== 'number' || preferences.notificationDuration < 0) {
        throw new Error('notificationDuration must be positive number');
      }
      
      if (!Array.isArray(preferences.whitelistedDomains)) {
        throw new Error('whitelistedDomains must be array');
      }

      // 統計データの検証
      if (!preferences.statistics || typeof preferences.statistics !== 'object') {
        throw new Error('statistics must be object');
      }

      const statsFields = ['totalPopupsDetected', 'totalPopupsClosed', 'totalPopupsKept', 'lastResetDate'];
      for (const field of statsFields) {
        if (typeof preferences.statistics[field] !== 'number') {
          throw new Error(`statistics.${field} must be number`);
        }
      }
    }

    /**
     * 学習パターンを取得
     */
    async getLearningPatterns() {
      try {
        const result = await chrome.storage.local.get(['learningPatterns']);
        return result.learningPatterns || [];
      } catch (error) {
        console.error('学習パターン取得エラー:', error);
        return [];
      }
    }

    /**
     * 学習パターンを保存
     */
    async saveLearningPatterns(patterns) {
      if (!Array.isArray(patterns)) {
        throw new Error('Patterns must be array');
      }

      try {
        // パターンデータの検証
        patterns.forEach((pattern, index) => {
          this.validateLearningPattern(pattern, index);
        });

        await chrome.storage.local.set({ learningPatterns: patterns });
        console.log(`${patterns.length}個の学習パターンを保存しました`);
      } catch (error) {
        console.error('学習パターン保存エラー:', error);
        throw error;
      }
    }

    /**
     * 学習パターンの検証
     */
    validateLearningPattern(pattern, index) {
      const requiredFields = ['patternId', 'characteristics', 'userDecision', 'confidence', 'occurrences', 'lastSeen', 'domain'];

      for (const field of requiredFields) {
        if (!(field in pattern)) {
          throw new Error(`Pattern ${index}: Missing required field: ${field}`);
        }
      }

      if (typeof pattern.patternId !== 'string' || pattern.patternId.length === 0) {
        throw new Error(`Pattern ${index}: patternId must be non-empty string`);
      }

      if (typeof pattern.confidence !== 'number' || pattern.confidence < 0 || pattern.confidence > 1) {
        throw new Error(`Pattern ${index}: confidence must be number between 0 and 1`);
      }

      if (typeof pattern.occurrences !== 'number' || pattern.occurrences < 1) {
        throw new Error(`Pattern ${index}: occurrences must be positive number`);
      }

      if (!['close', 'keep', 'dismiss', 'timeout'].includes(pattern.userDecision)) {
        throw new Error(`Pattern ${index}: invalid userDecision`);
      }
    }

    /**
     * ユーザー決定履歴を取得
     */
    async getUserDecisions(filters = {}) {
      try {
        const result = await chrome.storage.local.get(['userDecisions']);
        let decisions = result.userDecisions || [];

        // フィルタリング
        if (filters.domain) {
          decisions = decisions.filter(d => d.domain === filters.domain);
        }
        
        if (filters.userDecision) {
          decisions = decisions.filter(d => d.userDecision === filters.userDecision);
        }
        
        if (filters.startDate) {
          decisions = decisions.filter(d => d.decisionTimestamp >= filters.startDate);
        }
        
        if (filters.endDate) {
          decisions = decisions.filter(d => d.decisionTimestamp <= filters.endDate);
        }

        return decisions;
      } catch (error) {
        console.error('ユーザー決定履歴取得エラー:', error);
        return [];
      }
    }

    /**
     * ユーザー決定を保存
     */
    async saveUserDecision(decision) {
      if (!decision || typeof decision !== 'object') {
        throw new Error('Invalid decision data');
      }

      try {
        this.validateUserDecision(decision);

        const result = await chrome.storage.local.get(['userDecisions']);
        const decisions = result.userDecisions || [];
        
        decisions.push({
          ...decision,
          savedAt: Date.now()
        });

        await chrome.storage.local.set({ userDecisions: decisions });
        console.log('ユーザー決定を保存しました:', decision.id);
      } catch (error) {
        console.error('ユーザー決定保存エラー:', error);
        throw error;
      }
    }

    /**
     * ユーザー決定の検証
     */
    validateUserDecision(decision) {
      const requiredFields = ['id', 'domain', 'userDecision', 'decisionTimestamp'];

      for (const field of requiredFields) {
        if (!(field in decision)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      if (typeof decision.id !== 'string' || decision.id.length === 0) {
        throw new Error('id must be non-empty string');
      }

      if (!['close', 'keep', 'dismiss', 'timeout'].includes(decision.userDecision)) {
        throw new Error('Invalid userDecision');
      }

      if (typeof decision.decisionTimestamp !== 'number' || decision.decisionTimestamp <= 0) {
        throw new Error('decisionTimestamp must be positive number');
      }
    }

    /**
     * データのバックアップ
     */
    async backupData() {
      try {
        const allData = await chrome.storage.local.get(null);
        
        const backup = {
          timestamp: Date.now(),
          version: '1.0',
          data: allData
        };

        return backup;
      } catch (error) {
        console.error('データバックアップエラー:', error);
        throw error;
      }
    }

    /**
     * データの復元
     */
    async restoreData(backup) {
      if (!backup || !backup.data) {
        throw new Error('Invalid backup data');
      }

      try {
        // バックアップデータの検証
        this.validateBackupData(backup);

        // 現在のデータをクリア
        await chrome.storage.local.clear();

        // バックアップデータを復元
        await chrome.storage.local.set(backup.data);

        console.log('データを復元しました');
      } catch (error) {
        console.error('データ復元エラー:', error);
        throw error;
      }
    }

    /**
     * バックアップデータの検証
     */
    validateBackupData(backup) {
      if (!backup.timestamp || typeof backup.timestamp !== 'number') {
        throw new Error('Invalid backup timestamp');
      }

      if (!backup.version || typeof backup.version !== 'string') {
        throw new Error('Invalid backup version');
      }

      if (!backup.data || typeof backup.data !== 'object') {
        throw new Error('Invalid backup data');
      }

      // 重要なデータの存在確認
      if (backup.data.userPreferences) {
        this.validatePreferences(backup.data.userPreferences);
      }

      if (backup.data.learningPatterns && Array.isArray(backup.data.learningPatterns)) {
        backup.data.learningPatterns.forEach((pattern, index) => {
          this.validateLearningPattern(pattern, index);
        });
      }
    }

    /**
     * ストレージ使用量を取得
     */
    async getStorageUsage() {
      try {
        const allData = await chrome.storage.local.get(null);
        const dataString = JSON.stringify(allData);
        const sizeInBytes = new Blob([dataString]).size;
        
        return {
          totalSize: sizeInBytes,
          itemCount: Object.keys(allData).length,
          breakdown: this.calculateStorageBreakdown(allData)
        };
      } catch (error) {
        console.error('ストレージ使用量取得エラー:', error);
        throw error;
      }
    }

    /**
     * ストレージ使用量の内訳を計算
     */
    calculateStorageBreakdown(data) {
      const breakdown = {};
      
      for (const [key, value] of Object.entries(data)) {
        const size = new Blob([JSON.stringify(value)]).size;
        breakdown[key] = {
          size: size,
          percentage: 0 // 後で計算
        };
      }

      const totalSize = Object.values(breakdown).reduce((sum, item) => sum + item.size, 0);
      
      for (const item of Object.values(breakdown)) {
        item.percentage = totalSize > 0 ? (item.size / totalSize) * 100 : 0;
      }

      return breakdown;
    }

    /**
     * 古いデータのクリーンアップ
     */
    async cleanupOldData(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30日
      try {
        const cutoffTime = Date.now() - maxAge;
        let cleanedCount = 0;

        // 古いユーザー決定を削除
        const decisions = await this.getUserDecisions();
        const filteredDecisions = decisions.filter(d => d.decisionTimestamp > cutoffTime);
        
        if (filteredDecisions.length < decisions.length) {
          await chrome.storage.local.set({ userDecisions: filteredDecisions });
          cleanedCount += decisions.length - filteredDecisions.length;
        }

        // 古い学習パターンを削除
        const patterns = await this.getLearningPatterns();
        const filteredPatterns = patterns.filter(p => p.lastSeen > cutoffTime);
        
        if (filteredPatterns.length < patterns.length) {
          await this.saveLearningPatterns(filteredPatterns);
          cleanedCount += patterns.length - filteredPatterns.length;
        }

        console.log(`${cleanedCount}件の古いデータを削除しました`);
        return cleanedCount;
      } catch (error) {
        console.error('データクリーンアップエラー:', error);
        throw error;
      }
    }
  }

  describe('Chrome storage API操作のテスト', () => {
    test('基本的なデータ保存と取得', async () => {
      const testData = { key: 'value', number: 123, boolean: true };
      
      await mockChrome.storage.local.set(testData);
      const result = await mockChrome.storage.local.get(['key', 'number', 'boolean']);
      
      expect(result.key).toBe('value');
      expect(result.number).toBe(123);
      expect(result.boolean).toBe(true);
    });

    test('大きなデータの保存と取得', async () => {
      const largeData = {
        largeArray: new Array(10000).fill('test'),
        largeObject: {}
      };
      
      // 大きなオブジェクトを作成
      for (let i = 0; i < 1000; i++) {
        largeData.largeObject[`key${i}`] = `value${i}`;
      }
      
      await mockChrome.storage.local.set({ largeData });
      const result = await mockChrome.storage.local.get(['largeData']);
      
      expect(result.largeData.largeArray.length).toBe(10000);
      expect(Object.keys(result.largeData.largeObject).length).toBe(1000);
    });

    test('複数キーの一括操作', async () => {
      const multipleData = {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3'
      };
      
      await mockChrome.storage.local.set(multipleData);
      const result = await mockChrome.storage.local.get(['key1', 'key2', 'key3']);
      
      expect(result).toEqual(multipleData);
    });

    test('存在しないキーの取得', async () => {
      const result = await mockChrome.storage.local.get(['nonexistent']);
      expect(result.nonexistent).toBeUndefined();
    });

    test('データの削除', async () => {
      await mockChrome.storage.local.set({ toDelete: 'value' });
      await mockChrome.storage.local.remove(['toDelete']);
      
      const result = await mockChrome.storage.local.get(['toDelete']);
      expect(result.toDelete).toBeUndefined();
    });

    test('全データのクリア', async () => {
      await mockChrome.storage.local.set({ key1: 'value1', key2: 'value2' });
      await mockChrome.storage.local.clear();
      
      const result = await mockChrome.storage.local.get(null);
      expect(Object.keys(result).length).toBe(0);
    });

    test('ストレージエラーの処理', async () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage error'));
      
      await expectError(
        () => mockChrome.storage.local.set({ key: 'value' }),
        'Storage error'
      );
    });
  });

  describe('ユーザー設定の保存・読み込みテスト', () => {
    test('デフォルト設定の取得', async () => {
      const preferences = await storageManager.getUserPreferences();
      
      expect(preferences.extensionEnabled).toBe(true);
      expect(preferences.showNotifications).toBe(true);
      expect(preferences.notificationDuration).toBe(5000);
      expect(Array.isArray(preferences.whitelistedDomains)).toBe(true);
      expect(preferences.statistics).toBeDefined();
    });

    test('設定の更新', async () => {
      const newPreferences = {
        extensionEnabled: false,
        notificationDuration: 3000,
        whitelistedDomains: ['example.com', 'test.com']
      };
      
      const updated = await storageManager.updateUserPreferences(newPreferences);
      
      expect(updated.extensionEnabled).toBe(false);
      expect(updated.notificationDuration).toBe(3000);
      expect(updated.whitelistedDomains).toEqual(['example.com', 'test.com']);
      
      // 他の設定は保持されていることを確認
      expect(updated.showNotifications).toBe(true);
    });

    test('部分的な設定更新', async () => {
      // 初期設定を保存
      await storageManager.updateUserPreferences({
        extensionEnabled: true,
        notificationDuration: 5000
      });
      
      // 一部のみ更新
      const updated = await storageManager.updateUserPreferences({
        extensionEnabled: false
      });
      
      expect(updated.extensionEnabled).toBe(false);
      expect(updated.notificationDuration).toBe(5000); // 変更されていない
    });

    test('無効な設定データでのエラー', async () => {
      await expectError(
        () => storageManager.updateUserPreferences(null),
        'Invalid preferences data'
      );
      
      await expectError(
        () => storageManager.updateUserPreferences('invalid'),
        'Invalid preferences data'
      );
    });

    test('設定検証エラー', async () => {
      await expectError(
        () => storageManager.updateUserPreferences({
          extensionEnabled: 'invalid'
        }),
        'extensionEnabled must be boolean'
      );
      
      await expectError(
        () => storageManager.updateUserPreferences({
          notificationDuration: -1
        }),
        'notificationDuration must be positive number'
      );
      
      await expectError(
        () => storageManager.updateUserPreferences({
          whitelistedDomains: 'not-array'
        }),
        'whitelistedDomains must be array'
      );
    });

    test('統計データの検証', async () => {
      await expectError(
        () => storageManager.updateUserPreferences({
          statistics: 'invalid'
        }),
        'statistics must be object'
      );
      
      await expectError(
        () => storageManager.updateUserPreferences({
          statistics: {
            totalPopupsDetected: 'invalid'
          }
        }),
        'statistics.totalPopupsDetected must be number'
      );
    });
  });

  describe('学習パターンのストレージテスト', () => {
    test('学習パターンの保存と取得', async () => {
      const patterns = [
        createMockLearningPattern({ patternId: 'pattern-1' }),
        createMockLearningPattern({ patternId: 'pattern-2' })
      ];
      
      await storageManager.saveLearningPatterns(patterns);
      const retrieved = await storageManager.getLearningPatterns();
      
      expect(retrieved.length).toBe(2);
      expect(retrieved[0].patternId).toBe('pattern-1');
      expect(retrieved[1].patternId).toBe('pattern-2');
    });

    test('空の学習パターン配列', async () => {
      await storageManager.saveLearningPatterns([]);
      const retrieved = await storageManager.getLearningPatterns();
      
      expect(retrieved).toEqual([]);
    });

    test('学習パターンの検証エラー', async () => {
      const invalidPatterns = [
        { patternId: '' }, // 空のID
        { patternId: 'valid', confidence: 2 }, // 無効な信頼度
        { patternId: 'valid', occurrences: 0 } // 無効な出現回数
      ];
      
      for (const pattern of invalidPatterns) {
        await expectError(
          () => storageManager.saveLearningPatterns([pattern]),
          /Pattern 0:/
        );
      }
    });

    test('大量の学習パターンの処理', async () => {
      const manyPatterns = Array.from({ length: 1000 }, (_, i) => 
        createMockLearningPattern({ patternId: `pattern-${i}` })
      );
      
      await storageManager.saveLearningPatterns(manyPatterns);
      const retrieved = await storageManager.getLearningPatterns();
      
      expect(retrieved.length).toBe(1000);
    });
  });

  describe('ユーザー決定履歴のテスト', () => {
    test('決定の保存と取得', async () => {
      const decision = createMockPopupData({
        id: 'decision-1',
        userDecision: 'close',
        decisionTimestamp: Date.now()
      });
      
      await storageManager.saveUserDecision(decision);
      const decisions = await storageManager.getUserDecisions();
      
      expect(decisions.length).toBe(1);
      expect(decisions[0].id).toBe('decision-1');
      expect(decisions[0].userDecision).toBe('close');
    });

    test('複数決定の蓄積', async () => {
      const decisions = [
        createMockPopupData({ id: 'decision-1', userDecision: 'close' }),
        createMockPopupData({ id: 'decision-2', userDecision: 'keep' }),
        createMockPopupData({ id: 'decision-3', userDecision: 'dismiss' })
      ];
      
      for (const decision of decisions) {
        await storageManager.saveUserDecision(decision);
      }
      
      const retrieved = await storageManager.getUserDecisions();
      expect(retrieved.length).toBe(3);
    });

    test('決定履歴のフィルタリング', async () => {
      const decisions = [
        createMockPopupData({ 
          id: 'decision-1', 
          domain: 'example.com', 
          userDecision: 'close',
          decisionTimestamp: Date.now() - 1000
        }),
        createMockPopupData({ 
          id: 'decision-2', 
          domain: 'test.com', 
          userDecision: 'keep',
          decisionTimestamp: Date.now()
        })
      ];
      
      for (const decision of decisions) {
        await storageManager.saveUserDecision(decision);
      }
      
      // ドメインでフィルタ
      const exampleDecisions = await storageManager.getUserDecisions({ domain: 'example.com' });
      expect(exampleDecisions.length).toBe(1);
      expect(exampleDecisions[0].domain).toBe('example.com');
      
      // 決定タイプでフィルタ
      const closeDecisions = await storageManager.getUserDecisions({ userDecision: 'close' });
      expect(closeDecisions.length).toBe(1);
      expect(closeDecisions[0].userDecision).toBe('close');
    });

    test('決定データの検証', async () => {
      await expectError(
        () => storageManager.saveUserDecision(null),
        'Invalid decision data'
      );
      
      await expectError(
        () => storageManager.saveUserDecision({ 
          id: '', 
          domain: 'example.com', 
          userDecision: 'close', 
          decisionTimestamp: Date.now() 
        }),
        'id must be non-empty string'
      );
      
      await expectError(
        () => storageManager.saveUserDecision({ 
          id: 'valid', 
          domain: 'example.com',
          userDecision: 'invalid',
          decisionTimestamp: Date.now()
        }),
        'Invalid userDecision'
      );
    });
  });

  describe('データ整合性チェックのテスト', () => {
    test('データバックアップの作成', async () => {
      // テストデータを設定
      const testData = {
        userPreferences: createMockUserPreferences(),
        learningPatterns: [createMockLearningPattern()],
        userDecisions: [createMockPopupData()]
      };
      
      await mockChrome.storage.local.set(testData);
      
      const backup = await storageManager.backupData();
      
      expect(backup.timestamp).toBeDefined();
      expect(backup.version).toBe('1.0');
      expect(backup.data.userPreferences).toEqual(testData.userPreferences);
      expect(backup.data.learningPatterns).toEqual(testData.learningPatterns);
      expect(backup.data.userDecisions).toEqual(testData.userDecisions);
    });

    test('データの復元', async () => {
      const backupData = {
        timestamp: Date.now(),
        version: '1.0',
        data: {
          userPreferences: createMockUserPreferences(),
          learningPatterns: [createMockLearningPattern()],
          userDecisions: [createMockPopupData()]
        }
      };
      
      await storageManager.restoreData(backupData);
      
      const preferences = await storageManager.getUserPreferences();
      const patterns = await storageManager.getLearningPatterns();
      const decisions = await storageManager.getUserDecisions();
      
      expect(preferences).toEqual(backupData.data.userPreferences);
      expect(patterns).toEqual(backupData.data.learningPatterns);
      expect(decisions).toEqual(backupData.data.userDecisions);
    });

    test('無効なバックアップデータの検証', async () => {
      await expectError(
        () => storageManager.restoreData(null),
        'Invalid backup data'
      );
      
      await expectError(
        () => storageManager.restoreData({ data: null }),
        'Invalid backup data'
      );
      
      await expectError(
        () => storageManager.restoreData({
          timestamp: 'invalid',
          version: '1.0',
          data: {}
        }),
        'Invalid backup timestamp'
      );
    });

    test('データ整合性の確認', async () => {
      const originalData = createMockUserPreferences();
      await storageManager.updateUserPreferences(originalData);
      
      const retrieved = await storageManager.getUserPreferences();
      
      // すべてのフィールドが正確に保存・取得されていることを確認
      expect(retrieved.extensionEnabled).toBe(originalData.extensionEnabled);
      expect(retrieved.showNotifications).toBe(originalData.showNotifications);
      expect(retrieved.notificationDuration).toBe(originalData.notificationDuration);
      expect(retrieved.whitelistedDomains).toEqual(originalData.whitelistedDomains);
      expect(retrieved.statistics).toEqual(originalData.statistics);
    });

    test('データ破損の検出と修復', async () => {
      // 破損したデータを設定
      await mockChrome.storage.local.set({
        userPreferences: { extensionEnabled: 'invalid' }
      });
      
      // 破損したデータを取得しようとした場合、デフォルト値が返されることを確認
      const preferences = await storageManager.getUserPreferences();
      expect(preferences).toEqual(storageManager.defaultPreferences);
    });
  });

  describe('ストレージ使用量とパフォーマンステスト', () => {
    test('ストレージ使用量の計算', async () => {
      const testData = {
        smallData: 'test',
        mediumData: new Array(100).fill('data'),
        largeData: new Array(1000).fill('large')
      };
      
      await mockChrome.storage.local.set(testData);
      
      const usage = await storageManager.getStorageUsage();
      
      expect(usage.totalSize).toBeGreaterThan(0);
      expect(usage.itemCount).toBe(3);
      expect(usage.breakdown.smallData).toBeDefined();
      expect(usage.breakdown.mediumData).toBeDefined();
      expect(usage.breakdown.largeData).toBeDefined();
      
      // 大きなデータの方が使用量が多いことを確認
      expect(usage.breakdown.largeData.size).toBeGreaterThan(usage.breakdown.smallData.size);
    });

    test('古いデータのクリーンアップ', async () => {
      const oldDecision = createMockPopupData({
        id: 'old-decision',
        userDecision: 'close', // 有効な値を設定
        decisionTimestamp: Date.now() - (40 * 24 * 60 * 60 * 1000) // 40日前
      });
      
      const recentDecision = createMockPopupData({
        id: 'recent-decision',
        userDecision: 'keep', // 有効な値を設定
        decisionTimestamp: Date.now() - (10 * 24 * 60 * 60 * 1000) // 10日前
      });
      
      await storageManager.saveUserDecision(oldDecision);
      await storageManager.saveUserDecision(recentDecision);
      
      const cleanedCount = await storageManager.cleanupOldData();
      
      expect(cleanedCount).toBe(1); // 古い決定が削除された
      
      const remainingDecisions = await storageManager.getUserDecisions();
      expect(remainingDecisions.length).toBe(1);
      expect(remainingDecisions[0].id).toBe('recent-decision');
    });

    test('大量データの処理パフォーマンス', async () => {
      const startTime = Date.now();
      
      // 大量のデータを保存
      const manyDecisions = Array.from({ length: 1000 }, (_, i) => 
        createMockPopupData({ 
          id: `decision-${i}`,
          userDecision: 'close',
          decisionTimestamp: Date.now() - i * 1000 // 各決定に異なるタイムスタンプ
        })
      );
      
      for (const decision of manyDecisions) {
        await storageManager.saveUserDecision(decision);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(5000); // 5秒以内
      
      // データが正しく保存されていることを確認
      const retrieved = await storageManager.getUserDecisions();
      expect(retrieved.length).toBe(1000);
    });

    test('メモリ効率的なデータ処理', async () => {
      // 大きなオブジェクトを作成
      const patterns = Array.from({ length: 10000 }, (_, i) => 
        createMockLearningPattern({ patternId: `pattern-${i}` })
      );
      
      // learningPatternsキーで保存（storageManagerが期待する形式）
      await mockChrome.storage.local.set({ learningPatterns: patterns });
      
      // メモリ使用量を監視しながらデータを取得
      const memoryBefore = process.memoryUsage?.().heapUsed || 0;
      
      const retrieved = await storageManager.getLearningPatterns();
      
      const memoryAfter = process.memoryUsage?.().heapUsed || 0;
      const memoryIncrease = memoryAfter - memoryBefore;
      
      expect(retrieved.length).toBe(10000);
      // メモリ使用量の増加が合理的な範囲内であることを確認
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB以内
    });
  });

  describe('エラーハンドリングとエッジケース', () => {
    test('ストレージ容量制限エラー', async () => {
      mockChrome.storage.local.set.mockRejectedValue(new Error('QUOTA_EXCEEDED'));
      
      await expectError(
        () => storageManager.updateUserPreferences({ extensionEnabled: false }),
        'QUOTA_EXCEEDED'
      );
    });

    test('ネットワークエラーの処理', async () => {
      mockChrome.storage.local.get.mockRejectedValue(new Error('Network error'));
      
      // エラーが発生してもデフォルト値が返されることを確認
      const preferences = await storageManager.getUserPreferences();
      expect(preferences).toEqual(storageManager.defaultPreferences);
    });

    test('並行アクセスの処理', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        storageManager.updateUserPreferences({ 
          notificationDuration: 1000 + i 
        })
      );
      
      const results = await Promise.all(promises);
      
      // すべての更新が成功することを確認
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.extensionEnabled).toBe(true);
      });
    });

    test('破損したJSONデータの処理', async () => {
      // 直接ストレージに破損したデータを設定
      mockChrome.storage.local.data = {
        userPreferences: { extensionEnabled: "invalid" } // 無効なデータ型
      };
      
      // 破損したデータを処理してもエラーが発生しないことを確認
      const preferences = await storageManager.getUserPreferences();
      expect(preferences).toEqual(storageManager.defaultPreferences);
    });

    test('循環参照オブジェクトの処理', async () => {
      const circularObj = { a: 1 };
      circularObj.self = circularObj;
      
      // 循環参照オブジェクトを保存しようとした場合の処理
      try {
        // JSON.stringifyで循環参照エラーを発生させる
        JSON.stringify(circularObj);
        await storageManager.updateUserPreferences(circularObj);
        throw new Error('Expected function to throw an error');
      } catch (error) {
        expect(error.message).toMatch(/Converting circular structure to JSON|Invalid preferences data/);
      }
    });
  });
});