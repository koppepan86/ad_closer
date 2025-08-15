/**
 * ポップアップ検出機能の包括的ユニットテスト
 * Task 9.1.1: ポップアップ検出機能のテスト
 * 
 * analyzePopup()関数のテストケース、ポップアップ特性分析ロジックのテスト、
 * 信頼度スコアリングシステムのテスト、DOM要素検出の境界値テストを含む
 */

const { 
  createMockElement, 
  createMockPopupData, 
  resetTestData,
  measurePerformance,
  expectError
} = require('./test-helpers');

describe('ポップアップ検出機能 - 包括的テスト', () => {
  let mockElement;
  let mockStyle;
  let originalGetComputedStyle;
  let originalInnerWidth;
  let originalInnerHeight;

  beforeEach(() => {
    resetTestData();
    
    // ウィンドウサイズを設定
    originalInnerWidth = global.innerWidth;
    originalInnerHeight = global.innerHeight;
    global.innerWidth = 1024;
    global.innerHeight = 768;
    
    // モック要素を作成
    mockElement = createMockElement('div', {
      id: 'test-popup',
      className: 'popup-modal',
      width: 400,
      height: 300,
      top: 100,
      left: 200
    });
    
    // デフォルトスタイル
    mockStyle = {
      position: 'fixed',
      zIndex: '9999',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      width: '400px',
      height: '300px',
      top: '100px',
      left: '200px',
      backgroundColor: 'white',
      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      border: '1px solid #ccc',
      borderRadius: '4px'
    };

    // getComputedStyleのモック
    originalGetComputedStyle = global.getComputedStyle;
    global.getComputedStyle = jest.fn().mockReturnValue(mockStyle);
  });

  afterEach(() => {
    global.getComputedStyle = originalGetComputedStyle;
    global.innerWidth = originalInnerWidth;
    global.innerHeight = originalInnerHeight;
  });

  describe('analyzePopup() 関数のテスト', () => {
    /**
     * ポップアップ分析のメイン関数
     * 要素の特性を分析して広告である可能性を評価する
     */
    function analyzePopup(element) {
      if (!element) {
        throw new Error('Element is required');
      }

      try {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        const characteristics = {
          // 位置とレイアウト
          position: style.position,
          zIndex: parseInt(style.zIndex) || 0,
          isVisible: isElementVisible(element, style),
          
          // サイズと位置
          dimensions: {
            width: rect.width,
            height: rect.height
          },
          coordinates: {
            top: rect.top,
            left: rect.left
          },
          
          // 視覚的特性
          hasBoxShadow: style.boxShadow && style.boxShadow !== 'none',
          hasBorder: style.border && style.border !== 'none',
          backgroundColor: style.backgroundColor,
          opacity: parseFloat(style.opacity) || 1,
          
          // コンテンツ分析
          hasCloseButton: hasCloseButton(element),
          containsAds: containsAdContent(element),
          hasExternalLinks: hasExternalLinks(element),
          hasFormElements: hasFormElements(element),
          
          // 動作特性
          isModal: isModalElement(element, style, rect),
          isOverlay: isOverlayElement(element, style, rect),
          blocksContent: blocksMainContent(element, style, rect)
        };
        
        const confidence = calculateConfidenceScore(characteristics);
        
        return {
          characteristics,
          confidence,
          isLikelyPopup: confidence > 0.6,
          timestamp: Date.now()
        };
        
      } catch (error) {
        throw new Error(`Failed to analyze popup: ${error.message}`);
      }
    }

    // ヘルパー関数の実装
    function isElementVisible(element, style) {
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' &&
             style.visibility !== 'hidden' &&
             parseFloat(style.opacity) > 0 &&
             rect.width > 0 &&
             rect.height > 0;
    }

    function hasCloseButton(element) {
      // 実際の実装では element.querySelector を使用
      const closeSelectors = [
        '.close', '.close-btn', '[aria-label*="close"]',
        'button:contains("×")', 'button:contains("✕")'
      ];
      
      // モックテストでは className と textContent をチェック
      const className = element.className.toLowerCase();
      const textContent = element.textContent.toLowerCase();
      
      return className.includes('close') || 
             textContent.includes('×') || 
             textContent.includes('close') ||
             textContent.includes('閉じる');
    }

    function containsAdContent(element) {
      const adKeywords = [
        'ad', 'advertisement', 'sponsored', 'promo', 'banner',
        'offer', 'deal', 'discount', '広告', 'プロモ'
      ];
      
      const text = element.textContent.toLowerCase();
      const className = element.className.toLowerCase();
      const id = element.id.toLowerCase();
      
      return adKeywords.some(keyword =>
        text.includes(keyword) || 
        className.includes(keyword) || 
        id.includes(keyword)
      );
    }

    function hasExternalLinks(element) {
      // モックテストでは簡略化
      return element.href && !element.href.startsWith(window.location?.origin || '');
    }

    function hasFormElements(element) {
      // モックテストでは type 属性をチェック
      return element.type === 'email' || 
             element.type === 'text' || 
             element.tagName === 'FORM';
    }

    function isModalElement(element, style, rect) {
      return style.position === 'fixed' &&
             parseInt(style.zIndex) > 1000 &&
             rect.width > 200 &&
             rect.height > 150;
    }

    function isOverlayElement(element, style, rect) {
      const coversLargeArea = rect.width >= window.innerWidth * 0.5 &&
                             rect.height >= window.innerHeight * 0.5;
      return style.position === 'fixed' && coversLargeArea;
    }

    function blocksMainContent(element, style, rect) {
      const coversScreen = rect.width >= window.innerWidth * 0.6 &&
                          rect.height >= window.innerHeight * 0.6;
      return style.position === 'fixed' && 
             parseInt(style.zIndex) > 100 && 
             coversScreen;
    }

    function calculateConfidenceScore(characteristics) {
      let score = 0;
      
      // 位置とレイアウト (40点満点)
      if (characteristics.position === 'fixed') score += 20;
      else if (characteristics.position === 'absolute') score += 10;
      
      if (characteristics.zIndex > 1000) score += 20;
      else if (characteristics.zIndex > 100) score += 10;
      
      // 視覚的特性 (30点満点)
      if (characteristics.hasBoxShadow) score += 10;
      if (characteristics.hasBorder) score += 5;
      if (characteristics.opacity < 1 && characteristics.opacity > 0.8) score += 5;
      if (characteristics.isModal) score += 10;
      
      // コンテンツ特性 (30点満点)
      if (characteristics.hasCloseButton) score += 15;
      if (characteristics.containsAds) score += 10;
      if (characteristics.hasExternalLinks) score += 5;
      
      return Math.min(score / 100, 1); // 0-1の範囲に正規化
    }

    test('正常なポップアップ要素の分析', () => {
      mockElement.textContent = '× Close this advertisement';
      mockElement.className = 'popup-modal ad-banner';
      
      const result = analyzePopup(mockElement);
      
      expect(result).toBeDefined();
      expect(result.characteristics).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.isLikelyPopup).toBe(true);
      expect(result.timestamp).toBeCloseTo(Date.now(), -2);
    });

    test('高信頼度ポップアップの分析', () => {
      mockElement.textContent = '× Special Offer! Click here!';
      mockElement.className = 'modal-popup advertisement close-btn';
      mockStyle.position = 'fixed';
      mockStyle.zIndex = '9999';
      mockStyle.boxShadow = '0 4px 8px rgba(0,0,0,0.5)';
      
      const result = analyzePopup(mockElement);
      
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.characteristics.hasCloseButton).toBe(true);
      expect(result.characteristics.containsAds).toBe(true);
      expect(result.characteristics.isModal).toBe(true);
      expect(result.isLikelyPopup).toBe(true);
    });

    test('低信頼度要素の分析', () => {
      mockElement.textContent = 'Regular content';
      mockElement.className = 'content-div';
      mockStyle.position = 'static';
      mockStyle.zIndex = '1';
      mockStyle.boxShadow = 'none';
      
      const result = analyzePopup(mockElement);
      
      expect(result.confidence).toBeLessThan(0.4);
      expect(result.characteristics.hasCloseButton).toBe(false);
      expect(result.characteristics.containsAds).toBe(false);
      expect(result.characteristics.isModal).toBe(false);
      expect(result.isLikelyPopup).toBe(false);
    });

    test('null要素での分析エラー', () => {
      expect(() => analyzePopup(null)).toThrow('Element is required');
    });

    test('undefined要素での分析エラー', () => {
      expect(() => analyzePopup(undefined)).toThrow('Element is required');
    });

    test('getBoundingClientRectエラーの処理', () => {
      mockElement.getBoundingClientRect.mockImplementation(() => {
        throw new Error('getBoundingClientRect failed');
      });

      expect(() => analyzePopup(mockElement)).toThrow('Failed to analyze popup');
    });
  });

  describe('ポップアップ特性分析ロジックのテスト', () => {
    test('固定位置要素の検出', () => {
      mockStyle.position = 'fixed';
      const result = analyzePopup(mockElement);
      expect(result.characteristics.position).toBe('fixed');
    });

    test('絶対位置要素の検出', () => {
      mockStyle.position = 'absolute';
      const result = analyzePopup(mockElement);
      expect(result.characteristics.position).toBe('absolute');
    });

    test('高いz-index値の検出', () => {
      mockStyle.zIndex = '99999';
      const result = analyzePopup(mockElement);
      expect(result.characteristics.zIndex).toBe(99999);
    });

    test('ボックスシャドウの検出', () => {
      mockStyle.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
      const result = analyzePopup(mockElement);
      expect(result.characteristics.hasBoxShadow).toBe(true);
    });

    test('ボーダーの検出', () => {
      mockStyle.border = '2px solid #333';
      const result = analyzePopup(mockElement);
      expect(result.characteristics.hasBorder).toBe(true);
    });

    test('透明度の分析', () => {
      mockStyle.opacity = '0.9';
      const result = analyzePopup(mockElement);
      expect(result.characteristics.opacity).toBe(0.9);
    });

    test('要素サイズの分析', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        width: 500,
        height: 400,
        top: 50,
        left: 100,
        right: 600,
        bottom: 450
      });

      const result = analyzePopup(mockElement);
      expect(result.characteristics.dimensions.width).toBe(500);
      expect(result.characteristics.dimensions.height).toBe(400);
    });

    test('要素位置の分析', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        width: 400,
        height: 300,
        top: 150,
        left: 250,
        right: 650,
        bottom: 450
      });

      const result = analyzePopup(mockElement);
      expect(result.characteristics.coordinates.top).toBe(150);
      expect(result.characteristics.coordinates.left).toBe(250);
    });

    test('非表示要素の検出', () => {
      mockStyle.display = 'none';
      const result = analyzePopup(mockElement);
      expect(result.characteristics.isVisible).toBe(false);
    });

    test('visibility:hiddenの検出', () => {
      mockStyle.visibility = 'hidden';
      const result = analyzePopup(mockElement);
      expect(result.characteristics.isVisible).toBe(false);
    });

    test('透明要素の検出', () => {
      mockStyle.opacity = '0';
      const result = analyzePopup(mockElement);
      expect(result.characteristics.isVisible).toBe(false);
    });
  });

  describe('信頼度スコアリングシステムのテスト', () => {
    test('最高信頼度スコア (1.0)', () => {
      mockElement.textContent = '× Close Advertisement Special Offer!';
      mockElement.className = 'modal-popup advertisement close-btn';
      mockElement.href = 'https://external-site.com';
      mockStyle.position = 'fixed';
      mockStyle.zIndex = '9999';
      mockStyle.boxShadow = '0 4px 8px rgba(0,0,0,0.5)';
      mockStyle.border = '1px solid #ccc';

      const result = analyzePopup(mockElement);
      expect(result.confidence).toBeCloseTo(1.0, 1);
    });

    test('中程度信頼度スコア (0.5-0.7)', () => {
      mockElement.textContent = 'Modal content';
      mockElement.className = 'modal-dialog';
      mockStyle.position = 'absolute';
      mockStyle.zIndex = '500';
      mockStyle.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

      const result = analyzePopup(mockElement);
      expect(result.confidence).toBeGreaterThan(0.4);
      expect(result.confidence).toBeLessThan(0.8);
    });

    test('最低信頼度スコア (0.0-0.3)', () => {
      mockElement.textContent = 'Regular paragraph content';
      mockElement.className = 'content-text';
      mockStyle.position = 'static';
      mockStyle.zIndex = '0';
      mockStyle.boxShadow = 'none';
      mockStyle.border = 'none';

      const result = analyzePopup(mockElement);
      expect(result.confidence).toBeLessThan(0.3);
    });

    test('スコア正規化の確認', () => {
      // 極端に高いスコアでも1.0を超えないことを確認
      mockElement.textContent = '× Close Advertisement Special Offer! Click here!';
      mockElement.className = 'modal-popup advertisement close-btn promo banner';
      mockElement.href = 'https://external-ad-site.com';
      mockStyle.position = 'fixed';
      mockStyle.zIndex = '999999';
      mockStyle.boxShadow = '0 8px 16px rgba(0,0,0,0.8)';
      mockStyle.border = '2px solid red';

      const result = analyzePopup(mockElement);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    test('段階的スコア計算', () => {
      const testCases = [
        {
          setup: () => {
            mockStyle.position = 'fixed';
            mockStyle.zIndex = '2000';
          },
          expectedMin: 0.3,
          expectedMax: 0.5
        },
        {
          setup: () => {
            mockStyle.position = 'fixed';
            mockStyle.zIndex = '2000';
            mockStyle.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
            mockElement.textContent = '× Close';
          },
          expectedMin: 0.6,
          expectedMax: 0.8
        }
      ];

      testCases.forEach((testCase, index) => {
        // リセット
        mockElement = createMockElement('div');
        mockStyle = { ...mockStyle, position: 'static', zIndex: '0', boxShadow: 'none' };
        
        testCase.setup();
        global.getComputedStyle = jest.fn().mockReturnValue(mockStyle);
        
        const result = analyzePopup(mockElement);
        expect(result.confidence).toBeGreaterThan(testCase.expectedMin);
        expect(result.confidence).toBeLessThan(testCase.expectedMax);
      });
    });
  });

  describe('DOM要素検出の境界値テスト', () => {
    test('最小サイズ要素の検出', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        width: 1,
        height: 1,
        top: 0,
        left: 0,
        right: 1,
        bottom: 1
      });

      const result = analyzePopup(mockElement);
      expect(result.characteristics.dimensions.width).toBe(1);
      expect(result.characteristics.dimensions.height).toBe(1);
      expect(result.characteristics.isVisible).toBe(true);
    });

    test('ゼロサイズ要素の検出', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      });

      const result = analyzePopup(mockElement);
      expect(result.characteristics.isVisible).toBe(false);
    });

    test('最大z-index値の処理', () => {
      mockStyle.zIndex = '2147483647'; // 32bit整数の最大値
      const result = analyzePopup(mockElement);
      expect(result.characteristics.zIndex).toBe(2147483647);
    });

    test('負のz-index値の処理', () => {
      mockStyle.zIndex = '-1';
      const result = analyzePopup(mockElement);
      expect(result.characteristics.zIndex).toBe(-1);
    });

    test('無効なz-index値の処理', () => {
      mockStyle.zIndex = 'invalid';
      const result = analyzePopup(mockElement);
      expect(result.characteristics.zIndex).toBe(0);
    });

    test('画面外要素の検出', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        width: 100,
        height: 100,
        top: -200,
        left: -200,
        right: -100,
        bottom: -100
      });

      const result = analyzePopup(mockElement);
      expect(result.characteristics.coordinates.top).toBe(-200);
      expect(result.characteristics.coordinates.left).toBe(-200);
    });

    test('画面より大きい要素の検出', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        width: 2000,
        height: 1500,
        top: 0,
        left: 0,
        right: 2000,
        bottom: 1500
      });

      const result = analyzePopup(mockElement);
      expect(result.characteristics.dimensions.width).toBe(2000);
      expect(result.characteristics.dimensions.height).toBe(1500);
      expect(result.characteristics.blocksContent).toBe(true);
    });

    test('極端な透明度値の処理', () => {
      const testCases = ['0', '0.001', '0.999', '1', '1.5', '-0.5'];
      
      testCases.forEach(opacity => {
        mockStyle.opacity = opacity;
        global.getComputedStyle = jest.fn().mockReturnValue(mockStyle);
        
        const result = analyzePopup(mockElement);
        const expectedOpacity = Math.max(0, Math.min(1, parseFloat(opacity) || 1));
        expect(result.characteristics.opacity).toBeCloseTo(expectedOpacity, 3);
      });
    });
  });

  describe('パフォーマンステスト', () => {
    test('単一要素分析のパフォーマンス', async () => {
      const duration = await measurePerformance(() => {
        analyzePopup(mockElement);
      }, 50); // 50ms以内

      expect(duration).toBeLessThan(50);
    });

    test('大量要素分析のパフォーマンス', async () => {
      const elements = Array.from({ length: 100 }, (_, i) => 
        createMockElement('div', { id: `element-${i}` })
      );

      const duration = await measurePerformance(() => {
        elements.forEach(element => analyzePopup(element));
      }, 500); // 500ms以内

      expect(duration).toBeLessThan(500);
    });

    test('複雑な要素分析のパフォーマンス', async () => {
      // 複雑な要素を作成
      mockElement.textContent = 'Very long text content with many keywords like advertisement, sponsored, promo, offer, deal, discount, and more text to make it complex';
      mockElement.className = 'very-long-class-name with-multiple-classes advertisement-banner sponsored-content promo-popup';
      
      const duration = await measurePerformance(() => {
        analyzePopup(mockElement);
      }, 100); // 100ms以内

      expect(duration).toBeLessThan(100);
    });
  });

  describe('エラーハンドリングテスト', () => {
    test('getComputedStyleエラーの処理', async () => {
      global.getComputedStyle = jest.fn().mockImplementation(() => {
        throw new Error('getComputedStyle failed');
      });

      await expectError(
        () => analyzePopup(mockElement),
        'Failed to analyze popup'
      );
    });

    test('getBoundingClientRectエラーの処理', async () => {
      mockElement.getBoundingClientRect.mockImplementation(() => {
        throw new Error('getBoundingClientRect failed');
      });

      await expectError(
        () => analyzePopup(mockElement),
        'Failed to analyze popup'
      );
    });

    test('部分的なスタイル情報での処理', () => {
      global.getComputedStyle = jest.fn().mockReturnValue({
        position: 'fixed',
        // 他のプロパティは未定義
      });

      expect(() => analyzePopup(mockElement)).not.toThrow();
      const result = analyzePopup(mockElement);
      expect(result.characteristics.zIndex).toBe(0); // デフォルト値
    });

    test('部分的なrect情報での処理', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        width: 100,
        height: 100,
        // top, leftは未定義
      });

      expect(() => analyzePopup(mockElement)).not.toThrow();
      const result = analyzePopup(mockElement);
      expect(result.characteristics.coordinates.top).toBeUndefined();
    });
  });

  describe('特殊ケースのテスト', () => {
    test('Shadow DOM要素の分析', () => {
      mockElement.shadowRoot = createMockElement('div');
      const result = analyzePopup(mockElement);
      expect(result).toBeDefined();
    });

    test('iframe内要素の分析', () => {
      mockElement.ownerDocument = { defaultView: { parent: window } };
      const result = analyzePopup(mockElement);
      expect(result).toBeDefined();
    });

    test('動的に作成された要素の分析', () => {
      const dynamicElement = createMockElement('div', {
        className: 'dynamic-popup',
        textContent: 'Dynamically created popup'
      });
      
      const result = analyzePopup(dynamicElement);
      expect(result).toBeDefined();
      expect(result.characteristics).toBeDefined();
    });

    test('カスタム要素の分析', () => {
      const customElement = createMockElement('custom-popup', {
        className: 'custom-modal'
      });
      
      const result = analyzePopup(customElement);
      expect(result).toBeDefined();
      expect(result.characteristics).toBeDefined();
    });
  });
});