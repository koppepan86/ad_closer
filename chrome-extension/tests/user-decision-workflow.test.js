/**
 * ユーザー決定ワークフローの包括的テスト
 * Task 9.1: ユニットテストの作成 - ユーザー決定処理の詳細テスト
 */

const { createMockPopupData, createChromeApiMock, TimerHelpers } = require('./test-helpers');

// Chrome API のモック
global.chrome = createChromeApiMock();

describe('ユーザー決定ワークフロー', () => {
  let decisionWorkflow, mockStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    TimerHelpers.mockSetTimeout();
    
    mockStorage = global.chrome.storage.local;
    mockStorage.data = {};

    // 決定ワークフローシステムの実装
    decisionWorkflow = {
      pendingDecisions: new Map(),
      decisionTimeouts: new Map(),
      
      async initiateDecisionProcess(popupData, tabId) {
        const decisionId = this.generateDecisionId();
        const timestamp = Date.now();
        
        const decisionEntry = {
          id: decisionId,
          popupData: popupData,
          tabId: tabId,
          timestamp: timestamp,
          status: 'awaiting_user_input',
          notificationShown: false,
          reminderCount: 0
        };
        
        this.pendingDecisions.set(decisionId, decisionEntry);
        await this.savePendingDecision(decisionEntry);
        
        // 通知を表示
        await this.showDecisionNotification(decisionEntry);
        
        // タイムアウトを設定
        this.setDecisionTimeout(decisionId);
        
        return {
          success: true,
          decisionId: decisionId,
          status: 'initiated'
        };
      },

      async showDecisionNotification(decisionEntry) {
        const notificationData = {
          type: 'POPUP_DECISION_REQUEST',
          popupId: decisionEntry.popupData.id,
          decisionId: decisionEntry.id,
          popupCharacteristics: decisionEntry.popupData.characteristics,
          domain: decisionEntry.popupData.domain,
          confidence: decisionEntry.popupData.confidence
        };

        await chrome.tabs.sendMessage(decisionEntry.tabId, notificationData);
        
        decisionEntry.notificationShown = true;
        decisionEntry.notificationTimestamp = Date.now();
        
        await this.updatePendingDecision(decisionEntry);
      },

      async processUserDecision(decisionId, userChoice, responseData = {}) {
        const decisionEntry = this.pendingDecisions.get(decisionId);
        
        if (!decisionEntry) {
          return { success: false, error: 'Decision not found' };
        }

        if (decisionEntry.status !== 'awaiting_user_input') {
          return { success: false, error: 'Decision already processed' };
        }

        // タイムアウトをクリア
        this.clearDecisionTimeout(decisionId);

        const responseTime = Date.now() - decisionEntry.timestamp;
        const notificationResponseTime = decisionEntry.notificationTimestamp ? 
          Date.now() - decisionEntry.notificationTimestamp : null;

        const completedDecision = {
          ...decisionEntry,
          userChoice: userChoice,
          responseTime: responseTime,
          notificationResponseTime: notificationResponseTime,
          responseData: responseData,
          status: 'completed',
          completedTimestamp: Date.now()
        };

        // 決定を保存
        await this.saveCompletedDecision(completedDecision);
        
        // ポップアップアクションを実行
        await this.executePopupAction(completedDecision);
        
        // 学習システムを更新
        await this.updateLearningSystem(completedDecision);
        
        // 統計を更新
        await this.updateStatistics(completedDecision);
        
        // 決定待ちから削除
        this.pendingDecisions.delete(decisionId);
        await this.removePendingDecision(decisionId);

        return {
          success: true,
          decisionId: decisionId,
          userChoice: userChoice,
          responseTime: responseTime
        };
      },

      async executePopupAction(completedDecision) {
        const { userChoice, popupData, tabId } = completedDecision;
        
        const actionMessage = {
          type: 'EXECUTE_POPUP_ACTION',
          popupId: popupData.id,
          action: userChoice,
          timestamp: Date.now()
        };

        try {
          await chrome.tabs.sendMessage(tabId, actionMessage);
        } catch (error) {
          console.warn('Failed to send action message to tab:', error);
        }
      },

      async updateLearningSystem(completedDecision) {
        const { popupData, userChoice } = completedDecision;
        
        if (!['close', 'keep'].includes(userChoice)) {
          return; // 学習対象外の決定
        }

        const learningRecord = {
          ...popupData,
          userDecision: userChoice,
          decisionTimestamp: completedDecision.completedTimestamp,
          responseTime: completedDecision.responseTime
        };

        // 学習システムに送信
        await chrome.runtime.sendMessage({
          type: 'UPDATE_LEARNING_DATA',
          data: learningRecord
        });
      },

      async updateStatistics(completedDecision) {
        const { userChoice } = completedDecision;
        
        const statisticsUpdate = {
          type: 'UPDATE_STATISTICS',
          action: userChoice === 'close' ? 'closed' : 
                  userChoice === 'keep' ? 'kept' : 'other',
          timestamp: completedDecision.completedTimestamp
        };

        await chrome.runtime.sendMessage(statisticsUpdate);
      },

      setDecisionTimeout(decisionId, timeoutMs = 30000) {
        const timeoutId = setTimeout(() => {
          this.handleDecisionTimeout(decisionId);
        }, timeoutMs);
        
        this.decisionTimeouts.set(decisionId, timeoutId);
      },

      clearDecisionTimeout(decisionId) {
        const timeoutId = this.decisionTimeouts.get(decisionId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          this.decisionTimeouts.delete(decisionId);
        }
      },

      async handleDecisionTimeout(decisionId) {
        const decisionEntry = this.pendingDecisions.get(decisionId);
        
        if (!decisionEntry) return;

        // リマインダーを送信（最大2回）
        if (decisionEntry.reminderCount < 2) {
          await this.sendDecisionReminder(decisionEntry);
          decisionEntry.reminderCount++;
          await this.updatePendingDecision(decisionEntry);
          
          // 次のリマインダーをスケジュール
          this.setDecisionTimeout(decisionId, 15000); // 15秒後
          return;
        }

        // 最終タイムアウト処理
        await this.processUserDecision(decisionId, 'timeout', {
          reason: 'user_timeout',
          remindersSent: decisionEntry.reminderCount
        });
      },

      async sendDecisionReminder(decisionEntry) {
        const reminderMessage = {
          type: 'POPUP_DECISION_REMINDER',
          decisionId: decisionEntry.id,
          popupId: decisionEntry.popupData.id,
          reminderCount: decisionEntry.reminderCount + 1
        };

        await chrome.tabs.sendMessage(decisionEntry.tabId, reminderMessage);
      },

      async savePendingDecision(decisionEntry) {
        const result = await chrome.storage.local.get(['pendingDecisions']);
        const pending = result.pendingDecisions || {};
        
        pending[decisionEntry.id] = {
          ...decisionEntry,
          // タイムアウトIDは保存しない
          timeoutId: null
        };
        
        await chrome.storage.local.set({ pendingDecisions: pending });
      },

      async updatePendingDecision(decisionEntry) {
        await this.savePendingDecision(decisionEntry);
      },

      async removePendingDecision(decisionId) {
        const result = await chrome.storage.local.get(['pendingDecisions']);
        const pending = result.pendingDecisions || {};
        
        delete pending[decisionId];
        
        await chrome.storage.local.set({ pendingDecisions: pending });
      },

      async saveCompletedDecision(completedDecision) {
        const result = await chrome.storage.local.get(['completedDecisions']);
        const completed = result.completedDecisions || [];
        
        completed.push(completedDecision);
        
        // 履歴サイズ制限（最大1000件）
        if (completed.length > 1000) {
          completed.splice(0, completed.length - 1000);
        }
        
        await chrome.storage.local.set({ completedDecisions: completed });
      },

      async getDecisionHistory(filters = {}) {
        const result = await chrome.storage.local.get(['completedDecisions']);
        let decisions = result.completedDecisions || [];
        
        // フィルタリング
        if (filters.domain) {
          decisions = decisions.filter(d => d.popupData.domain === filters.domain);
        }
        
        if (filters.userChoice) {
          decisions = decisions.filter(d => d.userChoice === filters.userChoice);
        }
        
        if (filters.startDate) {
          decisions = decisions.filter(d => d.completedTimestamp >= filters.startDate);
        }
        
        if (filters.endDate) {
          decisions = decisions.filter(d => d.completedTimestamp <= filters.endDate);
        }
        
        // ソート（新しい順）
        decisions.sort((a, b) => b.completedTimestamp - a.completedTimestamp);
        
        return decisions;
      },

      async getDecisionStatistics() {
        const decisions = await this.getDecisionHistory();
        
        const stats = {
          total: decisions.length,
          close: decisions.filter(d => d.userChoice === 'close').length,
          keep: decisions.filter(d => d.userChoice === 'keep').length,
          timeout: decisions.filter(d => d.userChoice === 'timeout').length,
          dismiss: decisions.filter(d => d.userChoice === 'dismiss').length,
          averageResponseTime: 0,
          averageNotificationResponseTime: 0
        };
        
        if (decisions.length > 0) {
          const totalResponseTime = decisions.reduce((sum, d) => sum + (d.responseTime || 0), 0);
          stats.averageResponseTime = totalResponseTime / decisions.length;
          
          const notificationDecisions = decisions.filter(d => d.notificationResponseTime);
          if (notificationDecisions.length > 0) {
            const totalNotificationResponseTime = notificationDecisions.reduce(
              (sum, d) => sum + d.notificationResponseTime, 0
            );
            stats.averageNotificationResponseTime = totalNotificationResponseTime / notificationDecisions.length;
          }
        }
        
        return stats;
      },

      async cleanupExpiredDecisions() {
        const now = Date.now();
        const expiredThreshold = 24 * 60 * 60 * 1000; // 24時間
        const expiredIds = [];

        for (const [decisionId, decision] of this.pendingDecisions.entries()) {
          if (now - decision.timestamp > expiredThreshold) {
            expiredIds.push(decisionId);
            this.clearDecisionTimeout(decisionId);
          }
        }

        for (const decisionId of expiredIds) {
          await this.processUserDecision(decisionId, 'expired', {
            reason: 'cleanup_expired'
          });
        }

        return expiredIds.length;
      },

      generateDecisionId() {
        return 'decision_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }
    };
  });

  afterEach(() => {
    TimerHelpers.useRealTimers();
  });

  describe('決定プロセスの開始', () => {
    test('決定プロセスを正常に開始する', async () => {
      const popupData = createMockPopupData();
      const tabId = 123;
      
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      
      expect(result.success).toBe(true);
      expect(result.decisionId).toBeDefined();
      expect(result.status).toBe('initiated');
      expect(decisionWorkflow.pendingDecisions.size).toBe(1);
    });

    test('通知が正しく送信される', async () => {
      const popupData = createMockPopupData();
      const tabId = 123;
      
      await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        expect.objectContaining({
          type: 'POPUP_DECISION_REQUEST',
          popupId: popupData.id,
          popupCharacteristics: popupData.characteristics,
          domain: popupData.domain
        })
      );
    });

    test('タイムアウトが設定される', async () => {
      const popupData = createMockPopupData();
      const tabId = 123;
      
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      
      await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        30000
      );
      
      setTimeoutSpy.mockRestore();
    });

    test('決定がストレージに保存される', async () => {
      const popupData = createMockPopupData();
      const tabId = 123;
      
      await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        pendingDecisions: expect.objectContaining({
          [expect.any(String)]: expect.objectContaining({
            popupData: popupData,
            tabId: tabId,
            status: 'awaiting_user_input'
          })
        })
      });
    });
  });

  describe('ユーザー決定の処理', () => {
    let decisionId, popupData, tabId;

    beforeEach(async () => {
      popupData = createMockPopupData();
      tabId = 123;
      
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      decisionId = result.decisionId;
    });

    test('閉じる決定を処理する', async () => {
      const result = await decisionWorkflow.processUserDecision(decisionId, 'close');
      
      expect(result.success).toBe(true);
      expect(result.userChoice).toBe('close');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(decisionWorkflow.pendingDecisions.has(decisionId)).toBe(false);
    });

    test('保持決定を処理する', async () => {
      const result = await decisionWorkflow.processUserDecision(decisionId, 'keep');
      
      expect(result.success).toBe(true);
      expect(result.userChoice).toBe('keep');
    });

    test('無効な決定IDを処理する', async () => {
      const result = await decisionWorkflow.processUserDecision('invalid_id', 'close');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Decision not found');
    });

    test('既に処理された決定を再処理しようとする', async () => {
      await decisionWorkflow.processUserDecision(decisionId, 'close');
      
      const result = await decisionWorkflow.processUserDecision(decisionId, 'keep');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Decision already processed');
    });

    test('応答時間が正しく計算される', async () => {
      // 時間を進める
      TimerHelpers.advanceTimers(2500);
      
      const result = await decisionWorkflow.processUserDecision(decisionId, 'close');
      
      expect(result.responseTime).toBeGreaterThanOrEqual(2500);
    });

    test('追加の応答データが保存される', async () => {
      const responseData = {
        clickPosition: { x: 100, y: 200 },
        keyboardUsed: false
      };
      
      await decisionWorkflow.processUserDecision(decisionId, 'close', responseData);
      
      const decisions = await decisionWorkflow.getDecisionHistory();
      expect(decisions[0].responseData).toEqual(responseData);
    });
  });

  describe('ポップアップアクションの実行', () => {
    test('閉じるアクションを実行する', async () => {
      const popupData = createMockPopupData();
      const tabId = 123;
      
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      await decisionWorkflow.processUserDecision(result.decisionId, 'close');
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        expect.objectContaining({
          type: 'EXECUTE_POPUP_ACTION',
          popupId: popupData.id,
          action: 'close'
        })
      );
    });

    test('保持アクションを実行する', async () => {
      const popupData = createMockPopupData();
      const tabId = 123;
      
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      await decisionWorkflow.processUserDecision(result.decisionId, 'keep');
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        expect.objectContaining({
          type: 'EXECUTE_POPUP_ACTION',
          action: 'keep'
        })
      );
    });

    test('タブが存在しない場合のエラーハンドリング', async () => {
      chrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Tab not found'));
      
      const popupData = createMockPopupData();
      const tabId = 999; // 存在しないタブ
      
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      
      // エラーが発生してもクラッシュしない
      await expect(
        decisionWorkflow.processUserDecision(result.decisionId, 'close')
      ).resolves.toEqual(expect.objectContaining({ success: true }));
    });
  });

  describe('学習システムの更新', () => {
    test('学習対象の決定で学習システムを更新する', async () => {
      const popupData = createMockPopupData();
      const tabId = 123;
      
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      await decisionWorkflow.processUserDecision(result.decisionId, 'close');
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'UPDATE_LEARNING_DATA',
        data: expect.objectContaining({
          userDecision: 'close',
          decisionTimestamp: expect.any(Number),
          responseTime: expect.any(Number)
        })
      });
    });

    test('学習対象外の決定では学習システムを更新しない', async () => {
      const popupData = createMockPopupData();
      const tabId = 123;
      
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      await decisionWorkflow.processUserDecision(result.decisionId, 'dismiss');
      
      const learningCalls = chrome.runtime.sendMessage.mock.calls.filter(
        call => call[0].type === 'UPDATE_LEARNING_DATA'
      );
      
      expect(learningCalls).toHaveLength(0);
    });
  });

  describe('統計の更新', () => {
    test('閉じる決定で統計を更新する', async () => {
      const popupData = createMockPopupData();
      const tabId = 123;
      
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      await decisionWorkflow.processUserDecision(result.decisionId, 'close');
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'UPDATE_STATISTICS',
        action: 'closed',
        timestamp: expect.any(Number)
      });
    });

    test('保持決定で統計を更新する', async () => {
      const popupData = createMockPopupData();
      const tabId = 123;
      
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      await decisionWorkflow.processUserDecision(result.decisionId, 'keep');
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'UPDATE_STATISTICS',
        action: 'kept',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('タイムアウト処理', () => {
    test('初回タイムアウトでリマインダーを送信する', async () => {
      const popupData = createMockPopupData();
      const tabId = 123;
      
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      
      // 初回タイムアウト（30秒）
      TimerHelpers.advanceTimers(30000);
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        expect.objectContaining({
          type: 'POPUP_DECISION_REMINDER',
          decisionId: result.decisionId,
          reminderCount: 1
        })
      );
      
      // 決定はまだ保留中
      expect(decisionWorkflow.pendingDecisions.has(result.decisionId)).toBe(true);
    });

    test('最大リマインダー後にタイムアウト決定を処理する', async () => {
      const popupData = createMockPopupData();
      const tabId = 123;
      
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      
      // 初回タイムアウト（30秒）
      TimerHelpers.advanceTimers(30000);
      
      // 2回目のタイムアウト（15秒）
      TimerHelpers.advanceTimers(15000);
      
      // 3回目のタイムアウト（15秒）- 最終タイムアウト
      TimerHelpers.advanceTimers(15000);
      
      // 決定が完了している
      expect(decisionWorkflow.pendingDecisions.has(result.decisionId)).toBe(false);
      
      // タイムアウト決定が保存されている
      const decisions = await decisionWorkflow.getDecisionHistory();
      expect(decisions[0].userChoice).toBe('timeout');
      expect(decisions[0].responseData.reason).toBe('user_timeout');
    });

    test('リマインダー送信中に手動決定が行われる', async () => {
      const popupData = createMockPopupData();
      const tabId = 123;
      
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, tabId);
      
      // 初回タイムアウト（リマインダー送信）
      TimerHelpers.advanceTimers(30000);
      
      // ユーザーが手動で決定
      await decisionWorkflow.processUserDecision(result.decisionId, 'close');
      
      // 2回目のタイムアウトが発生しても処理されない
      TimerHelpers.advanceTimers(15000);
      
      const decisions = await decisionWorkflow.getDecisionHistory();
      expect(decisions[0].userChoice).toBe('close');
    });
  });

  describe('決定履歴の管理', () => {
    test('決定履歴を取得する', async () => {
      const popupData1 = createMockPopupData({ domain: 'example.com' });
      const popupData2 = createMockPopupData({ domain: 'test.com' });
      
      const result1 = await decisionWorkflow.initiateDecisionProcess(popupData1, 123);
      const result2 = await decisionWorkflow.initiateDecisionProcess(popupData2, 124);
      
      await decisionWorkflow.processUserDecision(result1.decisionId, 'close');
      await decisionWorkflow.processUserDecision(result2.decisionId, 'keep');
      
      const history = await decisionWorkflow.getDecisionHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].userChoice).toBe('keep'); // 新しい順
      expect(history[1].userChoice).toBe('close');
    });

    test('ドメインでフィルタリングする', async () => {
      const popupData1 = createMockPopupData({ domain: 'example.com' });
      const popupData2 = createMockPopupData({ domain: 'test.com' });
      
      const result1 = await decisionWorkflow.initiateDecisionProcess(popupData1, 123);
      const result2 = await decisionWorkflow.initiateDecisionProcess(popupData2, 124);
      
      await decisionWorkflow.processUserDecision(result1.decisionId, 'close');
      await decisionWorkflow.processUserDecision(result2.decisionId, 'keep');
      
      const filteredHistory = await decisionWorkflow.getDecisionHistory({
        domain: 'example.com'
      });
      
      expect(filteredHistory).toHaveLength(1);
      expect(filteredHistory[0].popupData.domain).toBe('example.com');
    });

    test('決定タイプでフィルタリングする', async () => {
      const popupData1 = createMockPopupData();
      const popupData2 = createMockPopupData();
      
      const result1 = await decisionWorkflow.initiateDecisionProcess(popupData1, 123);
      const result2 = await decisionWorkflow.initiateDecisionProcess(popupData2, 124);
      
      await decisionWorkflow.processUserDecision(result1.decisionId, 'close');
      await decisionWorkflow.processUserDecision(result2.decisionId, 'keep');
      
      const filteredHistory = await decisionWorkflow.getDecisionHistory({
        userChoice: 'close'
      });
      
      expect(filteredHistory).toHaveLength(1);
      expect(filteredHistory[0].userChoice).toBe('close');
    });

    test('日付範囲でフィルタリングする', async () => {
      const now = Date.now();
      const popupData = createMockPopupData();
      
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, 123);
      await decisionWorkflow.processUserDecision(result.decisionId, 'close');
      
      const filteredHistory = await decisionWorkflow.getDecisionHistory({
        startDate: now - 1000,
        endDate: now + 1000
      });
      
      expect(filteredHistory).toHaveLength(1);
    });

    test('履歴サイズ制限', async () => {
      // 1001件の決定を作成
      for (let i = 0; i < 1001; i++) {
        const popupData = createMockPopupData();
        const result = await decisionWorkflow.initiateDecisionProcess(popupData, 123);
        await decisionWorkflow.processUserDecision(result.decisionId, 'close');
      }
      
      const history = await decisionWorkflow.getDecisionHistory();
      expect(history).toHaveLength(1000);
    });
  });

  describe('決定統計', () => {
    test('決定統計を計算する', async () => {
      const decisions = [
        { userChoice: 'close', responseTime: 2000, notificationResponseTime: 1500 },
        { userChoice: 'keep', responseTime: 3000, notificationResponseTime: 2000 },
        { userChoice: 'timeout', responseTime: 30000, notificationResponseTime: null },
        { userChoice: 'close', responseTime: 1500, notificationResponseTime: 1000 }
      ];
      
      // 決定を実行
      for (const decision of decisions) {
        const popupData = createMockPopupData();
        const result = await decisionWorkflow.initiateDecisionProcess(popupData, 123);
        
        if (decision.userChoice === 'timeout') {
          TimerHelpers.advanceTimers(60000); // タイムアウトを発生させる
        } else {
          await decisionWorkflow.processUserDecision(result.decisionId, decision.userChoice);
        }
      }
      
      const stats = await decisionWorkflow.getDecisionStatistics();
      
      expect(stats.total).toBe(4);
      expect(stats.close).toBe(2);
      expect(stats.keep).toBe(1);
      expect(stats.timeout).toBe(1);
      expect(stats.averageResponseTime).toBeGreaterThan(0);
      expect(stats.averageNotificationResponseTime).toBeGreaterThan(0);
    });

    test('空の履歴での統計計算', async () => {
      const stats = await decisionWorkflow.getDecisionStatistics();
      
      expect(stats.total).toBe(0);
      expect(stats.close).toBe(0);
      expect(stats.keep).toBe(0);
      expect(stats.timeout).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
      expect(stats.averageNotificationResponseTime).toBe(0);
    });
  });

  describe('期限切れ決定のクリーンアップ', () => {
    test('期限切れ決定をクリーンアップする', async () => {
      const popupData = createMockPopupData();
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, 123);
      
      // 決定を古くする
      const decisionEntry = decisionWorkflow.pendingDecisions.get(result.decisionId);
      decisionEntry.timestamp = Date.now() - (25 * 60 * 60 * 1000); // 25時間前
      
      const cleanedCount = await decisionWorkflow.cleanupExpiredDecisions();
      
      expect(cleanedCount).toBe(1);
      expect(decisionWorkflow.pendingDecisions.has(result.decisionId)).toBe(false);
      
      const decisions = await decisionWorkflow.getDecisionHistory();
      expect(decisions[0].userChoice).toBe('expired');
    });

    test('期限内の決定はクリーンアップしない', async () => {
      const popupData = createMockPopupData();
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, 123);
      
      const cleanedCount = await decisionWorkflow.cleanupExpiredDecisions();
      
      expect(cleanedCount).toBe(0);
      expect(decisionWorkflow.pendingDecisions.has(result.decisionId)).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    test('ストレージエラーの処理', async () => {
      chrome.storage.local.set.mockRejectedValueOnce(new Error('Storage error'));
      
      const popupData = createMockPopupData();
      
      // エラーが発生してもクラッシュしない
      await expect(
        decisionWorkflow.initiateDecisionProcess(popupData, 123)
      ).rejects.toThrow('Storage error');
    });

    test('タブメッセージ送信エラーの処理', async () => {
      chrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Tab error'));
      
      const popupData = createMockPopupData();
      
      // 通知送信エラーでもプロセスは継続
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, 123);
      expect(result.success).toBe(true);
    });

    test('学習システム更新エラーの処理', async () => {
      chrome.runtime.sendMessage.mockRejectedValueOnce(new Error('Learning error'));
      
      const popupData = createMockPopupData();
      const result = await decisionWorkflow.initiateDecisionProcess(popupData, 123);
      
      // 学習システムエラーでも決定処理は成功
      const decisionResult = await decisionWorkflow.processUserDecision(result.decisionId, 'close');
      expect(decisionResult.success).toBe(true);
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量の同時決定処理', async () => {
      const promises = [];
      
      // 100個の同時決定を開始
      for (let i = 0; i < 100; i++) {
        const popupData = createMockPopupData();
        promises.push(decisionWorkflow.initiateDecisionProcess(popupData, 123 + i));
      }
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(100);
      expect(results.every(r => r.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // 2秒以内
      expect(decisionWorkflow.pendingDecisions.size).toBe(100);
    });

    test('決定履歴検索のパフォーマンス', async () => {
      // 500件の決定履歴を作成
      for (let i = 0; i < 500; i++) {
        const popupData = createMockPopupData({
          domain: i % 2 === 0 ? 'example.com' : 'test.com'
        });
        const result = await decisionWorkflow.initiateDecisionProcess(popupData, 123);
        await decisionWorkflow.processUserDecision(result.decisionId, i % 3 === 0 ? 'close' : 'keep');
      }
      
      const startTime = Date.now();
      
      // 複雑なフィルタリング検索
      await decisionWorkflow.getDecisionHistory({
        domain: 'example.com',
        userChoice: 'close',
        startDate: Date.now() - 1000000,
        endDate: Date.now()
      });
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(500); // 500ms以内
    });
  });
});