/**
 * User Action Detection System
 * Detects when user interacts with extension to enable activeTab permission usage
 * Chrome拡張機能のユーザーアクション検出システム
 */

class UserActionDetector {
  constructor() {
    this.userInteractionDetected = false;
    this.lastInteractionTime = null;
    this.interactionTypes = new Set();
    this.interactionHistory = [];
    this.permissionRequestQueue = [];
    this.eventListeners = new Map();
    this.activeTabAvailable = false;
    this.interactionCallbacks = new Set();
    
    // Initialize the detection system
    this.initialize();
  }

  /**
   * Initialize user action detection system
   */
  initialize() {
    console.log('Initializing User Action Detection System...');
    
    try {
      // Check if we're in the correct context
      if (!this.validateContext()) {
        console.warn('User Action Detection System: Invalid context, using fallback mode');
        this.initializeFallbackMode();
        return;
      }
      
      // Set up various user interaction listeners with error handling
      // Only set up listeners for APIs that are actually available and needed
      this.safeSetupExtensionActionListener();
      this.safeSetupPopupInteractionListener();
      this.safeSetupMessageListener();
      
      // Optional listeners - only set up if APIs are available
      this.conditionalSetupContextMenuListener();
      this.conditionalSetupKeyboardShortcutListener();
      this.conditionalSetupTabActivationListener();
      
      // Initialize storage for interaction state (with error handling)
      this.safeInitializeInteractionStorage();
      
      // Restore previous interaction state if available (with error handling)
      this.safeRestoreInteractionState();
      
      console.log('User Action Detection System initialized successfully');
    } catch (error) {
      console.error('Failed to initialize User Action Detection System:', error);
      
      // Initialize fallback mode
      this.initializeFallbackMode();
      
      // Report error to global error handler if available
      if (typeof globalErrorHandler !== 'undefined') {
        globalErrorHandler.handleError(
          error,
          'COMPONENT_FAILURE',
          'HIGH',
          { component: 'UserActionDetector', operation: 'initialize' }
        );
      }
    }
  }

  /**
   * Validate execution context
   */
  validateContext() {
    // Check if we're in a Chrome extension context
    if (typeof chrome === 'undefined') {
      console.warn('Chrome APIs not available');
      return false;
    }
    
    // Check if we're in service worker or content script context
    const isServiceWorker = typeof importScripts === 'function';
    const isContentScript = typeof window !== 'undefined' && typeof document !== 'undefined';
    const isPopup = typeof window !== 'undefined' && window.location?.protocol === 'chrome-extension:';
    
    if (!isServiceWorker && !isContentScript && !isPopup) {
      console.warn('Unknown execution context');
      return false;
    }
    
    console.log('Context validation passed:', {
      isServiceWorker,
      isContentScript,
      isPopup,
      chromeRuntime: !!chrome.runtime
    });
    
    return true;
  }

  /**
   * Initialize fallback mode when Chrome APIs are not available
   */
  initializeFallbackMode() {
    console.log('Initializing User Action Detection System in fallback mode...');
    
    this.fallbackMode = true;
    
    // Set up basic message listener for fallback communication
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'user_interaction') {
          this.handleUserInteraction(event.data.interactionType || 'fallback_interaction', {
            data: event.data.data,
            timestamp: Date.now(),
            source: 'fallback'
          });
        }
      });
    }
    
    // Assume user interaction is available in fallback mode
    this.userInteractionDetected = true;
    this.activeTabAvailable = true;
    this.lastInteractionTime = Date.now();
    
    console.log('Fallback mode initialized');
  }

  /**
   * Safely set up extension action click listener
   * This is the primary way users interact with the extension
   */
  safeSetupExtensionActionListener() {
    try {
      if (chrome.action && chrome.action.onClicked) {
        const listener = (tab) => {
          console.log('User interaction detected: Extension action clicked', tab?.id);
          this.handleUserInteraction('extension_action', {
            tabId: tab?.id,
            url: tab?.url,
            timestamp: Date.now()
          });
        };
        
        chrome.action.onClicked.addListener(listener);
        this.eventListeners.set('extension_action', listener);
        console.log('Extension action listener registered');
      } else {
        console.info('chrome.action.onClicked not available - extension action detection disabled');
      }
    } catch (error) {
      console.error('Error setting up extension action listener:', error);
    }
  }

  /**
   * Conditionally set up context menu interaction listener
   * Only if the API is available and context menus are configured
   */
  conditionalSetupContextMenuListener() {
    // Only set up if context menus are actually configured in manifest
    if (!this.isContextMenuConfigured()) {
      console.info('Context menu not configured in manifest - skipping listener setup');
      return;
    }
    
    this.safeSetupContextMenuListener();
  }

  /**
   * Conditionally set up keyboard shortcut listener
   * Only if commands are configured in manifest
   */
  conditionalSetupKeyboardShortcutListener() {
    // Only set up if keyboard shortcuts are actually configured in manifest
    if (!this.areKeyboardShortcutsConfigured()) {
      console.info('Keyboard shortcuts not configured in manifest - skipping listener setup');
      return;
    }
    
    this.safeSetupKeyboardShortcutListener();
  }

  /**
   * Conditionally set up tab activation listener
   * Only if tabs permission is available
   */
  conditionalSetupTabActivationListener() {
    // Only set up if tabs API is available
    if (!chrome.tabs || !chrome.tabs.onActivated) {
      console.info('chrome.tabs.onActivated not available - skipping tab activation listener');
      return;
    }
    
    this.safeSetupTabActivationListener();
  }

  /**
   * Check if context menu is configured in manifest
   */
  isContextMenuConfigured() {
    try {
      const manifest = chrome.runtime?.getManifest();
      return !!(manifest && manifest.permissions && manifest.permissions.includes('contextMenus'));
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if keyboard shortcuts are configured in manifest
   */
  areKeyboardShortcutsConfigured() {
    try {
      const manifest = chrome.runtime?.getManifest();
      return !!(manifest && manifest.commands && Object.keys(manifest.commands).length > 0);
    } catch (error) {
      return false;
    }
  }

  /**
   * Safely set up context menu interaction listener
   */
  safeSetupContextMenuListener() {
    try {
      if (chrome.contextMenus && chrome.contextMenus.onClicked) {
        const listener = (info, tab) => {
          console.log('User interaction detected: Context menu clicked', info.menuItemId);
          this.handleUserInteraction('context_menu', {
            menuItemId: info.menuItemId,
            tabId: tab?.id,
            url: tab?.url,
            timestamp: Date.now()
          });
        };
        
        chrome.contextMenus.onClicked.addListener(listener);
        this.eventListeners.set('context_menu', listener);
        console.log('Context menu listener registered');
      } else {
        console.info('chrome.contextMenus.onClicked not available - context menu detection disabled');
      }
    } catch (error) {
      console.error('Error setting up context menu listener:', error);
    }
  }

  /**
   * Safely set up keyboard shortcut listener
   */
  safeSetupKeyboardShortcutListener() {
    try {
      if (chrome.commands && chrome.commands.onCommand) {
        const listener = (command, tab) => {
          console.log('User interaction detected: Keyboard shortcut used', command);
          this.handleUserInteraction('keyboard_shortcut', {
            command: command,
            tabId: tab?.id,
            url: tab?.url,
            timestamp: Date.now()
          });
        };
        
        chrome.commands.onCommand.addListener(listener);
        this.eventListeners.set('keyboard_shortcut', listener);
        console.log('Keyboard shortcut listener registered');
      } else {
        console.info('chrome.commands.onCommand not available - keyboard shortcuts disabled');
      }
    } catch (error) {
      console.error('Error setting up keyboard shortcut listener:', error);
    }
  }

  /**
   * Safely set up popup interaction listener
   * Detects when user opens the extension popup
   */
  safeSetupPopupInteractionListener() {
    try {
      // Listen for popup opening through runtime messages
      const listener = (message, sender, sendResponse) => {
        if (message.type === 'popup_opened') {
          console.log('User interaction detected: Popup opened');
          this.handleUserInteraction('popup_opened', {
            timestamp: Date.now(),
            sender: sender
          });
          sendResponse({ success: true });
        }
        return false; // Don't keep message channel open
      };
      
      if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(listener);
        this.eventListeners.set('popup_interaction', listener);
        console.log('Popup interaction listener registered');
      }
    } catch (error) {
      console.error('Error setting up popup interaction listener:', error);
    }
  }

  /**
   * Safely set up general message listener for user interactions
   */
  safeSetupMessageListener() {
    try {
      if (chrome.runtime && chrome.runtime.onMessage) {
        const listener = (message, sender, sendResponse) => {
          if (message.type === 'user_interaction') {
            console.log('User interaction detected: Message from UI component', message.interactionType);
            this.handleUserInteraction(message.interactionType || 'ui_interaction', {
              data: message.data,
              timestamp: Date.now(),
              sender: sender
            });
            sendResponse({ success: true, interactionDetected: true });
            return true;
          }
          return false;
        };
        
        chrome.runtime.onMessage.addListener(listener);
        this.eventListeners.set('message_interaction', listener);
        console.log('Message interaction listener registered');
      }
    } catch (error) {
      console.error('Error setting up message listener:', error);
    }
  }

  /**
   * Safely set up tab activation listener
   * Helps track user activity context
   */
  safeSetupTabActivationListener() {
    try {
      if (chrome.tabs && chrome.tabs.onActivated) {
        const listener = (activeInfo) => {
          // Tab activation alone doesn't grant activeTab, but it shows user activity
          console.log('Tab activated:', activeInfo.tabId);
          this.updateUserActivityContext({
            type: 'tab_activation',
            tabId: activeInfo.tabId,
            timestamp: Date.now()
          });
        };
        
        chrome.tabs.onActivated.addListener(listener);
        this.eventListeners.set('tab_activation', listener);
        console.log('Tab activation listener registered');
      }
    } catch (error) {
      console.error('Error setting up tab activation listener:', error);
    }
  }

  /**
   * Handle detected user interaction
   */
  async handleUserInteraction(interactionType, details = {}) {
    try {
      console.log(`Processing user interaction: ${interactionType}`, details);
      
      // Update interaction state
      this.userInteractionDetected = true;
      this.lastInteractionTime = Date.now();
      this.interactionTypes.add(interactionType);
      
      // Add to interaction history
      const interactionRecord = {
        type: interactionType,
        timestamp: this.lastInteractionTime,
        details: details,
        id: this.generateInteractionId()
      };
      
      this.interactionHistory.push(interactionRecord);
      
      // Keep only last 50 interactions
      if (this.interactionHistory.length > 50) {
        this.interactionHistory = this.interactionHistory.slice(-50);
      }
      
      // Store interaction state
      await this.safeStoreInteractionState();
      
      // Check if activeTab permission is now available
      await this.safeCheckActiveTabAvailability();
      
      // Process any queued permission requests
      await this.processPermissionQueue();
      
      // Notify callbacks about user interaction
      this.notifyInteractionCallbacks(interactionRecord);
      
      // Update permission error handler if available
      if (typeof permissionErrorHandler !== 'undefined') {
        await permissionErrorHandler.handleUserInteraction();
      }
      
      console.log(`User interaction processed successfully: ${interactionType}`);
    } catch (error) {
      console.error('Error processing user interaction:', error);
      
      if (typeof globalErrorHandler !== 'undefined') {
        globalErrorHandler.handleError(
          error,
          'USER_INTERACTION_ERROR',
          'MEDIUM',
          { interactionType, details }
        );
      }
    }
  }

  /**
   * Safely check if activeTab permission is now available after user interaction
   */
  async safeCheckActiveTabAvailability() {
    try {
      if (this.fallbackMode) {
        // In fallback mode, assume activeTab is available
        this.activeTabAvailable = true;
        return true;
      }
      
      if (!this.userInteractionDetected) {
        this.activeTabAvailable = false;
        return false;
      }
      
      // Test activeTab permission functionality
      if (chrome.tabs && chrome.tabs.query) {
        const tabs = await new Promise((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError) {
              console.warn('ActiveTab test failed:', chrome.runtime.lastError.message);
              resolve([]);
            } else {
              resolve(tabs || []);
            }
          });
        });
        
        const wasAvailable = this.activeTabAvailable;
        this.activeTabAvailable = tabs.length > 0;
        
        if (!wasAvailable && this.activeTabAvailable) {
          console.log('ActiveTab permission is now available after user interaction');
          this.notifyActiveTabAvailable();
        }
        
        return this.activeTabAvailable;
      }
      
      // Fallback: assume available if user interacted
      this.activeTabAvailable = true;
      return true;
    } catch (error) {
      console.error('Error checking activeTab availability:', error);
      this.activeTabAvailable = false;
      return false;
    }
  }

  /**
   * Request permission after user interaction
   */
  async requestPermissionAfterInteraction(permission, options = {}) {
    try {
      console.log(`Permission request: ${permission}`);
      
      // Special handling for activeTab
      if (permission === 'activeTab') {
        if (!this.userInteractionDetected) {
          console.warn('ActiveTab permission requires user interaction');
          
          // Queue the request for when user interacts
          this.queuePermissionRequest(permission, options);
          
          return {
            success: false,
            reason: 'user_interaction_required',
            message: 'Please click the extension icon or use a keyboard shortcut to activate activeTab permission'
          };
        }
        
        // Check if activeTab is functional
        const available = await this.safeCheckActiveTabAvailability();
        return {
          success: available,
          reason: available ? 'granted' : 'not_functional',
          message: available ? 'ActiveTab permission is available' : 'ActiveTab permission not functional'
        };
      }
      
      // For other permissions, use standard Chrome API
      if (chrome.permissions && chrome.permissions.request) {
        const granted = await new Promise((resolve) => {
          chrome.permissions.request({ permissions: [permission] }, (granted) => {
            if (chrome.runtime.lastError) {
              console.error(`Permission request failed for ${permission}:`, chrome.runtime.lastError);
              resolve(false);
            } else {
              resolve(granted);
            }
          });
        });
        
        return {
          success: granted,
          reason: granted ? 'granted' : 'denied',
          message: `Permission ${permission} ${granted ? 'granted' : 'denied'}`
        };
      }
      
      return {
        success: false,
        reason: 'api_unavailable',
        message: 'chrome.permissions API not available'
      };
    } catch (error) {
      console.error(`Error requesting permission ${permission}:`, error);
      return {
        success: false,
        reason: 'error',
        message: error.message
      };
    }
  }

  /**
   * Queue permission request for when user interacts
   */
  queuePermissionRequest(permission, options = {}) {
    const request = {
      permission,
      options,
      timestamp: Date.now(),
      id: this.generateInteractionId()
    };
    
    this.permissionRequestQueue.push(request);
    console.log(`Queued permission request: ${permission}`);
  }

  /**
   * Process queued permission requests after user interaction
   */
  async processPermissionQueue() {
    if (this.permissionRequestQueue.length === 0) {
      return;
    }
    
    console.log(`Processing ${this.permissionRequestQueue.length} queued permission requests`);
    
    const requests = [...this.permissionRequestQueue];
    this.permissionRequestQueue = [];
    
    for (const request of requests) {
      try {
        const result = await this.requestPermissionAfterInteraction(request.permission, request.options);
        console.log(`Processed queued permission request ${request.permission}:`, result);
        
        // Notify callback if provided
        if (request.options.callback) {
          request.options.callback(result);
        }
      } catch (error) {
        console.error(`Error processing queued permission request ${request.permission}:`, error);
      }
    }
  }

  /**
   * Register callback for user interactions
   */
  onUserInteraction(callback) {
    if (typeof callback === 'function') {
      this.interactionCallbacks.add(callback);
      console.log('User interaction callback registered');
    }
  }

  /**
   * Unregister callback for user interactions
   */
  offUserInteraction(callback) {
    this.interactionCallbacks.delete(callback);
  }

  /**
   * Notify callbacks about user interaction
   */
  notifyInteractionCallbacks(interactionRecord) {
    for (const callback of this.interactionCallbacks) {
      try {
        callback(interactionRecord);
      } catch (error) {
        console.error('Error in user interaction callback:', error);
      }
    }
  }

  /**
   * Notify that activeTab is now available
   */
  notifyActiveTabAvailable() {
    const event = {
      type: 'activeTab_available',
      timestamp: Date.now(),
      userInteractionDetected: this.userInteractionDetected
    };
    
    this.notifyInteractionCallbacks(event);
    
    // Send message to content scripts if possible
    if (chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'ACTIVETAB_AVAILABLE',
              data: event
            }).catch(() => {
              // Ignore errors - content script might not be loaded
            });
          }
        });
      });
    }
  }

  /**
   * Update user activity context (for tab changes, etc.)
   */
  updateUserActivityContext(context) {
    // This doesn't count as a user interaction for activeTab,
    // but helps track user activity patterns
    console.log('User activity context updated:', context.type);
  }

  /**
   * Safely initialize interaction storage
   */
  async safeInitializeInteractionStorage() {
    try {
      if (chrome.storage && chrome.storage.local) {
        // Ensure storage structure exists
        const result = await chrome.storage.local.get(['userInteractionState']);
        if (!result.userInteractionState) {
          await chrome.storage.local.set({
            userInteractionState: {
              lastInteractionTime: null,
              interactionTypes: [],
              sessionStartTime: Date.now()
            }
          });
        }
        console.log('Interaction storage initialized');
      } else {
        console.info('Chrome storage not available, using memory-only state');
      }
    } catch (error) {
      console.error('Error initializing interaction storage:', error);
      // Continue without storage - use memory only
    }
  }

  /**
   * Safely store current interaction state
   */
  async safeStoreInteractionState() {
    try {
      if (chrome.storage && chrome.storage.local) {
        const state = {
          userInteractionDetected: this.userInteractionDetected,
          lastInteractionTime: this.lastInteractionTime,
          interactionTypes: Array.from(this.interactionTypes),
          activeTabAvailable: this.activeTabAvailable,
          sessionStartTime: Date.now(),
          interactionHistory: this.interactionHistory.slice(-10) // Store last 10 interactions
        };
        
        await chrome.storage.local.set({ userInteractionState: state });
        console.log('Interaction state stored successfully');
      }
    } catch (error) {
      console.error('Error storing interaction state:', error);
      // Continue without storage - state remains in memory
    }
  }

  /**
   * Safely restore interaction state from storage
   */
  async safeRestoreInteractionState() {
    try {
      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(['userInteractionState']);
        const state = result.userInteractionState;
        
        if (state) {
          // Only restore if interaction was recent (within last hour)
          const oneHourAgo = Date.now() - (60 * 60 * 1000);
          
          if (state.lastInteractionTime && state.lastInteractionTime > oneHourAgo) {
            this.userInteractionDetected = state.userInteractionDetected || false;
            this.lastInteractionTime = state.lastInteractionTime;
            this.interactionTypes = new Set(state.interactionTypes || []);
            this.activeTabAvailable = state.activeTabAvailable || false;
            this.interactionHistory = state.interactionHistory || [];
            
            console.log('User interaction state restored from storage');
            
            // Re-check activeTab availability
            await this.safeCheckActiveTabAvailability();
          } else {
            console.log('Previous interaction state expired, starting fresh');
          }
        }
      }
    } catch (error) {
      console.error('Error restoring interaction state:', error);
      // Continue with default state
    }
  }

  /**
   * Generate unique interaction ID
   */
  generateInteractionId() {
    return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current interaction status
   */
  getInteractionStatus() {
    return {
      userInteractionDetected: this.userInteractionDetected,
      lastInteractionTime: this.lastInteractionTime,
      interactionTypes: Array.from(this.interactionTypes),
      activeTabAvailable: this.activeTabAvailable,
      interactionHistory: this.interactionHistory,
      queuedRequests: this.permissionRequestQueue.length
    };
  }

  /**
   * Check if user has interacted recently
   */
  hasRecentInteraction(timeWindow = 300000) { // 5 minutes default
    if (!this.lastInteractionTime) return false;
    return (Date.now() - this.lastInteractionTime) < timeWindow;
  }

  /**
   * Wait for user interaction
   */
  async waitForUserInteraction(timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (this.userInteractionDetected) {
        resolve(this.getInteractionStatus());
        return;
      }
      
      const timeoutId = setTimeout(() => {
        this.offUserInteraction(interactionHandler);
        reject(new Error('Timeout waiting for user interaction'));
      }, timeout);
      
      const interactionHandler = (interaction) => {
        clearTimeout(timeoutId);
        this.offUserInteraction(interactionHandler);
        resolve(this.getInteractionStatus());
      };
      
      this.onUserInteraction(interactionHandler);
    });
  }

  /**
   * Reset interaction state
   */
  reset() {
    this.userInteractionDetected = false;
    this.lastInteractionTime = null;
    this.interactionTypes.clear();
    this.interactionHistory = [];
    this.permissionRequestQueue = [];
    this.activeTabAvailable = false;
    
    console.log('User action detector reset');
  }

  /**
   * Cleanup event listeners
   */
  cleanup() {
    console.log('Cleaning up User Action Detector...');
    
    // Remove event listeners
    for (const [type, listener] of this.eventListeners.entries()) {
      try {
        switch (type) {
          case 'extension_action':
            if (chrome.action && chrome.action.onClicked) {
              chrome.action.onClicked.removeListener(listener);
            }
            break;
          case 'context_menu':
            if (chrome.contextMenus && chrome.contextMenus.onClicked) {
              chrome.contextMenus.onClicked.removeListener(listener);
            }
            break;
          case 'keyboard_shortcut':
            if (chrome.commands && chrome.commands.onCommand) {
              chrome.commands.onCommand.removeListener(listener);
            }
            break;
          case 'popup_interaction':
          case 'message_interaction':
            if (chrome.runtime && chrome.runtime.onMessage) {
              chrome.runtime.onMessage.removeListener(listener);
            }
            break;
          case 'tab_activation':
            if (chrome.tabs && chrome.tabs.onActivated) {
              chrome.tabs.onActivated.removeListener(listener);
            }
            break;
        }
      } catch (error) {
        console.error(`Error removing ${type} listener:`, error);
      }
    }
    
    this.eventListeners.clear();
    this.interactionCallbacks.clear();
    
    console.log('User Action Detector cleanup completed');
  }
}

// Create global instance
const userActionDetector = new UserActionDetector();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UserActionDetector, userActionDetector };
} else if (typeof window !== 'undefined') {
  window.UserActionDetector = UserActionDetector;
  window.userActionDetector = userActionDetector;
} else if (typeof self !== 'undefined') {
  self.UserActionDetector = UserActionDetector;
  self.userActionDetector = userActionDetector;
}

console.log('User Action Detection System loaded');