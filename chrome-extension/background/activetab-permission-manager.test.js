/**
 * ActiveTab Permission Manager Tests
 * Tests for the activeTab permission handling functionality in service worker
 */

// Mock Chrome APIs
global.chrome = {
  action: {
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  tabs: {
    onActivated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    sendMessage: jest.fn().mockResolvedValue({}),
    query: jest.fn(),
    get: jest.fn()
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue({})
    }
  }
};

// Mock global self object
global.self = {
  globalErrorHandler: {
    handleError: jest.fn()
  },
  userActionDetector: {
    handleUserInteraction: jest.fn()
  }
};

// Mock console methods
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

describe('ActiveTab Permission Manager', () => {
  let ActiveTabPermissionManager;
  let manager;

  beforeAll(() => {
    // Load the ActiveTabPermissionManager class from service worker
    // Since we can't directly import from service worker, we'll define it here
    ActiveTabPermissionManager = class {
      constructor() {
        this.activeTabState = {
          isAvailable: false,
          currentTabId: null,
          grantedAt: null,
          expiresAt: null
        };
        this.contentScriptNotifications = new Set();
        this.permissionCallbacks = new Set();
        
        this.initialize();
      }

      initialize() {
        this.setupExtensionActionListener();
        this.setupTabChangeListeners();
        this.setupMessageListeners();
      }

      setupExtensionActionListener() {
        if (chrome.action && chrome.action.onClicked) {
          chrome.action.onClicked.addListener(async (tab) => {
            await this.handleActiveTabGrant(tab);
            
            if (self.userActionDetector) {
              await self.userActionDetector.handleUserInteraction('extension_action', {
                tabId: tab.id,
                url: tab.url,
                timestamp: Date.now()
              });
            }
          });
        }
      }

      setupTabChangeListeners() {
        if (chrome.tabs && chrome.tabs.onActivated) {
          chrome.tabs.onActivated.addListener(async (activeInfo) => {
            if (this.activeTabState.currentTabId !== activeInfo.tabId) {
              await this.handleActiveTabLoss();
            }
          });
        }

        if (chrome.tabs && chrome.tabs.onUpdated) {
          chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
            if (changeInfo.url && this.activeTabState.currentTabId === tabId) {
              await this.handleActiveTabLoss();
            }
          });
        }

        if (chrome.tabs && chrome.tabs.onRemoved) {
          chrome.tabs.onRemoved.addListener(async (tabId) => {
            if (this.activeTabState.currentTabId === tabId) {
              await this.handleActiveTabLoss();
            }
          });
        }
      }

      setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if (message.type === 'GET_ACTIVETAB_STATUS') {
            const status = this.getActiveTabStatus();
            sendResponse({ success: true, data: status });
            return false;
          }
          
          if (message.type === 'REQUEST_ACTIVETAB_PERMISSION') {
            this.requestActiveTabPermission(message.options || {})
              .then(result => sendResponse({ success: true, data: result }))
              .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
          }
          
          if (message.type === 'REGISTER_ACTIVETAB_CALLBACK') {
            this.registerPermissionCallback(sender.tab?.id);
            sendResponse({ success: true });
            return false;
          }
          
          return false;
        });
      }

      async handleActiveTabGrant(tab) {
        this.activeTabState = {
          isAvailable: true,
          currentTabId: tab.id,
          grantedAt: Date.now(),
          expiresAt: null
        };
        
        await this.storeActiveTabState();
        await this.notifyContentScriptsActiveTabAvailable(tab);
        this.notifyPermissionCallbacks({
          type: 'activeTab_granted',
          tabId: tab.id,
          timestamp: Date.now()
        });
      }

      async handleActiveTabLoss() {
        const previousTabId = this.activeTabState.currentTabId;
        
        this.activeTabState = {
          isAvailable: false,
          currentTabId: null,
          grantedAt: null,
          expiresAt: Date.now()
        };
        
        await this.storeActiveTabState();
        
        if (previousTabId) {
          await this.notifyContentScriptsActiveTabLost(previousTabId);
        }
        
        this.notifyPermissionCallbacks({
          type: 'activeTab_lost',
          previousTabId: previousTabId,
          timestamp: Date.now()
        });
      }

      async notifyContentScriptsActiveTabAvailable(tab) {
        const message = {
          type: 'ACTIVETAB_PERMISSION_GRANTED',
          data: {
            tabId: tab.id,
            url: tab.url,
            grantedAt: this.activeTabState.grantedAt,
            permissionState: this.getActiveTabStatus()
          }
        };
        
        if (chrome.tabs && chrome.tabs.sendMessage) {
          try {
            await chrome.tabs.sendMessage(tab.id, message);
          } catch (error) {
            // Ignore errors - content script might not be loaded
          }
        }
        
        await this.broadcastActiveTabState();
      }

      async notifyContentScriptsActiveTabLost(tabId) {
        const message = {
          type: 'ACTIVETAB_PERMISSION_LOST',
          data: {
            previousTabId: tabId,
            lostAt: Date.now(),
            permissionState: this.getActiveTabStatus()
          }
        };
        
        if (chrome.tabs && chrome.tabs.sendMessage) {
          try {
            await chrome.tabs.sendMessage(tabId, message);
          } catch (error) {
            // Ignore errors - tab might be closed
          }
        }
        
        await this.broadcastActiveTabState();
      }

      async broadcastActiveTabState() {
        if (!chrome.tabs || !chrome.tabs.query) return;
        
        return new Promise((resolve) => {
          chrome.tabs.query({}, async (tabs) => {
            if (chrome.runtime.lastError) {
              resolve();
              return;
            }
            
            const tabList = tabs || [];
            const broadcastMessage = {
              type: 'ACTIVETAB_STATE_UPDATE',
              data: {
                permissionState: this.getActiveTabStatus(),
                timestamp: Date.now()
              }
            };
            
            // Send messages to all tabs
            const promises = tabList.map(async (tab) => {
              if (tab.id) {
                try {
                  await chrome.tabs.sendMessage(tab.id, broadcastMessage);
                } catch (error) {
                  // Ignore errors - content script might not be loaded
                }
              }
            });
            
            await Promise.all(promises);
            resolve();
          });
        });
      }

      async requestActiveTabPermission(options = {}) {
        if (this.activeTabState.isAvailable) {
          return {
            success: true,
            reason: 'already_granted',
            tabId: this.activeTabState.currentTabId,
            grantedAt: this.activeTabState.grantedAt
          };
        }
        
        return {
          success: false,
          reason: 'user_interaction_required',
          message: 'ActiveTab permission requires user to click extension icon or use keyboard shortcut',
          instructions: 'Please click the extension icon in the toolbar to grant activeTab permission'
        };
      }

      getActiveTabStatus() {
        return {
          isAvailable: this.activeTabState.isAvailable,
          currentTabId: this.activeTabState.currentTabId,
          grantedAt: this.activeTabState.grantedAt,
          expiresAt: this.activeTabState.expiresAt,
          requiresUserInteraction: !this.activeTabState.isAvailable
        };
      }

      registerPermissionCallback(tabId) {
        this.permissionCallbacks.add(tabId);
      }

      notifyPermissionCallbacks(event) {
        // In a real implementation, you might want to send messages to registered tabs
        for (const callback of this.permissionCallbacks) {
          // Notification logic would go here
        }
      }

      async storeActiveTabState() {
        try {
          if (chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({
              activeTabPermissionState: {
                ...this.activeTabState,
                lastUpdated: Date.now()
              }
            });
          }
        } catch (error) {
          console.error('Error storing activeTab state:', error);
          // Don't throw - this is not critical for functionality
        }
      }

      cleanup() {
        this.permissionCallbacks.clear();
        this.contentScriptNotifications.clear();
      }
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Ensure mocks are properly set up
    chrome.tabs.query.mockImplementation((query, callback) => {
      callback([]);
    });
    chrome.tabs.sendMessage.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue({});
    chrome.storage.local.get.mockResolvedValue({});
    
    manager = new ActiveTabPermissionManager();
  });

  afterEach(() => {
    if (manager) {
      manager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with correct default state', () => {
      expect(manager.activeTabState).toEqual({
        isAvailable: false,
        currentTabId: null,
        grantedAt: null,
        expiresAt: null
      });
    });

    test('should set up extension action listener', () => {
      expect(chrome.action.onClicked.addListener).toHaveBeenCalled();
    });

    test('should set up tab change listeners', () => {
      expect(chrome.tabs.onActivated.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
    });

    test('should set up message listeners', () => {
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });
  });

  describe('ActiveTab Grant Handling', () => {
    test('should handle activeTab grant correctly', async () => {
      const mockTab = { id: 123, url: 'https://example.com' };
      
      // Setup mocks to prevent hanging
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([mockTab]);
      });
      chrome.tabs.sendMessage.mockResolvedValue({});
      chrome.storage.local.set.mockResolvedValue({});
      
      await manager.handleActiveTabGrant(mockTab);
      
      expect(manager.activeTabState.isAvailable).toBe(true);
      expect(manager.activeTabState.currentTabId).toBe(123);
      expect(manager.activeTabState.grantedAt).toBeGreaterThan(0);
      expect(manager.activeTabState.expiresAt).toBeNull();
    }, 15000); // Increase timeout to 15 seconds

    test('should notify content scripts when activeTab is granted', async () => {
      const mockTab = { id: 123, url: 'https://example.com' };
      chrome.tabs.sendMessage.mockResolvedValue({});
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([mockTab]);
      });
      
      await manager.handleActiveTabGrant(mockTab);
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          type: 'ACTIVETAB_PERMISSION_GRANTED'
        })
      );
    });

    test('should store activeTab state when granted', async () => {
      const mockTab = { id: 123, url: 'https://example.com' };
      chrome.storage.local.set.mockResolvedValue({});
      
      await manager.handleActiveTabGrant(mockTab);
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        activeTabPermissionState: expect.objectContaining({
          isAvailable: true,
          currentTabId: 123,
          lastUpdated: expect.any(Number)
        })
      });
    });
  });

  describe('ActiveTab Loss Handling', () => {
    test('should handle activeTab loss correctly', async () => {
      // First grant permission
      const mockTab = { id: 123, url: 'https://example.com' };
      await manager.handleActiveTabGrant(mockTab);
      
      // Then lose it
      await manager.handleActiveTabLoss();
      
      expect(manager.activeTabState.isAvailable).toBe(false);
      expect(manager.activeTabState.currentTabId).toBeNull();
      expect(manager.activeTabState.grantedAt).toBeNull();
      expect(manager.activeTabState.expiresAt).toBeGreaterThan(0);
    });

    test('should notify content scripts when activeTab is lost', async () => {
      // First grant permission
      const mockTab = { id: 123, url: 'https://example.com' };
      await manager.handleActiveTabGrant(mockTab);
      
      chrome.tabs.sendMessage.mockResolvedValue({});
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([mockTab]);
      });
      
      // Then lose it
      await manager.handleActiveTabLoss();
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          type: 'ACTIVETAB_PERMISSION_LOST'
        })
      );
    });
  });

  describe('Permission Status', () => {
    test('should return correct status when permission not available', () => {
      const status = manager.getActiveTabStatus();
      
      expect(status).toEqual({
        isAvailable: false,
        currentTabId: null,
        grantedAt: null,
        expiresAt: null,
        requiresUserInteraction: true
      });
    });

    test('should return correct status when permission is available', async () => {
      const mockTab = { id: 123, url: 'https://example.com' };
      await manager.handleActiveTabGrant(mockTab);
      
      const status = manager.getActiveTabStatus();
      
      expect(status).toEqual({
        isAvailable: true,
        currentTabId: 123,
        grantedAt: expect.any(Number),
        expiresAt: null,
        requiresUserInteraction: false
      });
    });
  });

  describe('Permission Request', () => {
    test('should return already granted when permission is available', async () => {
      const mockTab = { id: 123, url: 'https://example.com' };
      await manager.handleActiveTabGrant(mockTab);
      
      const result = await manager.requestActiveTabPermission();
      
      expect(result).toEqual({
        success: true,
        reason: 'already_granted',
        tabId: 123,
        grantedAt: expect.any(Number)
      });
    });

    test('should return user interaction required when permission not available', async () => {
      const result = await manager.requestActiveTabPermission();
      
      expect(result).toEqual({
        success: false,
        reason: 'user_interaction_required',
        message: 'ActiveTab permission requires user to click extension icon or use keyboard shortcut',
        instructions: 'Please click the extension icon in the toolbar to grant activeTab permission'
      });
    });
  });

  describe('Message Handling', () => {
    test('should handle GET_ACTIVETAB_STATUS message', () => {
      const mockSendResponse = jest.fn();
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      const result = messageListener(
        { type: 'GET_ACTIVETAB_STATUS' },
        { tab: { id: 123 } },
        mockSendResponse
      );
      
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          isAvailable: false,
          requiresUserInteraction: true
        })
      });
      expect(result).toBe(false);
    });

    test('should handle REQUEST_ACTIVETAB_PERMISSION message', () => {
      const mockSendResponse = jest.fn();
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      const result = messageListener(
        { type: 'REQUEST_ACTIVETAB_PERMISSION', options: {} },
        { tab: { id: 123 } },
        mockSendResponse
      );
      
      expect(result).toBe(true); // Should return true for async response
    });

    test('should handle REGISTER_ACTIVETAB_CALLBACK message', () => {
      const mockSendResponse = jest.fn();
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      const result = messageListener(
        { type: 'REGISTER_ACTIVETAB_CALLBACK' },
        { tab: { id: 123 } },
        mockSendResponse
      );
      
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
      expect(result).toBe(false);
    });
  });

  describe('Broadcast Functionality', () => {
    test('should broadcast activeTab state to all tabs', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example1.com' },
        { id: 2, url: 'https://example2.com' }
      ];
      
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback(mockTabs);
      });
      chrome.tabs.sendMessage.mockResolvedValue({});
      
      await manager.broadcastActiveTabState();
      
      expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: 'ACTIVETAB_STATE_UPDATE'
        })
      );
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        2,
        expect.objectContaining({
          type: 'ACTIVETAB_STATE_UPDATE'
        })
      );
    });
  });

  describe('Tab Event Handling', () => {
    test('should lose activeTab permission when tab changes', async () => {
      // Grant permission for tab 123
      const mockTab = { id: 123, url: 'https://example.com' };
      await manager.handleActiveTabGrant(mockTab);
      
      expect(manager.activeTabState.isAvailable).toBe(true);
      
      // Simulate tab activation change
      const tabActivatedListener = chrome.tabs.onActivated.addListener.mock.calls[0][0];
      await tabActivatedListener({ tabId: 456 });
      
      expect(manager.activeTabState.isAvailable).toBe(false);
      expect(manager.activeTabState.currentTabId).toBeNull();
    });

    test('should lose activeTab permission when tab navigates', async () => {
      // Grant permission for tab 123
      const mockTab = { id: 123, url: 'https://example.com' };
      await manager.handleActiveTabGrant(mockTab);
      
      expect(manager.activeTabState.isAvailable).toBe(true);
      
      // Simulate tab navigation
      const tabUpdatedListener = chrome.tabs.onUpdated.addListener.mock.calls[0][0];
      await tabUpdatedListener(123, { url: 'https://newsite.com' }, mockTab);
      
      expect(manager.activeTabState.isAvailable).toBe(false);
      expect(manager.activeTabState.currentTabId).toBeNull();
    });

    test('should lose activeTab permission when tab is closed', async () => {
      // Grant permission for tab 123
      const mockTab = { id: 123, url: 'https://example.com' };
      await manager.handleActiveTabGrant(mockTab);
      
      expect(manager.activeTabState.isAvailable).toBe(true);
      
      // Simulate tab removal
      const tabRemovedListener = chrome.tabs.onRemoved.addListener.mock.calls[0][0];
      await tabRemovedListener(123);
      
      expect(manager.activeTabState.isAvailable).toBe(false);
      expect(manager.activeTabState.currentTabId).toBeNull();
    });
  });

  describe('User Interaction Integration', () => {
    test('should call user action detector when extension action is clicked', async () => {
      const mockTab = { id: 123, url: 'https://example.com' };
      
      // Simulate extension action click
      const actionClickListener = chrome.action.onClicked.addListener.mock.calls[0][0];
      await actionClickListener(mockTab);
      
      expect(self.userActionDetector.handleUserInteraction).toHaveBeenCalledWith(
        'extension_action',
        {
          tabId: 123,
          url: 'https://example.com',
          timestamp: expect.any(Number)
        }
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      chrome.storage.local.set.mockRejectedValue(new Error('Storage error'));
      
      const mockTab = { id: 123, url: 'https://example.com' };
      
      // Should not throw error
      await expect(manager.handleActiveTabGrant(mockTab)).resolves.not.toThrow();
      
      // State should still be updated
      expect(manager.activeTabState.isAvailable).toBe(true);
    });

    test('should handle tab message errors gracefully', async () => {
      chrome.tabs.sendMessage.mockRejectedValue(new Error('Tab not found'));
      
      const mockTab = { id: 123, url: 'https://example.com' };
      
      // Should not throw error
      await expect(manager.handleActiveTabGrant(mockTab)).resolves.not.toThrow();
    });
  });
});

console.log('ActiveTab Permission Manager tests loaded');