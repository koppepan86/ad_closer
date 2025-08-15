/**
 * 統合テスト: クロスウェブサイト機能
 * 
 * このテストスイートは、異なるウェブサイトでの拡張機能の動作と
 * サイト固有の適応機能をテストします。
 */

describe('クロスウェブサイト機能統合テスト', () => {
  let mockChrome;
  let mockDocument;
  let mockWindow;

  beforeEach(() => {
    // Chrome API のモック設定
    mockChrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        }
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn()
        }
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn()
      }
    };

    global.chrome = mockChrome;

    // DOM環境のモック設定
    mockDocument = {
      createElement: jest.fn(),
      getElementById: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      body: {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        style: {}
      },
      head: {
        appendChild: jest.fn()
      }
    };

    mockWindow = {
      location: {
        href: 'https://example.com',
        hostname: 'example.com',
        protocol: 'https:'
      },
      getComputedStyle: jest.fn(),
      MutationObserver: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      setTimeout: jest.fn(),
      clearTimeout: jest.fn()
    };

    global.document = mockDocument;
    global.window = mockWindow;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('異なるウェブサイトタイプでの動作', () => {
    test('静的HTMLサイトでのポップアップ検出', async () => {
      // 静的サイトのポップアップをシミュレート
      const staticPopup = {
        tagName: 'DIV',
        id: 'static-popup',
        className: 'modal-overlay',
        style: {
          position: 'fixed',
          zIndex: '9999',
          width: '400px',
          height: '300px',
          display: 'block'
        },
        innerHTML: '<div class="ad-content">広告</div><button class="close">×</button>'
      };

      mockDocument.querySelector.mockReturnValue(staticPopup);
      mockWindow.getComputedStyle.mockReturnValue({
        position: 'fixed',
        zIndex: '9999',
        display: 'block',
        width: '400px',
        height: '300px'
      });

      const analyzeStaticPopup = (element) => {
        const computedStyle = window.getComputedStyle(element);
        
        return {
          id: element.id,
          isModal: computedStyle.position === 'fixed',
          zIndex: parseInt(computedStyle.zIndex),
          hasCloseButton: element.innerHTML.includes('close'),
          containsAds: element.innerHTML.includes('広告'),
          confidence: 0.8
        };
      };

      const analysis = analyzeStaticPopup(staticPopup);

      expect(analysis.isModal).toBe(true);
      expect(analysis.zIndex).toBe(9999);
      expect(analysis.hasCloseButton).toBe(true);
      expect(analysis.containsAds).toBe(true);
      expect(analysis.confidence).toBe(0.8);
    });

    test('SPAでの動的ポップアップ検出', async () => {
      // React/Vue等のSPAでの動的ポップアップをシミュレート
      const spaPopup = {
        tagName: 'DIV',
        className: 'react-modal-overlay',
        getAttribute: jest.fn((attr) => {
          const attrs = {
            'data-testid': 'modal',
            'role': 'dialog',
            'aria-modal': 'true'
          };
          return attrs[attr];
        }),
        style: {
          position: 'fixed',
          zIndex: '1000',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%'
        }
      };

      mockWindow.getComputedStyle.mockReturnValue({
        position: 'fixed',
        zIndex: '1000',
        display: 'flex',
        width: '100%',
        height: '100%'
      });

      const analyzeSPAPopup = (element) => {
        const isModal = element.getAttribute('role') === 'dialog' ||
                       element.getAttribute('aria-modal') === 'true';
        const computedStyle = window.getComputedStyle(element);
        
        return {
          isSPAModal: isModal,
          isFullscreen: computedStyle.width === '100%' && computedStyle.height === '100%',
          hasARIAAttributes: !!element.getAttribute('aria-modal'),
          framework: element.className.includes('react') ? 'React' : 'Unknown',
          confidence: isModal ? 0.9 : 0.6
        };
      };

      const analysis = analyzeSPAPopup(spaPopup);

      expect(analysis.isSPAModal).toBe(true);
      expect(analysis.isFullscreen).toBe(true);
      expect(analysis.hasARIAAttributes).toBe(true);
      expect(analysis.framework).toBe('React');
      expect(analysis.confidence).toBe(0.9);
    });

    test('eコマースサイトでのポップアップ分類', async () => {
      // eコマースサイト特有のポップアップをテスト
      const ecommercePopups = [
        {
          type: 'newsletter',
          element: {
            innerHTML: '<form><input type="email" placeholder="メールアドレス"><button>登録</button></form>',
            className: 'newsletter-popup'
          }
        },
        {
          type: 'cart-abandonment',
          element: {
            innerHTML: '<div>カートに商品が残っています</div><button>購入を続ける</button>',
            className: 'cart-reminder'
          }
        },
        {
          type: 'promotion',
          element: {
            innerHTML: '<div>50%オフセール！</div><button>今すぐ購入</button>',
            className: 'promo-popup'
          }
        }
      ];

      const classifyEcommercePopup = (popup) => {
        const content = popup.element.innerHTML;
        const className = popup.element.className;

        if (content.includes('メール') && content.includes('登録')) {
          return { type: 'newsletter', legitimacy: 'questionable', confidence: 0.7 };
        }
        if (content.includes('カート') && content.includes('商品')) {
          return { type: 'cart-reminder', legitimacy: 'legitimate', confidence: 0.9 };
        }
        if (content.includes('セール') || content.includes('オフ')) {
          return { type: 'promotion', legitimacy: 'advertisement', confidence: 0.8 };
        }

        return { type: 'unknown', legitimacy: 'unknown', confidence: 0.5 };
      };

      const results = ecommercePopups.map(popup => ({
        ...popup,
        classification: classifyEcommercePopup(popup)
      }));

      expect(results[0].classification.type).toBe('newsletter');
      expect(results[0].classification.legitimacy).toBe('questionable');
      expect(results[1].classification.type).toBe('cart-reminder');
      expect(results[1].classification.legitimacy).toBe('legitimate');
      expect(results[2].classification.type).toBe('promotion');
      expect(results[2].classification.legitimacy).toBe('advertisement');
    });
  });

  describe('ドメイン固有の適応', () => {
    test('YouTube特有のポップアップ処理', async () => {
      mockWindow.location.hostname = 'www.youtube.com';

      const youtubePopups = [
        {
          className: 'ytd-popup-container',
          innerHTML: '<div>YouTubeプレミアムを試してみませんか？</div>'
        },
        {
          className: 'ytp-ad-overlay-container',
          innerHTML: '<div class="ytp-ad-text">広告</div>'
        },
        {
          className: 'consent-bump-v2',
          innerHTML: '<div>Cookieの使用に同意しますか？</div>'
        }
      ];

      const analyzeYouTubePopup = (element) => {
        const hostname = window.location.hostname;
        
        if (hostname !== 'www.youtube.com') {
          return { applicable: false };
        }

        if (element.className.includes('ytd-popup')) {
          return {
            type: 'youtube-premium-promo',
            legitimacy: 'advertisement',
            shouldBlock: true,
            confidence: 0.9
          };
        }
        
        if (element.className.includes('ytp-ad')) {
          return {
            type: 'video-ad-overlay',
            legitimacy: 'advertisement',
            shouldBlock: true,
            confidence: 0.95
          };
        }
        
        if (element.className.includes('consent')) {
          return {
            type: 'cookie-consent',
            legitimacy: 'legitimate',
            shouldBlock: false,
            confidence: 0.9
          };
        }

        return {
          type: 'unknown-youtube-popup',
          legitimacy: 'unknown',
          shouldBlock: false,
          confidence: 0.5
        };
      };

      const results = youtubePopups.map(analyzeYouTubePopup);

      expect(results[0].type).toBe('youtube-premium-promo');
      expect(results[0].shouldBlock).toBe(true);
      expect(results[1].type).toBe('video-ad-overlay');
      expect(results[1].shouldBlock).toBe(true);
      expect(results[2].type).toBe('cookie-consent');
      expect(results[2].shouldBlock).toBe(false);
    });

    test('ニュースサイトでのペイウォール検出', async () => {
      mockWindow.location.hostname = 'news.example.com';

      const newsPopups = [
        {
          className: 'paywall-modal',
          innerHTML: '<div>この記事を読み続けるには購読が必要です</div><button>購読する</button>'
        },
        {
          className: 'newsletter-signup',
          innerHTML: '<div>ニュースレターに登録</div><input type="email">'
        },
        {
          className: 'breaking-news-alert',
          innerHTML: '<div>速報：重要なニュース</div><button>詳細を見る</button>'
        }
      ];

      const analyzeNewsPopup = (element) => {
        const content = element.innerHTML;
        const className = element.className;

        if (className.includes('paywall') || content.includes('購読')) {
          return {
            type: 'paywall',
            legitimacy: 'legitimate',
            shouldBlock: false,
            confidence: 0.95
          };
        }
        
        if (className.includes('newsletter') && content.includes('登録')) {
          return {
            type: 'newsletter-signup',
            legitimacy: 'questionable',
            shouldBlock: true,
            confidence: 0.7
          };
        }
        
        if (content.includes('速報') || content.includes('重要')) {
          return {
            type: 'breaking-news',
            legitimacy: 'legitimate',
            shouldBlock: false,
            confidence: 0.8
          };
        }

        return {
          type: 'unknown-news-popup',
          legitimacy: 'unknown',
          shouldBlock: false,
          confidence: 0.5
        };
      };

      const results = newsPopups.map(analyzeNewsPopup);

      expect(results[0].type).toBe('paywall');
      expect(results[0].shouldBlock).toBe(false);
      expect(results[1].type).toBe('newsletter-signup');
      expect(results[1].shouldBlock).toBe(true);
      expect(results[2].type).toBe('breaking-news');
      expect(results[2].shouldBlock).toBe(false);
    });

    test('ソーシャルメディアサイトでのポップアップ処理', async () => {
      mockWindow.location.hostname = 'www.facebook.com';

      const socialPopups = [
        {
          className: 'login-popup',
          innerHTML: '<div>Facebookにログイン</div><form><input type="email"><input type="password"></form>'
        },
        {
          className: 'friend-suggestion',
          innerHTML: '<div>知り合いかもしれません</div><button>友達になる</button>'
        },
        {
          className: 'notification-permission',
          innerHTML: '<div>通知を許可しますか？</div><button>許可</button><button>拒否</button>'
        }
      ];

      const analyzeSocialPopup = (element) => {
        const content = element.innerHTML;
        const className = element.className;

        if (className.includes('login') && content.includes('ログイン')) {
          return {
            type: 'login-prompt',
            legitimacy: 'legitimate',
            shouldBlock: false,
            confidence: 0.9
          };
        }
        
        if (className.includes('friend') || content.includes('友達')) {
          return {
            type: 'friend-suggestion',
            legitimacy: 'feature',
            shouldBlock: false,
            confidence: 0.8
          };
        }
        
        if (content.includes('通知') && content.includes('許可')) {
          return {
            type: 'notification-permission',
            legitimacy: 'legitimate',
            shouldBlock: false,
            confidence: 0.95
          };
        }

        return {
          type: 'unknown-social-popup',
          legitimacy: 'unknown',
          shouldBlock: false,
          confidence: 0.5
        };
      };

      const results = socialPopups.map(analyzeSocialPopup);

      expect(results[0].type).toBe('login-prompt');
      expect(results[0].shouldBlock).toBe(false);
      expect(results[1].type).toBe('friend-suggestion');
      expect(results[1].shouldBlock).toBe(false);
      expect(results[2].type).toBe('notification-permission');
      expect(results[2].shouldBlock).toBe(false);
    });
  });

  describe('異なるポップアップ技術への対応', () => {
    test('CSS Modalの検出', async () => {
      const cssModal = {
        style: {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: '1000',
          backgroundColor: 'white',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        },
        className: 'css-modal'
      };

      mockWindow.getComputedStyle.mockReturnValue(cssModal.style);

      const detectCSSModal = (element) => {
        const style = window.getComputedStyle(element);
        
        return {
          isCSSModal: style.position === 'fixed' && 
                     style.transform.includes('translate'),
          isCentered: style.top === '50%' && style.left === '50%',
          hasBoxShadow: !!style.boxShadow,
          zIndex: parseInt(style.zIndex),
          confidence: 0.85
        };
      };

      const result = detectCSSModal(cssModal);

      expect(result.isCSSModal).toBe(true);
      expect(result.isCentered).toBe(true);
      expect(result.hasBoxShadow).toBe(true);
      expect(result.zIndex).toBe(1000);
    });

    test('JavaScript生成ポップアップの検出', async () => {
      // JavaScript で動的に生成されるポップアップをシミュレート
      const jsPopup = {
        tagName: 'DIV',
        id: 'js-generated-popup',
        getAttribute: jest.fn((attr) => {
          return attr === 'data-generated' ? 'true' : null;
        }),
        style: {
          position: 'absolute',
          zIndex: '9999'
        }
      };

      mockDocument.createElement.mockReturnValue(jsPopup);

      const detectJSGeneratedPopup = (element) => {
        return {
          isJSGenerated: element.getAttribute('data-generated') === 'true',
          hasId: !!element.id,
          isPositioned: element.style.position === 'absolute' || 
                       element.style.position === 'fixed',
          confidence: 0.7
        };
      };

      const result = detectJSGeneratedPopup(jsPopup);

      expect(result.isJSGenerated).toBe(true);
      expect(result.hasId).toBe(true);
      expect(result.isPositioned).toBe(true);
    });

    test('iFrame内ポップアップの検出', async () => {
      const iframePopup = {
        tagName: 'IFRAME',
        src: 'https://ads.example.com/popup',
        style: {
          position: 'fixed',
          width: '300px',
          height: '250px',
          border: 'none',
          zIndex: '9999'
        }
      };

      const detectIFramePopup = (element) => {
        if (element.tagName !== 'IFRAME') {
          return { isIFramePopup: false };
        }

        return {
          isIFramePopup: true,
          isAdFrame: element.src.includes('ads.') || 
                    element.src.includes('doubleclick') ||
                    element.src.includes('googlesyndication'),
          isPositioned: element.style.position === 'fixed',
          hasNoBorder: element.style.border === 'none',
          confidence: element.src.includes('ads.') ? 0.9 : 0.6
        };
      };

      const result = detectIFramePopup(iframePopup);

      expect(result.isIFramePopup).toBe(true);
      expect(result.isAdFrame).toBe(true);
      expect(result.isPositioned).toBe(true);
      expect(result.hasNoBorder).toBe(true);
      expect(result.confidence).toBe(0.9);
    });
  });

  describe('サイト固有の学習と適応', () => {
    test('ドメイン別パターン学習', async () => {
      const domainPatterns = {
        'news.example.com': [
          {
            type: 'newsletter-signup',
            characteristics: {
              className: 'newsletter-modal',
              containsEmail: true,
              hasSubscribeButton: true
            },
            userDecision: 'close',
            confidence: 0.8
          }
        ],
        'shop.example.com': [
          {
            type: 'cart-abandonment',
            characteristics: {
              className: 'cart-reminder',
              containsCartItems: true,
              hasCheckoutButton: true
            },
            userDecision: 'keep',
            confidence: 0.9
          }
        ]
      };

      mockChrome.storage.local.get.mockResolvedValue({
        domainPatterns: domainPatterns
      });

      const getDomainSpecificPattern = async (domain, popupCharacteristics) => {
        const { domainPatterns } = await chrome.storage.local.get(['domainPatterns']);
        const patterns = domainPatterns[domain] || [];
        
        return patterns.find(pattern => {
          const charMatch = Object.keys(pattern.characteristics).every(key => {
            return popupCharacteristics[key] === pattern.characteristics[key];
          });
          return charMatch;
        });
      };

      const newsPattern = await getDomainSpecificPattern('news.example.com', {
        className: 'newsletter-modal',
        containsEmail: true,
        hasSubscribeButton: true
      });

      const shopPattern = await getDomainSpecificPattern('shop.example.com', {
        className: 'cart-reminder',
        containsCartItems: true,
        hasCheckoutButton: true
      });

      expect(newsPattern.userDecision).toBe('close');
      expect(shopPattern.userDecision).toBe('keep');
    });

    test('サイト更新への適応', async () => {
      // サイトの構造変更に対する適応をテスト
      const oldPattern = {
        selector: '.old-popup-class',
        characteristics: {
          className: 'old-popup-class',
          hasCloseButton: true
        }
      };

      const newPattern = {
        selector: '.new-popup-class',
        characteristics: {
          className: 'new-popup-class',
          hasCloseButton: true,
          hasNewAttribute: true
        }
      };

      const adaptToSiteChanges = (oldPattern, detectedElement) => {
        // 古いパターンが機能しない場合の適応ロジック
        if (!document.querySelector(oldPattern.selector)) {
          // 類似の特性を持つ新しい要素を探す
          const similarElements = Array.from(document.querySelectorAll('div')).filter(el => {
            return el.style.position === 'fixed' && 
                   parseInt(el.style.zIndex) > 1000;
          });

          if (similarElements.length > 0) {
            return {
              adapted: true,
              newSelector: `.${similarElements[0].className}`,
              confidence: 0.7
            };
          }
        }

        return { adapted: false };
      };

      mockDocument.querySelector.mockImplementation((selector) => {
        return selector === '.old-popup-class' ? null : {
          className: 'new-popup-class',
          style: { position: 'fixed', zIndex: '9999' }
        };
      });

      mockDocument.querySelectorAll.mockReturnValue([
        {
          className: 'new-popup-class',
          style: { position: 'fixed', zIndex: '9999' }
        }
      ]);

      const adaptation = adaptToSiteChanges(oldPattern, null);

      expect(adaptation.adapted).toBe(true);
      expect(adaptation.newSelector).toBe('.new-popup-class');
    });
  });

  describe('パフォーマンス最適化', () => {
    test('大量DOM要素での検出パフォーマンス', async () => {
      // 大量のDOM要素をシミュレート
      const largeElementSet = [];
      for (let i = 0; i < 1000; i++) {
        largeElementSet.push({
          tagName: 'DIV',
          className: `element-${i}`,
          style: {
            position: i % 100 === 0 ? 'fixed' : 'static',
            zIndex: i % 50 === 0 ? '9999' : '1'
          }
        });
      }

      mockDocument.querySelectorAll.mockReturnValue(largeElementSet);

      const performanceOptimizedDetection = (elements) => {
        const startTime = performance.now();
        
        // 効率的なフィルタリング
        const candidates = elements.filter(el => 
          el.style.position === 'fixed' && 
          parseInt(el.style.zIndex) > 1000
        );

        const endTime = performance.now();
        
        return {
          totalElements: elements.length,
          candidates: candidates.length,
          processingTime: endTime - startTime,
          efficiency: candidates.length / elements.length
        };
      };

      const result = performanceOptimizedDetection(largeElementSet);

      expect(result.totalElements).toBe(1000);
      expect(result.candidates).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(100); // 100ms以内
      expect(result.efficiency).toBeGreaterThan(0);
    });

    test('メモリ使用量の最適化', async () => {
      // メモリ効率的なポップアップ追跡
      const popupTracker = {
        activePopups: new Map(),
        maxSize: 50,
        
        addPopup(id, data) {
          if (this.activePopups.size >= this.maxSize) {
            // 最も古いエントリを削除
            const oldestKey = this.activePopups.keys().next().value;
            this.activePopups.delete(oldestKey);
          }
          
          this.activePopups.set(id, {
            ...data,
            timestamp: Date.now()
          });
        },
        
        getMemoryUsage() {
          return {
            activeCount: this.activePopups.size,
            maxCapacity: this.maxSize,
            memoryEfficiency: this.activePopups.size / this.maxSize
          };
        }
      };

      // 大量のポップアップを追加
      for (let i = 0; i < 100; i++) {
        popupTracker.addPopup(`popup-${i}`, {
          url: `https://example${i}.com`,
          characteristics: { type: 'test' }
        });
      }

      const memoryUsage = popupTracker.getMemoryUsage();

      expect(memoryUsage.activeCount).toBe(50); // 最大サイズに制限
      expect(memoryUsage.maxCapacity).toBe(50);
      expect(memoryUsage.memoryEfficiency).toBe(1.0);
    });
  });
});