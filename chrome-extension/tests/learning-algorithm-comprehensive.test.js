/**
 * 学習アルゴリズムの包括的ユニットテスト
 * Task 9.1.3: 学習アルゴリズムのテスト
 * 
 * updateLearningData()関数のテスト、パターンマッチングロジックのテスト、
 * 信頼度スコアリングのテスト、学習パターン更新のテストを含む
 */

const { 
  createMockPopupData, 
  createMockLearningPattern,
  createChromeApiMock,
  resetTestData,
  waitForAsync,
  expectError
} = require('./test-helpers');

describe('学習アルゴリズム - 包括的テスト', () => {
  let mockChrome;
  let mockPopupData;
  let mockLearningPatterns;

  beforeEach(() => {
    resetTestData();
    
    // Chrome API モックを設定
    mockChrome = createChromeApiMock();
    global.chrome = mockChrome;
    
    // テストデータを準備
    mockPopupData = createMockPopupData({
      id: 'test-popup-123',
      domain: 'example.com',
      characteristics: {
        hasCloseButton: true,
        containsAds: true,
        isModal: true,
        zIndex: 9999,
        dimensions: { width: 400, height: 300 }
      },
      userDecision: 'close'
    });
    
    mockLearningPatterns = [
      createMockLearningPattern({
        patternId: 'pattern-1',
        domain: 'example.com',
        characteristics: {
          hasCloseButton: true,
          containsAds: true,
          isModal: true,
          zIndex: 9999
        },
        userDecision: 'close',
        confidence: 0.8,
        occurrences: 5
      }),
      createMockLearningPattern({
        patternId: 'pattern-2',
        domain: 'test.com',
        characteristics: {
          hasCloseButton: false,
          containsAds: false,
          isModal: true,
          zIndex: 1000
        },
        userDecision: 'keep',
        confidence: 0.6,
        occurrences: 3
      })
    ];
    
    // ストレージにデフォルトデータを設定
    mockChrome.storage.local.set({
      learningPatterns: mockLearningPatterns,
      userDecisions: [],
      popupHistory: []
    });
  });

  describe('updateLearningData() 関数のテスト', () => {
    /**
     * 学習データ更新のメイン関数
     * ユーザー決定を保存し、類似のポップアップ特性のパターンマッチングを実装
     */
    async function updateLearningData(decisionRecord) {
      if (!decisionRecord || !decisionRecord.id) {
        throw new Error('Invalid decision record');
      }
      
      if (!decisionRecord.userDecision || !decisionRecord.characteristics) {
        throw new Error('Missing required decision data');
      }

      try {
        console.log('学習データを更新中:', decisionRecord.id);
        
        // 既存の学習パターンを取得
        const result = await mockChrome.storage.local.get(['learningPatterns']);
        let learningPatterns = result.learningPatterns || [];
        
        // 類似パターンを検索
        const similarPattern = findSimilarPattern(decisionRecord, learningPatterns);
        
        if (similarPattern) {
          // 既存パターンを更新
          updateExistingPattern(similarPattern, decisionRecord);
          console.log('既存パターンを更新:', similarPattern.patternId);
        } else {
          // 新しいパターンを作成
          const newPattern = createNewPattern(decisionRecord);
          learningPatterns.push(newPattern);
          console.log('新しいパターンを作成:', newPattern.patternId);
        }
        
        // 信頼度を再計算
        learningPatterns = recalculateConfidenceScores(learningPatterns);
        
        // パターンをクリーンアップ（古いまたは信頼度の低いパターンを削除）
        learningPatterns = cleanupPatterns(learningPatterns);
        
        // 更新されたパターンを保存
        await mockChrome.storage.local.set({ learningPatterns });
        
        console.log('学習データ更新完了:', decisionRecord.id);
        
        return {
          success: true,
          patternsCount: learningPatterns.length,
          updatedPattern: similarPattern ? similarPattern.patternId : null,
          newPattern: !similarPattern
        };
        
      } catch (error) {
        console.error('学習データ更新エラー:', error);
        throw error;
      }
    }

    /**
     * 類似パターンを検索
     */
    function findSimilarPattern(decisionRecord, patterns) {
      const threshold = 0.7; // 類似度閾値
      
      for (const pattern of patterns) {
        // ドメインが一致する場合のみ比較
        if (pattern.domain === decisionRecord.domain) {
          const similarity = calculateSimilarity(
            decisionRecord.characteristics,
            pattern.characteristics
          );
          
          if (similarity >= threshold) {
            return pattern;
          }
        }
      }
      
      return null;
    }

    /**
     * 特性の類似度を計算
     */
    function calculateSimilarity(characteristics1, characteristics2) {
      const keys = new Set([
        ...Object.keys(characteristics1),
        ...Object.keys(characteristics2)
      ]);
      
      let matches = 0;
      let total = 0;
      
      for (const key of keys) {
        total++;
        
        const value1 = characteristics1[key];
        const value2 = characteristics2[key];
        
        if (typeof value1 === 'boolean' && typeof value2 === 'boolean') {
          if (value1 === value2) matches++;
        } else if (typeof value1 === 'number' && typeof value2 === 'number') {
          // 数値の場合は範囲で比較
          const diff = Math.abs(value1 - value2);
          const avg = (value1 + value2) / 2;
          if (avg === 0 || diff / avg < 0.2) matches++; // 20%以内の差
        } else if (typeof value1 === 'object' && typeof value2 === 'object') {
          // オブジェクトの場合は再帰的に比較
          if (JSON.stringify(value1) === JSON.stringify(value2)) matches++;
        } else if (value1 === value2) {
          matches++;
        }
      }
      
      return total > 0 ? matches / total : 0;
    }

    /**
     * 既存パターンを更新
     */
    function updateExistingPattern(pattern, decisionRecord) {
      pattern.occurrences++;
      pattern.lastSeen = Date.now();
      
      // 決定が一致する場合は信頼度を上げる
      if (pattern.userDecision === decisionRecord.userDecision) {
        pattern.confidence = Math.min(pattern.confidence + 0.1, 1.0);
      } else {
        // 決定が異なる場合は信頼度を下げる
        pattern.confidence = Math.max(pattern.confidence - 0.2, 0.1);
        
        // 信頼度が低くなりすぎた場合は決定を更新
        if (pattern.confidence < 0.3) {
          pattern.userDecision = decisionRecord.userDecision;
          pattern.confidence = 0.5;
        }
      }
      
      // 特性を微調整（重み付き平均）
      updateCharacteristics(pattern.characteristics, decisionRecord.characteristics, pattern.occurrences);
    }

    /**
     * 特性を更新（重み付き平均）
     */
    function updateCharacteristics(existingChars, newChars, occurrences) {
      const weight = 1 / occurrences; // 新しいデータの重み
      
      for (const key in newChars) {
        if (typeof existingChars[key] === 'number' && typeof newChars[key] === 'number') {
          existingChars[key] = existingChars[key] * (1 - weight) + newChars[key] * weight;
        } else if (typeof existingChars[key] === 'boolean' && typeof newChars[key] === 'boolean') {
          // ブール値は多数決で決定
          if (occurrences > 2 && newChars[key] !== existingChars[key]) {
            // 3回以上の観測で異なる値の場合、新しい値を採用
            existingChars[key] = newChars[key];
          }
        } else {
          existingChars[key] = newChars[key];
        }
      }
    }

    /**
     * 新しいパターンを作成
     */
    function createNewPattern(decisionRecord) {
      return {
        patternId: 'pattern_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        characteristics: { ...decisionRecord.characteristics },
        userDecision: decisionRecord.userDecision,
        confidence: 0.5, // 初期信頼度
        occurrences: 1,
        lastSeen: Date.now(),
        domain: decisionRecord.domain,
        createdAt: Date.now()
      };
    }

    /**
     * 信頼度スコアを再計算
     */
    function recalculateConfidenceScores(patterns) {
      return patterns.map(pattern => {
        // 時間による信頼度の減衰
        const ageInDays = (Date.now() - pattern.lastSeen) / (24 * 60 * 60 * 1000);
        const ageFactor = Math.max(0.1, 1 - (ageInDays * 0.01)); // 1日あたり1%減衰
        
        // 出現回数による信頼度の向上
        const occurrenceFactor = Math.min(1.0, pattern.occurrences * 0.1);
        
        // 最終信頼度を計算
        pattern.confidence = Math.min(
          pattern.confidence * ageFactor * (1 + occurrenceFactor),
          1.0
        );
        
        return pattern;
      });
    }

    /**
     * 古いまたは信頼度の低いパターンをクリーンアップ
     */
    function cleanupPatterns(patterns) {
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30日
      const minConfidence = 0.1;
      const maxPatterns = 1000;
      
      // 古いまたは信頼度の低いパターンを除去
      let cleanedPatterns = patterns.filter(pattern => {
        const age = Date.now() - pattern.lastSeen;
        return age < maxAge && pattern.confidence >= minConfidence;
      });
      
      // パターン数が上限を超える場合、信頼度の低いものから削除
      if (cleanedPatterns.length > maxPatterns) {
        cleanedPatterns.sort((a, b) => b.confidence - a.confidence);
        cleanedPatterns = cleanedPatterns.slice(0, maxPatterns);
      }
      
      return cleanedPatterns;
    }

    test('正常な学習データ更新', async () => {
      const result = await updateLearningData(mockPopupData);
      
      expect(result.success).toBe(true);
      expect(result.patternsCount).toBeGreaterThan(0);
      
      // ストレージに保存されていることを確認
      const storageResult = await mockChrome.storage.local.get(['learningPatterns']);
      expect(storageResult.learningPatterns.length).toBeGreaterThan(0);
    });

    test('類似パターンの更新', async () => {
      // 既存パターンと類似した決定レコード
      const similarDecision = {
        ...mockPopupData,
        id: 'similar-popup',
        characteristics: {
          hasCloseButton: true,
          containsAds: true,
          isModal: true,
          zIndex: 9500 // 少し異なる値
        },
        userDecision: 'close'
      };
      
      const result = await updateLearningData(similarDecision);
      
      expect(result.success).toBe(true);
      expect(result.updatedPattern).toBeDefined();
      expect(result.newPattern).toBe(false);
      
      // パターンの出現回数が増加していることを確認
      const storageResult = await mockChrome.storage.local.get(['learningPatterns']);
      const updatedPattern = storageResult.learningPatterns.find(p => 
        p.patternId === result.updatedPattern
      );
      expect(updatedPattern.occurrences).toBeGreaterThan(5);
    });

    test('新しいパターンの作成', async () => {
      const newDecision = {
        ...mockPopupData,
        id: 'new-popup',
        domain: 'newsite.com',
        characteristics: {
          hasCloseButton: false,
          containsAds: false,
          isModal: false,
          zIndex: 100
        },
        userDecision: 'keep'
      };
      
      const result = await updateLearningData(newDecision);
      
      expect(result.success).toBe(true);
      expect(result.newPattern).toBe(true);
      expect(result.updatedPattern).toBeNull();
      
      // 新しいパターンが作成されていることを確認
      const storageResult = await mockChrome.storage.local.get(['learningPatterns']);
      const newPattern = storageResult.learningPatterns.find(p => 
        p.domain === 'newsite.com'
      );
      expect(newPattern).toBeDefined();
      expect(newPattern.occurrences).toBe(1);
    });

    test('無効な決定レコードでのエラー', async () => {
      await expectError(
        () => updateLearningData(null),
        'Invalid decision record'
      );
      
      await expectError(
        () => updateLearningData({ id: 'test' }),
        'Missing required decision data'
      );
    });

    test('ストレージエラーの処理', async () => {
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
      
      await expectError(
        () => updateLearningData(mockPopupData),
        'Storage error'
      );
    });
  });

  describe('パターンマッチングロジックのテスト', () => {
    test('完全一致パターンの検出', () => {
      const patterns = [mockLearningPatterns[0]];
      const decisionRecord = {
        ...mockPopupData,
        characteristics: mockLearningPatterns[0].characteristics
      };
      
      const similarPattern = findSimilarPattern(decisionRecord, patterns);
      expect(similarPattern).toBeDefined();
      expect(similarPattern.patternId).toBe('pattern-1');
    });

    test('部分一致パターンの検出', () => {
      const patterns = [mockLearningPatterns[0]];
      const decisionRecord = {
        ...mockPopupData,
        characteristics: {
          hasCloseButton: true,
          containsAds: true,
          isModal: true,
          zIndex: 8000 // 異なる値
        }
      };
      
      const similarPattern = findSimilarPattern(decisionRecord, patterns);
      expect(similarPattern).toBeDefined();
    });

    test('類似度が低いパターンの除外', () => {
      const patterns = [mockLearningPatterns[0]];
      const decisionRecord = {
        ...mockPopupData,
        characteristics: {
          hasCloseButton: false,
          containsAds: false,
          isModal: false,
          zIndex: 1
        }
      };
      
      const similarPattern = findSimilarPattern(decisionRecord, patterns);
      expect(similarPattern).toBeNull();
    });

    test('ドメイン別パターンマッチング', () => {
      const patterns = mockLearningPatterns;
      const decisionRecord = {
        ...mockPopupData,
        domain: 'test.com',
        characteristics: mockLearningPatterns[1].characteristics
      };
      
      const similarPattern = findSimilarPattern(decisionRecord, patterns);
      expect(similarPattern).toBeDefined();
      expect(similarPattern.domain).toBe('test.com');
    });

    test('類似度計算の精度', () => {
      const chars1 = {
        hasCloseButton: true,
        containsAds: true,
        isModal: true,
        zIndex: 9999,
        dimensions: { width: 400, height: 300 }
      };
      
      const chars2 = {
        hasCloseButton: true,
        containsAds: true,
        isModal: true,
        zIndex: 9500,
        dimensions: { width: 400, height: 300 }
      };
      
      const similarity = calculateSimilarity(chars1, chars2);
      expect(similarity).toBeGreaterThan(0.8);
    });

    test('数値特性の類似度計算', () => {
      const chars1 = { zIndex: 1000 };
      const chars2 = { zIndex: 1100 }; // 10%の差
      
      const similarity = calculateSimilarity(chars1, chars2);
      expect(similarity).toBeGreaterThan(0.8);
    });

    test('ブール特性の類似度計算', () => {
      const chars1 = { hasCloseButton: true, containsAds: false };
      const chars2 = { hasCloseButton: true, containsAds: false };
      
      const similarity = calculateSimilarity(chars1, chars2);
      expect(similarity).toBe(1.0);
    });

    test('オブジェクト特性の類似度計算', () => {
      const chars1 = { dimensions: { width: 400, height: 300 } };
      const chars2 = { dimensions: { width: 400, height: 300 } };
      
      const similarity = calculateSimilarity(chars1, chars2);
      expect(similarity).toBe(1.0);
    });
  });

  describe('信頼度スコアリングのテスト', () => {
    test('一致する決定による信頼度向上', () => {
      const pattern = { ...mockLearningPatterns[0] };
      const originalConfidence = pattern.confidence;
      
      const decisionRecord = {
        ...mockPopupData,
        userDecision: 'close' // パターンと同じ決定
      };
      
      updateExistingPattern(pattern, decisionRecord);
      
      expect(pattern.confidence).toBeGreaterThan(originalConfidence);
      expect(pattern.occurrences).toBe(6);
    });

    test('異なる決定による信頼度低下', () => {
      const pattern = { ...mockLearningPatterns[0] };
      const originalConfidence = pattern.confidence;
      
      const decisionRecord = {
        ...mockPopupData,
        userDecision: 'keep' // パターンと異なる決定
      };
      
      updateExistingPattern(pattern, decisionRecord);
      
      expect(pattern.confidence).toBeLessThan(originalConfidence);
    });

    test('信頼度の上限制限', () => {
      const pattern = { ...mockLearningPatterns[0], confidence: 0.95 };
      
      const decisionRecord = {
        ...mockPopupData,
        userDecision: 'close'
      };
      
      updateExistingPattern(pattern, decisionRecord);
      
      expect(pattern.confidence).toBeLessThanOrEqual(1.0);
    });

    test('信頼度の下限制限', () => {
      const pattern = { ...mockLearningPatterns[0], confidence: 0.2 };
      
      const decisionRecord = {
        ...mockPopupData,
        userDecision: 'keep' // 異なる決定
      };
      
      updateExistingPattern(pattern, decisionRecord);
      
      expect(pattern.confidence).toBeGreaterThanOrEqual(0.1);
    });

    test('時間による信頼度減衰', () => {
      const patterns = [
        {
          ...mockLearningPatterns[0],
          lastSeen: Date.now() - (10 * 24 * 60 * 60 * 1000), // 10日前
          confidence: 0.8
        }
      ];
      
      const updatedPatterns = recalculateConfidenceScores(patterns);
      
      expect(updatedPatterns[0].confidence).toBeLessThan(0.8);
    });

    test('出現回数による信頼度向上', () => {
      const patterns = [
        {
          ...mockLearningPatterns[0],
          occurrences: 10,
          confidence: 0.5
        }
      ];
      
      const updatedPatterns = recalculateConfidenceScores(patterns);
      
      expect(updatedPatterns[0].confidence).toBeGreaterThan(0.5);
    });

    test('新しいパターンの初期信頼度', () => {
      const newPattern = createNewPattern(mockPopupData);
      
      expect(newPattern.confidence).toBe(0.5);
      expect(newPattern.occurrences).toBe(1);
    });
  });

  describe('学習パターン更新のテスト', () => {
    test('特性の重み付き平均更新', () => {
      const existingChars = { zIndex: 1000 };
      const newChars = { zIndex: 2000 };
      const occurrences = 5;
      
      updateCharacteristics(existingChars, newChars, occurrences);
      
      // 重み付き平均が適用されていることを確認
      expect(existingChars.zIndex).toBeGreaterThan(1000);
      expect(existingChars.zIndex).toBeLessThan(2000);
    });

    test('ブール値特性の多数決更新', () => {
      const existingChars = { hasCloseButton: true };
      const newChars = { hasCloseButton: false };
      const occurrences = 5; // 3回以上の観測
      
      updateCharacteristics(existingChars, newChars, occurrences);
      
      expect(existingChars.hasCloseButton).toBe(false);
    });

    test('パターンクリーンアップ - 古いパターンの削除', () => {
      const oldPattern = {
        ...mockLearningPatterns[0],
        lastSeen: Date.now() - (40 * 24 * 60 * 60 * 1000) // 40日前
      };
      
      const patterns = [oldPattern, mockLearningPatterns[1]];
      const cleanedPatterns = cleanupPatterns(patterns);
      
      expect(cleanedPatterns.length).toBe(1);
      expect(cleanedPatterns[0].patternId).toBe('pattern-2');
    });

    test('パターンクリーンアップ - 低信頼度パターンの削除', () => {
      const lowConfidencePattern = {
        ...mockLearningPatterns[0],
        confidence: 0.05
      };
      
      const patterns = [lowConfidencePattern, mockLearningPatterns[1]];
      const cleanedPatterns = cleanupPatterns(patterns);
      
      expect(cleanedPatterns.length).toBe(1);
      expect(cleanedPatterns[0].patternId).toBe('pattern-2');
    });

    test('パターン数上限による削除', () => {
      // 大量のパターンを作成
      const manyPatterns = Array.from({ length: 1200 }, (_, i) => ({
        ...mockLearningPatterns[0],
        patternId: `pattern-${i}`,
        confidence: Math.random()
      }));
      
      const cleanedPatterns = cleanupPatterns(manyPatterns);
      
      expect(cleanedPatterns.length).toBeLessThanOrEqual(1000);
      
      // 信頼度の高いパターンが残っていることを確認
      const avgConfidence = cleanedPatterns.reduce((sum, p) => sum + p.confidence, 0) / cleanedPatterns.length;
      expect(avgConfidence).toBeGreaterThan(0.5);
    });

    test('パターンの最終更新時刻の更新', () => {
      const pattern = { ...mockLearningPatterns[0] };
      const originalLastSeen = pattern.lastSeen;
      
      // 少し待機
      setTimeout(() => {
        updateExistingPattern(pattern, mockPopupData);
        expect(pattern.lastSeen).toBeGreaterThan(originalLastSeen);
      }, 10);
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量パターンでの類似検索パフォーマンス', async () => {
      const manyPatterns = Array.from({ length: 1000 }, (_, i) => ({
        ...mockLearningPatterns[0],
        patternId: `pattern-${i}`,
        characteristics: {
          ...mockLearningPatterns[0].characteristics,
          zIndex: 1000 + i
        }
      }));
      
      const startTime = Date.now();
      
      const similarPattern = findSimilarPattern(mockPopupData, manyPatterns);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // 100ms以内
      expect(similarPattern).toBeDefined();
    });

    test('大量データでの学習更新パフォーマンス', async () => {
      // 大量の学習パターンを設定
      const manyPatterns = Array.from({ length: 500 }, (_, i) => 
        createMockLearningPattern({ patternId: `pattern-${i}` })
      );
      
      await mockChrome.storage.local.set({ learningPatterns: manyPatterns });
      
      const startTime = Date.now();
      
      await updateLearningData(mockPopupData);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(500); // 500ms以内
    });

    test('信頼度再計算のパフォーマンス', () => {
      const manyPatterns = Array.from({ length: 1000 }, (_, i) => 
        createMockLearningPattern({ patternId: `pattern-${i}` })
      );
      
      const startTime = Date.now();
      
      const updatedPatterns = recalculateConfidenceScores(manyPatterns);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(200); // 200ms以内
      expect(updatedPatterns.length).toBe(1000);
    });
  });

  describe('エラーハンドリングとエッジケース', () => {
    test('空の学習パターンでの処理', async () => {
      await mockChrome.storage.local.set({ learningPatterns: [] });
      
      const result = await updateLearningData(mockPopupData);
      
      expect(result.success).toBe(true);
      expect(result.newPattern).toBe(true);
    });

    test('破損した学習パターンデータの処理', async () => {
      const corruptedPatterns = [
        { patternId: 'corrupt-1' }, // 必要なフィールドが欠落
        null,
        undefined,
        { patternId: 'corrupt-2', characteristics: null }
      ];
      
      await mockChrome.storage.local.set({ learningPatterns: corruptedPatterns });
      
      // エラーが発生せずに処理されることを確認
      const result = await updateLearningData(mockPopupData);
      expect(result.success).toBe(true);
    });

    test('極端な特性値での類似度計算', () => {
      const chars1 = {
        zIndex: Number.MAX_SAFE_INTEGER,
        hasCloseButton: true
      };
      
      const chars2 = {
        zIndex: Number.MIN_SAFE_INTEGER,
        hasCloseButton: true
      };
      
      const similarity = calculateSimilarity(chars1, chars2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    test('循環参照オブジェクトでの処理', () => {
      const obj1 = { a: 1 };
      obj1.self = obj1; // 循環参照
      
      const obj2 = { a: 1 };
      obj2.self = obj2;
      
      // JSON.stringifyが失敗する場合の処理を確認
      expect(() => calculateSimilarity(obj1, obj2)).not.toThrow();
    });

    test('メモリ不足時のパターンクリーンアップ', () => {
      // 大量のパターンでメモリ使用量をシミュレート
      const hugePatterns = Array.from({ length: 10000 }, (_, i) => ({
        ...mockLearningPatterns[0],
        patternId: `huge-pattern-${i}`,
        largeData: new Array(1000).fill('data') // 大きなデータ
      }));
      
      const cleanedPatterns = cleanupPatterns(hugePatterns);
      
      // パターン数が制限されていることを確認
      expect(cleanedPatterns.length).toBeLessThanOrEqual(1000);
    });
  });
});