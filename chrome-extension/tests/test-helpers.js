/**
 * 共通テストヘルパー関数
 * Task 9.1: ユニットテストの作成 - 共通テストユーティリティ
 */

/**
 * モック要素を作成するヘルパー関数
 * @param {string} tagName - HTML要素のタグ名
 * @param {Object} properties - 要素のプロパティ
 * @returns {Object} モック要素オブジェクト
 */
function createMockElement(tagName = 'div', properties = {}) {
  const element = {
    tagName: tagName.toUpperCase(),
    id: properties.id || '',
    className: properties.className || '',
    textContent: properties.textContent || '',
    innerHTML: properties.innerHTML || '',
    value: properties.value || '',
    checked: properties.checked || false,
    disabled: properties.disabled || false,
    type: properties.type || '',
    href: properties.href || '',
    src: properties.src || '',
    alt: properties.alt || '',
    offsetWidth: properties.offsetWidth || 100,
    offsetHeight: properties.offsetHeight || 100,
    
    // DOM操作メソッド
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    click: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    insertBefore: jest.fn(),
    contains: jest.fn((child) => element.children.includes(child)),
    
    // クエリメソッド
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    getElementById: jest.fn(),
    
    // 属性操作
    getAttribute: jest.fn((attr) => element[attr] || null),
    setAttribute: jest.fn((attr, value) => { element[attr] = value; }),
    removeAttribute: jest.fn((attr) => { delete element[attr]; }),
    hasAttribute: jest.fn((attr) => element.hasOwnProperty(attr)),
    
    // CSS操作
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(),
      toggle: jest.fn()
    },
    
    style: {},
    dataset: properties.dataset || {},
    
    // 位置・サイズ情報
    getBoundingClientRect: jest.fn(() => ({
      width: properties.width || 100,
      height: properties.height || 100,
      top: properties.top || 0,
      left: properties.left || 0,
      right: (properties.left || 0) + (properties.width || 100),
      bottom: (properties.top || 0) + (properties.height || 100)
    })),
    
    // 子要素
    children: properties.children || [],
    childNodes: properties.childNodes || [],
    parentNode: properties.parentNode || null,
    
    // 親要素検索
    closest: jest.fn(),
    
    // その他のプロパティ
    ...properties
  };

  // イベントリスナーの実際の動作をシミュレート
  element.addEventListener.mockImplementation((event, handler) => {
    element[`${event}Handler`] = handler;
  });

  // appendChild の動作をシミュレート
  element.appendChild.mockImplementation((child) => {
    element.children.push(child);
    child.parentNode = element;
  });

  // removeChild の動作をシミュレート
  element.removeChild.mockImplementation((child) => {
    const index = element.children.indexOf(child);
    if (index > -1) {
      element.children.splice(index, 1);
      child.parentNode = null;
    }
  });

  return element;
}

/**
 * Chrome APIのモックを作成
 * @returns {Object} Chrome APIモック
 */
function createChromeApiMock() {
  const mockStorage = {
    data: {},
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn()
  };

  // ストレージモックの実装
  mockStorage.get.mockImplementation((keys) => {
    const result = {};
    
    if (!keys) {
      // keysがnullまたはundefinedの場合、すべてのデータを返す
      return Promise.resolve({ ...mockStorage.data });
    }
    
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        result[key] = mockStorage.data[key];
      });
    } else if (typeof keys === 'string') {
      result[keys] = mockStorage.data[keys];
    } else if (typeof keys === 'object' && keys !== null) {
      Object.keys(keys).forEach(key => {
        result[key] = mockStorage.data[key] || keys[key];
      });
    }
    return Promise.resolve(result);
  });

  mockStorage.set.mockImplementation((data) => {
    Object.assign(mockStorage.data, data);
    return Promise.resolve();
  });

  mockStorage.remove.mockImplementation((keys) => {
    if (Array.isArray(keys)) {
      keys.forEach(key => delete mockStorage.data[key]);
    } else {
      delete mockStorage.data[keys];
    }
    return Promise.resolve();
  });

  mockStorage.clear.mockImplementation(() => {
    mockStorage.data = {};
    return Promise.resolve();
  });

  return {
    runtime: {
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      },
      onInstalled: {
        addListener: jest.fn()
      },
      onStartup: {
        addListener: jest.fn()
      },
      getURL: jest.fn((path) => `chrome-extension://test-id/${path}`),
      openOptionsPage: jest.fn(),
      lastError: null
    },
    storage: {
      local: mockStorage,
      sync: { ...mockStorage }
    },
    tabs: {
      query: jest.fn(),
      sendMessage: jest.fn(),
      create: jest.fn(),
      onUpdated: {
        addListener: jest.fn()
      },
      onActivated: {
        addListener: jest.fn()
      }
    },
    notifications: {
      create: jest.fn(),
      clear: jest.fn()
    }
  };
}

/**
 * テスト用のポップアップデータを生成
 * @param {Object} overrides - デフォルト値を上書きするプロパティ
 * @returns {Object} ポップアップデータ
 */
function createMockPopupData(overrides = {}) {
  const now = Date.now();
  return {
    id: 'popup_test_' + now,
    url: 'https://example.com/page',
    domain: 'example.com',
    timestamp: now,
    decisionTimestamp: now, // 必須フィールドを追加
    characteristics: {
      hasCloseButton: true,
      containsAds: true,
      hasExternalLinks: false,
      isModal: true,
      zIndex: 9999,
      dimensions: { width: 400, height: 300 }
    },
    userDecision: 'close', // デフォルトを有効な値に変更
    confidence: 0.8,
    ...overrides
  };
}

/**
 * テスト用のユーザー設定を生成
 * @param {Object} overrides - デフォルト値を上書きするプロパティ
 * @returns {Object} ユーザー設定
 */
function createMockUserPreferences(overrides = {}) {
  return {
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
    },
    ...overrides
  };
}

/**
 * テスト用の学習パターンを生成
 * @param {Object} overrides - デフォルト値を上書きするプロパティ
 * @returns {Object} 学習パターン
 */
function createMockLearningPattern(overrides = {}) {
  return {
    patternId: 'pattern_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    characteristics: {
      hasCloseButton: true,
      containsAds: true,
      hasExternalLinks: false,
      isModal: true,
      zIndex: 9999,
      dimensions: { width: 400, height: 300 }
    },
    userDecision: 'close',
    confidence: 0.8,
    occurrences: 1,
    lastSeen: Date.now(),
    domain: 'example.com',
    ...overrides
  };
}

/**
 * 非同期関数のテストヘルパー
 * @param {Function} asyncFn - テストする非同期関数
 * @param {number} timeout - タイムアウト時間（ミリ秒）
 * @returns {Promise} プロミス
 */
function waitForAsync(asyncFn, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Async function timed out after ${timeout}ms`));
    }, timeout);

    asyncFn()
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * DOM変更を監視するテストヘルパー
 * @param {Function} callback - DOM変更時に呼ばれるコールバック
 * @returns {Object} MutationObserverモック
 */
function createMockMutationObserver(callback) {
  const observer = {
    observe: jest.fn(),
    disconnect: jest.fn(),
    takeRecords: jest.fn(() => [])
  };

  // MutationObserverのモック
  global.MutationObserver = jest.fn().mockImplementation(() => observer);

  return observer;
}

/**
 * パフォーマンステスト用のヘルパー
 * @param {Function} testFn - テストする関数
 * @param {number} maxDuration - 最大実行時間（ミリ秒）
 * @returns {Promise<number>} 実行時間
 */
async function measurePerformance(testFn, maxDuration = 1000) {
  const startTime = Date.now();
  
  await testFn();
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  if (duration > maxDuration) {
    throw new Error(`Performance test failed: ${duration}ms > ${maxDuration}ms`);
  }
  
  return duration;
}

/**
 * エラーハンドリングテスト用のヘルパー
 * @param {Function} errorFn - エラーを発生させる関数
 * @param {string|RegExp} expectedError - 期待されるエラーメッセージ
 * @returns {Promise} プロミス
 */
async function expectError(errorFn, expectedError) {
  try {
    await errorFn();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    if (typeof expectedError === 'string') {
      expect(error.message).toContain(expectedError);
    } else if (expectedError instanceof RegExp) {
      expect(error.message).toMatch(expectedError);
    } else {
      expect(error).toBeInstanceOf(expectedError);
    }
  }
}

/**
 * テストデータをリセットするヘルパー
 */
function resetTestData() {
  // Jest モックをクリア
  jest.clearAllMocks();
  
  // Chrome API モックをリセット
  if (global.chrome && global.chrome.storage && global.chrome.storage.local) {
    global.chrome.storage.local.data = {};
  }
  
  // DOM要素をクリア（JSDOMと互換性のある方法で）
  if (global.document && global.document.body) {
    global.document.body.innerHTML = '';
  }
}

/**
 * テスト用のタイマーヘルパー
 */
const TimerHelpers = {
  /**
   * setTimeoutのモック
   */
  mockSetTimeout() {
    jest.useFakeTimers();
  },

  /**
   * タイマーを進める
   * @param {number} ms - 進める時間（ミリ秒）
   */
  advanceTimers(ms) {
    jest.advanceTimersByTime(ms);
  },

  /**
   * すべてのタイマーを実行
   */
  runAllTimers() {
    jest.runAllTimers();
  },

  /**
   * リアルタイマーに戻す
   */
  useRealTimers() {
    jest.useRealTimers();
  }
};

module.exports = {
  createMockElement,
  createChromeApiMock,
  createMockPopupData,
  createMockUserPreferences,
  createMockLearningPattern,
  waitForAsync,
  createMockMutationObserver,
  measurePerformance,
  expectError,
  resetTestData,
  TimerHelpers
};