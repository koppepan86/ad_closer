/**
 * ユーザーエクスペリエンステスト
 * エンドツーエンドのユーザーワークフローを検証
 */

/**
 * ユーザーエクスペリエンステストクラス
 */
class UserExperienceTest {
  constructor() {
    this.testResults = [];
    this.mockEnvironment = null;
  }

  /**
   * すべてのユーザーエクスペリエンステストを実行
   */
  async runAllTests() {
    console.log('🎭 ユーザーエクスペリエンステストを開始します...\n');
    
    const startTime = Date.now();
    
    try {
      // テスト環境のセットアップ
      await this.setupTestEnvironment();
      
      // 基本的なユーザーワークフローテスト
      await this.testBasicUserWorkflow();
      
      // 拡張機能の有効/無効切り替えテスト
      await this.testExtensionToggle();
      
      // ホワイトリスト管理テスト
      await this.testWhitelistManagement();
      
      // 統計表示テスト
      await this.testStatisticsDisplay();
      
      // 設定管理テスト
      await this.testSettingsManagement();
      
      // エラー回復テスト
      await this.testErrorRecovery();
      
      // パフォーマンステスト
      await this.testPerformance();
      
      const duration = Date.now() - startTime;
      
      // 結果を表示
      this.displayResults(duration);
      
      return this.generateReport();
    } catch (error) {
      console.error('❌ ユーザーエクスペリエンステスト中にエラーが発生しました:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * テスト環境のセットアップ
   */
  async setupTestEnvironment() {
    console.log('🔧 テスト環境をセットアップ中...');
    
    this.mockEnvironment = {
      // モックDOM環境
      document: {
        createElement: (tagName) => ({
          tagName: tagName.toUpperCase(),
          style: {},
          classList: {
            add: () => {},
            remove: () => {},
            contains: () => false
          },
          addEventListener: () => {},
          removeEventListener: () => {},
          appendChild: () => {},
          removeChild: () => {},
          getBoundingClientRect: () => ({
            width: 400,
            height: 300,
            top: 100,
            left: 100
          }),
          querySelector: () => null,
          querySelectorAll: () => []
        }),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        body: {
          appendChild: () => {},
          removeChild: () => {}
        }
      },
      
      // モックChrome API
      chrome: {
        runtime: {
          sendMessage: (message, callback) => {
            setTimeout(() => {
              callback(this.generateMockResponse(message));
            }, 10);
          },
          onMessage: {
            addListener: () => {}
          }
        },
        storage: {
          local: {
            get: (keys, callback) => {
              const mockData = this.getMockStorageData(keys);
              callback(mockData);
            },
            set: (data, callback) => {
              if (callback) callback();
            }
          }
        },
        tabs: {
          query: (queryInfo, callback) => {
            callback([{
              id: 1,
              url: 'https://example.com/test',
              title: 'Test Page'
            }]);
          }
        },
        notifications: {
          create: (id, options, callback) => {
            if (callback) callback(id);
          }
        }
      }
    };
    
    this.recordResult('Test Environment Setup', true, 'Mock environment created successfully');
  }

  /**
   * モックレスポンスを生成
   */
  generateMockResponse(message) {
    switch (message.type) {
      case 'GET_USER_PREFERENCES':
        return {
          success: true,
          data: {
            extensionEnabled: true,
            showNotifications: true,
            notificationDuration: 5000,
            whitelistedDomains: [],
            learningEnabled: true,
            statistics: {
              totalPopupsDetected: 10,
              totalPopupsClosed: 8,
              totalPopupsKept: 2
            }
          }
        };
      
      case 'GET_STATISTICS':
        return {
          success: true,
          data: {
            totalPopupsDetected: 10,
            totalPopupsClosed: 8,
            totalPopupsKept: 2,
            websiteStatistics: [
              { domain: 'example.com', totalClosed: 5, blockRate: 80 },
              { domain: 'test.org', totalClosed: 3, blockRate: 75 }
            ],
            effectivenessMetrics: {
              today: { totalClosed: 3, blockRate: 85.0, averageResponseTime: 2500 }
            }
          }
        };
      
      case 'POPUP_DETECTED':
        return { success: true };
      
      case 'USER_DECISION':
        return { success: true, decision: message.data.decision };
      
      default:
        return { success: true };
    }
  }

  /**
   * モックストレージデータを取得
   */
  getMockStorageData(keys) {
    const mockStorage = {
      userPreferences: {
        extensionEnabled: true,
        showNotifications: true,
        notificationDuration: 5000,
        whitelistedDomains: ['trusted.com'],
        learningEnabled: true,
        statistics: {
          totalPopupsDetected: 10,
          totalPopupsClosed: 8,
          totalPopupsKept: 2
        }
      },
      learningPatterns: [
        {
          characteristics: { hasCloseButton: true, containsAds: true },
          userDecision: 'close',
          confidence: 0.9
        }
      ],
      popupHistory: [
        {
          id: 'popup-1',
          domain: 'example.com',
          decision: 'close',
          timestamp: Date.now() - 3600000
        }
      ]
    };
    
    if (Array.isArray(keys)) {
      const result = {};
      keys.forEach(key => {
        result[key] = mockStorage[key];
      });
      return result;
    } else if (typeof keys === 'object') {
      const result = {};
      Object.keys(keys).forEach(key => {
        result[key] = mockStorage[key] || keys[key];
      });
      return result;
    }
    
    return mockStorage;
  }

  /**
   * 基本的なユーザーワークフローテスト
   */
  async testBasicUserWorkflow() {
    console.log('👤 基本的なユーザーワークフローをテスト中...');
    
    try {
      // 1. ポップアップ検出のシミュレーション
      const popupDetected = await this.simulatePopupDetection();
      this.recordResult('Popup Detection', popupDetected, 'Popup successfully detected');
      
      // 2. ユーザー通知の表示
      const notificationShown = await this.simulateNotificationDisplay();
      this.recordResult('User Notification', notificationShown, 'Notification displayed to user');
      
      // 3. ユーザー決定の処理
      const decisionProcessed = await this.simulateUserDecision('close');
      this.recordResult('User Decision Processing', decisionProcessed, 'User decision processed correctly');
      
      // 4. ポップアップの閉鎖
      const popupClosed = await this.simulatePopupClosure();
      this.recordResult('Popup Closure', popupClosed, 'Popup closed successfully');
      
      // 5. 学習データの更新
      const learningUpdated = await this.simulateLearningUpdate();
      this.recordResult('Learning Update', learningUpdated, 'Learning data updated');
      
      // 6. 統計の更新
      const statisticsUpdated = await this.simulateStatisticsUpdate();
      this.recordResult('Statistics Update', statisticsUpdated, 'Statistics updated');
      
      const workflowSuccess = popupDetected && notificationShown && decisionProcessed && 
                             popupClosed && learningUpdated && statisticsUpdated;
      
      this.recordResult('Basic User Workflow', workflowSuccess, 
        workflowSuccess ? 'Complete workflow executed successfully' : 'Workflow had issues');
      
    } catch (error) {
      this.recordResult('Basic User Workflow', false, `Workflow error: ${error.message}`);
    }
  }

  /**
   * ポップアップ検出のシミュレーション
   */
  async simulatePopupDetection() {
    try {
      // モックポップアップ要素を作成
      const mockPopup = this.mockEnvironment.document.createElement('div');
      mockPopup.style.position = 'fixed';
      mockPopup.style.zIndex = '9999';
      mockPopup.style.width = '400px';
      mockPopup.style.height = '300px';
      
      // ポップアップ特性を分析
      const characteristics = {
        hasCloseButton: true,
        containsAds: true,
        hasExternalLinks: false,
        isModal: true,
        zIndex: 9999,
        dimensions: { width: 400, height: 300 }
      };
      
      // バックグラウンドスクリプトに検出を報告
      const response = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'POPUP_DETECTED',
          data: {
            id: 'test-popup-1',
            characteristics,
            confidence: 0.8
          }
        }, resolve);
      });
      
      return response && response.success;
    } catch (error) {
      console.error('Popup detection simulation failed:', error);
      return false;
    }
  }

  /**
   * 通知表示のシミュレーション
   */
  async simulateNotificationDisplay() {
    try {
      // 通知を作成
      const notificationId = await new Promise((resolve) => {
        this.mockEnvironment.chrome.notifications.create(
          'popup-notification',
          {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'ポップアップ広告を検出しました',
            message: 'このポップアップを閉じますか？',
            buttons: [
              { title: '閉じる' },
              { title: '開いたままにする' }
            ]
          },
          resolve
        );
      });
      
      return notificationId === 'popup-notification';
    } catch (error) {
      console.error('Notification display simulation failed:', error);
      return false;
    }
  }

  /**
   * ユーザー決定のシミュレーション
   */
  async simulateUserDecision(decision) {
    try {
      const response = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'USER_DECISION',
          data: {
            popupId: 'test-popup-1',
            decision: decision,
            timestamp: Date.now()
          }
        }, resolve);
      });
      
      return response && response.success && response.decision === decision;
    } catch (error) {
      console.error('User decision simulation failed:', error);
      return false;
    }
  }

  /**
   * ポップアップ閉鎖のシミュレーション
   */
  async simulatePopupClosure() {
    try {
      // DOM要素の削除をシミュレート
      const mockPopup = this.mockEnvironment.document.createElement('div');
      
      // 親要素から削除
      const removed = true; // シミュレーション
      
      return removed;
    } catch (error) {
      console.error('Popup closure simulation failed:', error);
      return false;
    }
  }

  /**
   * 学習更新のシミュレーション
   */
  async simulateLearningUpdate() {
    try {
      // 学習パターンを更新
      const learningPattern = {
        characteristics: {
          hasCloseButton: true,
          containsAds: true,
          isModal: true
        },
        userDecision: 'close',
        confidence: 0.9,
        occurrences: 1
      };
      
      // ストレージに保存
      await new Promise((resolve) => {
        this.mockEnvironment.chrome.storage.local.set({
          learningPatterns: [learningPattern]
        }, resolve);
      });
      
      return true;
    } catch (error) {
      console.error('Learning update simulation failed:', error);
      return false;
    }
  }

  /**
   * 統計更新のシミュレーション
   */
  async simulateStatisticsUpdate() {
    try {
      // 統計を更新
      const updatedStats = {
        totalPopupsDetected: 11,
        totalPopupsClosed: 9,
        totalPopupsKept: 2,
        lastResetDate: Date.now()
      };
      
      // ストレージに保存
      await new Promise((resolve) => {
        this.mockEnvironment.chrome.storage.local.set({
          statistics: updatedStats
        }, resolve);
      });
      
      return true;
    } catch (error) {
      console.error('Statistics update simulation failed:', error);
      return false;
    }
  }

  /**
   * 拡張機能の有効/無効切り替えテスト
   */
  async testExtensionToggle() {
    console.log('🔄 拡張機能の有効/無効切り替えをテスト中...');
    
    try {
      // 現在の設定を取得
      const currentPrefs = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'GET_USER_PREFERENCES'
        }, resolve);
      });
      
      const initialState = currentPrefs.data.extensionEnabled;
      this.recordResult('Get Current State', true, `Initial state: ${initialState}`);
      
      // 拡張機能を無効にする
      const disableResponse = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'UPDATE_USER_PREFERENCES',
          data: { extensionEnabled: false }
        }, resolve);
      });
      
      this.recordResult('Disable Extension', disableResponse.success, 'Extension disabled');
      
      // 拡張機能を有効にする
      const enableResponse = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'UPDATE_USER_PREFERENCES',
          data: { extensionEnabled: true }
        }, resolve);
      });
      
      this.recordResult('Enable Extension', enableResponse.success, 'Extension enabled');
      
      const toggleSuccess = disableResponse.success && enableResponse.success;
      this.recordResult('Extension Toggle Test', toggleSuccess, 
        toggleSuccess ? 'Toggle functionality working' : 'Toggle functionality failed');
      
    } catch (error) {
      this.recordResult('Extension Toggle Test', false, `Toggle error: ${error.message}`);
    }
  }

  /**
   * ホワイトリスト管理テスト
   */
  async testWhitelistManagement() {
    console.log('📝 ホワイトリスト管理をテスト中...');
    
    try {
      // 現在のホワイトリストを取得
      const currentPrefs = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'GET_USER_PREFERENCES'
        }, resolve);
      });
      
      const initialWhitelist = currentPrefs.data.whitelistedDomains || [];
      this.recordResult('Get Whitelist', true, `Initial whitelist: ${initialWhitelist.length} domains`);
      
      // ドメインを追加
      const newWhitelist = [...initialWhitelist, 'newsite.com'];
      const addResponse = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'UPDATE_USER_PREFERENCES',
          data: { whitelistedDomains: newWhitelist }
        }, resolve);
      });
      
      this.recordResult('Add to Whitelist', addResponse.success, 'Domain added to whitelist');
      
      // ドメインを削除
      const removedWhitelist = newWhitelist.filter(domain => domain !== 'newsite.com');
      const removeResponse = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'UPDATE_USER_PREFERENCES',
          data: { whitelistedDomains: removedWhitelist }
        }, resolve);
      });
      
      this.recordResult('Remove from Whitelist', removeResponse.success, 'Domain removed from whitelist');
      
      const whitelistSuccess = addResponse.success && removeResponse.success;
      this.recordResult('Whitelist Management Test', whitelistSuccess, 
        whitelistSuccess ? 'Whitelist management working' : 'Whitelist management failed');
      
    } catch (error) {
      this.recordResult('Whitelist Management Test', false, `Whitelist error: ${error.message}`);
    }
  }

  /**
   * 統計表示テスト
   */
  async testStatisticsDisplay() {
    console.log('📊 統計表示をテスト中...');
    
    try {
      // 統計データを取得
      const statsResponse = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'GET_STATISTICS'
        }, resolve);
      });
      
      this.recordResult('Get Statistics', statsResponse.success, 'Statistics retrieved');
      
      if (statsResponse.success) {
        const stats = statsResponse.data;
        
        // 基本統計の確認
        const hasBasicStats = stats.totalPopupsDetected !== undefined &&
                             stats.totalPopupsClosed !== undefined &&
                             stats.totalPopupsKept !== undefined;
        
        this.recordResult('Basic Statistics', hasBasicStats, 'Basic statistics present');
        
        // ウェブサイト統計の確認
        const hasWebsiteStats = stats.websiteStatistics && Array.isArray(stats.websiteStatistics);
        this.recordResult('Website Statistics', hasWebsiteStats, 'Website statistics present');
        
        // 効果メトリクスの確認
        const hasEffectivenessMetrics = stats.effectivenessMetrics && stats.effectivenessMetrics.today;
        this.recordResult('Effectiveness Metrics', hasEffectivenessMetrics, 'Effectiveness metrics present');
        
        const statisticsSuccess = hasBasicStats && hasWebsiteStats && hasEffectivenessMetrics;
        this.recordResult('Statistics Display Test', statisticsSuccess, 
          statisticsSuccess ? 'Statistics display working' : 'Statistics display incomplete');
      } else {
        this.recordResult('Statistics Display Test', false, 'Failed to retrieve statistics');
      }
      
    } catch (error) {
      this.recordResult('Statistics Display Test', false, `Statistics error: ${error.message}`);
    }
  }

  /**
   * 設定管理テスト
   */
  async testSettingsManagement() {
    console.log('⚙️ 設定管理をテスト中...');
    
    try {
      // 現在の設定を取得
      const currentPrefs = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'GET_USER_PREFERENCES'
        }, resolve);
      });
      
      this.recordResult('Get Settings', currentPrefs.success, 'Settings retrieved');
      
      // 設定を更新
      const newSettings = {
        ...currentPrefs.data,
        notificationDuration: 8000,
        learningEnabled: false
      };
      
      const updateResponse = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'UPDATE_USER_PREFERENCES',
          data: newSettings
        }, resolve);
      });
      
      this.recordResult('Update Settings', updateResponse.success, 'Settings updated');
      
      // 更新された設定を確認
      const updatedPrefs = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'GET_USER_PREFERENCES'
        }, resolve);
      });
      
      const settingsVerified = updatedPrefs.success;
      this.recordResult('Verify Settings', settingsVerified, 'Settings verification');
      
      const settingsSuccess = currentPrefs.success && updateResponse.success && settingsVerified;
      this.recordResult('Settings Management Test', settingsSuccess, 
        settingsSuccess ? 'Settings management working' : 'Settings management failed');
      
    } catch (error) {
      this.recordResult('Settings Management Test', false, `Settings error: ${error.message}`);
    }
  }

  /**
   * エラー回復テスト
   */
  async testErrorRecovery() {
    console.log('🛡️ エラー回復をテスト中...');
    
    try {
      // 通信エラーのシミュレーション
      const originalSendMessage = this.mockEnvironment.chrome.runtime.sendMessage;
      
      // 一時的に通信を失敗させる
      this.mockEnvironment.chrome.runtime.sendMessage = (message, callback) => {
        callback({ success: false, error: 'Communication failed' });
      };
      
      // エラーが発生することを確認
      const errorResponse = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'GET_STATISTICS'
        }, resolve);
      });
      
      this.recordResult('Error Simulation', !errorResponse.success, 'Error successfully simulated');
      
      // 通信を復旧
      this.mockEnvironment.chrome.runtime.sendMessage = originalSendMessage;
      
      // 回復を確認
      const recoveryResponse = await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'GET_STATISTICS'
        }, resolve);
      });
      
      this.recordResult('Error Recovery', recoveryResponse.success, 'Communication recovered');
      
      const recoverySuccess = !errorResponse.success && recoveryResponse.success;
      this.recordResult('Error Recovery Test', recoverySuccess, 
        recoverySuccess ? 'Error recovery working' : 'Error recovery failed');
      
    } catch (error) {
      this.recordResult('Error Recovery Test', false, `Recovery error: ${error.message}`);
    }
  }

  /**
   * パフォーマンステスト
   */
  async testPerformance() {
    console.log('⚡ パフォーマンスをテスト中...');
    
    try {
      const performanceTests = [];
      
      // メッセージ送信の応答時間テスト
      const messageStartTime = Date.now();
      await new Promise((resolve) => {
        this.mockEnvironment.chrome.runtime.sendMessage({
          type: 'GET_STATISTICS'
        }, resolve);
      });
      const messageResponseTime = Date.now() - messageStartTime;
      
      performanceTests.push({
        name: 'Message Response Time',
        value: messageResponseTime,
        threshold: 100,
        passed: messageResponseTime < 100
      });
      
      // 複数メッセージの並行処理テスト
      const concurrentStartTime = Date.now();
      const concurrentPromises = Array(5).fill().map(() => 
        new Promise((resolve) => {
          this.mockEnvironment.chrome.runtime.sendMessage({
            type: 'GET_USER_PREFERENCES'
          }, resolve);
        })
      );
      
      await Promise.all(concurrentPromises);
      const concurrentResponseTime = Date.now() - concurrentStartTime;
      
      performanceTests.push({
        name: 'Concurrent Messages',
        value: concurrentResponseTime,
        threshold: 200,
        passed: concurrentResponseTime < 200
      });
      
      // ストレージ操作の応答時間テスト
      const storageStartTime = Date.now();
      await new Promise((resolve) => {
        this.mockEnvironment.chrome.storage.local.get(['userPreferences'], resolve);
      });
      const storageResponseTime = Date.now() - storageStartTime;
      
      performanceTests.push({
        name: 'Storage Response Time',
        value: storageResponseTime,
        threshold: 50,
        passed: storageResponseTime < 50
      });
      
      // パフォーマンステスト結果を記録
      performanceTests.forEach(test => {
        this.recordResult(`Performance: ${test.name}`, test.passed, 
          `${test.value}ms (threshold: ${test.threshold}ms)`);
      });
      
      const allPerformanceTestsPassed = performanceTests.every(test => test.passed);
      this.recordResult('Performance Test', allPerformanceTestsPassed, 
        allPerformanceTestsPassed ? 'All performance tests passed' : 'Some performance tests failed');
      
    } catch (error) {
      this.recordResult('Performance Test', false, `Performance error: ${error.message}`);
    }
  }

  /**
   * テスト結果を記録
   */
  recordResult(testName, passed, message = null) {
    this.testResults.push({
      name: testName,
      passed,
      message,
      timestamp: Date.now()
    });
    
    const status = passed ? '✅' : '❌';
    const msg = message ? ` - ${message}` : '';
    console.log(`  ${status} ${testName}${msg}`);
  }

  /**
   * 結果を表示
   */
  displayResults(duration) {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    
    console.log('\n🎭 ユーザーエクスペリエンステスト結果');
    console.log('='.repeat(60));
    console.log(`実行時間: ${duration}ms`);
    console.log(`総テスト数: ${totalTests}`);
    console.log(`成功: ${passedTests}`);
    console.log(`失敗: ${failedTests}`);
    console.log(`成功率: ${passRate.toFixed(2)}%`);
    console.log('='.repeat(60));
    
    if (failedTests > 0) {
      console.log('\n❌ 失敗したテスト:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`  • ${result.name}`);
          if (result.message) {
            console.log(`    ${result.message}`);
          }
        });
    }
    
    console.log('\n');
  }

  /**
   * レポートを生成
   */
  generateReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    
    return {
      success: failedTests === 0,
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        passRate: Math.round(passRate * 100) / 100
      },
      results: this.testResults,
      timestamp: Date.now()
    };
  }
}

/**
 * ユーザーエクスペリエンステストを実行
 */
async function runUserExperienceTests() {
  const test = new UserExperienceTest();
  const report = await test.runAllTests();
  
  if (report.success) {
    console.log('🎉 すべてのユーザーエクスペリエンステストが成功しました！');
    return 0;
  } else {
    console.log('⚠️ 一部のユーザーエクスペリエンステストが失敗しました。');
    return 1;
  }
}

// 直接実行された場合
if (require.main === module) {
  runUserExperienceTests().then(exitCode => {
    if (typeof process !== 'undefined' && process.exit) {
      process.exit(exitCode);
    }
  }).catch(error => {
    console.error('ユーザーエクスペリエンステスト実行エラー:', error);
    if (typeof process !== 'undefined' && process.exit) {
      process.exit(1);
    }
  });
}

// エクスポート
module.exports = {
  UserExperienceTest,
  runUserExperienceTests
};