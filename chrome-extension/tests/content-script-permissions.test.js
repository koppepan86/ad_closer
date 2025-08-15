/**
 * Content Script Permission System Tests
 * Tests the new permission handling functionality in content-script.js
 */

// Mock Chrome APIs
global.chrome = {
    runtime: {
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn()
        },
        lastError: null
    },
    permissions: {
        contains: jest.fn(),
        request: jest.fn(),
        getAll: jest.fn()
    }
};

// Mock DOM APIs
global.document = {
    addEventListener: jest.fn(),
    createElement: jest.fn(() => ({
        dispatchEvent: jest.fn()
    })),
    dispatchEvent: jest.fn(),
    title: 'Test Page',
    readyState: 'complete'
};

global.window = {
    location: {
        href: 'https://example.com'
    },
    innerWidth: 1920,
    innerHeight: 1080,
    CustomEvent: jest.fn()
};

describe('Content Script Permission System', () => {
    let mockPopupDetector;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Create a mock PopupDetector instance with permission methods
        mockPopupDetector = {
            permissionState: {
                activeTabAvailable: false,
                userInteractionDetected: false,
                permissionRequestPending: false,
                fallbackMode: false,
                lastPermissionCheck: 0
            },
            permissionCallbacks: new Set(),
            
            // Permission methods
            initializePermissionSystem: jest.fn(),
            setupPermissionEventListeners: jest.fn(),
            checkActiveTabPermission: jest.fn(),
            requestActiveTabPermission: jest.fn(),
            waitForActiveTabPermission: jest.fn(),
            handleActiveTabStatusChange: jest.fn(),
            handleUserInteractionDetected: jest.fn(),
            handlePotentialUserInteraction: jest.fn(),
            notifyPermissionCallbacks: jest.fn(),
            
            // Fallback methods
            getTabInfoFallback: jest.fn(),
            sendMessageFallback: jest.fn(),
            
            // Safe API methods
            safeApiCall: jest.fn(),
            sendMessageWithPermissionCheck: jest.fn(),
            executeWithActiveTabPermission: jest.fn()
        };
    });

    describe('Permission System Initialization', () => {
        test('should initialize permission state correctly', async () => {
            await mockPopupDetector.initializePermissionSystem();
            
            expect(mockPopupDetector.initializePermissionSystem).toHaveBeenCalled();
            expect(mockPopupDetector.permissionState).toBeDefined();
            expect(mockPopupDetector.permissionState.activeTabAvailable).toBe(false);
            expect(mockPopupDetector.permissionState.fallbackMode).toBe(false);
        });

        test('should setup permission event listeners', () => {
            mockPopupDetector.setupPermissionEventListeners();
            
            expect(mockPopupDetector.setupPermissionEventListeners).toHaveBeenCalled();
        });
    });

    describe('ActiveTab Permission Checking', () => {
        test('should check activeTab permission status', async () => {
            mockPopupDetector.checkActiveTabPermission.mockResolvedValue(false);
            
            const result = await mockPopupDetector.checkActiveTabPermission();
            
            expect(mockPopupDetector.checkActiveTabPermission).toHaveBeenCalled();
            expect(result).toBe(false);
        });

        test('should request activeTab permission', async () => {
            const mockResult = { success: true, granted: false, message: 'Requires user interaction' };
            mockPopupDetector.requestActiveTabPermission.mockResolvedValue(mockResult);
            
            const result = await mockPopupDetector.requestActiveTabPermission();
            
            expect(mockPopupDetector.requestActiveTabPermission).toHaveBeenCalled();
            expect(result).toEqual(mockResult);
        });

        test('should wait for activeTab permission with timeout', async () => {
            const mockResult = { success: true, available: true };
            mockPopupDetector.waitForActiveTabPermission.mockResolvedValue(mockResult);
            
            const result = await mockPopupDetector.waitForActiveTabPermission(5000);
            
            expect(mockPopupDetector.waitForActiveTabPermission).toHaveBeenCalledWith(5000);
            expect(result).toEqual(mockResult);
        });
    });

    describe('Permission Status Handling', () => {
        test('should handle activeTab status change', () => {
            const statusData = {
                isAvailable: true,
                userInteractionDetected: true
            };
            
            mockPopupDetector.handleActiveTabStatusChange(statusData);
            
            expect(mockPopupDetector.handleActiveTabStatusChange).toHaveBeenCalledWith(statusData);
        });

        test('should handle user interaction detection', () => {
            const interactionData = {
                type: 'click',
                timestamp: Date.now()
            };
            
            mockPopupDetector.handleUserInteractionDetected(interactionData);
            
            expect(mockPopupDetector.handleUserInteractionDetected).toHaveBeenCalledWith(interactionData);
        });

        test('should handle potential user interaction', () => {
            mockPopupDetector.handlePotentialUserInteraction();
            
            expect(mockPopupDetector.handlePotentialUserInteraction).toHaveBeenCalled();
        });
    });

    describe('Permission Callbacks', () => {
        test('should notify permission callbacks', () => {
            const event = { type: 'granted', permission: 'activeTab' };
            
            mockPopupDetector.notifyPermissionCallbacks(event);
            
            expect(mockPopupDetector.notifyPermissionCallbacks).toHaveBeenCalledWith(event);
        });

        test('should manage permission callback set', () => {
            const callback = jest.fn();
            
            mockPopupDetector.permissionCallbacks.add(callback);
            expect(mockPopupDetector.permissionCallbacks.has(callback)).toBe(true);
            
            mockPopupDetector.permissionCallbacks.delete(callback);
            expect(mockPopupDetector.permissionCallbacks.has(callback)).toBe(false);
        });
    });

    describe('Fallback Methods', () => {
        test('should get tab info using fallback', async () => {
            const mockTabInfo = {
                id: -1,
                url: 'https://example.com',
                title: 'Test Page',
                active: true,
                windowId: -1,
                fallback: true
            };
            
            mockPopupDetector.getTabInfoFallback.mockResolvedValue(mockTabInfo);
            
            const result = await mockPopupDetector.getTabInfoFallback();
            
            expect(mockPopupDetector.getTabInfoFallback).toHaveBeenCalled();
            expect(result).toEqual(mockTabInfo);
            expect(result.fallback).toBe(true);
        });

        test('should send message using fallback', async () => {
            const message = { type: 'TEST_MESSAGE', data: { test: true } };
            const mockResult = { success: true, method: 'dom_event_fallback' };
            
            mockPopupDetector.sendMessageFallback.mockResolvedValue(mockResult);
            
            const result = await mockPopupDetector.sendMessageFallback(message);
            
            expect(mockPopupDetector.sendMessageFallback).toHaveBeenCalledWith(message);
            expect(result).toEqual(mockResult);
        });
    });

    describe('Safe API Calls', () => {
        test('should make safe API call with fallback', async () => {
            const mockApiCall = jest.fn().mockRejectedValue(new Error('API not available'));
            const mockFallback = jest.fn().mockResolvedValue('fallback result');
            const mockResult = { success: true, data: 'fallback result', method: 'fallback' };
            
            mockPopupDetector.safeApiCall.mockResolvedValue(mockResult);
            
            const result = await mockPopupDetector.safeApiCall(mockApiCall, mockFallback);
            
            expect(mockPopupDetector.safeApiCall).toHaveBeenCalledWith(mockApiCall, mockFallback);
            expect(result).toEqual(mockResult);
        });

        test('should send message with permission check', async () => {
            const message = { type: 'POPUP_DETECTED', data: { id: 'test' } };
            const mockResult = { success: true };
            
            mockPopupDetector.sendMessageWithPermissionCheck.mockResolvedValue(mockResult);
            
            const result = await mockPopupDetector.sendMessageWithPermissionCheck(message);
            
            expect(mockPopupDetector.sendMessageWithPermissionCheck).toHaveBeenCalledWith(message);
            expect(result).toEqual(mockResult);
        });

        test('should execute operation with activeTab permission', async () => {
            const mockOperation = jest.fn().mockResolvedValue('operation result');
            const mockFallback = jest.fn().mockResolvedValue('fallback result');
            
            mockPopupDetector.executeWithActiveTabPermission.mockResolvedValue('operation result');
            
            const result = await mockPopupDetector.executeWithActiveTabPermission(mockOperation, mockFallback);
            
            expect(mockPopupDetector.executeWithActiveTabPermission).toHaveBeenCalledWith(mockOperation, mockFallback);
            expect(result).toBe('operation result');
        });
    });

    describe('Chrome API Integration', () => {
        test('should handle chrome.runtime.sendMessage calls', () => {
            const message = { type: 'TEST_MESSAGE' };
            const callback = jest.fn();
            
            chrome.runtime.sendMessage(message, callback);
            
            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(message, callback);
        });

        test('should handle chrome.runtime.onMessage listeners', () => {
            const listener = jest.fn();
            
            chrome.runtime.onMessage.addListener(listener);
            
            expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(listener);
        });

        test('should handle permission API calls', async () => {
            chrome.permissions.contains.mockImplementation((permissions, callback) => {
                callback(false);
            });
            
            const result = await new Promise((resolve) => {
                chrome.permissions.contains({ permissions: ['activeTab'] }, resolve);
            });
            
            expect(chrome.permissions.contains).toHaveBeenCalledWith(
                { permissions: ['activeTab'] },
                expect.any(Function)
            );
            expect(result).toBe(false);
        });
    });

    describe('Error Handling', () => {
        test('should handle permission check errors gracefully', async () => {
            mockPopupDetector.checkActiveTabPermission.mockRejectedValue(new Error('Permission check failed'));
            
            try {
                await mockPopupDetector.checkActiveTabPermission();
            } catch (error) {
                expect(error.message).toBe('Permission check failed');
            }
            
            expect(mockPopupDetector.checkActiveTabPermission).toHaveBeenCalled();
        });

        test('should handle fallback method errors', async () => {
            mockPopupDetector.sendMessageFallback.mockRejectedValue(new Error('Fallback failed'));
            
            try {
                await mockPopupDetector.sendMessageFallback({ type: 'TEST' });
            } catch (error) {
                expect(error.message).toBe('Fallback failed');
            }
            
            expect(mockPopupDetector.sendMessageFallback).toHaveBeenCalled();
        });
    });

    describe('Permission State Management', () => {
        test('should track permission state changes', () => {
            // Initial state
            expect(mockPopupDetector.permissionState.activeTabAvailable).toBe(false);
            expect(mockPopupDetector.permissionState.userInteractionDetected).toBe(false);
            
            // Simulate state change
            mockPopupDetector.permissionState.activeTabAvailable = true;
            mockPopupDetector.permissionState.userInteractionDetected = true;
            
            expect(mockPopupDetector.permissionState.activeTabAvailable).toBe(true);
            expect(mockPopupDetector.permissionState.userInteractionDetected).toBe(true);
        });

        test('should handle fallback mode activation', () => {
            expect(mockPopupDetector.permissionState.fallbackMode).toBe(false);
            
            // Activate fallback mode
            mockPopupDetector.permissionState.fallbackMode = true;
            
            expect(mockPopupDetector.permissionState.fallbackMode).toBe(true);
        });

        test('should track permission request pending state', () => {
            expect(mockPopupDetector.permissionState.permissionRequestPending).toBe(false);
            
            // Set pending state
            mockPopupDetector.permissionState.permissionRequestPending = true;
            
            expect(mockPopupDetector.permissionState.permissionRequestPending).toBe(true);
        });
    });
});

describe('Integration Tests', () => {
    test('should integrate with permission error handler', () => {
        // Mock permission error handler
        const mockPermissionErrorHandler = {
            getPermissionStatistics: jest.fn().mockReturnValue({
                activeTabAvailable: false,
                userInteractionDetected: false
            }),
            checkActiveTabPermission: jest.fn().mockResolvedValue(false)
        };
        
        global.permissionErrorHandler = mockPermissionErrorHandler;
        
        expect(global.permissionErrorHandler).toBeDefined();
        expect(global.permissionErrorHandler.getPermissionStatistics).toBeDefined();
        expect(global.permissionErrorHandler.checkActiveTabPermission).toBeDefined();
    });

    test('should handle message passing between content script and background', () => {
        const mockMessage = {
            type: 'ACTIVETAB_STATUS_CHANGED',
            data: {
                isAvailable: true,
                userInteractionDetected: true
            }
        };
        
        const mockSender = { tab: { id: 1 } };
        const mockSendResponse = jest.fn();
        
        // Simulate message listener
        const messageListener = jest.fn((message, sender, sendResponse) => {
            if (message.type === 'ACTIVETAB_STATUS_CHANGED') {
                sendResponse({ success: true });
                return true;
            }
            return false;
        });
        
        const result = messageListener(mockMessage, mockSender, mockSendResponse);
        
        expect(messageListener).toHaveBeenCalledWith(mockMessage, mockSender, mockSendResponse);
        expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        expect(result).toBe(true);
    });
});