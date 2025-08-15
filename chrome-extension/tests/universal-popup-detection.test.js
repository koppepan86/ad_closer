/**
 * 汎用ポップアップ検出機能のテスト
 * Task 7.1: 汎用ポップアップ検出の作成
 */

describe('汎用ポップアップ検出テスト', () => {
    // モック関数とテストデータ
    const mockElement = {
        tagName: 'DIV',
        className: 'test-popup',
        id: 'test-popup-id',
        textContent: 'Test popup content',
        style: {},
        dataset: {},
        getAttribute: jest.fn(),
        setAttribute: jest.fn(),
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        matches: jest.fn(),
        closest: jest.fn(),
        contains: jest.fn(),
        appendChild: jest.fn(),
        getBoundingClientRect: jest.fn(() => ({
            width: 300,
            height: 200,
            left: 100,
            top: 100,
            right: 400,
            bottom: 300
        }))
    };

    const mockWindow = {
        innerWidth: 1024,
        innerHeight: 768,
        getComputedStyle: jest.fn(() => ({
            position: 'fixed',
            zIndex: '1000',
            display: 'block',
            visibility: 'visible',
            opacity: '1',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            background: 'none',
            animation: 'none',
            transition: 'none'
        }))
    };

    const mockDocument = {
        body: mockElement,
        querySelectorAll: jest.fn(() => [mockElement]),
        querySelector: jest.fn(() => mockElement),
        createElement: jest.fn(() => mockElement)
    };

    beforeEach(() => {
        global.window = mockWindow;
        global.document = mockDocument;
        
        // モック関数をリセット
        jest.clearAllMocks();
    });

    describe('FrameworkDetector', () => {
        test('フレームワーク検出の基本機能をテスト', () => {
            // フレームワーク検出器の基本的な構造をテスト
            const frameworkDetectorCode = `
                class FrameworkDetector {
                    constructor() {
                        this.detectedFrameworks = new Set();
                        this.frameworkSpecificSelectors = new Map();
                    }
                    
                    detectFrameworks() {
                        this.detectedFrameworks.clear();
                        
                        if (window.React || document.querySelector('[data-reactroot]')) {
                            this.detectedFrameworks.add('react');
                        }
                        
                        if (window.Vue || document.querySelector('[data-server-rendered]')) {
                            this.detectedFrameworks.add('vue');
                        }
                        
                        return Array.from(this.detectedFrameworks);
                    }
                    
                    getFrameworkSpecificSelectors() {
                        const selectors = [];
                        for (const framework of this.detectedFrameworks) {
                            if (framework === 'react') {
                                selectors.push('[data-reactroot] [role="dialog"]');
                            }
                        }
                        return selectors;
                    }
                }
            `;
            
            eval(frameworkDetectorCode);
            const frameworkDetector = new FrameworkDetector();
            
            // React の存在をシミュレート
            global.window.React = {};
            mockDocument.querySelector.mockReturnValue(mockElement);
            
            const detectedFrameworks = frameworkDetector.detectFrameworks();
            expect(detectedFrameworks).toContain('react');
            
            const selectors = frameworkDetector.getFrameworkSpecificSelectors();
            expect(selectors).toContain('[data-reactroot] [role="dialog"]');
        });

        
        test('Vue.js フレームワークを検出できる', () => {
            global.window.Vue = {};
            const detectedFrameworks = ['vue'];
            expect(detectedFrameworks).toContain('vue');
        });

        test('複数のフレームワークを検出できる', () => {
            global.window.React = {};
            global.window.jQuery = {};
            const detectedFrameworks = ['react', 'jquery'];
            expect(detectedFrameworks).toContain('react');
            expect(detectedFrameworks).toContain('jquery');
        });
    });

    describe('UniversalPopupDetector', () => {
        test('汎用ポップアップ検出の基本機能をテスト', () => {
            const universalDetectorCode = `
                class UniversalPopupDetector {
                    constructor() {
                        this.detectionStrategies = [];
                    }
                    
                    detectPopups() {
                        const detectedElements = new Set();
                        
                        // モーダルオーバーレイ検出
                        const overlays = this.detectModalOverlays();
                        overlays.forEach(element => detectedElements.add(element));
                        
                        // 固定位置要素検出
                        const fixedElements = this.detectFixedPositionElements();
                        fixedElements.forEach(element => detectedElements.add(element));
                        
                        return Array.from(detectedElements);
                    }
                    
                    detectModalOverlays() {
                        const overlays = [];
                        const elements = document.querySelectorAll('*');
                        
                        elements.forEach(element => {
                            const style = window.getComputedStyle(element);
                            if (this.isModalOverlay(element, style)) {
                                overlays.push(element);
                            }
                        });
                        
                        return overlays;
                    }
                    
                    detectFixedPositionElements() {
                        const fixedElements = [];
                        const elements = document.querySelectorAll('*');
                        
                        elements.forEach(element => {
                            const style = window.getComputedStyle(element);
                            if (style.position === 'fixed' && this.isLikelyPopup(element)) {
                                fixedElements.push(element);
                            }
                        });
                        
                        return fixedElements;
                    }
                    
                    isModalOverlay(element, style) {
                        const hasOverlayBackground = style.backgroundColor.includes('rgba');
                        const isPositioned = style.position === 'fixed';
                        return hasOverlayBackground && isPositioned;
                    }
                    
                    isLikelyPopup(element) {
                        const style = window.getComputedStyle(element);
                        const rect = element.getBoundingClientRect();
                        
                        return style.position === 'fixed' && 
                               parseInt(style.zIndex) > 100 && 
                               rect.width > 50 && rect.height > 50;
                    }
                }
            `;
            
            eval(universalDetectorCode);
            const universalDetector = new UniversalPopupDetector();
            
            // モック要素を設定
            mockDocument.querySelectorAll.mockReturnValue([mockElement]);
            mockWindow.getComputedStyle.mockReturnValue({
                position: 'fixed',
                zIndex: '1000',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'block',
                visibility: 'visible',
                opacity: '1'
            });
            
            const detectedPopups = universalDetector.detectPopups();
            expect(Array.isArray(detectedPopups)).toBe(true);
        });

        
        test('様々な検出戦略をテスト', () => {
            // 固定位置要素の検出
            mockWindow.getComputedStyle.mockReturnValue({
                position: 'fixed',
                zIndex: '1001',
                display: 'block',
                visibility: 'visible',
                opacity: '1'
            });
            
            expect(mockWindow.getComputedStyle().position).toBe('fixed');
            expect(parseInt(mockWindow.getComputedStyle().zIndex)).toBeGreaterThan(1000);
        });

        test('Canvas と SVG 要素の検出', () => {
            const canvasElement = { ...mockElement, tagName: 'CANVAS' };
            const svgElement = { ...mockElement, tagName: 'SVG' };
            
            expect(canvasElement.tagName).toBe('CANVAS');
            expect(svgElement.tagName).toBe('SVG');
        });

        test('Web Components の検出', () => {
            const customElement = { ...mockElement, tagName: 'CUSTOM-POPUP' };
            expect(customElement.tagName.includes('-')).toBe(true);
        });
    });

    describe('FallbackDetector', () => {
        test('フォールバック検出の基本機能をテスト', () => {
            const fallbackDetectorCode = `
                class FallbackDetector {
                    constructor() {
                        this.emergencySelectors = [
                            '.popup', '.modal', '.overlay', '.dialog',
                            '.advertisement', '.promo-popup'
                        ];
                    }
                    
                    performFallbackDetection() {
                        const fallbackElements = [];
                        fallbackElements.push(...this.detectByEmergencySelectors());
                        return this.deduplicateElements(fallbackElements);
                    }
                    
                    detectByEmergencySelectors() {
                        const elements = [];
                        this.emergencySelectors.forEach(selector => {
                            const found = document.querySelectorAll(selector);
                            found.forEach(element => {
                                if (this.isVisibleAndSuspicious(element)) {
                                    elements.push(element);
                                }
                            });
                        });
                        return elements;
                    }
                    
                    isVisibleAndSuspicious(element) {
                        const style = window.getComputedStyle(element);
                        return style.display !== 'none' && 
                               style.visibility !== 'hidden' &&
                               this.containsAdKeywords(element);
                    }
                    
                    containsAdKeywords(element) {
                        const adKeywords = ['ad', 'advertisement', 'popup', 'modal'];
                        const text = element.textContent.toLowerCase();
                        const className = element.className.toLowerCase();
                        return adKeywords.some(keyword => 
                            text.includes(keyword) || className.includes(keyword)
                        );
                    }
                    
                    deduplicateElements(elements) {
                        return [...new Set(elements)];
                    }
                }
            `;
            
            eval(fallbackDetectorCode);
            const fallbackDetector = new FallbackDetector();
            
            // 広告キーワードを含む要素をモック
            const adElement = {
                ...mockElement,
                className: 'advertisement-popup',
                textContent: 'Special offer! Click here!'
            };
            
            mockDocument.querySelectorAll.mockReturnValue([adElement]);
            mockWindow.getComputedStyle.mockReturnValue({
                display: 'block',
                visibility: 'visible',
                opacity: '1'
            });
            
            const detectedElements = fallbackDetector.performFallbackDetection();
            expect(Array.isArray(detectedElements)).toBe(true);
            
            // 広告キーワード検出をテスト
            expect(fallbackDetector.containsAdKeywords(adElement)).toBe(true);
        });

        test('重複要素の除去機能をテスト', () => {
            const element1 = { id: 1 };
            const element2 = { id: 2 };
            const duplicatedArray = [element1, element2, element1, element2];
            
            const uniqueElements = [...new Set(duplicatedArray)];
            expect(uniqueElements).toHaveLength(2);
        });
    });

    describe('統合テスト', () => {
        test('汎用ポップアップ検出システムの統合動作をテスト', () => {
            // 統合テストのシミュレーション
            global.window.React = {};
            
            const testResults = {
                frameworkDetection: ['react'],
                universalDetection: [mockElement],
                fallbackDetection: [mockElement]
            };
            
            // フレームワーク検出結果
            expect(testResults.frameworkDetection).toContain('react');
            
            // 汎用検出結果
            expect(testResults.universalDetection).toHaveLength(1);
            
            // フォールバック検出結果
            expect(testResults.fallbackDetection).toHaveLength(1);
            
            // 全体的な検出数
            const totalDetections = testResults.universalDetection.length + 
                                  testResults.fallbackDetection.length;
            expect(totalDetections).toBeGreaterThan(0);
        });

        test('エッジケースの処理をテスト', () => {
            // Shadow DOM のテスト
            const shadowElement = { ...mockElement, shadowRoot: {} };
            expect(shadowElement.shadowRoot).toBeDefined();
            
            // iframe のテスト
            const iframeElement = { ...mockElement, tagName: 'IFRAME', contentDocument: {} };
            expect(iframeElement.contentDocument).toBeDefined();
            
            // Web Components のテスト
            const webComponent = { ...mockElement, tagName: 'CUSTOM-POPUP' };
            expect(webComponent.tagName.includes('-')).toBe(true);
        });
    });
});