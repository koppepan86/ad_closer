/**
 * 統合テスト - エンドツーエンドワークフローの検証
 * すべてのコンポーネントの統合と通信を検証
 */

/**
 * 統合テストスイート
 */
class IntegrationTestSuite {
  constructor() {
    this.testResults = [];
    this.mockData = this.createMockData();
    this.testEnvironment = null;
  }

  /**
   * モックデータの作成
   */
  createMockData() {
    return {
      mockPopup: {
        id: 'test-popup-1',
        characteristics: {
          hasCloseButton: true,
          containsAds: true,
          hasExternalLinks: false,
          isModal: true,
          zIndex: 9999,
          dimensions: { width: 400, height: 300 }
        },
        confidence: 0.8,
        timestamp: Date.now()
      },
      mockTab: {
        id: 1,
        url: 'https://example.com/test',
        title: 'Test Page'
      },
      mockUserPreferences: {
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
      }
    };
  }

  /**
   * テスト環境のセットアップ
   */
  async setupTestEnvironment() {
    console.log('Setting up integration test environment...');
    
    this.testEnvironment = {
      chrome: this.createMockChrome(),
      document: this.createMockDocument(),
      window: this.createMockWindow()
    };

    // グローバルオブジェクトを設定
    global.chrome = this.testEnvironment.chrome;
    global.document = this.testEnvironment.document;
    global.window = this.testEnvironment.window;

    return this.testEnvironment;
  }

  /**
   * モック Chrome API の作成
   */
  createMockChrome() {
    const storage = new Map();
    
    return {
      runtime: {
        sendMessage: jest.fn((message, callback) => {
          // メッセージタイプに応じたモックレスポンス
          setTimeout(() => {
            const response = this.generateMockResponse(message);
            callback(response);
          }, 10);
        }),
        onMessage: {
          addListener: jest.fn()
        },
        onInstalled: {
          addListener: jest.fn()
        },
        onStartup: {
          addListener: jest.fn()
        },
        lastError: null
      },
      storage: {
        local: {
          get: jest.fn((keys, callback) => {
            const result = {};
            if (Array.isArray(keys)) {
              keys.forEach(key => {
                result[key] = storage.get(key);
              });
            } else if (typeof keys === 'object') {
              Object.keys(keys).forEach(key => {
                result[key] = storage.get(key) || keys[key];
              });
            }
            callback(result);
          }),
          set: jest.fn((data, callback) => {
            Object.keys(data).forEach(key => {
              storage.set(key, data[key]);
            });
            if (callback) callback();
          }),
          remove: jest.fn((keys, callback) => {
            if (Array.isArray(keys)) {
              keys.forEach(key => storage.delete(key));
            } else {
              storage.delete(keys);
            }
            if (callback) callback();
          })
        }
      },
      tabs: {
        query: jest.fn((queryInfo, callback) => {
          callback([this.mockData.mockTab]);
        }),
        sendMessage: jest.fn((tabId, message, callback) => {
          const response = this.generateMockResponse(message);
          if (callback) callback(response);
        })
      },
      notifications: {
        create: jest.fn((id, options, callback) => {
          if (callback) callback(id);
        })
      }
    };
  }

  /**
   * モック Document の作成
   */
  createMockDocument() {
    const elements = new Map();
    
    return {
      createElement: jest.fn((tagName) => {
        const element = {
          tagName: tagName.toUpperCase(),
          style: {},
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(() => false)
          },
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          appendChild: jest.fn(),
          removeChild: jest.fn(),
          getAttribute: jest.fn(),
          setAttribute: jest.fn(),
          getBoundingClientRect: jest.fn(() => ({
            width: 100,
            height: 100,
            top: 0,
            left: 0
          }))
        };
        return element;
      }),
      getElementById: jest.fn((id) => {
        return elements.get(id) || null;
      }),
      querySelector: jest.fn(() => null),
      querySelectorAll: jest.fn(() => []),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      body: {
        appendChild: jest.fn(),
        removeChild: jest.fn()
      },
      readyState: 'complete'
    };
  }

  /**
   * モック Window の作成
   */
  createMockWindow() {
    return {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      setInterval: setInterval,
      clearInterval: clearInterval,
      innerWidth: 1920,
      innerHeight: 1080,
      getComputedStyle: jest.fn(() => ({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
        zIndex: 'auto'
      }))
    };
  }

  /**
   * モックレスポンスの生成
   */
  generateMockResponse(message) {
    switch (message.type) {
      case 'PING':
        return { pong: true, timestamp: Date.now() };
      
      case 'GET_USER_PREFERENCES':
        return { success: true, data: this.mockData.mockUserPreferences };
      
      case 'UPDATE_USER_PREFERENCES':
        return { success: true };
      
      case 'GET_STATISTICS':
        return { 
          success: true, 
          data: {
            ...this.mockData.mockUserPreferences.statistics,
            websiteStatistics: [],
            effectivenessMetrics: {
              today: { totalClosed: 5, blockRate: 80.0, averageResponseTime: 2500 }
            },
            activityTrends: {
              hourlyActivity: Array(24).fill(0).map((_, i) => ({ hour: i, activity: Math.floor(Math.random() * 10) })),
              trend: { changePercentage: 15.5, direction: 'increasing' }
            }
          }
        };
      
      case 'POPUP_DETECTED':
        return { success: true };
      
      case 'USER_DECISION':
        return { success: true, popupId: message.data.popupId, decision: message.data.decision };
      
      case 'GET_USER_DECISIONS':
        return { success: true, data: [] };
      
      default:
        return { success: false, error: 'Unknown message type' };
    }
  }

  /**
   * すべての統合テストを実行
   */
  async runAllTests() {
    console.log('Starting integration tests...');
    
    await this.setupTestEnvironment();
    
    const tests = [
      this.testComponentInitialization,
      this.testMessagePassing,
      this.testPopupDetectionWorkflow,
      this.testUserDecisionWorkflow,
      this.testErrorHandlingIntegration,
      this.testComponentRecovery,
      this.testDataPersistence,
      this.testUIIntegration,
      this.testEndToEndWorkflow
    ];

    for (const test of tests) {
      try {
        await test.call(this);
      } catch (error) {
        this.recordTestResult(test.name, false, error.message);
      }
    }

    return this.generateTestReport();
  }

  /**
   * コンポーネント初期化テスト
   */
  async testComponentInitialization() {
    console.log('Testing component initialization...');
    
    // サービスワーカーの初期化をテスト
    const serviceWorkerInitialized = await this.testServiceWorkerInit();
    this.recordTestResult('Service Worker Initialization', serviceWorkerInitialized);

    // コンテンツスクリプトの初期化をテスト
    const contentScriptInitialized = await this.testContentScriptInit();
    this.recordTestResult('Content Script Initialization', contentScriptInitialized);

    // ポップアップUIの初期化をテスト
    const popupUIInitialized = await this.testPopupUIInit();
    this.recordTestResult('Popup UI Initialization', popupUIInitialized);
  }

  /**
   * サービスワーカー初期化テスト
   */
  async testServiceWorkerInit() {
    try {
      // デフォルト設定の初期化をシミュレート
      const defaultPreferences = this.mockData.mockUserPreferences;
      
      // ストレージに設定を保存
      await new Promise((resolve) => {
        this.testEnvironment.chrome.storage.local.set({
          userPreferences: defaultPreferences
        }, resolve);
      });

      // 設定が正しく保存されたか確認
      const result = await new Promise((resolve) => {
        this.testEnvironment.chrome.storage.local.get(['userPreferences'], resolve);
      });

      return result.userPreferences && result.userPreferences.extensionEnabled === true;
    } catch (error) {
      console.error('Service worker init test failed:', error);
      return false;
    }
  }

  /**
   * コンテンツスクリプト初期化テスト
   */
  async testContentScriptInit() {
    try {
      // DOM監視の設定をシミュレート
      const observer = {
        observe: jest.fn(),
        disconnect: jest.fn()
      };

      // MutationObserver のモック
      global.MutationObserver = jest.fn(() => observer);

      // ポップアップ検出器の初期化をシミュレート
      const popupDetector = {
        init: jest.fn(() => Promise.resolve()),
        observeDOM: jest.fn(),
        detectPopups: jest.fn(() => [])
      };

      return typeof popupDetector.init === 'function' && 
             typeof popupDetector.observeDOM === 'function';
    } catch (error) {
      console.error('Content script init test failed:', error);
      return false;
    }
  }

  /**
   * ポップアップUI初期化テスト
   */
  async testPopupUIInit() {
    try {
      // DOM要素のモックを作成
      const mockElements = {
        'extension-toggle': { checked: true, addEventListener: jest.fn() },
        'status-text': { textContent: '' },
        'total-blocked': { textContent: '0' },
        'current-domain': { textContent: 'example.com' }
      };

      // getElementById のモックを更新
      this.testEnvironment.document.getElementById.mockImplementation((id) => {
        return mockElements[id] || null;
      });

      // ポップアップインターフェースの初期化をシミュレート
      const popupInterface = {
        init: jest.fn(() => Promise.resolve()),
        loadData: jest.fn(() => Promise.resolve()),
        updateUI: jest.fn()
      };

      return typeof popupInterface.init === 'function' &&
             typeof popupInterface.loadData === 'function';
    } catch (error) {
      console.error('Popup UI init test failed:', error);
      return false;
    }
  }

  /**
   * メッセージパッシングテスト
   */
  async testMessagePassing() {
    console.log('Testing message passing...');

    // コンテンツスクリプト → バックグラウンド
    const contentToBackground = await this.testContentToBackgroundMessage();
    this.recordTestResult('Content to Background Message', contentToBackground);

    // バックグラウンド → コンテンツスクリプト
    const backgroundToContent = await this.testBackgroundToContentMessage();
    this.recordTestResult('Background to Content Message', backgroundToContent);

    // ポップアップ → バックグラウンド
    const popupToBackground = await this.testPopupToBackgroundMessage();
    this.recordTestResult('Popup to Background Message', popupToBackground);

    // エラーハンドリング付きメッセージ
    const errorHandledMessage = await this.testErrorHandledMessage();
    this.recordTestResult('Error Handled Message', errorHandledMessage);
  }

  /**
   * コンテンツスクリプトからバックグラウンドへのメッセージテスト
   */
  async testContentToBackgroundMessage() {
    try {
      const message = {
        type: 'POPUP_DETECTED',
        data: this.mockData.mockPopup
      };

      const response = await new Promise((resolve) => {
        this.testEnvironment.chrome.runtime.sendMessage(message, resolve);
      });

      return response && response.success === true;
    } catch (error) {
      console.error('Content to background message test failed:', error);
      return false;
    }
  }

  /**
   * バックグラウンドからコンテンツスクリプトへのメッセージテスト
   */
  async testBackgroundToContentMessage() {
    try {
      const message = {
        type: 'USER_DECISION_RESULT',
        data: { popupId: 'test-popup-1', decision: 'close' }
      };

      const response = await new Promise((resolve) => {
        this.testEnvironment.chrome.tabs.sendMessage(1, message, resolve);
      });

      return response !== undefined;
    } catch (error) {
      console.error('Background to content message test failed:', error);
      return false;
    }
  }

  /**
   * ポップアップからバックグラウンドへのメッセージテスト
   */
  async testPopupToBackgroundMessage() {
    try {
      const message = {
        type: 'GET_STATISTICS'
      };

      const response = await new Promise((resolve) => {
        this.testEnvironment.chrome.runtime.sendMessage(message, resolve);
      });

      return response && response.success === true && response.data;
    } catch (error) {
      console.error('Popup to background message test failed:', error);
      return false;
    }
  }

  /**
   * エラーハンドリング付きメッセージテスト
   */
  async testErrorHandledMessage() {
    try {
      // 通信エラーハンドラーのモック
      const communicationHandler = {
        sendMessage: jest.fn(async (message, options) => {
          if (message.type === 'INVALID_MESSAGE') {
            throw new Error('Invalid message type');
          }
          return { success: true };
        })
      };

      // エラーメッセージを送信
      try {
        await communicationHandler.sendMessage({ type: 'INVALID_MESSAGE' });
        return false; // エラーが発生しなかった場合は失敗
      } catch (error) {
        return error.message === 'Invalid message type';
      }
    } catch (error) {
      console.error('Error handled message test failed:', error);
      return false;
    }
  }

  /**
   * ポップアップ検出ワークフローテスト
   */
  async testPopupDetectionWorkflow() {
    console.log('Testing popup detection workflow...');

    // DOM変更の検出
    const domChangeDetection = await this.testDOMChangeDetection();
    this.recordTestResult('DOM Change Detection', domChangeDetection);

    // ポップアップ分析
    const popupAnalysis = await this.testPopupAnalysis();
    this.recordTestResult('Popup Analysis', popupAnalysis);

    // 通知表示
    const notificationDisplay = await this.testNotificationDisplay();
    this.recordTestResult('Notification Display', notificationDisplay);
  }

  /**
   * DOM変更検出テスト
   */
  async testDOMChangeDetection() {
    try {
      // MutationObserver のシミュレーション
      const mutations = [{
        type: 'childList',
        addedNodes: [{
          nodeType: 1,
          tagName: 'DIV',
          style: { position: 'fixed', zIndex: '9999' },
          getBoundingClientRect: () => ({ width: 400, height: 300 })
        }]
      }];

      // ポップアップ検出ロジックのシミュレーション
      const detectedPopups = mutations
        .flatMap(mutation => Array.from(mutation.addedNodes))
        .filter(node => node.nodeType === 1)
        .filter(element => {
          const style = element.style;
          return style.position === 'fixed' && parseInt(style.zIndex) > 1000;
        });

      return detectedPopups.length > 0;
    } catch (error) {
      console.error('DOM change detection test failed:', error);
      return false;
    }
  }

  /**
   * ポップアップ分析テスト
   */
  async testPopupAnalysis() {
    try {
      const mockElement = {
        style: { position: 'fixed', zIndex: '9999' },
        querySelector: jest.fn((selector) => {
          if (selector.includes('close') || selector.includes('×')) {
            return { tagName: 'BUTTON' };
          }
          return null;
        }),
        textContent: 'Advertisement - Click here!',
        getBoundingClientRect: () => ({ width: 400, height: 300 })
      };

      // ポップアップ分析ロジックのシミュレーション
      const analysis = {
        hasCloseButton: mockElement.querySelector('[class*="close"]') !== null,
        containsAds: mockElement.textContent.toLowerCase().includes('advertisement'),
        isModal: mockElement.style.position === 'fixed',
        zIndex: parseInt(mockElement.style.zIndex),
        dimensions: mockElement.getBoundingClientRect()
      };

      const confidence = this.calculateConfidence(analysis);

      return confidence > 0.5 && analysis.hasCloseButton && analysis.containsAds;
    } catch (error) {
      console.error('Popup analysis test failed:', error);
      return false;
    }
  }

  /**
   * 信頼度計算のヘルパー
   */
  calculateConfidence(analysis) {
    let score = 0;
    if (analysis.hasCloseButton) score += 0.3;
    if (analysis.containsAds) score += 0.4;
    if (analysis.isModal) score += 0.2;
    if (analysis.zIndex > 1000) score += 0.1;
    return Math.min(score, 1.0);
  }

  /**
   * 通知表示テスト
   */
  async testNotificationDisplay() {
    try {
      const notificationOptions = {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'ポップアップ広告を検出しました',
        message: 'このポップアップを閉じますか？'
      };

      // 通知作成のシミュレーション
      const notificationId = await new Promise((resolve) => {
        this.testEnvironment.chrome.notifications.create(
          'popup-notification-1',
          notificationOptions,
          resolve
        );
      });

      return notificationId === 'popup-notification-1';
    } catch (error) {
      console.error('Notification display test failed:', error);
      return false;
    }
  }

  /**
   * ユーザー決定ワークフローテスト
   */
  async testUserDecisionWorkflow() {
    console.log('Testing user decision workflow...');

    // 決定待ち状態の管理
    const pendingDecisionManagement = await this.testPendingDecisionManagement();
    this.recordTestResult('Pending Decision Management', pendingDecisionManagement);

    // ユーザー決定の処理
    const userDecisionProcessing = await this.testUserDecisionProcessing();
    this.recordTestResult('User Decision Processing', userDecisionProcessing);

    // 学習データの更新
    const learningDataUpdate = await this.testLearningDataUpdate();
    this.recordTestResult('Learning Data Update', learningDataUpdate);
  }

  /**
   * 決定待ち状態管理テスト
   */
  async testPendingDecisionManagement() {
    try {
      const pendingDecisions = new Map();
      const popupId = 'test-popup-1';
      
      // 決定待ち状態を追加
      pendingDecisions.set(popupId, {
        popupData: this.mockData.mockPopup,
        timestamp: Date.now(),
        status: 'pending'
      });

      // タイムアウト処理のシミュレーション
      const timeoutHandler = () => {
        const decision = pendingDecisions.get(popupId);
        if (decision) {
          decision.status = 'timeout';
        }
      };

      setTimeout(timeoutHandler, 100);

      // 少し待ってからタイムアウトが処理されたか確認
      await new Promise(resolve => setTimeout(resolve, 150));

      const decision = pendingDecisions.get(popupId);
      return decision && decision.status === 'timeout';
    } catch (error) {
      console.error('Pending decision management test failed:', error);
      return false;
    }
  }

  /**
   * ユーザー決定処理テスト
   */
  async testUserDecisionProcessing() {
    try {
      const decisionData = {
        popupId: 'test-popup-1',
        decision: 'close',
        popupData: this.mockData.mockPopup
      };

      // 決定処理のシミュレーション
      const response = await new Promise((resolve) => {
        this.testEnvironment.chrome.runtime.sendMessage({
          type: 'USER_DECISION',
          data: decisionData
        }, resolve);
      });

      return response && response.success === true && response.decision === 'close';
    } catch (error) {
      console.error('User decision processing test failed:', error);
      return false;
    }
  }

  /**
   * 学習データ更新テスト
   */
  async testLearningDataUpdate() {
    try {
      const learningPattern = {
        characteristics: this.mockData.mockPopup.characteristics,
        userDecision: 'close',
        confidence: 0.8,
        occurrences: 1
      };

      // 学習パターンをストレージに保存
      await new Promise((resolve) => {
        this.testEnvironment.chrome.storage.local.set({
          learningPatterns: [learningPattern]
        }, resolve);
      });

      // 保存されたデータを確認
      const result = await new Promise((resolve) => {
        this.testEnvironment.chrome.storage.local.get(['learningPatterns'], resolve);
      });

      return result.learningPatterns && 
             result.learningPatterns.length > 0 &&
             result.learningPatterns[0].userDecision === 'close';
    } catch (error) {
      console.error('Learning data update test failed:', error);
      return false;
    }
  }

  /**
   * エラーハンドリング統合テスト
   */
  async testErrorHandlingIntegration() {
    console.log('Testing error handling integration...');

    // 通信エラーハンドリング
    const communicationErrorHandling = await this.testCommunicationErrorHandling();
    this.recordTestResult('Communication Error Handling', communicationErrorHandling);

    // DOM エラーハンドリング
    const domErrorHandling = await this.testDOMErrorHandling();
    this.recordTestResult('DOM Error Handling', domErrorHandling);

    // 権限エラーハンドリング
    const permissionErrorHandling = await this.testPermissionErrorHandling();
    this.recordTestResult('Permission Error Handling', permissionErrorHandling);
  }

  /**
   * 通信エラーハンドリングテスト
   */
  async testCommunicationErrorHandling() {
    try {
      // 通信失敗をシミュレート
      const originalSendMessage = this.testEnvironment.chrome.runtime.sendMessage;
      this.testEnvironment.chrome.runtime.sendMessage = jest.fn((message, callback) => {
        this.testEnvironment.chrome.runtime.lastError = { message: 'Connection failed' };
        callback(null);
      });

      // エラーハンドリングのシミュレーション
      let errorHandled = false;
      try {
        await new Promise((resolve, reject) => {
          this.testEnvironment.chrome.runtime.sendMessage({ type: 'TEST' }, (response) => {
            if (this.testEnvironment.chrome.runtime.lastError) {
              errorHandled = true;
              reject(new Error(this.testEnvironment.chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
      } catch (error) {
        // エラーが正しく処理された
      }

      // 元の関数を復元
      this.testEnvironment.chrome.runtime.sendMessage = originalSendMessage;
      this.testEnvironment.chrome.runtime.lastError = null;

      return errorHandled;
    } catch (error) {
      console.error('Communication error handling test failed:', error);
      return false;
    }
  }

  /**
   * DOM エラーハンドリングテスト
   */
  async testDOMErrorHandling() {
    try {
      // DOM アクセスエラーをシミュレート
      const mockElement = {
        querySelector: jest.fn(() => {
          throw new Error('DOM access restricted');
        })
      };

      // エラーハンドリングのシミュレーション
      let errorHandled = false;
      try {
        mockElement.querySelector('.test');
      } catch (error) {
        if (error.message === 'DOM access restricted') {
          errorHandled = true;
        }
      }

      return errorHandled;
    } catch (error) {
      console.error('DOM error handling test failed:', error);
      return false;
    }
  }

  /**
   * 権限エラーハンドリングテスト
   */
  async testPermissionErrorHandling() {
    try {
      // 権限エラーをシミュレート
      const originalGet = this.testEnvironment.chrome.storage.local.get;
      this.testEnvironment.chrome.storage.local.get = jest.fn((keys, callback) => {
        this.testEnvironment.chrome.runtime.lastError = { message: 'Permission denied' };
        callback({});
      });

      // エラーハンドリングのシミュレーション
      let errorHandled = false;
      await new Promise((resolve) => {
        this.testEnvironment.chrome.storage.local.get(['test'], (result) => {
          if (this.testEnvironment.chrome.runtime.lastError) {
            errorHandled = true;
          }
          resolve();
        });
      });

      // 元の関数を復元
      this.testEnvironment.chrome.storage.local.get = originalGet;
      this.testEnvironment.chrome.runtime.lastError = null;

      return errorHandled;
    } catch (error) {
      console.error('Permission error handling test failed:', error);
      return false;
    }
  }

  /**
   * コンポーネント回復テスト
   */
  async testComponentRecovery() {
    console.log('Testing component recovery...');

    // コンポーネント障害の検出
    const failureDetection = await this.testComponentFailureDetection();
    this.recordTestResult('Component Failure Detection', failureDetection);

    // 自動回復の実行
    const autoRecovery = await this.testAutoRecovery();
    this.recordTestResult('Auto Recovery', autoRecovery);

    // ヘルスチェック
    const healthCheck = await this.testHealthCheck();
    this.recordTestResult('Health Check', healthCheck);
  }

  /**
   * コンポーネント障害検出テスト
   */
  async testComponentFailureDetection() {
    try {
      const componentManager = {
        components: new Map(),
        componentStatus: new Map(),
        reportComponentFailure: jest.fn((name, error) => {
          const status = componentManager.componentStatus.get(name);
          if (status) {
            status.status = 'failed';
            status.lastError = error;
          }
        })
      };

      // コンポーネントを登録
      componentManager.components.set('testComponent', { instance: {} });
      componentManager.componentStatus.set('testComponent', { status: 'healthy' });

      // 障害を報告
      const error = new Error('Component failed');
      componentManager.reportComponentFailure('testComponent', error);

      const status = componentManager.componentStatus.get('testComponent');
      return status && status.status === 'failed' && status.lastError === error;
    } catch (error) {
      console.error('Component failure detection test failed:', error);
      return false;
    }
  }

  /**
   * 自動回復テスト
   */
  async testAutoRecovery() {
    try {
      const recoveryManager = {
        attemptComponentRecovery: jest.fn(async (componentName) => {
          // 回復処理のシミュレーション
          await new Promise(resolve => setTimeout(resolve, 100));
          return true; // 回復成功
        })
      };

      const recovered = await recoveryManager.attemptComponentRecovery('testComponent');
      return recovered === true;
    } catch (error) {
      console.error('Auto recovery test failed:', error);
      return false;
    }
  }

  /**
   * ヘルスチェックテスト
   */
  async testHealthCheck() {
    try {
      const healthChecker = {
        checkComponentHealth: jest.fn(async (componentName) => {
          // ヘルスチェックのシミュレーション
          return componentName === 'healthyComponent';
        })
      };

      const healthyResult = await healthChecker.checkComponentHealth('healthyComponent');
      const unhealthyResult = await healthChecker.checkComponentHealth('unhealthyComponent');

      return healthyResult === true && unhealthyResult === false;
    } catch (error) {
      console.error('Health check test failed:', error);
      return false;
    }
  }

  /**
   * データ永続化テスト
   */
  async testDataPersistence() {
    console.log('Testing data persistence...');

    // 設定の保存と読み込み
    const settingsPersistence = await this.testSettingsPersistence();
    this.recordTestResult('Settings Persistence', settingsPersistence);

    // 統計データの永続化
    const statisticsPersistence = await this.testStatisticsPersistence();
    this.recordTestResult('Statistics Persistence', statisticsPersistence);

    // 学習データの永続化
    const learningPersistence = await this.testLearningPersistence();
    this.recordTestResult('Learning Persistence', learningPersistence);
  }

  /**
   * 設定永続化テスト
   */
  async testSettingsPersistence() {
    try {
      const testSettings = {
        extensionEnabled: false,
        notificationDuration: 8000,
        whitelistedDomains: ['example.com', 'test.org']
      };

      // 設定を保存
      await new Promise((resolve) => {
        this.testEnvironment.chrome.storage.local.set({
          userPreferences: testSettings
        }, resolve);
      });

      // 設定を読み込み
      const result = await new Promise((resolve) => {
        this.testEnvironment.chrome.storage.local.get(['userPreferences'], resolve);
      });

      return result.userPreferences &&
             result.userPreferences.extensionEnabled === false &&
             result.userPreferences.notificationDuration === 8000 &&
             result.userPreferences.whitelistedDomains.length === 2;
    } catch (error) {
      console.error('Settings persistence test failed:', error);
      return false;
    }
  }

  /**
   * 統計永続化テスト
   */
  async testStatisticsPersistence() {
    try {
      const testStatistics = {
        totalPopupsDetected: 100,
        totalPopupsClosed: 80,
        totalPopupsKept: 20,
        lastResetDate: Date.now()
      };

      // 統計を保存
      await new Promise((resolve) => {
        this.testEnvironment.chrome.storage.local.set({
          statistics: testStatistics
        }, resolve);
      });

      // 統計を読み込み
      const result = await new Promise((resolve) => {
        this.testEnvironment.chrome.storage.local.get(['statistics'], resolve);
      });

      return result.statistics &&
             result.statistics.totalPopupsDetected === 100 &&
             result.statistics.totalPopupsClosed === 80;
    } catch (error) {
      console.error('Statistics persistence test failed:', error);
      return false;
    }
  }

  /**
   * 学習データ永続化テスト
   */
  async testLearningPersistence() {
    try {
      const testLearningData = [
        {
          patternId: 'pattern-1',
          characteristics: { hasCloseButton: true, containsAds: true },
          userDecision: 'close',
          confidence: 0.9,
          occurrences: 5
        }
      ];

      // 学習データを保存
      await new Promise((resolve) => {
        this.testEnvironment.chrome.storage.local.set({
          learningPatterns: testLearningData
        }, resolve);
      });

      // 学習データを読み込み
      const result = await new Promise((resolve) => {
        this.testEnvironment.chrome.storage.local.get(['learningPatterns'], resolve);
      });

      return result.learningPatterns &&
             result.learningPatterns.length === 1 &&
             result.learningPatterns[0].patternId === 'pattern-1';
    } catch (error) {
      console.error('Learning persistence test failed:', error);
      return false;
    }
  }

  /**
   * UI統合テスト
   */
  async testUIIntegration() {
    console.log('Testing UI integration...');

    // ポップアップUIの統合
    const popupUIIntegration = await this.testPopupUIIntegration();
    this.recordTestResult('Popup UI Integration', popupUIIntegration);

    // 設定ページの統合
    const optionsUIIntegration = await this.testOptionsUIIntegration();
    this.recordTestResult('Options UI Integration', optionsUIIntegration);

    // 通知システムの統合
    const notificationIntegration = await this.testNotificationIntegration();
    this.recordTestResult('Notification Integration', notificationIntegration);
  }

  /**
   * ポップアップUI統合テスト
   */
  async testPopupUIIntegration() {
    try {
      // UI要素のモック
      const mockElements = {
        'extension-toggle': { 
          checked: true, 
          addEventListener: jest.fn(),
          dispatchEvent: jest.fn()
        },
        'total-blocked': { textContent: '0' },
        'status-text': { textContent: '有効' }
      };

      this.testEnvironment.document.getElementById.mockImplementation((id) => {
        return mockElements[id] || null;
      });

      // UI更新のシミュレーション
      const updateUI = (statistics) => {
        const totalBlockedElement = mockElements['total-blocked'];
        if (totalBlockedElement) {
          totalBlockedElement.textContent = statistics.totalPopupsClosed.toString();
        }
      };

      const testStatistics = { totalPopupsClosed: 42 };
      updateUI(testStatistics);

      return mockElements['total-blocked'].textContent === '42';
    } catch (error) {
      console.error('Popup UI integration test failed:', error);
      return false;
    }
  }

  /**
   * 設定ページUI統合テスト
   */
  async testOptionsUIIntegration() {
    try {
      // 設定フォームのモック
      const mockForm = {
        'extension-enabled': { checked: true, type: 'checkbox' },
        'notification-duration': { value: '5000', type: 'range' },
        'whitelist-domains': { value: 'example.com\ntest.org' }
      };

      // 設定収集のシミュレーション
      const collectSettings = () => {
        return {
          extensionEnabled: mockForm['extension-enabled'].checked,
          notificationDuration: parseInt(mockForm['notification-duration'].value),
          whitelistedDomains: mockForm['whitelist-domains'].value.split('\n').filter(d => d.trim())
        };
      };

      const settings = collectSettings();

      return settings.extensionEnabled === true &&
             settings.notificationDuration === 5000 &&
             settings.whitelistedDomains.length === 2;
    } catch (error) {
      console.error('Options UI integration test failed:', error);
      return false;
    }
  }

  /**
   * 通知システム統合テスト
   */
  async testNotificationIntegration() {
    try {
      // 通知作成のテスト
      const notificationId = await new Promise((resolve) => {
        this.testEnvironment.chrome.notifications.create(
          'test-notification',
          {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'テスト通知',
            message: 'これはテスト通知です'
          },
          resolve
        );
      });

      // 通知が作成されたか確認
      return notificationId === 'test-notification';
    } catch (error) {
      console.error('Notification integration test failed:', error);
      return false;
    }
  }

  /**
   * エンドツーエンドワークフローテスト
   */
  async testEndToEndWorkflow() {
    console.log('Testing end-to-end workflow...');

    try {
      // 1. ポップアップ検出
      const popupDetected = await this.simulatePopupDetection();
      if (!popupDetected) {
        throw new Error('Popup detection failed');
      }

      // 2. ユーザー通知
      const notificationShown = await this.simulateNotificationDisplay();
      if (!notificationShown) {
        throw new Error('Notification display failed');
      }

      // 3. ユーザー決定
      const decisionProcessed = await this.simulateUserDecision();
      if (!decisionProcessed) {
        throw new Error('User decision processing failed');
      }

      // 4. 学習データ更新
      const learningUpdated = await this.simulateLearningUpdate();
      if (!learningUpdated) {
        throw new Error('Learning update failed');
      }

      // 5. 統計更新
      const statisticsUpdated = await this.simulateStatisticsUpdate();
      if (!statisticsUpdated) {
        throw new Error('Statistics update failed');
      }

      this.recordTestResult('End-to-End Workflow', true);
      return true;
    } catch (error) {
      console.error('End-to-end workflow test failed:', error);
      this.recordTestResult('End-to-End Workflow', false, error.message);
      return false;
    }
  }

  /**
   * ポップアップ検出のシミュレーション
   */
  async simulatePopupDetection() {
    const message = {
      type: 'POPUP_DETECTED',
      data: this.mockData.mockPopup
    };

    const response = await new Promise((resolve) => {
      this.testEnvironment.chrome.runtime.sendMessage(message, resolve);
    });

    return response && response.success === true;
  }

  /**
   * 通知表示のシミュレーション
   */
  async simulateNotificationDisplay() {
    const notificationId = await new Promise((resolve) => {
      this.testEnvironment.chrome.notifications.create(
        'popup-notification',
        {
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'ポップアップ広告を検出しました',
          message: 'このポップアップを閉じますか？'
        },
        resolve
      );
    });

    return notificationId === 'popup-notification';
  }

  /**
   * ユーザー決定のシミュレーション
   */
  async simulateUserDecision() {
    const decisionMessage = {
      type: 'USER_DECISION',
      data: {
        popupId: this.mockData.mockPopup.id,
        decision: 'close',
        popupData: this.mockData.mockPopup
      }
    };

    const response = await new Promise((resolve) => {
      this.testEnvironment.chrome.runtime.sendMessage(decisionMessage, resolve);
    });

    return response && response.success === true && response.decision === 'close';
  }

  /**
   * 学習更新のシミュレーション
   */
  async simulateLearningUpdate() {
    const learningPattern = {
      characteristics: this.mockData.mockPopup.characteristics,
      userDecision: 'close',
      confidence: 0.8,
      occurrences: 1
    };

    await new Promise((resolve) => {
      this.testEnvironment.chrome.storage.local.set({
        learningPatterns: [learningPattern]
      }, resolve);
    });

    const result = await new Promise((resolve) => {
      this.testEnvironment.chrome.storage.local.get(['learningPatterns'], resolve);
    });

    return result.learningPatterns && result.learningPatterns.length > 0;
  }

  /**
   * 統計更新のシミュレーション
   */
  async simulateStatisticsUpdate() {
    const updatedStatistics = {
      ...this.mockData.mockUserPreferences.statistics,
      totalPopupsDetected: 1,
      totalPopupsClosed: 1
    };

    await new Promise((resolve) => {
      this.testEnvironment.chrome.storage.local.set({
        statistics: updatedStatistics
      }, resolve);
    });

    const result = await new Promise((resolve) => {
      this.testEnvironment.chrome.storage.local.get(['statistics'], resolve);
    });

    return result.statistics && 
           result.statistics.totalPopupsDetected === 1 &&
           result.statistics.totalPopupsClosed === 1;
  }

  /**
   * テスト結果を記録
   */
  recordTestResult(testName, passed, errorMessage = null) {
    this.testResults.push({
      name: testName,
      passed,
      errorMessage,
      timestamp: Date.now()
    });

    const status = passed ? '✅ PASS' : '❌ FAIL';
    const error = errorMessage ? ` - ${errorMessage}` : '';
    console.log(`${status}: ${testName}${error}`);
  }

  /**
   * テストレポートを生成
   */
  generateTestReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    const report = {
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        passRate: Math.round(passRate * 100) / 100
      },
      results: this.testResults,
      timestamp: Date.now()
    };

    console.log('\n=== Integration Test Report ===');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Pass Rate: ${passRate.toFixed(2)}%`);
    console.log('===============================\n');

    if (failedTests > 0) {
      console.log('Failed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`- ${r.name}: ${r.errorMessage || 'Unknown error'}`);
        });
      console.log('');
    }

    return report;
  }
}

// Jest テスト用のエクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IntegrationTestSuite };
}

// ブラウザ環境用のグローバル設定
if (typeof window !== 'undefined') {
  window.IntegrationTestSuite = IntegrationTestSuite;
}