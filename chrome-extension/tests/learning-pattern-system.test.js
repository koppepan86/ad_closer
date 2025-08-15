/**
 * 学習パターンシステムのテスト
 * ユーザー決定の保存、パターンマッチング、信頼度スコアリング、自動提案機能をテスト
 */

// テスト用のモック関数とデータ
const mockChrome = {
  storage: {
    local: {
      data: {},
      get: jest.fn((keys) => {
        const result = {};
        if (Array.isArray(keys)) {
          keys.forEach(key => {
            result[key] = mockChrome.storage.local.data[key];
          });
        } else if (typeof keys === 'string') {
          result[keys] = mockChrome.storage.local.data[keys];
        } else {
          Object.keys(keys).forEach(key => {
            result[key] = mockChrome.storage.local.data[key] || keys[key];
          });
        }
        return Promise.resolve(result);
      }),
      set: jest.fn((data) => {
        Object.assign(mockChrome.storage.local.data, data);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        mockChrome.storage.local.data = {};
        return Promise.resolve();
      })
    }
  }
};

// グローバルなchromeオブジェクトをモック
global.chrome = mockChrome;

// テスト用のサンプルポップアップ特性
const sampleCharacteristics1 = {
  hasCloseButton: true,
  containsAds: true,
  hasExternalLinks: true,
  isModal: true,
  zIndex: 9999,
  dimensions: { width: 400, height: 300 }
};

const sampleCharacteristics2 = {
  hasCloseButton: true,
  containsAds: true,
  hasExternalLinks: false,
  isModal: true,
  zIndex: 10000,
  dimensions: { width: 450, height: 350 }
};

const sampleCharacteristics3 = {
  hasCloseButton: false,
  containsAds: false,
  hasExternalLinks: false,
  isModal: false,
  zIndex: 100,
  dimensions: { width: 200, height: 150 }
};

// テスト用のポップアップレコード
const createPopupRecord = (id, characteristics, userDecision = 'close', domain = 'example.com') => ({
  id: id,
  url: `https://${domain}/page`,
  domain: domain,
  timestamp: Date.now(),
  characteristics: characteristics,
  userDecision: userDecision,
  confidence: 0.8
});

describe('学習パターンシステム', () => {
  let serviceWorkerModule;

  beforeEach(async () => {
    // ストレージをクリア
    await mockChrome.storage.local.clear();
    
    // デフォルト設定を設定
    await mockChrome.storage.local.set({
      userPreferences: {
        extensionEnabled: true,
        learningEnabled: true,
        showNotifications: true,
        notificationDuration: 5000,
        whitelistedDomains: [],
        aggressiveMode: false,
        statistics: {
          totalPopupsDetected: 0,
          totalPopupsClosed: 0,
          totalPopupsKept: 0,
          lastResetDate: Date.now()
        }
      },
      learningPatterns: [],
      popupHistory: [],
      userDecisions: []
    });

    // 学習システム関数を直接実装（テスト用）
    serviceWorkerModule = {
      updateLearningData: require('./learning-system-functions').updateLearningData,
      getPatternBasedSuggestion: require('./learning-system-functions').getPatternBasedSuggestion,
      getLearningStatistics: require('./learning-system-functions').getLearningStatistics,
      findMatchingPattern: require('./learning-system-functions').findMatchingPattern,
      calculateSimilarity: require('./learning-system-functions').calculateSimilarity,
      createNewPattern: require('./learning-system-functions').createNewPattern,
      cleanupPatterns: require('./learning-system-functions').cleanupPatterns
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateLearningData関数', () => {
    test('新しいポップアップ決定から学習パターンを作成する', async () => {
      const popupRecord = createPopupRecord('popup1', sampleCharacteristics1, 'close');
      
      await serviceWorkerModule.updateLearningData(popupRecord);
      
      const result = await mockChrome.storage.local.get(['learningPatterns']);
      const patterns = result.learningPatterns;
      
      expect(patterns).toHaveLength(1);
      expect(patterns[0].userDecision).toBe('close');
      expect(patterns[0].confidence).toBe(0.6);
      expect(patterns[0].occurrences).toBe(1);
      expect(patterns[0].characteristics).toEqual(sampleCharacteristics1);
    });

    test('類似のポップアップで既存パターンを更新する', async () => {
      // 最初のポップアップで初期パターンを作成
      const popupRecord1 = createPopupRecord('popup1', sampleCharacteristics1, 'close');
      await serviceWorkerModule.updateLearningData(popupRecord1);
      
      // 類似のポップアップで同じ決定
      const popupRecord2 = createPopupRecord('popup2', sampleCharacteristics2, 'close');
      await serviceWorkerModule.updateLearningData(popupRecord2);
      
      const result = await mockChrome.storage.local.get(['learningPatterns']);
      const patterns = result.learningPatterns;
      
      expect(patterns).toHaveLength(1);
      expect(patterns[0].occurrences).toBe(2);
      expect(patterns[0].confidence).toBeGreaterThan(0.6); // 信頼度が上がる
    });

    test('異なる決定で既存パターンの信頼度を下げる', async () => {
      // 最初のポップアップで初期パターンを作成
      const popupRecord1 = createPopupRecord('popup1', sampleCharacteristics1, 'close');
      await serviceWorkerModule.updateLearningData(popupRecord1);
      
      // 類似のポップアップで異なる決定
      const popupRecord2 = createPopupRecord('popup2', sampleCharacteristics2, 'keep');
      await serviceWorkerModule.updateLearningData(popupRecord2);
      
      const result = await mockChrome.storage.local.get(['learningPatterns']);
      const patterns = result.learningPatterns;
      
      expect(patterns).toHaveLength(1);
      expect(patterns[0].confidence).toBeLessThan(0.6); // 信頼度が下がる
    });

    test('学習が無効の場合はパターンを作成しない', async () => {
      // 学習を無効にする
      await mockChrome.storage.local.set({
        userPreferences: {
          extensionEnabled: true,
          learningEnabled: false,
          showNotifications: true,
          notificationDuration: 5000,
          whitelistedDomains: [],
          aggressiveMode: false,
          statistics: {
            totalPopupsDetected: 0,
            totalPopupsClosed: 0,
            totalPopupsKept: 0,
            lastResetDate: Date.now()
          }
        }
      });
      
      const popupRecord = createPopupRecord('popup1', sampleCharacteristics1, 'close');
      await serviceWorkerModule.updateLearningData(popupRecord);
      
      const result = await mockChrome.storage.local.get(['learningPatterns']);
      const patterns = result.learningPatterns;
      
      expect(patterns).toHaveLength(0);
    });

    test('無効な決定（timeout、dismiss）は学習しない', async () => {
      const popupRecord1 = createPopupRecord('popup1', sampleCharacteristics1, 'timeout');
      const popupRecord2 = createPopupRecord('popup2', sampleCharacteristics1, 'dismiss');
      
      await serviceWorkerModule.updateLearningData(popupRecord1);
      await serviceWorkerModule.updateLearningData(popupRecord2);
      
      const result = await mockChrome.storage.local.get(['learningPatterns']);
      const patterns = result.learningPatterns;
      
      expect(patterns).toHaveLength(0);
    });
  });

  describe('パターンマッチング機能', () => {
    test('類似度計算が正しく動作する', () => {
      const similarity1 = serviceWorkerModule.calculateSimilarity(
        sampleCharacteristics1, 
        sampleCharacteristics2
      );
      
      const similarity2 = serviceWorkerModule.calculateSimilarity(
        sampleCharacteristics1, 
        sampleCharacteristics3
      );
      
      expect(similarity1).toBeGreaterThan(0.7); // 類似
      expect(similarity2).toBeLessThan(0.5); // 非類似
    });

    test('マッチするパターンを正しく検索する', () => {
      const patterns = [
        {
          patternId: 'pattern1',
          characteristics: sampleCharacteristics1,
          userDecision: 'close',
          confidence: 0.8,
          occurrences: 3,
          lastSeen: Date.now()
        },
        {
          patternId: 'pattern2',
          characteristics: sampleCharacteristics3,
          userDecision: 'keep',
          confidence: 0.7,
          occurrences: 2,
          lastSeen: Date.now()
        }
      ];
      
      const match = serviceWorkerModule.findMatchingPattern(patterns, sampleCharacteristics2);
      
      expect(match).toBeTruthy();
      expect(match.patternId).toBe('pattern1');
    });

    test('類似度が閾値以下の場合はマッチしない', () => {
      const patterns = [
        {
          patternId: 'pattern1',
          characteristics: sampleCharacteristics3,
          userDecision: 'keep',
          confidence: 0.8,
          occurrences: 3,
          lastSeen: Date.now()
        }
      ];
      
      const match = serviceWorkerModule.findMatchingPattern(patterns, sampleCharacteristics1);
      
      expect(match).toBeNull();
    });
  });

  describe('信頼度スコアリングシステム', () => {
    test('新しいパターンの初期信頼度が正しい', () => {
      const popupRecord = createPopupRecord('popup1', sampleCharacteristics1, 'close');
      const newPattern = serviceWorkerModule.createNewPattern(popupRecord);
      
      expect(newPattern.confidence).toBe(0.6);
      expect(newPattern.occurrences).toBe(1);
    });

    test('パターンクリーンアップが正しく動作する', () => {
      const now = Date.now();
      const oldTimestamp = now - (31 * 24 * 60 * 60 * 1000); // 31日前
      
      const patterns = [
        {
          patternId: 'pattern1',
          characteristics: sampleCharacteristics1,
          userDecision: 'close',
          confidence: 0.8,
          occurrences: 5,
          lastSeen: now
        },
        {
          patternId: 'pattern2',
          characteristics: sampleCharacteristics2,
          userDecision: 'keep',
          confidence: 0.2, // 低信頼度
          occurrences: 3,
          lastSeen: now
        },
        {
          patternId: 'pattern3',
          characteristics: sampleCharacteristics3,
          userDecision: 'close',
          confidence: 0.2, // 低信頼度に変更
          occurrences: 3,
          lastSeen: now
        },
        {
          patternId: 'pattern4',
          characteristics: sampleCharacteristics1,
          userDecision: 'keep',
          confidence: 0.6,
          occurrences: 3,
          lastSeen: oldTimestamp // 古い
        }
      ];
      
      const cleanedPatterns = serviceWorkerModule.cleanupPatterns(patterns);
      
      expect(cleanedPatterns).toHaveLength(1);
      expect(cleanedPatterns[0].patternId).toBe('pattern1');
    });
  });

  describe('パターンベース自動提案', () => {
    test('高信頼度パターンから正しい提案を生成する', async () => {
      // より類似度の高い特性を使用
      const verySimilarCharacteristics = {
        hasCloseButton: true,
        containsAds: true,
        hasExternalLinks: true,
        isModal: true,
        zIndex: 9950, // より近い値
        dimensions: { width: 420, height: 320 } // より近い値
      };
      
      // 高信頼度パターンを設定
      await mockChrome.storage.local.set({
        learningPatterns: [
          {
            patternId: 'pattern1',
            characteristics: sampleCharacteristics1,
            userDecision: 'close',
            confidence: 0.9,
            occurrences: 10,
            lastSeen: Date.now()
          }
        ]
      });
      
      const suggestion = await serviceWorkerModule.getPatternBasedSuggestion(
        verySimilarCharacteristics, 
        'example.com'
      );
      
      expect(suggestion).toBeTruthy();
      expect(suggestion.suggestion).toBe('close');
      expect(suggestion.confidence).toBe(0.9);
      expect(suggestion.similarity).toBeGreaterThan(0.8);
    });

    test('低信頼度パターンからは提案しない', async () => {
      // 低信頼度パターンを設定
      await mockChrome.storage.local.set({
        learningPatterns: [
          {
            patternId: 'pattern1',
            characteristics: sampleCharacteristics1,
            userDecision: 'close',
            confidence: 0.5, // 閾値以下
            occurrences: 3,
            lastSeen: Date.now()
          }
        ]
      });
      
      const suggestion = await serviceWorkerModule.getPatternBasedSuggestion(
        sampleCharacteristics2, 
        'example.com'
      );
      
      expect(suggestion).toBeNull();
    });

    test('類似度が低い場合は提案しない', async () => {
      // 高信頼度だが非類似パターンを設定
      await mockChrome.storage.local.set({
        learningPatterns: [
          {
            patternId: 'pattern1',
            characteristics: sampleCharacteristics3, // 非類似
            userDecision: 'close',
            confidence: 0.9,
            occurrences: 10,
            lastSeen: Date.now()
          }
        ]
      });
      
      const suggestion = await serviceWorkerModule.getPatternBasedSuggestion(
        sampleCharacteristics1, 
        'example.com'
      );
      
      expect(suggestion).toBeNull();
    });

    test('学習が無効の場合は提案しない', async () => {
      // 学習を無効にする
      await mockChrome.storage.local.set({
        userPreferences: {
          extensionEnabled: true,
          learningEnabled: false,
          showNotifications: true,
          notificationDuration: 5000,
          whitelistedDomains: [],
          aggressiveMode: false,
          statistics: {
            totalPopupsDetected: 0,
            totalPopupsClosed: 0,
            totalPopupsKept: 0,
            lastResetDate: Date.now()
          }
        },
        learningPatterns: [
          {
            patternId: 'pattern1',
            characteristics: sampleCharacteristics1,
            userDecision: 'close',
            confidence: 0.9,
            occurrences: 10,
            lastSeen: Date.now()
          }
        ]
      });
      
      const suggestion = await serviceWorkerModule.getPatternBasedSuggestion(
        sampleCharacteristics2, 
        'example.com'
      );
      
      expect(suggestion).toBeNull();
    });
  });

  describe('学習統計機能', () => {
    test('学習統計を正しく計算する', async () => {
      const patterns = [
        {
          patternId: 'pattern1',
          characteristics: sampleCharacteristics1,
          userDecision: 'close',
          confidence: 0.9,
          occurrences: 5,
          lastSeen: Date.now()
        },
        {
          patternId: 'pattern2',
          characteristics: sampleCharacteristics2,
          userDecision: 'keep',
          confidence: 0.7,
          occurrences: 3,
          lastSeen: Date.now()
        },
        {
          patternId: 'pattern3',
          characteristics: sampleCharacteristics3,
          userDecision: 'close',
          confidence: 0.6,
          occurrences: 2,
          lastSeen: Date.now()
        }
      ];
      
      await mockChrome.storage.local.set({ learningPatterns: patterns });
      
      const stats = await serviceWorkerModule.getLearningStatistics();
      
      expect(stats.totalPatterns).toBe(3);
      expect(stats.highConfidencePatterns).toBe(1); // confidence >= 0.8
      expect(stats.closePatterns).toBe(2);
      expect(stats.keepPatterns).toBe(1);
      expect(stats.averageConfidence).toBeCloseTo(0.733, 2);
      expect(stats.totalOccurrences).toBe(10);
    });

    test('パターンがない場合の統計', async () => {
      await mockChrome.storage.local.set({ learningPatterns: [] });
      
      const stats = await serviceWorkerModule.getLearningStatistics();
      
      expect(stats.totalPatterns).toBe(0);
      expect(stats.highConfidencePatterns).toBe(0);
      expect(stats.closePatterns).toBe(0);
      expect(stats.keepPatterns).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(stats.totalOccurrences).toBe(0);
    });
  });

  describe('エラーハンドリング', () => {
    test('ストレージエラー時の適切な処理', async () => {
      // ストレージエラーをシミュレート
      mockChrome.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));
      
      const popupRecord = createPopupRecord('popup1', sampleCharacteristics1, 'close');
      
      // エラーが発生してもクラッシュしない
      await expect(serviceWorkerModule.updateLearningData(popupRecord)).resolves.not.toThrow();
    });

    test('無効なデータでの適切な処理', async () => {
      const invalidPopupRecord = {
        id: 'popup1',
        // 必要なフィールドが不足
        characteristics: null,
        userDecision: 'invalid_decision'
      };
      
      // 無効なデータでもクラッシュしない
      await expect(serviceWorkerModule.updateLearningData(invalidPopupRecord)).resolves.not.toThrow();
    });
  });
});