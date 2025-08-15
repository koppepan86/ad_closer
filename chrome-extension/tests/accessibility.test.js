/**
 * アクセシビリティ機能のテスト
 * Task 9.1.5: UIコンポーネントのテスト - アクセシビリティ部分
 */

const { 
  createMockElement,
  createMockUserPreferences,
  createChromeApiMock,
  resetTestData,
  TimerHelpers
} = require('./test-helpers');

describe('アクセシビリティ機能のテスト', () => {
  let mockChrome;
  let mockDocument;
  let mockWindow;
  let accessibilityHelper;

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
      createElement: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      body: createMockElement('body'),
      head: createMockElement('head'),
      activeElement: null
    };
    
    mockWindow = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      location: { href: 'chrome-extension://test/popup.html' },
      innerWidth: 400,
      innerHeight: 600
    };
    
    global.document = mockDocument;
    global.window = mockWindow;

    accessibilityHelper = new AccessibilityHelper();
  });

  afterEach(() => {
    TimerHelpers.useRealTimers();
  });

  /**
   * アクセシビリティヘルパークラス
   * UI要素のアクセシビリティ機能を提供
   */
  class AccessibilityHelper {
    constructor() {
      this.focusableElements = [];
      this.currentFocusIndex = -1;
      this.keyboardNavigationEnabled = true;
    }

    /**
     * アクセシビリティ機能を初期化
     */
    init() {
      this.setupKeyboardNavigation();
      this.setupAriaLabels();
      this.setupFocusManagement();
    }

    /**
     * キーボードナビゲーションを設定
     */
    setupKeyboardNavigation() {
      document.addEventListener('keydown', (event) => {
        this.handleKeyboardNavigation(event);
      });
    }

    /**
     * ARIAラベルを設定
     */
    setupAriaLabels() {
      // 既存の要素にARIAラベルを追加
      this.addAriaLabelsToElements();
    }

    /**
     * フォーカス管理を設定
     */
    setupFocusManagement() {
      this.updateFocusableElements();
    }

    /**
     * キーボードナビゲーションを処理
     */
    handleKeyboardNavigation(event) {
      if (!this.keyboardNavigationEnabled) return;

      switch (event.key) {
        case 'Tab':
          this.handleTabNavigation(event);
          break;
        case 'Enter':
        case ' ':
          this.handleActivation(event);
          break;
        case 'Escape':
          this.handleEscape(event);
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          this.handleArrowNavigation(event);
          break;
      }
    }

    /**
     * Tabナビゲーションを処理
     */
    handleTabNavigation(event) {
      this.updateFocusableElements();
      
      if (this.focusableElements.length === 0) return;

      if (event.shiftKey) {
        // Shift+Tab: 前の要素へ
        this.currentFocusIndex = this.currentFocusIndex <= 0 
          ? this.focusableElements.length - 1 
          : this.currentFocusIndex - 1;
      } else {
        // Tab: 次の要素へ
        this.currentFocusIndex = this.currentFocusIndex >= this.focusableElements.length - 1 
          ? 0 
          : this.currentFocusIndex + 1;
      }

      const targetElement = this.focusableElements[this.currentFocusIndex];
      if (targetElement && targetElement.focus) {
        targetElement.focus();
        event.preventDefault();
      }
    }

    /**
     * 要素のアクティベーションを処理
     */
    handleActivation(event) {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'BUTTON' || activeElement.tagName === 'A')) {
        activeElement.click();
        event.preventDefault();
      }
    }

    /**
     * Escapeキーを処理
     */
    handleEscape(event) {
      // 通知やモーダルを閉じる
      const notifications = document.querySelectorAll('.notification');
      if (notifications.length > 0) {
        const closeButton = notifications[notifications.length - 1].querySelector('.notification-close');
        if (closeButton) {
          closeButton.click();
        }
      }
    }

    /**
     * 矢印キーナビゲーションを処理
     */
    handleArrowNavigation(event) {
      const activeElement = document.activeElement;
      
      // リスト内での矢印キーナビゲーション
      if (activeElement && activeElement.closest('ul, ol')) {
        const listItems = activeElement.closest('ul, ol').querySelectorAll('li');
        const currentIndex = Array.from(listItems).indexOf(activeElement.closest('li'));
        
        let nextIndex;
        if (event.key === 'ArrowUp') {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : listItems.length - 1;
        } else {
          nextIndex = currentIndex < listItems.length - 1 ? currentIndex + 1 : 0;
        }
        
        const nextItem = listItems[nextIndex];
        const focusableInNext = nextItem.querySelector('button, a, input, [tabindex]');
        if (focusableInNext) {
          focusableInNext.focus();
          event.preventDefault();
        }
      }
    }

    /**
     * フォーカス可能な要素を更新
     */
    updateFocusableElements() {
      const selector = 'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])';
      this.focusableElements = Array.from(document.querySelectorAll(selector))
        .filter(el => !el.disabled && this.isVisible(el));
    }

    /**
     * 要素が表示されているかチェック
     */
    isVisible(element) {
      // 簡単な表示チェック（実際の実装ではより詳細なチェックが必要）
      return element.offsetWidth > 0 && element.offsetHeight > 0;
    }

    /**
     * 要素にARIAラベルを追加
     */
    addAriaLabelsToElements() {
      // ボタンにARIAラベルを追加
      const buttons = document.querySelectorAll('button:not([aria-label])');
      buttons.forEach(button => {
        if (!button.getAttribute('aria-label') && button.textContent) {
          button.setAttribute('aria-label', button.textContent.trim());
        }
      });

      // 入力フィールドにARIAラベルを追加
      const inputs = document.querySelectorAll('input:not([aria-label])');
      inputs.forEach(input => {
        if (!input.getAttribute('aria-label') && input.placeholder) {
          input.setAttribute('aria-label', input.placeholder);
        }
      });
    }

    /**
     * スクリーンリーダー用のライブリージョンを作成
     */
    createLiveRegion() {
      const liveRegion = createMockElement('div', {
        id: 'popup-blocker-live-region',
        'aria-live': 'polite',
        'aria-atomic': 'true',
        style: 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;'
      });

      document.body.appendChild(liveRegion);
      return liveRegion;
    }

    /**
     * ライブリージョンにメッセージを追加
     */
    announceToScreenReader(message) {
      const liveRegion = document.getElementById('popup-blocker-live-region') || this.createLiveRegion();
      liveRegion.textContent = message;
      
      // メッセージをクリア（次のアナウンスのため）
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 1000);
    }

    /**
     * 高コントラストモードの検出
     */
    detectHighContrastMode() {
      // 高コントラストモードの検出ロジック
      const testElement = createMockElement('div', {
        style: 'border: 1px solid; border-color: red green blue; position: absolute; left: -10000px;'
      });
      
      document.body.appendChild(testElement);
      
      // 実際の実装では、計算されたスタイルをチェック
      const isHighContrast = false; // モックでは常にfalse
      
      document.body.removeChild(testElement);
      return isHighContrast;
    }

    /**
     * フォーカスインジケーターを強化
     */
    enhanceFocusIndicators() {
      const style = createMockElement('style', {
        textContent: `
          .popup-blocker-focus-enhanced *:focus {
            outline: 3px solid #4A90E2 !important;
            outline-offset: 2px !important;
          }
          
          .popup-blocker-focus-enhanced button:focus,
          .popup-blocker-focus-enhanced a:focus {
            box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.5) !important;
          }
        `
      });

      document.head.appendChild(style);
      document.body.classList.add('popup-blocker-focus-enhanced');
    }

    /**
     * キーボードナビゲーションの有効/無効を切り替え
     */
    toggleKeyboardNavigation(enabled) {
      this.keyboardNavigationEnabled = enabled;
    }

    /**
     * アクセシビリティ機能を破棄
     */
    destroy() {
      document.removeEventListener('keydown', this.handleKeyboardNavigation);
      
      const liveRegion = document.getElementById('popup-blocker-live-region');
      if (liveRegion) {
        document.body.removeChild(liveRegion);
      }
      
      document.body.classList.remove('popup-blocker-focus-enhanced');
    }
  }

  test('アクセシビリティヘルパーの初期化', () => {
    accessibilityHelper.init();

    expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  test('フォーカス可能な要素の検出', () => {
    // テスト用の要素を作成
    const button = createMockElement('button', { textContent: 'テストボタン' });
    const input = createMockElement('input', { type: 'text' });
    const disabledButton = createMockElement('button', { disabled: true, textContent: '無効ボタン' });

    // querySelectorAllのモック実装
    document.querySelectorAll.mockReturnValue([button, input, disabledButton]);

    accessibilityHelper.updateFocusableElements();

    // 無効な要素は除外される
    expect(accessibilityHelper.focusableElements).toHaveLength(2);
    expect(accessibilityHelper.focusableElements).toContain(button);
    expect(accessibilityHelper.focusableElements).toContain(input);
    expect(accessibilityHelper.focusableElements).not.toContain(disabledButton);
  });

  test('Tabキーナビゲーション', () => {
    const button1 = createMockElement('button', { textContent: 'ボタン1' });
    const button2 = createMockElement('button', { textContent: 'ボタン2' });
    
    accessibilityHelper.focusableElements = [button1, button2];
    accessibilityHelper.currentFocusIndex = 0;

    const tabEvent = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: jest.fn()
    };

    accessibilityHelper.handleTabNavigation(tabEvent);

    expect(accessibilityHelper.currentFocusIndex).toBe(1);
    expect(button2.focus).toHaveBeenCalled();
    expect(tabEvent.preventDefault).toHaveBeenCalled();
  });

  test('Shift+Tabキーナビゲーション', () => {
    const button1 = createMockElement('button', { textContent: 'ボタン1' });
    const button2 = createMockElement('button', { textContent: 'ボタン2' });
    
    accessibilityHelper.focusableElements = [button1, button2];
    accessibilityHelper.currentFocusIndex = 1;

    const shiftTabEvent = {
      key: 'Tab',
      shiftKey: true,
      preventDefault: jest.fn()
    };

    accessibilityHelper.handleTabNavigation(shiftTabEvent);

    expect(accessibilityHelper.currentFocusIndex).toBe(0);
    expect(button1.focus).toHaveBeenCalled();
    expect(shiftTabEvent.preventDefault).toHaveBeenCalled();
  });

  test('Enterキーでのアクティベーション', () => {
    const button = createMockElement('button', { textContent: 'テストボタン' });
    document.activeElement = button;

    const enterEvent = {
      key: 'Enter',
      preventDefault: jest.fn()
    };

    accessibilityHelper.handleActivation(enterEvent);

    expect(button.click).toHaveBeenCalled();
    expect(enterEvent.preventDefault).toHaveBeenCalled();
  });

  test('Escapeキーでの通知閉鎖', () => {
    const notification = createMockElement('div', { className: 'notification' });
    const closeButton = createMockElement('button', { className: 'notification-close' });
    
    notification.querySelector = jest.fn().mockReturnValue(closeButton);
    document.querySelectorAll.mockReturnValue([notification]);

    const escapeEvent = {
      key: 'Escape',
      preventDefault: jest.fn()
    };

    accessibilityHelper.handleEscape(escapeEvent);

    expect(closeButton.click).toHaveBeenCalled();
  });

  test('矢印キーナビゲーション', () => {
    const listItem1 = createMockElement('li');
    const listItem2 = createMockElement('li');
    const button1 = createMockElement('button', { textContent: 'ボタン1' });
    const button2 = createMockElement('button', { textContent: 'ボタン2' });
    
    listItem1.querySelector = jest.fn().mockReturnValue(button1);
    listItem2.querySelector = jest.fn().mockReturnValue(button2);
    
    const list = createMockElement('ul');
    list.querySelectorAll = jest.fn().mockReturnValue([listItem1, listItem2]);
    
    button1.closest = jest.fn().mockReturnValue(listItem1);
    listItem1.closest = jest.fn().mockReturnValue(list);
    
    document.activeElement = button1;

    const arrowDownEvent = {
      key: 'ArrowDown',
      preventDefault: jest.fn()
    };

    accessibilityHelper.handleArrowNavigation(arrowDownEvent);

    expect(button2.focus).toHaveBeenCalled();
    expect(arrowDownEvent.preventDefault).toHaveBeenCalled();
  });

  test('ARIAラベルの自動追加', () => {
    const button = createMockElement('button', { textContent: 'テストボタン' });
    const input = createMockElement('input', { placeholder: 'テスト入力' });
    
    document.querySelectorAll
      .mockReturnValueOnce([button]) // buttons query
      .mockReturnValueOnce([input]); // inputs query

    accessibilityHelper.addAriaLabelsToElements();

    expect(button.setAttribute).toHaveBeenCalledWith('aria-label', 'テストボタン');
    expect(input.setAttribute).toHaveBeenCalledWith('aria-label', 'テスト入力');
  });

  test('ライブリージョンの作成', () => {
    const liveRegion = accessibilityHelper.createLiveRegion();

    expect(liveRegion.id).toBe('popup-blocker-live-region');
    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
    expect(liveRegion.getAttribute('aria-atomic')).toBe('true');
    expect(document.body.appendChild).toHaveBeenCalledWith(liveRegion);
  });

  test('スクリーンリーダーへのアナウンス', () => {
    const liveRegion = createMockElement('div', { id: 'popup-blocker-live-region' });
    document.getElementById.mockReturnValue(liveRegion);

    accessibilityHelper.announceToScreenReader('テストメッセージ');

    expect(liveRegion.textContent).toBe('テストメッセージ');
  });

  test('高コントラストモードの検出', () => {
    const isHighContrast = accessibilityHelper.detectHighContrastMode();

    expect(typeof isHighContrast).toBe('boolean');
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
  });

  test('フォーカスインジケーターの強化', () => {
    accessibilityHelper.enhanceFocusIndicators();

    expect(document.head.appendChild).toHaveBeenCalled();
    expect(document.body.classList.add).toHaveBeenCalledWith('popup-blocker-focus-enhanced');
  });

  test('キーボードナビゲーションの切り替え', () => {
    accessibilityHelper.toggleKeyboardNavigation(false);
    expect(accessibilityHelper.keyboardNavigationEnabled).toBe(false);

    accessibilityHelper.toggleKeyboardNavigation(true);
    expect(accessibilityHelper.keyboardNavigationEnabled).toBe(true);
  });

  test('要素の表示状態チェック', () => {
    const visibleElement = createMockElement('div', { 
      offsetWidth: 100, 
      offsetHeight: 50 
    });
    const hiddenElement = createMockElement('div', { 
      offsetWidth: 0, 
      offsetHeight: 0 
    });

    expect(accessibilityHelper.isVisible(visibleElement)).toBe(true);
    expect(accessibilityHelper.isVisible(hiddenElement)).toBe(false);
  });

  test('アクセシビリティ機能の破棄', () => {
    const liveRegion = createMockElement('div', { id: 'popup-blocker-live-region' });
    document.getElementById.mockReturnValue(liveRegion);

    accessibilityHelper.destroy();

    expect(document.removeEventListener).toHaveBeenCalledWith('keydown', accessibilityHelper.handleKeyboardNavigation);
    expect(document.body.removeChild).toHaveBeenCalledWith(liveRegion);
    expect(document.body.classList.remove).toHaveBeenCalledWith('popup-blocker-focus-enhanced');
  });

  test('キーボードナビゲーション無効時の動作', () => {
    accessibilityHelper.keyboardNavigationEnabled = false;

    const tabEvent = {
      key: 'Tab',
      preventDefault: jest.fn()
    };

    accessibilityHelper.handleKeyboardNavigation(tabEvent);

    // 無効時は何も処理されない
    expect(tabEvent.preventDefault).not.toHaveBeenCalled();
  });
});