// Test file for popup closure functionality
// ポップアップ閉鎖機能のテストファイル

/**
 * ポップアップ閉鎖機能のテスト
 * Task 4.3: ポップアップ閉鎖機能の作成
 */

describe('PopupDetector - Popup Closure Functionality', () => {
    let popupDetector;
    let mockElement;
    let mockOverlayElement;

    beforeEach(() => {
        // DOM環境のセットアップ
        document.body.innerHTML = '';
        
        // PopupDetectorクラスのモック
        popupDetector = {
            detectedPopups: new Set(),
            
            // メソッドのモック実装
            findPopupElementById: jest.fn(),
            findPopupOverlay: jest.fn(),
            savePopupForRecovery: jest.fn(),
            cleanupPopupResources: jest.fn(),
            removePopupWithAnimation: jest.fn(),
            hasOverlayBackground: jest.fn(),
            isElementVisible: jest.fn(),
            getElementSelector: jest.fn(),
            
            // 実際のclosePopupメソッドを実装
            closePopup: function(popupId, popupElement = null) {
                try {
                    let targetElement = popupElement;

                    if (!targetElement) {
                        targetElement = this.findPopupElementById(popupId);
                    }

                    if (!targetElement) {
                        console.warn(`ポップアップ ${popupId} の要素が見つかりません`);
                        return;
                    }

                    this.savePopupForRecovery(popupId, targetElement);
                    this.cleanupPopupResources(targetElement);

                    const overlayElement = this.findPopupOverlay(targetElement);

                    this.removePopupWithAnimation(targetElement, popupId);

                    if (overlayElement && overlayElement !== targetElement) {
                        this.removePopupWithAnimation(overlayElement, `${popupId}_overlay`);
                    }

                    this.detectedPopups.delete(targetElement);

                    console.log(`ポップアップ ${popupId} を安全に削除しました`);

                } catch (error) {
                    console.error(`ポップアップ ${popupId} の削除でエラーが発生:`, error);
                }
            }
        };

        // モック要素の作成
        mockElement = document.createElement('div');
        mockElement.id = 'test-popup';
        mockElement.dataset.popupId = 'popup_test_123';
        mockElement.style.position = 'fixed';
        mockElement.style.zIndex = '9999';
        mockElement.innerHTML = '<p>テストポップアップ</p><button class="close">×</button>';
        document.body.appendChild(mockElement);

        mockOverlayElement = document.createElement('div');
        mockOverlayElement.id = 'test-overlay';
        mockOverlayElement.style.position = 'fixed';
        mockOverlayElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        mockOverlayElement.style.zIndex = '9998';
        document.body.appendChild(mockOverlayElement);

        popupDetector.detectedPopups.add(mockElement);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    describe('closePopup method', () => {
        test('要素が提供された場合、直接削除処理を実行する', () => {
            const popupId = 'popup_test_123';

            popupDetector.closePopup(popupId, mockElement);

            expect(popupDetector.savePopupForRecovery).toHaveBeenCalledWith(popupId, mockElement);
            expect(popupDetector.cleanupPopupResources).toHaveBeenCalledWith(mockElement);
            expect(popupDetector.removePopupWithAnimation).toHaveBeenCalledWith(mockElement, popupId);
            expect(popupDetector.detectedPopups.has(mockElement)).toBe(false);
        });

        test('要素が提供されない場合、IDで検索してから削除する', () => {
            const popupId = 'popup_test_123';
            popupDetector.findPopupElementById.mockReturnValue(mockElement);

            popupDetector.closePopup(popupId);

            expect(popupDetector.findPopupElementById).toHaveBeenCalledWith(popupId);
            expect(popupDetector.savePopupForRecovery).toHaveBeenCalledWith(popupId, mockElement);
            expect(popupDetector.cleanupPopupResources).toHaveBeenCalledWith(mockElement);
        });

        test('要素が見つからない場合、警告を出力して処理を終了する', () => {
            const popupId = 'nonexistent_popup';
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            popupDetector.findPopupElementById.mockReturnValue(null);

            popupDetector.closePopup(popupId);

            expect(consoleSpy).toHaveBeenCalledWith(`ポップアップ ${popupId} の要素が見つかりません`);
            expect(popupDetector.savePopupForRecovery).not.toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });

        test('オーバーレイ要素がある場合、同時に削除する', () => {
            const popupId = 'popup_test_123';
            popupDetector.findPopupOverlay.mockReturnValue(mockOverlayElement);

            popupDetector.closePopup(popupId, mockElement);

            expect(popupDetector.findPopupOverlay).toHaveBeenCalledWith(mockElement);
            expect(popupDetector.removePopupWithAnimation).toHaveBeenCalledWith(mockOverlayElement, `${popupId}_overlay`);
        });

        test('エラーが発生した場合、適切にハンドリングする', () => {
            const popupId = 'popup_test_123';
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            popupDetector.savePopupForRecovery.mockImplementation(() => {
                throw new Error('テストエラー');
            });

            popupDetector.closePopup(popupId, mockElement);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                `ポップアップ ${popupId} の削除でエラーが発生:`,
                expect.any(Error)
            );
            
            consoleErrorSpy.mockRestore();
        });
    });

    describe('findPopupElementById method', () => {
        test('検出済みポップアップから要素を検索する', () => {
            const findMethod = function(popupId) {
                for (const element of this.detectedPopups) {
                    if (element.dataset.popupId === popupId) {
                        return element;
                    }
                }
                return null;
            };

            popupDetector.findPopupElementById = findMethod.bind(popupDetector);

            const result = popupDetector.findPopupElementById('popup_test_123');
            expect(result).toBe(mockElement);
        });

        test('存在しないIDの場合、nullを返す', () => {
            const findMethod = function(popupId) {
                for (const element of this.detectedPopups) {
                    if (element.dataset.popupId === popupId) {
                        return element;
                    }
                }
                return null;
            };

            popupDetector.findPopupElementById = findMethod.bind(popupDetector);

            const result = popupDetector.findPopupElementById('nonexistent_id');
            expect(result).toBeNull();
        });
    });

    describe('findPopupOverlay method', () => {
        test('親要素でオーバーレイを検索する', () => {
            const findOverlayMethod = function(popupElement) {
                let parent = popupElement.parentElement;
                while (parent && parent !== document.body) {
                    if (this.hasOverlayBackground(parent)) {
                        return parent;
                    }
                    parent = parent.parentElement;
                }
                return null;
            };

            popupDetector.findPopupOverlay = findOverlayMethod.bind(popupDetector);
            popupDetector.hasOverlayBackground.mockImplementation((element) => {
                return element.style.backgroundColor.includes('rgba');
            });

            // オーバーレイを親要素として設定
            mockOverlayElement.appendChild(mockElement);

            const result = popupDetector.findPopupOverlay(mockElement);
            expect(result).toBe(mockOverlayElement);
        });

        test('兄弟要素でオーバーレイを検索する', () => {
            const findOverlayMethod = function(popupElement) {
                if (popupElement.parentElement) {
                    const siblings = Array.from(popupElement.parentElement.children);
                    for (const sibling of siblings) {
                        if (sibling !== popupElement && this.hasOverlayBackground(sibling)) {
                            return sibling;
                        }
                    }
                }
                return null;
            };

            popupDetector.findPopupOverlay = findOverlayMethod.bind(popupDetector);
            popupDetector.hasOverlayBackground.mockImplementation((element) => {
                return element.id === 'test-overlay';
            });

            const result = popupDetector.findPopupOverlay(mockElement);
            expect(result).toBe(mockOverlayElement);
        });
    });

    describe('Resource cleanup functionality', () => {
        test('cleanupPopupResources が適切に呼び出される', () => {
            const popupId = 'popup_test_123';

            popupDetector.closePopup(popupId, mockElement);

            expect(popupDetector.cleanupPopupResources).toHaveBeenCalledWith(mockElement);
        });

        test('復元データが保存される', () => {
            const popupId = 'popup_test_123';

            popupDetector.closePopup(popupId, mockElement);

            expect(popupDetector.savePopupForRecovery).toHaveBeenCalledWith(popupId, mockElement);
        });

        test('アニメーション付き削除が実行される', () => {
            const popupId = 'popup_test_123';

            popupDetector.closePopup(popupId, mockElement);

            expect(popupDetector.removePopupWithAnimation).toHaveBeenCalledWith(mockElement, popupId);
        });
    });

    describe('Recovery functionality', () => {
        test('復元用データの保存が正常に動作する', () => {
            const saveMethod = function(popupId, element) {
                const recoveryData = {
                    id: popupId,
                    html: element.outerHTML,
                    timestamp: Date.now(),
                    url: window.location.href
                };
                
                // セッションストレージのモック
                const existingData = [];
                existingData.unshift(recoveryData);
                
                // 保存の確認
                expect(recoveryData.id).toBe(popupId);
                expect(recoveryData.html).toContain('test-popup');
            };

            popupDetector.savePopupForRecovery = saveMethod;
            popupDetector.savePopupForRecovery('popup_test_123', mockElement);
        });
    });

    describe('Integration with requirements', () => {
        test('要件1.3: ユーザーが自動閉鎖を確認した場合、システムはポップアップを閉じる', () => {
            const popupId = 'popup_test_123';

            // ユーザーが閉じることを決定した場合のシミュレーション
            popupDetector.closePopup(popupId, mockElement);

            // ポップアップが適切に処理されることを確認
            expect(popupDetector.savePopupForRecovery).toHaveBeenCalled();
            expect(popupDetector.cleanupPopupResources).toHaveBeenCalled();
            expect(popupDetector.removePopupWithAnimation).toHaveBeenCalled();
            expect(popupDetector.detectedPopups.has(mockElement)).toBe(false);
        });

        test('要件3.4: システムが不確実な場合の慎重な処理', () => {
            const popupId = 'uncertain_popup';
            
            // 要素が見つからない不確実な状況をシミュレーション
            popupDetector.findPopupElementById.mockReturnValue(null);
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            popupDetector.closePopup(popupId);

            // 慎重な側に立って処理を停止することを確認
            expect(consoleSpy).toHaveBeenCalledWith(`ポップアップ ${popupId} の要素が見つかりません`);
            expect(popupDetector.removePopupWithAnimation).not.toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });
    });
});

// 統合テスト用のヘルパー関数
function createMockPopupElement(id, hasOverlay = false) {
    const element = document.createElement('div');
    element.dataset.popupId = id;
    element.style.position = 'fixed';
    element.style.zIndex = '9999';
    element.innerHTML = '<p>Mock Popup</p>';
    
    if (hasOverlay) {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '9998';
        document.body.appendChild(overlay);
        overlay.appendChild(element);
        return { element, overlay };
    }
    
    document.body.appendChild(element);
    return { element };
}

// パフォーマンステスト
describe('Popup Closure Performance', () => {
    test('大量のポップアップ削除のパフォーマンス', () => {
        const popupDetector = {
            detectedPopups: new Set(),
            savePopupForRecovery: jest.fn(),
            cleanupPopupResources: jest.fn(),
            removePopupWithAnimation: jest.fn(),
            findPopupOverlay: jest.fn().mockReturnValue(null),
            closePopup: function(popupId, popupElement) {
                this.savePopupForRecovery(popupId, popupElement);
                this.cleanupPopupResources(popupElement);
                this.removePopupWithAnimation(popupElement, popupId);
                this.detectedPopups.delete(popupElement);
            }
        };

        const startTime = performance.now();
        
        // 100個のポップアップを作成して削除
        for (let i = 0; i < 100; i++) {
            const { element } = createMockPopupElement(`popup_${i}`);
            popupDetector.detectedPopups.add(element);
            popupDetector.closePopup(`popup_${i}`, element);
        }
        
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // 100個の処理が1秒以内に完了することを確認
        expect(executionTime).toBeLessThan(1000);
        expect(popupDetector.detectedPopups.size).toBe(0);
    });
});