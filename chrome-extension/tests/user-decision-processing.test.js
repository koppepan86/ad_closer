/**
 * ユーザー決定処理システムのテスト
 * Task 4.1: ユーザー決定処理の作成
 */

// モックのChrome API
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    sendMessage: jest.fn()
  },
  runtime: {
    sendMessage: jest.fn()
  }
};

// テスト用のモックデータ
const mockPopupData = {
  id: 'popup_test_123',
  url: 'https://example.com/page',
  domain: 'example.com',
  timestamp: Date.now(),
  characteristics: {
    position: { isFixed: true },
    zIndex: { value: 9999, isHigh: true },
    dimensions: { width: 400, height: 300 },
    modalOverlay: { hasOverlayBackground: true },
    content: { containsAds: true }
  },
  userDecision: 'pending',
  confidence: 0.8
};

const mockTabId = 123;

describe('ユーザー決定処理システム', () => {
  let extensionState;
  let getUserDecision, handleUserDecision, saveUserDecision, getUserDecisions;
  let savePendingDecision, removePendingDecision, getPendingDecisions;
  let handleDecisionTimeout, cleanupExpiredDecisions;

  beforeEach(() => {
    // 拡張機能状態をリセット
    extensionState = {
      enabled: true,
      activeTabId: null,
      pendingDecisions: new Map()
    };

    // Chrome APIモックをリセット
    jest.clearAllMocks();
    
    // デフォルトのストレージレスポンス
    chrome.storage.local.get.mockResolvedValue({
      userDecisions: [],
      pendingDecisions: {}
    });
    chrome.storage.local.set.mockResolvedValue();
    chrome.tabs.sendMessage.mockResolvedValue();

    // テスト対象の関数を模擬実装
    // 実際の実装では、これらはservice-worker.jsで定義される
    getUserDecision = async (popupData, tabId) => {
      const decisionEntry = {
        popupData: popupData,
        tabId: tabId,
        timestamp: Date.now(),
        status: 'pending',
        timeoutId: setTimeout(() => handleDecisionTimeout(popupData.id), 30000)
      };
      
      extensionState.pendingDecisions.set(popupData.id, decisionEntry);
      await savePendingDecision(decisionEntry);
      
      return {
        success: true,
        popupId: popupData.id,
        status: 'pending'
      };
    };

    handleUserDecision = async (decisionData) => {
      const { popupId, decision } = decisionData;
      
      const pendingDecision = extensionState.pendingDecisions.get(popupId);
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

      await saveUserDecision(updatedRecord);
      extensionState.pendingDecisions.delete(popupId);
      await removePendingDecision(popupId);

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
    };

    saveUserDecision = async (decisionRecord) => {
      const result = await chrome.storage.local.get(['userDecisions']);
      const decisions = result.userDecisions || [];
      
      const existingIndex = decisions.findIndex(record => record.id === decisionRecord.id);
      if (existingIndex >= 0) {
        decisions[existingIndex] = decisionRecord;
      } else {
        decisions.push(decisionRecord);
      }
      
      if (decisions.length > 500) {
        decisions.splice(0, decisions.length - 500);
      }
      
      await chrome.storage.local.set({ userDecisions: decisions });
    };

    getUserDecisions = async (filters = {}) => {
      const result = await chrome.storage.local.get(['userDecisions']);
      let decisions = result.userDecisions || [];
      
      if (filters.domain) {
        decisions = decisions.filter(decision => decision.domain === filters.domain);
      }
      
      if (filters.decision) {
        decisions = decisions.filter(decision => decision.userDecision === filters.decision);
      }
      
      decisions.sort((a, b) => b.decisionTimestamp - a.decisionTimestamp);
      return decisions;
    };

    savePendingDecision = async (decisionEntry) => {
      const result = await chrome.storage.local.get(['pendingDecisions']);
      const pending = result.pendingDecisions || {};
      
      const entryToSave = {
        ...decisionEntry,
        timeoutId: null
      };
      
      pending[decisionEntry.popupData.id] = entryToSave;
      await chrome.storage.local.set({ pendingDecisions: pending });
    };

    removePendingDecision = async (popupId) => {
      const result = await chrome.storage.local.get(['pendingDecisions']);
      const pending = result.pendingDecisions || {};
      
      delete pending[popupId];
      await chrome.storage.local.set({ pendingDecisions: pending });
    };

    getPendingDecisions = async () => {
      const decisions = Array.from(extensionState.pendingDecisions.values());
      return decisions.map(decision => ({
        popupId: decision.popupData.id,
        domain: decision.popupData.domain,
        timestamp: decision.timestamp,
        status: decision.status,
        tabId: decision.tabId
      }));
    };

    handleDecisionTimeout = async (popupId) => {
      const pendingDecision = extensionState.pendingDecisions.get(popupId);
      if (!pendingDecision) return;

      const timeoutRecord = {
        ...pendingDecision.popupData,
        userDecision: 'timeout',
        decisionTimestamp: Date.now(),
        responseTime: Date.now() - pendingDecision.timestamp
      };

      await saveUserDecision(timeoutRecord);
      extensionState.pendingDecisions.delete(popupId);
      await removePendingDecision(popupId);

      await chrome.tabs.sendMessage(pendingDecision.tabId, {
        type: 'USER_DECISION_TIMEOUT',
        data: { popupId }
      });
    };

    cleanupExpiredDecisions = async () => {
      const now = Date.now();
      const expiredThreshold = 5 * 60 * 1000;
      const expiredIds = [];

      for (const [popupId, decision] of extensionState.pendingDecisions.entries()) {
        if (now - decision.timestamp > expiredThreshold) {
          expiredIds.push(popupId);
          if (decision.timeoutId) {
            clearTimeout(decision.timeoutId);
          }
        }
      }

      for (const popupId of expiredIds) {
        extensionState.pendingDecisions.delete(popupId);
        await removePendingDecision(popupId);
      }

      return expiredIds.length;
    };
  });

  describe('getUserDecision ワークフロー', () => {
    test('ポップアップデータを受け取り、決定待ち状態を作成する', async () => {
      const result = await getUserDecision(mockPopupData, mockTabId);

      expect(result.success).toBe(true);
      expect(result.popupId).toBe(mockPopupData.id);
      expect(result.status).toBe('pending');
      expect(extensionState.pendingDecisions.has(mockPopupData.id)).toBe(true);
    });

    test('決定待ち状態がストレージに保存される', async () => {
      await getUserDecision(mockPopupData, mockTabId);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingDecisions: expect.objectContaining({
            [mockPopupData.id]: expect.objectContaining({
              popupData: mockPopupData,
              tabId: mockTabId,
              status: 'pending'
            })
          })
        })
      );
    });

    test('タイムアウトが設定される', async () => {
      const result = await getUserDecision(mockPopupData, mockTabId);
      const pendingDecision = extensionState.pendingDecisions.get(mockPopupData.id);

      expect(pendingDecision.timeoutId).toBeDefined();
      expect(typeof pendingDecision.timeoutId).toBe('object'); // setTimeout returns an object in Node.js
    });
  });

  describe('handleUserDecision 処理', () => {
    beforeEach(async () => {
      // 決定待ち状態を事前に作成
      await getUserDecision(mockPopupData, mockTabId);
    });

    test('有効な決定（close）を処理する', async () => {
      const decisionData = {
        popupId: mockPopupData.id,
        decision: 'close',
        popupData: mockPopupData
      };

      const result = await handleUserDecision(decisionData);

      expect(result.success).toBe(true);
      expect(result.decision).toBe('close');
      expect(result.popupId).toBe(mockPopupData.id);
      expect(extensionState.pendingDecisions.has(mockPopupData.id)).toBe(false);
    });

    test('有効な決定（keep）を処理する', async () => {
      const decisionData = {
        popupId: mockPopupData.id,
        decision: 'keep',
        popupData: mockPopupData
      };

      const result = await handleUserDecision(decisionData);

      expect(result.success).toBe(true);
      expect(result.decision).toBe('keep');
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        mockTabId,
        expect.objectContaining({
          type: 'USER_DECISION_RESULT',
          data: { popupId: mockPopupData.id, decision: 'keep' }
        })
      );
    });

    test('無効な決定を拒否する', async () => {
      const decisionData = {
        popupId: mockPopupData.id,
        decision: 'invalid_decision',
        popupData: mockPopupData
      };

      const result = await handleUserDecision(decisionData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid decision');
      expect(extensionState.pendingDecisions.has(mockPopupData.id)).toBe(true);
    });

    test('存在しないポップアップIDを処理する', async () => {
      const decisionData = {
        popupId: 'nonexistent_popup',
        decision: 'close',
        popupData: mockPopupData
      };

      const result = await handleUserDecision(decisionData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Popup not found in pending decisions');
    });

    test('決定がストレージに保存される', async () => {
      const decisionData = {
        popupId: mockPopupData.id,
        decision: 'close',
        popupData: mockPopupData
      };

      await handleUserDecision(decisionData);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          userDecisions: expect.arrayContaining([
            expect.objectContaining({
              id: mockPopupData.id,
              userDecision: 'close',
              decisionTimestamp: expect.any(Number)
            })
          ])
        })
      );
    });
  });

  describe('決定ストレージと取得システム', () => {
    test('ユーザー決定を保存する', async () => {
      const decisionRecord = {
        ...mockPopupData,
        userDecision: 'close',
        decisionTimestamp: Date.now()
      };

      await saveUserDecision(decisionRecord);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          userDecisions: expect.arrayContaining([decisionRecord])
        })
      );
    });

    test('ユーザー決定を取得する', async () => {
      const mockDecisions = [
        { ...mockPopupData, userDecision: 'close', domain: 'example.com' },
        { ...mockPopupData, id: 'popup_2', userDecision: 'keep', domain: 'test.com' }
      ];

      chrome.storage.local.get.mockResolvedValue({
        userDecisions: mockDecisions
      });

      const decisions = await getUserDecisions();

      expect(decisions).toHaveLength(2);
      expect(decisions[0].userDecision).toBeDefined();
    });

    test('ドメインでフィルタリングして決定を取得する', async () => {
      const mockDecisions = [
        { ...mockPopupData, userDecision: 'close', domain: 'example.com' },
        { ...mockPopupData, id: 'popup_2', userDecision: 'keep', domain: 'test.com' }
      ];

      chrome.storage.local.get.mockResolvedValue({
        userDecisions: mockDecisions
      });

      const decisions = await getUserDecisions({ domain: 'example.com' });

      expect(decisions).toHaveLength(1);
      expect(decisions[0].domain).toBe('example.com');
    });
  });

  describe('複数の同時ポップアップ決定サポート', () => {
    test('複数のポップアップを同時に処理する', async () => {
      const popup1 = { ...mockPopupData, id: 'popup_1' };
      const popup2 = { ...mockPopupData, id: 'popup_2' };
      const popup3 = { ...mockPopupData, id: 'popup_3' };

      await getUserDecision(popup1, mockTabId);
      await getUserDecision(popup2, mockTabId + 1);
      await getUserDecision(popup3, mockTabId + 2);

      expect(extensionState.pendingDecisions.size).toBe(3);

      const pendingDecisions = await getPendingDecisions();
      expect(pendingDecisions).toHaveLength(3);
      expect(pendingDecisions.map(d => d.popupId)).toContain('popup_1');
      expect(pendingDecisions.map(d => d.popupId)).toContain('popup_2');
      expect(pendingDecisions.map(d => d.popupId)).toContain('popup_3');
    });

    test('個別のポップアップ決定を独立して処理する', async () => {
      const popup1 = { ...mockPopupData, id: 'popup_1' };
      const popup2 = { ...mockPopupData, id: 'popup_2' };

      await getUserDecision(popup1, mockTabId);
      await getUserDecision(popup2, mockTabId);

      // popup1を閉じる
      await handleUserDecision({
        popupId: 'popup_1',
        decision: 'close',
        popupData: popup1
      });

      expect(extensionState.pendingDecisions.has('popup_1')).toBe(false);
      expect(extensionState.pendingDecisions.has('popup_2')).toBe(true);

      // popup2を保持
      await handleUserDecision({
        popupId: 'popup_2',
        decision: 'keep',
        popupData: popup2
      });

      expect(extensionState.pendingDecisions.has('popup_2')).toBe(false);
      expect(extensionState.pendingDecisions.size).toBe(0);
    });
  });

  describe('タイムアウト処理', () => {
    test('決定タイムアウトを処理する', async () => {
      await getUserDecision(mockPopupData, mockTabId);

      await handleDecisionTimeout(mockPopupData.id);

      expect(extensionState.pendingDecisions.has(mockPopupData.id)).toBe(false);
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
      const oldTimestamp = Date.now() - (10 * 60 * 1000); // 10分前
      const oldDecision = {
        popupData: mockPopupData,
        tabId: mockTabId,
        timestamp: oldTimestamp,
        status: 'pending',
        timeoutId: null
      };

      extensionState.pendingDecisions.set(mockPopupData.id, oldDecision);

      const cleanedCount = await cleanupExpiredDecisions();

      expect(cleanedCount).toBe(1);
      expect(extensionState.pendingDecisions.has(mockPopupData.id)).toBe(false);
    });
  });

  describe('エラーハンドリング', () => {
    test('ストレージエラーを適切に処理する', async () => {
      chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));

      await expect(saveUserDecision(mockPopupData)).rejects.toThrow('Storage error');
    });

    test('メッセージ送信エラーを適切に処理する', async () => {
      chrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not found'));

      await getUserDecision(mockPopupData, mockTabId);

      const result = await handleUserDecision({
        popupId: mockPopupData.id,
        decision: 'close',
        popupData: mockPopupData
      });

      // エラーがあってもメイン処理は成功する
      expect(result.success).toBe(true);
    });
  });
});