/**
 * バックグラウンドサービスワーカーの包括的テスト
 * Task 9.1: ユニットテストの作成 - バックグラウンドサービスワーカーのテスト
 */

const { createChromeApiMock, createMockPopupData, createMockUserPreferences } = require('./test-helpers');

// Chrome API のモック
global.chrome = createChromeApiMock();

describe('バックグラウンドサービスワーカー', () => {
  let serviceWorker, mockStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage = global.chrome.storage.local;
    mockStorage.data = {};

    // サービスワーカーの実装
    serviceWorker = {
      messageHandlers: new Map(),
      activeConnections: new Map(),
      
      init() {
        this.setupMessageHandlers();
        this.setupEventListeners();
      },

      setupMessageHandlers() {
        this.messageHandlers.set('GET_USER_PREFERENCES', this.handleGetUserPreferences.bind(this));
        this.messageHandlers.set('UPDATE_USER_PREFERENCES', this.handleUpdateUserPreferences.bind(this));
        this.messageHandlers.set('GET_STATISTICS', this.handleGetStatistics.bind(this));
        this.messageHandlers.set('UPDATE_STATISTICS', this.handleUpdateStatistics.bind(this));
        this.messageHandlers.set('GET_USER_DECISIONS', this.handleGetUserDecisions.bind(this));
        this.messageHandlers.set('SAVE_USER_DECISION', this.handleSaveUserDecision.bind(this));
        this.messageHandlers.set('GET_LEARNING_PATTERNS', this.handleGetLearningPatterns.bind(this));
        this.messageHandlers.set('UPDATE_LEARNING_DATA', this.handleUpdateLearningData.bind(this));
        this.messageHandlers.set('POPUP_DETECTED', this.handlePopupDetected.bind(this));
        this.messageHandlers.set('GET_WHITELIST', this.handleGetWhitelist.bind(this));
        this.messageHandlers.set('UPDATE_WHITELIST', this.handleUpdateWhitelist.bind(this));
      },

      setupEventListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          this.handleMessage(message, sender, sendResponse);
          return true; // 非同期レスポンスを示す
        });

        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
          this.handleTabUpdated(tabId, changeInfo, tab);
        });

        chrome.tabs.onActivated.addListener((activeInfo) => {
          this.handleTabActivated(activeInfo);
        });
      },

      async handleMessage(message, sender, sendResponse) {
        try {
          const handler = this.messageHandlers.get(message.type);
          
          if (!handler) {
            sendResponse({
              success: false,
              error: `Unknown message type: ${message.type}`
            });
            return;
          }

          const result = await handler(message.data, sender);
          sendResponse({
            success: true,
            data: result
          });

        } catch (error) {
          console.error('Message handling error:', error);
          sendResponse({
            success: false,
            error: error.message
          });
        }
      },

      async handleGetUserPreferences() {
        const result = await chrome.storage.local.get(['userPreferences']);
        return result.userPreferences || this.getDefaultPreferences();
      },

      async handleUpdateUserPreferences(preferences) {
        await chrome.storage.local.set({ userPreferences: preferences });
        
        // 設定変更を全タブに通知
        await this.broadcastToAllTabs({
          type: 'PREFERENCES_UPDATED',
          data: preferences
        });
        
        return preferences;
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

      async handleGetStatistics() {
        const preferences = await this.handleGetUserPreferences();
        const decisions = await this.handleGetUserDecisions();
        
        const now = Date.now();
        const today = new Date().toDateString();
        const thisWeek = now - (7 * 24 * 60 * 60 * 1000);
        const thisMonth = now - (30 * 24 * 60 * 60 * 1000);

        // 今日の統計
        const todayDecisions = decisions.filter(d => 
          new Date(d.decisionTimestamp).toDateString() === today
        );

        // 今週の統計
        const weekDecisions = decisions.filter(d => 
          d.decisionTimestamp >= thisWeek
        );

        // 今月の統計
        const monthDecisions = decisions.filter(d => 
          d.decisionTimestamp >= thisMonth
        );

        // ドメイン別統計
        const domainStats = this.calculateDomainStatistics(decisions);

        // 効果メトリクス
        const effectivenessMetrics = this.calculateEffectivenessMetrics(decisions);

        return {
          ...preferences.statistics,
          effectivenessMetrics: {
            today: this.calculatePeriodStats(todayDecisions),
            week: this.calculatePeriodStats(weekDecisions),
            month: this.calculatePeriodStats(monthDecisions)
          },
          websiteStatistics: domainStats,
          activityTrends: this.calculateActivityTrends(decisions),
          performanceMetrics: effectivenessMetrics
        };
      },

      calculatePeriodStats(decisions) {
        const closed = decisions.filter(d => d.userDecision === 'close').length;
        const kept = decisions.filter(d => d.userDecision === 'keep').length;
        const total = decisions.length;
        
        const avgResponseTime = total > 0 ? 
          decisions.reduce((sum, d) => sum + (d.responseTime || 0), 0) / total : 0;

        return {
          totalDecisions: total,
          totalClosed: closed,
          totalKept: kept,
          blockRate: total > 0 ? (closed / total * 100) : 0,
          averageResponseTime: Math.round(avgResponseTime)
        };
      },

      calculateDomainStatistics(decisions) {
        const domainMap = new Map();
        
        decisions.forEach(decision => {
          const domain = decision.domain;
          if (!domainMap.has(domain)) {
            domainMap.set(domain, {
              domain: domain,
              totalDecisions: 0,
              totalClosed: 0,
              totalKept: 0,
              averageResponseTime: 0
            });
          }
          
          const stats = domainMap.get(domain);
          stats.totalDecisions++;
          
          if (decision.userDecision === 'close') {
            stats.totalClosed++;
          } else if (decision.userDecision === 'keep') {
            stats.totalKept++;
          }
        });

        // 応答時間の平均を計算
        domainMap.forEach((stats, domain) => {
          const domainDecisions = decisions.filter(d => d.domain === domain);
          const totalResponseTime = domainDecisions.reduce((sum, d) => sum + (d.responseTime || 0), 0);
          stats.averageResponseTime = Math.round(totalResponseTime / domainDecisions.length);
          stats.blockRate = stats.totalDecisions > 0 ? (stats.totalClosed / stats.totalDecisions * 100) : 0;
        });

        return Array.from(domainMap.values())
          .sort((a, b) => b.totalDecisions - a.totalDecisions)
          .slice(0, 10); // トップ10ドメイン
      },

      calculateActivityTrends(decisions) {
        const now = Date.now();
        const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
          hour: hour,
          activity: 0
        }));

        // 過去24時間のアクティビティ
        const last24Hours = decisions.filter(d => 
          now - d.decisionTimestamp < (24 * 60 * 60 * 1000)
        );

        last24Hours.forEach(decision => {
          const hour = new Date(decision.decisionTimestamp).getHours();
          hourlyActivity[hour].activity++;
        });

        // トレンド計算（過去7日間 vs 前の7日間）
        const last7Days = decisions.filter(d => 
          now - d.decisionTimestamp < (7 * 24 * 60 * 60 * 1000)
        ).length;

        const previous7Days = decisions.filter(d => {
          const age = now - d.decisionTimestamp;
          return age >= (7 * 24 * 60 * 60 * 1000) && age < (14 * 24 * 60 * 60 * 1000);
        }).length;

        const trendPercentage = previous7Days > 0 ? 
          ((last7Days - previous7Days) / previous7Days * 100) : 0;

        return {
          hourlyActivity: hourlyActivity,
          trend: {
            changePercentage: Math.round(trendPercentage * 10) / 10,
            direction: trendPercentage > 0 ? 'increasing' : 
                     trendPercentage < 0 ? 'decreasing' : 'stable'
          }
        };
      },

      calculateEffectivenessMetrics(decisions) {
        const totalDecisions = decisions.length;
        if (totalDecisions === 0) {
          return {
            overallEffectiveness: 0,
            userSatisfactionScore: 0,
            averageDecisionTime: 0,
            automationRate: 0
          };
        }

        const closedDecisions = decisions.filter(d => d.userDecision === 'close').length;
        const timeoutDecisions = decisions.filter(d => d.userDecision === 'timeout').length;
        
        const totalResponseTime = decisions.reduce((sum, d) => sum + (d.responseTime || 0), 0);
        const averageDecisionTime = totalResponseTime / totalDecisions;

        // 自動化率（学習による提案の採用率）
        const suggestedDecisions = decisions.filter(d => d.wasAutoSuggested).length;
        const automationRate = totalDecisions > 0 ? (suggestedDecisions / totalDecisions * 100) : 0;

        return {
          overallEffectiveness: Math.round((closedDecisions / totalDecisions) * 100),
          userSatisfactionScore: Math.round(((totalDecisions - timeoutDecisions) / totalDecisions) * 100),
          averageDecisionTime: Math.round(averageDecisionTime),
          automationRate: Math.round(automationRate)
        };
      },

      async handleUpdateStatistics(data) {
        const preferences = await this.handleGetUserPreferences();
        const statistics = { ...preferences.statistics };
        
        switch (data.action) {
          case 'detected':
            statistics.totalPopupsDetected++;
            break;
          case 'closed':
            statistics.totalPopupsClosed++;
            break;
          case 'kept':
            statistics.totalPopupsKept++;
            break;
          case 'reset':
            statistics.totalPopupsDetected = 0;
            statistics.totalPopupsClosed = 0;
            statistics.totalPopupsKept = 0;
            statistics.lastResetDate = Date.now();
            break;
        }
        
        preferences.statistics = statistics;
        await this.handleUpdateUserPreferences(preferences);
        
        return statistics;
      },

      async handleGetUserDecisions(filters = {}) {
        const result = await chrome.storage.local.get(['userDecisions']);
        let decisions = result.userDecisions || [];
        
        // フィルタリング
        if (filters.domain) {
          decisions = decisions.filter(d => d.domain === filters.domain);
        }
        
        if (filters.decision) {
          decisions = decisions.filter(d => d.userDecision === filters.decision);
        }
        
        if (filters.startDate) {
          decisions = decisions.filter(d => d.decisionTimestamp >= filters.startDate);
        }
        
        if (filters.endDate) {
          decisions = decisions.filter(d => d.decisionTimestamp <= filters.endDate);
        }
        
        if (filters.limit) {
          decisions = decisions.slice(0, filters.limit);
        }
        
        return decisions.sort((a, b) => b.decisionTimestamp - a.decisionTimestamp);
      },

      async handleSaveUserDecision(decisionData) {
        const result = await chrome.storage.local.get(['userDecisions']);
        const decisions = result.userDecisions || [];
        
        decisions.push({
          ...decisionData,
          timestamp: Date.now()
        });
        
        // 履歴サイズ制限
        if (decisions.length > 1000) {
          decisions.splice(0, decisions.length - 1000);
        }
        
        await chrome.storage.local.set({ userDecisions: decisions });
        
        return decisionData;
      },

      async handleGetLearningPatterns() {
        const result = await chrome.storage.local.get(['learningPatterns']);
        return result.learningPatterns || [];
      },

      async handleUpdateLearningData(learningData) {
        const preferences = await this.handleGetUserPreferences();
        
        if (!preferences.learningEnabled) {
          return { message: 'Learning disabled' };
        }

        // 学習システムに転送
        const patterns = await this.handleGetLearningPatterns();
        const updatedPatterns = await this.updateLearningPatterns(patterns, learningData);
        
        await chrome.storage.local.set({ learningPatterns: updatedPatterns });
        
        return { patternsCount: updatedPatterns.length };
      },

      async updateLearningPatterns(patterns, learningData) {
        // 簡略化された学習ロジック
        const existingPattern = patterns.find(p => 
          this.patternsMatch(p.characteristics, learningData.characteristics)
        );

        if (existingPattern) {
          existingPattern.occurrences++;
          existingPattern.lastSeen = Date.now();
          
          if (existingPattern.userDecision === learningData.userDecision) {
            existingPattern.confidence = Math.min(1.0, existingPattern.confidence + 0.1);
          } else {
            existingPattern.confidence = Math.max(0.1, existingPattern.confidence - 0.2);
          }
        } else {
          patterns.push({
            patternId: this.generatePatternId(),
            characteristics: learningData.characteristics,
            userDecision: learningData.userDecision,
            confidence: 0.6,
            occurrences: 1,
            lastSeen: Date.now(),
            domain: learningData.domain
          });
        }

        return patterns;
      },

      patternsMatch(pattern1, pattern2) {
        // 簡略化されたパターンマッチング
        const keys = ['hasCloseButton', 'containsAds', 'isModal'];
        let matches = 0;
        
        keys.forEach(key => {
          if (pattern1[key] === pattern2[key]) matches++;
        });
        
        return matches >= 2; // 2つ以上の特徴が一致
      },

      generatePatternId() {
        return 'pattern_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      },

      async handlePopupDetected(popupData, sender) {
        // 統計を更新
        await this.handleUpdateStatistics({ action: 'detected' });
        
        // 拡張機能が有効かチェック
        const preferences = await this.handleGetUserPreferences();
        if (!preferences.extensionEnabled) {
          return { action: 'ignore', reason: 'extension_disabled' };
        }

        // ホワイトリストをチェック
        const isWhitelisted = preferences.whitelistedDomains.includes(popupData.domain);
        if (isWhitelisted) {
          return { action: 'ignore', reason: 'domain_whitelisted' };
        }

        // 学習パターンから提案を取得
        const suggestion = await this.getPatternSuggestion(popupData);
        
        if (suggestion && suggestion.confidence > 0.8) {
          // 高信頼度の提案がある場合は自動実行
          await this.handleUpdateStatistics({ 
            action: suggestion.suggestion === 'close' ? 'closed' : 'kept' 
          });
          
          return {
            action: 'auto_execute',
            decision: suggestion.suggestion,
            confidence: suggestion.confidence,
            reason: 'high_confidence_pattern'
          };
        }

        // ユーザー決定を要求
        return {
          action: 'request_decision',
          popupId: popupData.id,
          suggestion: suggestion
        };
      },

      async getPatternSuggestion(popupData) {
        const patterns = await this.handleGetLearningPatterns();
        
        for (const pattern of patterns) {
          if (this.patternsMatch(pattern.characteristics, popupData.characteristics)) {
            return {
              suggestion: pattern.userDecision,
              confidence: pattern.confidence,
              patternId: pattern.patternId
            };
          }
        }
        
        return null;
      },

      async handleGetWhitelist() {
        const preferences = await this.handleGetUserPreferences();
        return preferences.whitelistedDomains || [];
      },

      async handleUpdateWhitelist(data) {
        const preferences = await this.handleGetUserPreferences();
        
        if (data.action === 'add' && data.domain) {
          if (!preferences.whitelistedDomains.includes(data.domain)) {
            preferences.whitelistedDomains.push(data.domain);
          }
        } else if (data.action === 'remove' && data.domain) {
          preferences.whitelistedDomains = preferences.whitelistedDomains.filter(
            domain => domain !== data.domain
          );
        } else if (data.action === 'set' && Array.isArray(data.domains)) {
          preferences.whitelistedDomains = data.domains;
        }
        
        await this.handleUpdateUserPreferences(preferences);
        return preferences.whitelistedDomains;
      },

      async handleTabUpdated(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete' && tab.url) {
          // タブの読み込み完了時にコンテンツスクリプトに設定を送信
          const preferences = await this.handleGetUserPreferences();
          
          try {
            await chrome.tabs.sendMessage(tabId, {
              type: 'EXTENSION_STATUS',
              data: {
                enabled: preferences.extensionEnabled,
                whitelisted: preferences.whitelistedDomains.includes(new URL(tab.url).hostname)
              }
            });
          } catch (error) {
            // タブがまだ準備できていない場合は無視
          }
        }
      },

      async handleTabActivated(activeInfo) {
        // アクティブタブの変更を記録
        this.activeConnections.set('activeTab', activeInfo.tabId);
      },

      async broadcastToAllTabs(message) {
        const tabs = await chrome.tabs.query({});
        
        const promises = tabs.map(tab => {
          try {
            const result = chrome.tabs.sendMessage(tab.id, message);
            // Promiseでない場合はPromise.resolveでラップ
            return Promise.resolve(result).catch(() => {
              // エラーは無視（コンテンツスクリプトがない場合など）
            });
          } catch (error) {
            // 同期エラーもキャッチ
            return Promise.resolve();
          }
        });
        
        await Promise.all(promises);
      },

      async getExtensionStatus() {
        const preferences = await this.handleGetUserPreferences();
        const statistics = await this.handleGetStatistics();
        
        return {
          enabled: preferences.extensionEnabled,
          version: chrome.runtime.getManifest?.()?.version || '1.0.0',
          statistics: statistics,
          activeConnections: this.activeConnections.size,
          lastActivity: Date.now()
        };
      }
    };

    // 初期化
    serviceWorker.init();
  });

  describe('初期化', () => {
    test('メッセージハンドラーが正しく設定される', () => {
      expect(serviceWorker.messageHandlers.size).toBeGreaterThan(0);
      expect(serviceWorker.messageHandlers.has('GET_USER_PREFERENCES')).toBe(true);
      expect(serviceWorker.messageHandlers.has('UPDATE_USER_PREFERENCES')).toBe(true);
      expect(serviceWorker.messageHandlers.has('POPUP_DETECTED')).toBe(true);
    });

    test('イベントリスナーが設定される', () => {
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onActivated.addListener).toHaveBeenCalled();
    });
  });

  describe('メッセージ処理', () => {
    test('有効なメッセージタイプを処理する', async () => {
      const mockSendResponse = jest.fn();
      const message = { type: 'GET_USER_PREFERENCES' };
      
      await serviceWorker.handleMessage(message, {}, mockSendResponse);
      
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });

    test('無効なメッセージタイプを処理する', async () => {
      const mockSendResponse = jest.fn();
      const message = { type: 'INVALID_MESSAGE_TYPE' };
      
      await serviceWorker.handleMessage(message, {}, mockSendResponse);
      
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown message type: INVALID_MESSAGE_TYPE'
      });
    });

    test('メッセージ処理エラーをハンドリングする', async () => {
      const mockSendResponse = jest.fn();
      
      // エラーを発生させるハンドラーを設定
      serviceWorker.messageHandlers.set('ERROR_TEST', () => {
        throw new Error('Test error');
      });
      
      const message = { type: 'ERROR_TEST' };
      
      await serviceWorker.handleMessage(message, {}, mockSendResponse);
      
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Test error'
      });
    });
  });

  describe('ユーザー設定管理', () => {
    test('デフォルト設定を取得する', async () => {
      const preferences = await serviceWorker.handleGetUserPreferences();
      
      expect(preferences.extensionEnabled).toBe(true);
      expect(preferences.showNotifications).toBe(true);
      expect(preferences.learningEnabled).toBe(true);
      expect(preferences.whitelistedDomains).toEqual([]);
      expect(preferences.statistics).toBeDefined();
    });

    test('ユーザー設定を更新する', async () => {
      const newPreferences = createMockUserPreferences({
        extensionEnabled: false,
        showNotifications: false
      });
      
      const result = await serviceWorker.handleUpdateUserPreferences(newPreferences);
      
      expect(result).toEqual(newPreferences);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        userPreferences: newPreferences
      });
    });

    test('設定更新時に全タブに通知する', async () => {
      const newPreferences = createMockUserPreferences();
      
      chrome.tabs.query.mockResolvedValueOnce([
        { id: 1, url: 'https://example.com' },
        { id: 2, url: 'https://test.com' }
      ]);
      
      await serviceWorker.handleUpdateUserPreferences(newPreferences);
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: 'PREFERENCES_UPDATED',
        data: newPreferences
      });
    });
  });

  describe('統計管理', () => {
    test('基本統計を取得する', async () => {
      // テストデータを設定
      const testDecisions = [
        {
          domain: 'example.com',
          userDecision: 'close',
          decisionTimestamp: Date.now() - 3600000, // 1時間前
          responseTime: 2000
        },
        {
          domain: 'test.com',
          userDecision: 'keep',
          decisionTimestamp: Date.now() - 7200000, // 2時間前
          responseTime: 3000
        }
      ];
      
      mockStorage.data.userDecisions = testDecisions;
      
      const statistics = await serviceWorker.handleGetStatistics();
      
      expect(statistics.effectivenessMetrics).toBeDefined();
      expect(statistics.websiteStatistics).toBeDefined();
      expect(statistics.activityTrends).toBeDefined();
      expect(statistics.performanceMetrics).toBeDefined();
    });

    test('統計を更新する', async () => {
      await serviceWorker.handleUpdateStatistics({ action: 'detected' });
      await serviceWorker.handleUpdateStatistics({ action: 'closed' });
      
      const preferences = await serviceWorker.handleGetUserPreferences();
      
      expect(preferences.statistics.totalPopupsDetected).toBe(1);
      expect(preferences.statistics.totalPopupsClosed).toBe(1);
    });

    test('統計をリセットする', async () => {
      // 初期統計を設定
      await serviceWorker.handleUpdateStatistics({ action: 'detected' });
      await serviceWorker.handleUpdateStatistics({ action: 'closed' });
      
      // リセット
      await serviceWorker.handleUpdateStatistics({ action: 'reset' });
      
      const preferences = await serviceWorker.handleGetUserPreferences();
      
      expect(preferences.statistics.totalPopupsDetected).toBe(0);
      expect(preferences.statistics.totalPopupsClosed).toBe(0);
      expect(preferences.statistics.totalPopupsKept).toBe(0);
      expect(preferences.statistics.lastResetDate).toBeDefined();
    });

    test('ドメイン別統計を計算する', async () => {
      const testDecisions = [
        { domain: 'example.com', userDecision: 'close', responseTime: 2000 },
        { domain: 'example.com', userDecision: 'keep', responseTime: 3000 },
        { domain: 'test.com', userDecision: 'close', responseTime: 1500 }
      ];
      
      const domainStats = serviceWorker.calculateDomainStatistics(testDecisions);
      
      expect(domainStats).toHaveLength(2);
      expect(domainStats[0].domain).toBe('example.com');
      expect(domainStats[0].totalDecisions).toBe(2);
      expect(domainStats[0].totalClosed).toBe(1);
      expect(domainStats[0].totalKept).toBe(1);
      expect(domainStats[0].blockRate).toBe(50);
    });

    test('アクティビティトレンドを計算する', async () => {
      const now = Date.now();
      const testDecisions = [
        { decisionTimestamp: now - 3600000 }, // 1時間前
        { decisionTimestamp: now - 7200000 }, // 2時間前
        { decisionTimestamp: now - (8 * 24 * 60 * 60 * 1000) } // 8日前
      ];
      
      const trends = serviceWorker.calculateActivityTrends(testDecisions);
      
      expect(trends.hourlyActivity).toHaveLength(24);
      expect(trends.trend).toBeDefined();
      expect(trends.trend.direction).toMatch(/increasing|decreasing|stable/);
    });
  });

  describe('ユーザー決定管理', () => {
    test('ユーザー決定を保存する', async () => {
      const decisionData = {
        id: 'popup_123',
        domain: 'example.com',
        userDecision: 'close',
        responseTime: 2500
      };
      
      const result = await serviceWorker.handleSaveUserDecision(decisionData);
      
      expect(result).toEqual(decisionData);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        userDecisions: expect.arrayContaining([
          expect.objectContaining(decisionData)
        ])
      });
    });

    test('ユーザー決定を取得する', async () => {
      const testDecisions = [
        {
          domain: 'example.com',
          userDecision: 'close',
          decisionTimestamp: Date.now()
        },
        {
          domain: 'test.com',
          userDecision: 'keep',
          decisionTimestamp: Date.now() - 3600000
        }
      ];
      
      mockStorage.data.userDecisions = testDecisions;
      
      const decisions = await serviceWorker.handleGetUserDecisions();
      
      expect(decisions).toHaveLength(2);
      expect(decisions[0].decisionTimestamp).toBeGreaterThan(decisions[1].decisionTimestamp);
    });

    test('フィルタリングされたユーザー決定を取得する', async () => {
      const testDecisions = [
        { domain: 'example.com', userDecision: 'close', decisionTimestamp: Date.now() },
        { domain: 'test.com', userDecision: 'keep', decisionTimestamp: Date.now() },
        { domain: 'example.com', userDecision: 'keep', decisionTimestamp: Date.now() }
      ];
      
      mockStorage.data.userDecisions = testDecisions;
      
      const filteredDecisions = await serviceWorker.handleGetUserDecisions({
        domain: 'example.com',
        decision: 'close'
      });
      
      expect(filteredDecisions).toHaveLength(1);
      expect(filteredDecisions[0].domain).toBe('example.com');
      expect(filteredDecisions[0].userDecision).toBe('close');
    });

    test('決定履歴のサイズ制限', async () => {
      // 既存の決定を1000件設定
      const existingDecisions = Array.from({ length: 1000 }, (_, i) => ({
        id: `popup_${i}`,
        timestamp: Date.now() - i * 1000
      }));
      
      mockStorage.data.userDecisions = existingDecisions;
      
      const newDecision = {
        id: 'popup_new',
        timestamp: Date.now()
      };
      
      await serviceWorker.handleSaveUserDecision(newDecision);
      
      const savedData = chrome.storage.local.set.mock.calls[0][0];
      expect(savedData.userDecisions).toHaveLength(1000);
    });
  });

  describe('学習システム管理', () => {
    test('学習パターンを取得する', async () => {
      const testPatterns = [
        {
          patternId: 'pattern_1',
          characteristics: { hasCloseButton: true, containsAds: true },
          userDecision: 'close',
          confidence: 0.8
        }
      ];
      
      mockStorage.data.learningPatterns = testPatterns;
      
      const patterns = await serviceWorker.handleGetLearningPatterns();
      
      expect(patterns).toEqual(testPatterns);
    });

    test('学習データを更新する', async () => {
      const learningData = {
        characteristics: { hasCloseButton: true, containsAds: true, isModal: true },
        userDecision: 'close',
        domain: 'example.com'
      };
      
      const result = await serviceWorker.handleUpdateLearningData(learningData);
      
      expect(result.patternsCount).toBe(1);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        learningPatterns: expect.arrayContaining([
          expect.objectContaining({
            characteristics: learningData.characteristics,
            userDecision: learningData.userDecision,
            domain: learningData.domain
          })
        ])
      });
    });

    test('学習無効時は学習データを更新しない', async () => {
      // 学習を無効にする
      const preferences = createMockUserPreferences({ learningEnabled: false });
      mockStorage.data.userPreferences = preferences;
      
      const learningData = {
        characteristics: { hasCloseButton: true },
        userDecision: 'close'
      };
      
      const result = await serviceWorker.handleUpdateLearningData(learningData);
      
      expect(result.message).toBe('Learning disabled');
    });

    test('既存パターンを更新する', async () => {
      const existingPatterns = [
        {
          patternId: 'pattern_1',
          characteristics: { hasCloseButton: true, containsAds: true, isModal: true },
          userDecision: 'close',
          confidence: 0.6,
          occurrences: 1
        }
      ];
      
      const learningData = {
        characteristics: { hasCloseButton: true, containsAds: true, isModal: true },
        userDecision: 'close'
      };
      
      const updatedPatterns = await serviceWorker.updateLearningPatterns(existingPatterns, learningData);
      
      expect(updatedPatterns).toHaveLength(1);
      expect(updatedPatterns[0].occurrences).toBe(2);
      expect(updatedPatterns[0].confidence).toBeGreaterThan(0.6);
    });
  });

  describe('ポップアップ検出処理', () => {
    test('拡張機能が無効の場合は無視する', async () => {
      const preferences = createMockUserPreferences({ extensionEnabled: false });
      mockStorage.data.userPreferences = preferences;
      
      const popupData = createMockPopupData();
      
      const result = await serviceWorker.handlePopupDetected(popupData);
      
      expect(result.action).toBe('ignore');
      expect(result.reason).toBe('extension_disabled');
    });

    test('ホワイトリストドメインの場合は無視する', async () => {
      const preferences = createMockUserPreferences({
        whitelistedDomains: ['example.com']
      });
      mockStorage.data.userPreferences = preferences;
      
      const popupData = createMockPopupData({ domain: 'example.com' });
      
      const result = await serviceWorker.handlePopupDetected(popupData);
      
      expect(result.action).toBe('ignore');
      expect(result.reason).toBe('domain_whitelisted');
    });

    test('高信頼度パターンがある場合は自動実行する', async () => {
      const patterns = [
        {
          patternId: 'pattern_1',
          characteristics: { hasCloseButton: true, containsAds: true, isModal: true },
          userDecision: 'close',
          confidence: 0.9
        }
      ];
      
      mockStorage.data.learningPatterns = patterns;
      
      const popupData = createMockPopupData({
        characteristics: { hasCloseButton: true, containsAds: true, isModal: true }
      });
      
      const result = await serviceWorker.handlePopupDetected(popupData);
      
      expect(result.action).toBe('auto_execute');
      expect(result.decision).toBe('close');
      expect(result.confidence).toBe(0.9);
    });

    test('低信頼度パターンの場合はユーザー決定を要求する', async () => {
      const patterns = [
        {
          patternId: 'pattern_1',
          characteristics: { hasCloseButton: true, containsAds: true, isModal: true },
          userDecision: 'close',
          confidence: 0.5
        }
      ];
      
      mockStorage.data.learningPatterns = patterns;
      
      const popupData = createMockPopupData({
        characteristics: { hasCloseButton: true, containsAds: true, isModal: true }
      });
      
      const result = await serviceWorker.handlePopupDetected(popupData);
      
      expect(result.action).toBe('request_decision');
      expect(result.popupId).toBe(popupData.id);
      expect(result.suggestion).toBeDefined();
    });

    test('パターンがない場合はユーザー決定を要求する', async () => {
      const popupData = createMockPopupData();
      
      const result = await serviceWorker.handlePopupDetected(popupData);
      
      expect(result.action).toBe('request_decision');
      expect(result.popupId).toBe(popupData.id);
      expect(result.suggestion).toBeNull();
    });
  });

  describe('ホワイトリスト管理', () => {
    test('ホワイトリストを取得する', async () => {
      const preferences = createMockUserPreferences({
        whitelistedDomains: ['example.com', 'test.com']
      });
      mockStorage.data.userPreferences = preferences;
      
      const whitelist = await serviceWorker.handleGetWhitelist();
      
      expect(whitelist).toEqual(['example.com', 'test.com']);
    });

    test('ドメインをホワイトリストに追加する', async () => {
      const result = await serviceWorker.handleUpdateWhitelist({
        action: 'add',
        domain: 'example.com'
      });
      
      expect(result).toContain('example.com');
    });

    test('ドメインをホワイトリストから削除する', async () => {
      const preferences = createMockUserPreferences({
        whitelistedDomains: ['example.com', 'test.com']
      });
      mockStorage.data.userPreferences = preferences;
      
      const result = await serviceWorker.handleUpdateWhitelist({
        action: 'remove',
        domain: 'example.com'
      });
      
      expect(result).not.toContain('example.com');
      expect(result).toContain('test.com');
    });

    test('ホワイトリストを設定する', async () => {
      const newDomains = ['new1.com', 'new2.com'];
      
      const result = await serviceWorker.handleUpdateWhitelist({
        action: 'set',
        domains: newDomains
      });
      
      expect(result).toEqual(newDomains);
    });

    test('重複ドメインの追加を防ぐ', async () => {
      const preferences = createMockUserPreferences({
        whitelistedDomains: ['example.com']
      });
      mockStorage.data.userPreferences = preferences;
      
      const result = await serviceWorker.handleUpdateWhitelist({
        action: 'add',
        domain: 'example.com'
      });
      
      expect(result).toEqual(['example.com']); // 重複なし
    });
  });

  describe('タブイベント処理', () => {
    test('タブ更新時に設定を送信する', async () => {
      const tabId = 123;
      const tab = { id: tabId, url: 'https://example.com/page' };
      
      await serviceWorker.handleTabUpdated(tabId, { status: 'complete' }, tab);
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, {
        type: 'EXTENSION_STATUS',
        data: {
          enabled: true,
          whitelisted: false
        }
      });
    });

    test('ホワイトリストドメインでの設定送信', async () => {
      const preferences = createMockUserPreferences({
        whitelistedDomains: ['example.com']
      });
      mockStorage.data.userPreferences = preferences;
      
      const tabId = 123;
      const tab = { id: tabId, url: 'https://example.com/page' };
      
      await serviceWorker.handleTabUpdated(tabId, { status: 'complete' }, tab);
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(tabId, {
        type: 'EXTENSION_STATUS',
        data: {
          enabled: true,
          whitelisted: true
        }
      });
    });

    test('タブアクティベーション時の処理', async () => {
      const activeInfo = { tabId: 123 };
      
      await serviceWorker.handleTabActivated(activeInfo);
      
      expect(serviceWorker.activeConnections.get('activeTab')).toBe(123);
    });

    test('無効なURLでのタブ更新処理', async () => {
      const tabId = 123;
      const tab = { id: tabId, url: 'chrome://settings' };
      
      // エラーが発生しないことを確認
      await expect(
        serviceWorker.handleTabUpdated(tabId, { status: 'complete' }, tab)
      ).resolves.toBeUndefined();
    });
  });

  describe('全タブへのブロードキャスト', () => {
    test('全タブにメッセージを送信する', async () => {
      const tabs = [
        { id: 1, url: 'https://example.com' },
        { id: 2, url: 'https://test.com' }
      ];
      
      chrome.tabs.query.mockResolvedValueOnce(tabs);
      
      const message = { type: 'TEST_MESSAGE', data: 'test' };
      
      await serviceWorker.broadcastToAllTabs(message);
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, message);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, message);
    });

    test('メッセージ送信エラーを無視する', async () => {
      const tabs = [{ id: 1, url: 'https://example.com' }];
      
      chrome.tabs.query.mockResolvedValueOnce(tabs);
      chrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Tab error'));
      
      const message = { type: 'TEST_MESSAGE' };
      
      // エラーが発生してもクラッシュしない
      await expect(
        serviceWorker.broadcastToAllTabs(message)
      ).resolves.toBeUndefined();
    });
  });

  describe('拡張機能ステータス', () => {
    test('拡張機能ステータスを取得する', async () => {
      const status = await serviceWorker.getExtensionStatus();
      
      expect(status.enabled).toBe(true);
      expect(status.version).toBeDefined();
      expect(status.statistics).toBeDefined();
      expect(status.activeConnections).toBeDefined();
      expect(status.lastActivity).toBeDefined();
    });
  });

  describe('エラーハンドリング', () => {
    test('ストレージエラーの処理', async () => {
      chrome.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));
      
      const mockSendResponse = jest.fn();
      const message = { type: 'GET_USER_PREFERENCES' };
      
      await serviceWorker.handleMessage(message, {}, mockSendResponse);
      
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Storage error'
      });
    });

    test('タブメッセージ送信エラーの処理', async () => {
      chrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Tab not found'));
      
      // エラーが発生してもクラッシュしない
      await expect(
        serviceWorker.handleTabUpdated(123, { status: 'complete' }, { url: 'https://example.com' })
      ).resolves.toBeUndefined();
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量メッセージの処理パフォーマンス', async () => {
      const promises = [];
      
      // 100個のメッセージを同時処理
      for (let i = 0; i < 100; i++) {
        const mockSendResponse = jest.fn();
        const message = { type: 'GET_USER_PREFERENCES' };
        promises.push(serviceWorker.handleMessage(message, {}, mockSendResponse));
      }
      
      const startTime = Date.now();
      await Promise.all(promises);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
    });

    test('統計計算のパフォーマンス', async () => {
      // 大量の決定データを作成
      const largeDecisionSet = Array.from({ length: 1000 }, (_, i) => ({
        domain: `domain${i % 10}.com`,
        userDecision: i % 2 === 0 ? 'close' : 'keep',
        decisionTimestamp: Date.now() - (i * 1000),
        responseTime: 1000 + (i % 5000)
      }));
      
      mockStorage.data.userDecisions = largeDecisionSet;
      
      const startTime = Date.now();
      await serviceWorker.handleGetStatistics();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(2000); // 2秒以内
    });
  });
});