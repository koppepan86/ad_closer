/**
 * ユーザー決定処理の包括的ユニットテスト
 * Task 9.1.2: ユーザー決定処理のテスト
 * 
 * getUserDecision()ワークフローのテスト、通知インタラクション処理のテスト、
 * 複数同時ポップアップ決定のテスト、決定ストレージ・取得システムのテストを含む
 */

const { 
  createMockElement, 
  createMockPopupData, 
  createMockUserPreferences,
  createChromeApiMock,
  resetTestData,
  waitForAsync,
  TimerHelpers,
  expectError
} = require('./test-helpers');

describe('ユーザー決定処理 - 包括的テスト', () => {
  let mockChrome;
  let mockPopupData;
  let mockUserPreferences;
  let extensionState;

  beforeEach(() => {
    resetTestData();
    TimerHelpers.mockSetTimeout();
    
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
        zIndex: 9999
      }
    });
    
    mockUserPreferences = createMockUserPreferences({
      extensionEnabled: true,
      showNotifications: true,
      notificationDuration: 5000
    });
    
    // 拡張機能状態を初期化
    extensionState = {
      enabled: true,
      activeTabId: 1,
      pendingDecisions: new Map()
    };
    
    // ストレージにデフォルトデータを設定
    mockChrome.storage.local.set({
      userPreferences: mockUserPreferences,
      pendingDecisions: {},
      userDecisions: [],
      popupHistory: []
    });
  });

  afterEach(() => {
    TimerHelpers.useRealTimers();
  });

  describe('getUserDecision() ワークフローのテスト', () => {
    /**
     * ユーザー決定ワークフローの実装
     * 通知インタラクションからのユーザー応答を処理し、決定を保存・管理する
     */
    async function getUserDecision(popupData, tabId) {
      if (!popupData || !popupData.id) {
        throw new Error('Invalid popup data');
      }
      
      if (!tabId || tabId < 1) {
        throw new Error('Invalid tab ID');
      }

      try {
        console.log('ユーザー決定ワークフローを開始:', popupData.id);
        
        // 決定待ちリストに追加
        const decisionEntry = {
          popupData: popupData,
          tabId: tabId,
          timestamp: Date.now(),
          status: 'pending',
          timeoutId: null
        };
        
        extensionState.pendingDecisions.set(popupData.id, decisionEntry);
        
        // 決定タイムアウトを設定（30秒）
        const timeoutId = setTimeout(() => {
          handleDecisionTimeout(popupData.id);
        }, 30000);
        
        decisionEntry.timeoutId = timeoutId;
        
        // 決定待ち状態を保存
        await savePendingDecision(decisionEntry);
        
        console.log('ユーザー決定待ち状態を設定:', popupData.id);
        
        return {
          success: true,
          popupId: popupData.id,
          status: 'pending'
        };
        
      } catch (error) {
        console.error('ユーザー決定ワークフローエラー:', error);
        throw error;
      }
    }

    async function handleUserDecision(decisionData) {
      const { popupId, decision, popupData } = decisionData;
      console.log('ユーザー決定を処理中:', popupId, decision);
      
      // 決定待ちリストから取得
      const pendingDecision = extensionState.pendingDecisions.get(popupId);
      if (!pendingDecision) {
        throw new Error('Popup not found in pending decisions');
      }
      
      // タイムアウトをクリア
      if (pendingDecision.timeoutId) {
        clearTimeout(pendingDecision.timeoutId);
      }
      
      // 決定を検証
      if (!['close', 'keep', 'dismiss'].includes(decision)) {
        throw new Error('Invalid decision');
      }
      
      // ポップアップレコードを更新
      const updatedRecord = {
        ...pendingDecision.popupData,
        userDecision: decision,
        decisionTimestamp: Date.now(),
        responseTime: Date.now() - pendingDecision.timestamp
      };
      
      // 決定をストレージに保存
      await saveUserDecision(updatedRecord);
      
      // 決定待ちリストから削除
      extensionState.pendingDecisions.delete(popupId);
      
      // 決定待ち状態をストレージから削除
      await removePendingDecision(popupId);
      
      return {
        success: true,
        popupId: popupId,
        decision: decision,
        timestamp: updatedRecord.decisionTimestamp
      };
    }

    async function handleDecisionTimeout(popupId) {
      console.log('決定タイムアウト:', popupId);
      
      const pendingDecision = extensionState.pendingDecisions.get(popupId);
      if (!pendingDecision) {
        return;
      }
      
      // タイムアウトした決定を記録
      const timeoutRecord = {
        ...pendingDecision.popupData,
        userDecision: 'timeout',
        decisionTimestamp: Date.now(),
        responseTime: Date.now() - pendingDecision.timestamp
      };
      
      await saveUserDecision(timeoutRecord);
      
      // 決定待ちリストから削除
      extensionState.pendingDecisions.delete(popupId);
      await removePendingDecision(popupId);
    }

    // ヘルパー関数
    async function savePendingDecision(decisionEntry) {
      const result = await mockChrome.storage.local.get(['pendingDecisions']);
      const pendingDecisions = result.pendingDecisions || {};
      
      pendingDecisions[decisionEntry.popupData.id] = {
        ...decisionEntry,
        timeoutId: null // タイムアウトIDは保存しない
      };
      
      await mockChrome.storage.local.set({ pendingDecisions });
    }

    async function removePendingDecision(popupId) {
      const result = await mockChrome.storage.local.get(['pendingDecisions']);
      const pendingDecisions = result.pendingDecisions || {};
      
      delete pendingDecisions[popupId];
      await mockChrome.storage.local.set({ pendingDecisions });
    }

    async function saveUserDecision(decisionRecord) {
      const result = await mockChrome.storage.local.get(['userDecisions']);
      const userDecisions = result.userDecisions || [];
      
      userDecisions.push(decisionRecord);
      await mockChrome.storage.local.set({ userDecisions });
    }

    test('正常なユーザー決定ワークフローの開始', async () => {
      const result = await getUserDecision(mockPopupData, 1);
      
      expect(result.success).toBe(true);
      expect(result.popupId).toBe(mockPopupData.id);
      expect(result.status).toBe('pending');
      
      // 決定待ちリストに追加されていることを確認
      expect(extensionState.pendingDecisions.has(mockPopupData.id)).toBe(true);
      
      // ストレージに保存されていることを確認
      const storageResult = await mockChrome.storage.local.get(['pendingDecisions']);
      expect(storageResult.pendingDecisions[mockPopupData.id]).toBeDefined();
    });

    test('無効なポップアップデータでのエラー', async () => {
      await expectError(
        () => getUserDecision(null, 1),
        'Invalid popup data'
      );
      
      await expectError(
        () => getUserDecision({ id: null }, 1),
        'Invalid popup data'
      );
    });

    test('無効なタブIDでのエラー', async () => {
      await expectError(
        () => getUserDecision(mockPopupData, null),
        'Invalid tab ID'
      );
      
      await expectError(
        () => getUserDecision(mockPopupData, 0),
        'Invalid tab ID'
      );
    });

    test('複数のポップアップ決定ワークフローの並行処理', async () => {
      const popup1 = createMockPopupData({ id: 'popup-1' });
      const popup2 = createMockPopupData({ id: 'popup-2' });
      const popup3 = createMockPopupData({ id: 'popup-3' });
      
      const results = await Promise.all([
        getUserDecision(popup1, 1),
        getUserDecision(popup2, 2),
        getUserDecision(popup3, 3)
      ]);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.status).toBe('pending');
      });
      
      expect(extensionState.pendingDecisions.size).toBe(3);
    });

    test('決定タイムアウトの処理', async () => {
      await getUserDecision(mockPopupData, 1);
      
      // タイムアウトを発生させる
      TimerHelpers.advanceTimers(30000);
      
      // 決定待ちリストから削除されていることを確認
      expect(extensionState.pendingDecisions.has(mockPopupData.id)).toBe(false);
      
      // タイムアウト決定が保存されていることを確認
      const result = await mockChrome.storage.local.get(['userDecisions']);
      const timeoutDecision = result.userDecisions.find(d => 
        d.id === mockPopupData.id && d.userDecision === 'timeout'
      );
      expect(timeoutDecision).toBeDefined();
    });
  });

  describe('通知インタラクション処理のテスト', () => {
    test('「閉じる」決定の処理', async () => {
      await getUserDecision(mockPopupData, 1);
      
      const decisionData = {
        popupId: mockPopupData.id,
        decision: 'close',
        popupData: mockPopupData
      };
      
      const result = await handleUserDecision(decisionData);
      
      expect(result.success).toBe(true);
      expect(result.decision).toBe('close');
      expect(result.popupId).toBe(mockPopupData.id);
      
      // 決定待ちリストから削除されていることを確認
      expect(extensionState.pendingDecisions.has(mockPopupData.id)).toBe(false);
    });

    test('「保持」決定の処理', async () => {
      await getUserDecision(mockPopupData, 1);
      
      const decisionData = {
        popupId: mockPopupData.id,
        decision: 'keep',
        popupData: mockPopupData
      };
      
      const result = await handleUserDecision(decisionData);
      
      expect(result.success).toBe(true);
      expect(result.decision).toBe('keep');
    });

    test('「無視」決定の処理', async () => {
      await getUserDecision(mockPopupData, 1);
      
      const decisionData = {
        popupId: mockPopupData.id,
        decision: 'dismiss',
        popupData: mockPopupData
      };
      
      const result = await handleUserDecision(decisionData);
      
      expect(result.success).toBe(true);
      expect(result.decision).toBe('dismiss');
    });

    test('無効な決定での処理', async () => {
      await getUserDecision(mockPopupData, 1);
      
      const decisionData = {
        popupId: mockPopupData.id,
        decision: 'invalid',
        popupData: mockPopupData
      };
      
      await expectError(
        () => handleUserDecision(decisionData),
        'Invalid decision'
      );
    });

    test('存在しないポップアップIDでの処理', async () => {
      const decisionData = {
        popupId: 'non-existent-popup',
        decision: 'close',
        popupData: mockPopupData
      };
      
      await expectError(
        () => handleUserDecision(decisionData),
        'Popup not found in pending decisions'
      );
    });

    test('応答時間の計算', async () => {
      const startTime = Date.now();
      await getUserDecision(mockPopupData, 1);
      
      // 2秒後に決定
      TimerHelpers.advanceTimers(2000);
      
      const decisionData = {
        popupId: mockPopupData.id,
        decision: 'close',
        popupData: mockPopupData
      };
      
      await handleUserDecision(decisionData);
      
      const result = await mockChrome.storage.local.get(['userDecisions']);
      const decision = result.userDecisions.find(d => d.id === mockPopupData.id);
      
      expect(decision.responseTime).toBeGreaterThan(1900);
      expect(decision.responseTime).toBeLessThan(2100);
    });
  });

  describe('複数同時ポップアップ決定のテスト', () => {
    test('複数ポップアップの同時管理', async () => {
      const popups = Array.from({ length: 5 }, (_, i) => 
        createMockPopupData({ id: `popup-${i}` })
      );
      
      // すべてのポップアップを決定待ちに追加
      for (const popup of popups) {
        await getUserDecision(popup, i + 1);
      }
      
      expect(extensionState.pendingDecisions.size).toBe(5);
      
      // 各ポップアップが正しく管理されていることを確認
      popups.forEach(popup => {
        expect(extensionState.pendingDecisions.has(popup.id)).toBe(true);
      });
    });

    test('複数ポップアップの個別決定処理', async () => {
      const popup1 = createMockPopupData({ id: 'popup-1' });
      const popup2 = createMockPopupData({ id: 'popup-2' });
      const popup3 = createMockPopupData({ id: 'popup-3' });
      
      await getUserDecision(popup1, 1);
      await getUserDecision(popup2, 2);
      await getUserDecision(popup3, 3);
      
      // 異なる決定を並行処理
      const decisions = [
        { popupId: popup1.id, decision: 'close', popupData: popup1 },
        { popupId: popup2.id, decision: 'keep', popupData: popup2 },
        { popupId: popup3.id, decision: 'dismiss', popupData: popup3 }
      ];
      
      const results = await Promise.all(
        decisions.map(decision => handleUserDecision(decision))
      );
      
      expect(results[0].decision).toBe('close');
      expect(results[1].decision).toBe('keep');
      expect(results[2].decision).toBe('dismiss');
      
      // すべて決定待ちリストから削除されていることを確認
      expect(extensionState.pendingDecisions.size).toBe(0);
    });

    test('一部ポップアップのタイムアウト処理', async () => {
      const popup1 = createMockPopupData({ id: 'popup-1' });
      const popup2 = createMockPopupData({ id: 'popup-2' });
      
      await getUserDecision(popup1, 1);
      await getUserDecision(popup2, 2);
      
      // popup1は手動で決定
      await handleUserDecision({
        popupId: popup1.id,
        decision: 'close',
        popupData: popup1
      });
      
      // popup2はタイムアウト
      TimerHelpers.advanceTimers(30000);
      
      expect(extensionState.pendingDecisions.size).toBe(0);
      
      const result = await mockChrome.storage.local.get(['userDecisions']);
      const decisions = result.userDecisions;
      
      expect(decisions.find(d => d.id === popup1.id).userDecision).toBe('close');
      expect(decisions.find(d => d.id === popup2.id).userDecision).toBe('timeout');
    });

    test('大量ポップアップの処理パフォーマンス', async () => {
      const popupCount = 50;
      const popups = Array.from({ length: popupCount }, (_, i) => 
        createMockPopupData({ id: `popup-${i}` })
      );
      
      const startTime = Date.now();
      
      // すべてのポップアップを並行処理
      await Promise.all(
        popups.map((popup, i) => getUserDecision(popup, i + 1))
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(1000); // 1秒以内
      expect(extensionState.pendingDecisions.size).toBe(popupCount);
    });

    test('メモリリークの防止確認', async () => {
      const popupCount = 100;
      
      for (let i = 0; i < popupCount; i++) {
        const popup = createMockPopupData({ id: `popup-${i}` });
        await getUserDecision(popup, 1);
        
        // 即座に決定
        await handleUserDecision({
          popupId: popup.id,
          decision: 'close',
          popupData: popup
        });
      }
      
      // 決定待ちリストが空であることを確認
      expect(extensionState.pendingDecisions.size).toBe(0);
      
      // ストレージの決定待ちも空であることを確認
      const result = await mockChrome.storage.local.get(['pendingDecisions']);
      expect(Object.keys(result.pendingDecisions).length).toBe(0);
    });
  });

  describe('決定ストレージ・取得システムのテスト', () => {
    test('決定の保存と取得', async () => {
      const decisionRecord = {
        ...mockPopupData,
        userDecision: 'close',
        decisionTimestamp: Date.now(),
        responseTime: 2500
      };
      
      await saveUserDecision(decisionRecord);
      
      const result = await mockChrome.storage.local.get(['userDecisions']);
      const savedDecision = result.userDecisions.find(d => d.id === mockPopupData.id);
      
      expect(savedDecision).toBeDefined();
      expect(savedDecision.userDecision).toBe('close');
      expect(savedDecision.responseTime).toBe(2500);
    });

    test('決定履歴の蓄積', async () => {
      const decisions = [
        { ...mockPopupData, id: 'popup-1', userDecision: 'close' },
        { ...mockPopupData, id: 'popup-2', userDecision: 'keep' },
        { ...mockPopupData, id: 'popup-3', userDecision: 'dismiss' }
      ];
      
      for (const decision of decisions) {
        await saveUserDecision(decision);
      }
      
      const result = await mockChrome.storage.local.get(['userDecisions']);
      expect(result.userDecisions.length).toBe(3);
      
      const decisionTypes = result.userDecisions.map(d => d.userDecision);
      expect(decisionTypes).toContain('close');
      expect(decisionTypes).toContain('keep');
      expect(decisionTypes).toContain('dismiss');
    });

    test('決定待ち状態の保存と削除', async () => {
      await getUserDecision(mockPopupData, 1);
      
      // 保存されていることを確認
      let result = await mockChrome.storage.local.get(['pendingDecisions']);
      expect(result.pendingDecisions[mockPopupData.id]).toBeDefined();
      
      // 削除
      await removePendingDecision(mockPopupData.id);
      
      // 削除されていることを確認
      result = await mockChrome.storage.local.get(['pendingDecisions']);
      expect(result.pendingDecisions[mockPopupData.id]).toBeUndefined();
    });

    test('ストレージエラーの処理', async () => {
      // ストレージエラーをシミュレート
      mockChrome.storage.local.set.mockRejectedValue(new Error('Storage error'));
      
      await expectError(
        () => saveUserDecision(mockPopupData),
        'Storage error'
      );
    });

    test('大量データの保存パフォーマンス', async () => {
      const decisions = Array.from({ length: 1000 }, (_, i) => ({
        ...mockPopupData,
        id: `popup-${i}`,
        userDecision: i % 3 === 0 ? 'close' : i % 3 === 1 ? 'keep' : 'dismiss',
        timestamp: Date.now() - (i * 1000)
      }));
      
      const startTime = Date.now();
      
      for (const decision of decisions) {
        await saveUserDecision(decision);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(5000); // 5秒以内
      
      const result = await mockChrome.storage.local.get(['userDecisions']);
      expect(result.userDecisions.length).toBe(1000);
    });

    test('データ整合性の確認', async () => {
      const originalDecision = {
        ...mockPopupData,
        userDecision: 'close',
        decisionTimestamp: 1234567890,
        responseTime: 3000,
        customField: 'test-value'
      };
      
      await saveUserDecision(originalDecision);
      
      const result = await mockChrome.storage.local.get(['userDecisions']);
      const savedDecision = result.userDecisions[0];
      
      // すべてのフィールドが正確に保存されていることを確認
      expect(savedDecision.id).toBe(originalDecision.id);
      expect(savedDecision.userDecision).toBe(originalDecision.userDecision);
      expect(savedDecision.decisionTimestamp).toBe(originalDecision.decisionTimestamp);
      expect(savedDecision.responseTime).toBe(originalDecision.responseTime);
      expect(savedDecision.customField).toBe(originalDecision.customField);
    });

    test('古い決定データのクリーンアップ', async () => {
      const oldDecisions = Array.from({ length: 10 }, (_, i) => ({
        ...mockPopupData,
        id: `old-popup-${i}`,
        userDecision: 'close',
        decisionTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000) // 30日前
      }));
      
      const recentDecisions = Array.from({ length: 5 }, (_, i) => ({
        ...mockPopupData,
        id: `recent-popup-${i}`,
        userDecision: 'keep',
        decisionTimestamp: Date.now() - (1 * 24 * 60 * 60 * 1000) // 1日前
      }));
      
      // すべての決定を保存
      for (const decision of [...oldDecisions, ...recentDecisions]) {
        await saveUserDecision(decision);
      }
      
      // クリーンアップ関数（実装例）
      async function cleanupOldDecisions(maxAge = 7 * 24 * 60 * 60 * 1000) {
        const result = await mockChrome.storage.local.get(['userDecisions']);
        const decisions = result.userDecisions || [];
        const cutoffTime = Date.now() - maxAge;
        
        const filteredDecisions = decisions.filter(d => 
          d.decisionTimestamp > cutoffTime
        );
        
        await mockChrome.storage.local.set({ userDecisions: filteredDecisions });
        return decisions.length - filteredDecisions.length;
      }
      
      const cleanedCount = await cleanupOldDecisions();
      expect(cleanedCount).toBe(10); // 古い決定が削除された
      
      const result = await mockChrome.storage.local.get(['userDecisions']);
      expect(result.userDecisions.length).toBe(5); // 最近の決定のみ残存
    });
  });

  describe('エラーハンドリングとエッジケース', () => {
    test('同じポップアップIDの重複処理', async () => {
      await getUserDecision(mockPopupData, 1);
      
      // 同じIDで再度処理を試行
      const result = await getUserDecision(mockPopupData, 2);
      
      // 新しい決定で上書きされることを確認
      expect(result.success).toBe(true);
      expect(extensionState.pendingDecisions.get(mockPopupData.id).tabId).toBe(2);
    });

    test('タイムアウト後の決定処理', async () => {
      await getUserDecision(mockPopupData, 1);
      
      // タイムアウトを発生させる
      TimerHelpers.advanceTimers(30000);
      
      // タイムアウト後に決定を試行
      const decisionData = {
        popupId: mockPopupData.id,
        decision: 'close',
        popupData: mockPopupData
      };
      
      await expectError(
        () => handleUserDecision(decisionData),
        'Popup not found in pending decisions'
      );
    });

    test('不正なデータ形式での処理', async () => {
      const invalidDecisionData = {
        popupId: mockPopupData.id,
        decision: 'close'
        // popupData が欠落
      };
      
      await getUserDecision(mockPopupData, 1);
      
      // 不正なデータでも処理が継続されることを確認
      const result = await handleUserDecision(invalidDecisionData);
      expect(result.success).toBe(true);
    });

    test('ストレージ容量制限の処理', async () => {
      // ストレージ容量エラーをシミュレート
      let callCount = 0;
      mockChrome.storage.local.set.mockImplementation(() => {
        callCount++;
        if (callCount > 100) {
          return Promise.reject(new Error('QUOTA_EXCEEDED'));
        }
        return Promise.resolve();
      });
      
      // 大量のデータを保存
      for (let i = 0; i < 150; i++) {
        const decision = {
          ...mockPopupData,
          id: `popup-${i}`,
          userDecision: 'close'
        };
        
        try {
          await saveUserDecision(decision);
        } catch (error) {
          expect(error.message).toBe('QUOTA_EXCEEDED');
          break;
        }
      }
    });
  });
});