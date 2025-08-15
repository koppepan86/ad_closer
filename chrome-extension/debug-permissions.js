/**
 * 権限デバッグスクリプト
 * Chrome拡張機能の権限問題を診断するためのツール
 */

class PermissionDebugger {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      manifest: {},
      runtime: {},
      permissions: {},
      apis: {},
      errors: []
    };
  }

  /**
   * 完全な権限診断を実行
   */
  async runFullDiagnosis() {
    console.log('=== Chrome拡張機能 権限診断開始 ===');
    
    try {
      await this.checkManifestPermissions();
      await this.checkRuntimePermissions();
      await this.checkApiAvailability();
      await this.checkContentScriptContext();
      await this.testPermissionRequests();
      
      this.generateReport();
      
    } catch (error) {
      console.error('診断中にエラーが発生:', error);
      this.results.errors.push({
        type: 'DIAGNOSIS_ERROR',
        message: error.message,
        stack: error.stack
      });
    }
    
    console.log('=== Chrome拡張機能 権限診断完了 ===');
    return this.results;
  }

  /**
   * マニフェストで宣言された権限をチェック
   */
  async checkManifestPermissions() {
    console.log('マニフェスト権限をチェック中...');
    
    try {
      const manifest = chrome.runtime.getManifest();
      this.results.manifest = {
        version: manifest.manifest_version,
        permissions: manifest.permissions || [],
        host_permissions: manifest.host_permissions || [],
        optional_permissions: manifest.optional_permissions || [],
        content_scripts: manifest.content_scripts?.length || 0
      };
      
      console.log('マニフェスト権限:', this.results.manifest);
      
    } catch (error) {
      this.results.errors.push({
        type: 'MANIFEST_ERROR',
        message: error.message
      });
    }
  }

  /**
   * 実行時の権限状態をチェック
   */
  async checkRuntimePermissions() {
    console.log('実行時権限をチェック中...');
    
    try {
      if (chrome.permissions) {
        // 現在の権限を取得
        const currentPermissions = await new Promise((resolve) => {
          chrome.permissions.getAll((permissions) => {
            if (chrome.runtime.lastError) {
              resolve({ error: chrome.runtime.lastError.message });
            } else {
              resolve(permissions);
            }
          });
        });
        
        this.results.permissions.current = currentPermissions;
        
        // 個別権限をテスト
        const testPermissions = ['activeTab', 'storage', 'notifications', 'tabs'];
        const permissionTests = {};
        
        for (const permission of testPermissions) {
          try {
            const hasPermission = await new Promise((resolve) => {
              chrome.permissions.contains({ permissions: [permission] }, (result) => {
                if (chrome.runtime.lastError) {
                  resolve({ error: chrome.runtime.lastError.message });
                } else {
                  resolve(result);
                }
              });
            });
            
            permissionTests[permission] = hasPermission;
          } catch (error) {
            permissionTests[permission] = { error: error.message };
          }
        }
        
        this.results.permissions.tests = permissionTests;
        
      } else {
        this.results.permissions.error = 'chrome.permissions API not available';
      }
      
    } catch (error) {
      this.results.errors.push({
        type: 'RUNTIME_PERMISSIONS_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Chrome API の利用可能性をチェック
   */
  async checkApiAvailability() {
    console.log('Chrome API の利用可能性をチェック中...');
    
    const apis = {
      runtime: {
        available: !!chrome.runtime,
        id: chrome.runtime?.id,
        onMessage: !!chrome.runtime?.onMessage,
        sendMessage: !!chrome.runtime?.sendMessage,
        getManifest: !!chrome.runtime?.getManifest
      },
      storage: {
        available: !!chrome.storage,
        local: !!chrome.storage?.local,
        sync: !!chrome.storage?.sync,
        session: !!chrome.storage?.session
      },
      tabs: {
        available: !!chrome.tabs,
        query: !!chrome.tabs?.query,
        sendMessage: !!chrome.tabs?.sendMessage,
        create: !!chrome.tabs?.create
      },
      notifications: {
        available: !!chrome.notifications,
        create: !!chrome.notifications?.create,
        clear: !!chrome.notifications?.clear
      },
      permissions: {
        available: !!chrome.permissions,
        contains: !!chrome.permissions?.contains,
        request: !!chrome.permissions?.request,
        remove: !!chrome.permissions?.remove
      }
    };
    
    this.results.apis = apis;
    
    // API テストを実行
    await this.testApiCalls();
  }

  /**
   * 実際のAPI呼び出しをテスト
   */
  async testApiCalls() {
    console.log('API呼び出しをテスト中...');
    
    const apiTests = {};
    
    // Storage API テスト
    try {
      if (chrome.storage?.local) {
        await chrome.storage.local.set({ test_key: 'test_value' });
        const result = await chrome.storage.local.get(['test_key']);
        await chrome.storage.local.remove(['test_key']);
        
        apiTests.storage = {
          success: true,
          canWrite: true,
          canRead: result.test_key === 'test_value',
          canDelete: true
        };
      } else {
        apiTests.storage = { success: false, error: 'API not available' };
      }
    } catch (error) {
      apiTests.storage = { success: false, error: error.message };
    }
    
    // Runtime API テスト
    try {
      if (chrome.runtime) {
        const manifest = chrome.runtime.getManifest();
        apiTests.runtime = {
          success: true,
          canGetManifest: !!manifest,
          extensionId: chrome.runtime.id
        };
      } else {
        apiTests.runtime = { success: false, error: 'API not available' };
      }
    } catch (error) {
      apiTests.runtime = { success: false, error: error.message };
    }
    
    // Tabs API テスト（activeTab権限が必要）
    try {
      if (chrome.tabs?.query) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        apiTests.tabs = {
          success: true,
          canQuery: true,
          activeTabsFound: tabs.length
        };
      } else {
        apiTests.tabs = { success: false, error: 'API not available' };
      }
    } catch (error) {
      apiTests.tabs = { success: false, error: error.message };
    }
    
    this.results.apiTests = apiTests;
  }

  /**
   * コンテンツスクリプトのコンテキストをチェック
   */
  async checkContentScriptContext() {
    console.log('コンテンツスクリプトコンテキストをチェック中...');
    
    const context = {
      isContentScript: typeof window !== 'undefined' && typeof document !== 'undefined',
      isServiceWorker: typeof importScripts === 'function',
      isPopup: typeof window !== 'undefined' && window.location?.protocol === 'chrome-extension:',
      
      // DOM アクセス
      canAccessDOM: typeof document !== 'undefined',
      documentReady: typeof document !== 'undefined' ? document.readyState : 'unknown',
      
      // ページ情報
      currentURL: typeof location !== 'undefined' ? location.href : 'unknown',
      domain: typeof location !== 'undefined' ? location.hostname : 'unknown',
      
      // 注入されたスクリプト
      injectedScripts: typeof window !== 'undefined' ? 
        Array.from(document.querySelectorAll('script[src*="chrome-extension"]')).length : 0
    };
    
    this.results.context = context;
  }

  /**
   * 権限リクエストをテスト
   */
  async testPermissionRequests() {
    console.log('権限リクエストをテスト中...');
    
    if (!chrome.permissions) {
      this.results.permissionRequests = { error: 'chrome.permissions API not available' };
      return;
    }
    
    const requestTests = {};
    
    // オプション権限のテスト（実際にはリクエストしない）
    const optionalPermissions = ['background', 'bookmarks', 'history'];
    
    for (const permission of optionalPermissions) {
      try {
        const hasPermission = await new Promise((resolve) => {
          chrome.permissions.contains({ permissions: [permission] }, (result) => {
            if (chrome.runtime.lastError) {
              resolve({ error: chrome.runtime.lastError.message });
            } else {
              resolve(result);
            }
          });
        });
        
        requestTests[permission] = {
          currentlyHas: hasPermission,
          canRequest: true // 実際のリクエストはしない
        };
        
      } catch (error) {
        requestTests[permission] = { error: error.message };
      }
    }
    
    this.results.permissionRequests = requestTests;
  }

  /**
   * 診断レポートを生成
   */
  generateReport() {
    console.log('=== 権限診断レポート ===');
    console.log('診断時刻:', this.results.timestamp);
    
    // マニフェスト情報
    console.log('\n📋 マニフェスト情報:');
    console.log('  Manifest Version:', this.results.manifest.version);
    console.log('  宣言された権限:', this.results.manifest.permissions);
    console.log('  ホスト権限:', this.results.manifest.host_permissions);
    console.log('  オプション権限:', this.results.manifest.optional_permissions);
    
    // 実行時権限
    console.log('\n🔐 実行時権限状態:');
    if (this.results.permissions.current) {
      console.log('  現在の権限:', this.results.permissions.current.permissions);
      console.log('  現在のホスト権限:', this.results.permissions.current.origins);
    }
    
    if (this.results.permissions.tests) {
      console.log('  個別権限テスト:');
      for (const [permission, result] of Object.entries(this.results.permissions.tests)) {
        const status = result === true ? '✅' : result.error ? '❌' : '⚠️';
        console.log(`    ${permission}: ${status} ${result.error || ''}`);
      }
    }
    
    // API利用可能性
    console.log('\n🔧 Chrome API 状態:');
    for (const [apiName, apiInfo] of Object.entries(this.results.apis)) {
      const available = apiInfo.available ? '✅' : '❌';
      console.log(`  ${apiName}: ${available}`);
      
      if (apiInfo.available) {
        const methods = Object.entries(apiInfo)
          .filter(([key, value]) => key !== 'available' && typeof value === 'boolean')
          .map(([key, value]) => `${key}:${value ? '✅' : '❌'}`)
          .join(', ');
        if (methods) {
          console.log(`    メソッド: ${methods}`);
        }
      }
    }
    
    // API テスト結果
    if (this.results.apiTests) {
      console.log('\n🧪 API テスト結果:');
      for (const [apiName, testResult] of Object.entries(this.results.apiTests)) {
        const status = testResult.success ? '✅' : '❌';
        console.log(`  ${apiName}: ${status} ${testResult.error || ''}`);
      }
    }
    
    // コンテキスト情報
    console.log('\n📍 実行コンテキスト:');
    console.log('  コンテンツスクリプト:', this.results.context?.isContentScript ? '✅' : '❌');
    console.log('  サービスワーカー:', this.results.context?.isServiceWorker ? '✅' : '❌');
    console.log('  ポップアップ:', this.results.context?.isPopup ? '✅' : '❌');
    console.log('  現在のURL:', this.results.context?.currentURL);
    
    // エラー
    if (this.results.errors.length > 0) {
      console.log('\n❌ エラー:');
      this.results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.type}: ${error.message}`);
      });
    }
    
    // 推奨事項
    this.generateRecommendations();
    
    console.log('\n======================');
  }

  /**
   * 推奨事項を生成
   */
  generateRecommendations() {
    console.log('\n💡 推奨事項:');
    
    const recommendations = [];
    
    // 権限関連の推奨事項
    if (this.results.permissions.tests) {
      const failedPermissions = Object.entries(this.results.permissions.tests)
        .filter(([_, result]) => result !== true)
        .map(([permission, _]) => permission);
      
      if (failedPermissions.length > 0) {
        recommendations.push(`権限が不足しています: ${failedPermissions.join(', ')}`);
        recommendations.push('manifest.jsonの権限設定を確認してください');
      }
    }
    
    // API関連の推奨事項
    const unavailableApis = Object.entries(this.results.apis)
      .filter(([_, apiInfo]) => !apiInfo.available)
      .map(([apiName, _]) => apiName);
    
    if (unavailableApis.length > 0) {
      recommendations.push(`利用できないAPI: ${unavailableApis.join(', ')}`);
    }
    
    // コンテキスト関連の推奨事項
    if (this.results.context && !this.results.context.canAccessDOM) {
      recommendations.push('DOM アクセスができません。コンテンツスクリプトとして実行されているか確認してください');
    }
    
    // Manifest V3 関連の推奨事項
    if (this.results.manifest.version === 3) {
      recommendations.push('Manifest V3 では一部の権限が制限されます');
      recommendations.push('activeTab 権限はユーザーアクション後のみ有効です');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('権限設定に問題は見つかりませんでした');
    }
    
    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }

  /**
   * 結果をJSONで取得
   */
  getResults() {
    return this.results;
  }
}

// デバッガーを実行
const permissionDebugger = new PermissionDebugger();

// 自動実行（コンソールで手動実行も可能）
if (typeof window !== 'undefined') {
  window.permissionDebugger = permissionDebugger;
  
  // ページ読み込み完了後に自動実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => permissionDebugger.runFullDiagnosis(), 1000);
    });
  } else {
    setTimeout(() => permissionDebugger.runFullDiagnosis(), 1000);
  }
}

// Service Worker での実行
if (typeof importScripts === 'function') {
  permissionDebugger.runFullDiagnosis();
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PermissionDebugger };
}