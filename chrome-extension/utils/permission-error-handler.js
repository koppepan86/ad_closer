/**
 * 権限エラーの適切な劣化処理
 * Chrome拡張機能の権限管理用
 */

/**
 * 権限エラーハンドラークラス
 */
class PermissionErrorHandler {
  constructor() {
    // activeTab is conditional - only available after user interaction, not always required
    this.requiredPermissions = new Set(['storage']);
    this.conditionalPermissions = new Set(['activeTab']); // New category for activeTab
    this.optionalPermissions = new Set(['notifications', 'tabs']);
    this.permissionStatus = new Map();
    this.degradedFeatures = new Set();
    this.fallbackMethods = new Map();
    this.permissionChecks = new Map();
    this.userInteractionDetected = false; // Track user interaction state
    this.activeTabAvailable = false; // Track activeTab availability

    this.initializePermissionHandling();
    this.setupFallbackMethods();
    this.setupUserInteractionDetection();
  }

  /**
   * 権限ハンドリングの初期化
   */
  initializePermissionHandling() {
    // 初期権限チェック
    this.checkAllPermissions();

    // 権限変更の監視（Chrome API Guardを使用）
    if (typeof window !== 'undefined' && window.safeAddListener) {
      window.safeAddListener('permissions.onAdded', (permissions) => {
        console.log('Permissions added:', permissions);
        this.updatePermissionStatus(permissions.permissions, true);
        this.restoreFeatures(permissions.permissions);
      });

      window.safeAddListener('permissions.onRemoved', (permissions) => {
        console.log('Permissions removed:', permissions);
        this.updatePermissionStatus(permissions.permissions, false);
        this.degradeFeatures(permissions.permissions);
      });
    } else {
      // フォールバック: 従来の方法（バックグラウンドスクリプトでのみ利用可能）
      if (typeof chrome !== 'undefined' && chrome.permissions) {
        try {
          if (chrome.permissions.onAdded && typeof chrome.permissions.onAdded.addListener === 'function') {
            chrome.permissions.onAdded.addListener((permissions) => {
              console.log('Permissions added:', permissions);
              this.updatePermissionStatus(permissions.permissions, true);
              this.restoreFeatures(permissions.permissions);
            });
          }

          if (chrome.permissions.onRemoved && typeof chrome.permissions.onRemoved.addListener === 'function') {
            chrome.permissions.onRemoved.addListener((permissions) => {
              console.log('Permissions removed:', permissions);
              this.updatePermissionStatus(permissions.permissions, false);
              this.degradeFeatures(permissions.permissions);
            });
          }
        } catch (error) {
          console.debug('Permission listeners not available in this context:', error);
        }
      }
    }
  }

  /**
   * フォールバックメソッドを設定
   */
  setupFallbackMethods() {
    // ストレージのフォールバック
    this.fallbackMethods.set('storage', {
      get: this.fallbackStorageGet.bind(this),
      set: this.fallbackStorageSet.bind(this),
      remove: this.fallbackStorageRemove.bind(this),
      description: 'localStorage を使用した代替ストレージ'
    });

    // 通知のフォールバック
    this.fallbackMethods.set('notifications', {
      create: this.fallbackNotificationCreate.bind(this),
      clear: this.fallbackNotificationClear.bind(this),
      description: 'DOM 要素を使用した代替通知'
    });

    // タブ操作のフォールバック
    this.fallbackMethods.set('tabs', {
      query: this.fallbackTabsQuery.bind(this),
      sendMessage: this.fallbackTabsSendMessage.bind(this),
      description: '制限されたタブ操作'
    });

    // activeTab のフォールバック
    this.fallbackMethods.set('activeTab', {
      getCurrentTab: this.fallbackGetCurrentTab.bind(this),
      injectScript: this.fallbackInjectScript.bind(this),
      description: '現在のタブのみの制限された操作'
    });
  }

  /**
   * ユーザーインタラクション検出の設定
   */
  setupUserInteractionDetection() {
    // Use the global user action detector if available
    if (typeof userActionDetector !== 'undefined') {
      console.log('Using global UserActionDetector for permission handling');

      // Register callback to be notified of user interactions
      userActionDetector.onUserInteraction((interaction) => {
        console.log('Permission handler notified of user interaction:', interaction.type);
        this.handleUserInteraction();
      });

      // Check if user has already interacted
      const status = userActionDetector.getInteractionStatus();
      if (status.userInteractionDetected) {
        this.userInteractionDetected = true;
        this.activeTabAvailable = status.activeTabAvailable;
        console.log('User interaction already detected via UserActionDetector');
      }

      return;
    }

    // Fallback: Set up basic detection if UserActionDetector not available
    console.log('UserActionDetector not available, using fallback detection');

    // Extension action click detection
    if (chrome.action && chrome.action.onClicked) {
      chrome.action.onClicked.addListener(() => {
        console.log('User interaction detected: extension action clicked');
        this.handleUserInteraction();
      });
    }

    // Context menu interaction (if available)
    if (chrome.contextMenus && chrome.contextMenus.onClicked) {
      chrome.contextMenus.onClicked.addListener(() => {
        console.log('User interaction detected: context menu clicked');
        this.handleUserInteraction();
      });
    }

    // Keyboard shortcut detection (if available)
    if (chrome.commands && chrome.commands.onCommand) {
      chrome.commands.onCommand.addListener(() => {
        console.log('User interaction detected: keyboard shortcut used');
        this.handleUserInteraction();
      });
    }

    // Listen for messages from popup or other UI components
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'user_interaction') {
          console.log('User interaction detected: message from UI component');
          this.handleUserInteraction();
        }
      });
    }
  }

  /**
   * ユーザーインタラクションを処理
   */
  async handleUserInteraction() {
    this.userInteractionDetected = true;
    console.log('User interaction handled - activeTab permission may now be available');

    // If UserActionDetector is available, get status from it
    if (typeof userActionDetector !== 'undefined') {
      const status = userActionDetector.getInteractionStatus();
      this.userInteractionDetected = status.userInteractionDetected;
      this.activeTabAvailable = status.activeTabAvailable;
      console.log('Updated interaction status from UserActionDetector:', status);
    } else {
      // Re-check activeTab permission after user interaction
      const activeTabNowAvailable = await this.checkActiveTabPermission();
      if (activeTabNowAvailable && !this.activeTabAvailable) {
        this.activeTabAvailable = true;
        this.permissionStatus.set('activeTab', true);
        console.log('ActiveTab permission is now available after user interaction');
      }
    }

    // Restore activeTab features if they were degraded
    if (this.activeTabAvailable && this.degradedFeatures.has('activeTab')) {
      this.restoreFeatures(['activeTab']);
    }
  }

  /**
   * ActiveTab権限の利用可能性を確認
   */
  async ensureActiveTabPermission() {
    // Use UserActionDetector if available
    if (typeof userActionDetector !== 'undefined') {
      const result = await userActionDetector.requestPermissionAfterInteraction('activeTab');
      this.activeTabAvailable = result.success;
      this.permissionStatus.set('activeTab', result.success);

      if (!result.success) {
        console.warn('ActiveTab permission not available:', result.message);
      }

      return result.success;
    }

    // Fallback to original logic
    if (this.activeTabAvailable) {
      return true;
    }

    if (!this.userInteractionDetected) {
      console.warn('ActiveTab permission requires user interaction. Please click the extension icon or use a keyboard shortcut.');
      return false;
    }

    // Re-check after user interaction
    const available = await this.checkActiveTabPermission();
    this.activeTabAvailable = available;
    this.permissionStatus.set('activeTab', available);

    return available;
  }

  /**
   * すべての権限をチェック
   */
  async checkAllPermissions() {
    console.log('Checking all permissions...');

    // 必須権限をチェック
    for (const permission of this.requiredPermissions) {
      try {
        const hasPermission = await this.checkPermission(permission);
        this.permissionStatus.set(permission, hasPermission);

        if (!hasPermission) {
          console.warn(`Required permission missing: ${permission}`);
          this.degradeFeatures([permission]);
        } else {
          console.log(`Required permission available: ${permission}`);
        }
      } catch (error) {
        console.error(`Error checking required permission ${permission}:`, error);

        // For storage permission, if there's an error but the API is available, assume it's working
        if (permission === 'storage' && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          console.log(`Storage API is available despite permission check error - assuming permission is granted`);
          this.permissionStatus.set(permission, true);
        } else {
          this.permissionStatus.set(permission, false);
          this.degradeFeatures([permission]);
        }
      }
    }

    // 条件付き権限をチェック（activeTabなど）
    for (const permission of this.conditionalPermissions) {
      const hasPermission = await this.checkPermission(permission);
      this.permissionStatus.set(permission, hasPermission);

      if (permission === 'activeTab') {
        this.activeTabAvailable = hasPermission;
        if (!hasPermission) {
          console.info(`ActiveTab permission not currently available - requires user interaction`);
        } else {
          console.log(`ActiveTab permission is currently available`);
        }
      }
    }

    // オプション権限をチェック
    for (const permission of this.optionalPermissions) {
      const hasPermission = await this.checkPermission(permission);
      this.permissionStatus.set(permission, hasPermission);

      if (!hasPermission) {
        console.info(`Optional permission not available: ${permission}`);
      }
    }

    // 権限状態をログ出力
    this.logPermissionStatus();
  }

  /**
   * 特定の権限をチェック
   */
  async checkPermission(permission) {
    try {
      // Special handling for different permission types
      switch (permission) {
        case 'storage':
          return await this.checkStoragePermission();
        case 'activeTab':
          return await this.checkActiveTabPermission();
        default:
          // For other permissions, try Chrome API Guard first
          if (typeof window !== 'undefined' && window.safePermissionCheck) {
            return await window.safePermissionCheck(permission);
          }

          // Fallback to direct API check (only available in background scripts)
          if (!chrome.permissions) {
            console.debug(`chrome.permissions API not available in this context for ${permission}`);

            // For declared permissions in manifest, assume they're available
            // This is a fallback for content scripts where permissions API is limited
            const declaredPermissions = ['storage', 'activeTab', 'notifications', 'tabs'];
            if (declaredPermissions.includes(permission)) {
              console.debug(`Assuming ${permission} is available as it's declared in manifest`);
              return true;
            }

            return false;
          }

          return new Promise((resolve) => {
            chrome.permissions.contains({ permissions: [permission] }, (result) => {
              if (chrome.runtime.lastError) {
                console.error(`Permission check failed for ${permission}:`, chrome.runtime.lastError);
                resolve(false);
              } else {
                resolve(result);
              }
            });
          });
      }
    } catch (error) {
      console.error(`Permission check error for ${permission}:`, error);
      return false;
    }
  }

  /**
   * ActiveTab権限の特別なチェック
   * ActiveTabは宣言されていても、ユーザーインタラクション後にのみ利用可能
   */
  async checkActiveTabPermission() {
    try {
      // Use Chrome API Guard for safe permission checking
      let hasActiveTabDeclared = false;

      if (typeof window !== 'undefined' && window.safePermissionCheck) {
        hasActiveTabDeclared = await window.safePermissionCheck('activeTab');
      } else {
        // Fallback: try direct API check
        if (chrome.permissions && chrome.permissions.contains) {
          hasActiveTabDeclared = await new Promise((resolve) => {
            chrome.permissions.contains({ permissions: ['activeTab'] }, (result) => {
              if (chrome.runtime.lastError) {
                console.error('ActiveTab permission check failed:', chrome.runtime.lastError);
                resolve(false);
              } else {
                resolve(result);
              }
            });
          });
        } else {
          // If permissions API is not available, assume activeTab is declared
          // since it's in the manifest
          console.debug('chrome.permissions API not available, assuming activeTab is declared');
          hasActiveTabDeclared = true;
        }
      }

      if (!hasActiveTabDeclared) {
        console.warn('ActiveTab permission not declared in manifest');
        return false;
      }

      // ActiveTab is declared, but check if it's currently usable
      // In Manifest V3, activeTab is only granted after user interaction
      if (!this.userInteractionDetected) {
        console.info('ActiveTab permission declared but requires user interaction to be usable');
        return false;
      }

      // Try to access current tab to verify activeTab is actually working
      try {
        if (chrome.tabs && chrome.tabs.query) {
          const tabs = await new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (chrome.runtime.lastError) {
                resolve([]);
              } else {
                resolve(tabs || []);
              }
            });
          });

          const hasActiveTab = tabs.length > 0;
          console.log(`ActiveTab permission functional check: ${hasActiveTab ? 'working' : 'not working'}`);
          return hasActiveTab;
        }
      } catch (error) {
        console.warn('ActiveTab functional check failed:', error);
      }

      // Fallback: assume activeTab is available if declared and user interacted
      return this.userInteractionDetected;
    } catch (error) {
      console.error('ActiveTab permission check error:', error);
      return false;
    }
  }

  /**
   * Storage権限の特別なチェック
   * Manifest V3では、storage権限は宣言されていれば通常利用可能
   */
  async checkStoragePermission() {
    try {
      // In Manifest V3, if storage permission is declared in manifest, 
      // chrome.storage API should be directly available
      if (!chrome.storage || !chrome.storage.local) {
        console.debug('chrome.storage.local API not available');
        return false;
      }

      // Test if storage API is actually functional with a simple operation
      try {
        const testKey = `permission_test_${Date.now()}`;
        const testValue = { test: true, timestamp: Date.now() };

        // Test write
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ [testKey]: testValue }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });

        // Test read
        const result = await new Promise((resolve, reject) => {
          chrome.storage.local.get([testKey], (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });

        // Test delete
        await new Promise((resolve, reject) => {
          chrome.storage.local.remove([testKey], () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });

        // Verify the test worked
        if (!result[testKey] || result[testKey].test !== true) {
          console.warn('Storage functional test failed - data mismatch');
          return false;
        }

        console.log('Storage permission verified and functional');
        return true;
      } catch (error) {
        console.error('Storage functional test failed:', error);
        return false;
      }
    } catch (error) {
      console.error('Storage permission check error:', error);
      return false;
    }
  }

  /**
   * 権限状態を更新
   */
  updatePermissionStatus(permissions, granted) {
    permissions.forEach(permission => {
      this.permissionStatus.set(permission, granted);
      console.log(`Permission ${permission}: ${granted ? 'granted' : 'revoked'}`);
    });
  }

  /**
   * 機能を劣化
   */
  degradeFeatures(permissions) {
    permissions.forEach(permission => {
      this.degradedFeatures.add(permission);

      switch (permission) {
        case 'storage':
          this.degradeStorageFeatures();
          break;
        case 'notifications':
          this.degradeNotificationFeatures();
          break;
        case 'tabs':
          this.degradeTabFeatures();
          break;
        case 'activeTab':
          this.degradeActiveTabFeatures();
          break;
        default:
          console.warn(`Unknown permission for degradation: ${permission}`);
      }
    });

    // 劣化状態を通知
    this.notifyDegradedMode();
  }

  /**
   * 機能を復元
   */
  restoreFeatures(permissions) {
    permissions.forEach(permission => {
      this.degradedFeatures.delete(permission);

      switch (permission) {
        case 'storage':
          this.restoreStorageFeatures();
          break;
        case 'notifications':
          this.restoreNotificationFeatures();
          break;
        case 'tabs':
          this.restoreTabFeatures();
          break;
        case 'activeTab':
          this.restoreActiveTabFeatures();
          break;
      }
    });

    // 復元状態を通知
    this.notifyFeatureRestoration(permissions);
  }

  /**
   * ストレージ機能の劣化
   */
  degradeStorageFeatures() {
    console.log('Degrading storage features to localStorage fallback');

    // グローバルスコープにフォールバック関数を提供
    if (typeof window !== 'undefined') {
      window.degradedStorage = this.fallbackMethods.get('storage');
    }
  }

  /**
   * 通知機能の劣化
   */
  degradeNotificationFeatures() {
    console.log('Degrading notification features to DOM-based fallback');

    if (typeof window !== 'undefined') {
      window.degradedNotifications = this.fallbackMethods.get('notifications');
    }
  }

  /**
   * タブ機能の劣化
   */
  degradeTabFeatures() {
    console.log('Degrading tab features to limited operations');

    if (typeof window !== 'undefined') {
      window.degradedTabs = this.fallbackMethods.get('tabs');
    }
  }

  /**
   * activeTab 機能の劣化
   */
  degradeActiveTabFeatures() {
    console.log('Degrading activeTab features to current tab only');

    if (typeof window !== 'undefined') {
      window.degradedActiveTab = this.fallbackMethods.get('activeTab');
    }
  }

  /**
   * ストレージ機能の復元
   */
  restoreStorageFeatures() {
    console.log('Restoring full storage features');

    if (typeof window !== 'undefined') {
      delete window.degradedStorage;
    }
  }

  /**
   * 通知機能の復元
   */
  restoreNotificationFeatures() {
    console.log('Restoring full notification features');

    if (typeof window !== 'undefined') {
      delete window.degradedNotifications;
    }
  }

  /**
   * タブ機能の復元
   */
  restoreTabFeatures() {
    console.log('Restoring full tab features');

    if (typeof window !== 'undefined') {
      delete window.degradedTabs;
    }
  }

  /**
   * activeTab 機能の復元
   */
  restoreActiveTabFeatures() {
    console.log('Restoring full activeTab features');

    if (typeof window !== 'undefined') {
      delete window.degradedActiveTab;
    }
  }

  /**
   * フォールバック ストレージ取得
   */
  async fallbackStorageGet(keys) {
    try {
      if (typeof localStorage === 'undefined') {
        throw new Error('localStorage not available');
      }

      const result = {};
      const keyArray = Array.isArray(keys) ? keys : [keys];

      keyArray.forEach(key => {
        const value = localStorage.getItem(`extension_${key}`);
        if (value !== null) {
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = value;
          }
        }
      });

      return result;
    } catch (error) {
      console.error('Fallback storage get failed:', error);
      return {};
    }
  }

  /**
   * フォールバック ストレージ設定
   */
  async fallbackStorageSet(data) {
    try {
      if (typeof localStorage === 'undefined') {
        throw new Error('localStorage not available');
      }

      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(`extension_${key}`, JSON.stringify(value));
      });

      return true;
    } catch (error) {
      console.error('Fallback storage set failed:', error);
      return false;
    }
  }

  /**
   * フォールバック ストレージ削除
   */
  async fallbackStorageRemove(keys) {
    try {
      if (typeof localStorage === 'undefined') {
        throw new Error('localStorage not available');
      }

      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach(key => {
        localStorage.removeItem(`extension_${key}`);
      });

      return true;
    } catch (error) {
      console.error('Fallback storage remove failed:', error);
      return false;
    }
  }

  /**
   * フォールバック 通知作成
   */
  async fallbackNotificationCreate(options) {
    try {
      if (typeof document === 'undefined') {
        throw new Error('Document not available');
      }

      const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // DOM 要素として通知を作成
      const notification = document.createElement('div');
      notification.id = notificationId;
      notification.className = 'extension-fallback-notification';
      notification.innerHTML = `
        <div class="notification-header">
          <img src="${options.iconUrl || ''}" alt="Icon" class="notification-icon">
          <span class="notification-title">${options.title || ''}</span>
          <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="notification-message">${options.message || ''}</div>
      `;

      // スタイルを適用
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
      `;

      document.body.appendChild(notification);

      // 自動削除（5秒後）
      setTimeout(() => {
        if (document.getElementById(notificationId)) {
          notification.remove();
        }
      }, 5000);

      return notificationId;
    } catch (error) {
      console.error('Fallback notification create failed:', error);
      return null;
    }
  }

  /**
   * フォールバック 通知削除
   */
  async fallbackNotificationClear(notificationId) {
    try {
      if (typeof document === 'undefined') {
        return false;
      }

      const notification = document.getElementById(notificationId);
      if (notification) {
        notification.remove();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Fallback notification clear failed:', error);
      return false;
    }
  }

  /**
   * フォールバック タブクエリ
   */
  async fallbackTabsQuery(queryInfo) {
    try {
      // 制限された情報のみ返す
      return [{
        id: -1,
        url: typeof location !== 'undefined' ? location.href : '',
        title: typeof document !== 'undefined' ? document.title : '',
        active: true,
        windowId: -1
      }];
    } catch (error) {
      console.error('Fallback tabs query failed:', error);
      return [];
    }
  }

  /**
   * フォールバック タブメッセージ送信
   */
  async fallbackTabsSendMessage(tabId, message) {
    try {
      // DOM イベントを使用した代替通信
      if (typeof document !== 'undefined') {
        const event = new CustomEvent('extension_message', {
          detail: message
        });
        document.dispatchEvent(event);

        return { success: true, method: 'dom_event' };
      }

      throw new Error('Document not available');
    } catch (error) {
      console.error('Fallback tabs sendMessage failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * フォールバック 現在のタブ取得
   */
  async fallbackGetCurrentTab() {
    try {
      return {
        id: -1,
        url: typeof location !== 'undefined' ? location.href : '',
        title: typeof document !== 'undefined' ? document.title : '',
        active: true,
        windowId: -1
      };
    } catch (error) {
      console.error('Fallback getCurrentTab failed:', error);
      return null;
    }
  }

  /**
   * フォールバック スクリプト注入
   */
  async fallbackInjectScript(details) {
    try {
      console.warn('Script injection not available in degraded mode');
      return { success: false, reason: 'degraded_mode' };
    } catch (error) {
      console.error('Fallback injectScript failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 権限要求
   */
  async requestPermission(permission) {
    try {
      // ActiveTab permission cannot be requested directly - it's granted through user interaction
      if (permission === 'activeTab') {
        console.warn('ActiveTab permission cannot be requested directly. It requires user interaction with the extension.');

        if (!this.userInteractionDetected) {
          console.info('Please click the extension icon or use a keyboard shortcut to activate activeTab permission.');
          return false;
        }

        // Check if activeTab is now available after user interaction
        return await this.ensureActiveTabPermission();
      }

      // Check if permissions API is available
      if (!chrome.permissions || !chrome.permissions.request) {
        console.warn('chrome.permissions.request API not available in this context');
        return false;
      }

      return new Promise((resolve) => {
        chrome.permissions.request({ permissions: [permission] }, (granted) => {
          if (chrome.runtime.lastError) {
            console.error(`Permission request failed for ${permission}:`, chrome.runtime.lastError);
            resolve(false);
          } else {
            console.log(`Permission ${permission}: ${granted ? 'granted' : 'denied'}`);
            resolve(granted);
          }
        });
      });
    } catch (error) {
      console.error(`Permission request error for ${permission}:`, error);
      return false;
    }
  }

  /**
   * 権限削除
   */
  async removePermission(permission) {
    try {
      // Check if permissions API is available
      if (!chrome.permissions || !chrome.permissions.remove) {
        console.warn('chrome.permissions.remove API not available in this context');
        return false;
      }

      return new Promise((resolve) => {
        chrome.permissions.remove({ permissions: [permission] }, (removed) => {
          if (chrome.runtime.lastError) {
            console.error(`Permission removal failed for ${permission}:`, chrome.runtime.lastError);
            resolve(false);
          } else {
            console.log(`Permission ${permission}: ${removed ? 'removed' : 'not removed'}`);
            resolve(removed);
          }
        });
      });
    } catch (error) {
      console.error(`Permission removal error for ${permission}:`, error);
      return false;
    }
  }

  /**
   * 安全な API 呼び出し
   */
  async safeApiCall(apiPath, method, ...args) {
    try {
      // API パスを解析（例: 'chrome.storage.local.get'）
      const pathParts = apiPath.split('.');
      let api = window;

      for (const part of pathParts) {
        if (api && api[part]) {
          api = api[part];
        } else {
          throw new Error(`API not available: ${apiPath}`);
        }
      }

      if (typeof api[method] !== 'function') {
        throw new Error(`Method not available: ${apiPath}.${method}`);
      }

      // API を呼び出し
      return await api[method](...args);
    } catch (error) {
      console.warn(`Safe API call failed: ${apiPath}.${method}`, error);

      // フォールバックを試行
      const fallback = this.getFallbackForApi(apiPath, method);
      if (fallback) {
        console.log(`Using fallback for ${apiPath}.${method}`);
        return await fallback(...args);
      }

      throw error;
    }
  }

  /**
   * API のフォールバックを取得
   */
  getFallbackForApi(apiPath, method) {
    const apiMappings = {
      'chrome.storage.local.get': this.fallbackStorageGet.bind(this),
      'chrome.storage.local.set': this.fallbackStorageSet.bind(this),
      'chrome.storage.local.remove': this.fallbackStorageRemove.bind(this),
      'chrome.notifications.create': this.fallbackNotificationCreate.bind(this),
      'chrome.notifications.clear': this.fallbackNotificationClear.bind(this),
      'chrome.tabs.query': this.fallbackTabsQuery.bind(this),
      'chrome.tabs.sendMessage': this.fallbackTabsSendMessage.bind(this)
    };

    return apiMappings[`${apiPath}.${method}`] || null;
  }

  /**
   * 劣化モードを通知
   */
  notifyDegradedMode() {
    console.warn('Extension running in degraded mode due to missing permissions');

    if (this.degradedFeatures.size > 0) {
      console.warn('Degraded features:', Array.from(this.degradedFeatures));

      // ユーザーに通知
      this.fallbackNotificationCreate({
        title: 'ポップアップブロッカー - 制限モード',
        message: '一部の権限が不足しているため、制限モードで動作しています。',
        iconUrl: 'icons/icon48.png'
      });
    }
  }

  /**
   * 機能復元を通知
   */
  notifyFeatureRestoration(permissions) {
    console.log('Features restored:', permissions);

    this.fallbackNotificationCreate({
      title: 'ポップアップブロッカー - 機能復元',
      message: '権限が付与され、すべての機能が利用可能になりました。',
      iconUrl: 'icons/icon48.png'
    });
  }

  /**
   * 権限状態をログ出力
   */
  logPermissionStatus() {
    console.log('Permission Status:');
    for (const [permission, status] of this.permissionStatus.entries()) {
      let type = 'Optional';
      if (this.requiredPermissions.has(permission)) {
        type = 'Required';
      } else if (this.conditionalPermissions.has(permission)) {
        type = 'Conditional';
      }

      const statusIcon = status ? '✓' : '✗';
      let statusNote = '';

      if (permission === 'activeTab' && !status) {
        statusNote = this.userInteractionDetected ?
          ' (declared but not functional)' :
          ' (requires user interaction)';
      }

      console.log(`  ${permission}: ${statusIcon} (${type})${statusNote}`);
    }

    console.log(`User Interaction Detected: ${this.userInteractionDetected ? '✓' : '✗'}`);
    console.log(`ActiveTab Available: ${this.activeTabAvailable ? '✓' : '✗'}`);

    if (this.degradedFeatures.size > 0) {
      console.log('Degraded Features:', Array.from(this.degradedFeatures));
    }
  }

  /**
   * 権限統計を取得
   */
  getPermissionStatistics() {
    return {
      requiredPermissions: Array.from(this.requiredPermissions),
      conditionalPermissions: Array.from(this.conditionalPermissions),
      optionalPermissions: Array.from(this.optionalPermissions),
      permissionStatus: Object.fromEntries(this.permissionStatus),
      degradedFeatures: Array.from(this.degradedFeatures),
      availableFallbacks: Array.from(this.fallbackMethods.keys()),
      userInteractionDetected: this.userInteractionDetected,
      activeTabAvailable: this.activeTabAvailable
    };
  }

  /**
   * 権限ハンドラーをリセット
   */
  reset() {
    this.permissionStatus.clear();
    this.degradedFeatures.clear();
    this.permissionChecks.clear();
    this.userInteractionDetected = false;
    this.activeTabAvailable = false;
  }
}

// グローバルインスタンスを作成
const permissionErrorHandler = new PermissionErrorHandler();

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PermissionErrorHandler, permissionErrorHandler };
} else if (typeof window !== 'undefined') {
  window.PermissionErrorHandler = PermissionErrorHandler;
  window.permissionErrorHandler = permissionErrorHandler;
}