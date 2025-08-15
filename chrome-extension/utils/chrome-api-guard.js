/**
 * Chrome API Guard System
 * Chrome APIの安全な利用を確保するためのユーティリティ
 */

(function() {
  'use strict';

  /**
   * Manifest V3で非推奨/利用不可のAPIリスト
   */
  const deprecatedAPIs = {
    'runtime.onSuspend': 'Not available in Manifest V3 service workers',
    'runtime.onSuspendCanceled': 'Not available in Manifest V3 service workers',
    'browserAction': 'Use action API instead in Manifest V3',
    'pageAction': 'Use action API instead in Manifest V3'
  };

  /**
   * コンテキスト固有のAPIリスト（コンテンツスクリプトでは利用不可）
   */
  const contextSpecificAPIs = {
    'runtime.onStartup': 'Only available in background scripts',
    'runtime.onInstalled': 'Only available in background scripts',
    'action.onClicked': 'Only available in background scripts',
    'contextMenus': 'Only available in background scripts',
    'notifications.create': 'Only available in background scripts',
    'permissions': 'Limited availability in content scripts',
    'permissions.onAdded': 'Only available in background scripts',
    'permissions.onRemoved': 'Only available in background scripts'
  };

  /**
   * Chrome APIの利用可能性をチェック
   */
  function checkChromeAPI(apiPath) {
    if (typeof chrome === 'undefined') {
      return { available: false, reason: 'chrome object not available' };
    }

    // 非推奨APIのチェック
    if (deprecatedAPIs[apiPath]) {
      return { 
        available: false, 
        reason: deprecatedAPIs[apiPath],
        deprecated: true
      };
    }

    // コンテキスト固有APIのチェック
    if (contextSpecificAPIs[apiPath]) {
      return { 
        available: false, 
        reason: contextSpecificAPIs[apiPath],
        contextSpecific: true
      };
    }

    const pathParts = apiPath.split('.');
    let current = chrome;

    for (const part of pathParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return { 
          available: false, 
          reason: `${apiPath} not available - ${part} is missing`,
          partialPath: pathParts.slice(0, pathParts.indexOf(part) + 1).join('.')
        };
      }
    }

    return { 
      available: true, 
      api: current,
      type: typeof current
    };
  }

  /**
   * 安全なaddListener呼び出し
   */
  function safeAddListener(apiPath, callback, options = {}) {
    const check = checkChromeAPI(apiPath);
    
    if (!check.available) {
      const message = `Chrome API Guard: ${apiPath} not available - ${check.reason}`;
      
      // 非推奨APIやコンテキスト固有APIの場合は警告レベルを下げる
      if (check.deprecated || check.contextSpecific) {
        console.debug(message);
      } else if (options.required) {
        console.error(message);
      } else {
        console.warn(message);
      }
      
      return { 
        success: false, 
        reason: check.reason, 
        deprecated: check.deprecated,
        contextSpecific: check.contextSpecific
      };
    }

    if (typeof check.api.addListener !== 'function') {
      const message = `Chrome API Guard: ${apiPath}.addListener is not a function`;
      console.error(message);
      return { success: false, reason: 'addListener method not available' };
    }

    try {
      check.api.addListener(callback);
      console.log(`Chrome API Guard: Successfully registered listener for ${apiPath}`);
      return { success: true, api: check.api };
    } catch (error) {
      console.error(`Chrome API Guard: Error registering listener for ${apiPath}:`, error);
      return { success: false, reason: error.message, error };
    }
  }

  /**
   * 安全なremoveListener呼び出し
   */
  function safeRemoveListener(apiPath, callback) {
    const check = checkChromeAPI(apiPath);
    
    if (!check.available) {
      console.warn(`Chrome API Guard: ${apiPath} not available for removeListener`);
      return { success: false, reason: check.reason };
    }

    if (typeof check.api.removeListener !== 'function') {
      console.warn(`Chrome API Guard: ${apiPath}.removeListener is not a function`);
      return { success: false, reason: 'removeListener method not available' };
    }

    try {
      check.api.removeListener(callback);
      console.log(`Chrome API Guard: Successfully removed listener for ${apiPath}`);
      return { success: true };
    } catch (error) {
      console.error(`Chrome API Guard: Error removing listener for ${apiPath}:`, error);
      return { success: false, reason: error.message, error };
    }
  }

  /**
   * Chrome APIの存在確認
   */
  function isChromeAPIAvailable(apiPath) {
    return checkChromeAPI(apiPath).available;
  }

  /**
   * 安全な権限チェック
   */
  function safePermissionCheck(permission, options = {}) {
    // Special handling for storage permission
    if (permission === 'storage') {
      return Promise.resolve().then(() => {
        // In Manifest V3, if storage is declared, chrome.storage should be available
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          console.debug('Chrome API Guard: storage API is available');
          return true;
        } else {
          console.debug('Chrome API Guard: storage API not available');
          return false;
        }
      });
    }

    const check = checkChromeAPI('permissions');
    
    if (!check.available) {
      console.debug(`Chrome API Guard: permissions API not available - ${check.reason}`);
      
      // For declared permissions in manifest, assume they're available in content scripts
      const declaredPermissions = ['storage', 'activeTab', 'notifications', 'tabs'];
      if (declaredPermissions.includes(permission)) {
        console.debug(`Chrome API Guard: Assuming ${permission} is available as it's declared in manifest`);
        return Promise.resolve(true);
      }
      
      return Promise.resolve(false);
    }

    if (typeof check.api.contains !== 'function') {
      console.debug('Chrome API Guard: permissions.contains not available');
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      try {
        check.api.contains({ permissions: [permission] }, (result) => {
          if (chrome.runtime.lastError) {
            console.debug(`Permission check failed for ${permission}:`, chrome.runtime.lastError.message);
            resolve(false);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        console.debug(`Permission check error for ${permission}:`, error);
        resolve(false);
      }
    });
  }

  /**
   * Chrome API呼び出しの安全なラッパー
   */
  function safeChromeAPICall(apiPath, method, args = [], options = {}) {
    const fullPath = method ? `${apiPath}.${method}` : apiPath;
    const check = checkChromeAPI(apiPath);
    
    if (!check.available) {
      const message = `Chrome API Guard: ${apiPath} not available`;
      if (options.required) {
        console.error(message);
        throw new Error(message);
      } else {
        console.warn(message);
        return null;
      }
    }

    const targetMethod = method ? check.api[method] : check.api;
    
    if (typeof targetMethod !== 'function') {
      const message = `Chrome API Guard: ${fullPath} is not a function`;
      console.error(message);
      if (options.required) {
        throw new Error(message);
      }
      return null;
    }

    try {
      return targetMethod.apply(check.api, args);
    } catch (error) {
      console.error(`Chrome API Guard: Error calling ${fullPath}:`, error);
      if (options.required) {
        throw error;
      }
      return null;
    }
  }

  /**
   * 現在の実行コンテキストを検出
   */
  function detectContext() {
    if (typeof window !== 'undefined' && window.location) {
      return 'content_script';
    } else if (typeof self !== 'undefined' && typeof importScripts === 'function') {
      return 'service_worker';
    } else if (typeof window !== 'undefined') {
      return 'popup_or_options';
    } else {
      return 'unknown';
    }
  }

  /**
   * Chrome API診断情報の取得
   */
  function getChromeAPIDiagnostics() {
    const commonAPIs = [
      'runtime',
      'runtime.onMessage',
      'runtime.onConnect',
      'storage',
      'storage.local',
      'storage.sync',
      'tabs',
      'tabs.query'
    ];

    const context = detectContext();
    const diagnostics = {
      chromeAvailable: typeof chrome !== 'undefined',
      context: context,
      apis: {},
      timestamp: Date.now()
    };

    for (const apiPath of commonAPIs) {
      const check = checkChromeAPI(apiPath);
      diagnostics.apis[apiPath] = {
        available: check.available,
        type: check.type,
        reason: check.reason
      };
    }

    return diagnostics;
  }

  /**
   * Chrome API診断レポートの表示
   */
  function showChromeAPIDiagnostics() {
    const diagnostics = getChromeAPIDiagnostics();
    
    console.log('=== Chrome API Diagnostics ===');
    console.log('Chrome available:', diagnostics.chromeAvailable);
    console.log('Context:', diagnostics.context);
    console.log('Timestamp:', new Date(diagnostics.timestamp).toISOString());
    
    console.log('\nAPI Availability:');
    for (const [apiPath, info] of Object.entries(diagnostics.apis)) {
      const status = info.available ? '✅' : '❌';
      const reason = info.reason ? ` (${info.reason})` : '';
      console.log(`  ${status} ${apiPath}: ${info.type}${reason}`);
    }
    
    console.log('===============================');
    
    return diagnostics;
  }

  /**
   * グローバル関数の設定
   */
  function setupGlobalFunctions() {
    if (typeof window !== 'undefined') {
      window.chromeAPIGuard = {
        checkAPI: checkChromeAPI,
        safeAddListener,
        safeRemoveListener,
        isAPIAvailable: isChromeAPIAvailable,
        safeCall: safeChromeAPICall,
        safePermissionCheck,
        getDiagnostics: getChromeAPIDiagnostics,
        showDiagnostics: showChromeAPIDiagnostics
      };

      // 個別の関数も直接アクセス可能にする
      window.safeAddListener = safeAddListener;
      window.safeRemoveListener = safeRemoveListener;
      window.isChromeAPIAvailable = isChromeAPIAvailable;
      window.safeChromeAPICall = safeChromeAPICall;
      window.safePermissionCheck = safePermissionCheck;
      window.showChromeAPIDiagnostics = showChromeAPIDiagnostics;
    }

    // Service Worker環境でも利用可能にする
    if (typeof self !== 'undefined' && typeof importScripts === 'function') {
      self.chromeAPIGuard = {
        checkAPI: checkChromeAPI,
        safeAddListener,
        safeRemoveListener,
        isAPIAvailable: isChromeAPIAvailable,
        safeCall: safeChromeAPICall,
        safePermissionCheck,
        getDiagnostics: getChromeAPIDiagnostics,
        showDiagnostics: showChromeAPIDiagnostics
      };
    }
  }

  /**
   * 初期化
   */
  function initialize() {
    console.log('Chrome API Guard System initializing...');
    
    setupGlobalFunctions();
    
    // 初期診断を実行
    const diagnostics = getChromeAPIDiagnostics();
    
    if (!diagnostics.chromeAvailable) {
      console.warn('Chrome API Guard: Chrome APIs not available');
    } else {
      console.log('Chrome API Guard: Chrome APIs detected');
    }
    
    console.log('Chrome API Guard System initialized');
  }

  // 即座に初期化
  initialize();

  // エクスポート
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      checkChromeAPI,
      safeAddListener,
      safeRemoveListener,
      isChromeAPIAvailable,
      safeChromeAPICall,
      safePermissionCheck,
      getChromeAPIDiagnostics,
      showChromeAPIDiagnostics
    };
  }

  console.log('Chrome API Guard System loaded');
})();