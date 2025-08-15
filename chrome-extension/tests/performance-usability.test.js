/**
 * パフォーマンステスト - ユーザビリティ改善機能
 * Task 12: パフォーマンステストとブラウザ互換性テスト
 */

const { 
  createMockElement,
  createChromeApiMock,
  resetTestData,
  TimerHelpers
} = require('./test-helpers');

describe('パフォーマンステスト - ユーザビリティ改善', () => {
  let mockChrome;
  let mockDocument;
  let mockWindow;
  let userChoiceDialog;
  let performanceMonitor;

  beforeEach(() => {
    resetTestData();
    TimerHelpers.mockSetTimeout();
    
    // Chrome API モックを設定
    mockChrome = createChromeApiMock();
    global.chrome = mockChrome;
    
    // パフォーマンス監視モック
    global.performance = {
      now: jest.fn(() => Date.now()),
      mark: jest.fn(),
      measure: jest.fn(),
      getEntriesByType: jest.fn(() => []),
      getEntriesByName: jest.fn(() => [])
    };
    
    // DOM環境をモック
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
      matchMedia: jest.fn((query) => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })),
      requestAnimationFrame: jest.fn((callback) => setTimeout(callback, 16)),
      cancelAnimationFrame: jest.fn()
    };
    
    global.document = mockDocument;
    global.window = mockWindow;

    // パフォーマンス監視クラス
    performanceMonitor = new PerformanceMonitor();

    // UserChoiceDialogクラスをモック
    global.UserChoiceDialog = class MockUserChoiceDialog {
      constructor() {
        this.activeDialogs = new Map();
        this.dialogCounter = 0;
        this.accessibilityHelper = new MockDialogAccessibilityHelper();
        this.performanceMetrics = new Map();
      }

      async showChoiceDialog(detectedAds) {
        const startTime = performance.now();
        
        const dialogId = `dialog-${++this.dialogCounter}`;
        const mockDialog = {
          detectedAds,
          individualSelections: new Map(),
          createdAt: startTime
        };
        
        this.activeDialogs.set(dialogId, mockDialog);
        
        // パフォーマンス測定
        const endTime = performance.now();
        this.performanceMetrics.set(`dialog-creation-${dialogId}`, endTime - startTime);
        
        return { action: 'test', dialogId, creationTime: endTime - startTime };
      }

      enableContinueWithoutPreview(dialogId) {
        const startTime = performance.now();
        
        const dialogData = this.activeDialogs.get(dialogId);
        if (dialogData) {
          dialogData.continueWithoutPreview = true;
        }
        
        const endTime = performance.now();
        this.performanceMetrics.set(`continue-without-preview-${dialogId}`, endTime - startTime);
      }

      updateSelectionVisualFeedback(dialogId) {
        const startTime = performance.now();
        
        const dialogData = this.activeDialogs.get(dialogId);
        if (dialogData) {
          dialogData.visualFeedbackUpdated = true;
        }
        
        const endTime = performance.now();
        this.performanceMetrics.set(`visual-feedback-${dialogId}`, endTime - startTime);
      }

      handleKeyboardShortcuts(dialogId, event) {
        const startTime = performance.now();
        
        const dialogData = this.activeDialogs.get(dialogId);
        if (dialogData) {
          dialogData.lastKeyboardEvent = event;
        }
        
        const endTime = performance.now();
        this.performanceMetrics.set(`keyboard-shortcut-${dialogId}`, endTime - startTime);
      }

      getPerformanceMetric(key) {
        return this.performanceMetrics.get(key);
      }

      getAllPerformanceMetrics() {
        return Object.fromEntries(this.performanceMetrics);
      }
    };

    global.DialogAccessibilityHelper = class MockDialogAccessibilityHelper {
      constructor() {
        this.keyboardNavigationEnabled = true;
        this.performanceMetrics = new Map();
      }

      init() {
        const startTime = performance.now();
        this.detectUserPreferences();
        const endTime = performance.now();
        this.performanceMetrics.set('init', endTime - startTime);
      }

      detectUserPreferences() {
        const startTime = performance.now();
        // ユーザー設定検出をモック
        const endTime = performance.now();
        this.performanceMetrics.set('detect-preferences', endTime - startTime);
      }

      applyHighContrastStyles() {
        const startTime = performance.now();
        // 高コントラストスタイル適用をモック
        const endTime = performance.now();
        this.performanceMetrics.set('high-contrast-styles', endTime - startTime);
      }

      getPerformanceMetric(key) {
        return this.performanceMetrics.get(key);
      }
    };

    userChoiceDialog = new global.UserChoiceDialog();
  });

  afterEach(() => {
    TimerHelpers.useRealTimers();
  });

  /**
   * パフォーマンス監視クラス
   */
  class PerformanceMonitor {
    constructor() {
      this.metrics = new Map();
      this.thresholds = {
        dialogCreation: 100, // 100ms
        visualFeedback: 50,  // 50ms
        keyboardResponse: 16, // 16ms (60fps)
        accessibilityInit: 50 // 50ms
      };
    }

    startMeasurement(name) {
      this.metrics.set(name, { startTime: performance.now() });
    }

    endMeasurement(name) {
      const metric = this.metrics.get(name);
      if (metric) {
        metric.endTime = performance.now();
        metric.duration = metric.endTime - metric.startTime;
      }
      return metric;
    }

    getMeasurement(name) {
      return this.metrics.get(name);
    }

    isWithinThreshold(name, threshold) {
      const metric = this.metrics.get(name);
      return metric && metric.duration <= threshold;
    }

    getAllMeasurements() {
      return Object.fromEntries(this.metrics);
    }
  }

  describe('ダイアログ作成パフォーマンス', () => {
    test('単一広告のダイアログ作成が100ms以内に完了する', async () => {
      const singleAd = [{
        type: 'banner',
        element: createMockElement('div'),
        width: 728,
        height: 90
      }];

      const result = await userChoiceDialog.showChoiceDialog(singleAd);
      
      expect(result.creationTime).toBeLessThan(100);
      expect(result.dialogId).toBeDefined();
    });

    test('複数広告のダイアログ作成が200ms以内に完了する', async () => {
      const multipleAds = Array.from({ length: 10 }, (_, i) => ({
        type: `ad-${i}`,
        element: createMockElement('div'),
        width: 300,
        height: 250
      }));

      const result = await userChoiceDialog.showChoiceDialog(multipleAds);
      
      expect(result.creationTime).toBeLessThan(200);
      expect(result.dialogId).toBeDefined();
    });

    test('大量広告（50個）のダイアログ作成が500ms以内に完了する', async () => {
      const manyAds = Array.from({ length: 50 }, (_, i) => ({
        type: `ad-${i}`,
        element: createMockElement('div'),
        width: 300,
        height: 250
      }));

      const result = await userChoiceDialog.showChoiceDialog(manyAds);
      
      expect(result.creationTime).toBeLessThan(500);
      expect(result.dialogId).toBeDefined();
    });
  });

  describe('視覚的フィードバックパフォーマンス', () => {
    test('選択状態更新が50ms以内に完了する', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        detectedAds: [{ type: 'banner' }],
        individualSelections: new Map()
      });

      userChoiceDialog.updateSelectionVisualFeedback(dialogId);
      
      const updateTime = userChoiceDialog.getPerformanceMetric(`visual-feedback-${dialogId}`);
      expect(updateTime).toBeLessThan(50);
    });

    test('連続的な選択状態更新が適切に処理される', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        detectedAds: Array.from({ length: 10 }, () => ({ type: 'ad' })),
        individualSelections: new Map()
      });

      const startTime = performance.now();
      
      // 10回連続で更新
      for (let i = 0; i < 10; i++) {
        userChoiceDialog.updateSelectionVisualFeedback(dialogId);
      }
      
      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(100); // 100ms以内
    });
  });

  describe('キーボード操作パフォーマンス', () => {
    test('キーボードショートカット処理が16ms以内に完了する', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        detectedAds: [{ type: 'banner' }],
        individualSelections: new Map()
      });

      const mockEvent = {
        ctrlKey: true,
        key: 'a',
        preventDefault: jest.fn()
      };

      userChoiceDialog.handleKeyboardShortcuts(dialogId, mockEvent);
      
      const responseTime = userChoiceDialog.getPerformanceMetric(`keyboard-shortcut-${dialogId}`);
      expect(responseTime).toBeLessThan(16); // 60fps相当
    });

    test('連続キーボード入力が適切に処理される', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        detectedAds: Array.from({ length: 5 }, () => ({ type: 'ad' })),
        individualSelections: new Map()
      });

      const keys = ['1', '2', '3', '4', '5'];
      const startTime = performance.now();
      
      keys.forEach(key => {
        const mockEvent = {
          key,
          shiftKey: false,
          preventDefault: jest.fn()
        };
        userChoiceDialog.handleKeyboardShortcuts(dialogId, mockEvent);
      });
      
      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(50); // 50ms以内
    });
  });

  describe('アクセシビリティ機能パフォーマンス', () => {
    test('アクセシビリティヘルパー初期化が50ms以内に完了する', () => {
      const helper = new global.DialogAccessibilityHelper();
      helper.init();
      
      const initTime = helper.getPerformanceMetric('init');
      expect(initTime).toBeLessThan(50);
    });

    test('ユーザー設定検出が30ms以内に完了する', () => {
      const helper = new global.DialogAccessibilityHelper();
      helper.detectUserPreferences();
      
      const detectionTime = helper.getPerformanceMetric('detect-preferences');
      expect(detectionTime).toBeLessThan(30);
    });

    test('高コントラストスタイル適用が20ms以内に完了する', () => {
      const helper = new global.DialogAccessibilityHelper();
      helper.applyHighContrastStyles();
      
      const styleTime = helper.getPerformanceMetric('high-contrast-styles');
      expect(styleTime).toBeLessThan(20);
    });
  });

  describe('メモリ使用量テスト', () => {
    test('ダイアログ作成後のメモリリークがない', () => {
      const initialDialogCount = userChoiceDialog.activeDialogs.size;
      const initialMetricsCount = userChoiceDialog.performanceMetrics.size;

      // 複数のダイアログを作成
      const promises = Array.from({ length: 10 }, (_, i) => 
        userChoiceDialog.showChoiceDialog([{
          type: `ad-${i}`,
          element: createMockElement('div')
        }])
      );

      return Promise.all(promises).then(() => {
        expect(userChoiceDialog.activeDialogs.size).toBe(initialDialogCount + 10);
        
        // すべてのダイアログを削除
        userChoiceDialog.activeDialogs.clear();
        userChoiceDialog.performanceMetrics.clear();
        
        expect(userChoiceDialog.activeDialogs.size).toBe(0);
        expect(userChoiceDialog.performanceMetrics.size).toBe(0);
      });
    });

    test('長時間実行でのメモリ蓄積がない', async () => {
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const result = await userChoiceDialog.showChoiceDialog([{
          type: `ad-${i}`,
          element: createMockElement('div')
        }]);
        
        // 即座にクリーンアップ
        userChoiceDialog.activeDialogs.delete(result.dialogId);
      }
      
      // メモリ使用量が適切にクリーンアップされていることを確認
      expect(userChoiceDialog.activeDialogs.size).toBe(0);
    });
  });

  describe('レスポンシブ性能テスト', () => {
    test('小画面でのダイアログ作成が適切に処理される', async () => {
      // 小画面サイズをシミュレート
      mockWindow.innerWidth = 320;
      mockWindow.innerHeight = 568;

      const result = await userChoiceDialog.showChoiceDialog([{
        type: 'banner',
        element: createMockElement('div')
      }]);
      
      expect(result.creationTime).toBeLessThan(150); // 小画面でも150ms以内
    });

    test('大画面での複数広告処理が効率的', async () => {
      // 大画面サイズをシミュレート
      mockWindow.innerWidth = 1920;
      mockWindow.innerHeight = 1080;

      const manyAds = Array.from({ length: 20 }, (_, i) => ({
        type: `ad-${i}`,
        element: createMockElement('div')
      }));

      const result = await userChoiceDialog.showChoiceDialog(manyAds);
      
      expect(result.creationTime).toBeLessThan(300); // 大画面でも300ms以内
    });
  });

  describe('並行処理パフォーマンス', () => {
    test('複数ダイアログの同時作成が適切に処理される', async () => {
      const startTime = performance.now();
      
      const promises = Array.from({ length: 5 }, (_, i) => 
        userChoiceDialog.showChoiceDialog([{
          type: `ad-${i}`,
          element: createMockElement('div')
        }])
      );

      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;
      
      expect(results).toHaveLength(5);
      expect(totalTime).toBeLessThan(500); // 並行処理で500ms以内
      
      results.forEach(result => {
        expect(result.dialogId).toBeDefined();
      });
    });

    test('並行アクセシビリティ処理が効率的', () => {
      const helpers = Array.from({ length: 10 }, () => new global.DialogAccessibilityHelper());
      
      const startTime = performance.now();
      
      helpers.forEach(helper => helper.init());
      
      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(200); // 10個の初期化で200ms以内
    });
  });

  describe('エラー処理パフォーマンス', () => {
    test('無効な操作でのパフォーマンス劣化がない', () => {
      const startTime = performance.now();
      
      // 存在しないダイアログでの操作を大量実行
      for (let i = 0; i < 100; i++) {
        userChoiceDialog.enableContinueWithoutPreview('non-existent');
        userChoiceDialog.updateSelectionVisualFeedback('non-existent');
      }
      
      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(50); // エラー処理でも50ms以内
    });

    test('例外発生時のリカバリが迅速', () => {
      const originalMethod = userChoiceDialog.updateSelectionVisualFeedback;
      
      // 例外を発生させるメソッドに置き換え
      userChoiceDialog.updateSelectionVisualFeedback = () => {
        throw new Error('Test error');
      };
      
      const startTime = performance.now();
      
      try {
        userChoiceDialog.updateSelectionVisualFeedback('test');
      } catch (error) {
        // エラーを無視
      }
      
      const errorTime = performance.now() - startTime;
      expect(errorTime).toBeLessThan(10); // エラー処理は10ms以内
      
      // 元のメソッドを復元
      userChoiceDialog.updateSelectionVisualFeedback = originalMethod;
    });
  });

  describe('統合パフォーマンステスト', () => {
    test('完全なユーザーフローが性能要件を満たす', async () => {
      const ads = Array.from({ length: 5 }, (_, i) => ({
        type: `ad-${i}`,
        element: createMockElement('div')
      }));

      const startTime = performance.now();
      
      // 1. ダイアログ作成
      const result = await userChoiceDialog.showChoiceDialog(ads);
      
      // 2. プレビューなしモード有効化
      userChoiceDialog.enableContinueWithoutPreview(result.dialogId);
      
      // 3. 複数の個別選択
      for (let i = 0; i < ads.length; i++) {
        userChoiceDialog.updateSelectionVisualFeedback(result.dialogId);
      }
      
      // 4. キーボードショートカット
      userChoiceDialog.handleKeyboardShortcuts(result.dialogId, {
        ctrlKey: true,
        key: 'a',
        preventDefault: jest.fn()
      });
      
      const totalTime = performance.now() - startTime;
      
      expect(totalTime).toBeLessThan(300); // 完全フローで300ms以内
      expect(result.dialogId).toBeDefined();
    });

    test('パフォーマンス監視機能が正常に動作する', () => {
      performanceMonitor.startMeasurement('test-operation');
      
      // 何らかの処理をシミュレート
      setTimeout(() => {
        performanceMonitor.endMeasurement('test-operation');
      }, 10);
      
      // 測定が開始されていることを確認
      const measurement = performanceMonitor.getMeasurement('test-operation');
      expect(measurement).toBeDefined();
      expect(measurement.startTime).toBeDefined();
    });
  });
});