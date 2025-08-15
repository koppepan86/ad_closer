/**
 * 統合テスト用ヘルパーユーティリティ
 * 
 * 統合テストで共通して使用される機能とモックを提供します。
 */

/**
 * Chrome API の包括的なモック
 */
class ChromeAPIMock {
  constructor() {
    this.storage = new Map();
    this.messageListeners = [];
    this.tabListeners = [];
    this.alarmListeners = [];
    
    this.setupMocks();
  }

  setupMocks() {
    this.chrome = {
      runtime: {
        id: 'test-extension-id',
        lastError: null,
        sendMessage: jest.fn(this.sendMessage.bind(this)),
        onMessage: {
          addListener: jest.fn(this.addMessageListener.bind(this)),
          removeListener: jest.fn(this.removeMessageListener.bind(this)),
          hasListener: jest.fn()
        },
        onInstalled: {
          addListener: jest.fn()
        },
        onStartup: {
          addListener: jest.fn()
        },
        onSuspend: {
          addListener: jest.fn()
        },
        getManifest: jest.fn(() => ({
          version: '1.0.0',
          name: 'Test Extension'
        }))
      },
      
      storage: {
        local: {
          get: jest.fn(this.storageGet.bind(this)),
          set: jest.fn(this.storageSet.bind(this)),
          remove: jest.fn(this.storageRemove.bind(this)),
          clear: jest.fn(this.storageClear.bind(this)),
          getBytesInUse: jest.fn(this.getBytesInUse.bind(this))
        },
        onChanged: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        }
      },
      
      tabs: {
        query: jest.fn(this.tabsQuery.bind(this)),
        sendMessage: jest.fn(this.tabsSendMessage.bind(this)),
        get: jest.fn(),
        onUpdated: {
          addListener: jest.fn()
        },
        onRemoved: {
          addListener: jest.fn()
        }
      },
      
      notifications: {
        create: jest.fn(this.createNotification.bind(this)),
        clear: jest.fn(),
        onClicked: {
          addListener: jest.fn()
        },
        onClosed: {
          addListener: jest.fn()
        }
      },
      
      alarms: {
        create: jest.fn(),
        clear: jest.fn(),
        get: jest.fn(),
        getAll: jest.fn(),
        onAlarm: {
          addListener: jest.fn()
        }
      },
      
      permissions: {
        contains: jest.fn(() => Promise.resolve(true)),
        request: jest.fn(() => Promise.resolve(true))
      }
    };
  }

  // Storage API の実装
  async storageGet(keys) {
    if (keys === null || keys === undefined) {
      const result = {};
      this.storage.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }
    
    if (Array.isArray(keys)) {
      const result = {};
      keys.forEach(key => {
        if (this.storage.has(key)) {
          result[key] = this.storage.get(key);
        }
      });
      return result;
    }
    
    if (typeof keys === 'string') {
      return {
        [keys]: this.storage.get(keys)
      };
    }
    
    if (typeof keys === 'object') {
      const result = {};
      Object.keys(keys).forEach(key => {
        result[key] = this.storage.has(key) ? this.storage.get(key) : keys[key];
      });
      return result;
    }
    
    return {};
  }

  async storageSet(items) {
    Object.entries(items).forEach(([key, value]) => {
      this.storage.set(key, value);
    });
  }

  async storageRemove(keys) {
    if (Array.isArray(keys)) {
      keys.forEach(key => this.storage.delete(key));
    } else {
      this.storage.delete(keys);
    }
  }

  async storageClear() {
    this.storage.clear();
  }

  async getBytesInUse(keys) {
    let totalSize = 0;
    if (keys) {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(key => {
        if (this.storage.has(key)) {
          totalSize += JSON.stringify(this.storage.get(key)).length;
        }
      });
    } else {
      this.storage.forEach(value => {
        totalSize += JSON.stringify(value).length;
      });
    }
    return totalSize;
  }

  // Runtime messaging の実装
  async sendMessage(message) {
    // メッセージリスナーに送信をシミュレート
    for (const listener of this.messageListeners) {
      try {
        const response = await listener(message, {
          id: this.chrome.runtime.id,
          url: 'chrome-extension://test-extension-id/'
        });
        if (response) return response;
      } catch (error) {
        console.error('Message listener error:', error);
      }
    }
    
    // デフォルトレスポンス
    return { success: true, timestamp: Date.now() };
  }

  addMessageListener(listener) {
    this.messageListeners.push(listener);
  }

  removeMessageListener(listener) {
    const index = this.messageListeners.indexOf(listener);
    if (index > -1) {
      this.messageListeners.splice(index, 1);
    }
  }

  // Tabs API の実装
  async tabsQuery(queryInfo) {
    const mockTabs = [
      {
        id: 1,
        url: 'https://example.com',
        title: 'Example Site',
        active: true,
        windowId: 1
      },
      {
        id: 2,
        url: 'https://test.com',
        title: 'Test Site',
        active: false,
        windowId: 1
      }
    ];

    let filteredTabs = mockTabs;

    if (queryInfo.active !== undefined) {
      filteredTabs = filteredTabs.filter(tab => tab.active === queryInfo.active);
    }
    
    if (queryInfo.currentWindow !== undefined) {
      // すべてのタブが同じウィンドウにあると仮定
      filteredTabs = filteredTabs;
    }

    return filteredTabs;
  }

  async tabsSendMessage(tabId, message) {
    // タブメッセージの送信をシミュレート
    return { success: true, tabId, message };
  }

  // Notifications API の実装
  async createNotification(notificationId, options) {
    return notificationId || `notification-${Date.now()}`;
  }

  // ヘルパーメソッド
  reset() {
    this.storage.clear();
    this.messageListeners = [];
    this.tabListeners = [];
    this.alarmListeners = [];
    jest.clearAllMocks();
  }

  getStorageData() {
    const data = {};
    this.storage.forEach((value, key) => {
      data[key] = value;
    });
    return data;
  }

  setStorageData(data) {
    Object.entries(data).forEach(([key, value]) => {
      this.storage.set(key, value);
    });
  }
}

/**
 * DOM環境のモック
 */
class DOMEnvironmentMock {
  constructor() {
    this.elements = new Map();
    this.eventListeners = new Map();
    this.setupMocks();
  }

  setupMocks() {
    this.document = {
      createElement: jest.fn(this.createElement.bind(this)),
      getElementById: jest.fn(this.getElementById.bind(this)),
      querySelector: jest.fn(this.querySelector.bind(this)),
      querySelectorAll: jest.fn(this.querySelectorAll.bind(this)),
      addEventListener: jest.fn(this.addEventListener.bind(this)),
      removeEventListener: jest.fn(this.removeEventListener.bind(this)),
      body: {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        style: {},
        children: []
      },
      head: {
        appendChild: jest.fn(),
        children: []
      }
    };

    this.window = {
      location: {
        href: 'https://example.com',
        hostname: 'example.com',
        protocol: 'https:',
        pathname: '/',
        search: '',
        hash: ''
      },
      getComputedStyle: jest.fn(this.getComputedStyle.bind(this)),
      MutationObserver: jest.fn(this.createMutationObserver.bind(this)),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      setTimeout: jest.fn((callback, delay) => {
        return setTimeout(callback, delay);
      }),
      clearTimeout: jest.fn(clearTimeout),
      performance: {
        now: jest.fn(() => Date.now()),
        mark: jest.fn(),
        measure: jest.fn()
      }
    };
  }

  createElement(tagName) {
    const element = {
      tagName: tagName.toUpperCase(),
      id: '',
      className: '',
      innerHTML: '',
      textContent: '',
      style: {},
      attributes: new Map(),
      children: [],
      parentNode: null,
      
      getAttribute: jest.fn((name) => element.attributes.get(name) || null),
      setAttribute: jest.fn((name, value) => element.attributes.set(name, value)),
      removeAttribute: jest.fn((name) => element.attributes.delete(name)),
      appendChild: jest.fn((child) => {
        element.children.push(child);
        child.parentNode = element;
      }),
      removeChild: jest.fn((child) => {
        const index = element.children.indexOf(child);
        if (index > -1) {
          element.children.splice(index, 1);
          child.parentNode = null;
        }
      }),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      getBoundingClientRect: jest.fn(() => ({
        width: 100,
        height: 100,
        top: 0,
        left: 0,
        right: 100,
        bottom: 100
      }))
    };

    return element;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  querySelector(selector) {
    // 簡単なセレクター実装
    if (selector.startsWith('#')) {
      return this.getElementById(selector.substring(1));
    }
    
    if (selector.startsWith('.')) {
      const className = selector.substring(1);
      for (const element of this.elements.values()) {
        if (element.className === className) {
          return element;
        }
      }
    }
    
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    
    if (selector.startsWith('.')) {
      const className = selector.substring(1);
      for (const element of this.elements.values()) {
        if (element.className === className) {
          results.push(element);
        }
      }
    }
    
    return results;
  }

  getComputedStyle(element) {
    return element.style || {};
  }

  createMutationObserver(callback) {
    return {
      observe: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: jest.fn(() => [])
    };
  }

  addEventListener(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(listener);
  }

  removeEventListener(event, listener) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // ヘルパーメソッド
  addElement(id, element) {
    element.id = id;
    this.elements.set(id, element);
  }

  removeElement(id) {
    this.elements.delete(id);
  }

  reset() {
    this.elements.clear();
    this.eventListeners.clear();
    jest.clearAllMocks();
  }

  createPopupElement(options = {}) {
    const popup = this.createElement('div');
    popup.id = options.id || 'test-popup';
    popup.className = options.className || 'popup-modal';
    popup.style = {
      position: options.position || 'fixed',
      zIndex: options.zIndex || '9999',
      width: options.width || '400px',
      height: options.height || '300px',
      top: options.top || '50%',
      left: options.left || '50%',
      backgroundColor: options.backgroundColor || 'white',
      ...options.style
    };
    popup.innerHTML = options.innerHTML || '<div>ポップアップコンテンツ</div>';
    
    this.addElement(popup.id, popup);
    return popup;
  }
}

/**
 * パフォーマンス測定ユーティリティ
 */
class PerformanceMeasurement {
  constructor() {
    this.measurements = new Map();
    this.markers = new Map();
  }

  start(name) {
    this.markers.set(name, {
      startTime: performance.now(),
      startMemory: this.getMemoryUsage()
    });
  }

  end(name) {
    const marker = this.markers.get(name);
    if (!marker) {
      throw new Error(`No measurement started for: ${name}`);
    }

    const endTime = performance.now();
    const endMemory = this.getMemoryUsage();
    
    const measurement = {
      name,
      duration: endTime - marker.startTime,
      memoryDelta: endMemory.used - marker.startMemory.used,
      startTime: marker.startTime,
      endTime,
      startMemory: marker.startMemory,
      endMemory
    };

    this.measurements.set(name, measurement);
    this.markers.delete(name);
    
    return measurement;
  }

  getMeasurement(name) {
    return this.measurements.get(name);
  }

  getAllMeasurements() {
    return Array.from(this.measurements.values());
  }

  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      used: Math.round(usage.heapUsed / 1024 / 1024), // MB
      total: Math.round(usage.heapTotal / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024) // MB
    };
  }

  reset() {
    this.measurements.clear();
    this.markers.clear();
  }

  generateReport() {
    const measurements = this.getAllMeasurements();
    
    return {
      totalMeasurements: measurements.length,
      averageDuration: measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length,
      totalMemoryDelta: measurements.reduce((sum, m) => sum + m.memoryDelta, 0),
      measurements: measurements.sort((a, b) => b.duration - a.duration)
    };
  }
}

/**
 * テストデータジェネレーター
 */
class TestDataGenerator {
  static generatePopupData(count = 1, options = {}) {
    const popups = [];
    
    for (let i = 0; i < count; i++) {
      popups.push({
        id: options.idPrefix ? `${options.idPrefix}-${i}` : `popup-${i}`,
        url: options.url || `https://example${i}.com`,
        domain: options.domain || `example${i}.com`,
        timestamp: Date.now() - (i * 1000),
        characteristics: {
          hasCloseButton: options.hasCloseButton !== undefined ? options.hasCloseButton : Math.random() > 0.3,
          containsAds: options.containsAds !== undefined ? options.containsAds : Math.random() > 0.5,
          hasExternalLinks: options.hasExternalLinks !== undefined ? options.hasExternalLinks : Math.random() > 0.6,
          isModal: options.isModal !== undefined ? options.isModal : Math.random() > 0.4,
          zIndex: options.zIndex || Math.floor(Math.random() * 10000) + 1000,
          dimensions: {
            width: options.width || Math.floor(Math.random() * 400) + 200,
            height: options.height || Math.floor(Math.random() * 300) + 150
          }
        },
        userDecision: options.userDecision || (Math.random() > 0.5 ? 'close' : 'keep'),
        confidence: options.confidence !== undefined ? options.confidence : Math.random() * 0.5 + 0.5
      });
    }
    
    return count === 1 ? popups[0] : popups;
  }

  static generateLearningPatterns(count = 1) {
    const patterns = [];
    
    for (let i = 0; i < count; i++) {
      patterns.push({
        patternId: `pattern-${i}`,
        characteristics: {
          className: `popup-class-${i}`,
          hasCloseButton: Math.random() > 0.3,
          containsAds: Math.random() > 0.5,
          zIndexRange: [9000 + i * 100, 10000 + i * 100]
        },
        userDecision: Math.random() > 0.5 ? 'close' : 'keep',
        confidence: Math.random() * 0.5 + 0.5,
        occurrences: Math.floor(Math.random() * 50) + 1,
        lastSeen: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)
      });
    }
    
    return count === 1 ? patterns[0] : patterns;
  }

  static generateUserSettings(overrides = {}) {
    return {
      extensionEnabled: true,
      showNotifications: true,
      notificationDuration: 3000,
      whitelistedDomains: ['trusted-site.com', 'important-site.org'],
      learningEnabled: true,
      aggressiveMode: false,
      statistics: {
        totalPopupsDetected: 150,
        totalPopupsClosed: 120,
        totalPopupsKept: 30,
        lastResetDate: Date.now() - (7 * 24 * 60 * 60 * 1000)
      },
      ...overrides
    };
  }
}

/**
 * 統合テスト用のセットアップヘルパー
 */
class IntegrationTestSetup {
  constructor() {
    this.chromeMock = new ChromeAPIMock();
    this.domMock = new DOMEnvironmentMock();
    this.performance = new PerformanceMeasurement();
  }

  setup() {
    // グローバルオブジェクトを設定
    global.chrome = this.chromeMock.chrome;
    global.document = this.domMock.document;
    global.window = this.domMock.window;
    
    // Jest環境の設定
    jest.clearAllMocks();
  }

  teardown() {
    this.chromeMock.reset();
    this.domMock.reset();
    this.performance.reset();
    
    // グローバルオブジェクトをクリア
    delete global.chrome;
    delete global.document;
    delete global.window;
  }

  // 便利なヘルパーメソッド
  async waitFor(condition, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  async simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = {
  ChromeAPIMock,
  DOMEnvironmentMock,
  PerformanceMeasurement,
  TestDataGenerator,
  IntegrationTestSetup
};