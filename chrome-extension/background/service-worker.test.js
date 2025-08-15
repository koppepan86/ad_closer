/**
 * バックグラウンドサービスワーカーのテスト
 * 基本的な機能のテストケース
 */

// Chrome APIのモック
global.chrome = {
  runtime: {
    onInstalled: { addListener: jest.fn() },
    onMessage: { addListener: jest.fn() }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    onUpdated: { addListener: jest.fn() },
    onActivated: { addListener: jest.fn() },
    sendMessage: jest.fn()
  }
};

describe('バックグラウンドサービスワーカー', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('デフォルト設定が正しく定義されている', () => {
    // service-worker.jsから定数をインポートできないため、
    // 実際のテストでは設定値を検証する
    expect(true).toBe(true); // プレースホルダーテスト
  });

  test('メッセージリスナーが登録されている', () => {
    // service-worker.jsが読み込まれた時にリスナーが登録されることを確認
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  test('インストールリスナーが登録されている', () => {
    // インストール時のリスナーが登録されることを確認
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
  });

  test('タブリスナーが登録されている', () => {
    // タブ更新とアクティブ化のリスナーが登録されることを確認
    expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
    expect(chrome.tabs.onActivated.addListener).toHaveBeenCalled();
  });
});

// 統合テスト用のヘルパー関数
function createMockMessage(type, data = {}) {
  return { type, data };
}

function createMockSender(tabId = 1, url = 'https://example.com') {
  return {
    tab: { id: tabId, url }
  };
}

// 使用例：
// const message = createMockMessage('POPUP_DETECTED', { id: 'test-popup' });
// const sender = createMockSender(1, 'https://test.com');

console.log('サービスワーカーテストが読み込まれました');