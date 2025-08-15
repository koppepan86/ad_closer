// Test file for legitimate popup detection functionality
// 正当なポップアップ検出機能のテストファイル

/**
 * Mock DOM environment for testing legitimate popup detection
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
            className: attributes.className || '',

            querySelector: (selector) => {
                // Mock implementation for various selectors
                if (selector.includes('password') && attributes.hasPasswordField) {
                    return { type: 'password' };
                }
                if (selector.includes('input') && attributes.hasInputFields) {
                    return { type: 'text' };
                }
                if (selector.includes('alert') && attributes.hasAlert) {
                    return { role: 'alert' };
                }
                if (selector.includes('nav') && attributes.hasNav) {
                    return { tagName: 'NAV' };
                }
                return null;
            },

            querySelectorAll: (selector) => {
                const results = [];
                if (selector.includes('password') && attributes.hasPasswordField) {
                    results.push({ type: 'password' });
                }
                if (selector.includes('input') && attributes.hasInputFields) {
                    results.push({ type: 'text' });
                }
                if (selector.includes('video') && attributes.hasVideo) {
                    results.push({ tagName: 'VIDEO' });
                }
                return results;
            },

            getBoundingClientRect: () => ({
                width: styles.width || 300,
                height: styles.height || 200,
                left: styles.left || 100,
                top: styles.top || 100
            }),

            hasAttribute: (attr) => attributes.hasOwnProperty(attr),
            getAttribute: (attr) => attributes[attr] || null,
            matches: (selector) => {
                if (selector.includes('google') && attributes.className?.includes('google')) {
                    return true;
                }
                return false;
            }
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
    location: {
        hostname: 'example.com',
        href: 'https://example.com/test'
    },
    performance: {
        timing: {
            loadEventEnd: Date.now() - 5000
        }
    },
    getComputedStyle: (element) => ({
        position: element.styles.position || 'static',
        zIndex: element.styles.zIndex || '0',
        backgroundColor: element.styles.backgroundColor || 'transparent'
    })
};

/**
 * Mock PopupDetector class for testing legitimate popup detection
 */
class MockPopupDetector {
    constructor() {
        this.window = mockWindow;
    }

    // Copy the legitimate popup detection methods
    isLegitimatePopup(element) {
        if (this.isLoginForm(element)) {
            return true;
        }
        if (this.isImportantNotification(element)) {
            return true;
        }
        if (this.isWebsiteFeature(element)) {
            return true;
        }
        if (this.isWhitelistedPopup(element)) {
            return true;
        }
        if (this.hasUncertainClassification(element)) {
            return true;
        }
        return false;
    }

    isLoginForm(element) {
        return element.attributes.hasPasswordField && element.attributes.hasInputFields;
    }

    isImportantNotification(element) {
        const importantKeywords = ['error', 'warning', 'alert', 'security', 'cookie'];
        const text = element.textContent.toLowerCase();
        const className = element.className.toLowerCase();
        
        const hasImportantKeyword = importantKeywords.some(keyword => 
            text.includes(keyword) || className.includes(keyword)
        );

        const role = element.getAttribute('role');
        const importantRoles = ['alert', 'alertdialog', 'dialog'];
        const hasImportantRole = importantRoles.includes(role);

        return hasImportantKeyword || hasImportantRole || element.attributes.hasAlert;
    }

    isWebsiteFeature(element) {
        return this.isNavigationElement(element) || 
               this.isSearchFeature(element) || 
               this.isMediaPlayer(element);
    }

    isNavigationElement(element) {
        const navKeywords = ['nav', 'menu', 'navigation'];
        const className = element.className.toLowerCase();
        const hasNavKeyword = navKeywords.some(keyword => className.includes(keyword));
        const isNavElement = element.tagName === 'NAV' || element.getAttribute('role') === 'navigation';
        return hasNavKeyword || isNavElement || element.attributes.hasNav;
    }

    isSearchFeature(element) {
        return element.attributes.hasSearch || false;
    }

    isMediaPlayer(element) {
        return element.attributes.hasVideo || false;
    }

    isWhitelistedPopup(element) {
        const className = element.className.toLowerCase();
        if (className.includes('google') || className.includes('modal')) {
            return true;
        }
        return false;
    }

    hasUncertainClassification(element) {
        const rect = element.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 50) {
            return true;
        }
        
        const style = this.window.getComputedStyle(element);
        const zIndex = parseInt(style.zIndex) || 0;
        if (zIndex > 999999) {
            return true;
        }
        
        return false;
    }

    // Mock helper methods
    containsAdContent(element) {
        const adKeywords = ['ad', 'advertisement', 'sponsor'];
        const text = element.textContent.toLowerCase();
        return adKeywords.some(keyword => text.includes(keyword));
    }

    hasCallToAction(element) {
        const ctaKeywords = ['click', 'buy', 'download'];
        const text = element.textContent.toLowerCase();
        return ctaKeywords.some(keyword => text.includes(keyword));
    }

    hasFormElements(element) {
        return element.attributes.hasInputFields || false;
    }
}

/**
 * Test suite for legitimate popup detection
 */
function runLegitimatePopupTests() {
    console.log('=== 正当なポップアップ検出機能テスト開始 ===');

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

    // Test 1: ログインフォームの検出
    test('ログインフォームの検出', () => {
        const element = mockDOM.createElement('div', {
            hasPasswordField: true,
            hasInputFields: true,
            textContent: 'ログイン'
        });

        const isLegitimate = detector.isLegitimatePopup(element);
        if (!isLegitimate) throw new Error('ログインフォームが正当と判定されませんでした');
    });

    // Test 2: 重要な通知の検出
    test('重要な通知の検出', () => {
        const element = mockDOM.createElement('div', {
            textContent: 'セキュリティ警告: 不正なアクセスを検出しました',
            role: 'alert'
        });

        const isLegitimate = detector.isLegitimatePopup(element);
        if (!isLegitimate) throw new Error('重要な通知が正当と判定されませんでした');
    });

    // Test 3: ナビゲーション要素の検出
    test('ナビゲーション要素の検出', () => {
        const element = mockDOM.createElement('nav', {
            className: 'main-navigation',
            hasNav: true
        });

        const isLegitimate = detector.isLegitimatePopup(element);
        if (!isLegitimate) throw new Error('ナビゲーション要素が正当と判定されませんでした');
    });

    // Test 4: ホワイトリストされたポップアップの検出
    test('ホワイトリストされたポップアップの検出', () => {
        const element = mockDOM.createElement('div', {
            className: 'google-signin-modal'
        });

        const isLegitimate = detector.isLegitimatePopup(element);
        if (!isLegitimate) throw new Error('ホワイトリストされたポップアップが正当と判定されませんでした');
    });

    // Test 5: 小さすぎる要素（不確実な分類）
    test('小さすぎる要素の検出', () => {
        const element = mockDOM.createElement('div', {
            textContent: 'Small popup'
        }, {
            width: 50,
            height: 30
        });

        const isLegitimate = detector.isLegitimatePopup(element);
        if (!isLegitimate) throw new Error('小さすぎる要素が正当と判定されませんでした（不確実な分類）');
    });

    // Test 6: 広告ポップアップ（正当ではない）
    test('広告ポップアップの判定', () => {
        const element = mockDOM.createElement('div', {
            textContent: 'Click here for amazing deals! Buy now!'
        }, {
            width: 400,
            height: 300
        });

        const isLegitimate = detector.isLegitimatePopup(element);
        if (isLegitimate) throw new Error('広告ポップアップが正当と判定されました');
    });

    // Test 7: メディアプレーヤーの検出
    test('メディアプレーヤーの検出', () => {
        const element = mockDOM.createElement('div', {
            className: 'video-player',
            hasVideo: true
        });

        const isLegitimate = detector.isLegitimatePopup(element);
        if (!isLegitimate) throw new Error('メディアプレーヤーが正当と判定されませんでした');
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
    module.exports = { runLegitimatePopupTests, MockPopupDetector, MockDOM };
} else {
    runLegitimatePopupTests();
}

// Node.js環境での直接実行
if (typeof require !== 'undefined' && require.main === module) {
    runLegitimatePopupTests();
}