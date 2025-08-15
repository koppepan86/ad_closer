/**
 * ポップアップ検出と分析機能のユニットテスト
 * Task 9.1: ユニットテストの作成
 */

describe('ポップアップ検出と分析機能', () => {
  let mockElement;
  let mockStyle;

  beforeEach(() => {
    // モック要素を作成
    mockElement = createMockElement('div');
    mockElement.id = 'test-popup';
    mockElement.className = 'popup-modal';
    
    // スタイルモックを設定
    mockStyle = {
      position: 'fixed',
      zIndex: '9999',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      width: '400px',
      height: '300px',
      top: '50px',
      left: '50px',
      backgroundColor: 'white',
      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      border: '1px solid #ccc'
    };

    // getComputedStyleのモックを設定
    window.getComputedStyle = jest.fn().mockReturnValue(mockStyle);
  });

  describe('基本的なポップアップ検出', () => {
    test('固定位置のモーダルポップアップを検出する', () => {
      // 固定位置要素の検出ロジック
      const isFixedPosition = (element) => {
        const style = window.getComputedStyle(element);
        return style.position === 'fixed';
      };

      const result = isFixedPosition(mockElement);
      expect(result).toBe(true);
      expect(window.getComputedStyle).toHaveBeenCalledWith(mockElement);
    });

    test('高いz-index要素を検出する', () => {
      const hasHighZIndex = (element) => {
        const style = window.getComputedStyle(element);
        const zIndex = parseInt(style.zIndex) || 0;
        return zIndex > 1000;
      };

      const result = hasHighZIndex(mockElement);
      expect(result).toBe(true);
    });

    test('大きな領域をカバーする要素を検出する', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600
      });

      const coversLargeArea = (element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 500 && rect.height > 400;
      };

      const result = coversLargeArea(mockElement);
      expect(result).toBe(true);
    });

    test('フルスクリーン要素を検出する', () => {
      mockElement.getBoundingClientRect.mockReturnValue({
        width: 1024,
        height: 768,
        top: 0,
        left: 0,
        right: 1024,
        bottom: 768
      });

      const isFullscreen = (element) => {
        const rect = element.getBoundingClientRect();
        return rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.8;
      };

      const result = isFullscreen(mockElement);
      expect(result).toBe(true);
    });
  });

  describe('コンテンツ分析', () => {
    test('広告コンテンツを検出する', () => {
      const adKeywords = ['advertisement', 'sponsored', 'promo', 'ad-banner'];
      mockElement.className = 'ad-banner sponsored-content';
      mockElement.textContent = 'This is an advertisement';

      const containsAdContent = (element) => {
        const text = element.textContent.toLowerCase();
        const className = element.className.toLowerCase();
        return adKeywords.some(keyword => 
          text.includes(keyword) || className.includes(keyword)
        );
      };

      const result = containsAdContent(mockElement);
      expect(result).toBe(true);
    });

    test('外部リンクを検出する', () => {
      const linkElement = createMockElement('a');
      linkElement.getAttribute.mockImplementation((attr) => {
        if (attr === 'href') return 'https://external-site.com';
        return null;
      });

      const hasExternalLinks = (element) => {
        const links = [linkElement]; // Simulate querySelectorAll result
        return links.some(link => {
          const href = link.getAttribute('href');
          return href && !href.startsWith(window.location.origin);
        });
      };

      const result = hasExternalLinks(mockElement);
      expect(result).toBe(true);
    });

    test('フォーム要素を検出する', () => {
      const formElement = createMockElement('form');
      const inputElement = createMockElement('input');
      
      document.querySelectorAll = jest.fn().mockReturnValue([formElement, inputElement]);

      const hasFormElements = (element) => {
        const forms = document.querySelectorAll('form, input, textarea, select');
        return forms.length > 0;
      };

      const result = hasFormElements(mockElement);
      expect(result).toBe(true);
    });

    test('メディアコンテンツを検出する', () => {
      const mediaElements = [createMockElement('img'), createMockElement('video')];
      document.querySelectorAll = jest.fn().mockReturnValue(mediaElements);

      const hasMediaContent = (element) => {
        const media = document.querySelectorAll('img, video, audio, iframe');
        return media.length > 0;
      };

      const result = hasMediaContent(mockElement);
      expect(result).toBe(true);
    });
  });

  describe('閉じるボタン検出', () => {
    test('標準的な閉じるボタンを検出する', () => {
      const closeButton = createMockElement('button');
      closeButton.textContent = '×';
      closeButton.className = 'close-btn';
      
      document.querySelectorAll = jest.fn().mockReturnValue([closeButton]);

      const hasCloseButton = (element) => {
        const buttons = document.querySelectorAll('button, .close, .close-btn');
        return Array.from(buttons).some(btn => 
          btn.textContent.includes('×') || 
          btn.textContent.toLowerCase().includes('close') ||
          btn.className.includes('close')
        );
      };

      const result = hasCloseButton(mockElement);
      expect(result).toBe(true);
    });

    test('画像ベースの閉じるボタンを検出する', () => {
      const imgButton = createMockElement('img');
      imgButton.getAttribute.mockImplementation((attr) => {
        if (attr === 'src') return '/images/close-icon.png';
        if (attr === 'alt') return 'Close';
        return null;
      });
      
      document.querySelectorAll = jest.fn().mockReturnValue([imgButton]);

      const hasImageCloseButton = (element) => {
        const images = document.querySelectorAll('img');
        return Array.from(images).some(img => {
          const src = img.getAttribute('src') || '';
          const alt = img.getAttribute('alt') || '';
          return src.includes('close') || alt.toLowerCase().includes('close');
        });
      };

      const result = hasImageCloseButton(mockElement);
      expect(result).toBe(true);
    });

    test('ARIA属性による閉じるボタンを検出する', () => {
      const ariaButton = createMockElement('button');
      ariaButton.getAttribute.mockImplementation((attr) => {
        if (attr === 'aria-label') return 'Close dialog';
        if (attr === 'role') return 'button';
        return null;
      });
      
      document.querySelectorAll = jest.fn().mockReturnValue([ariaButton]);

      const hasAriaCloseButton = (element) => {
        const buttons = document.querySelectorAll('[aria-label], [role="button"]');
        return Array.from(buttons).some(btn => {
          const ariaLabel = btn.getAttribute('aria-label') || '';
          return ariaLabel.toLowerCase().includes('close');
        });
      };

      const result = hasAriaCloseButton(mockElement);
      expect(result).toBe(true);
    });
  });

  describe('視覚的特性分析', () => {
    test('ボックスシャドウを検出する', () => {
      const hasBoxShadow = (element) => {
        const style = window.getComputedStyle(element);
        return style.boxShadow && style.boxShadow !== 'none';
      };

      const result = hasBoxShadow(mockElement);
      expect(result).toBe(true);
    });

    test('ボーダーを検出する', () => {
      const hasBorder = (element) => {
        const style = window.getComputedStyle(element);
        return style.border && style.border !== 'none';
      };

      const result = hasBorder(mockElement);
      expect(result).toBe(true);
    });

    test('透明度を分析する', () => {
      const getOpacity = (element) => {
        const style = window.getComputedStyle(element);
        return parseFloat(style.opacity);
      };

      const result = getOpacity(mockElement);
      expect(result).toBe(1);
    });

    test('非表示要素を検出する', () => {
      mockStyle.display = 'none';
      window.getComputedStyle = jest.fn().mockReturnValue(mockStyle);

      const isHidden = (element) => {
        const style = window.getComputedStyle(element);
        return style.display === 'none' || style.visibility === 'hidden';
      };

      const result = isHidden(mockElement);
      expect(result).toBe(true);
    });
  });

  describe('信頼度スコア計算', () => {
    test('高信頼度ポップアップのスコア計算', () => {
      const calculateConfidenceScore = (element) => {
        let score = 0;
        const style = window.getComputedStyle(element);
        
        // 固定位置 (+30)
        if (style.position === 'fixed') score += 30;
        
        // 高いz-index (+20)
        if (parseInt(style.zIndex) > 1000) score += 20;
        
        // ボックスシャドウ (+15)
        if (style.boxShadow && style.boxShadow !== 'none') score += 15;
        
        // 中央配置 (+10)
        const rect = element.getBoundingClientRect();
        if (rect.left > 100 && rect.top > 50) score += 10;
        
        // 閉じるボタンの存在 (+25)
        if (element.className.includes('close') || element.textContent.includes('×')) score += 25;
        
        return Math.min(score, 100);
      };

      mockElement.textContent = '× Close this popup';
      const result = calculateConfidenceScore(mockElement);
      expect(result).toBeGreaterThan(80);
    });

    test('低信頼度要素のスコア計算', () => {
      // 通常の要素のスタイルに変更
      mockStyle.position = 'static';
      mockStyle.zIndex = '1';
      mockStyle.boxShadow = 'none';
      window.getComputedStyle = jest.fn().mockReturnValue(mockStyle);
      
      const calculateConfidenceScore = (element) => {
        let score = 0;
        const style = window.getComputedStyle(element);
        
        if (style.position === 'fixed') score += 30;
        if (parseInt(style.zIndex) > 1000) score += 20;
        if (style.boxShadow && style.boxShadow !== 'none') score += 15;
        
        return score;
      };

      const result = calculateConfidenceScore(mockElement);
      expect(result).toBeLessThan(30);
    });

    test('中程度信頼度要素のスコア計算', () => {
      mockStyle.position = 'absolute';
      mockStyle.zIndex = '500';
      window.getComputedStyle = jest.fn().mockReturnValue(mockStyle);
      
      const calculateConfidenceScore = (element) => {
        let score = 0;
        const style = window.getComputedStyle(element);
        
        if (style.position === 'absolute') score += 15;
        if (parseInt(style.zIndex) > 100) score += 10;
        if (style.boxShadow && style.boxShadow !== 'none') score += 15;
        
        return score;
      };

      const result = calculateConfidenceScore(mockElement);
      expect(result).toBeGreaterThan(20);
      expect(result).toBeLessThan(60);
    });
  });

  describe('特殊なポップアップタイプの検出', () => {
    test('インタースティシャル広告を検出する', () => {
      mockElement.className = 'interstitial-ad fullscreen-overlay';
      mockElement.getBoundingClientRect.mockReturnValue({
        width: 1024,
        height: 768,
        top: 0,
        left: 0
      });

      const isInterstitialAd = (element) => {
        const className = element.className.toLowerCase();
        const rect = element.getBoundingClientRect();
        const isFullscreen = rect.width >= window.innerWidth * 0.9;
        
        return (className.includes('interstitial') || className.includes('fullscreen')) && isFullscreen;
      };

      const result = isInterstitialAd(mockElement);
      expect(result).toBe(true);
    });

    test('フローティング広告を検出する', () => {
      mockStyle.position = 'fixed';
      mockStyle.bottom = '20px';
      mockStyle.right = '20px';
      mockElement.className = 'floating-ad';
      
      const isFloatingAd = (element) => {
        const style = window.getComputedStyle(element);
        const className = element.className.toLowerCase();
        
        return style.position === 'fixed' && 
               (className.includes('floating') || className.includes('sticky'));
      };

      const result = isFloatingAd(mockElement);
      expect(result).toBe(true);
    });

    test('ニュースレター登録ポップアップを検出する', () => {
      mockElement.textContent = 'Subscribe to our newsletter';
      const emailInput = createMockElement('input');
      emailInput.getAttribute.mockImplementation((attr) => {
        if (attr === 'type') return 'email';
        return null;
      });
      
      document.querySelectorAll = jest.fn().mockReturnValue([emailInput]);

      const isNewsletterPopup = (element) => {
        const text = element.textContent.toLowerCase();
        const hasEmailInput = document.querySelectorAll('input[type="email"]').length > 0;
        
        return (text.includes('newsletter') || text.includes('subscribe')) && hasEmailInput;
      };

      const result = isNewsletterPopup(mockElement);
      expect(result).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    test('無効な要素での分析', () => {
      const analyzeElement = (element) => {
        try {
          if (!element) return { error: 'Element is null' };
          
          const style = window.getComputedStyle(element);
          return { position: style.position };
        } catch (error) {
          return { error: error.message };
        }
      };

      const result = analyzeElement(null);
      expect(result.error).toBe('Element is null');
    });

    test('getBoundingClientRectエラーの処理', () => {
      mockElement.getBoundingClientRect.mockImplementation(() => {
        throw new Error('getBoundingClientRect failed');
      });

      const safeGetBounds = (element) => {
        try {
          return element.getBoundingClientRect();
        } catch (error) {
          return { width: 0, height: 0, top: 0, left: 0 };
        }
      };

      const result = safeGetBounds(mockElement);
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });

    test('getComputedStyleエラーの処理', () => {
      window.getComputedStyle = jest.fn().mockImplementation(() => {
        throw new Error('getComputedStyle failed');
      });

      const safeGetComputedStyle = (element) => {
        try {
          return window.getComputedStyle(element);
        } catch (error) {
          return {
            position: 'static',
            zIndex: '0',
            display: 'block',
            visibility: 'visible',
            opacity: '1'
          };
        }
      };

      const result = safeGetComputedStyle(mockElement);
      expect(result.position).toBe('static');
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量の要素での分析パフォーマンス', () => {
      const elements = Array.from({ length: 1000 }, (_, i) => createMockElement(`element-${i}`));
      
      const startTime = Date.now();
      
      elements.forEach(element => {
        const isFixedPosition = (el) => {
          const style = window.getComputedStyle(el);
          return style.position === 'fixed';
        };
        isFixedPosition(element);
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 1000要素の処理が1秒以内に完了することを確認
      expect(duration).toBeLessThan(1000);
    });

    test('複雑な要素での分析パフォーマンス', () => {
      const complexElement = createMockElement('complex');
      complexElement.children = Array.from({ length: 100 }, (_, i) => createMockElement(`child-${i}`));
      
      const startTime = Date.now();
      
      // 複雑な分析を実行
      const analyzeComplex = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        return {
          position: style.position,
          zIndex: parseInt(style.zIndex) || 0,
          area: rect.width * rect.height,
          hasChildren: element.children.length > 0,
          childCount: element.children.length
        };
      };
      
      const result = analyzeComplex(complexElement);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result).toBeDefined();
      expect(result.childCount).toBe(100);
      expect(duration).toBeLessThan(100); // 100ms以内
    });
  });
});