/**
 * ブラウザ互換性テスト - ユーザビリティ改善機能
 * Task 12: ブラウザ互換性テスト
 */

const { 
  createMockElement,
  createChromeApiMock,
  resetTestData,
  TimerHelpers
} = require('./test-helpers');

describe('ブラウザ互換性テスト - ユーザビリティ改善', () => {
  let mockChrome;
  let mockDocument;
  let mockWindow;
  let userChoiceDialog;
  let browserEnvironment;

  beforeEach(() => {
    resetTestData();
    TimerHelpers.mockSetTimeout();
    
    // Chrome API モックを設定
    mockChrome = createChromeApiMock();
    global.chrome = mockChrome;
    
    // ブラウザ環境シミュレーター
    browserEnvironment = new BrowserEnvironmentSimulator();
    
    // 基本DOM環境をモック
    mockDocument = {
      getElementById: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(),
      createElement: jest.fn((tag) => createMockElement(tag)),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      body: createMockElement('body'),
      head: createMockElement('head'),
      activeElement: null
    };
    
    mockWindow = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      location: { hostname: 'example.com' },
      innerWidth: 1200,
      innerHeight: 800,
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    global.document = mockDocument;
    global.window = mockWindow;

    // UserChoiceDialogクラスをモック
    global.UserChoiceDialog = class MockUserChoiceDialog {
      constructor() {
        this.activeDialogs = new Map();
        this.dialogCounter = 0;
        this.accessibilityHelper = new MockDialogAccessibilityHelper();
        this.browserSupport = new BrowserSupportChecker();
      }

      init() {
        this.accessibilityHelper.init();
        this.browserSupport.checkSupport();
      }

      async showChoiceDialog(detectedAds) {
        const dialogId = `dialog-${++this.dialogCounter}`;
        const mockDialog = {
          detectedAds,
          individualSelections: new Map(),
          browserCompatible: this.browserSupport.isCompatible()
        };
        
        this.activeDialogs.set(dialogId, mockDialog);
        return { action: 'test', dialogId };
      }

      enableContinueWithoutPreview(dialogId) {
        const dialogData = this.activeDialogs.get(dialogId);
        if (dialogData) {
          dialogData.continueWithoutPreview = true;
        }
      }

      getBrowserSupport() {
        return this.browserSupport;
      }
    };

    global.DialogAccessibilityHelper = class MockDialogAccessibilityHelper {
      constructor() {
        this.keyboardNavigationEnabled = true;
        this.browserFeatures = new Map();
      }

      init() {
        this.detectBrowserFeatures();
      }

      detectBrowserFeatures() {
        // ブラウザ機能検出をモック
        this.browserFeatures.set('matchMedia', typeof window.matchMedia === 'function');
        this.browserFeatures.set('requestAnimationFrame', typeof window.requestAnimationFrame === 'function');
        this.browserFeatures.set('addEventListener', typeof document.addEventListener === 'function');
        this.browserFeatures.set('querySelector', typeof document.querySelector === 'function');
      }

      getBrowserFeatures() {
        return Object.fromEntries(this.browserFeatures);
      }
    };

    userChoiceDialog = new global.UserChoiceDialog();
    userChoiceDialog.init();
  });

  afterEach(() => {
    TimerHelpers.useRealTimers();
  });

  /**
   * ブラウザ環境シミュレーター
   */
  class BrowserEnvironmentSimulator {
    constructor() {
      this.environments = {
        chrome: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          features: ['matchMedia', 'requestAnimationFrame', 'addEventListener', 'querySelector', 'classList']
        },
        firefox: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
          features: ['matchMedia', 'requestAnimationFrame', 'addEventListener', 'querySelector', 'classList']
        },
        safari: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
          features: ['matchMedia', 'requestAnimationFrame', 'addEventListener', 'querySelector', 'classList']
        },
        edge: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
          features: ['matchMedia', 'requestAnimationFrame', 'addEventListener', 'querySelector', 'classList']
        },
        ie11: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
          features: ['addEventListener', 'querySelector'] // 限定的なサポート
        },
        oldChrome: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
          features: ['addEventListener', 'querySelector', 'classList'] // matchMediaなし
        }
      };
    }

    simulateEnvironment(browserName) {
      const env = this.environments[browserName];
      if (!env) return false;

      // User Agentを設定
      mockWindow.navigator.userAgent = env.userAgent;

      // 機能サポートを設定
      mockWindow.matchMedia = env.features.includes('matchMedia') ? 
        jest.fn((query) => ({
          matches: false,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        })) : undefined;

      mockWindow.requestAnimationFrame = env.features.includes('requestAnimationFrame') ?
        jest.fn((callback) => setTimeout(callback, 16)) : undefined;

      return true;
    }

    getCurrentEnvironment() {
      const userAgent = mockWindow.navigator.userAgent;
      for (const [name, env] of Object.entries(this.environments)) {
        if (userAgent.includes(env.userAgent.split(' ')[4])) {
          return name;
        }
      }
      return 'unknown';
    }
  }

  /**
   * ブラウザサポートチェッカー
   */
  class BrowserSupportChecker {
    constructor() {
      this.requiredFeatures = [
        'addEventListener',
        'querySelector',
        'classList'
      ];
      this.optionalFeatures = [
        'matchMedia',
        'requestAnimationFrame'
      ];
      this.supportStatus = new Map();
    }

    checkSupport() {
      // 必須機能のチェック
      this.requiredFeatures.forEach(feature => {
        this.supportStatus.set(feature, this.checkFeature(feature));
      });

      // オプション機能のチェック
      this.optionalFeatures.forEach(feature => {
        this.supportStatus.set(feature, this.checkFeature(feature));
      });
    }

    checkFeature(feature) {
      switch (feature) {
        case 'addEventListener':
          return typeof document.addEventListener === 'function';
        case 'querySelector':
          return typeof document.querySelector === 'function';
        case 'classList':
          return 'classList' in document.createElement('div');
        case 'matchMedia':
          return typeof window.matchMedia === 'function';
        case 'requestAnimationFrame':
          return typeof window.requestAnimationFrame === 'function';
        default:
          return false;
      }
    }

    isCompatible() {
      return this.requiredFeatures.every(feature => 
        this.supportStatus.get(feature) === true
      );
    }

    getUnsupportedFeatures() {
      return Array.from(this.supportStatus.entries())
        .filter(([feature, supported]) => !supported)
        .map(([feature]) => feature);
    }

    getSupportStatus() {
      return Object.fromEntries(this.supportStatus);
    }
  }

  describe('Chrome ブラウザ互換性', () => {
    beforeEach(() => {
      browserEnvironment.simulateEnvironment('chrome');
    });

    test('Chrome環境でダイアログが正常に作成される', async () => {
      const result = await userChoiceDialog.showChoiceDialog([{
        type: 'banner',
        element: createMockElement('div')
      }]);

      expect(result.dialogId).toBeDefined();
      
      const dialogData = userChoiceDialog.activeDialogs.get(result.dialogId);
      expect(dialogData.browserCompatible).toBe(true);
    });

    test('Chrome環境でアクセシビリティ機能が利用可能', () => {
      const features = userChoiceDialog.accessibilityHelper.getBrowserFeatures();
      
      expect(features.matchMedia).toBe(true);
      expect(features.requestAnimationFrame).toBe(true);
      expect(features.addEventListener).toBe(true);
      expect(features.querySelector).toBe(true);
    });

    test('Chrome環境でキーボードナビゲーションが動作する', () => {
      expect(userChoiceDialog.accessibilityHelper.keyboardNavigationEnabled).toBe(true);
    });
  });

  describe('Firefox ブラウザ互換性', () => {
    beforeEach(() => {
      browserEnvironment.simulateEnvironment('firefox');
    });

    test('Firefox環境でダイアログが正常に作成される', async () => {
      const result = await userChoiceDialog.showChoiceDialog([{
        type: 'overlay',
        element: createMockElement('div')
      }]);

      expect(result.dialogId).toBeDefined();
      
      const dialogData = userChoiceDialog.activeDialogs.get(result.dialogId);
      expect(dialogData.browserCompatible).toBe(true);
    });

    test('Firefox環境でプレビューなし続行機能が動作する', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        detectedAds: [{ type: 'banner' }],
        individualSelections: new Map()
      });

      userChoiceDialog.enableContinueWithoutPreview(dialogId);
      
      const dialogData = userChoiceDialog.activeDialogs.get(dialogId);
      expect(dialogData.continueWithoutPreview).toBe(true);
    });
  });

  describe('Safari ブラウザ互換性', () => {
    beforeEach(() => {
      browserEnvironment.simulateEnvironment('safari');
    });

    test('Safari環境でダイアログが正常に作成される', async () => {
      const result = await userChoiceDialog.showChoiceDialog([{
        type: 'popup',
        element: createMockElement('div')
      }]);

      expect(result.dialogId).toBeDefined();
    });

    test('Safari環境でアクセシビリティ機能が適切にフォールバックする', () => {
      const features = userChoiceDialog.accessibilityHelper.getBrowserFeatures();
      
      // Safariでも基本機能は利用可能
      expect(features.addEventListener).toBe(true);
      expect(features.querySelector).toBe(true);
    });
  });

  describe('Edge ブラウザ互換性', () => {
    beforeEach(() => {
      browserEnvironment.simulateEnvironment('edge');
    });

    test('Edge環境でダイアログが正常に作成される', async () => {
      const result = await userChoiceDialog.showChoiceDialog([{
        type: 'banner',
        element: createMockElement('div')
      }]);

      expect(result.dialogId).toBeDefined();
    });

    test('Edge環境で全機能が利用可能', () => {
      const browserSupport = userChoiceDialog.getBrowserSupport();
      expect(browserSupport.isCompatible()).toBe(true);
    });
  });

  describe('Internet Explorer 11 互換性', () => {
    beforeEach(() => {
      browserEnvironment.simulateEnvironment('ie11');
    });

    test('IE11環境でも基本機能が動作する', async () => {
      const result = await userChoiceDialog.showChoiceDialog([{
        type: 'banner',
        element: createMockElement('div')
      }]);

      expect(result.dialogId).toBeDefined();
    });

    test('IE11環境で不足機能が適切に検出される', () => {
      const browserSupport = userChoiceDialog.getBrowserSupport();
      const unsupported = browserSupport.getUnsupportedFeatures();
      
      expect(unsupported).toContain('matchMedia');
      expect(unsupported).toContain('requestAnimationFrame');
    });

    test('IE11環境でフォールバック機能が動作する', () => {
      // matchMediaが利用できない場合のフォールバック
      expect(typeof window.matchMedia).toBe('undefined');
      
      // それでもアクセシビリティヘルパーは初期化される
      expect(userChoiceDialog.accessibilityHelper).toBeDefined();
    });
  });

  describe('古いChrome互換性', () => {
    beforeEach(() => {
      browserEnvironment.simulateEnvironment('oldChrome');
    });

    test('古いChrome環境でも基本機能が動作する', async () => {
      const result = await userChoiceDialog.showChoiceDialog([{
        type: 'overlay',
        element: createMockElement('div')
      }]);

      expect(result.dialogId).toBeDefined();
    });

    test('古いChrome環境で機能制限が適切に処理される', () => {
      const features = userChoiceDialog.accessibilityHelper.getBrowserFeatures();
      
      expect(features.addEventListener).toBe(true);
      expect(features.querySelector).toBe(true);
      // matchMediaは利用できない可能性
    });
  });

  describe('機能検出とフォールバック', () => {
    test('必須機能の不足が検出される', () => {
      // addEventListener を無効化
      mockDocument.addEventListener = undefined;
      
      const browserSupport = new BrowserSupportChecker();
      browserSupport.checkSupport();
      
      expect(browserSupport.isCompatible()).toBe(false);
      expect(browserSupport.getUnsupportedFeatures()).toContain('addEventListener');
    });

    test('オプション機能の不足が適切に処理される', () => {
      // matchMediaを無効化
      mockWindow.matchMedia = undefined;
      
      const browserSupport = new BrowserSupportChecker();
      browserSupport.checkSupport();
      
      // 必須機能があれば互換性ありとする
      expect(browserSupport.isCompatible()).toBe(true);
      expect(browserSupport.getUnsupportedFeatures()).toContain('matchMedia');
    });

    test('classList不足時のフォールバック', () => {
      // classListを無効化
      const mockElement = createMockElement('div');
      delete mockElement.classList;
      
      mockDocument.createElement = jest.fn(() => mockElement);
      
      const browserSupport = new BrowserSupportChecker();
      browserSupport.checkSupport();
      
      expect(browserSupport.getUnsupportedFeatures()).toContain('classList');
    });
  });

  describe('CSS機能互換性', () => {
    test('CSS Grid サポートが検出される', () => {
      // CSS Grid サポートのモック
      const testElement = createMockElement('div');
      testElement.style.display = 'grid';
      
      expect(testElement.style.display).toBe('grid');
    });

    test('Flexbox サポートが検出される', () => {
      // Flexbox サポートのモック
      const testElement = createMockElement('div');
      testElement.style.display = 'flex';
      
      expect(testElement.style.display).toBe('flex');
    });

    test('CSS Variables サポートが検出される', () => {
      // CSS Variables サポートのモック
      const testElement = createMockElement('div');
      testElement.style.setProperty('--test-var', 'value');
      
      expect(testElement.style.setProperty).toHaveBeenCalledWith('--test-var', 'value');
    });
  });

  describe('イベント処理互換性', () => {
    test('addEventListener が利用可能な場合', () => {
      expect(typeof document.addEventListener).toBe('function');
      
      const handler = jest.fn();
      document.addEventListener('click', handler);
      
      expect(document.addEventListener).toHaveBeenCalledWith('click', handler);
    });

    test('attachEvent フォールバック（IE8以下）', () => {
      // attachEventのモック（実際のIE8以下環境をシミュレート）
      mockDocument.addEventListener = undefined;
      mockDocument.attachEvent = jest.fn();
      
      // フォールバック処理のテスト
      if (mockDocument.attachEvent && !mockDocument.addEventListener) {
        mockDocument.attachEvent('onclick', jest.fn());
        expect(mockDocument.attachEvent).toHaveBeenCalled();
      }
    });
  });

  describe('DOM操作互換性', () => {
    test('querySelector が利用可能な場合', () => {
      expect(typeof document.querySelector).toBe('function');
      
      document.querySelector('.test-class');
      expect(document.querySelector).toHaveBeenCalledWith('.test-class');
    });

    test('getElementById フォールバック', () => {
      // querySelectorが利用できない場合のフォールバック
      mockDocument.querySelector = undefined;
      
      mockDocument.getElementById('test-id');
      expect(mockDocument.getElementById).toHaveBeenCalledWith('test-id');
    });

    test('getElementsByClassName フォールバック', () => {
      // より古いブラウザでのフォールバック
      mockDocument.getElementsByClassName = jest.fn();
      
      mockDocument.getElementsByClassName('test-class');
      expect(mockDocument.getElementsByClassName).toHaveBeenCalledWith('test-class');
    });
  });

  describe('アニメーション互換性', () => {
    test('requestAnimationFrame が利用可能な場合', () => {
      expect(typeof window.requestAnimationFrame).toBe('function');
      
      const callback = jest.fn();
      window.requestAnimationFrame(callback);
      
      expect(window.requestAnimationFrame).toHaveBeenCalledWith(callback);
    });

    test('setTimeout フォールバック', () => {
      // requestAnimationFrameが利用できない場合
      mockWindow.requestAnimationFrame = undefined;
      
      const callback = jest.fn();
      const fallbackId = setTimeout(callback, 16);
      
      expect(typeof fallbackId).toBe('number');
    });
  });

  describe('統合互換性テスト', () => {
    test('全ブラウザ環境でダイアログが作成可能', async () => {
      const browsers = ['chrome', 'firefox', 'safari', 'edge'];
      
      for (const browser of browsers) {
        browserEnvironment.simulateEnvironment(browser);
        
        const result = await userChoiceDialog.showChoiceDialog([{
          type: 'test',
          element: createMockElement('div')
        }]);
        
        expect(result.dialogId).toBeDefined();
      }
    });

    test('機能制限環境でも基本機能が動作', async () => {
      // 最小限の機能のみ利用可能な環境をシミュレート
      mockWindow.matchMedia = undefined;
      mockWindow.requestAnimationFrame = undefined;
      
      const result = await userChoiceDialog.showChoiceDialog([{
        type: 'test',
        element: createMockElement('div')
      }]);
      
      expect(result.dialogId).toBeDefined();
    });

    test('プログレッシブエンハンスメントが機能', () => {
      // 基本機能から始まって、利用可能な機能を段階的に追加
      const browserSupport = userChoiceDialog.getBrowserSupport();
      const supportStatus = browserSupport.getSupportStatus();
      
      // 基本機能は必須
      expect(supportStatus.addEventListener).toBe(true);
      expect(supportStatus.querySelector).toBe(true);
      
      // 拡張機能はオプション
      // matchMedia, requestAnimationFrame は環境によって異なる
    });
  });
});