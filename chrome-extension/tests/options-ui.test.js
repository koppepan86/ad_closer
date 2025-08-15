/**
 * 設定ページのインタラクションテスト
 * Task 9.1.5: UIコンポーネントのテスト - 設定ページUI部分
 */

const { 
  createMockElement,
  createMockUserPreferences,
  createChromeApiMock,
  resetTestData,
  TimerHelpers
} = require('./test-helpers');

describe('設定ページのインタラクションテスト', () => {
  let mockChrome;
  let mockDocument;
  let mockWindow;
  let optionsUI;

  beforeEach(() => {
    resetTestData();
    TimerHelpers.mockSetTimeout();
    
    // Chrome API モックを設定
    mockChrome = createChromeApiMock();
    global.chrome = mockChrome;
    
    // DOM環境をモック
    mockDocument = {
      getElementById: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(),
      createElement: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      body: createMockElement('body'),
      head: createMockElement('head')
    };
    
    mockWindow = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      location: { href: 'chrome-extension://test/options.html' },
      innerWidth: 800,
      innerHeight: 600
    };
    
    global.document = mockDocument;
    global.window = mockWindow;

    optionsUI = new OptionsUI();
  });

  afterEach(() => {
    TimerHelpers.useRealTimers();
  });

  /**
   * 設定ページUIクラス
   * 包括的な設定管理とホワイトリスト管理を提供
   */
  class OptionsUI {
    constructor() {
      this.elements = {};
      this.preferences = null;
      this.isInitialized = false;
    }

    /**
     * 設定UIを初期化
     */
    async init() {
      try {
        this.setupElements();
        this.setupEventListeners();
        await this.loadPreferences();
        this.render();
        this.isInitialized = true;
      } catch (error) {
        console.error('設定UI初期化エラー:', error);
        throw error;
      }
    }

    /**
     * DOM要素を設定
     */
    setupElements() {
      this.elements = {
        extensionEnabledCheckbox: createMockElement('input', { 
          type: 'checkbox', 
          id: 'extension-enabled' 
        }),
        showNotificationsCheckbox: createMockElement('input', { 
          type: 'checkbox', 
          id: 'show-notifications' 
        }),
        notificationDurationSlider: createMockElement('input', { 
          type: 'range', 
          id: 'notification-duration',
          min: '1000',
          max: '10000',
          step: '500'
        }),
        aggressiveModeCheckbox: createMockElement('input', { 
          type: 'checkbox', 
          id: 'aggressive-mode' 
        }),
        whitelistInput: createMockElement('input', { 
          type: 'text', 
          id: 'whitelist-input',
          placeholder: 'example.com'
        }),
        addWhitelistButton: createMockElement('button', { 
          id: 'add-whitelist',
          textContent: '追加'
        }),
        whitelistContainer: createMockElement('div', { 
          id: 'whitelist-container' 
        }),
        saveButton: createMockElement('button', { 
          id: 'save-settings',
          textContent: '保存'
        }),
        resetButton: createMockElement('button', { 
          id: 'reset-settings',
          textContent: 'リセット'
        }),
        exportButton: createMockElement('button', { 
          id: 'export-settings',
          textContent: 'エクスポート'
        }),
        importButton: createMockElement('button', { 
          id: 'import-settings',
          textContent: 'インポート'
        }),
        importFileInput: createMockElement('input', { 
          type: 'file', 
          id: 'import-file',
          accept: '.json'
        })
      };

      mockDocument.getElementById.mockImplementation((id) => {
        return Object.values(this.elements).find(el => el.id === id) || null;
      });
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
      this.elements.addWhitelistButton.addEventListener('click', () => {
        this.addWhitelistDomain();
      });

      this.elements.saveButton.addEventListener('click', () => {
        this.saveSettings();
      });

      this.elements.resetButton.addEventListener('click', () => {
        this.resetSettings();
      });

      this.elements.exportButton.addEventListener('click', () => {
        this.exportSettings();
      });

      this.elements.importButton.addEventListener('click', () => {
        this.elements.importFileInput.click();
      });

      this.elements.importFileInput.addEventListener('change', (e) => {
        this.importSettings(e.target.files[0]);
      });
    }

    /**
     * 設定を読み込み
     */
    async loadPreferences() {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_USER_PREFERENCES'
        });

        if (response.success) {
          this.preferences = response.data;
        } else {
          this.preferences = createMockUserPreferences();
        }
      } catch (error) {
        console.error('設定読み込みエラー:', error);
        this.preferences = createMockUserPreferences();
      }
    }

    /**
     * UIをレンダリング
     */
    render() {
      // チェックボックスの状態を設定
      this.elements.extensionEnabledCheckbox.checked = this.preferences.extensionEnabled;
      this.elements.showNotificationsCheckbox.checked = this.preferences.showNotifications;
      this.elements.aggressiveModeCheckbox.checked = this.preferences.aggressiveMode;

      // スライダーの値を設定
      this.elements.notificationDurationSlider.value = this.preferences.notificationDuration.toString();

      // ホワイトリストを表示
      this.renderWhitelist();
    }

    /**
     * ホワイトリストを表示
     */
    renderWhitelist() {
      this.elements.whitelistContainer.innerHTML = '';

      this.preferences.whitelistedDomains.forEach(domain => {
        const domainElement = createMockElement('div', {
          className: 'whitelist-item',
          innerHTML: `
            <span class="domain-name">${domain}</span>
            <button class="remove-domain" data-domain="${domain}">削除</button>
          `
        });

        // 削除ボタンのイベントリスナー
        const removeButton = domainElement.querySelector('.remove-domain');
        if (removeButton) {
          removeButton.addEventListener('click', () => {
            this.removeWhitelistDomain(domain);
          });
        }

        this.elements.whitelistContainer.appendChild(domainElement);
      });
    }

    /**
     * ホワイトリストドメインを追加
     */
    addWhitelistDomain() {
      const domain = this.elements.whitelistInput.value.trim();
      
      if (!domain) {
        this.showMessage('ドメインを入力してください', 'error');
        return;
      }

      if (this.preferences.whitelistedDomains.includes(domain)) {
        this.showMessage('このドメインは既に追加されています', 'warning');
        return;
      }

      // ドメインの形式を検証
      if (!this.isValidDomain(domain)) {
        this.showMessage('無効なドメイン形式です', 'error');
        return;
      }

      this.preferences.whitelistedDomains.push(domain);
      this.elements.whitelistInput.value = '';
      this.renderWhitelist();
      this.showMessage('ドメインを追加しました', 'success');
    }

    /**
     * ホワイトリストドメインを削除
     */
    removeWhitelistDomain(domain) {
      this.preferences.whitelistedDomains = this.preferences.whitelistedDomains.filter(d => d !== domain);
      this.renderWhitelist();
      this.showMessage('ドメインを削除しました', 'success');
    }

    /**
     * ドメインの形式を検証
     */
    isValidDomain(domain) {
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.?[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$/;
      return domainRegex.test(domain);
    }

    /**
     * 設定を保存
     */
    async saveSettings() {
      try {
        const newPreferences = {
          extensionEnabled: this.elements.extensionEnabledCheckbox.checked,
          showNotifications: this.elements.showNotificationsCheckbox.checked,
          notificationDuration: parseInt(this.elements.notificationDurationSlider.value),
          aggressiveMode: this.elements.aggressiveModeCheckbox.checked,
          whitelistedDomains: this.preferences.whitelistedDomains
        };

        const response = await chrome.runtime.sendMessage({
          type: 'UPDATE_USER_PREFERENCES',
          data: newPreferences
        });

        if (response.success) {
          this.preferences = { ...this.preferences, ...newPreferences };
          this.showMessage('設定を保存しました', 'success');
        } else {
          throw new Error('設定の保存に失敗しました');
        }
      } catch (error) {
        console.error('設定保存エラー:', error);
        this.showMessage('設定の保存に失敗しました', 'error');
      }
    }

    /**
     * 設定をリセット
     */
    async resetSettings() {
      if (!confirm('設定をリセットしますか？この操作は元に戻せません。')) {
        return;
      }

      try {
        const defaultPreferences = createMockUserPreferences();
        
        const response = await chrome.runtime.sendMessage({
          type: 'UPDATE_USER_PREFERENCES',
          data: defaultPreferences
        });

        if (response.success) {
          this.preferences = defaultPreferences;
          this.render();
          this.showMessage('設定をリセットしました', 'success');
        }
      } catch (error) {
        console.error('設定リセットエラー:', error);
        this.showMessage('設定のリセットに失敗しました', 'error');
      }
    }

    /**
     * 設定をエクスポート
     */
    exportSettings() {
      try {
        const exportData = {
          version: '1.0',
          timestamp: Date.now(),
          preferences: this.preferences
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // ダウンロードリンクを作成（実際の実装）
        const downloadLink = createMockElement('a', {
          href: url,
          download: `popup-blocker-settings-${new Date().toISOString().split('T')[0]}.json`
        });

        downloadLink.click();
        this.showMessage('設定をエクスポートしました', 'success');
      } catch (error) {
        console.error('エクスポートエラー:', error);
        this.showMessage('エクスポートに失敗しました', 'error');
      }
    }

    /**
     * 設定をインポート
     */
    async importSettings(file) {
      if (!file) return;

      try {
        const text = await this.readFileAsText(file);
        const importData = JSON.parse(text);

        // インポートデータの検証
        if (!this.validateImportData(importData)) {
          throw new Error('無効なインポートデータです');
        }

        const response = await chrome.runtime.sendMessage({
          type: 'UPDATE_USER_PREFERENCES',
          data: importData.preferences
        });

        if (response.success) {
          this.preferences = importData.preferences;
          this.render();
          this.showMessage('設定をインポートしました', 'success');
        }
      } catch (error) {
        console.error('インポートエラー:', error);
        this.showMessage('インポートに失敗しました', 'error');
      }
    }

    /**
     * ファイルをテキストとして読み込み
     */
    readFileAsText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });
    }

    /**
     * インポートデータを検証
     */
    validateImportData(data) {
      return data && 
             data.version && 
             data.preferences && 
             typeof data.preferences === 'object';
    }

    /**
     * メッセージを表示
     */
    showMessage(message, type = 'info') {
      console.log(`${type.toUpperCase()}: ${message}`);
      // 実際の実装では通知UIを表示
    }
  }

  test('設定UIの初期化', async () => {
    mockChrome.runtime.sendMessage.mockResolvedValue({
      success: true,
      data: createMockUserPreferences()
    });

    await optionsUI.init();

    expect(optionsUI.isInitialized).toBe(true);
    expect(optionsUI.preferences).toBeDefined();
  });

  test('設定値の表示', async () => {
    const mockPrefs = createMockUserPreferences({
      extensionEnabled: false,
      showNotifications: false,
      notificationDuration: 3000,
      aggressiveMode: true
    });

    mockChrome.runtime.sendMessage.mockResolvedValue({
      success: true,
      data: mockPrefs
    });

    await optionsUI.init();

    expect(optionsUI.elements.extensionEnabledCheckbox.checked).toBe(false);
    expect(optionsUI.elements.showNotificationsCheckbox.checked).toBe(false);
    expect(optionsUI.elements.notificationDurationSlider.value).toBe('3000');
    expect(optionsUI.elements.aggressiveModeCheckbox.checked).toBe(true);
  });

  test('ホワイトリストドメインの追加', async () => {
    await optionsUI.init();

    optionsUI.elements.whitelistInput.value = 'example.com';
    optionsUI.addWhitelistDomain();

    expect(optionsUI.preferences.whitelistedDomains).toContain('example.com');
  });

  test('無効なドメインの検証', async () => {
    await optionsUI.init();

    optionsUI.elements.whitelistInput.value = 'invalid..domain';
    optionsUI.addWhitelistDomain();

    expect(optionsUI.preferences.whitelistedDomains).not.toContain('invalid..domain');
  });

  test('設定の保存', async () => {
    await optionsUI.init();

    optionsUI.elements.extensionEnabledCheckbox.checked = false;
    optionsUI.elements.notificationDurationSlider.value = '7000';

    mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

    await optionsUI.saveSettings();

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'UPDATE_USER_PREFERENCES',
      data: expect.objectContaining({
        extensionEnabled: false,
        notificationDuration: 7000
      })
    });
  });

  test('設定のリセット', async () => {
    await optionsUI.init();

    // confirmをモック
    global.confirm = jest.fn().mockReturnValue(true);
    mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

    await optionsUI.resetSettings();

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'UPDATE_USER_PREFERENCES',
      data: expect.objectContaining({
        extensionEnabled: true,
        whitelistedDomains: []
      })
    });
  });

  test('設定のエクスポート', async () => {
    await optionsUI.init();

    // Blobとオブジェクト作成をモック
    global.Blob = jest.fn().mockImplementation((content, options) => ({
      content,
      options
    }));
    global.URL = {
      createObjectURL: jest.fn().mockReturnValue('blob:url')
    };

    optionsUI.exportSettings();

    expect(global.Blob).toHaveBeenCalledWith(
      [expect.stringContaining('"preferences"')],
      { type: 'application/json' }
    );
  });

  test('設定のインポート', async () => {
    await optionsUI.init();

    const mockFile = new File(['{"version":"1.0","preferences":{"extensionEnabled":false}}'], 'settings.json');
    
    // FileReaderをモック
    global.FileReader = jest.fn().mockImplementation(() => ({
      readAsText: jest.fn(),
      onload: null,
      onerror: null,
      result: '{"version":"1.0","preferences":{"extensionEnabled":false}}'
    }));

    mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

    // FileReaderの動作をシミュレート
    const mockReader = new FileReader();
    global.FileReader.mockReturnValue(mockReader);

    // importSettingsを呼び出し、FileReaderのonloadを手動で実行
    const importPromise = optionsUI.importSettings(mockFile);
    
    // onloadイベントをシミュレート
    setTimeout(() => {
      if (mockReader.onload) {
        mockReader.onload({ target: { result: mockReader.result } });
      }
    }, 0);

    await importPromise;

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'UPDATE_USER_PREFERENCES',
      data: { extensionEnabled: false }
    });
  });
});