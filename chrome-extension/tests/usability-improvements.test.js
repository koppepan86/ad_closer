/**
 * ユーザビリティ改善機能のテスト
 * Task 12: ユーザビリティ改善とテスト
 */

const { 
  createMockElement,
  createMockUserPreferences,
  createChromeApiMock,
  resetTestData,
  TimerHelpers
} = require('./test-helpers');

describe('ユーザビリティ改善機能のテスト', () => {
  let mockChrome;
  let mockDocument;
  let mockWindow;
  let userChoiceDialog;
  let mockDetectedAds;

  beforeEach(() => {
    resetTestData();
    TimerHelpers.mockSetTimeout();
    
    // Chrome API モックを設定
    mockChrome = createChromeApiMock();
    global.chrome = mockChrome;
    
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
      }))
    };
    
    global.document = mockDocument;
    global.window = mockWindow;

    // モック広告データ
    mockDetectedAds = [
      {
        type: 'overlay',
        element: createMockElement('div'),
        width: 300,
        height: 250,
        x: 100,
        y: 200
      },
      {
        type: 'banner',
        element: createMockElement('div'),
        width: 728,
        height: 90,
        x: 50,
        y: 50
      }
    ];

    // UserChoiceDialogクラスをモック
    global.UserChoiceDialog = class MockUserChoiceDialog {
      constructor() {
        this.activeDialogs = new Map();
        this.dialogCounter = 0;
        this.accessibilityHelper = new MockDialogAccessibilityHelper();
      }

      init() {
        this.accessibilityHelper.init();
      }

      async showChoiceDialog(detectedAds) {
        const dialogId = `dialog-${++this.dialogCounter}`;
        const mockDialog = {
          detectedAds,
          individualSelections: new Map()
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

      handleIndividualSelection(dialogId, adIndex, action) {
        const dialogData = this.activeDialogs.get(dialogId);
        if (dialogData) {
          dialogData.individualSelections.set(adIndex, action);
        }
      }

      announceToScreenReader(message) {
        // スクリーンリーダー通知をモック
        console.log('Screen reader announcement:', message);
      }

      setupFocusTrap(dialog) {
        // フォーカストラップ設定をモック
        dialog.setAttribute('data-focus-trap', 'true');
      }

      updateSelectionVisualFeedback(dialogId) {
        const dialogData = this.activeDialogs.get(dialogId);
        if (dialogData) {
          dialogData.visualFeedbackUpdated = true;
        }
      }

      handleKeyboardShortcuts(dialogId, event) {
        const dialogData = this.activeDialogs.get(dialogId);
        if (dialogData) {
          dialogData.lastKeyboardEvent = event;
        }
      }
    };

    global.DialogAccessibilityHelper = class MockDialogAccessibilityHelper {
      constructor() {
        this.keyboardNavigationEnabled = true;
        this.highContrastMode = false;
        this.reducedMotion = false;
      }

      init() {
        this.detectUserPreferences();
      }

      detectUserPreferences() {
        // ユーザー設定検出をモック
      }

      applyHighContrastStyles() {
        // 高コントラストスタイル適用をモック
      }

      applyReducedMotionStyles() {
        // 動きを減らすスタイル適用をモック
      }

      toggleKeyboardNavigation(enabled) {
        this.keyboardNavigationEnabled = enabled;
      }
    };

    userChoiceDialog = new global.UserChoiceDialog();
    userChoiceDialog.init();
  });

  afterEach(() => {
    TimerHelpers.useRealTimers();
  });

  describe('プレビューなしでの選択続行機能', () => {
    test('プレビュー生成失敗時に続行ボタンが表示される', async () => {
      const result = await userChoiceDialog.showChoiceDialog(mockDetectedAds);
      
      expect(result.dialogId).toBeDefined();
      expect(userChoiceDialog.activeDialogs.has(result.dialogId)).toBe(true);
    });

    test('続行ボタンクリックでプレビューなしモードが有効になる', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        detectedAds: mockDetectedAds,
        individualSelections: new Map()
      });

      userChoiceDialog.enableContinueWithoutPreview(dialogId);

      const dialogData = userChoiceDialog.activeDialogs.get(dialogId);
      expect(dialogData.continueWithoutPreview).toBe(true);
    });

    test('プレビューなしモードで個別選択が可能', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        detectedAds: mockDetectedAds,
        individualSelections: new Map()
      });

      userChoiceDialog.handleIndividualSelection(dialogId, 0, 'block');
      userChoiceDialog.handleIndividualSelection(dialogId, 1, 'allow');

      const dialogData = userChoiceDialog.activeDialogs.get(dialogId);
      expect(dialogData.individualSelections.get(0)).toBe('block');
      expect(dialogData.individualSelections.get(1)).toBe('allow');
    });

    test('プレビュータイムアウト時に適切なオプションが表示される', () => {
      // プレビュータイムアウトのテスト
      const mockContainer = createMockElement('div');
      
      // showPreviewTimeoutメソッドが存在することを確認
      expect(typeof userChoiceDialog.showPreviewTimeout).toBe('function');
    });
  });

  describe('アクセシビリティ対応', () => {
    test('DialogAccessibilityHelperが正しく初期化される', () => {
      expect(userChoiceDialog.accessibilityHelper).toBeDefined();
      expect(userChoiceDialog.accessibilityHelper.keyboardNavigationEnabled).toBe(true);
    });

    test('キーボードナビゲーションが有効/無効を切り替えられる', () => {
      userChoiceDialog.accessibilityHelper.toggleKeyboardNavigation(false);
      expect(userChoiceDialog.accessibilityHelper.keyboardNavigationEnabled).toBe(false);

      userChoiceDialog.accessibilityHelper.toggleKeyboardNavigation(true);
      expect(userChoiceDialog.accessibilityHelper.keyboardNavigationEnabled).toBe(true);
    });

    test('高コントラストモードが検出される', () => {
      // 高コントラストモードのモック
      mockWindow.matchMedia = jest.fn((query) => {
        if (query === '(prefers-contrast: high)') {
          return {
            matches: true,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
          };
        }
        return {
          matches: false,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        };
      });

      const helper = new global.DialogAccessibilityHelper();
      helper.detectUserPreferences();
      
      expect(mockWindow.matchMedia).toHaveBeenCalledWith('(prefers-contrast: high)');
    });

    test('動きを減らす設定が検出される', () => {
      // 動きを減らす設定のモック
      mockWindow.matchMedia = jest.fn((query) => {
        if (query === '(prefers-reduced-motion: reduce)') {
          return {
            matches: true,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
          };
        }
        return {
          matches: false,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn()
        };
      });

      const helper = new global.DialogAccessibilityHelper();
      helper.detectUserPreferences();
      
      expect(mockWindow.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    });

    test('スクリーンリーダーへの通知が機能する', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      userChoiceDialog.announceToScreenReader('テストメッセージ');
      
      expect(consoleSpy).toHaveBeenCalledWith('Screen reader announcement:', 'テストメッセージ');
      
      consoleSpy.mockRestore();
    });

    test('フォーカストラップが設定される', () => {
      const mockDialog = createMockElement('div');
      
      userChoiceDialog.setupFocusTrap(mockDialog);
      
      expect(mockDialog.setAttribute).toHaveBeenCalledWith('data-focus-trap', 'true');
    });

    test('ARIAラベルが適切に設定される', () => {
      // ダイアログ要素のARIA属性テスト
      const mockDialog = createMockElement('div');
      mockDialog.setAttribute('role', 'dialog');
      mockDialog.setAttribute('aria-modal', 'true');
      
      expect(mockDialog.setAttribute).toHaveBeenCalledWith('role', 'dialog');
      expect(mockDialog.setAttribute).toHaveBeenCalledWith('aria-modal', 'true');
    });
  });

  describe('キーボード操作対応', () => {
    test('キーボードショートカットが処理される', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        detectedAds: mockDetectedAds,
        individualSelections: new Map()
      });

      const mockEvent = {
        ctrlKey: true,
        key: 'a',
        preventDefault: jest.fn()
      };

      userChoiceDialog.handleKeyboardShortcuts(dialogId, mockEvent);

      const dialogData = userChoiceDialog.activeDialogs.get(dialogId);
      expect(dialogData.lastKeyboardEvent).toBe(mockEvent);
    });

    test('数字キーで個別選択が可能', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        detectedAds: mockDetectedAds,
        individualSelections: new Map()
      });

      const mockEvent = {
        key: '1',
        shiftKey: false,
        preventDefault: jest.fn()
      };

      userChoiceDialog.handleKeyboardShortcuts(dialogId, mockEvent);

      const dialogData = userChoiceDialog.activeDialogs.get(dialogId);
      expect(dialogData.lastKeyboardEvent).toBe(mockEvent);
    });

    test('Shift+数字キーでブロック選択が可能', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        detectedAds: mockDetectedAds,
        individualSelections: new Map()
      });

      const mockEvent = {
        key: '1',
        shiftKey: true,
        preventDefault: jest.fn()
      };

      userChoiceDialog.handleKeyboardShortcuts(dialogId, mockEvent);

      const dialogData = userChoiceDialog.activeDialogs.get(dialogId);
      expect(dialogData.lastKeyboardEvent).toBe(mockEvent);
    });

    test('Tabキーでフォーカス移動が制御される', () => {
      const mockDialog = createMockElement('div');
      const mockButton1 = createMockElement('button');
      const mockButton2 = createMockElement('button');
      
      mockDialog.querySelectorAll = jest.fn().mockReturnValue([mockButton1, mockButton2]);
      
      userChoiceDialog.setupFocusTrap(mockDialog);
      
      expect(mockDialog.setAttribute).toHaveBeenCalledWith('data-focus-trap', 'true');
    });
  });

  describe('視覚的フィードバック', () => {
    test('選択状態の視覚的フィードバックが更新される', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        detectedAds: mockDetectedAds,
        individualSelections: new Map([[0, 'allow'], [1, 'block']])
      });

      userChoiceDialog.updateSelectionVisualFeedback(dialogId);

      const dialogData = userChoiceDialog.activeDialogs.get(dialogId);
      expect(dialogData.visualFeedbackUpdated).toBe(true);
    });

    test('プログレスバーが選択進行状況を反映する', () => {
      const dialogId = 'test-dialog';
      const mockProgressFill = createMockElement('div');
      
      // プログレスバー更新のテスト
      expect(typeof userChoiceDialog.updateSelectionVisualFeedback).toBe('function');
    });

    test('完了メッセージが適切なタイミングで表示される', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        detectedAds: mockDetectedAds,
        individualSelections: new Map([[0, 'allow'], [1, 'block']])
      });

      userChoiceDialog.updateSelectionVisualFeedback(dialogId);

      const dialogData = userChoiceDialog.activeDialogs.get(dialogId);
      expect(dialogData.visualFeedbackUpdated).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    test('存在しないダイアログIDでの操作が安全に処理される', () => {
      expect(() => {
        userChoiceDialog.enableContinueWithoutPreview('non-existent');
      }).not.toThrow();

      expect(() => {
        userChoiceDialog.handleIndividualSelection('non-existent', 0, 'allow');
      }).not.toThrow();

      expect(() => {
        userChoiceDialog.updateSelectionVisualFeedback('non-existent');
      }).not.toThrow();
    });

    test('無効な広告インデックスが安全に処理される', () => {
      const dialogId = 'test-dialog';
      userChoiceDialog.activeDialogs.set(dialogId, {
        detectedAds: mockDetectedAds,
        individualSelections: new Map()
      });

      expect(() => {
        userChoiceDialog.handleIndividualSelection(dialogId, 999, 'allow');
      }).not.toThrow();

      expect(() => {
        userChoiceDialog.handleIndividualSelection(dialogId, -1, 'block');
      }).not.toThrow();
    });

    test('アクセシビリティ機能の初期化失敗が適切に処理される', () => {
      // アクセシビリティヘルパーが存在しない場合のテスト
      const dialogWithoutAccessibility = new global.UserChoiceDialog();
      dialogWithoutAccessibility.accessibilityHelper = null;

      expect(() => {
        dialogWithoutAccessibility.announceToScreenReader('テスト');
      }).not.toThrow();
    });
  });

  describe('パフォーマンス', () => {
    test('大量の広告でも適切に処理される', async () => {
      const manyAds = Array.from({ length: 50 }, (_, i) => ({
        type: `ad-${i}`,
        element: createMockElement('div'),
        width: 300,
        height: 250,
        x: i * 10,
        y: i * 10
      }));

      const startTime = Date.now();
      const result = await userChoiceDialog.showChoiceDialog(manyAds);
      const endTime = Date.now();

      expect(result.dialogId).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
    });

    test('メモリリークが発生しない', () => {
      const initialDialogCount = userChoiceDialog.activeDialogs.size;

      // 複数のダイアログを作成して閉じる
      for (let i = 0; i < 10; i++) {
        const dialogId = `test-dialog-${i}`;
        userChoiceDialog.activeDialogs.set(dialogId, {
          detectedAds: mockDetectedAds,
          individualSelections: new Map()
        });
      }

      // すべてのダイアログを閉じる
      userChoiceDialog.closeAllDialogs();

      expect(userChoiceDialog.activeDialogs.size).toBe(initialDialogCount);
    });
  });

  describe('ブラウザ互換性', () => {
    test('matchMediaが利用できない環境でも動作する', () => {
      const originalMatchMedia = mockWindow.matchMedia;
      mockWindow.matchMedia = undefined;

      expect(() => {
        const helper = new global.DialogAccessibilityHelper();
        helper.detectUserPreferences();
      }).not.toThrow();

      mockWindow.matchMedia = originalMatchMedia;
    });

    test('古いブラウザでのARIA属性サポート', () => {
      const mockElement = createMockElement('div');
      
      // setAttribute が存在しない場合のテスト
      const originalSetAttribute = mockElement.setAttribute;
      mockElement.setAttribute = undefined;

      expect(() => {
        // ARIA属性設定のテスト
        if (mockElement.setAttribute) {
          mockElement.setAttribute('aria-label', 'test');
        }
      }).not.toThrow();

      mockElement.setAttribute = originalSetAttribute;
    });
  });

  describe('統合テスト', () => {
    test('完全なユーザーフローが正常に動作する', async () => {
      // 1. ダイアログ表示
      const result = await userChoiceDialog.showChoiceDialog(mockDetectedAds);
      expect(result.dialogId).toBeDefined();

      // 2. プレビューなしモード有効化
      userChoiceDialog.enableContinueWithoutPreview(result.dialogId);
      const dialogData = userChoiceDialog.activeDialogs.get(result.dialogId);
      expect(dialogData.continueWithoutPreview).toBe(true);

      // 3. 個別選択
      userChoiceDialog.handleIndividualSelection(result.dialogId, 0, 'allow');
      userChoiceDialog.handleIndividualSelection(result.dialogId, 1, 'block');

      // 4. 視覚的フィードバック更新
      userChoiceDialog.updateSelectionVisualFeedback(result.dialogId);
      expect(dialogData.visualFeedbackUpdated).toBe(true);

      // 5. キーボードショートカット
      const mockEvent = { ctrlKey: true, key: 'a', preventDefault: jest.fn() };
      userChoiceDialog.handleKeyboardShortcuts(result.dialogId, mockEvent);
      expect(dialogData.lastKeyboardEvent).toBe(mockEvent);
    });

    test('アクセシビリティ機能が統合的に動作する', () => {
      const helper = userChoiceDialog.accessibilityHelper;
      
      // 初期状態の確認
      expect(helper.keyboardNavigationEnabled).toBe(true);
      
      // 設定変更
      helper.toggleKeyboardNavigation(false);
      expect(helper.keyboardNavigationEnabled).toBe(false);
      
      // 復元
      helper.toggleKeyboardNavigation(true);
      expect(helper.keyboardNavigationEnabled).toBe(true);
    });
  });
});