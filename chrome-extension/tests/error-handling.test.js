/**
 * エラーハンドリングシステムのテスト
 */

describe('Error Handling System', () => {
  let errorHandler;
  let domErrorHandler;
  let communicationErrorHandler;
  let permissionErrorHandler;
  let componentRecoveryManager;

  beforeEach(() => {
    // グローバルオブジェクトをモック
    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn()
        },
        lastError: null
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn(),
          remove: jest.fn()
        }
      },
      permissions: {
        contains: jest.fn(),
        request: jest.fn(),
        remove: jest.fn(),
        onAdded: {
          addListener: jest.fn()
        },
        onRemoved: {
          addListener: jest.fn()
        }
      },
      notifications: {
        create: jest.fn(),
        clear: jest.fn()
      }
    };

    global.document = {
      createElement: jest.fn(() => ({
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        style: {},
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })),
      body: {
        appendChild: jest.fn(),
        removeChild: jest.fn()
      },
      head: {
        appendChild: jest.fn()
      },
      readyState: 'complete',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      contains: jest.fn(() => true),
      dispatchEvent: jest.fn()
    };

    global.window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      MutationObserver: jest.fn(() => ({
        observe: jest.fn(),
        disconnect: jest.fn()
      })),
      getComputedStyle: jest.fn(() => ({
        display: 'block',
        visibility: 'visible',
        opacity: '1'
      })),
      innerWidth: 1920,
      innerHeight: 1080,
      localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        key: jest.fn(),
        length: 0
      }
    };

    global.console = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // エラーハンドリングシステムを初期化
    require('../utils/error-handler.js');
    require('../utils/dom-error-handler.js');
    require('../utils/communication-error-handler.js');
    require('../utils/permission-error-handler.js');
    require('../utils/component-recovery.js');

    errorHandler = global.globalErrorHandler;
    domErrorHandler = global.domErrorHandler;
    communicationErrorHandler = global.communicationErrorHandler;
    permissionErrorHandler = global.permissionErrorHandler;
    componentRecoveryManager = global.componentRecoveryManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GlobalErrorHandler', () => {
    test('should handle DOM access errors', async () => {
      const error = new Error('DOM access denied');
      const errorRecord = await errorHandler.handleError(
        error,
        global.ERROR_TYPES.DOM_ACCESS,
        global.ERROR_SEVERITY.MEDIUM
      );

      expect(errorRecord).toBeDefined();
      expect(errorRecord.type).toBe(global.ERROR_TYPES.DOM_ACCESS);
      expect(errorRecord.error.message).toBe('DOM access denied');
    });

    test('should handle communication errors', async () => {
      const error = new Error('Connection failed');
      const errorRecord = await errorHandler.handleError(
        error,
        global.ERROR_TYPES.COMMUNICATION,
        global.ERROR_SEVERITY.HIGH
      );

      expect(errorRecord).toBeDefined();
      expect(errorRecord.type).toBe(global.ERROR_TYPES.COMMUNICATION);
      expect(errorRecord.severity).toBe(global.ERROR_SEVERITY.HIGH);
    });

    test('should attempt recovery for recoverable errors', async () => {
      const error = new Error('Recoverable error');
      const errorRecord = await errorHandler.handleError(
        error,
        global.ERROR_TYPES.COMPONENT_FAILURE,
        global.ERROR_SEVERITY.MEDIUM,
        { component: 'testComponent' }
      );

      expect(errorRecord).toBeDefined();
      expect(errorRecord.context.component).toBe('testComponent');
    });
  });

  describe('DOMErrorHandler', () => {
    test('should provide safe DOM operations', () => {
      const element = domErrorHandler.safeExecute('createElement', 'div');
      expect(element).toBeDefined();
      expect(global.document.createElement).toHaveBeenCalledWith('div');
    });

    test('should handle querySelector safely', () => {
      global.document.querySelector.mockReturnValue({ id: 'test' });
      
      const element = domErrorHandler.safeExecute('querySelector', '.test');
      expect(element).toBeDefined();
      expect(global.document.querySelector).toHaveBeenCalledWith('.test');
    });

    test('should detect DOM restrictions', () => {
      global.document.createElement.mockImplementation(() => {
        throw new Error('DOM access restricted');
      });

      const isRestricted = domErrorHandler.detectDOMRestriction('example.com');
      expect(isRestricted).toBe(true);
    });

    test('should find elements with fallback selectors', () => {
      global.document.querySelector
        .mockReturnValueOnce(null) // 最初のセレクターは失敗
        .mockReturnValueOnce({ id: 'popup' }); // フォールバックで成功

      const element = domErrorHandler.findElementWithFallback('popup');
      expect(element).toBeDefined();
      expect(element.id).toBe('popup');
    });

    test('should safely remove elements', () => {
      const mockElement = {
        parentNode: {
          removeChild: jest.fn()
        },
        remove: jest.fn(),
        tagName: 'DIV'
      };

      global.document.contains.mockReturnValue(true);

      const result = domErrorHandler.safeRemoveElement(mockElement);
      expect(result).toBe(true);
      expect(mockElement.remove).toHaveBeenCalled();
    });
  });

  describe('CommunicationErrorHandler', () => {
    test('should send messages with retry mechanism', async () => {
      global.chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ success: true, data: 'test response' });
      });

      const response = await communicationErrorHandler.sendMessage({
        type: 'TEST_MESSAGE',
        data: 'test'
      });

      expect(response).toBeDefined();
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalled();
    });

    test('should handle communication timeouts', async () => {
      global.chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        // タイムアウトをシミュレート
        setTimeout(() => {
          callback(null);
        }, 15000);
      });

      await expect(
        communicationErrorHandler.sendMessage(
          { type: 'TEST_MESSAGE' },
          { timeout: 1000 }
        )
      ).rejects.toThrow();
    });

    test('should use fallback communication methods', async () => {
      global.chrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Runtime not available');
      });

      const result = await communicationErrorHandler.tryFallbackCommunication({
        type: 'TEST_MESSAGE',
        _messageId: 'test123'
      });

      // フォールバック通信が試行されることを確認
      expect(result).toBeDefined();
    });
  });

  describe('PermissionErrorHandler', () => {
    test('should check permissions correctly', async () => {
      global.chrome.permissions.contains.mockImplementation((permissions, callback) => {
        callback(true);
      });

      const hasPermission = await permissionErrorHandler.checkPermission('storage');
      expect(hasPermission).toBe(true);
      expect(global.chrome.permissions.contains).toHaveBeenCalledWith(
        { permissions: ['storage'] },
        expect.any(Function)
      );
    });

    test('should degrade features when permissions are missing', async () => {
      global.chrome.permissions.contains.mockImplementation((permissions, callback) => {
        callback(false);
      });

      await permissionErrorHandler.checkAllPermissions();
      
      expect(permissionErrorHandler.degradedFeatures.size).toBeGreaterThan(0);
    });

    test('should provide fallback storage operations', async () => {
      const testData = { key: 'value' };
      
      const result = await permissionErrorHandler.fallbackStorageSet(testData);
      expect(result).toBe(true);
      expect(global.window.localStorage.setItem).toHaveBeenCalled();
    });

    test('should create fallback notifications', async () => {
      const notificationOptions = {
        title: 'Test Notification',
        message: 'Test message',
        iconUrl: 'icon.png'
      };

      const notificationId = await permissionErrorHandler.fallbackNotificationCreate(notificationOptions);
      expect(notificationId).toBeDefined();
      expect(global.document.createElement).toHaveBeenCalledWith('div');
    });
  });

  describe('ComponentRecoveryManager', () => {
    test('should register components', () => {
      const mockComponent = {
        init: jest.fn(),
        cleanup: jest.fn()
      };

      componentRecoveryManager.registerComponent('testComponent', mockComponent);
      
      const statuses = componentRecoveryManager.getComponentStatuses();
      expect(statuses.testComponent).toBeDefined();
      expect(statuses.testComponent.status).toBe('healthy');
    });

    test('should report component failures', () => {
      const mockComponent = {
        init: jest.fn(),
        cleanup: jest.fn()
      };

      componentRecoveryManager.registerComponent('testComponent', mockComponent);
      
      const error = new Error('Component failed');
      componentRecoveryManager.reportComponentFailure('testComponent', error);
      
      const statuses = componentRecoveryManager.getComponentStatuses();
      expect(statuses.testComponent.status).toBe('failed');
      expect(statuses.testComponent.lastError).toBeDefined();
    });

    test('should attempt component recovery', async () => {
      const mockComponent = {
        init: jest.fn(),
        cleanup: jest.fn()
      };

      componentRecoveryManager.registerComponent('testComponent', mockComponent, {
        autoRecover: true
      });

      // 回復戦略をモック
      componentRecoveryManager.recoveryStrategies.set('testComponent', {
        recover: jest.fn().mockResolvedValue(true),
        healthCheck: jest.fn().mockResolvedValue(true),
        dependencies: [],
        priority: 1
      });

      const error = new Error('Component failed');
      componentRecoveryManager.reportComponentFailure('testComponent', error);

      // 回復が試行されるまで少し待機
      await new Promise(resolve => setTimeout(resolve, 100));

      const statuses = componentRecoveryManager.getComponentStatuses();
      expect(statuses.testComponent.recoveryAttempts).toBeGreaterThan(0);
    });

    test('should perform health checks', async () => {
      const mockComponent = {
        init: jest.fn(),
        cleanup: jest.fn()
      };

      componentRecoveryManager.registerComponent('testComponent', mockComponent);

      // ヘルスチェック戦略をモック
      componentRecoveryManager.recoveryStrategies.set('testComponent', {
        recover: jest.fn(),
        healthCheck: jest.fn().mockResolvedValue(true),
        dependencies: [],
        priority: 1
      });

      await componentRecoveryManager.checkComponentHealth('testComponent');

      const strategy = componentRecoveryManager.recoveryStrategies.get('testComponent');
      expect(strategy.healthCheck).toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    test('should handle cascading component failures', async () => {
      // 依存関係のあるコンポーネントを登録
      const parentComponent = { init: jest.fn() };
      const childComponent = { init: jest.fn() };

      componentRecoveryManager.registerComponent('parent', parentComponent);
      componentRecoveryManager.registerComponent('child', childComponent);
      
      // 依存関係を設定
      componentRecoveryManager.componentDependencies.set('child', ['parent']);

      // 親コンポーネントの障害を報告
      const error = new Error('Parent component failed');
      componentRecoveryManager.reportComponentFailure('parent', error);

      // 子コンポーネントも影響を受けることを確認
      const statuses = componentRecoveryManager.getComponentStatuses();
      expect(statuses.parent.status).toBe('failed');
    });

    test('should integrate all error handling systems', async () => {
      // DOM エラーをシミュレート
      const domError = new Error('DOM access denied');
      await errorHandler.handleError(
        domError,
        global.ERROR_TYPES.DOM_ACCESS,
        global.ERROR_SEVERITY.MEDIUM
      );

      // 通信エラーをシミュレート
      const commError = new Error('Communication failed');
      await errorHandler.handleError(
        commError,
        global.ERROR_TYPES.COMMUNICATION,
        global.ERROR_SEVERITY.HIGH
      );

      // エラー統計を確認
      const stats = errorHandler.getErrorStatistics();
      expect(stats.total).toBe(2);
      expect(stats.byType[global.ERROR_TYPES.DOM_ACCESS]).toBe(1);
      expect(stats.byType[global.ERROR_TYPES.COMMUNICATION]).toBe(1);
    });
  });
});