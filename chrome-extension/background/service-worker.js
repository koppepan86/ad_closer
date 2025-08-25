/**
 * バックグラウンドサービスワーカー
 * ポップアップ広告ブロッカー拡張機能のメイン制御ハブ
 */

// エラーハンドリングシステムを初期化
function initializeErrorHandling() {
  console.log('Service Worker用エラーハンドリングシステムを初期化中...');

  // Service Workerでは、Content Script用のファイルを直接読み込まず、
  // 専用のフォールバック実装を使用
  const handlersToCreate = [
    'utils/error-handler.js',
    'utils/communication-error-handler.js',
    'utils/permission-error-handler.js',
    'utils/component-recovery.js'
  ];

  let createdHandlers = 0;

  for (const handlerName of handlersToCreate) {
    try {
      createFallbackHandler(handlerName);
      console.log(`Service Worker用ハンドラー作成成功: ${handlerName}`);
      createdHandlers++;
    } catch (error) {
      console.error(`Service Worker用ハンドラー作成失敗: ${handlerName}`, error);
    }
  }

  console.log(`Service Worker用エラーハンドリングシステムの初期化完了: ${createdHandlers}/${handlersToCreate.length} 成功`);

  // Service Worker初期化完了の確認
  console.log('=== Service Worker エラーハンドリング初期化完了 ===');
  console.log('初期化時刻:', new Date().toISOString());
  console.log('作成されたハンドラー:', {
    globalErrorHandler: !!self.globalErrorHandler,
    communicationErrorHandler: !!self.communicationErrorHandler,
    permissionErrorHandler: !!self.permissionErrorHandler,
    componentRecoveryManager: !!self.componentRecoveryManager
  });
  console.log('Service Worker用エラーハンドリングシステムが正常に動作しています');
  console.log('================================================');
}

// Service Worker用フォールバックハンドラーを作成
function createFallbackHandler(scriptName) {
  console.log(`Service Worker用フォールバックハンドラーを作成: ${scriptName}`);

  switch (scriptName) {
    case 'utils/error-handler.js':
      // Service Worker用グローバルエラーハンドラー
      if (!self.globalErrorHandler) {
        self.globalErrorHandler = {
          handleError: (error, type, severity, context) => {
            const errorInfo = {
              timestamp: new Date().toISOString(),
              error: error?.message || String(error),
              type: type || 'UNKNOWN',
              severity: severity || 'MEDIUM',
              context: context || {},
              serviceWorker: true
            };

            console.error('Service Worker エラー:', errorInfo);

            // 重要なエラーの場合は追加処理
            if (severity === 'HIGH' || severity === 'CRITICAL') {
              console.error('重要なエラーが発生しました:', errorInfo);
            }
          },

          logError: (message, data) => {
            console.error(`[Service Worker] ${message}`, data);
          },

          reportError: (error, context) => {
            self.globalErrorHandler.handleError(error, 'REPORTED', 'MEDIUM', context);
          }
        };
      }
      break;

    case 'utils/communication-error-handler.js':
      // Service Worker用通信エラーハンドラー
      if (!self.communicationErrorHandler) {
        self.communicationErrorHandler = {
          connectionStatus: 'unknown',
          messageQueue: [],

          sendMessage: async (message, options = {}) => {
            try {
              const timeout = options.timeout || 5000;

              return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                  reject(new Error('Message timeout'));
                }, timeout);

                try {
                  // Service Worker内では chrome.runtime.sendMessage は使用しない
                  // 代わりに直接処理するか、タブにメッセージを送信
                  if (chrome.tabs && options.tabId) {
                    chrome.tabs.sendMessage(options.tabId, message, (response) => {
                      clearTimeout(timeoutId);
                      if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                      } else {
                        resolve(response);
                      }
                    });
                  } else {
                    // Service Worker内での処理
                    clearTimeout(timeoutId);
                    resolve({ success: true, serviceWorker: true });
                  }
                } catch (error) {
                  clearTimeout(timeoutId);
                  reject(error);
                }
              });
            } catch (error) {
              console.error('Service Worker メッセージ送信エラー:', error);
              throw error;
            }
          },

          checkRuntimeConnection: async () => {
            try {
              this.connectionStatus = chrome.runtime?.id ? 'connected' : 'disconnected';
              return this.connectionStatus === 'connected';
            } catch (error) {
              this.connectionStatus = 'error';
              return false;
            }
          },

          processQueuedMessages: async () => {
            console.log(`Service Worker: ${this.messageQueue.length} 件のキューメッセージを処理中`);
            this.messageQueue = []; // Service Worker では簡単にクリア
          }
        };
      }
      break;

    case 'utils/permission-error-handler.js':
      // Service Worker用権限エラーハンドラー
      if (!self.permissionErrorHandler) {
        self.permissionErrorHandler = {
          checkPermissions: async () => {
            try {
              if (chrome.permissions) {
                return await chrome.permissions.getAll();
              }
              return { permissions: [], origins: [] };
            } catch (error) {
              console.error('Service Worker 権限チェックエラー:', error);
              return { permissions: [], origins: [] };
            }
          },

          requestPermission: async (permission) => {
            try {
              if (chrome.permissions) {
                return await chrome.permissions.request(permission);
              }
              return false;
            } catch (error) {
              console.error('Service Worker 権限要求エラー:', error);
              return false;
            }
          },

          hasPermission: async (permission) => {
            try {
              if (chrome.permissions) {
                return await chrome.permissions.contains(permission);
              }
              return false;
            } catch (error) {
              console.error('Service Worker 権限確認エラー:', error);
              return false;
            }
          },

          handlePermissionError: (error, requiredPermission) => {
            const errorInfo = {
              error: error.message,
              requiredPermission,
              timestamp: new Date().toISOString(),
              context: 'Service Worker'
            };

            console.error('Service Worker 権限エラー:', errorInfo);

            if (self.globalErrorHandler) {
              self.globalErrorHandler.handleError(error, 'PERMISSION', 'HIGH', errorInfo);
            }
          }
        };
      }
      break;

    case 'utils/component-recovery.js':
      // Service Worker用コンポーネント回復マネージャー
      // (実際のcomponent-recovery.jsはcontent scriptで使用)
      if (!self.componentRecoveryManager) {
        self.componentRecoveryManager = {
          components: new Map(),

          registerComponent: (name, component, options) => {
            console.log(`Service Worker - コンポーネント登録: ${name}`, options);
            this.components.set(name, {
              component,
              options: options || {},
              registeredAt: Date.now(),
              status: 'registered'
            });
          },

          recoverComponent: (name) => {
            console.log(`Service Worker - コンポーネント回復: ${name}`);
            const component = this.components.get(name);
            if (component) {
              component.status = 'recovering';
              component.lastRecovery = Date.now();

              // Service Worker では限定的な回復のみ実行
              setTimeout(() => {
                component.status = 'recovered';
                console.log(`Service Worker - コンポーネント回復完了: ${name}`);
              }, 1000);

              return true;
            }
            return false;
          },

          reportComponentFailure: (name, error, context) => {
            console.error(`Service Worker - コンポーネント障害報告: ${name}`, error, context);

            const component = this.components.get(name);
            if (component) {
              component.status = 'failed';
              component.lastError = {
                error: error.message,
                context,
                timestamp: Date.now()
              };
            }

            // グローバルエラーハンドラーに報告
            if (self.globalErrorHandler) {
              self.globalErrorHandler.handleError(error, 'COMPONENT_FAILURE', 'HIGH', {
                component: name,
                context,
                serviceWorker: true
              });
            }
          },

          getComponentStatuses: () => {
            const statuses = {};
            for (const [name, info] of this.components.entries()) {
              statuses[name] = {
                status: info.status,
                registeredAt: info.registeredAt,
                lastRecovery: info.lastRecovery,
                lastError: info.lastError
              };
            }
            return {
              context: 'Service Worker',
              components: statuses,
              totalComponents: this.components.size
            };
          }
        };
      }
      break;
  }
}

// エラータイプとレベルの定義
if (!self.ERROR_TYPES) {
  self.ERROR_TYPES = {
    SERVICE_WORKER_ERROR: 'SERVICE_WORKER_ERROR',
    UNHANDLED_PROMISE_REJECTION: 'UNHANDLED_PROMISE_REJECTION',
    COMPONENT_FAILURE: 'COMPONENT_FAILURE',
    COMMUNICATION: 'COMMUNICATION',
    DOM_ACCESS: 'DOM_ACCESS',
    PERMISSION: 'PERMISSION',
    UNKNOWN: 'UNKNOWN'
  };
}

if (!self.ERROR_SEVERITY) {
  self.ERROR_SEVERITY = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
  };
}

// Service Worker用のグローバルエラーハンドリング
self.addEventListener('error', (event) => {
  console.error('Service Worker エラー:', event.error);

  if (self.globalErrorHandler) {
    self.globalErrorHandler.handleError(
      event.error,
      'SERVICE_WORKER_ERROR',
      'HIGH',
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    );
  }
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker 未処理のPromise拒否:', event.reason);

  if (self.globalErrorHandler) {
    self.globalErrorHandler.handleError(
      event.reason,
      'UNHANDLED_PROMISE_REJECTION',
      'HIGH',
      { type: 'promise_rejection' }
    );
  }

  // デフォルトの処理を防ぐ
  event.preventDefault();
});

// エラーハンドリングシステムを初期化
try {
  initializeErrorHandling();
} catch (error) {
  console.error('エラーハンドリングシステムの初期化に失敗:', error);

  // 完全なフォールバック
  console.log('完全なフォールバックモードで動作します');
  createFallbackHandler('utils/error-handler.js');
  createFallbackHandler('utils/communication-error-handler.js');
  createFallbackHandler('utils/permission-error-handler.js');
  createFallbackHandler('utils/component-recovery.js');
}

// User Action Detection System を初期化
// Service Worker User Action Detection System (Integrated)
// Note: Cannot use importScripts() after service worker installation, so code is integrated directly

class ServiceWorkerUserActionDetector {
  constructor() {
    this.userInteractionDetected = false;
    this.lastInteractionTime = null;
    this.interactionTypes = new Set();
    this.interactionHistory = [];
    this.activeTabAvailable = false;
    this.interactionCallbacks = new Set();
    this.eventListeners = new Map();

    this.initialize();
  }

  initialize() {
    console.log('🚀 Initializing Service Worker User Action Detection System...');
    console.log('Service Worker: Environment check:', {
      isServiceWorker: typeof importScripts === 'function',
      chromeAvailable: typeof chrome !== 'undefined',
      runtimeAvailable: !!(chrome && chrome.runtime)
    });

    try {
      console.log('Service Worker: Setting up event listeners...');
      this.setupExtensionActionListener();
      this.setupContextMenuListener();
      this.setupKeyboardShortcutListener();
      this.setupMessageListener();

      console.log('Service Worker: Event listeners setup completed');
      console.log('Service Worker: Registered listeners:', Array.from(this.eventListeners.keys()));

      console.log('Service Worker: Restoring previous interaction state...');
      this.restoreInteractionState();

      console.log('✅ Service Worker User Action Detection System initialized successfully');
      console.log('Service Worker: Initial status:', this.getInteractionStatus());
    } catch (error) {
      console.error('❌ Failed to initialize Service Worker User Action Detection System:', error);
      console.error('Service Worker: Error details:', error.stack);
    }
  }

  setupExtensionActionListener() {
    try {
      console.log('Service Worker: Setting up extension action listener...');
      console.log('Service Worker: chrome.action available:', !!chrome.action);
      console.log('Service Worker: chrome.action.onClicked available:', !!(chrome.action && chrome.action.onClicked));

      if (chrome.action && chrome.action.onClicked) {
        const listener = (tab) => {
          console.log('🎯 Service Worker: Extension action clicked! Tab:', tab?.id, tab?.url);
          console.log('Service Worker: Processing user interaction...');

          this.handleUserInteraction('extension_action', {
            tabId: tab?.id,
            url: tab?.url,
            timestamp: Date.now()
          }).then(() => {
            console.log('Service Worker: User interaction processing completed');
            console.log('Service Worker: Current status:', this.getInteractionStatus());
          }).catch(error => {
            console.error('Service Worker: Error processing user interaction:', error);
          });
        };

        chrome.action.onClicked.addListener(listener);
        this.eventListeners.set('extension_action', listener);
        console.log('✅ Service Worker: Extension action listener registered successfully');
        console.log('Service Worker: Registered listeners:', Array.from(this.eventListeners.keys()));
      } else {
        console.warn('❌ Service Worker: chrome.action.onClicked not available');
        console.log('Service Worker: Available Chrome APIs:', {
          action: !!chrome.action,
          runtime: !!chrome.runtime,
          storage: !!chrome.storage,
          tabs: !!chrome.tabs
        });
      }
    } catch (error) {
      console.error('❌ Service Worker: Error setting up extension action listener:', error);
    }
  }

  setupContextMenuListener() {
    try {
      if (chrome.contextMenus && chrome.contextMenus.onClicked) {
        const listener = (info, tab) => {
          console.log('Service Worker: User interaction detected - Context menu clicked', info.menuItemId);
          this.handleUserInteraction('context_menu', {
            menuItemId: info.menuItemId,
            tabId: tab?.id,
            url: tab?.url,
            timestamp: Date.now()
          });
        };

        chrome.contextMenus.onClicked.addListener(listener);
        this.eventListeners.set('context_menu', listener);
        console.log('Service Worker: Context menu listener registered');
      } else {
        console.info('Service Worker: chrome.contextMenus.onClicked not available');
      }
    } catch (error) {
      console.error('Service Worker: Error setting up context menu listener:', error);
    }
  }

  setupKeyboardShortcutListener() {
    try {
      if (chrome.commands && chrome.commands.onCommand) {
        const listener = (command, tab) => {
          console.log('Service Worker: User interaction detected - Keyboard shortcut used', command);
          this.handleUserInteraction('keyboard_shortcut', {
            command: command,
            tabId: tab?.id,
            url: tab?.url,
            timestamp: Date.now()
          });
        };

        chrome.commands.onCommand.addListener(listener);
        this.eventListeners.set('keyboard_shortcut', listener);
        console.log('Service Worker: Keyboard shortcut listener registered');
      } else {
        console.info('Service Worker: chrome.commands.onCommand not available - keyboard shortcuts disabled');
      }
    } catch (error) {
      console.error('Service Worker: Error setting up keyboard shortcut listener:', error);
    }
  }

  setupMessageListener() {
    try {
      const listener = (message, sender, sendResponse) => {
        console.log('Service Worker: Received message:', message.type, 'from:', sender.tab ? 'content script' : 'popup');

        if (message.type === 'user_interaction') {
          console.log('🎯 Service Worker: User interaction detected via message!', message.interactionType);
          console.log('Service Worker: Message data:', message.data);
          console.log('Service Worker: Sender info:', {
            isPopup: !sender.tab,
            isContentScript: !!sender.tab,
            tabId: sender.tab?.id,
            url: sender.tab?.url || sender.url
          });

          this.handleUserInteraction(message.interactionType || 'message_interaction', {
            data: message.data,
            timestamp: Date.now(),
            sender: sender,
            tabId: sender.tab?.id,
            source: sender.tab ? 'content_script' : 'popup'
          }).then(() => {
            console.log('Service Worker: Message interaction processing completed');
            console.log('Service Worker: Updated status:', this.getInteractionStatus());
          }).catch(error => {
            console.error('Service Worker: Error processing message interaction:', error);
          });

          sendResponse({ success: true, interactionDetected: true });
          return true;
        }
        return false;
      };

      chrome.runtime.onMessage.addListener(listener);
      this.eventListeners.set('message_interaction', listener);
      console.log('✅ Service Worker: Message interaction listener registered successfully');
    } catch (error) {
      console.error('❌ Service Worker: Error setting up message listener:', error);
    }
  }

  async handleUserInteraction(interactionType, details = {}) {
    try {
      console.log(`Service Worker: Processing user interaction - ${interactionType}`, details);

      this.userInteractionDetected = true;
      this.lastInteractionTime = Date.now();
      this.interactionTypes.add(interactionType);

      const interactionRecord = {
        type: interactionType,
        timestamp: this.lastInteractionTime,
        details: details,
        id: this.generateInteractionId()
      };

      this.interactionHistory.push(interactionRecord);

      if (this.interactionHistory.length > 20) {
        this.interactionHistory = this.interactionHistory.slice(-20);
      }

      await this.storeInteractionState();
      await this.checkActiveTabAvailability();
      this.notifyInteractionCallbacks(interactionRecord);
      this.notifyContentScripts(interactionRecord);

      console.log(`Service Worker: User interaction processed successfully - ${interactionType}`);
    } catch (error) {
      console.error('Service Worker: Error processing user interaction:', error);
    }
  }

  async checkActiveTabAvailability() {
    try {
      if (!this.userInteractionDetected) {
        this.activeTabAvailable = false;
        return false;
      }

      if (chrome.tabs && chrome.tabs.query) {
        const tabs = await new Promise((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError) {
              console.warn('Service Worker: ActiveTab test failed:', chrome.runtime.lastError.message);
              resolve([]);
            } else {
              resolve(tabs || []);
            }
          });
        });

        const wasAvailable = this.activeTabAvailable;
        this.activeTabAvailable = tabs.length > 0;

        if (!wasAvailable && this.activeTabAvailable) {
          console.log('Service Worker: ActiveTab permission is now available after user interaction');
          this.notifyActiveTabAvailable();
        }

        return this.activeTabAvailable;
      }

      this.activeTabAvailable = true;
      return true;
    } catch (error) {
      console.error('Service Worker: Error checking activeTab availability:', error);
      this.activeTabAvailable = false;
      return false;
    }
  }

  async storeInteractionState() {
    try {
      if (chrome.storage && chrome.storage.local) {
        const state = {
          userInteractionDetected: this.userInteractionDetected,
          lastInteractionTime: this.lastInteractionTime,
          interactionTypes: Array.from(this.interactionTypes),
          activeTabAvailable: this.activeTabAvailable,
          sessionStartTime: Date.now(),
          interactionHistory: this.interactionHistory.slice(-5)
        };

        await chrome.storage.local.set({ serviceWorkerUserInteractionState: state });
        console.log('Service Worker: Interaction state stored successfully');
      }
    } catch (error) {
      console.error('Service Worker: Error storing interaction state:', error);
    }
  }

  async restoreInteractionState() {
    try {
      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(['serviceWorkerUserInteractionState']);
        const state = result.serviceWorkerUserInteractionState;

        if (state) {
          const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);

          if (state.lastInteractionTime && state.lastInteractionTime > thirtyMinutesAgo) {
            this.userInteractionDetected = state.userInteractionDetected || false;
            this.lastInteractionTime = state.lastInteractionTime;
            this.interactionTypes = new Set(state.interactionTypes || []);
            this.activeTabAvailable = state.activeTabAvailable || false;
            this.interactionHistory = state.interactionHistory || [];

            console.log('Service Worker: User interaction state restored from storage');
            await this.checkActiveTabAvailability();
          } else {
            console.log('Service Worker: Previous interaction state expired, starting fresh');
          }
        }
      }
    } catch (error) {
      console.error('Service Worker: Error restoring interaction state:', error);
    }
  }

  notifyContentScripts(interactionRecord) {
    try {
      if (chrome.tabs && chrome.tabs.query) {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'USER_INTERACTION_DETECTED',
                data: {
                  interactionType: interactionRecord.type,
                  timestamp: interactionRecord.timestamp,
                  activeTabAvailable: this.activeTabAvailable
                }
              }).catch(() => {
                // Ignore errors - content script might not be loaded
              });
            }
          });
        });
      }
    } catch (error) {
      console.error('Service Worker: Error notifying content scripts:', error);
    }
  }

  notifyActiveTabAvailable() {
    const event = {
      type: 'activeTab_available',
      timestamp: Date.now(),
      userInteractionDetected: this.userInteractionDetected
    };

    this.notifyInteractionCallbacks(event);
    this.notifyContentScripts({
      type: 'activeTab_available',
      timestamp: Date.now()
    });
  }

  onUserInteraction(callback) {
    if (typeof callback === 'function') {
      this.interactionCallbacks.add(callback);
      console.log('Service Worker: User interaction callback registered');
    }
  }

  offUserInteraction(callback) {
    this.interactionCallbacks.delete(callback);
  }

  notifyInteractionCallbacks(interactionRecord) {
    for (const callback of this.interactionCallbacks) {
      try {
        callback(interactionRecord);
      } catch (error) {
        console.error('Service Worker: Error in user interaction callback:', error);
      }
    }
  }

  generateInteractionId() {
    return `sw_interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getInteractionStatus() {
    return {
      userInteractionDetected: this.userInteractionDetected,
      lastInteractionTime: this.lastInteractionTime,
      interactionTypes: Array.from(this.interactionTypes),
      activeTabAvailable: this.activeTabAvailable,
      interactionHistory: this.interactionHistory,
      context: 'service_worker',
      eventListenersCount: this.eventListeners.size,
      registeredListeners: Array.from(this.eventListeners.keys())
    };
  }

  getDebugInfo() {
    return {
      status: this.getInteractionStatus(),
      eventListeners: {
        registered: Array.from(this.eventListeners.keys()),
        count: this.eventListeners.size
      },
      chromeAPIs: {
        action: !!(chrome.action && chrome.action.onClicked),
        contextMenus: !!(chrome.contextMenus && chrome.contextMenus.onClicked),
        commands: !!(chrome.commands && chrome.commands.onCommand),
        runtime: !!(chrome.runtime && chrome.runtime.onMessage),
        tabs: !!(chrome.tabs && chrome.tabs.query),
        storage: !!(chrome.storage && chrome.storage.local)
      },
      callbacks: {
        count: this.interactionCallbacks.size
      },
      timestamp: Date.now()
    };
  }

  async testUserInteraction() {
    console.log('Service Worker: Testing manual user interaction...');

    await this.handleUserInteraction('manual_test', {
      source: 'debug_test',
      timestamp: Date.now()
    });

    const status = this.getInteractionStatus();
    console.log('Service Worker: Test interaction result:', status);

    return status;
  }

  hasRecentInteraction(timeWindow = 300000) {
    if (!this.lastInteractionTime) return false;
    return (Date.now() - this.lastInteractionTime) < timeWindow;
  }

  reset() {
    this.userInteractionDetected = false;
    this.lastInteractionTime = null;
    this.interactionTypes.clear();
    this.interactionHistory = [];
    this.activeTabAvailable = false;

    console.log('Service Worker: User action detector reset');
  }
}

// Create global instance for Service Worker
const serviceWorkerUserActionDetector = new ServiceWorkerUserActionDetector();

// Export for use in Service Worker
self.ServiceWorkerUserActionDetector = ServiceWorkerUserActionDetector;
self.serviceWorkerUserActionDetector = serviceWorkerUserActionDetector;

// Add global debug functions for testing
self.debugUserActionDetector = () => {
  console.log('=== Service Worker User Action Detector Debug ===');
  const debugInfo = serviceWorkerUserActionDetector.getDebugInfo();
  console.log('Debug Info:', debugInfo);
  return debugInfo;
};

self.testUserInteraction = () => {
  console.log('=== Testing User Interaction ===');
  return serviceWorkerUserActionDetector.testUserInteraction();
};

self.getInteractionStatus = () => {
  const status = serviceWorkerUserActionDetector.getInteractionStatus();
  console.log('Current Interaction Status:', status);
  return status;
};

self.simulateExtensionClick = () => {
  console.log('=== Simulating Extension Click ===');
  return serviceWorkerUserActionDetector.handleUserInteraction('extension_action', {
    tabId: 1,
    url: 'https://example.com',
    timestamp: Date.now(),
    simulated: true
  });
};

console.log('✅ Service Worker User Action Detection System loaded successfully (integrated)');
console.log('Available debug functions: debugUserActionDetector(), testUserInteraction(), getInteractionStatus(), simulateExtensionClick()');

// ActiveTab Permission Management System
class ActiveTabPermissionManager {
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
    console.log('Initializing ActiveTab Permission Manager...');

    // Set up extension action click listener for activeTab activation
    this.setupExtensionActionListener();

    // Set up tab change listeners to manage activeTab lifecycle
    this.setupTabChangeListeners();

    // Set up message listeners for permission state queries
    this.setupMessageListeners();

    console.log('ActiveTab Permission Manager initialized');
  }

  setupExtensionActionListener() {
    if (chrome.action && chrome.action.onClicked) {
      chrome.action.onClicked.addListener(async (tab) => {
        console.log('Extension action clicked - activeTab permission granted for tab:', tab.id);

        await this.handleActiveTabGrant(tab);

        // Notify Service Worker user action detector
        if (self.serviceWorkerUserActionDetector) {
          await self.serviceWorkerUserActionDetector.handleUserInteraction('extension_action', {
            tabId: tab.id,
            url: tab.url,
            timestamp: Date.now()
          });
        }
      });

      console.log('Extension action listener registered for activeTab handling');
    } else {
      console.warn('chrome.action.onClicked not available for activeTab handling');
    }
  }

  setupTabChangeListeners() {
    // Listen for tab activation changes
    if (chrome.tabs && chrome.tabs.onActivated) {
      chrome.tabs.onActivated.addListener(async (activeInfo) => {
        console.log('Tab activated:', activeInfo.tabId);

        // ActiveTab permission is lost when switching tabs
        if (this.activeTabState.currentTabId !== activeInfo.tabId) {
          await this.handleActiveTabLoss();
        }
      });
    }

    // Listen for tab updates (URL changes, etc.)
    if (chrome.tabs && chrome.tabs.onUpdated) {
      chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        // ActiveTab permission is lost on navigation
        if (changeInfo.url && this.activeTabState.currentTabId === tabId) {
          console.log('Tab navigated - activeTab permission lost for tab:', tabId);
          await this.handleActiveTabLoss();
        }
      });
    }

    // Listen for tab removal
    if (chrome.tabs && chrome.tabs.onRemoved) {
      chrome.tabs.onRemoved.addListener(async (tabId) => {
        if (this.activeTabState.currentTabId === tabId) {
          console.log('Active tab closed - activeTab permission lost');
          await this.handleActiveTabLoss();
        }
      });
    }
  }

  setupMessageListeners() {
    // Add message listener for activeTab permission queries
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
        return true; // Keep message channel open for async response
      }

      if (message.type === 'REGISTER_ACTIVETAB_CALLBACK') {
        this.registerPermissionCallback(sender.tab?.id);
        sendResponse({ success: true });
        return false;
      }

      return false; // Don't handle other message types
    });
  }

  async handleActiveTabGrant(tab) {
    try {
      console.log('Processing activeTab permission grant for tab:', tab.id);

      // Update activeTab state
      this.activeTabState = {
        isAvailable: true,
        currentTabId: tab.id,
        grantedAt: Date.now(),
        expiresAt: null // ActiveTab doesn't have a fixed expiration, but is lost on navigation/tab change
      };

      // Store state in storage for persistence
      await this.storeActiveTabState();

      // Notify content scripts about activeTab availability
      await this.notifyContentScriptsActiveTabAvailable(tab);

      // Notify permission callbacks
      this.notifyPermissionCallbacks({
        type: 'activeTab_granted',
        tabId: tab.id,
        timestamp: Date.now()
      });

      console.log('ActiveTab permission grant processed successfully');
    } catch (error) {
      console.error('Error handling activeTab grant:', error);

      if (self.globalErrorHandler) {
        self.globalErrorHandler.handleError(
          error,
          'PERMISSION',
          'HIGH',
          { operation: 'handleActiveTabGrant', tabId: tab.id }
        );
      }
    }
  }

  async handleActiveTabLoss() {
    try {
      const previousTabId = this.activeTabState.currentTabId;

      console.log('Processing activeTab permission loss for tab:', previousTabId);

      // Update activeTab state
      this.activeTabState = {
        isAvailable: false,
        currentTabId: null,
        grantedAt: null,
        expiresAt: Date.now()
      };

      // Store updated state
      await this.storeActiveTabState();

      // Notify content scripts about activeTab loss
      if (previousTabId) {
        await this.notifyContentScriptsActiveTabLost(previousTabId);
      }

      // Notify permission callbacks
      this.notifyPermissionCallbacks({
        type: 'activeTab_lost',
        previousTabId: previousTabId,
        timestamp: Date.now()
      });

      console.log('ActiveTab permission loss processed successfully');
    } catch (error) {
      console.error('Error handling activeTab loss:', error);

      if (self.globalErrorHandler) {
        self.globalErrorHandler.handleError(
          error,
          'PERMISSION',
          'MEDIUM',
          { operation: 'handleActiveTabLoss' }
        );
      }
    }
  }

  async notifyContentScriptsActiveTabAvailable(tab) {
    try {
      const message = {
        type: 'ACTIVETAB_PERMISSION_GRANTED',
        data: {
          tabId: tab.id,
          url: tab.url,
          grantedAt: this.activeTabState.grantedAt,
          permissionState: this.getActiveTabStatus()
        }
      };

      // Send message to the specific tab
      if (chrome.tabs && chrome.tabs.sendMessage) {
        chrome.tabs.sendMessage(tab.id, message).catch(error => {
          console.log('Content script not ready for activeTab notification:', error.message);
        });
      }

      // Also broadcast to all tabs for components that might need to know
      await this.broadcastActiveTabState();

      console.log('Content scripts notified of activeTab availability');
    } catch (error) {
      console.error('Error notifying content scripts of activeTab availability:', error);
    }
  }

  async notifyContentScriptsActiveTabLost(tabId) {
    try {
      const message = {
        type: 'ACTIVETAB_PERMISSION_LOST',
        data: {
          previousTabId: tabId,
          lostAt: Date.now(),
          permissionState: this.getActiveTabStatus()
        }
      };

      // Send message to the specific tab if still exists
      if (chrome.tabs && chrome.tabs.sendMessage) {
        chrome.tabs.sendMessage(tabId, message).catch(() => {
          // Tab might be closed, ignore error
        });
      }

      // Broadcast to all tabs
      await this.broadcastActiveTabState();

      console.log('Content scripts notified of activeTab loss');
    } catch (error) {
      console.error('Error notifying content scripts of activeTab loss:', error);
    }
  }

  async broadcastActiveTabState() {
    try {
      if (!chrome.tabs || !chrome.tabs.query) return;

      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({}, (tabs) => {
          if (chrome.runtime.lastError) {
            console.warn('Error querying tabs for broadcast:', chrome.runtime.lastError.message);
            resolve([]);
          } else {
            resolve(tabs || []);
          }
        });
      });

      const broadcastMessage = {
        type: 'ACTIVETAB_STATE_UPDATE',
        data: {
          permissionState: this.getActiveTabStatus(),
          timestamp: Date.now()
        }
      };

      // Send to all tabs
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, broadcastMessage).catch(() => {
            // Ignore errors - content script might not be loaded
          });
        }
      }

      console.log(`ActiveTab state broadcasted to ${tabs.length} tabs`);
    } catch (error) {
      console.error('Error broadcasting activeTab state:', error);
    }
  }

  async requestActiveTabPermission(options = {}) {
    try {
      console.log('ActiveTab permission requested');

      // Check if already available
      if (this.activeTabState.isAvailable) {
        return {
          success: true,
          reason: 'already_granted',
          tabId: this.activeTabState.currentTabId,
          grantedAt: this.activeTabState.grantedAt
        };
      }

      // ActiveTab requires user interaction - cannot be requested programmatically
      return {
        success: false,
        reason: 'user_interaction_required',
        message: 'ActiveTab permission requires user to click extension icon or use keyboard shortcut',
        instructions: 'Please click the extension icon in the toolbar to grant activeTab permission'
      };
    } catch (error) {
      console.error('Error requesting activeTab permission:', error);
      return {
        success: false,
        reason: 'error',
        message: error.message
      };
    }
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
    console.log('Permission callback registered for tab:', tabId);
  }

  notifyPermissionCallbacks(event) {
    console.log('Notifying permission callbacks:', event.type);

    // In a real implementation, you might want to send messages to registered tabs
    // For now, we'll just log the event
    for (const callback of this.permissionCallbacks) {
      console.log(`Permission callback notification sent to tab ${callback}:`, event.type);
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
    }
  }

  async restoreActiveTabState() {
    try {
      if (chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(['activeTabPermissionState']);
        const storedState = result.activeTabPermissionState;

        if (storedState) {
          // Only restore if the state is recent (within last 5 minutes)
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

          if (storedState.lastUpdated && storedState.lastUpdated > fiveMinutesAgo && storedState.isAvailable) {
            // Verify the tab still exists
            if (chrome.tabs && storedState.currentTabId) {
              chrome.tabs.get(storedState.currentTabId, (tab) => {
                if (!chrome.runtime.lastError && tab) {
                  this.activeTabState = {
                    isAvailable: storedState.isAvailable,
                    currentTabId: storedState.currentTabId,
                    grantedAt: storedState.grantedAt,
                    expiresAt: storedState.expiresAt
                  };
                  console.log('ActiveTab state restored from storage');
                } else {
                  console.log('Stored activeTab state invalid - tab no longer exists');
                }
              });
            }
          } else {
            console.log('Stored activeTab state expired or invalid');
          }
        }
      }
    } catch (error) {
      console.error('Error restoring activeTab state:', error);
    }
  }

  cleanup() {
    console.log('Cleaning up ActiveTab Permission Manager...');
    this.permissionCallbacks.clear();
    this.contentScriptNotifications.clear();
  }
}

// Initialize ActiveTab Permission Manager
const activeTabPermissionManager = new ActiveTabPermissionManager();

// Make it globally available
self.activeTabPermissionManager = activeTabPermissionManager;

// Service Worker初期化完了の確認
console.log('Service Worker初期化完了');
console.log('利用可能なハンドラー:', {
  globalErrorHandler: !!self.globalErrorHandler,
  communicationErrorHandler: !!self.communicationErrorHandler,
  permissionErrorHandler: !!self.permissionErrorHandler,
  componentRecoveryManager: !!self.componentRecoveryManager,
  serviceWorkerUserActionDetector: !!self.serviceWorkerUserActionDetector,
  activeTabPermissionManager: !!self.activeTabPermissionManager
});

// Service Worker初期化完了を詳細にログ出力
console.log('=== Service Worker 初期化完了レポート ===');
console.log('初期化時刻:', new Date().toISOString());
console.log('Chrome拡張機能API利用可能:', {
  runtime: !!chrome.runtime,
  storage: !!chrome.storage,
  tabs: !!chrome.tabs,
  notifications: !!chrome.notifications
});
console.log('エラーハンドリングシステム状態:', {
  globalErrorHandler: !!self.globalErrorHandler,
  communicationErrorHandler: !!self.communicationErrorHandler,
  permissionErrorHandler: !!self.permissionErrorHandler,
  componentRecoveryManager: !!self.componentRecoveryManager,
  serviceWorkerUserActionDetector: !!self.serviceWorkerUserActionDetector,
  activeTabPermissionManager: !!self.activeTabPermissionManager,
  errorTypes: !!self.ERROR_TYPES,
  errorSeverity: !!self.ERROR_SEVERITY
});
console.log('Service Worker準備完了 - コンテンツスクリプトとの通信が可能です');
console.log('==========================================');

// 拡張機能の状態管理
let extensionState = {
  enabled: true,
  activeTabId: null,
  pendingDecisions: new Map()
};

// デフォルトユーザー設定
const DEFAULT_PREFERENCES = {
  extensionEnabled: true,
  showNotifications: true,
  notificationDuration: 5000,
  whitelistedDomains: [],
  learningEnabled: true,
  aggressiveMode: false,
  statistics: {
    totalPopupsDetected: 0,
    totalPopupsClosed: 0,
    totalPopupsKept: 0,
    lastResetDate: Date.now()
  }
};

/**
 * 拡張機能インストール時の初期化
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('ポップアップ広告ブロッカー拡張機能がインストールされました');

  try {
    // デフォルト設定を初期化
    await initializeDefaultSettings();
    console.log('デフォルト設定が初期化されました');

    // 決定処理システムを初期化
    await initializeDecisionSystem();
    console.log('決定処理システムが初期化されました');

    // インストール時初期化完了ログ
    console.log('=== 拡張機能インストール初期化完了 ===');
    console.log('インストール完了時刻:', new Date().toISOString());
    console.log('初期化されたコンポーネント:', {
      defaultSettings: true,
      decisionSystem: true,
      storageSystem: true
    });
    console.log('拡張機能は使用準備が完了しました');
    console.log('=====================================');
  } catch (error) {
    console.error('初期化エラー:', error);
    console.error('=== 拡張機能初期化失敗 ===');
    console.error('エラー発生時刻:', new Date().toISOString());
    console.error('エラー詳細:', error);
    console.error('========================');
  }
});

/**
 * サービスワーカー起動時の初期化
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('サービスワーカーが起動しました');

  try {
    // 決定処理システムを復元
    await restoreDecisionSystem();
    console.log('決定処理システムが復元されました');

    // ActiveTab permission state を復元
    if (self.activeTabPermissionManager) {
      await self.activeTabPermissionManager.restoreActiveTabState();
      console.log('ActiveTab permission state が復元されました');
    }

    // 起動時初期化完了ログ
    console.log('=== Service Worker 起動初期化完了 ===');
    console.log('起動完了時刻:', new Date().toISOString());
    console.log('復元されたコンポーネント:', {
      decisionSystem: true,
      pendingDecisions: true,
      storageConnection: true,
      activeTabPermissionManager: !!self.activeTabPermissionManager
    });
    console.log('Service Worker は正常に起動し、動作準備が完了しました');
    console.log('====================================');
  } catch (error) {
    console.error('起動時復元エラー:', error);
    console.error('=== Service Worker 起動失敗 ===');
    console.error('エラー発生時刻:', new Date().toISOString());
    console.error('復元エラー詳細:', error);
    console.error('==============================');
  }
});

/**
 * デフォルト設定の初期化
 */
async function initializeDefaultSettings() {
  try {
    const result = await chrome.storage.local.get(['userPreferences']);

    if (!result.userPreferences) {
      await chrome.storage.local.set({
        userPreferences: DEFAULT_PREFERENCES,
        learningPatterns: [],
        popupHistory: [],
        userDecisions: [],
        pendingDecisions: {}
      });
    }
  } catch (error) {
    console.error('設定初期化エラー:', error);
    throw error;
  }
}

/**
 * 決定処理システムの初期化
 */
async function initializeDecisionSystem() {
  try {
    // 古い決定待ち状態をクリーンアップ
    await chrome.storage.local.set({ pendingDecisions: {} });

    // 定期的なクリーンアップを設定（5分間隔）
    setInterval(async () => {
      const cleanedCount = await cleanupExpiredDecisions();
      if (cleanedCount > 0) {
        console.log(`期限切れ決定を${cleanedCount}件クリーンアップしました`);
      }
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('決定処理システム初期化エラー:', error);
    throw error;
  }
}

/**
 * 決定処理システムの復元
 */
async function restoreDecisionSystem() {
  try {
    // ストレージから決定待ち状態を復元
    const result = await chrome.storage.local.get(['pendingDecisions']);
    const storedPending = result.pendingDecisions || {};

    const now = Date.now();
    const expiredThreshold = 5 * 60 * 1000; // 5分

    // 期限切れでない決定のみ復元
    for (const [popupId, decision] of Object.entries(storedPending)) {
      if (now - decision.timestamp < expiredThreshold) {
        // タイムアウトを再設定
        const remainingTime = Math.max(1000, 30000 - (now - decision.timestamp));
        const timeoutId = setTimeout(() => {
          handleDecisionTimeout(popupId);
        }, remainingTime);

        decision.timeoutId = timeoutId;
        extensionState.pendingDecisions.set(popupId, decision);

        console.log(`決定待ち状態を復元: ${popupId} (残り時間: ${remainingTime}ms)`);
      }
    }

    // 期限切れの決定をクリーンアップ
    await cleanupExpiredDecisions();

  } catch (error) {
    console.error('決定処理システム復元エラー:', error);
  }
}

/**
 * ドメイン固有ルールを取得
 */
async function getDomainRules(domain) {
  try {
    const result = await chrome.storage.local.get(['domainRules']);
    const allRules = result.domainRules || {};
    return allRules[domain] || null;
  } catch (error) {
    console.error('ドメインルール取得エラー:', error);
    return null;
  }
}

/**
 * Service Worker の完全な初期化状態をログ出力
 */
function logServiceWorkerStatus() {
  console.log('=== Service Worker 完全初期化状態レポート ===');
  console.log('レポート生成時刻:', new Date().toISOString());

  // Chrome API の利用可能性
  console.log('Chrome API 状態:', {
    runtime: {
      available: !!chrome.runtime,
      id: chrome.runtime?.id || 'N/A',
      onMessage: !!chrome.runtime?.onMessage,
      sendMessage: !!chrome.runtime?.sendMessage
    },
    storage: {
      available: !!chrome.storage,
      local: !!chrome.storage?.local,
      sync: !!chrome.storage?.sync
    },
    tabs: {
      available: !!chrome.tabs,
      query: !!chrome.tabs?.query,
      sendMessage: !!chrome.tabs?.sendMessage
    },
    notifications: {
      available: !!chrome.notifications,
      create: !!chrome.notifications?.create
    }
  });

  // エラーハンドリングシステムの状態
  console.log('エラーハンドリングシステム:', {
    globalErrorHandler: !!self.globalErrorHandler,
    communicationErrorHandler: !!self.communicationErrorHandler,
    permissionErrorHandler: !!self.permissionErrorHandler,
    componentRecoveryManager: !!self.componentRecoveryManager,
    errorTypes: !!self.ERROR_TYPES,
    errorSeverity: !!self.ERROR_SEVERITY
  });

  // 拡張機能の内部状態
  console.log('拡張機能内部状態:', {
    enabled: extensionState.enabled,
    activeTabId: extensionState.activeTabId,
    pendingDecisionsCount: extensionState.pendingDecisions.size,
    defaultPreferencesLoaded: !!DEFAULT_PREFERENCES,
    activeTabPermissionState: self.activeTabPermissionManager ?
      self.activeTabPermissionManager.getActiveTabStatus() : null
  });

  // イベントリスナーの状態
  console.log('イベントリスナー登録状態:', {
    onInstalled: !!chrome.runtime.onInstalled.hasListeners(),
    onStartup: !!chrome.runtime.onStartup.hasListeners(),
    onMessage: !!chrome.runtime.onMessage.hasListeners()
  });

  console.log('Service Worker は完全に初期化され、すべての機能が利用可能です');
  console.log('コンテンツスクリプトからの通信を受信する準備が完了しました');
  console.log('===========================================');
}

/**
 * ドメイン固有ルールを更新
 */
async function updateDomainRule(domain, rule) {
  try {
    const result = await chrome.storage.local.get(['domainRules']);
    const allRules = result.domainRules || {};

    allRules[domain] = {
      ...rule,
      lastUpdated: Date.now()
    };

    await chrome.storage.local.set({ domainRules: allRules });
    console.log(`ドメインルールを更新: ${domain}`);
  } catch (error) {
    console.error('ドメインルール更新エラー:', error);
    throw error;
  }
}

/**
 * 適応学習データを取得
 */
async function getAdaptiveLearningData(domain) {
  try {
    const result = await chrome.storage.local.get(['adaptiveLearningData']);
    const allData = result.adaptiveLearningData || {};
    return allData[domain] || { patterns: {}, history: [] };
  } catch (error) {
    console.error('適応学習データ取得エラー:', error);
    return { patterns: {}, history: [] };
  }
}

/**
 * 適応学習データを保存
 */
async function saveAdaptiveLearningData(domain, data) {
  try {
    const result = await chrome.storage.local.get(['adaptiveLearningData']);
    const allData = result.adaptiveLearningData || {};

    allData[domain] = {
      ...data,
      lastUpdated: Date.now()
    };

    await chrome.storage.local.set({ adaptiveLearningData: allData });
    console.log(`適応学習データを保存: ${domain}`);
  } catch (error) {
    console.error('適応学習データ保存エラー:', error);
    throw error;
  }
}

/**
 * メッセージ処理インフラ
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('メッセージを受信:', message.type, sender.tab?.id);

  // 非同期処理のためのPromiseラッパー
  (async () => {
    try {
      // PING メッセージの処理（ヘルスチェック用）
      if (message.type === 'PING') {
        sendResponse({ pong: true, timestamp: Date.now() });
        return;
      }

      switch (message.type) {
        case 'POPUP_DETECTED':
          await handlePopupDetection(message.data, sender);
          sendResponse({ success: true });
          break;

        case 'UPDATE_BADGE':
          await updateExtensionBadge(message.data.count, sender.tab?.id);
          sendResponse({ success: true });
          break;

        case 'USER_CHOICE_RECORDED':
          await handleUserChoiceRecorded(message.data, sender);
          sendResponse({ success: true });
          break;

        case 'UPDATE_SITE_SETTINGS':
          await updateSiteSettings(message.data, sender);
          sendResponse({ success: true });
          break;

        case 'OPEN_SETTINGS':
          chrome.runtime.openOptionsPage();
          sendResponse({ success: true });
          break;

        case 'GET_USER_PREFERENCES':
          const preferences = await getUserPreferences();
          sendResponse({ success: true, data: preferences });
          break;

        case 'UPDATE_USER_PREFERENCES':
          await updateUserPreferences(message.data);
          sendResponse({ success: true });
          break;

        case 'GET_STATISTICS':
          const statistics = await getStatistics();
          sendResponse({ success: true, data: statistics });
          break;

        case 'USER_DECISION':
          const decisionResult = await handleUserDecision(message.data);
          sendResponse(decisionResult);
          break;

        case 'GET_USER_DECISIONS':
          const decisions = await getUserDecisions(message.filters || {});
          sendResponse({ success: true, data: decisions });
          break;

        case 'GET_PENDING_DECISIONS':
          const pendingDecisions = await getPendingDecisions();
          sendResponse({ success: true, data: pendingDecisions });
          break;

        case 'SHOW_NOTIFICATION':
          await showNotification(message.data);
          sendResponse({ success: true });
          break;

        case 'UPDATE_STATISTICS':
          await updateDetectionStatistics(message.data);
          sendResponse({ success: true });
          break;

        case 'GET_PENDING_DECISIONS_BY_TAB':
          const tabDecisions = await getPendingDecisionsByTab(message.tabId);
          sendResponse({ success: true, data: tabDecisions });
          break;

        case 'CLEANUP_EXPIRED_DECISIONS':
          const cleanedCount = await cleanupExpiredDecisions();
          sendResponse({ success: true, data: { cleanedCount } });
          break;

        case 'GET_EXTENSION_STATE':
          sendResponse({
            success: true,
            data: {
              enabled: extensionState.enabled,
              activeTabId: extensionState.activeTabId,
              pendingDecisionsCount: extensionState.pendingDecisions.size
            }
          });
          break;

        case 'GET_PATTERN_SUGGESTION':
          const suggestion = await getPatternBasedSuggestion(
            message.characteristics,
            message.domain
          );
          sendResponse({ success: true, data: suggestion });
          break;

        case 'GET_LEARNING_STATISTICS':
          const learningStats = await getLearningStatistics();
          sendResponse({ success: true, data: learningStats });
          break;

        case 'GET_WEBSITE_STATISTICS':
          const websiteStats = await getWebsiteStatistics(message.domain);
          sendResponse({ success: true, data: websiteStats });
          break;

        case 'GET_ACTIVITY_TRENDS':
          const activityTrends = await getActivityTrends();
          sendResponse({ success: true, data: activityTrends });
          break;

        case 'GET_DETAILED_STATISTICS':
          const detailedStats = await getDetailedStatistics(message.filters || {});
          sendResponse({ success: true, data: detailedStats });
          break;

        case 'GET_LEARNING_PATTERNS':
          const patternsResult = await chrome.storage.local.get(['learningPatterns']);
          sendResponse({
            success: true,
            data: patternsResult.learningPatterns || []
          });
          break;

        case 'CLEAR_LEARNING_PATTERNS':
          await chrome.storage.local.set({ learningPatterns: [] });
          sendResponse({ success: true });
          break;

        case 'GET_DOMAIN_RULES':
          try {
            const domainRules = await getDomainRules(message.domain);
            sendResponse({ success: true, data: domainRules });
          } catch (error) {
            console.error('GET_DOMAIN_RULES処理エラー:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'UPDATE_DOMAIN_RULE':
          await updateDomainRule(message.domain, message.rule);
          sendResponse({ success: true });
          break;

        case 'GET_ADAPTIVE_LEARNING_DATA':
          const learningData = await getAdaptiveLearningData(message.domain);
          sendResponse({ success: true, data: learningData });
          break;

        case 'SAVE_ADAPTIVE_LEARNING_DATA':
          await saveAdaptiveLearningData(message.domain, message.data);
          sendResponse({ success: true });
          break;

        case 'GET_USER_INTERACTION_STATUS':
          const interactionStatus = self.serviceWorkerUserActionDetector ?
            self.serviceWorkerUserActionDetector.getInteractionStatus() :
            { userInteractionDetected: false, activeTabAvailable: false, context: 'service_worker_fallback' };
          sendResponse({ success: true, data: interactionStatus });
          break;

        case 'REQUEST_PERMISSION_AFTER_INTERACTION':
          if (self.serviceWorkerUserActionDetector) {
            // Service Worker doesn't handle permission requests the same way
            // Just return the current interaction status
            const status = self.serviceWorkerUserActionDetector.getInteractionStatus();
            sendResponse({
              success: status.userInteractionDetected,
              data: {
                available: status.activeTabAvailable,
                reason: status.userInteractionDetected ? 'user_interaction_detected' : 'no_user_interaction'
              }
            });
          } else {
            sendResponse({ success: false, error: 'Service Worker User Action Detector not available' });
          }
          break;

        case 'LEGACY_REQUEST_PERMISSION_AFTER_INTERACTION':
          if (self.serviceWorkerUserActionDetector) {
            const permissionResult = await self.serviceWorkerUserActionDetector.requestPermissionAfterInteraction(
              message.permission,
              message.options || {}
            );
            sendResponse({ success: true, data: permissionResult });
          } else {
            sendResponse({
              success: false,
              error: 'User action detector not available'
            });
          }
          break;

        case 'GET_ACTIVETAB_STATUS':
          if (self.activeTabPermissionManager) {
            const status = self.activeTabPermissionManager.getActiveTabStatus();
            sendResponse({ success: true, data: status });
          } else {
            sendResponse({
              success: false,
              error: 'ActiveTab permission manager not available'
            });
          }
          break;

        case 'REQUEST_ACTIVETAB_PERMISSION':
          if (self.activeTabPermissionManager) {
            const result = await self.activeTabPermissionManager.requestActiveTabPermission(
              message.options || {}
            );
            sendResponse({ success: true, data: result });
          } else {
            sendResponse({
              success: false,
              error: 'ActiveTab permission manager not available'
            });
          }
          break;

        case 'REGISTER_ACTIVETAB_CALLBACK':
          if (self.activeTabPermissionManager) {
            self.activeTabPermissionManager.registerPermissionCallback(sender.tab?.id);
            sendResponse({ success: true });
          } else {
            sendResponse({
              success: false,
              error: 'ActiveTab permission manager not available'
            });
          }
          break;

        case 'BROADCAST_ACTIVETAB_STATE':
          if (self.activeTabPermissionManager) {
            await self.activeTabPermissionManager.broadcastActiveTabState();
            sendResponse({ success: true });
          } else {
            sendResponse({
              success: false,
              error: 'ActiveTab permission manager not available'
            });
          }
          break;

        default:
          console.warn('未知のメッセージタイプ:', message.type);
          sendResponse({ success: false, error: '未知のメッセージタイプ' });
      }
    } catch (error) {
      console.error('メッセージ処理エラー:', error);

      // エラーハンドラーに報告
      if (typeof globalErrorHandler !== 'undefined') {
        globalErrorHandler.handleError(
          error,
          ERROR_TYPES.COMMUNICATION,
          ERROR_SEVERITY.MEDIUM,
          {
            component: 'serviceWorker',
            operation: 'messageProcessing',
            messageType: message.type,
            sender: sender.tab?.id
          }
        );
      }

      sendResponse({ success: false, error: error.message });
    }
  })();

  // 非同期レスポンスを示すためにtrueを返す
  return true;
});

/**
 * 通知を表示
 */
async function showNotification(notificationData) {
  try {
    const { title, message, iconUrl, type = 'basic', priority = 1 } = notificationData;
    
    // Chrome通知APIを使用
    if (chrome.notifications) {
      const notificationId = `popup_blocker_${Date.now()}`;
      
      await chrome.notifications.create(notificationId, {
        type: type,
        iconUrl: iconUrl || 'icons/icon48.png',
        title: title || 'ポップアップ広告ブロッカー',
        message: message,
        priority: priority
      });
      
      // 5秒後に通知を自動削除
      setTimeout(() => {
        chrome.notifications.clear(notificationId).catch(() => {
          // 通知が既に削除されている場合は無視
        });
      }, 5000);
      
      console.log('Service Worker: Notification shown:', message);
    } else {
      console.warn('Service Worker: Notifications API not available');
    }
  } catch (error) {
    console.error('Service Worker: Error showing notification:', error);
  }
}

/**
 * 検出統計を更新
 */
async function updateDetectionStatistics(data) {
  try {
    const { detected, timestamp, domain } = data;
    
    // 現在の統計を取得
    const preferences = await getUserPreferences();
    const stats = preferences.statistics || {};
    
    // 統計を更新
    stats.totalPopupsDetected = (stats.totalPopupsDetected || 0) + detected;
    stats.lastDetectionTime = timestamp;
    
    // ドメイン別統計を更新
    if (!stats.domainStats) {
      stats.domainStats = {};
    }
    
    if (!stats.domainStats[domain]) {
      stats.domainStats[domain] = {
        detected: 0,
        blocked: 0,
        allowed: 0,
        lastActivity: timestamp
      };
    }
    
    stats.domainStats[domain].detected += detected;
    stats.domainStats[domain].lastActivity = timestamp;
    
    // 今日の統計を更新
    const today = new Date().toDateString();
    if (!stats.dailyStats) {
      stats.dailyStats = {};
    }
    
    if (!stats.dailyStats[today]) {
      stats.dailyStats[today] = {
        detected: 0,
        blocked: 0,
        allowed: 0
      };
    }
    
    stats.dailyStats[today].detected += detected;
    
    // 設定を保存
    preferences.statistics = stats;
    await updateUserPreferences(preferences);
    
    console.log(`Service Worker: Detection statistics updated - ${detected} popups detected on ${domain}`);
    
  } catch (error) {
    console.error('Service Worker: Error updating detection statistics:', error);
  }
}

/**
 * ポップアップ検出を処理
 */
async function handlePopupDetection(data, sender) {
  try {
    const { count, timestamp, url, domain, popups } = data;
    
    console.log(`Service Worker: Popup detection - ${count} popups detected on ${domain}`);
    
    // 統計を更新
    await updateDetectionStatistics({
      detected: count,
      timestamp: timestamp,
      domain: domain
    });
    
    // ユーザー設定を確認
    const preferences = await getUserPreferences();
    
    // 通知が有効な場合は表示
    if (preferences.showNotifications !== false) {
      const message = count === 1 ? 
        `${domain}で広告要素を1個検出しました` : 
        `${domain}で広告要素を${count}個検出しました`;
      
      await showNotification({
        title: 'ポップアップ広告ブロッカー',
        message: message,
        type: 'basic',
        priority: 1
      });
    }
    
    // 検出履歴に記録
    const detectionRecord = {
      timestamp: timestamp,
      url: url,
      domain: domain,
      count: count,
      popups: popups,
      tabId: sender.tab?.id
    };
    
    // 検出履歴を保存（最新100件まで）
    const historyResult = await chrome.storage.local.get(['detectionHistory']);
    let history = historyResult.detectionHistory || [];
    
    history.unshift(detectionRecord);
    if (history.length > 100) {
      history = history.slice(0, 100);
    }
    
    await chrome.storage.local.set({ detectionHistory: history });
    
  } catch (error) {
    console.error('Service Worker: Error handling popup detection:', error);
  }
}

// Service Worker の完全な初期化完了をログ出力
// メッセージリスナーの設定が完了した時点で実行
setTimeout(() => {
  logServiceWorkerStatus();
}, 100); // 短い遅延でイベントリスナーの登録完了を確実にする

/**
 * ポップアップ検出の処理
 */
async function handlePopupDetection(popupData, sender) {
  try {
    console.log('🚨 Service Worker: Popup detection handled:', {
      count: popupData.count,
      action: popupData.action,
      reason: popupData.reason,
      url: popupData.url,
      tabId: sender.tab?.id
    });

    // 拡張機能が無効の場合は処理しない
    const preferences = await getUserPreferences();
    if (!preferences.extensionEnabled) {
      console.log('Service Worker: Extension disabled, skipping');
      return;
    }

    // URL情報を取得
    let url = null;
    let hostname = null;
    
    if (sender.tab?.url) {
      try {
        url = new URL(sender.tab.url);
        hostname = url.hostname;
      } catch (error) {
        console.warn('Service Worker: Invalid URL:', sender.tab.url, error);
      }
    }

    // ホワイトリストドメインをチェック
    if (hostname) {
      const whitelistedDomains = preferences.whitelistedDomains || [];
      if (whitelistedDomains.includes(hostname)) {
        console.log('Service Worker: Whitelisted domain, skipping:', hostname);
        return;
      }
    }

    // アクションに基づいて統計を更新
    if (popupData.action === 'blocked') {
      await updatePopupStatistics(popupData);
      
      // バッジを更新（設定が有効な場合）
      if (!preferences.badgeDisabled) {
        await updateExtensionBadge(popupData.count, sender.tab?.id);
      }
    } else if (popupData.action === 'allowed') {
      // 許可された場合も統計に記録
      await recordAllowedAds(popupData);
    }

    // ユーザー選択の詳細を記録
    if (popupData.userChoice) {
      await recordUserDecision(popupData, sender.tab);
    }

    // ポップアップレコードを作成
    const popupRecord = {
      ...popupData,
      tabId: sender.tab?.id,
      url: sender.tab?.url,
      hostname: hostname,
      timestamp: Date.now(),
      processed: true
    };

    // パターンベースの提案を取得
    const patternSuggestion = await getPatternBasedSuggestion(
      popupData.characteristics,
      hostname
    );

    if (patternSuggestion) {
      popupRecord.patternSuggestion = patternSuggestion;
      console.log('パターンベース提案を追加:', patternSuggestion);
    }

    // ユーザー決定ワークフローを開始
    const decisionResult = await getUserDecision(popupRecord, sender.tab.id);

    if (!decisionResult.success) {
      console.error('ユーザー決定ワークフロー開始失敗:', decisionResult.error);
    }

    console.log('ポップアップ検出処理完了:', popupData.id);

  } catch (error) {
    console.error('ポップアップ検出処理エラー:', error);
    throw error;
  }
}

/**
 * ユーザー決定ワークフローの実装
 * 通知インタラクションからのユーザー応答を処理し、決定を保存・管理する
 */
async function getUserDecision(popupData, tabId) {
  try {
    console.log('ユーザー決定ワークフローを開始:', popupData.id);

    // 決定待ちリストに追加
    const decisionEntry = {
      popupData: popupData,
      tabId: tabId,
      timestamp: Date.now(),
      status: 'pending',
      timeoutId: null
    };

    extensionState.pendingDecisions.set(popupData.id, decisionEntry);

    // 決定タイムアウトを設定（30秒）
    const timeoutId = setTimeout(() => {
      handleDecisionTimeout(popupData.id);
    }, 30000);

    decisionEntry.timeoutId = timeoutId;

    // 決定待ち状態を保存
    await savePendingDecision(decisionEntry);

    console.log('ユーザー決定待ち状態を設定:', popupData.id);

    return {
      success: true,
      popupId: popupData.id,
      status: 'pending'
    };

  } catch (error) {
    console.error('ユーザー決定ワークフローエラー:', error);
    throw error;
  }
}

/**
 * ユーザー決定の処理
 * 通知インタラクションからのユーザー応答を処理する
 */
async function handleUserDecision(decisionData) {
  try {
    const { popupId, decision, popupData } = decisionData;
    console.log('ユーザー決定を処理中:', popupId, decision);

    // 決定待ちリストから取得
    const pendingDecision = extensionState.pendingDecisions.get(popupId);
    if (!pendingDecision) {
      console.warn('決定待ちポップアップが見つかりません:', popupId);
      return { success: false, error: 'Popup not found in pending decisions' };
    }

    // タイムアウトをクリア
    if (pendingDecision.timeoutId) {
      clearTimeout(pendingDecision.timeoutId);
    }

    // 決定を検証
    if (!['close', 'keep', 'dismiss'].includes(decision)) {
      console.error('無効な決定:', decision);
      return { success: false, error: 'Invalid decision' };
    }

    // ポップアップレコードを更新
    const updatedRecord = {
      ...pendingDecision.popupData,
      userDecision: decision,
      decisionTimestamp: Date.now(),
      responseTime: Date.now() - pendingDecision.timestamp
    };

    // 決定をストレージに保存
    await saveUserDecision(updatedRecord);

    // ポップアップ履歴を更新
    await savePopupRecord(updatedRecord);

    // 統計を更新
    if (decision !== 'dismiss') {
      await updateStatistics(decision === 'close' ? 'closed' : 'kept');
    }

    // 学習データを更新
    await updateLearningData(updatedRecord);

    // 決定待ちリストから削除
    extensionState.pendingDecisions.delete(popupId);

    // 決定待ち状態をストレージから削除
    await removePendingDecision(popupId);

    // コンテンツスクリプトに決定を送信
    try {
      await chrome.tabs.sendMessage(pendingDecision.tabId, {
        type: 'USER_DECISION_RESULT',
        data: { popupId, decision }
      });
    } catch (error) {
      console.warn('コンテンツスクリプトへのメッセージ送信失敗:', error);
    }

    console.log('ユーザー決定処理完了:', popupId, decision);

    return {
      success: true,
      popupId: popupId,
      decision: decision,
      timestamp: updatedRecord.decisionTimestamp
    };

  } catch (error) {
    console.error('ユーザー決定処理エラー:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 決定タイムアウトの処理
 */
async function handleDecisionTimeout(popupId) {
  try {
    console.log('決定タイムアウト:', popupId);

    const pendingDecision = extensionState.pendingDecisions.get(popupId);
    if (!pendingDecision) {
      return;
    }

    // タイムアウトした決定を記録
    const timeoutRecord = {
      ...pendingDecision.popupData,
      userDecision: 'timeout',
      decisionTimestamp: Date.now(),
      responseTime: Date.now() - pendingDecision.timestamp
    };

    await saveUserDecision(timeoutRecord);
    await savePopupRecord(timeoutRecord);

    // 決定待ちリストから削除
    extensionState.pendingDecisions.delete(popupId);
    await removePendingDecision(popupId);

    // コンテンツスクリプトに通知
    try {
      await chrome.tabs.sendMessage(pendingDecision.tabId, {
        type: 'USER_DECISION_TIMEOUT',
        data: { popupId }
      });
    } catch (error) {
      console.warn('タイムアウト通知の送信失敗:', error);
    }

  } catch (error) {
    console.error('決定タイムアウト処理エラー:', error);
  }
}

/**
 * ユーザー設定の取得
 */
async function getUserPreferences() {
  try {
    const result = await chrome.storage.local.get(['userPreferences']);
    return result.userPreferences || DEFAULT_PREFERENCES;
  } catch (error) {
    console.error('ユーザー設定取得エラー:', error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * ユーザー選択記録の処理
 */
async function handleUserChoiceRecorded(choiceData, sender) {
  try {
    console.log('Service Worker: Recording user choice:', choiceData);
    
    // ユーザー決定履歴に追加
    const decisions = await getUserDecisions();
    decisions.push({
      ...choiceData,
      tabId: sender.tab?.id,
      domain: sender.tab ? new URL(sender.tab.url).hostname : null
    });
    
    // 最新の1000件のみ保持
    if (decisions.length > 1000) {
      decisions.splice(0, decisions.length - 1000);
    }
    
    await chrome.storage.local.set({ userDecisions: decisions });
    
  } catch (error) {
    console.error('Service Worker: Error recording user choice:', error);
  }
}

/**
 * サイト設定の更新
 */
async function updateSiteSettings(settingsData, sender) {
  try {
    console.log('Service Worker: Updating site settings:', settingsData);
    
    const preferences = await getUserPreferences();
    if (!preferences.siteSettings) {
      preferences.siteSettings = {};
    }
    
    preferences.siteSettings[settingsData.domain] = {
      autoAction: settingsData.action,
      options: settingsData.options,
      timestamp: settingsData.timestamp
    };
    
    await updateUserPreferences(preferences);
    
  } catch (error) {
    console.error('Service Worker: Error updating site settings:', error);
  }
}

/**
 * 許可された広告の記録
 */
async function recordAllowedAds(popupData) {
  try {
    const preferences = await getUserPreferences();
    if (!preferences.statistics) {
      preferences.statistics = { totalBlocked: 0, dailyStats: {} };
    }
    
    // 許可された広告も統計に記録（別カウンター）
    if (!preferences.statistics.totalAllowed) {
      preferences.statistics.totalAllowed = 0;
    }
    preferences.statistics.totalAllowed += popupData.count;
    
    const today = new Date().toDateString();
    if (!preferences.statistics.dailyAllowedStats) {
      preferences.statistics.dailyAllowedStats = {};
    }
    if (!preferences.statistics.dailyAllowedStats[today]) {
      preferences.statistics.dailyAllowedStats[today] = 0;
    }
    preferences.statistics.dailyAllowedStats[today] += popupData.count;
    
    await updateUserPreferences(preferences);
    
  } catch (error) {
    console.error('Service Worker: Error recording allowed ads:', error);
  }
}

/**
 * ユーザー決定の記録
 */
async function recordUserDecision(popupData, tab) {
  try {
    const decision = {
      timestamp: Date.now(),
      domain: tab ? new URL(tab.url).hostname : null,
      url: tab?.url,
      action: popupData.action,
      reason: popupData.reason,
      adCount: popupData.count,
      userChoice: popupData.userChoice,
      responseTime: popupData.userChoice?.responseTime
    };
    
    const decisions = await getUserDecisions();
    decisions.push(decision);
    
    // 最新の1000件のみ保持
    if (decisions.length > 1000) {
      decisions.splice(0, decisions.length - 1000);
    }
    
    await chrome.storage.local.set({ userDecisions: decisions });
    
  } catch (error) {
    console.error('Service Worker: Error recording user decision:', error);
  }
}

/**
 * ユーザー決定履歴を取得
 */
async function getUserDecisions() {
  try {
    const result = await chrome.storage.local.get(['userDecisions']);
    return result.userDecisions || [];
  } catch (error) {
    console.error('Service Worker: Error getting user decisions:', error);
    return [];
  }
}

// showPopupNotification関数を削除（ユーザー選択ダイアログと重複するため）

/**
 * ユーザー設定の更新
 */
async function updateUserPreferences(newPreferences) {
  try {
    const currentPreferences = await getUserPreferences();
    const updatedPreferences = { ...currentPreferences, ...newPreferences };

    await chrome.storage.local.set({ userPreferences: updatedPreferences });

    // 拡張機能状態を更新
    extensionState.enabled = updatedPreferences.extensionEnabled;

    console.log('ユーザー設定が更新されました:', updatedPreferences);
  } catch (error) {
    console.error('ユーザー設定更新エラー:', error);
    throw error;
  }
}

/**
 * 統計の取得
 * ウェブサイトごとのポップアップブロック統計、総ブロックポップアップカウンター、
 * 効果メトリクス、ユーザーアクティビティトレンドのデータ可視化を実装
 */
async function getStatistics() {
  try {
    const preferences = await getUserPreferences();
    const basicStats = preferences.statistics || DEFAULT_PREFERENCES.statistics;

    // ユーザー決定履歴を取得
    const userDecisions = await getUserDecisions();

    // ポップアップ履歴を取得
    const popupHistoryResult = await chrome.storage.local.get(['popupHistory']);
    const popupHistory = popupHistoryResult.popupHistory || [];

    // 拡張統計を計算
    const enhancedStats = await calculateEnhancedStatistics(basicStats, userDecisions, popupHistory);

    return enhancedStats;
  } catch (error) {
    console.error('統計取得エラー:', error);
    return DEFAULT_PREFERENCES.statistics;
  }
}

/**
 * 拡張統計の計算
 * ウェブサイトごとの統計、時系列データ、効果メトリクスを含む包括的な統計を生成
 */
async function calculateEnhancedStatistics(basicStats, userDecisions, popupHistory) {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const oneWeekMs = 7 * oneDayMs;
  const oneMonthMs = 30 * oneDayMs;

  // 基本統計
  const enhancedStats = {
    ...basicStats,

    // ウェブサイトごとの統計
    websiteStatistics: calculateWebsiteStatistics(userDecisions, popupHistory),

    // 時系列統計（日別、週別、月別）
    timeSeriesData: calculateTimeSeriesData(userDecisions, popupHistory, now),

    // 効果メトリクス
    effectivenessMetrics: calculateEffectivenessMetrics(userDecisions, popupHistory, now),

    // ユーザーアクティビティトレンド
    activityTrends: calculateActivityTrends(userDecisions, popupHistory, now),

    // パフォーマンス統計
    performanceMetrics: calculatePerformanceMetrics(userDecisions, popupHistory),

    // 最終更新時刻
    lastUpdated: now
  };

  return enhancedStats;
}

/**
 * ウェブサイトごとの統計を計算
 */
function calculateWebsiteStatistics(userDecisions, popupHistory) {
  const websiteStats = {};

  // ユーザー決定からドメイン別統計を作成
  userDecisions.forEach(decision => {
    const domain = decision.domain || 'unknown';

    if (!websiteStats[domain]) {
      websiteStats[domain] = {
        domain: domain,
        totalDetected: 0,
        totalClosed: 0,
        totalKept: 0,
        totalTimeout: 0,
        blockRate: 0,
        lastActivity: 0,
        averageResponseTime: 0,
        responseTimes: []
      };
    }

    const stats = websiteStats[domain];
    stats.totalDetected++;

    switch (decision.userDecision) {
      case 'close':
        stats.totalClosed++;
        break;
      case 'keep':
        stats.totalKept++;
        break;
      case 'timeout':
        stats.totalTimeout++;
        break;
    }

    // 最後のアクティビティ時刻を更新
    if (decision.decisionTimestamp > stats.lastActivity) {
      stats.lastActivity = decision.decisionTimestamp;
    }

    // 応答時間を記録
    if (decision.responseTime && decision.responseTime > 0) {
      stats.responseTimes.push(decision.responseTime);
    }
  });

  // 統計を計算
  Object.values(websiteStats).forEach(stats => {
    // ブロック率を計算
    const totalDecisions = stats.totalClosed + stats.totalKept;
    stats.blockRate = totalDecisions > 0 ? (stats.totalClosed / totalDecisions) * 100 : 0;

    // 平均応答時間を計算
    if (stats.responseTimes.length > 0) {
      stats.averageResponseTime = stats.responseTimes.reduce((sum, time) => sum + time, 0) / stats.responseTimes.length;
    }

    // 応答時間配列は削除（メモリ節約）
    delete stats.responseTimes;
  });

  // ドメイン別統計を配列として返す（ブロック数順）
  return Object.values(websiteStats)
    .sort((a, b) => b.totalClosed - a.totalClosed)
    .slice(0, 50); // 上位50サイトのみ
}

/**
 * 時系列データを計算
 */
function calculateTimeSeriesData(userDecisions, popupHistory, now) {
  const oneDayMs = 24 * 60 * 60 * 1000;

  // 過去30日間の日別データ
  const dailyData = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - (i * oneDayMs));
    const dateStr = date.toISOString().split('T')[0];
    const dayStart = date.setHours(0, 0, 0, 0);
    const dayEnd = dayStart + oneDayMs;

    const dayDecisions = userDecisions.filter(d =>
      d.decisionTimestamp >= dayStart && d.decisionTimestamp < dayEnd
    );

    dailyData.push({
      date: dateStr,
      timestamp: dayStart,
      detected: dayDecisions.length,
      closed: dayDecisions.filter(d => d.userDecision === 'close').length,
      kept: dayDecisions.filter(d => d.userDecision === 'keep').length,
      timeout: dayDecisions.filter(d => d.userDecision === 'timeout').length
    });
  }

  // 過去12週間の週別データ
  const weeklyData = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = now - (i * 7 * oneDayMs);
    const weekEnd = weekStart + (7 * oneDayMs);

    const weekDecisions = userDecisions.filter(d =>
      d.decisionTimestamp >= weekStart && d.decisionTimestamp < weekEnd
    );

    weeklyData.push({
      weekStart: new Date(weekStart).toISOString().split('T')[0],
      timestamp: weekStart,
      detected: weekDecisions.length,
      closed: weekDecisions.filter(d => d.userDecision === 'close').length,
      kept: weekDecisions.filter(d => d.userDecision === 'keep').length,
      timeout: weekDecisions.filter(d => d.userDecision === 'timeout').length
    });
  }

  // 過去12ヶ月の月別データ
  const monthlyData = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();

    const monthDecisions = userDecisions.filter(d =>
      d.decisionTimestamp >= monthStart && d.decisionTimestamp < monthEnd
    );

    monthlyData.push({
      month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      timestamp: monthStart,
      detected: monthDecisions.length,
      closed: monthDecisions.filter(d => d.userDecision === 'close').length,
      kept: monthDecisions.filter(d => d.userDecision === 'keep').length,
      timeout: monthDecisions.filter(d => d.userDecision === 'timeout').length
    });
  }

  return {
    daily: dailyData,
    weekly: weeklyData,
    monthly: monthlyData
  };
}

/**
 * 効果メトリクスを計算
 */
function calculateEffectivenessMetrics(userDecisions, popupHistory, now) {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const oneWeekMs = 7 * oneDayMs;
  const oneMonthMs = 30 * oneDayMs;

  // 期間別の統計
  const periods = {
    today: now - oneDayMs,
    thisWeek: now - oneWeekMs,
    thisMonth: now - oneMonthMs,
    allTime: 0
  };

  const metrics = {};

  Object.entries(periods).forEach(([period, startTime]) => {
    const periodDecisions = userDecisions.filter(d => d.decisionTimestamp >= startTime);

    const totalDetected = periodDecisions.length;
    const totalClosed = periodDecisions.filter(d => d.userDecision === 'close').length;
    const totalKept = periodDecisions.filter(d => d.userDecision === 'keep').length;
    const totalTimeout = periodDecisions.filter(d => d.userDecision === 'timeout').length;

    const blockRate = totalDetected > 0 ? (totalClosed / totalDetected) * 100 : 0;
    const keepRate = totalDetected > 0 ? (totalKept / totalDetected) * 100 : 0;
    const timeoutRate = totalDetected > 0 ? (totalTimeout / totalDetected) * 100 : 0;

    // 平均応答時間
    const responseTimes = periodDecisions
      .filter(d => d.responseTime && d.responseTime > 0)
      .map(d => d.responseTime);
    const averageResponseTime = responseTimes.length > 0 ?
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;

    metrics[period] = {
      totalDetected,
      totalClosed,
      totalKept,
      totalTimeout,
      blockRate: Math.round(blockRate * 100) / 100,
      keepRate: Math.round(keepRate * 100) / 100,
      timeoutRate: Math.round(timeoutRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime)
    };
  });

  return metrics;
}

/**
 * ユーザーアクティビティトレンドを計算
 */
function calculateActivityTrends(userDecisions, popupHistory, now) {
  const oneDayMs = 24 * 60 * 60 * 1000;

  // 過去7日間の時間別アクティビティ
  const hourlyActivity = Array(24).fill(0).map((_, hour) => ({
    hour,
    activity: 0
  }));

  // 過去7日間のデータを使用
  const recentDecisions = userDecisions.filter(d =>
    d.decisionTimestamp >= (now - 7 * oneDayMs)
  );

  recentDecisions.forEach(decision => {
    const hour = new Date(decision.decisionTimestamp).getHours();
    hourlyActivity[hour].activity++;
  });

  // 曜日別アクティビティ（過去4週間）
  const weeklyActivity = Array(7).fill(0).map((_, day) => ({
    dayOfWeek: day, // 0 = 日曜日
    dayName: ['日', '月', '火', '水', '木', '金', '土'][day],
    activity: 0
  }));

  const fourWeeksAgo = now - (28 * oneDayMs);
  const fourWeekDecisions = userDecisions.filter(d =>
    d.decisionTimestamp >= fourWeeksAgo
  );

  fourWeekDecisions.forEach(decision => {
    const dayOfWeek = new Date(decision.decisionTimestamp).getDay();
    weeklyActivity[dayOfWeek].activity++;
  });

  // アクティビティの変化トレンド（過去30日 vs 前30日）
  const thirtyDaysAgo = now - (30 * oneDayMs);
  const sixtyDaysAgo = now - (60 * oneDayMs);

  const recent30Days = userDecisions.filter(d =>
    d.decisionTimestamp >= thirtyDaysAgo
  ).length;

  const previous30Days = userDecisions.filter(d =>
    d.decisionTimestamp >= sixtyDaysAgo && d.decisionTimestamp < thirtyDaysAgo
  ).length;

  const trendPercentage = previous30Days > 0 ?
    ((recent30Days - previous30Days) / previous30Days) * 100 : 0;

  return {
    hourlyActivity,
    weeklyActivity,
    trend: {
      recent30Days,
      previous30Days,
      changePercentage: Math.round(trendPercentage * 100) / 100,
      direction: trendPercentage > 0 ? 'increasing' : trendPercentage < 0 ? 'decreasing' : 'stable'
    }
  };
}

/**
 * パフォーマンス統計を計算
 */
function calculatePerformanceMetrics(userDecisions, popupHistory) {
  // 応答時間の統計
  const responseTimes = userDecisions
    .filter(d => d.responseTime && d.responseTime > 0)
    .map(d => d.responseTime)
    .sort((a, b) => a - b);

  let responseTimeStats = {
    count: 0,
    average: 0,
    median: 0,
    min: 0,
    max: 0,
    percentile95: 0
  };

  if (responseTimes.length > 0) {
    responseTimeStats = {
      count: responseTimes.length,
      average: Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length),
      median: Math.round(responseTimes[Math.floor(responseTimes.length / 2)]),
      min: responseTimes[0],
      max: responseTimes[responseTimes.length - 1],
      percentile95: Math.round(responseTimes[Math.floor(responseTimes.length * 0.95)])
    };
  }

  // 決定タイプの分布
  const decisionDistribution = {
    close: userDecisions.filter(d => d.userDecision === 'close').length,
    keep: userDecisions.filter(d => d.userDecision === 'keep').length,
    timeout: userDecisions.filter(d => d.userDecision === 'timeout').length,
    dismiss: userDecisions.filter(d => d.userDecision === 'dismiss').length
  };

  const totalDecisions = Object.values(decisionDistribution).reduce((sum, count) => sum + count, 0);

  const decisionPercentages = {};
  Object.entries(decisionDistribution).forEach(([decision, count]) => {
    decisionPercentages[decision] = totalDecisions > 0 ?
      Math.round((count / totalDecisions) * 10000) / 100 : 0;
  });

  return {
    responseTime: responseTimeStats,
    decisionDistribution,
    decisionPercentages,
    totalDecisions
  };
}

/**
 * 統計の更新
 */
async function updateStatistics(action) {
  try {
    const preferences = await getUserPreferences();
    const statistics = { ...preferences.statistics };

    switch (action) {
      case 'detected':
        statistics.totalPopupsDetected++;
        break;
      case 'closed':
        statistics.totalPopupsClosed++;
        break;
      case 'kept':
        statistics.totalPopupsKept++;
        break;
    }

    await updateUserPreferences({ statistics });
  } catch (error) {
    console.error('統計更新エラー:', error);
  }
}

/**
 * ポップアップレコードの保存
 */
async function savePopupRecord(popupRecord) {
  try {
    const result = await chrome.storage.local.get(['popupHistory']);
    const history = result.popupHistory || [];

    // 既存のレコードを更新または新規追加
    const existingIndex = history.findIndex(record => record.id === popupRecord.id);
    if (existingIndex >= 0) {
      history[existingIndex] = popupRecord;
    } else {
      history.push(popupRecord);
    }

    // 履歴サイズを制限（最新1000件）
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }

    await chrome.storage.local.set({ popupHistory: history });
  } catch (error) {
    console.error('ポップアップレコード保存エラー:', error);
    throw error;
  }
}

/**
 * ユーザー決定をストレージに保存
 */
async function saveUserDecision(decisionRecord) {
  try {
    const result = await chrome.storage.local.get(['userDecisions']);
    const decisions = result.userDecisions || [];

    // 既存の決定を更新または新規追加
    const existingIndex = decisions.findIndex(record => record.id === decisionRecord.id);
    if (existingIndex >= 0) {
      decisions[existingIndex] = decisionRecord;
    } else {
      decisions.push(decisionRecord);
    }

    // 決定履歴サイズを制限（最新500件）
    if (decisions.length > 500) {
      decisions.splice(0, decisions.length - 500);
    }

    await chrome.storage.local.set({ userDecisions: decisions });
    console.log('ユーザー決定を保存:', decisionRecord.id, decisionRecord.userDecision);

  } catch (error) {
    console.error('ユーザー決定保存エラー:', error);
    throw error;
  }
}

/**
 * ユーザー決定をストレージから取得
 */
async function getUserDecisions(filters = {}) {
  try {
    const result = await chrome.storage.local.get(['userDecisions']);
    let decisions = result.userDecisions || [];

    // フィルタリング
    if (filters.domain) {
      decisions = decisions.filter(decision => decision.domain === filters.domain);
    }

    if (filters.decision) {
      decisions = decisions.filter(decision => decision.userDecision === filters.decision);
    }

    if (filters.dateFrom) {
      decisions = decisions.filter(decision => decision.decisionTimestamp >= filters.dateFrom);
    }

    if (filters.dateTo) {
      decisions = decisions.filter(decision => decision.decisionTimestamp <= filters.dateTo);
    }

    // 最新順にソート
    decisions.sort((a, b) => b.decisionTimestamp - a.decisionTimestamp);

    return decisions;

  } catch (error) {
    console.error('ユーザー決定取得エラー:', error);
    return [];
  }
}

/**
 * 決定待ち状態をストレージに保存
 */
async function savePendingDecision(decisionEntry) {
  try {
    const result = await chrome.storage.local.get(['pendingDecisions']);
    const pending = result.pendingDecisions || {};

    // timeoutIdは保存しない（シリアライズできないため）
    const entryToSave = {
      ...decisionEntry,
      timeoutId: null
    };

    pending[decisionEntry.popupData.id] = entryToSave;

    await chrome.storage.local.set({ pendingDecisions: pending });

  } catch (error) {
    console.error('決定待ち状態保存エラー:', error);
  }
}

/**
 * 決定待ち状態をストレージから削除
 */
async function removePendingDecision(popupId) {
  try {
    const result = await chrome.storage.local.get(['pendingDecisions']);
    const pending = result.pendingDecisions || {};

    delete pending[popupId];

    await chrome.storage.local.set({ pendingDecisions: pending });

  } catch (error) {
    console.error('決定待ち状態削除エラー:', error);
  }
}

/**
 * 複数の同時ポップアップ決定をサポートする管理機能
 */
async function getPendingDecisions() {
  try {
    const decisions = Array.from(extensionState.pendingDecisions.values());
    return decisions.map(decision => ({
      popupId: decision.popupData.id,
      domain: decision.popupData.domain,
      timestamp: decision.timestamp,
      status: decision.status,
      tabId: decision.tabId
    }));
  } catch (error) {
    console.error('決定待ちリスト取得エラー:', error);
    return [];
  }
}

/**
 * 特定のタブの決定待ちポップアップを取得
 */
async function getPendingDecisionsByTab(tabId) {
  try {
    const decisions = Array.from(extensionState.pendingDecisions.values())
      .filter(decision => decision.tabId === tabId);

    return decisions.map(decision => ({
      popupId: decision.popupData.id,
      domain: decision.popupData.domain,
      timestamp: decision.timestamp,
      status: decision.status,
      confidence: decision.popupData.confidence
    }));
  } catch (error) {
    console.error('タブ別決定待ちリスト取得エラー:', error);
    return [];
  }
}

/**
 * 古い決定待ち状態をクリーンアップ
 */
async function cleanupExpiredDecisions() {
  try {
    const now = Date.now();
    const expiredThreshold = 5 * 60 * 1000; // 5分

    const expiredIds = [];

    for (const [popupId, decision] of extensionState.pendingDecisions.entries()) {
      if (now - decision.timestamp > expiredThreshold) {
        expiredIds.push(popupId);

        // タイムアウトをクリア
        if (decision.timeoutId) {
          clearTimeout(decision.timeoutId);
        }
      }
    }

    // 期限切れの決定を削除
    for (const popupId of expiredIds) {
      extensionState.pendingDecisions.delete(popupId);
      await removePendingDecision(popupId);
      console.log('期限切れ決定を削除:', popupId);
    }

    return expiredIds.length;

  } catch (error) {
    console.error('期限切れ決定クリーンアップエラー:', error);
    return 0;
  }
}

/**
 * 学習データの更新
 * ユーザー決定を保存し、類似のポップアップ特性のパターンマッチングを実装
 */
async function updateLearningData(popupRecord) {
  try {
    console.log('学習データ更新:', popupRecord.id, popupRecord.userDecision);

    // 学習が無効の場合はスキップ
    const preferences = await getUserPreferences();
    if (!preferences.learningEnabled) {
      console.log('学習機能が無効のためスキップ');
      return;
    }

    // 有効な決定のみ学習（timeout や dismiss は除外）
    if (!['close', 'keep'].includes(popupRecord.userDecision)) {
      console.log('無効な決定のため学習をスキップ:', popupRecord.userDecision);
      return;
    }

    // 既存の学習パターンを取得
    const result = await chrome.storage.local.get(['learningPatterns']);
    let patterns = result.learningPatterns || [];

    // 類似パターンを検索
    const matchingPattern = findMatchingPattern(patterns, popupRecord.characteristics);

    if (matchingPattern) {
      // 既存パターンを更新
      await updateExistingPattern(patterns, matchingPattern, popupRecord);
      console.log('既存パターンを更新:', matchingPattern.patternId);
    } else {
      // 新しいパターンを作成
      const newPattern = createNewPattern(popupRecord);
      patterns.push(newPattern);
      console.log('新しいパターンを作成:', newPattern.patternId);
    }

    // パターンリストをクリーンアップ（古いパターンや低信頼度パターンを削除）
    patterns = cleanupPatterns(patterns);

    // 更新されたパターンを保存
    await chrome.storage.local.set({ learningPatterns: patterns });

    console.log('学習データ更新完了。パターン数:', patterns.length);

  } catch (error) {
    console.error('学習データ更新エラー:', error);
  }
}

/**
 * 類似のポップアップ特性のパターンマッチングを実装
 */
function findMatchingPattern(patterns, characteristics) {
  const SIMILARITY_THRESHOLD = 0.7; // 70%以上の類似度で一致とみなす

  let bestMatch = null;
  let bestSimilarity = 0;

  for (const pattern of patterns) {
    const similarity = calculateSimilarity(pattern.characteristics, characteristics);

    if (similarity >= SIMILARITY_THRESHOLD && similarity > bestSimilarity) {
      bestMatch = pattern;
      bestSimilarity = similarity;
    }
  }

  return bestMatch;
}

/**
 * ポップアップ特性の類似度を計算
 */
function calculateSimilarity(pattern, characteristics) {
  const weights = {
    hasCloseButton: 0.15,
    containsAds: 0.25,
    hasExternalLinks: 0.20,
    isModal: 0.15,
    zIndex: 0.10,
    dimensions: 0.15
  };

  let totalWeight = 0;
  let matchedWeight = 0;

  // ブール値の比較
  for (const key of ['hasCloseButton', 'containsAds', 'hasExternalLinks', 'isModal']) {
    if (pattern[key] !== undefined && characteristics[key] !== undefined) {
      totalWeight += weights[key];
      if (pattern[key] === characteristics[key]) {
        matchedWeight += weights[key];
      }
    }
  }

  // zIndexの比較（範囲で判定）
  if (pattern.zIndex !== undefined && characteristics.zIndex !== undefined) {
    totalWeight += weights.zIndex;
    const zIndexDiff = Math.abs(pattern.zIndex - characteristics.zIndex);
    if (zIndexDiff <= 100) { // 100以内なら類似とみなす
      matchedWeight += weights.zIndex * (1 - zIndexDiff / 1000);
    }
  }

  // 寸法の比較
  if (pattern.dimensions && characteristics.dimensions) {
    totalWeight += weights.dimensions;
    const widthSimilarity = calculateDimensionSimilarity(
      pattern.dimensions.width,
      characteristics.dimensions.width
    );
    const heightSimilarity = calculateDimensionSimilarity(
      pattern.dimensions.height,
      characteristics.dimensions.height
    );
    matchedWeight += weights.dimensions * (widthSimilarity + heightSimilarity) / 2;
  }

  return totalWeight > 0 ? matchedWeight / totalWeight : 0;
}

/**
 * 寸法の類似度を計算
 */
function calculateDimensionSimilarity(value1, value2) {
  if (value1 === undefined || value2 === undefined) return 0;

  const diff = Math.abs(value1 - value2);
  const max = Math.max(value1, value2);

  if (max === 0) return 1;

  // 20%以内の差なら高い類似度
  const similarity = Math.max(0, 1 - diff / max);
  return similarity;
}

/**
 * 既存パターンを更新
 */
async function updateExistingPattern(patterns, matchingPattern, popupRecord) {
  const patternIndex = patterns.findIndex(p => p.patternId === matchingPattern.patternId);

  if (patternIndex >= 0) {
    const pattern = patterns[patternIndex];

    // 出現回数を増加
    pattern.occurrences++;
    pattern.lastSeen = Date.now();

    // 決定が一致する場合は信頼度を上げる
    if (pattern.userDecision === popupRecord.userDecision) {
      pattern.confidence = Math.min(1.0, pattern.confidence + 0.1);
    } else {
      // 決定が異なる場合は信頼度を下げる
      pattern.confidence = Math.max(0.1, pattern.confidence - 0.2);

      // 信頼度が低くなった場合、より頻繁な決定に更新
      if (pattern.confidence < 0.3) { // 閾値を下げる
        pattern.userDecision = popupRecord.userDecision;
        pattern.confidence = 0.6; // 新しい決定で再スタート
      }
    }

    // 特性を平均化して更新（より一般的なパターンにする）
    pattern.characteristics = averageCharacteristics(
      pattern.characteristics,
      popupRecord.characteristics,
      pattern.occurrences
    );

    console.log(`パターン更新: ${pattern.patternId}, 信頼度: ${pattern.confidence.toFixed(2)}, 出現回数: ${pattern.occurrences}`);
  }
}

/**
 * 特性を平均化
 */
function averageCharacteristics(existingChar, newChar, occurrences) {
  const result = { ...existingChar };

  // 数値の平均化
  if (typeof newChar.zIndex === 'number' && typeof existingChar.zIndex === 'number') {
    result.zIndex = Math.round((existingChar.zIndex * (occurrences - 1) + newChar.zIndex) / occurrences);
  }

  // 寸法の平均化
  if (newChar.dimensions && existingChar.dimensions) {
    result.dimensions = {
      width: Math.round((existingChar.dimensions.width * (occurrences - 1) + newChar.dimensions.width) / occurrences),
      height: Math.round((existingChar.dimensions.height * (occurrences - 1) + newChar.dimensions.height) / occurrences)
    };
  }

  // ブール値は多数決で決定
  for (const key of ['hasCloseButton', 'containsAds', 'hasExternalLinks', 'isModal']) {
    if (typeof newChar[key] === 'boolean') {
      // 新しい値が既存の値と異なる場合、出現回数に基づいて決定
      if (occurrences <= 2) {
        result[key] = newChar[key]; // 少ない場合は新しい値を採用
      }
      // 多い場合は既存の値を維持（多数決の概念）
    }
  }

  return result;
}

/**
 * 新しいパターンを作成
 */
function createNewPattern(popupRecord) {
  const patternId = generatePatternId();

  return {
    patternId: patternId,
    characteristics: { ...popupRecord.characteristics },
    userDecision: popupRecord.userDecision,
    confidence: 0.6, // 初期信頼度
    occurrences: 1,
    lastSeen: Date.now(),
    domain: popupRecord.domain // ドメイン情報も保存
  };
}

/**
 * パターンIDを生成
 */
function generatePatternId() {
  return 'pattern_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * パターンリストをクリーンアップ
 */
function cleanupPatterns(patterns) {
  const now = Date.now();
  const OLD_PATTERN_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30日
  const LOW_CONFIDENCE_THRESHOLD = 0.3;
  const MAX_PATTERNS = 100; // 最大パターン数

  // 古いパターンや低信頼度パターンを除去
  let cleanedPatterns = patterns.filter(pattern => {
    const isRecent = (now - pattern.lastSeen) < OLD_PATTERN_THRESHOLD;
    const hasGoodConfidence = pattern.confidence >= LOW_CONFIDENCE_THRESHOLD;
    const hasMinOccurrences = pattern.occurrences >= 1; // 最小出現回数を1に変更

    return isRecent && hasGoodConfidence && hasMinOccurrences;
  });

  // 信頼度順にソートして上位のみ保持
  cleanedPatterns.sort((a, b) => {
    // 信頼度 × 出現回数 × 新しさ でスコア計算
    const scoreA = a.confidence * Math.log(a.occurrences + 1) * (1 - (now - a.lastSeen) / OLD_PATTERN_THRESHOLD);
    const scoreB = b.confidence * Math.log(b.occurrences + 1) * (1 - (now - b.lastSeen) / OLD_PATTERN_THRESHOLD);
    return scoreB - scoreA;
  });

  if (cleanedPatterns.length > MAX_PATTERNS) {
    cleanedPatterns = cleanedPatterns.slice(0, MAX_PATTERNS);
  }

  console.log(`パターンクリーンアップ: ${patterns.length} → ${cleanedPatterns.length}`);

  return cleanedPatterns;
}

/**
 * 将来のポップアップのパターンベース自動提案を追加
 */
async function getPatternBasedSuggestion(popupCharacteristics, domain) {
  try {
    const preferences = await getUserPreferences();
    if (!preferences.learningEnabled) {
      return null;
    }

    const result = await chrome.storage.local.get(['learningPatterns']);
    const patterns = result.learningPatterns || [];

    if (patterns.length === 0) {
      return null;
    }

    // 最も類似度の高いパターンを検索
    let bestMatch = null;
    let bestSimilarity = 0;
    const MIN_CONFIDENCE_FOR_SUGGESTION = 0.7;
    const MIN_SIMILARITY_FOR_SUGGESTION = 0.8;

    for (const pattern of patterns) {
      // 信頼度が十分でない場合はスキップ
      if (pattern.confidence < MIN_CONFIDENCE_FOR_SUGGESTION) {
        continue;
      }

      const similarity = calculateSimilarity(pattern.characteristics, popupCharacteristics);

      if (similarity >= MIN_SIMILARITY_FOR_SUGGESTION && similarity > bestSimilarity) {
        bestMatch = pattern;
        bestSimilarity = similarity;
      }
    }

    if (bestMatch) {
      console.log(`パターンベース提案: ${bestMatch.userDecision} (信頼度: ${bestMatch.confidence.toFixed(2)}, 類似度: ${bestSimilarity.toFixed(2)})`);

      return {
        suggestion: bestMatch.userDecision,
        confidence: bestMatch.confidence,
        similarity: bestSimilarity,
        patternId: bestMatch.patternId,
        occurrences: bestMatch.occurrences
      };
    }

    return null;

  } catch (error) {
    console.error('パターンベース提案エラー:', error);
    return null;
  }
}

/**
 * 学習パターンの統計を取得
 */
async function getLearningStatistics() {
  try {
    const result = await chrome.storage.local.get(['learningPatterns']);
    const patterns = result.learningPatterns || [];

    const stats = {
      totalPatterns: patterns.length,
      highConfidencePatterns: patterns.filter(p => p.confidence >= 0.8).length,
      closePatterns: patterns.filter(p => p.userDecision === 'close').length,
      keepPatterns: patterns.filter(p => p.userDecision === 'keep').length,
      averageConfidence: patterns.length > 0 ?
        patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length : 0,
      totalOccurrences: patterns.reduce((sum, p) => sum + p.occurrences, 0)
    };

    return stats;

  } catch (error) {
    console.error('学習統計取得エラー:', error);
    return null;
  }
}

/**
 * タブ更新時の処理
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    extensionState.activeTabId = tabId;
    console.log('アクティブタブ更新:', tabId, tab.url);
  }
});

/**
 * タブアクティブ化時の処理
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  extensionState.activeTabId = activeInfo.tabId;
  console.log('タブアクティブ化:', activeInfo.tabId);
});

/**
 * 特定ウェブサイトの統計を取得
 */
async function getWebsiteStatistics(domain) {
  try {
    if (!domain) {
      throw new Error('ドメインが指定されていません');
    }

    const userDecisions = await getUserDecisions({ domain });
    const popupHistoryResult = await chrome.storage.local.get(['popupHistory']);
    const popupHistory = (popupHistoryResult.popupHistory || [])
      .filter(popup => popup.domain === domain);

    const websiteStats = calculateWebsiteStatistics(userDecisions, popupHistory);
    const targetSite = websiteStats.find(site => site.domain === domain);

    if (!targetSite) {
      return {
        domain,
        totalDetected: 0,
        totalClosed: 0,
        totalKept: 0,
        totalTimeout: 0,
        blockRate: 0,
        lastActivity: 0,
        averageResponseTime: 0
      };
    }

    // 時系列データも含める
    const timeSeriesData = calculateTimeSeriesDataForDomain(userDecisions, domain);

    return {
      ...targetSite,
      timeSeriesData
    };

  } catch (error) {
    console.error('ウェブサイト統計取得エラー:', error);
    return null;
  }
}

/**
 * 特定ドメインの時系列データを計算
 */
function calculateTimeSeriesDataForDomain(userDecisions, domain) {
  const domainDecisions = userDecisions.filter(d => d.domain === domain);
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  // 過去30日間の日別データ
  const dailyData = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now - (i * oneDayMs));
    const dateStr = date.toISOString().split('T')[0];
    const dayStart = date.setHours(0, 0, 0, 0);
    const dayEnd = dayStart + oneDayMs;

    const dayDecisions = domainDecisions.filter(d =>
      d.decisionTimestamp >= dayStart && d.decisionTimestamp < dayEnd
    );

    dailyData.push({
      date: dateStr,
      timestamp: dayStart,
      detected: dayDecisions.length,
      closed: dayDecisions.filter(d => d.userDecision === 'close').length,
      kept: dayDecisions.filter(d => d.userDecision === 'keep').length
    });
  }

  return { daily: dailyData };
}

/**
 * アクティビティトレンドを取得
 */
async function getActivityTrends() {
  try {
    const userDecisions = await getUserDecisions();
    const popupHistoryResult = await chrome.storage.local.get(['popupHistory']);
    const popupHistory = popupHistoryResult.popupHistory || [];

    const trends = calculateActivityTrends(userDecisions, popupHistory, Date.now());

    return trends;
  } catch (error) {
    console.error('アクティビティトレンド取得エラー:', error);
    return null;
  }
}

/**
 * 詳細統計を取得（フィルタリング対応）
 */
async function getDetailedStatistics(filters = {}) {
  try {
    let userDecisions = await getUserDecisions();
    const popupHistoryResult = await chrome.storage.local.get(['popupHistory']);
    let popupHistory = popupHistoryResult.popupHistory || [];

    // フィルタリング適用
    if (filters.dateFrom) {
      userDecisions = userDecisions.filter(d => d.decisionTimestamp >= filters.dateFrom);
      popupHistory = popupHistory.filter(p => p.timestamp >= filters.dateFrom);
    }

    if (filters.dateTo) {
      userDecisions = userDecisions.filter(d => d.decisionTimestamp <= filters.dateTo);
      popupHistory = popupHistory.filter(p => p.timestamp <= filters.dateTo);
    }

    if (filters.domain) {
      userDecisions = userDecisions.filter(d => d.domain === filters.domain);
      popupHistory = popupHistory.filter(p => p.domain === filters.domain);
    }

    if (filters.decision) {
      userDecisions = userDecisions.filter(d => d.userDecision === filters.decision);
    }

    // 基本統計を計算
    const basicStats = {
      totalPopupsDetected: popupHistory.length,
      totalPopupsClosed: userDecisions.filter(d => d.userDecision === 'close').length,
      totalPopupsKept: userDecisions.filter(d => d.userDecision === 'keep').length,
      lastResetDate: Date.now()
    };

    // 拡張統計を計算
    const enhancedStats = await calculateEnhancedStatistics(basicStats, userDecisions, popupHistory);

    return enhancedStats;
  } catch (error) {
    console.error('詳細統計取得エラー:', error);
    return null;
  }
}

/**
 * 統計データの可視化用データを生成
 */
async function generateVisualizationData() {
  try {
    const statistics = await getStatistics();

    // チャート用データの生成
    const chartData = {
      // 円グラフ用データ（決定分布）
      decisionPieChart: {
        labels: ['ブロック', '許可', 'タイムアウト'],
        data: [
          statistics.performanceMetrics.decisionDistribution.close,
          statistics.performanceMetrics.decisionDistribution.keep,
          statistics.performanceMetrics.decisionDistribution.timeout
        ],
        colors: ['#dc3545', '#28a745', '#ffc107']
      },

      // 線グラフ用データ（時系列）
      timeSeriesLineChart: {
        labels: statistics.timeSeriesData.daily.map(d => d.date),
        datasets: [
          {
            label: '検出数',
            data: statistics.timeSeriesData.daily.map(d => d.detected),
            color: '#007bff'
          },
          {
            label: 'ブロック数',
            data: statistics.timeSeriesData.daily.map(d => d.closed),
            color: '#dc3545'
          }
        ]
      },

      // 棒グラフ用データ（ウェブサイト別）
      websiteBarChart: {
        labels: statistics.websiteStatistics.slice(0, 10).map(w => w.domain),
        data: statistics.websiteStatistics.slice(0, 10).map(w => w.totalClosed),
        color: '#17a2b8'
      },

      // 時間別アクティビティ（ヒートマップ用）
      hourlyHeatmap: {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        data: statistics.activityTrends.hourlyActivity.map(h => h.activity)
      }
    };

    return chartData;
  } catch (error) {
    console.error('可視化データ生成エラー:', error);
    return null;
  }
}

console.log('バックグラウンドサービスワーカーが初期化されました');