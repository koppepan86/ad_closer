// Test file for popup analysis functionality
// ポップアップ分析機能のテストファイル

/**
 * Mock DOM environment for testing
 */
class MockDOM {
    constructor() {
        this.elements = new Map();
        this.nextId = 1;
    }

    createElement(tagName, attributes = {}, styles = {}) {
        const element = {
            id: `mock-element-${this.nextId++}`,
            tagName: tagName.toUpperCase(),
            attributes: { ...attributes },
            styles: { ...styles },
            children: [],
            parentElement: null,
            textContent: attributes.textContent || '',

            querySelector: (selector) => {
                // Simple mock implementation
                if (selector.includes('close')) {
                    return attributes.hasCloseButton ? { textContent: '×' } : null;
                }
                return null;
            },

            querySelectorAll: (selector) => {
                // Simple mock implementation
                const results = [];
                if (selector.includes('button') && attributes.hasButtons) {
                    results.push({ textContent: 'Click Here' });
                }
                if (selector.includes('a') && attributes.hasLinks) {
                    results.push({ href: 'https://external.com' });
                }
                return results;
            },

            getBoundingClientRect: () => ({
                width: styles.width || 300,
                height: styles.height || 200,
                left: styles.left || 100,
                top: styles.top || 100
            }),

            hasAttribute: (attr) => attributes.hasOwnProperty(attr)
        };

        this.elements.set(element.id, element);
        return element;
    }
}

/**
 * Mock window object for testing
 */
const mockWindow = {
    innerWidth: 1920,
    innerHeight: 1080,
    getComputedStyle: (element) => ({
        position: element.styles.position || 'static',
        zIndex: element.styles.zIndex || '0',
        backgroundColor: element.styles.backgroundColor || 'transparent',
        display: element.styles.display || 'block',
        visibility: element.styles.visibility || 'visible',
        opacity: element.styles.opacity || '1',
        boxShadow: element.styles.boxShadow || 'none',
        border: element.styles.border || 'none',
        borderWidth: element.styles.borderWidth || '0px'
    })
};

/**
 * Mock PopupDetector class for testing
 */
class MockPopupDetector {
    constructor() {
        this.window = mockWindow;
    }

    // Copy the analysis methods from the actual PopupDetector
    analyzePopupCharacteristics(element) {
        const rect = element.getBoundingClientRect();
        const style = this.window.getComputedStyle(element);

        return {
            position: {
                type: style.position,
                isFixed: style.position === 'fixed',
                isAbsolute: style.position === 'absolute',
                isSticky: style.position === 'sticky'
            },

            zIndex: {
                value: parseInt(style.zIndex) || 0,
                isHigh: (parseInt(style.zIndex) || 0) > 1000,
                isVeryHigh: (parseInt(style.zIndex) || 0) >= 9999
            },

            dimensions: {
                width: rect.width,
                height: rect.height,
                area: rect.width * rect.height,
                aspectRatio: rect.width / rect.height,
                coversLargeArea: (rect.width * rect.height) > (this.window.innerWidth * this.window.innerHeight * 0.25),
                isFullScreen: rect.width >= this.window.innerWidth * 0.9 && rect.height >= this.window.innerHeight * 0.9
            },

            modalOverlay: {
                hasOverlayBackground: this.hasOverlayBackground(element),
                blocksInteraction: this.blocksUserInteraction(element),
                hasBackdrop: this.hasModalBackdrop(element),
                centerPositioned: this.isCenterPositioned(element)
            },

            closeButton: {
                hasCloseButton: this.hasCloseButton(element),
                closeButtonTypes: this.getCloseButtonTypes(element),
                closeButtonPosition: this.getCloseButtonPosition(element)
            },

            content: {
                containsAds: this.containsAdContent(element),
                hasExternalLinks: this.hasExternalLinks(element),
                hasFormElements: this.hasFormElements(element),
                hasMediaContent: this.hasMediaContent(element),
                textLength: element.textContent.length,
                hasCallToAction: this.hasCallToAction(element)
            },

            visual: {
                backgroundColor: style.backgroundColor,
                hasBoxShadow: style.boxShadow !== 'none',
                hasBorder: style.border !== 'none' || style.borderWidth !== '0px',
                opacity: parseFloat(style.opacity),
                isVisible: this.isElementVisible(element)
            },

            interaction: {
                hasClickHandlers: this.hasClickHandlers(element),
                hasKeyboardHandlers: this.hasKeyboardHandlers(element),
                preventsBubbling: this.preventsBubbling(element)
            }
        };
    }

    hasOverlayBackground(element) {
        const style = this.window.getComputedStyle(element);
        const bgColor = style.backgroundColor;

        if (bgColor.includes('rgba')) {
            const alphaMatch = bgColor.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
            if (alphaMatch && parseFloat(alphaMatch[1]) > 0 && parseFloat(alphaMatch[1]) < 1) {
                return true;
            }
        }

        return bgColor === 'rgba(0, 0, 0, 0.5)' ||
            bgColor === 'rgba(0, 0, 0, 0.8)' ||
            bgColor.includes('rgba(0, 0, 0,');
    }

    blocksUserInteraction(element) {
        const style = this.window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.position === 'fixed' &&
            rect.width >= this.window.innerWidth * 0.8 &&
            rect.height >= this.window.innerHeight * 0.8;
    }

    hasModalBackdrop(element) {
        return element.attributes.hasBackdrop || false;
    }

    isCenterPositioned(element) {
        const rect = element.getBoundingClientRect();
        const centerX = this.window.innerWidth / 2;
        const centerY = this.window.innerHeight / 2;

        const elementCenterX = rect.left + rect.width / 2;
        const elementCenterY = rect.top + rect.height / 2;

        const tolerance = 0.2;
        return Math.abs(elementCenterX - centerX) < this.window.innerWidth * tolerance &&
            Math.abs(elementCenterY - centerY) < this.window.innerHeight * tolerance;
    }

    hasCloseButton(element) {
        return element.attributes.hasCloseButton || false;
    }

    getCloseButtonTypes(element) {
        return element.attributes.hasCloseButton ? ['text-close'] : [];
    }

    getCloseButtonPosition(element) {
        return element.attributes.hasCloseButton ? 'top-right' : 'none';
    }

    containsAdContent(element) {
        const adKeywords = ['ad', 'advertisement', '広告', 'sponsor', 'promo'];
        const text = element.textContent.toLowerCase();
        return adKeywords.some(keyword => text.includes(keyword));
    }

    hasExternalLinks(element) {
        return element.attributes.hasLinks || false;
    }

    hasFormElements(element) {
        return element.attributes.hasFormElements || false;
    }

    hasMediaContent(element) {
        return element.attributes.hasMediaContent || false;
    }

    hasCallToAction(element) {
        const ctaKeywords = ['クリック', 'click', '今すぐ', 'now', '無料', 'free'];
        const text = element.textContent.toLowerCase();
        return ctaKeywords.some(keyword => text.includes(keyword));
    }

    isElementVisible(element) {
        const style = this.window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            parseFloat(style.opacity) > 0 &&
            rect.width > 0 &&
            rect.height > 0;
    }

    hasClickHandlers(element) {
        return element.attributes.hasClickHandlers || false;
    }

    hasKeyboardHandlers(element) {
        return element.attributes.hasKeyboardHandlers || false;
    }

    preventsBubbling(element) {
        const style = this.window.getComputedStyle(element);
        return style.position === 'fixed' &&
            parseInt(style.zIndex) > 1000 &&
            this.hasOverlayBackground(element);
    }

    calculatePopupConfidence(element, characteristics) {
        let confidence = 0;
        let maxScore = 0;

        // 位置による信頼度 (最大0.25)
        maxScore += 0.25;
        if (characteristics.position.isFixed) confidence += 0.15;
        if (characteristics.position.isAbsolute) confidence += 0.10;

        // z-indexによる信頼度 (最大0.20)
        maxScore += 0.20;
        if (characteristics.zIndex.isVeryHigh) confidence += 0.20;
        else if (characteristics.zIndex.isHigh) confidence += 0.15;
        else if (characteristics.zIndex.value > 100) confidence += 0.10;

        // サイズによる信頼度 (最大0.20)
        maxScore += 0.20;
        if (characteristics.dimensions.isFullScreen) confidence += 0.20;
        else if (characteristics.dimensions.coversLargeArea) confidence += 0.15;
        else if (characteristics.dimensions.area > 50000) confidence += 0.10;

        // モーダル特性による信頼度 (最大0.15)
        maxScore += 0.15;
        if (characteristics.modalOverlay.hasOverlayBackground) confidence += 0.05;
        if (characteristics.modalOverlay.blocksInteraction) confidence += 0.05;
        if (characteristics.modalOverlay.hasBackdrop) confidence += 0.03;
        if (characteristics.modalOverlay.centerPositioned) confidence += 0.02;

        // コンテンツによる信頼度 (最大0.10)
        maxScore += 0.10;
        if (characteristics.content.containsAds) confidence += 0.05;
        if (characteristics.content.hasCallToAction) confidence += 0.03;
        if (characteristics.content.hasExternalLinks) confidence += 0.02;

        // 閉じるボタンによる信頼度 (最大0.05)
        maxScore += 0.05;
        if (characteristics.closeButton.hasCloseButton) confidence += 0.03;
        if (characteristics.closeButton.closeButtonPosition === 'top-right') confidence += 0.02;

        // 視覚的特性による信頼度 (最大0.05)
        maxScore += 0.05;
        if (characteristics.visual.hasBoxShadow) confidence += 0.02;
        if (characteristics.visual.hasBorder) confidence += 0.01;
        if (characteristics.visual.opacity < 1 && characteristics.visual.opacity > 0.8) confidence += 0.02;

        return Math.min(confidence / maxScore, 1.0);
    }
}

/**
 * Test suite for popup analysis functionality
 */
function runPopupAnalysisTests() {
    console.log('=== ポップアップ分析機能テスト開始 ===');

    const mockDOM = new MockDOM();
    const detector = new MockPopupDetector();
    let testsPassed = 0;
    let totalTests = 0;

    function test(name, testFunction) {
        totalTests++;
        try {
            testFunction();
            console.log(`✅ ${name}`);
            testsPassed++;
        } catch (error) {
            console.error(`❌ ${name}: ${error.message}`);
        }
    }

    // Test 1: 基本的なモーダルポップアップの分析
    test('基本的なモーダルポップアップの分析', () => {
        const element = mockDOM.createElement('div', {
            hasCloseButton: true,
            textContent: '広告コンテンツ'
        }, {
            position: 'fixed',
            zIndex: '9999',
            width: 500,
            height: 300,
            backgroundColor: 'rgba(0, 0, 0, 0.8)'
        });

        const characteristics = detector.analyzePopupCharacteristics(element);

        if (!characteristics.position.isFixed) throw new Error('固定位置が検出されていません');
        if (!characteristics.zIndex.isVeryHigh) throw new Error('高いz-indexが検出されていません');
        if (!characteristics.closeButton.hasCloseButton) throw new Error('閉じるボタンが検出されていません');
        if (!characteristics.content.containsAds) throw new Error('広告コンテンツが検出されていません');
    });

    // Test 2: 大きなオーバーレイポップアップの分析
    test('大きなオーバーレイポップアップの分析', () => {
        const element = mockDOM.createElement('div', {
            hasBackdrop: true
        }, {
            position: 'fixed',
            zIndex: '5000',
            width: 1500,
            height: 800,
            left: 200,
            top: 100
        });

        const characteristics = detector.analyzePopupCharacteristics(element);

        if (!characteristics.dimensions.coversLargeArea) throw new Error('大きな領域をカバーしていることが検出されていません');
        if (!characteristics.modalOverlay.hasBackdrop) throw new Error('背景が検出されていません');
        if (!characteristics.modalOverlay.centerPositioned) throw new Error('中央配置が検出されていません');
    });

    // Test 3: 信頼度スコア計算のテスト
    test('信頼度スコア計算', () => {
        const element = mockDOM.createElement('div', {
            hasCloseButton: true,
            textContent: 'クリックして無料ダウンロード！'
        }, {
            position: 'fixed',
            zIndex: '10000',
            width: 600,
            height: 400,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
        });

        const characteristics = detector.analyzePopupCharacteristics(element);
        const confidence = detector.calculatePopupConfidence(element, characteristics);

        if (confidence < 0.5) throw new Error(`信頼度が低すぎます: ${confidence}`);
        if (confidence > 1.0) throw new Error(`信頼度が1.0を超えています: ${confidence}`);
    });

    // Test 4: 小さな要素の分析（ポップアップではない可能性）
    test('小さな要素の分析', () => {
        const element = mockDOM.createElement('div', {
            textContent: 'Small element'
        }, {
            position: 'static',
            zIndex: '1',
            width: 50,
            height: 20
        });

        const characteristics = detector.analyzePopupCharacteristics(element);
        const confidence = detector.calculatePopupConfidence(element, characteristics);

        if (confidence > 0.3) throw new Error(`小さな要素の信頼度が高すぎます: ${confidence}`);
        if (characteristics.dimensions.coversLargeArea) throw new Error('小さな要素が大きな領域をカバーしていると判定されました');
    });

    // Test 5: コンテンツ特性の詳細分析
    test('コンテンツ特性の詳細分析', () => {
        const element = mockDOM.createElement('div', {
            hasLinks: true,
            hasFormElements: true,
            hasMediaContent: true,
            textContent: '今すぐ登録してください！'
        }, {
            position: 'absolute',
            zIndex: '2000'
        });

        const characteristics = detector.analyzePopupCharacteristics(element);

        if (!characteristics.content.hasExternalLinks) throw new Error('外部リンクが検出されていません');
        if (!characteristics.content.hasFormElements) throw new Error('フォーム要素が検出されていません');
        if (!characteristics.content.hasMediaContent) throw new Error('メディアコンテンツが検出されていません');
        if (!characteristics.content.hasCallToAction) throw new Error('コールトゥアクションが検出されていません');
    });

    // Test 6: 視覚的特性の分析
    test('視覚的特性の分析', () => {
        const element = mockDOM.createElement('div', {}, {
            position: 'fixed',
            backgroundColor: 'white',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            border: '1px solid #ccc',
            opacity: '0.95'
        });

        const characteristics = detector.analyzePopupCharacteristics(element);

        if (!characteristics.visual.hasBoxShadow) throw new Error('ボックスシャドウが検出されていません');
        if (!characteristics.visual.hasBorder) throw new Error('ボーダーが検出されていません');
        if (!characteristics.visual.isVisible) throw new Error('要素が見えないと判定されました');
    });

    // Test 7: インタラクション特性の分析
    test('インタラクション特性の分析', () => {
        const element = mockDOM.createElement('div', {
            hasClickHandlers: true,
            hasKeyboardHandlers: true
        }, {
            position: 'fixed',
            zIndex: '5000',
            backgroundColor: 'rgba(0, 0, 0, 0.8)'
        });

        const characteristics = detector.analyzePopupCharacteristics(element);

        if (!characteristics.interaction.hasClickHandlers) throw new Error('クリックハンドラーが検出されていません');
        if (!characteristics.interaction.hasKeyboardHandlers) throw new Error('キーボードハンドラーが検出されていません');
        if (!characteristics.interaction.preventsBubbling) throw new Error('イベントバブリング防止が検出されていません');
    });

    console.log(`\n=== テスト結果: ${testsPassed}/${totalTests} 通過 ===`);

    if (testsPassed === totalTests) {
        console.log('🎉 すべてのテストが通過しました！');
    } else {
        console.log(`⚠️  ${totalTests - testsPassed} 個のテストが失敗しました`);
    }

    return testsPassed === totalTests;
}

// テストの実行
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runPopupAnalysisTests, MockPopupDetector, MockDOM };
} else {
    // ブラウザ環境での実行
    runPopupAnalysisTests();
}

// Node.js環境での直接実行
if (typeof require !== 'undefined' && require.main === module) {
    runPopupAnalysisTests();
}