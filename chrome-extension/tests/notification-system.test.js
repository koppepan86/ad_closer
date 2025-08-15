// Test file for notification system functionality
// 通知システム機能のテストファイル

/**
 * Mock DOM environment for testing notification system
 */
class MockDocument {
    constructor() {
        this.elements = [];
        this.body = {
            appendChild: (element) => {
                this.elements.push(element);
                element.parentNode = this.body;
            },
            removeChild: (element) => {
                const index = this.elements.indexOf(element);
                if (index > -1) {
                    this.elements.splice(index, 1);
                    element.parentNode = null;
                }
            }
        };
        this.head = {
            appendChild: (element) => {
                // Mock head appendChild
            }
        };
    }

    createElement(tagName) {
        return {
            tagName: tagName.toUpperCase(),
            className: '',
            style: {},
            innerHTML: '',
            attributes: {},
            parentNode: null,
            
            setAttribute: function(name, value) {
                this.attributes[name] = value;
            },
            
            getAttribute: function(name) {
                return this.attributes[name] || null;
            },
            
            addEventListener: function(event, handler) {
                this[`on${event}`] = handler;
            },
            
            remove: function() {
                if (this.parentNode) {
                    this.parentNode.removeChild(this);
                }
            },
            
            focus: function() {
                // Mock focus
            }
        };
    }

    querySelector(selector) {
        if (selector === '#popup-blocker-styles') {
            return null; // Simulate style not existing
        }
        return null;
    }

    querySelectorAll(selector) {
        if (selector === '.popup-blocker-notification') {
            return this.elements.filter(el => 
                el.className && el.className.includes('popup-blocker-notification')
            );
        }
        return [];
    }
}

/**
 * Mock PopupDetector class for testing notification system
 */
class MockPopupDetector {
    constructor() {
        this.document = new MockDocument();
        this.window = {
            innerWidth: 1920,
            innerHeight: 1080
        };
        this.detectedPopups = new Set();
        
        // Mock global document
        global.document = this.document;
        global.window = this.window;
    }

    // Copy notification system methods
    showNotification(popupData, popupElement) {
        this.removeExistingNotifications();
        const notification = this.createNotificationUI(popupData, popupElement);
        this.document.body.appendChild(notification);
        this.setupNotificationTimeout(notification, popupData.id);
        this.setupNotificationInteractions(notification, popupData, popupElement);
        return notification;
    }

    removeExistingNotifications() {
        const existingNotifications = this.document.querySelectorAll('.popup-blocker-notification');
        existingNotifications.forEach(notification => {
            notification.remove();
        });
    }

    createNotificationUI(popupData, popupElement) {
        const notification = this.document.createElement('div');
        notification.className = 'popup-blocker-notification';
        notification.setAttribute('data-popup-id', popupData.id);

        this.applyNotificationStyles(notification);

        const position = this.calculateNotificationPosition(popupElement);
        notification.style.left = position.left + 'px';
        notification.style.top = position.top + 'px';

        notification.innerHTML = this.createNotificationContent(popupData);

        return notification;
    }

    applyNotificationStyles(notification) {
        const styles = {
            position: 'fixed',
            zIndex: '999999',
            backgroundColor: '#ffffff',
            border: '2px solid #007cba',
            borderRadius: '8px',
            minWidth: '300px',
            maxWidth: '400px'
        };

        Object.assign(notification.style, styles);

        // Mock style sheet creation
        if (!this.document.querySelector('#popup-blocker-styles')) {
            const styleSheet = this.document.createElement('style');
            styleSheet.id = 'popup-blocker-styles';
            this.document.head.appendChild(styleSheet);
        }
    }

    calculateNotificationPosition(popupElement) {
        const popupRect = popupElement.getBoundingClientRect();
        const viewportWidth = this.window.innerWidth;
        const viewportHeight = this.window.innerHeight;
        
        let left = popupRect.right + 10;
        let top = popupRect.top;

        if (left + 300 > viewportWidth) {
            left = popupRect.left - 310;
        }

        if (left < 10) {
            left = (viewportWidth - 300) / 2;
        }

        if (top < 10) {
            top = 10;
        }

        if (top + 150 > viewportHeight) {
            top = viewportHeight - 160;
        }

        return { left, top };
    }

    createNotificationContent(popupData) {
        const confidencePercent = Math.round(popupData.confidence * 100);
        const domain = popupData.domain;

        return `
            <div style="margin-bottom: 12px;">
                <div style="font-weight: 600; color: #007cba; margin-bottom: 4px;">
                    🛡️ ポップアップ広告を検出しました
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                    ドメイン: ${domain} | 信頼度: ${confidencePercent}%
                </div>
                <div style="font-size: 13px; margin-bottom: 12px;">
                    このポップアップを自動的に閉じますか？
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 8px;">
                    <button class="close-button" data-action="close">
                        自動的に閉じる
                    </button>
                    <button class="keep-button" data-action="keep">
                        開いたままにする
                    </button>
                </div>
                <button class="dismiss-button" data-action="dismiss">
                    今回は無視
                </button>
            </div>
            
            <div style="margin-top: 8px; font-size: 11px; color: #999;">
                この決定は類似のポップアップに記憶されます
            </div>
        `;
    }

    setupNotificationTimeout(notification, popupId) {
        // Mock timeout - don't actually wait 15 seconds in tests
        notification._timeoutId = setTimeout(() => {
            if (notification.parentNode) {
                this.dismissNotification(notification, popupId, 'timeout');
            }
        }, 100); // Short timeout for testing
    }

    setupNotificationInteractions(notification, popupData, popupElement) {
        notification.addEventListener('click', (event) => {
            const action = event.target.getAttribute('data-action');
            if (!action) return;

            switch (action) {
                case 'close':
                    this.handleUserDecision(popupData, popupElement, 'close');
                    this.dismissNotification(notification, popupData.id, 'close');
                    break;
                
                case 'keep':
                    this.handleUserDecision(popupData, popupElement, 'keep');
                    this.dismissNotification(notification, popupData.id, 'keep');
                    break;
                
                case 'dismiss':
                    this.dismissNotification(notification, popupData.id, 'dismiss');
                    break;
            }
        });

        notification.setAttribute('tabindex', '0');
    }

    handleUserDecision(popupData, popupElement, decision) {
        // Mock user decision handling
        console.log(`ユーザー決定: ${decision} for popup ${popupData.id}`);
        
        if (decision === 'close') {
            this.closePopup(popupData.id, popupElement);
        }
    }

    dismissNotification(notification, popupId, reason) {
        if (notification._timeoutId) {
            clearTimeout(notification._timeoutId);
        }
        
        notification.style.animation = 'popupBlockerSlideOut 0.3s ease-in';
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 50); // Short animation for testing

        console.log(`通知を削除: ${popupId} (理由: ${reason})`);
    }

    closePopup(popupId, popupElement = null) {
        if (popupElement && popupElement.parentNode) {
            popupElement.style.transition = 'opacity 0.3s ease-out';
            popupElement.style.opacity = '0';
            
            setTimeout(() => {
                if (popupElement.parentNode) {
                    popupElement.remove();
                    console.log(`ポップアップ ${popupId} を削除しました`);
                }
            }, 50); // Short animation for testing
        }

        if (popupElement) {
            this.detectedPopups.delete(popupElement);
        }
    }
}

/**
 * Test suite for notification system
 */
function runNotificationSystemTests() {
    console.log('=== 通知システム機能テスト開始 ===');

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

    // Test 1: 通知UIの作成
    test('通知UIの作成', () => {
        const detector = new MockPopupDetector();
        const popupData = {
            id: 'test-popup-1',
            domain: 'example.com',
            confidence: 0.85
        };
        
        const mockPopupElement = {
            getBoundingClientRect: () => ({
                left: 100,
                top: 100,
                right: 400,
                bottom: 300,
                width: 300,
                height: 200
            })
        };

        const notification = detector.createNotificationUI(popupData, mockPopupElement);

        if (!notification) throw new Error('通知UIが作成されませんでした');
        if (notification.className !== 'popup-blocker-notification') {
            throw new Error('通知UIのクラス名が正しくありません');
        }
        if (!notification.innerHTML.includes('ポップアップ広告を検出しました')) {
            throw new Error('通知コンテンツが正しくありません');
        }
        if (!notification.innerHTML.includes('example.com')) {
            throw new Error('ドメイン情報が含まれていません');
        }
        if (!notification.innerHTML.includes('85%')) {
            throw new Error('信頼度情報が含まれていません');
        }
    });

    // Test 2: 通知の位置計算
    test('通知の位置計算', () => {
        const detector = new MockPopupDetector();
        const mockPopupElement = {
            getBoundingClientRect: () => ({
                left: 100,
                top: 100,
                right: 400,
                bottom: 300,
                width: 300,
                height: 200
            })
        };

        const position = detector.calculateNotificationPosition(mockPopupElement);

        if (typeof position.left !== 'number' || typeof position.top !== 'number') {
            throw new Error('位置計算の結果が数値ではありません');
        }
        if (position.left < 0 || position.top < 0) {
            throw new Error('位置が負の値になっています');
        }
    });

    // Test 3: 通知の表示と削除
    test('通知の表示と削除', (done) => {
        const detector = new MockPopupDetector();
        const popupData = {
            id: 'test-popup-2',
            domain: 'test.com',
            confidence: 0.75
        };
        
        const mockPopupElement = {
            getBoundingClientRect: () => ({
                left: 200,
                top: 200,
                right: 500,
                bottom: 400,
                width: 300,
                height: 200
            })
        };

        // 通知を表示
        const notification = detector.showNotification(popupData, mockPopupElement);

        if (!notification.parentNode) {
            throw new Error('通知がDOMに追加されませんでした');
        }

        // 通知を削除
        detector.dismissNotification(notification, popupData.id, 'test');

        // 短時間待ってから削除を確認
        setTimeout(() => {
            if (notification.parentNode) {
                throw new Error('通知が削除されませんでした');
            }
        }, 100);
    });

    // Test 4: 既存通知の削除
    test('既存通知の削除', () => {
        const detector = new MockPopupDetector();
        
        // 複数の通知を作成
        const notification1 = detector.document.createElement('div');
        notification1.className = 'popup-blocker-notification';
        detector.document.body.appendChild(notification1);
        
        const notification2 = detector.document.createElement('div');
        notification2.className = 'popup-blocker-notification';
        detector.document.body.appendChild(notification2);

        if (detector.document.elements.length !== 2) {
            throw new Error('テスト用通知が正しく作成されませんでした');
        }

        // 既存通知を削除
        detector.removeExistingNotifications();

        if (detector.document.elements.length !== 0) {
            throw new Error('既存通知が削除されませんでした');
        }
    });

    // Test 5: 通知コンテンツの生成
    test('通知コンテンツの生成', () => {
        const detector = new MockPopupDetector();
        const popupData = {
            id: 'test-popup-3',
            domain: 'ads.example.com',
            confidence: 0.92
        };

        const content = detector.createNotificationContent(popupData);

        if (!content.includes('🛡️ ポップアップ広告を検出しました')) {
            throw new Error('タイトルが含まれていません');
        }
        if (!content.includes('ads.example.com')) {
            throw new Error('ドメイン情報が含まれていません');
        }
        if (!content.includes('92%')) {
            throw new Error('信頼度情報が含まれていません');
        }
        if (!content.includes('data-action="close"')) {
            throw new Error('閉じるボタンが含まれていません');
        }
        if (!content.includes('data-action="keep"')) {
            throw new Error('保持ボタンが含まれていません');
        }
        if (!content.includes('data-action="dismiss"')) {
            throw new Error('無視ボタンが含まれていません');
        }
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
    module.exports = { runNotificationSystemTests, MockPopupDetector };
} else {
    runNotificationSystemTests();
}

// Node.js環境での直接実行
if (typeof require !== 'undefined' && require.main === module) {
    runNotificationSystemTests();
}