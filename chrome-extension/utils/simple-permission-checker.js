/**
 * Simple Permission Checker
 * Simplified permission checking for Chrome extensions
 * Manifest V3対応の簡素化された権限チェッカー
 */

class SimplePermissionChecker {
  constructor() {
    this.permissionStatus = new Map();
    this.lastCheck = null;
  }

  /**
   * Check all essential permissions using direct API testing
   */
  async checkEssentialPermissions() {
    console.log('Checking essential permissions with direct API testing...');
    
    const results = {
      storage: await this.testStoragePermission(),
      activeTab: await this.testActiveTabPermission(),
      notifications: await this.testNotificationsPermission(),
      tabs: await this.testTabsPermission(),
      runtime: await this.testRuntimePermission()
    };

    // Store results
    for (const [permission, status] of Object.entries(results)) {
      this.permissionStatus.set(permission, status);
    }

    this.lastCheck = Date.now();
    
    console.log('Permission check results:', results);
    return results;
  }

  /**
   * Test storage permission by trying to use the API
   */
  async testStoragePermission() {
    try {
      if (!chrome.storage || !chrome.storage.local) {
        return {
          available: false,
          error: 'chrome.storage.local API not available',
          reason: 'api_missing'
        };
      }

      // Test basic storage operations
      const testKey = `test_${Date.now()}`;
      const testData = { test: true, timestamp: Date.now() };

      // Test set
      await chrome.storage.local.set({ [testKey]: testData });
      
      // Test get
      const result = await chrome.storage.local.get([testKey]);
      
      // Test remove
      await chrome.storage.local.remove([testKey]);

      // Verify
      if (!result[testKey] || result[testKey].test !== true) {
        return {
          available: false,
          error: 'Storage operations failed',
          reason: 'functional_test_failed'
        };
      }

      return {
        available: true,
        functional: true,
        reason: 'api_test_passed'
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
        reason: 'exception_thrown'
      };
    }
  }

  /**
   * Test activeTab permission
   */
  async testActiveTabPermission() {
    try {
      if (!chrome.tabs) {
        return {
          available: false,
          error: 'chrome.tabs API not available',
          reason: 'api_missing'
        };
      }

      // Try to query active tab
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve(tabs || []);
          }
        });
      });

      if (tabs.error) {
        return {
          available: false,
          error: tabs.error,
          reason: 'query_failed',
          requiresUserInteraction: true
        };
      }

      return {
        available: tabs.length > 0,
        functional: tabs.length > 0,
        reason: tabs.length > 0 ? 'query_successful' : 'no_active_tab',
        requiresUserInteraction: tabs.length === 0
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
        reason: 'exception_thrown',
        requiresUserInteraction: true
      };
    }
  }

  /**
   * Test notifications permission
   */
  async testNotificationsPermission() {
    try {
      if (!chrome.notifications) {
        return {
          available: false,
          error: 'chrome.notifications API not available',
          reason: 'api_missing'
        };
      }

      // Test notification creation (without actually showing it)
      const testId = `test_${Date.now()}`;
      
      try {
        await chrome.notifications.create(testId, {
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Test',
          message: 'Test notification'
        });
        
        // Immediately clear it
        await chrome.notifications.clear(testId);
        
        return {
          available: true,
          functional: true,
          reason: 'api_test_passed'
        };
      } catch (error) {
        return {
          available: false,
          error: error.message,
          reason: 'create_failed'
        };
      }
    } catch (error) {
      return {
        available: false,
        error: error.message,
        reason: 'exception_thrown'
      };
    }
  }

  /**
   * Test tabs permission
   */
  async testTabsPermission() {
    try {
      if (!chrome.tabs) {
        return {
          available: false,
          error: 'chrome.tabs API not available',
          reason: 'api_missing'
        };
      }

      // Test tabs query
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({}, (tabs) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve(tabs || []);
          }
        });
      });

      if (tabs.error) {
        return {
          available: false,
          error: tabs.error,
          reason: 'query_failed'
        };
      }

      return {
        available: true,
        functional: Array.isArray(tabs),
        tabCount: Array.isArray(tabs) ? tabs.length : 0,
        reason: 'query_successful'
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
        reason: 'exception_thrown'
      };
    }
  }

  /**
   * Test runtime permission
   */
  async testRuntimePermission() {
    try {
      if (!chrome.runtime) {
        return {
          available: false,
          error: 'chrome.runtime API not available',
          reason: 'api_missing'
        };
      }

      // Test basic runtime functionality
      const manifest = chrome.runtime.getManifest();
      const extensionId = chrome.runtime.id;

      return {
        available: true,
        functional: !!(manifest && extensionId),
        extensionId: extensionId,
        manifestVersion: manifest?.manifest_version,
        reason: 'api_test_passed'
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
        reason: 'exception_thrown'
      };
    }
  }

  /**
   * Get permission status
   */
  getPermissionStatus(permission) {
    return this.permissionStatus.get(permission) || {
      available: false,
      error: 'Permission not checked',
      reason: 'not_checked'
    };
  }

  /**
   * Get all permission statuses
   */
  getAllPermissionStatuses() {
    const statuses = {};
    for (const [permission, status] of this.permissionStatus.entries()) {
      statuses[permission] = status;
    }
    return {
      statuses,
      lastCheck: this.lastCheck,
      summary: this.getPermissionSummary()
    };
  }

  /**
   * Get permission summary
   */
  getPermissionSummary() {
    const available = [];
    const unavailable = [];
    const requiresInteraction = [];

    for (const [permission, status] of this.permissionStatus.entries()) {
      if (status.available) {
        available.push(permission);
      } else {
        unavailable.push(permission);
        if (status.requiresUserInteraction) {
          requiresInteraction.push(permission);
        }
      }
    }

    return {
      available,
      unavailable,
      requiresInteraction,
      totalChecked: this.permissionStatus.size
    };
  }

  /**
   * Check if essential permissions are working
   */
  areEssentialPermissionsWorking() {
    const storage = this.getPermissionStatus('storage');
    const runtime = this.getPermissionStatus('runtime');

    return storage.available && runtime.available;
  }

  /**
   * Get recommendations for fixing permission issues
   */
  getRecommendations() {
    const recommendations = [];
    const summary = this.getPermissionSummary();

    if (summary.unavailable.includes('storage')) {
      recommendations.push('Storage permission issue: Check manifest.json and reload extension');
    }

    if (summary.unavailable.includes('runtime')) {
      recommendations.push('Runtime permission issue: Extension may not be properly loaded');
    }

    if (summary.requiresInteraction.includes('activeTab')) {
      recommendations.push('ActiveTab permission requires user interaction: Click extension icon');
    }

    if (summary.unavailable.includes('notifications')) {
      recommendations.push('Notifications permission issue: Check browser notification settings');
    }

    if (summary.unavailable.includes('tabs')) {
      recommendations.push('Tabs permission issue: Check manifest.json permissions');
    }

    if (recommendations.length === 0) {
      recommendations.push('All checked permissions appear to be working correctly');
    }

    return recommendations;
  }
}

// Create global instance
const simplePermissionChecker = new SimplePermissionChecker();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SimplePermissionChecker, simplePermissionChecker };
} else if (typeof window !== 'undefined') {
  window.SimplePermissionChecker = SimplePermissionChecker;
  window.simplePermissionChecker = simplePermissionChecker;
} else if (typeof self !== 'undefined') {
  self.SimplePermissionChecker = SimplePermissionChecker;
  self.simplePermissionChecker = simplePermissionChecker;
}

console.log('Simple Permission Checker loaded');