/**
 * 学習アルゴリズムとユーザー決定処理の包括的テスト
 * Task 9.1: ユニットテストの作成 - ユーザー決定処理と学習アルゴリズムのテスト
 */

// Chrome API のモック
const mockStorage = {
  data: {},
  get: jest.fn(),
  set: jest.fn(),
  clear: jest.fn()
};

global.chrome = {
  storage: {
    local: mockStorage
  },
  tabs: {
    sendMessage: jest.fn()
  },
  runtime: {
    sendMessage: jest.fn()
  }
};

describe('学習アルゴリズムとユーザー決定処理の包括的テスト', () => {
  let learningSystem, decisionProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.data = {};
    
    // ストレージモックの実装
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

    mockStorage.clear.mockImplementation(() => {
      mockStorage.data = {};
      return Promise.resolve();
    });

    // 学習システムの実装
    learningSystem = {
      async updateLearningData(popupRecord) {
        const preferences = await this.getUserPreferences();
        if (!preferences.learningEnabled) return;

        if (!['close', 'keep'].includes(popupRecord.userDecision)) return;

        const result = await chrome.storage.local.get(['learningPatterns']);
        let patterns = result.learningPatterns || [];

        const matchingPattern = this.findMatchingPattern(patterns, popupRecord.characteristics);

        if (matchingPattern) {
          await this.updateExistingPattern(patterns, matchingPattern, popupRecord);
        } else {
          const newPattern = this.createNewPattern(popupRecord);
          patterns.push(newPattern);
        }

        patterns = this.cleanupPatterns(patterns);
        await chrome.storage.local.set({ learningPatterns: patterns });
      },

      findMatchingPattern(patterns, characteristics) {
        const SIMILARITY_THRESHOLD = 0.7;
        let bestMatch = null;
        let bestSimilarity = 0;

        for (const pattern of patterns) {
          const similarity = this.calculateSimilarity(pattern.characteristics, characteristics);
          if (similarity >= SIMILARITY_THRESHOLD && similarity > bestSimilarity) {
            bestMatch = pattern;
            bestSimilarity = similarity;
          }
        }

        return bestMatch;
      },

      calculateSimilarity(pattern, characteristics) {
        const weights = {
          hasCloseButton: 0.15,
          containsAds: 0.25,
          hasExternalLinks: 0.20,
          isModal: 0.15,
          zIndex: 0.10,
          dimensions: 0.15
        };

        let totalWeight = 0;
        let matchedWeight = 0;

        // ブール値の比較
        for (const key of ['hasCloseButton', 'containsAds', 'hasExternalLinks', 'isModal']) {
          if (pattern[key] !== undefined && characteristics[key] !== undefined) {
            totalWeight += weights[key];
            if (pattern[key] === characteristics[key]) {
              matchedWeight += weights[key];
            }
          }
        }

        // zIndexの比較
        if (pattern.zIndex !== undefined && characteristics.zIndex !== undefined) {
          totalWeight += weights.zIndex;
          const zIndexDiff = Math.abs(pattern.zIndex - characteristics.zIndex);
          if (zIndexDiff <= 100) {
            matchedWeight += weights.zIndex * (1 - zIndexDiff / 1000);
          }
        }

        // 寸法の比較
        if (pattern.dimensions && characteristics.dimensions) {
          totalWeight += weights.dimensions;
          const widthSimilarity = this.calculateDimensionSimilarity(
            pattern.dimensions.width,
            characteristics.dimensions.width
          );
          const heightSimilarity = this.calculateDimensionSimilarity(
            pattern.dimensions.height,
            characteristics.dimensions.height
          );
          matchedWeight += weights.dimensions * (widthSimilarity + heightSimilarity) / 2;
        }

        return totalWeight > 0 ? matchedWeight / totalWeight : 0;
      },

      calculateDimensionSimilarity(value1, value2) {
        if (value1 === undefined || value2 === undefined) return 0;
        const diff = Math.abs(value1 - value2);
        const max = Math.max(value1, value2);
        if (max === 0) return 1;
        return Math.max(0, 1 - diff / max);
      },

      async updateExistingPattern(patterns, matchingPattern, popupRecord) {
        const patternIndex = patterns.findIndex(p => p.patternId === matchingPattern.patternId);
        if (patternIndex >= 0) {
          const pattern = patterns[patternIndex];
          pattern.occurrences++;
          pattern.lastSeen = Date.now();

          if (pattern.userDecision === popupRecord.userDecision) {
            pattern.confidence = Math.min(1.0, pattern.confidence + 0.1);
          } else {
            pattern.confidence = Math.max(0.1, pattern.confidence - 0.2);
            if (pattern.confidence < 0.3) {
              pattern.userDecision = popupRecord.userDecision;
              pattern.confidence = 0.6;
            }
          }

          pattern.characteristics = this.averageCharacteristics(
            pattern.characteristics,
            popupRecord.characteristics,
            pattern.occurrences
          );
        }
      },

      averageCharacteristics(existingChar, newChar, occurrences) {
        const result = { ...existingChar };

        if (typeof newChar.zIndex === 'number' && typeof existingChar.zIndex === 'number') {
          result.zIndex = Math.round((existingChar.zIndex * (occurrences - 1) + newChar.zIndex) / occurrences);
        }

        if (newChar.dimensions && existingChar.dimensions) {
          result.dimensions = {
            width: Math.round((existingChar.dimensions.width * (occurrences - 1) + newChar.dimensions.width) / occurrences),
            height: Math.round((existingChar.dimensions.height * (occurrences - 1) + newChar.dimensions.height) / occurrences)
          };
        }

        return result;
      },

      createNewPattern(popupRecord) {
        return {
          patternId: this.generatePatternId(),
          characteristics: { ...popupRecord.characteristics },
          userDecision: popupRecord.userDecision,
          confidence: 0.6,
          occurrences: 1,
          lastSeen: Date.now(),
          domain: popupRecord.domain
        };
      },

      generatePatternId() {
        return 'pattern_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      },

      cleanupPatterns(patterns) {
        const now = Date.now();
        const OLD_PATTERN_THRESHOLD = 30 * 24 * 60 * 60 * 1000;
        const LOW_CONFIDENCE_THRESHOLD = 0.3;
        const MAX_PATTERNS = 100;

        let cleanedPatterns = patterns.filter(pattern => {
          const isRecent = (now - pattern.lastSeen) < OLD_PATTERN_THRESHOLD;
          const hasGoodConfidence = pattern.confidence >= LOW_CONFIDENCE_THRESHOLD;
          const hasMinOccurrences = pattern.occurrences >= 1;
          return isRecent && hasGoodConfidence && hasMinOccurrences;
        });

        cleanedPatterns.sort((a, b) => {
          const scoreA = a.confidence * Math.log(a.occurrences + 1) * (1 - (now - a.lastSeen) / OLD_PATTERN_THRESHOLD);
          const scoreB = b.confidence * Math.log(b.occurrences + 1) * (1 - (now - b.lastSeen) / OLD_PATTERN_THRESHOLD);
          return scoreB - scoreA;
        });

        if (cleanedPatterns.length > MAX_PATTERNS) {
          cleanedPatterns = cleanedPatterns.slice(0, MAX_PATTERNS);
        }

        return cleanedPatterns;
      },

      async getPatternBasedSuggestion(popupCharacteristics, domain) {
        const preferences = await this.getUserPreferences();
        if (!preferences.learningEnabled) return null;

        const result = await chrome.storage.local.get(['learningPatterns']);
        const patterns = result.learningPatterns || [];

        if (patterns.length === 0) return null;

        let bestMatch = null;
        let bestSimilarity = 0;
        const MIN_CONFIDENCE_FOR_SUGGESTION = 0.7;
        const MIN_SIMILARITY_FOR_SUGGESTION = 0.8;

        for (const pattern of patterns) {
          if (pattern.confidence < MIN_CONFIDENCE_FOR_SUGGESTION) continue;

          const similarity = this.calculateSimilarity(pattern.characteristics, popupCharacteristics);
          if (similarity >= MIN_SIMILARITY_FOR_SUGGESTION && similarity > bestSimilarity) {
            bestMatch = pattern;
            bestSimilarity = similarity;
          }
        }

        if (bestMatch) {
          return {
            suggestion: bestMatch.userDecision,
            confidence: bestMatch.confidence,
            similarity: bestSimilarity,
            patternId: bestMatch.patternId,
            occurrences: bestMatch.occurrences
          };
        }

        return null;
      },

      async getUserPreferences() {
        const result = await chrome.storage.local.get(['userPreferences']);
        return result.userPreferences || {
          extensionEnabled: true,
          learningEnabled: true,
          showNotifications: true
        };
      },

      async getLearningStatistics() {
        const result = await chrome.storage.local.get(['learningPatterns']);
        const patterns = result.learningPatterns || [];

        return {
          totalPatterns: patterns.length,
          highConfidencePatterns: patterns.filter(p => p.confidence >= 0.8).length,
          closePatterns: patterns.filter(p => p.userDecision === 'close').length,
          keepPatterns: patterns.filter(p => p.userDecision === 'keep').length,
          averageConfidence: patterns.length > 0 ?
            patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length : 0,
          totalOccurrences: patterns.reduce((sum, p) => sum + p.occurrences, 0)
        };
      }
    };

    // 決定処理システムの実装
    decisionProcessor = {
      pendingDecisions: new Map(),

      async getUserDecision(popupData, tabId) {
        const decisionEntry = {
          popupData: popupData,
          tabId: tabId,
          timestamp: Date.now(),
          status: 'pending',
          timeoutId: setTimeout(() => this.handleDecisionTimeout(popupData.id), 30000)
        };

        this.pendingDecisions.set(popupData.id, decisionEntry);
        await this.savePendingDecision(decisionEntry);

        return {
          success: true,
          popupId: popupData.id,
          status: 'pending'
        };
      },

      async handleUserDecision(decisionData) {
        const { popupId, decision } = decisionData;
        const pendingDecision = this.pendingDecisions.get(popupId);

        if (!pendingDecision) {
          return { success: false, error: 'Popup not found in pending decisions' };
        }

        if (pendingDecision.timeoutId) {
          clearTimeout(pendingDecision.timeoutId);
        }

        if (!['close', 'keep', 'dismiss'].includes(decision)) {
          return { success: false, error: 'Invalid decision' };
        }

        const updatedRecord = {
          ...pendingDecision.popupData,
          userDecision: decision,
          decisionTimestamp: Date.now(),
          responseTime: Date.now() - pendingDecision.timestamp
        };

        await this.saveUserDecision(updatedRecord);
        await learningSystem.updateLearningData(updatedRecord);

        this.pendingDecisions.delete(popupId);
        await this.removePendingDecision(popupId);

        await chrome.tabs.sendMessage(pendingDecision.tabId, {
          type: 'USER_DECISION_RESULT',
          data: { popupId, decision }
        });

        return {
          success: true,
          popupId: popupId,
          decision: decision,
          timestamp: updatedRecord.decisionTimestamp
        };
      },

      async handleDecisionTimeout(popupId) {
        const pendingDecision = this.pendingDecisions.get(popupId);
        if (!pendingDecision) return;

        const timeoutRecord = {
          ...pendingDecision.popupData,
          userDecision: 'timeout',
          decisionTimestamp: Date.now(),
          responseTime: Date.now() - pendingDecision.timestamp
        };

        await this.saveUserDecision(timeoutRecord);
        this.pendingDecisions.delete(popupId);
        await this.removePendingDecision(popupId);

        await chrome.tabs.sendMessage(pendingDecision.tabId, {
          type: 'USER_DECISION_TIMEOUT',
          data: { popupId }
        });
      },

      async savePendingDecision(decisionEntry) {
        const result = await chrome.storage.local.get(['pendingDecisions']);
        const pending = result.pendingDecisions || {};
        pending[decisionEntry.popupData.id] = {
          ...decisionEntry,
          timeoutId: null
        };
        await chrome.storage.local.set({ pendingDecisions: pending });
      },

      async removePendingDecision(popupId) {
        const result = await chrome.storage.local.get(['pendingDecisions']);
        const pending = result.pendingDecisions || {};
        delete pending[popupId];
        await chrome.storage.local.set({ pendingDecisions: pending });
      },

      async saveUserDecision(decisionRecord) {
        const result = await chrome.storage.local.get(['userDecisions']);
        const decisions = result.userDecisions || [];
        decisions.push(decisionRecord);

        if (decisions.length > 500) {
          decisions.splice(0, decisions.length - 500);
        }

        await chrome.storage.local.set({ userDecisions: decisions });
      },

      async cleanupExpiredDecisions() {
        const now = Date.now();
        const expiredThreshold = 5 * 60 * 1000;
        const expiredIds = [];

        for (const [popupId, decision] of this.pendingDecisions.entries()) {
          if (now - decision.timestamp > expiredThreshold) {
            expiredIds.push(popupId);
            if (decision.timeoutId) {
              clearTimeout(decision.timeoutId);
            }
          }
        }

        for (const popupId of expiredIds) {
          this.pendingDecisions.delete(popupId);
          await this.removePendingDecision(popupId);
        }

        return expiredIds.length;
      }
    };

    // デフォルトデータの設定
    mockStorage.data = {
      userPreferences: {
        extensionEnabled: true,
        learningEnabled: true,
        showNotifications: true
      },
      learningPatterns: [],
      userDecisions: [],
      pendingDecisions: {}
    };
  });

  describe('学習アルゴリズム', () => {
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

    const createPopupRecord = (id, characteristics, userDecision = 'close', domain = 'example.com') => ({
      id: id,
      url: `https://${domain}/page`,
      domain: domain,
      timestamp: Date.now(),
      characteristics: characteristics,
      userDecision: userDecision,
      confidence: 0.8
    });

    describe('パターン学習', () => {
      test('新しいパターンを作成する', async () => {
        const popupRecord = createPopupRecord('popup1', sampleCharacteristics1, 'close');
        
        await learningSystem.updateLearningData(popupRecord);
        
        const result = await chrome.storage.local.get(['learningPatterns']);
        const patterns = result.learningPatterns;
        
        expect(patterns).toHaveLength(1);
        expect(patterns[0].userDecision).toBe('close');
        expect(patterns[0].confidence).toBe(0.6);
        expect(patterns[0].occurrences).toBe(1);
      });

      test('類似パターンで既存パターンを更新する', async () => {
        const popupRecord1 = createPopupRecord('popup1', sampleCharacteristics1, 'close');
        await learningSystem.updateLearningData(popupRecord1);
        
        const popupRecord2 = createPopupRecord('popup2', sampleCharacteristics2, 'close');
        await learningSystem.updateLearningData(popupRecord2);
        
        const result = await chrome.storage.local.get(['learningPatterns']);
        const patterns = result.learningPatterns;
        
        expect(patterns).toHaveLength(1);
        expect(patterns[0].occurrences).toBe(2);
        expect(patterns[0].confidence).toBeGreaterThan(0.6);
      });

      test('異なる決定で信頼度を下げる', async () => {
        const popupRecord1 = createPopupRecord('popup1', sampleCharacteristics1, 'close');
        await learningSystem.updateLearningData(popupRecord1);
        
        const popupRecord2 = createPopupRecord('popup2', sampleCharacteristics2, 'keep');
        await learningSystem.updateLearningData(popupRecord2);
        
        const result = await chrome.storage.local.get(['learningPatterns']);
        const patterns = result.learningPatterns;
        
        expect(patterns).toHaveLength(1);
        expect(patterns[0].confidence).toBeLessThan(0.6);
      });

      test('学習が無効の場合はパターンを作成しない', async () => {
        mockStorage.data.userPreferences.learningEnabled = false;
        
        const popupRecord = createPopupRecord('popup1', sampleCharacteristics1, 'close');
        await learningSystem.updateLearningData(popupRecord);
        
        const result = await chrome.storage.local.get(['learningPatterns']);
        const patterns = result.learningPatterns;
        
        expect(patterns).toHaveLength(0);
      });

      test('無効な決定は学習しない', async () => {
        const popupRecord1 = createPopupRecord('popup1', sampleCharacteristics1, 'timeout');
        const popupRecord2 = createPopupRecord('popup2', sampleCharacteristics1, 'dismiss');
        
        await learningSystem.updateLearningData(popupRecord1);
        await learningSystem.updateLearningData(popupRecord2);
        
        const result = await chrome.storage.local.get(['learningPatterns']);
        const patterns = result.learningPatterns;
        
        expect(patterns).toHaveLength(0);
      });
    });

    describe('類似度計算', () => {
      test('同一特性の類似度は1.0', () => {
        const similarity = learningSystem.calculateSimilarity(sampleCharacteristics1, sampleCharacteristics1);
        expect(similarity).toBe(1.0);
      });

      test('類似特性の高い類似度', () => {
        const similarity = learningSystem.calculateSimilarity(sampleCharacteristics1, sampleCharacteristics2);
        expect(similarity).toBeGreaterThan(0.7);
      });

      test('異なる特性の低い類似度', () => {
        const differentCharacteristics = {
          hasCloseButton: false,
          containsAds: false,
          hasExternalLinks: false,
          isModal: false,
          zIndex: 100,
          dimensions: { width: 100, height: 50 }
        };
        
        const similarity = learningSystem.calculateSimilarity(sampleCharacteristics1, differentCharacteristics);
        expect(similarity).toBeLessThan(0.3);
      });

      test('寸法の類似度計算', () => {
        const similarity1 = learningSystem.calculateDimensionSimilarity(400, 420);
        const similarity2 = learningSystem.calculateDimensionSimilarity(400, 800);
        
        expect(similarity1).toBeGreaterThan(similarity2);
        expect(similarity1).toBeGreaterThan(0.9);
        expect(similarity2).toBeLessThan(0.6);
      });
    });

    describe('パターンマッチング', () => {
      test('マッチするパターンを検索する', () => {
        const patterns = [
          {
            patternId: 'pattern1',
            characteristics: sampleCharacteristics1,
            userDecision: 'close',
            confidence: 0.8,
            occurrences: 3,
            lastSeen: Date.now()
          }
        ];
        
        const match = learningSystem.findMatchingPattern(patterns, sampleCharacteristics2);
        expect(match).toBeTruthy();
        expect(match.patternId).toBe('pattern1');
      });

      test('類似度が閾値以下の場合はマッチしない', () => {
        const patterns = [
          {
            patternId: 'pattern1',
            characteristics: {
              hasCloseButton: false,
              containsAds: false,
              hasExternalLinks: false,
              isModal: false,
              zIndex: 100,
              dimensions: { width: 100, height: 50 }
            },
            userDecision: 'keep',
            confidence: 0.8,
            occurrences: 3,
            lastSeen: Date.now()
          }
        ];
        
        const match = learningSystem.findMatchingPattern(patterns, sampleCharacteristics1);
        expect(match).toBeNull();
      });
    });

    describe('パターンクリーンアップ', () => {
      test('古いパターンを削除する', () => {
        const now = Date.now();
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
            confidence: 0.6,
            occurrences: 3,
            lastSeen: now - (31 * 24 * 60 * 60 * 1000) // 31日前
          }
        ];
        
        const cleanedPatterns = learningSystem.cleanupPatterns(patterns);
        
        expect(cleanedPatterns).toHaveLength(1);
        expect(cleanedPatterns[0].patternId).toBe('pattern1');
      });

      test('低信頼度パターンを削除する', () => {
        const now = Date.now();
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
          }
        ];
        
        const cleanedPatterns = learningSystem.cleanupPatterns(patterns);
        
        expect(cleanedPatterns).toHaveLength(1);
        expect(cleanedPatterns[0].patternId).toBe('pattern1');
      });

      test('パターン数制限', () => {
        const now = Date.now();
        const patterns = Array.from({ length: 150 }, (_, i) => ({
          patternId: `pattern${i}`,
          characteristics: sampleCharacteristics1,
          userDecision: 'close',
          confidence: 0.5 + (i / 300), // 徐々に信頼度を上げる
          occurrences: i + 1,
          lastSeen: now
        }));
        
        const cleanedPatterns = learningSystem.cleanupPatterns(patterns);
        
        expect(cleanedPatterns.length).toBeLessThanOrEqual(100);
        // 高信頼度のパターンが残ることを確認
        expect(cleanedPatterns[0].confidence).toBeGreaterThan(0.8);
      });
    });

    describe('パターンベース提案', () => {
      test('高信頼度パターンから提案を生成する', async () => {
        const patterns = [
          {
            patternId: 'pattern1',
            characteristics: sampleCharacteristics1,
            userDecision: 'close',
            confidence: 0.9,
            occurrences: 10,
            lastSeen: Date.now()
          }
        ];
        
        await chrome.storage.local.set({ learningPatterns: patterns });
        
        const suggestion = await learningSystem.getPatternBasedSuggestion(sampleCharacteristics2, 'example.com');
        
        expect(suggestion).toBeTruthy();
        expect(suggestion.suggestion).toBe('close');
        expect(suggestion.confidence).toBe(0.9);
        expect(suggestion.similarity).toBeGreaterThan(0.8);
      });

      test('低信頼度パターンからは提案しない', async () => {
        const patterns = [
          {
            patternId: 'pattern1',
            characteristics: sampleCharacteristics1,
            userDecision: 'close',
            confidence: 0.5, // 閾値以下
            occurrences: 3,
            lastSeen: Date.now()
          }
        ];
        
        await chrome.storage.local.set({ learningPatterns: patterns });
        
        const suggestion = await learningSystem.getPatternBasedSuggestion(sampleCharacteristics2, 'example.com');
        
        expect(suggestion).toBeNull();
      });

      test('類似度が低い場合は提案しない', async () => {
        const patterns = [
          {
            patternId: 'pattern1',
            characteristics: {
              hasCloseButton: false,
              containsAds: false,
              hasExternalLinks: false,
              isModal: false,
              zIndex: 100,
              dimensions: { width: 100, height: 50 }
            },
            userDecision: 'close',
            confidence: 0.9,
            occurrences: 10,
            lastSeen: Date.now()
          }
        ];
        
        await chrome.storage.local.set({ learningPatterns: patterns });
        
        const suggestion = await learningSystem.getPatternBasedSuggestion(sampleCharacteristics1, 'example.com');
        
        expect(suggestion).toBeNull();
      });
    });

    describe('学習統計', () => {
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
            characteristics: sampleCharacteristics1,
            userDecision: 'close',
            confidence: 0.6,
            occurrences: 2,
            lastSeen: Date.now()
          }
        ];
        
        await chrome.storage.local.set({ learningPatterns: patterns });
        
        const stats = await learningSystem.getLearningStatistics();
        
        expect(stats.totalPatterns).toBe(3);
        expect(stats.highConfidencePatterns).toBe(1);
        expect(stats.closePatterns).toBe(2);
        expect(stats.keepPatterns).toBe(1);
        expect(stats.averageConfidence).toBeCloseTo(0.733, 2);
        expect(stats.totalOccurrences).toBe(10);
      });
    });
  });

  describe('ユーザー決定処理', () => {
    const mockPopupData = {
      id: 'popup_test_123',
      url: 'https://example.com/page',
      domain: 'example.com',
      timestamp: Date.now(),
      characteristics: {
        hasCloseButton: true,
        containsAds: true,
        isModal: true
      },
      userDecision: 'pending',
      confidence: 0.8
    };

    const mockTabId = 123;

    describe('決定ワークフロー', () => {
      test('ユーザー決定ワークフローを開始する', async () => {
        const result = await decisionProcessor.getUserDecision(mockPopupData, mockTabId);
        
        expect(result.success).toBe(true);
        expect(result.popupId).toBe(mockPopupData.id);
        expect(result.status).toBe('pending');
        expect(decisionProcessor.pendingDecisions.has(mockPopupData.id)).toBe(true);
      });

      test('有効な決定を処理する', async () => {
        await decisionProcessor.getUserDecision(mockPopupData, mockTabId);
        
        const decisionData = {
          popupId: mockPopupData.id,
          decision: 'close'
        };
        
        const result = await decisionProcessor.handleUserDecision(decisionData);
        
        expect(result.success).toBe(true);
        expect(result.decision).toBe('close');
        expect(decisionProcessor.pendingDecisions.has(mockPopupData.id)).toBe(false);
      });

      test('無効な決定を拒否する', async () => {
        await decisionProcessor.getUserDecision(mockPopupData, mockTabId);
        
        const decisionData = {
          popupId: mockPopupData.id,
          decision: 'invalid_decision'
        };
        
        const result = await decisionProcessor.handleUserDecision(decisionData);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid decision');
      });

      test('存在しないポップアップIDを処理する', async () => {
        const decisionData = {
          popupId: 'nonexistent_popup',
          decision: 'close'
        };
        
        const result = await decisionProcessor.handleUserDecision(decisionData);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Popup not found in pending decisions');
      });
    });

    describe('タイムアウト処理', () => {
      test('決定タイムアウトを処理する', async () => {
        await decisionProcessor.getUserDecision(mockPopupData, mockTabId);
        
        await decisionProcessor.handleDecisionTimeout(mockPopupData.id);
        
        expect(decisionProcessor.pendingDecisions.has(mockPopupData.id)).toBe(false);
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
          mockTabId,
          expect.objectContaining({
            type: 'USER_DECISION_TIMEOUT',
            data: { popupId: mockPopupData.id }
          })
        );
      });

      test('複数の同時決定を処理する', async () => {
        const popup1 = { ...mockPopupData, id: 'popup1' };
        const popup2 = { ...mockPopupData, id: 'popup2' };
        
        await decisionProcessor.getUserDecision(popup1, mockTabId);
        await decisionProcessor.getUserDecision(popup2, mockTabId + 1);
        
        expect(decisionProcessor.pendingDecisions.size).toBe(2);
        
        await decisionProcessor.handleUserDecision({ popupId: 'popup1', decision: 'close' });
        await decisionProcessor.handleUserDecision({ popupId: 'popup2', decision: 'keep' });
        
        expect(decisionProcessor.pendingDecisions.size).toBe(0);
      });

      test('決定の応答時間を記録する', async () => {
        const startTime = Date.now();
        await decisionProcessor.getUserDecision(mockPopupData, mockTabId);
        
        // 少し時間を進める
        jest.advanceTimersByTime(2000);
        
        const result = await decisionProcessor.handleUserDecision({
          popupId: mockPopupData.id,
          decision: 'close'
        });
        
        expect(result.success).toBe(true);
        
        // ユーザー決定が保存されることを確認
        const savedDecisions = await chrome.storage.local.get(['userDecisions']);
        const decisions = savedDecisions.userDecisions || [];
        const lastDecision = decisions[decisions.length - 1];
        
        expect(lastDecision.responseTime).toBeGreaterThan(0);
      });
    });

    describe('期限切れ決定のクリーンアップ', () => {
      test('期限切れ決定を削除する', async () => {
        const oldPopup = { ...mockPopupData, id: 'old_popup' };
        const recentPopup = { ...mockPopupData, id: 'recent_popup' };
        
        // 古い決定を追加
        const oldDecision = {
          popupData: oldPopup,
          tabId: mockTabId,
          timestamp: Date.now() - (10 * 60 * 1000), // 10分前
          status: 'pending'
        };
        
        // 最近の決定を追加
        const recentDecision = {
          popupData: recentPopup,
          tabId: mockTabId,
          timestamp: Date.now() - (2 * 60 * 1000), // 2分前
          status: 'pending'
        };
        
        decisionProcessor.pendingDecisions.set('old_popup', oldDecision);
        decisionProcessor.pendingDecisions.set('recent_popup', recentDecision);
        
        const cleanedCount = await decisionProcessor.cleanupExpiredDecisions();
        
        expect(cleanedCount).toBe(1);
        expect(decisionProcessor.pendingDecisions.has('old_popup')).toBe(false);
        expect(decisionProcessor.pendingDecisions.has('recent_popup')).toBe(true);
      });

      test('タイムアウトIDをクリアする', async () => {
        const timeoutId = setTimeout(() => {}, 1000);
        const decision = {
          popupData: mockPopupData,
          tabId: mockTabId,
          timestamp: Date.now() - (10 * 60 * 1000),
          status: 'pending',
          timeoutId: timeoutId
        };
        
        decisionProcessor.pendingDecisions.set(mockPopupData.id, decision);
        
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
        
        await decisionProcessor.cleanupExpiredDecisions();
        
        expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);
        
        clearTimeoutSpy.mockRestore();
      });
    });

    describe('ストレージ操作', () => {
      test('決定待ち状態を保存する', async () => {
        const decisionEntry = {
          popupData: mockPopupData,
          tabId: mockTabId,
          timestamp: Date.now(),
          status: 'pending'
        };
        
        await decisionProcessor.savePendingDecision(decisionEntry);
        
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          pendingDecisions: expect.objectContaining({
            [mockPopupData.id]: expect.objectContaining({
              popupData: mockPopupData,
              tabId: mockTabId,
              status: 'pending',
              timeoutId: null
            })
          })
        });
      });

      test('決定待ち状態を削除する', async () => {
        // 既存の決定待ち状態を設定
        mockStorage.data.pendingDecisions = {
          [mockPopupData.id]: {
            popupData: mockPopupData,
            tabId: mockTabId,
            status: 'pending'
          },
          'other_popup': {
            popupData: { id: 'other_popup' },
            tabId: 456,
            status: 'pending'
          }
        };
        
        await decisionProcessor.removePendingDecision(mockPopupData.id);
        
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          pendingDecisions: {
            'other_popup': expect.any(Object)
          }
        });
      });

      test('ユーザー決定を保存する', async () => {
        const decisionRecord = {
          ...mockPopupData,
          userDecision: 'close',
          decisionTimestamp: Date.now(),
          responseTime: 2500
        };
        
        await decisionProcessor.saveUserDecision(decisionRecord);
        
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          userDecisions: expect.arrayContaining([decisionRecord])
        });
      });

      test('決定履歴のサイズ制限', async () => {
        // 既存の決定を500件設定
        const existingDecisions = Array.from({ length: 500 }, (_, i) => ({
          id: `popup_${i}`,
          userDecision: 'close',
          timestamp: Date.now() - i * 1000
        }));
        
        mockStorage.data.userDecisions = existingDecisions;
        
        const newDecision = {
          ...mockPopupData,
          userDecision: 'keep',
          decisionTimestamp: Date.now()
        };
        
        await decisionProcessor.saveUserDecision(newDecision);
        
        const savedData = chrome.storage.local.set.mock.calls[0][0];
        expect(savedData.userDecisions).toHaveLength(500);
        expect(savedData.userDecisions[499]).toEqual(newDecision);
      });
    });
  });

  describe('統合テスト', () => {
    test('完全な決定ワークフロー', async () => {
      // 1. ポップアップ検出
      const popupRecord = createPopupRecord('popup_integration', sampleCharacteristics1, 'pending');
      
      // 2. 決定ワークフローを開始
      const decisionResult = await decisionProcessor.getUserDecision(popupRecord, mockTabId);
      expect(decisionResult.success).toBe(true);
      
      // 3. ユーザーが決定を行う
      const userDecision = await decisionProcessor.handleUserDecision({
        popupId: popupRecord.id,
        decision: 'close'
      });
      expect(userDecision.success).toBe(true);
      
      // 4. 学習システムが更新される
      const updatedRecord = { ...popupRecord, userDecision: 'close' };
      await learningSystem.updateLearningData(updatedRecord);
      
      // 5. パターンが作成されることを確認
      const patterns = await learningSystem.getLearningPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].userDecision).toBe('close');
      
      // 6. 次回の類似ポップアップで提案が生成される
      const suggestion = await learningSystem.getPatternBasedSuggestion(
        sampleCharacteristics2, 
        'example.com'
      );
      expect(suggestion).toBeTruthy();
      expect(suggestion.suggestion).toBe('close');
    });

    test('学習無効時のワークフロー', async () => {
      // 学習を無効にする
      mockStorage.data.userPreferences.learningEnabled = false;
      
      const popupRecord = createPopupRecord('popup_no_learning', sampleCharacteristics1, 'pending');
      
      // 決定ワークフローを実行
      await decisionProcessor.getUserDecision(popupRecord, mockTabId);
      await decisionProcessor.handleUserDecision({
        popupId: popupRecord.id,
        decision: 'close'
      });
      
      // 学習システムは更新されない
      const updatedRecord = { ...popupRecord, userDecision: 'close' };
      await learningSystem.updateLearningData(updatedRecord);
      
      const patterns = await learningSystem.getLearningPatterns();
      expect(patterns).toHaveLength(0);
    });

    test('複数ドメインでの学習', async () => {
      const domains = ['example.com', 'test.com', 'demo.org'];
      
      for (const domain of domains) {
        const popupRecord = createPopupRecord(
          `popup_${domain}`,
          sampleCharacteristics1,
          'close',
          domain
        );
        
        await learningSystem.updateLearningData(popupRecord);
      }
      
      const patterns = await learningSystem.getLearningPatterns();
      expect(patterns).toHaveLength(3);
      
      // 各ドメインのパターンが作成されることを確認
      const patternDomains = patterns.map(p => p.domain);
      expect(patternDomains).toEqual(expect.arrayContaining(domains));
    });

    test('パターンの進化と適応', async () => {
      // 初期パターンを作成
      const initialRecord = createPopupRecord('popup1', sampleCharacteristics1, 'close');
      await learningSystem.updateLearningData(initialRecord);
      
      // 類似の特性で異なる決定
      const conflictingRecord = createPopupRecord('popup2', sampleCharacteristics2, 'keep');
      await learningSystem.updateLearningData(conflictingRecord);
      
      // パターンの信頼度が下がることを確認
      const patterns = await learningSystem.getLearningPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0].confidence).toBeLessThan(0.6);
      
      // 同じ決定を繰り返すと信頼度が回復
      const consistentRecord = createPopupRecord('popup3', sampleCharacteristics1, 'keep');
      await learningSystem.updateLearningData(consistentRecord);
      
      const updatedPatterns = await learningSystem.getLearningPatterns();
      expect(updatedPatterns[0].userDecision).toBe('keep');
      expect(updatedPatterns[0].confidence).toBeGreaterThan(0.5);
    });
  });

  describe('エラーハンドリング', () => {
    test('ストレージエラーの処理', async () => {
      chrome.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));
      
      // エラーが発生してもクラッシュしない
      await expect(learningSystem.getUserPreferences()).resolves.toBeDefined();
    });

    test('無効なポップアップデータの処理', async () => {
      const invalidRecord = {
        id: null,
        characteristics: null,
        userDecision: 'invalid'
      };
      
      // 無効なデータでもエラーにならない
      await expect(learningSystem.updateLearningData(invalidRecord)).resolves.toBeUndefined();
    });

    test('Chrome runtime エラーの処理', async () => {
      chrome.runtime.lastError = { message: 'Runtime error' };
      
      const result = await decisionProcessor.getUserDecision(mockPopupData, mockTabId);
      expect(result).toBeDefined();
      
      chrome.runtime.lastError = null;
    });

    test('タイムアウト処理のエラーハンドリング', async () => {
      chrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Tab not found'));
      
      // タブが見つからなくてもエラーにならない
      await expect(
        decisionProcessor.handleDecisionTimeout('nonexistent_popup')
      ).resolves.toBeUndefined();
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量パターンでの学習パフォーマンス', async () => {
      const startTime = Date.now();
      
      // 100個のパターンを作成
      for (let i = 0; i < 100; i++) {
        const characteristics = {
          ...sampleCharacteristics1,
          zIndex: 9000 + i,
          dimensions: { width: 400 + i, height: 300 + i }
        };
        
        const record = createPopupRecord(`popup_${i}`, characteristics, 'close');
        await learningSystem.updateLearningData(record);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 100パターンの学習が5秒以内に完了することを確認
      expect(duration).toBeLessThan(5000);
    });

    test('類似度計算のパフォーマンス', () => {
      const patterns = Array.from({ length: 1000 }, (_, i) => ({
        characteristics: {
          ...sampleCharacteristics1,
          zIndex: 9000 + i
        }
      }));
      
      const startTime = Date.now();
      
      patterns.forEach(pattern => {
        learningSystem.calculateSimilarity(pattern.characteristics, sampleCharacteristics2);
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 1000回の類似度計算が1秒以内に完了することを確認
      expect(duration).toBeLessThan(1000);
    });

    test('決定処理の同時実行パフォーマンス', async () => {
      const promises = [];
      
      // 50個の同時決定を処理
      for (let i = 0; i < 50; i++) {
        const popupData = { ...mockPopupData, id: `popup_${i}` };
        promises.push(decisionProcessor.getUserDecision(popupData, mockTabId + i));
      }
      
      const startTime = Date.now();
      await Promise.all(promises);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      // 50個の同時決定処理が2秒以内に完了することを確認
      expect(duration).toBeLessThan(2000);
      expect(decisionProcessor.pendingDecisions.size).toBe(50);
    });
  });
});out(mockPopupData.id);
        
        expect(decisionProcessor.pendingDecisions.has(mockPopupData.id)).toBe(false);
        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
          mockTabId,
          expect.objectContaining({
            type: 'USER_DECISION_TIMEOUT',
            data: { popupId: mockPopupData.id }
          })
        );
      });

      test('期限切れ決定をクリーンアップする', async () => {
        // 古いタイムスタンプで決定を作成
        const oldDecision = {
          popupData: mockPopupData,
          tabId: mockTabId,
          timestamp: Date.now() - (10 * 60 * 1000), // 10分前
          status: 'pending',
          timeoutId: null
        };
        
        decisionProcessor.pendingDecisions.set(mockPopupData.id, oldDecision);
        
        const cleanedCount = await decisionProcessor.cleanupExpiredDecisions();
        
        expect(cleanedCount).toBe(1);
        expect(decisionProcessor.pendingDecisions.has(mockPopupData.id)).toBe(false);
      });
    });

    describe('複数決定の処理', () => {
      test('複数のポップアップを同時に処理する', async () => {
        const popup1 = { ...mockPopupData, id: 'popup_1' };
        const popup2 = { ...mockPopupData, id: 'popup_2' };
        const popup3 = { ...mockPopupData, id: 'popup_3' };
        
        await decisionProcessor.getUserDecision(popup1, mockTabId);
        await decisionProcessor.getUserDecision(popup2, mockTabId + 1);
        await decisionProcessor.getUserDecision(popup3, mockTabId + 2);
        
        expect(decisionProcessor.pendingDecisions.size).toBe(3);
      });

      test('個別のポップアップ決定を独立して処理する', async () => {
        const popup1 = { ...mockPopupData, id: 'popup_1' };
        const popup2 = { ...mockPopupData, id: 'popup_2' };
        
        await decisionProcessor.getUserDecision(popup1, mockTabId);
        await decisionProcessor.getUserDecision(popup2, mockTabId);
        
        // popup1を閉じる
        await decisionProcessor.handleUserDecision({
          popupId: 'popup_1',
          decision: 'close'
        });
        
        expect(decisionProcessor.pendingDecisions.has('popup_1')).toBe(false);
        expect(decisionProcessor.pendingDecisions.has('popup_2')).toBe(true);
        
        // popup2を保持
        await decisionProcessor.handleUserDecision({
          popupId: 'popup_2',
          decision: 'keep'
        });
        
        expect(decisionProcessor.pendingDecisions.has('popup_2')).toBe(false);
        expect(decisionProcessor.pendingDecisions.size).toBe(0);
      });
    });
  });

  describe('統合テスト', () => {
    test('決定処理と学習システムの統合', async () => {
      const popupData = {
        id: 'popup_integration_test',
        url: 'https://example.com/page',
        domain: 'example.com',
        timestamp: Date.now(),
        characteristics: {
          hasCloseButton: true,
          containsAds: true,
          isModal: true,
          zIndex: 9999,
          dimensions: { width: 400, height: 300 }
        },
        userDecision: 'pending',
        confidence: 0.8
      };
      
      // 決定ワークフローを開始
      await decisionProcessor.getUserDecision(popupData, 123);
      
      // ユーザーが決定を行う
      await decisionProcessor.handleUserDecision({
        popupId: popupData.id,
        decision: 'close'
      });
      
      // 学習パターンが作成されることを確認
      const result = await chrome.storage.local.get(['learningPatterns']);
      const patterns = result.learningPatterns;
      
      expect(patterns).toHaveLength(1);
      expect(patterns[0].userDecision).toBe('close');
      expect(patterns[0].characteristics).toEqual(popupData.characteristics);
    });

    test('学習システムからの提案を使用した決定処理', async () => {
      // 既存の学習パターンを設定
      const existingPattern = {
        patternId: 'pattern_existing',
        characteristics: {
          hasCloseButton: true,
          containsAds: true,
          isModal: true,
          zIndex: 9999,
          dimensions: { width: 400, height: 300 }
        },
        userDecision: 'close',
        confidence: 0.9,
        occurrences: 5,
        lastSeen: Date.now()
      };
      
      await chrome.storage.local.set({ learningPatterns: [existingPattern] });
      
      // 類似のポップアップで提案を取得
      const similarCharacteristics = {
        hasCloseButton: true,
        containsAds: true,
        isModal: true,
        zIndex: 10000,
        dimensions: { width: 420, height: 320 }
      };
      
      const suggestion = await learningSystem.getPatternBasedSuggestion(
        similarCharacteristics,
        'example.com'
      );
      
      expect(suggestion).toBeTruthy();
      expect(suggestion.suggestion).toBe('close');
      expect(suggestion.confidence).toBe(0.9);
      
      // 提案に基づいて決定を処理
      const popupData = {
        id: 'popup_suggestion_test',
        url: 'https://example.com/page',
        domain: 'example.com',
        timestamp: Date.now(),
        characteristics: similarCharacteristics,
        userDecision: 'pending',
        confidence: 0.8
      };
      
      await decisionProcessor.getUserDecision(popupData, 123);
      await decisionProcessor.handleUserDecision({
        popupId: popupData.id,
        decision: suggestion.suggestion
      });
      
      // パターンが更新されることを確認
      const updatedResult = await chrome.storage.local.get(['learningPatterns']);
      const updatedPatterns = updatedResult.learningPatterns;
      
      expect(updatedPatterns).toHaveLength(1);
      expect(updatedPatterns[0].occurrences).toBe(6); // 増加
      expect(updatedPatterns[0].confidence).toBeGreaterThan(0.9); // 向上
    });
  });

  describe('エラーハンドリング', () => {
    test('ストレージエラーの処理', async () => {
      mockStorage.get.mockRejectedValueOnce(new Error('Storage error'));
      
      // エラーが発生してもクラッシュしない
      await expect(learningSystem.updateLearningData({
        id: 'popup_error_test',
        characteristics: {},
        userDecision: 'close'
      })).resolves.not.toThrow();
    });

    test('無効なデータでの処理', async () => {
      const invalidPopupRecord = {
        id: 'popup_invalid',
        characteristics: null,
        userDecision: 'invalid_decision'
      };
      
      // 無効なデータでもクラッシュしない
      await expect(learningSystem.updateLearningData(invalidPopupRecord)).resolves.not.toThrow();
    });

    test('メッセージ送信エラーの処理', async () => {
      chrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Tab not found'));
      
      await decisionProcessor.getUserDecision(mockPopupData, 123);
      
      const result = await decisionProcessor.handleUserDecision({
        popupId: mockPopupData.id,
        decision: 'close'
      });
      
      // エラーがあってもメイン処理は成功する
      expect(result.success).toBe(true);
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量パターンでの類似度計算パフォーマンス', () => {
      const patterns = Array.from({ length: 1000 }, (_, i) => ({
        patternId: `pattern_${i}`,
        characteristics: {
          hasCloseButton: i % 2 === 0,
          containsAds: i % 3 === 0,
          isModal: i % 4 === 0,
          zIndex: 1000 + i,
          dimensions: { width: 300 + i, height: 200 + i }
        },
        userDecision: 'close',
        confidence: 0.5 + (i / 2000),
        occurrences: i + 1,
        lastSeen: Date.now()
      }));
      
      const testCharacteristics = {
        hasCloseButton: true,
        containsAds: true,
        isModal: true,
        zIndex: 1500,
        dimensions: { width: 400, height: 300 }
      };
      
      const startTime = Date.now();
      const match = learningSystem.findMatchingPattern(patterns, testCharacteristics);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // 100ms以内
      expect(match).toBeTruthy();
    });

    test('大量決定での処理パフォーマンス', async () => {
      const startTime = Date.now();
      
      // 100個の決定を並行処理
      const promises = Array.from({ length: 100 }, (_, i) => {
        const popupData = {
          ...mockPopupData,
          id: `popup_perf_${i}`
        };
        return decisionProcessor.getUserDecision(popupData, 123 + i);
      });
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
      expect(decisionProcessor.pendingDecisions.size).toBe(100);
    });
  });
});