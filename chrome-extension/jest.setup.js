/**
 * Jest セットアップファイル
 * Chrome拡張機能APIのモックを設定
 */

// Chrome API のモック
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    },
    onActivated: {
      addListener: jest.fn()
    }
  }
};

// DOM環境のセットアップ - location オブジェクトのモック
delete window.location;
window.location = {
  href: 'https://example.com',
  hostname: 'example.com',
  protocol: 'https:',
  host: 'example.com',
  pathname: '/',
  search: '',
  hash: '',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn()
};

// Performance API のモック
if (!window.performance) {
  window.performance = {
    timing: {
      loadEventEnd: Date.now()
    }
  };
}

// Console のモック（テスト出力をクリーンに保つため）
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// URL constructor のモック
global.URL = global.URL || class URL {
  constructor(url) {
    this.href = url;
    this.hostname = url.replace(/^https?:\/\//, '').split('/')[0];
    this.protocol = url.startsWith('https') ? 'https:' : 'http:';
  }
};

// FileReader のモック
global.FileReader = class FileReader {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }
  
  readAsText(file) {
    setTimeout(() => {
      if (this.onload) {
        this.result = file.content || '{}';
        this.onload({ target: { result: this.result } });
      }
    }, 0);
  }
};

// Blob のモック
global.Blob = class Blob {
  constructor(content, options) {
    this.content = content;
    this.options = options;
  }
};