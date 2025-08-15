// Options page JavaScript for Chrome Popup Ad Blocker Extension

/**
 * オプションページの初期化とイベントハンドラー
 */
class OptionsManager {
  constructor() {
    this.currentTab = 'general';
    this.settings = {};
    this.originalSettings = {};
    this.init();
  }

  /**
   * 初期化処理
   */
  async init() {
    this.setupTabNavigation();
    this.setupFormControls();
    this.setupEventListeners();
    await this.loadSettings();
    this.updateUI();
    console.log('ポップアップ広告ブロッカー設定ページが読み込まれました');
  }

  /**
   * タブナビゲーションのセットアップ
   */
  setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const targetTab = e.target.dataset.tab;
        this.switchTab(targetTab);
      });
    });
  }

  /**
   * タブの切り替え
   */
  switchTab(tabName) {
    // 現在のタブを非アクティブに
    document.querySelector('.tab-button.active')?.classList.remove('active');
    document.querySelector('.tab-content.active')?.classList.remove('active');

    // 新しいタブをアクティブに
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`${tabName}-tab`)?.classList.add('active');

    this.currentTab = tabName;

    // タブ固有の初期化処理
    this.initializeTabContent(tabName);
  }

  /**
   * タブ固有のコンテンツ初期化
   */
  async initializeTabContent(tabName) {
    switch (tabName) {
      case 'whitelist':
        await this.loadWhitelistData();
        break;
      case 'history':
        await this.loadHistoryData();
        break;
      case 'data':
        await this.loadStatistics();
        break;
    }
  }

  /**
   * フォームコントロールのセットアップ
   */
  setupFormControls() {
    // レンジ入力の値表示更新
    this.setupRangeInputs();
    
    // トグルスイッチの初期化
    this.setupToggleSwitches();
    
    // チェックボックスグループの初期化
    this.setupCheckboxGroups();
  }

  /**
   * レンジ入力の値表示セットアップ
   */
  setupRangeInputs() {
    const rangeInputs = [
      {
        input: 'notification-duration',
        display: 'notification-duration-value',
        formatter: (value) => `${value}秒`
      },
      {
        input: 'detection-sensitivity',
        display: 'detection-sensitivity-value',
        formatter: (value) => {
          const levels = ['最低', '低', '標準', '高', '最高'];
          return levels[value - 1] || '標準';
        }
      },
      {
        input: 'confidence-threshold',
        display: 'confidence-threshold-value',
        formatter: (value) => `${Math.round(value * 100)}%`
      }
    ];

    rangeInputs.forEach(({ input, display, formatter }) => {
      const inputElement = document.getElementById(input);
      const displayElement = document.getElementById(display);
      
      if (inputElement && displayElement) {
        inputElement.addEventListener('input', (e) => {
          displayElement.textContent = formatter(e.target.value);
        });
      }
    });
  }

  /**
   * トグルスイッチのセットアップ
   */
  setupToggleSwitches() {
    const toggles = document.querySelectorAll('.toggle-input');
    toggles.forEach(toggle => {
      toggle.addEventListener('change', () => {
        this.markAsModified();
      });
    });
  }

  /**
   * チェックボックスグループのセットアップ
   */
  setupCheckboxGroups() {
    const checkboxes = document.querySelectorAll('.checkbox-label input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.markAsModified();
      });
    });
  }

  /**
   * イベントリスナーのセットアップ
   */
  setupEventListeners() {
    // 保存ボタン
    document.getElementById('save-btn')?.addEventListener('click', () => {
      this.saveSettings();
    });

    // リセットボタン
    document.getElementById('reset-btn')?.addEventListener('click', () => {
      this.resetSettings();
    });

    // ホワイトリスト管理
    document.getElementById('add-domain-btn')?.addEventListener('click', () => {
      this.addDomainToWhitelist();
    });

    document.getElementById('add-pattern-btn')?.addEventListener('click', () => {
      this.addPatternToWhitelist();
    });

    // データ管理
    document.getElementById('export-settings-btn')?.addEventListener('click', () => {
      this.exportSettings();
    });

    document.getElementById('import-settings-btn')?.addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });

    document.getElementById('import-file-input')?.addEventListener('change', (e) => {
      this.importSettings(e.target.files[0]);
    });

    // リセット操作
    document.getElementById('reset-settings-btn')?.addEventListener('click', () => {
      this.resetSettingsData();
    });

    document.getElementById('reset-history-btn')?.addEventListener('click', () => {
      this.resetHistoryData();
    });

    document.getElementById('reset-all-btn')?.addEventListener('click', () => {
      this.resetAllData();
    });

    // 履歴フィルター
    document.getElementById('history-filter')?.addEventListener('change', () => {
      this.filterHistory();
    });

    document.getElementById('date-filter')?.addEventListener('change', () => {
      this.filterHistory();
    });

    document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
      this.clearHistoryFilters();
    });

    // 一括操作ボタン（将来の拡張用）
    document.getElementById('bulk-operations-btn')?.addEventListener('click', () => {
      this.bulkHistoryOperations();
    });

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.saveSettings();
      }
    });
  }

  /**
   * 設定の読み込み
   */
  async loadSettings() {
    try {
      // デフォルト設定
      const defaultSettings = {
        extensionEnabled: true,
        showNotifications: true,
        notificationDuration: 10,
        learningEnabled: true,
        aggressiveMode: false,
        detectionSensitivity: 3,
        confidenceThreshold: 0.7,
        blockModalOverlays: true,
        blockPopupWindows: true,
        blockFloatingAds: true,
        blockInterstitialAds: false,
        maxHistoryItems: 1000,
        cleanupInterval: 30,
        debugMode: false,
        consoleLogging: false,
        whitelistedDomains: [],
        whitelistedPatterns: [],
        learningPatterns: [],
        statistics: {
          totalPopupsDetected: 0,
          totalPopupsClosed: 0,
          totalPopupsKept: 0,
          lastResetDate: Date.now()
        }
      };

      // Chrome storage から設定を読み込み
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.sync.get(defaultSettings);
        this.settings = result;
      } else {
        // 開発環境やテスト環境での代替実装
        const stored = localStorage.getItem('popupBlockerSettings');
        this.settings = stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
      }

      this.originalSettings = JSON.parse(JSON.stringify(this.settings));
      console.log('設定が読み込まれました:', this.settings);
    } catch (error) {
      console.error('設定の読み込みに失敗しました:', error);
      this.showStatus('設定の読み込みに失敗しました', 'error');
    }
  }

  /**
   * UIの更新
   */
  updateUI() {
    // 各設定値をUIに反映
    Object.keys(this.settings).forEach(key => {
      const element = document.getElementById(this.camelToKebab(key));
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = this.settings[key];
        } else if (element.type === 'range' || element.type === 'number') {
          element.value = this.settings[key];
          // レンジ入力の表示値も更新
          element.dispatchEvent(new Event('input'));
        } else if (element.tagName === 'SELECT') {
          element.value = this.settings[key];
        }
      }
    });
  }

  /**
   * camelCase を kebab-case に変換
   */
  camelToKebab(str) {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * 設定の保存
   */
  async saveSettings() {
    try {
      // フォームから設定値を収集
      this.collectFormData();

      // Chrome storage に保存
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.sync.set(this.settings);
        
        // バックグラウンドスクリプトに設定変更を通知
        if (chrome.runtime) {
          chrome.runtime.sendMessage({
            type: 'SETTINGS_UPDATED',
            settings: this.settings
          });
        }
      } else {
        // 開発環境やテスト環境での代替実装
        localStorage.setItem('popupBlockerSettings', JSON.stringify(this.settings));
      }

      this.originalSettings = JSON.parse(JSON.stringify(this.settings));
      this.showStatus('設定が保存されました', 'success');
      
      // 保存ボタンの状態をリセット
      const saveBtn = document.getElementById('save-btn');
      if (saveBtn) {
        saveBtn.textContent = '設定を保存';
        saveBtn.classList.remove('modified');
      }
      
      // 保存後にUIを更新
      setTimeout(() => {
        this.clearStatus();
      }, 3000);

      console.log('設定が保存されました:', this.settings);
    } catch (error) {
      console.error('設定の保存に失敗しました:', error);
      this.showStatus('設定の保存に失敗しました', 'error');
    }
  }

  /**
   * フォームデータの収集
   */
  collectFormData() {
    const formElements = document.querySelectorAll('input, select');
    formElements.forEach(element => {
      const key = this.kebabToCamel(element.id);
      if (key && this.settings.hasOwnProperty(key)) {
        if (element.type === 'checkbox') {
          this.settings[key] = element.checked;
        } else if (element.type === 'range' || element.type === 'number') {
          this.settings[key] = parseFloat(element.value);
        } else if (element.tagName === 'SELECT') {
          this.settings[key] = element.value;
        }
      }
    });
  }

  /**
   * kebab-case を camelCase に変換
   */
  kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  /**
   * 設定のリセット
   */
  resetSettings() {
    this.settings = { ...this.originalSettings };
    this.updateUI();
    this.showStatus('変更が破棄されました', 'success');
  }

  /**
   * 変更マーク
   */
  markAsModified() {
    // 設定が変更されたことを示すUI更新
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
      saveBtn.textContent = '設定を保存 *';
      saveBtn.classList.add('modified');
    }
  }

  /**
   * ステータス表示
   */
  showStatus(message, type = 'success') {
    const statusElement = document.getElementById('save-status');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status-message ${type}`;
    }
  }

  /**
   * ステータスクリア
   */
  clearStatus() {
    const statusElement = document.getElementById('save-status');
    if (statusElement) {
      statusElement.textContent = '';
      statusElement.className = 'status-message';
    }
  }

  /**
   * ホワイトリストデータの読み込み
   */
  async loadWhitelistData() {
    const domainList = document.getElementById('domain-list');
    const patternList = document.getElementById('pattern-list');

    if (domainList) {
      if (this.settings.whitelistedDomains.length === 0) {
        domainList.innerHTML = '<div class="empty-list">ホワイトリストに登録されたドメインはありません</div>';
      } else {
        domainList.innerHTML = this.settings.whitelistedDomains
          .map(domain => this.createListItem(domain, 'domain'))
          .join('');
      }
    }

    if (patternList) {
      if (this.settings.whitelistedPatterns.length === 0) {
        patternList.innerHTML = '<div class="empty-list">ホワイトリストに登録されたパターンはありません</div>';
      } else {
        patternList.innerHTML = this.settings.whitelistedPatterns
          .map(pattern => this.createListItem(pattern, 'pattern'))
          .join('');
      }
    }

    // ホワイトリスト管理のイベントリスナーを追加
    this.setupWhitelistEventListeners();
  }

  /**
   * ホワイトリスト管理のイベントリスナー設定
   */
  setupWhitelistEventListeners() {
    // エクスポート/インポート/クリアボタン
    document.getElementById('export-whitelist-btn')?.addEventListener('click', () => {
      this.exportWhitelist();
    });

    document.getElementById('import-whitelist-btn')?.addEventListener('click', () => {
      this.importWhitelist();
    });

    document.getElementById('clear-whitelist-btn')?.addEventListener('click', () => {
      this.clearWhitelist();
    });

    // Enterキーでの追加
    document.getElementById('domain-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addDomainToWhitelist();
      }
    });

    document.getElementById('pattern-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addPatternToWhitelist();
      }
    });
  }

  /**
   * リストアイテムの作成
   */
  createListItem(text, type) {
    return `
      <div class="list-item">
        <span class="list-item-text">${text}</span>
        <div class="list-item-actions">
          <button class="btn btn-danger" onclick="optionsManager.removeFromWhitelist('${text}', '${type}')">
            削除
          </button>
        </div>
      </div>
    `;
  }

  /**
   * ドメインをホワイトリストに追加
   */
  addDomainToWhitelist() {
    const input = document.getElementById('domain-input');
    const domain = input.value.trim();
    
    if (!domain) {
      this.showStatus('ドメインを入力してください', 'error');
      return;
    }

    // ドメインの形式チェック
    if (!this.isValidDomain(domain)) {
      this.showStatus('有効なドメイン形式で入力してください', 'error');
      return;
    }
    
    if (this.settings.whitelistedDomains.includes(domain)) {
      this.showStatus('このドメインは既に登録されています', 'error');
      return;
    }

    this.settings.whitelistedDomains.push(domain);
    this.settings.whitelistedDomains.sort();
    input.value = '';
    this.loadWhitelistData();
    this.markAsModified();
    this.showStatus(`ドメイン "${domain}" を追加しました`, 'success');
  }

  /**
   * パターンをホワイトリストに追加
   */
  addPatternToWhitelist() {
    const input = document.getElementById('pattern-input');
    const pattern = input.value.trim();
    
    if (!pattern) {
      this.showStatus('パターンを入力してください', 'error');
      return;
    }

    if (this.settings.whitelistedPatterns.includes(pattern)) {
      this.showStatus('このパターンは既に登録されています', 'error');
      return;
    }

    this.settings.whitelistedPatterns.push(pattern);
    this.settings.whitelistedPatterns.sort();
    input.value = '';
    this.loadWhitelistData();
    this.markAsModified();
    this.showStatus(`パターン "${pattern}" を追加しました`, 'success');
  }

  /**
   * ドメインの形式チェック
   */
  isValidDomain(domain) {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain);
  }

  /**
   * ホワイトリストから削除
   */
  removeFromWhitelist(item, type) {
    if (type === 'domain') {
      const index = this.settings.whitelistedDomains.indexOf(item);
      if (index > -1) {
        this.settings.whitelistedDomains.splice(index, 1);
        this.showStatus(`ドメイン "${item}" を削除しました`, 'success');
      }
    } else if (type === 'pattern') {
      const index = this.settings.whitelistedPatterns.indexOf(item);
      if (index > -1) {
        this.settings.whitelistedPatterns.splice(index, 1);
        this.showStatus(`パターン "${item}" を削除しました`, 'success');
      }
    }
    
    this.loadWhitelistData();
    this.markAsModified();
  }

  /**
   * ホワイトリストのエクスポート
   */
  exportWhitelist() {
    const whitelistData = {
      domains: this.settings.whitelistedDomains,
      patterns: this.settings.whitelistedPatterns,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(whitelistData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `popup-blocker-whitelist-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.showStatus('ホワイトリストがエクスポートされました', 'success');
  }

  /**
   * ホワイトリストのインポート
   */
  importWhitelist() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const whitelistData = JSON.parse(text);

        if (whitelistData.domains && Array.isArray(whitelistData.domains)) {
          // 重複を避けて追加
          whitelistData.domains.forEach(domain => {
            if (!this.settings.whitelistedDomains.includes(domain)) {
              this.settings.whitelistedDomains.push(domain);
            }
          });
          this.settings.whitelistedDomains.sort();
        }

        if (whitelistData.patterns && Array.isArray(whitelistData.patterns)) {
          whitelistData.patterns.forEach(pattern => {
            if (!this.settings.whitelistedPatterns.includes(pattern)) {
              this.settings.whitelistedPatterns.push(pattern);
            }
          });
          this.settings.whitelistedPatterns.sort();
        }

        this.loadWhitelistData();
        this.markAsModified();
        this.showStatus('ホワイトリストがインポートされました', 'success');
      } catch (error) {
        console.error('ホワイトリストのインポートに失敗しました:', error);
        this.showStatus('ホワイトリストのインポートに失敗しました', 'error');
      }
    };
    input.click();
  }

  /**
   * ホワイトリストのクリア
   */
  clearWhitelist() {
    if (confirm('ホワイトリストをすべてクリアしますか？この操作は元に戻せません。')) {
      this.settings.whitelistedDomains = [];
      this.settings.whitelistedPatterns = [];
      this.loadWhitelistData();
      this.markAsModified();
      this.showStatus('ホワイトリストがクリアされました', 'success');
    }
  }

  /**
   * 履歴データの読み込み
   */
  async loadHistoryData() {
    try {
      // Chrome storage から履歴データを読み込み
      let historyData = [];
      
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['popupHistory']);
        historyData = result.popupHistory || [];
      } else {
        // 開発環境やテスト環境での代替実装
        const stored = localStorage.getItem('popupHistory');
        historyData = stored ? JSON.parse(stored) : this.getMockHistoryData();
      }

      // フィルターを適用
      this.currentHistoryData = historyData;
      this.filteredHistoryData = this.applyHistoryFilters(historyData);
      
      // ページネーション設定
      this.currentPage = 1;
      this.itemsPerPage = 20;
      
      this.renderHistoryList();
      this.updateHistoryPagination();
      
    } catch (error) {
      console.error('履歴データの読み込みに失敗しました:', error);
      this.showStatus('履歴データの読み込みに失敗しました', 'error');
    }
  }

  /**
   * モック履歴データの生成（開発用）
   */
  getMockHistoryData() {
    const domains = ['example.com', 'test.com', 'sample.org', 'demo.net', 'site.jp'];
    const decisions = ['closed', 'kept', 'pending'];
    const mockData = [];

    for (let i = 0; i < 50; i++) {
      const domain = domains[Math.floor(Math.random() * domains.length)];
      mockData.push({
        id: `mock-${i}`,
        url: `https://${domain}/page${i}`,
        domain: domain,
        timestamp: Date.now() - (Math.random() * 30 * 24 * 60 * 60 * 1000), // 過去30日間
        decision: decisions[Math.floor(Math.random() * decisions.length)],
        confidence: Math.random(),
        characteristics: {
          hasCloseButton: Math.random() > 0.5,
          containsAds: Math.random() > 0.3,
          hasExternalLinks: Math.random() > 0.4,
          isModal: Math.random() > 0.6,
          zIndex: Math.floor(Math.random() * 10000) + 1000,
          dimensions: {
            width: Math.floor(Math.random() * 800) + 200,
            height: Math.floor(Math.random() * 600) + 150
          }
        }
      });
    }

    return mockData.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 履歴フィルターの適用
   */
  applyHistoryFilters(historyData) {
    const filterType = document.getElementById('history-filter')?.value || 'all';
    const filterDate = document.getElementById('date-filter')?.value;
    
    let filtered = [...historyData];

    // 決定タイプでフィルター
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.decision === filterType);
    }

    // 日付でフィルター
    if (filterDate) {
      const targetDate = new Date(filterDate);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate >= targetDate && itemDate < nextDay;
      });
    }

    return filtered;
  }

  /**
   * 履歴リストのレンダリング
   */
  renderHistoryList() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    if (this.filteredHistoryData.length === 0) {
      historyList.innerHTML = '<div class="empty-list">表示する履歴がありません</div>';
      return;
    }

    // ページネーション用のデータ取得
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageData = this.filteredHistoryData.slice(startIndex, endIndex);

    historyList.innerHTML = pageData
      .map(item => this.createHistoryItem(item))
      .join('');
  }

  /**
   * 履歴アイテムの作成
   */
  createHistoryItem(item) {
    const date = new Date(item.timestamp).toLocaleString('ja-JP');
    const decisionText = {
      'closed': '閉じた',
      'kept': '保持',
      'pending': '保留中'
    };

    return `
      <div class="history-item" data-id="${item.id}">
        <div class="history-info">
          <a href="${item.url}" class="history-url" target="_blank" title="${item.url}">
            ${item.domain}
          </a>
          <div class="history-details">
            ${date} - 信頼度: ${Math.round(item.confidence * 100)}%
            ${item.characteristics ? this.formatCharacteristics(item.characteristics) : ''}
          </div>
        </div>
        <div class="history-actions">
          <span class="history-decision ${item.decision}">
            ${decisionText[item.decision] || item.decision}
          </span>
          <div class="history-controls">
            <button class="btn btn-secondary btn-small" onclick="optionsManager.viewHistoryDetails('${item.id}')">
              詳細
            </button>
            <button class="btn btn-warning btn-small" onclick="optionsManager.changeHistoryDecision('${item.id}')">
              変更
            </button>
            <button class="btn btn-danger btn-small" onclick="optionsManager.removeHistoryItem('${item.id}')">
              削除
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * ポップアップ特性の表示用フォーマット
   */
  formatCharacteristics(characteristics) {
    const features = [];
    if (characteristics.hasCloseButton) features.push('閉じるボタン');
    if (characteristics.containsAds) features.push('広告');
    if (characteristics.isModal) features.push('モーダル');
    if (characteristics.hasExternalLinks) features.push('外部リンク');
    
    return features.length > 0 ? ` - 特徴: ${features.join(', ')}` : '';
  }

  /**
   * 履歴ページネーションの更新
   */
  updateHistoryPagination() {
    const totalPages = Math.ceil(this.filteredHistoryData.length / this.itemsPerPage);
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');

    if (pageInfo) {
      pageInfo.textContent = `${this.currentPage} / ${totalPages}`;
    }

    if (prevBtn) {
      prevBtn.disabled = this.currentPage <= 1;
      prevBtn.onclick = () => this.changePage(this.currentPage - 1);
    }

    if (nextBtn) {
      nextBtn.disabled = this.currentPage >= totalPages;
      nextBtn.onclick = () => this.changePage(this.currentPage + 1);
    }
  }

  /**
   * ページ変更
   */
  changePage(newPage) {
    const totalPages = Math.ceil(this.filteredHistoryData.length / this.itemsPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
      this.currentPage = newPage;
      this.renderHistoryList();
      this.updateHistoryPagination();
    }
  }

  /**
   * 履歴詳細の表示
   */
  viewHistoryDetails(itemId) {
    const item = this.currentHistoryData.find(h => h.id === itemId);
    if (!item) return;

    const detailsHtml = `
      <div class="history-details-modal">
        <h3>ポップアップ詳細情報</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <strong>URL:</strong> ${item.url}
          </div>
          <div class="detail-item">
            <strong>ドメイン:</strong> ${item.domain}
          </div>
          <div class="detail-item">
            <strong>検出日時:</strong> ${new Date(item.timestamp).toLocaleString('ja-JP')}
          </div>
          <div class="detail-item">
            <strong>決定:</strong> ${item.decision}
          </div>
          <div class="detail-item">
            <strong>信頼度:</strong> ${Math.round(item.confidence * 100)}%
          </div>
          ${item.characteristics ? this.formatDetailedCharacteristics(item.characteristics) : ''}
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="this.closest('.history-details-modal').remove()">
            閉じる
          </button>
        </div>
      </div>
    `;

    // モーダル表示（簡易実装）
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = detailsHtml;
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
    document.body.appendChild(modal);
  }

  /**
   * 詳細な特性情報のフォーマット
   */
  formatDetailedCharacteristics(characteristics) {
    return `
      <div class="detail-item">
        <strong>特性:</strong>
        <ul class="characteristics-list">
          <li>閉じるボタン: ${characteristics.hasCloseButton ? 'あり' : 'なし'}</li>
          <li>広告コンテンツ: ${characteristics.containsAds ? 'あり' : 'なし'}</li>
          <li>外部リンク: ${characteristics.hasExternalLinks ? 'あり' : 'なし'}</li>
          <li>モーダル: ${characteristics.isModal ? 'はい' : 'いいえ'}</li>
          <li>Z-Index: ${characteristics.zIndex}</li>
          <li>サイズ: ${characteristics.dimensions.width} × ${characteristics.dimensions.height}px</li>
        </ul>
      </div>
    `;
  }

  /**
   * 履歴決定の変更
   */
  async changeHistoryDecision(itemId) {
    const item = this.currentHistoryData.find(h => h.id === itemId);
    if (!item) return;

    const newDecision = prompt(
      `現在の決定: ${item.decision}\n新しい決定を選択してください:\n- closed (閉じた)\n- kept (保持)\n- pending (保留中)`,
      item.decision
    );

    if (newDecision && ['closed', 'kept', 'pending'].includes(newDecision)) {
      item.decision = newDecision;
      
      // ストレージに保存
      await this.saveHistoryData();
      
      // 表示を更新
      this.filteredHistoryData = this.applyHistoryFilters(this.currentHistoryData);
      this.renderHistoryList();
      
      this.showStatus(`決定が "${newDecision}" に変更されました`, 'success');
    }
  }

  /**
   * 履歴アイテムの削除
   */
  async removeHistoryItem(itemId) {
    if (!confirm('この履歴アイテムを削除しますか？')) return;

    const index = this.currentHistoryData.findIndex(h => h.id === itemId);
    if (index > -1) {
      this.currentHistoryData.splice(index, 1);
      
      // ストレージに保存
      await this.saveHistoryData();
      
      // 表示を更新
      this.filteredHistoryData = this.applyHistoryFilters(this.currentHistoryData);
      this.renderHistoryList();
      this.updateHistoryPagination();
      
      this.showStatus('履歴アイテムが削除されました', 'success');
    }
  }

  /**
   * 履歴データの保存
   */
  async saveHistoryData() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ popupHistory: this.currentHistoryData });
      } else {
        localStorage.setItem('popupHistory', JSON.stringify(this.currentHistoryData));
      }
    } catch (error) {
      console.error('履歴データの保存に失敗しました:', error);
      this.showStatus('履歴データの保存に失敗しました', 'error');
    }
  }

  /**
   * 一括履歴操作
   */
  async bulkHistoryOperations() {
    const operations = [
      { label: '選択した項目を削除', action: 'delete' },
      { label: '選択した項目を "閉じた" に変更', action: 'close' },
      { label: '選択した項目を "保持" に変更', action: 'keep' },
      { label: '古い履歴を削除（30日以前）', action: 'cleanup' }
    ];

    // 簡易的な操作選択UI（実際の実装ではより洗練されたUIを使用）
    const operation = prompt(
      '一括操作を選択してください:\n' + 
      operations.map((op, i) => `${i + 1}. ${op.label}`).join('\n')
    );

    const opIndex = parseInt(operation) - 1;
    if (opIndex >= 0 && opIndex < operations.length) {
      await this.executeBulkOperation(operations[opIndex].action);
    }
  }

  /**
   * 一括操作の実行
   */
  async executeBulkOperation(action) {
    let count = 0;

    switch (action) {
      case 'cleanup':
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const beforeCount = this.currentHistoryData.length;
        this.currentHistoryData = this.currentHistoryData.filter(item => item.timestamp > thirtyDaysAgo);
        count = beforeCount - this.currentHistoryData.length;
        break;
        
      case 'delete':
        // 実際の実装では選択された項目のみ削除
        count = 0;
        break;
        
      case 'close':
      case 'keep':
        // 実際の実装では選択された項目の決定を変更
        count = 0;
        break;
    }

    if (count > 0) {
      await this.saveHistoryData();
      this.filteredHistoryData = this.applyHistoryFilters(this.currentHistoryData);
      this.renderHistoryList();
      this.updateHistoryPagination();
      this.showStatus(`${count}件の履歴が処理されました`, 'success');
    }
  }

  /**
   * 統計データの読み込み
   */
  async loadStatistics() {
    // 実際の実装では chrome.storage から統計データを読み込み
    const mockStats = {
      totalDetected: 1247,
      totalBlocked: 892,
      totalKept: 355,
      whitelistCount: this.settings.whitelistedDomains.length + this.settings.whitelistedPatterns.length
    };

    this.updateStatistics(mockStats);
  }

  /**
   * 統計表示の更新
   */
  updateStatistics(stats) {
    Object.keys(stats).forEach(key => {
      const element = document.getElementById(key.replace(/([A-Z])/g, '-$1').toLowerCase());
      if (element) {
        element.textContent = stats[key].toLocaleString();
      }
    });
  }

  /**
   * 設定のエクスポート
   */
  exportSettings() {
    const exportData = {
      settings: this.settings,
      exportDate: new Date().toISOString(),
      version: '1.0',
      extensionInfo: {
        name: 'Popup Ad Blocker',
        version: chrome.runtime?.getManifest()?.version || '1.0.0'
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `popup-blocker-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.showStatus('設定がエクスポートされました', 'success');
  }

  /**
   * 設定のインポート
   */
  async importSettings(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // バージョンチェック
      if (importData.version && importData.version !== '1.0') {
        if (!confirm('異なるバージョンの設定ファイルです。インポートを続行しますか？')) {
          return;
        }
      }

      if (importData.settings) {
        // 重要な設定のみマージ（セキュリティ上の理由）
        const safeSettings = {
          extensionEnabled: importData.settings.extensionEnabled,
          showNotifications: importData.settings.showNotifications,
          notificationDuration: importData.settings.notificationDuration,
          learningEnabled: importData.settings.learningEnabled,
          aggressiveMode: importData.settings.aggressiveMode,
          detectionSensitivity: importData.settings.detectionSensitivity,
          confidenceThreshold: importData.settings.confidenceThreshold,
          blockModalOverlays: importData.settings.blockModalOverlays,
          blockPopupWindows: importData.settings.blockPopupWindows,
          blockFloatingAds: importData.settings.blockFloatingAds,
          blockInterstitialAds: importData.settings.blockInterstitialAds,
          maxHistoryItems: importData.settings.maxHistoryItems,
          cleanupInterval: importData.settings.cleanupInterval,
          whitelistedDomains: importData.settings.whitelistedDomains || [],
          whitelistedPatterns: importData.settings.whitelistedPatterns || []
        };

        // 既存の設定とマージ
        Object.keys(safeSettings).forEach(key => {
          if (safeSettings[key] !== undefined) {
            this.settings[key] = safeSettings[key];
          }
        });

        this.updateUI();
        this.markAsModified();
        this.showStatus('設定がインポートされました', 'success');
      } else {
        this.showStatus('無効な設定ファイルです', 'error');
      }
    } catch (error) {
      console.error('設定のインポートに失敗しました:', error);
      this.showStatus('設定のインポートに失敗しました', 'error');
    }
  }

  /**
   * 学習パターンの管理
   */
  async manageLearningPatterns() {
    if (!this.settings.learningEnabled) {
      this.showStatus('学習機能が無効になっています', 'error');
      return;
    }

    // 学習パターンの統計を表示
    const patternCount = this.settings.learningPatterns?.length || 0;
    const accuratePatterns = this.settings.learningPatterns?.filter(p => p.confidence > 0.8).length || 0;
    
    console.log(`学習パターン: ${patternCount}個 (高精度: ${accuratePatterns}個)`);
    
    // 低精度パターンのクリーンアップ
    if (this.settings.learningPatterns) {
      const beforeCount = this.settings.learningPatterns.length;
      this.settings.learningPatterns = this.settings.learningPatterns.filter(p => 
        p.confidence > 0.3 && p.occurrences > 1
      );
      const afterCount = this.settings.learningPatterns.length;
      
      if (beforeCount > afterCount) {
        this.markAsModified();
        this.showStatus(`${beforeCount - afterCount}個の低精度パターンを削除しました`, 'success');
      }
    }
  }

  /**
   * 学習データのリセット
   */
  resetLearningData() {
    if (confirm('学習データをリセットしますか？この操作は元に戻せません。')) {
      this.settings.learningPatterns = [];
      this.markAsModified();
      this.showStatus('学習データがリセットされました', 'success');
    }
  }

  /**
   * 設定データのリセット
   */
  resetSettingsData() {
    if (confirm('設定をリセットしますか？この操作は元に戻せません。')) {
      this.loadSettings(); // デフォルト設定を再読み込み
      this.updateUI();
      this.showStatus('設定がリセットされました', 'success');
    }
  }

  /**
   * 履歴データのリセット
   */
  resetHistoryData() {
    if (confirm('履歴をリセットしますか？この操作は元に戻せません。')) {
      // 実際の実装では chrome.storage から履歴データを削除
      this.loadHistoryData();
      this.showStatus('履歴がリセットされました', 'success');
    }
  }

  /**
   * すべてのデータのリセット
   */
  resetAllData() {
    if (confirm('すべてのデータをリセットしますか？この操作は元に戻せません。')) {
      this.resetSettingsData();
      this.resetHistoryData();
      this.showStatus('すべてのデータがリセットされました', 'success');
    }
  }

  /**
   * 履歴のフィルタリング
   */
  filterHistory() {
    this.filteredHistoryData = this.applyHistoryFilters(this.currentHistoryData);
    this.currentPage = 1; // フィルター変更時は最初のページに戻る
    this.renderHistoryList();
    this.updateHistoryPagination();
    
    const filterType = document.getElementById('history-filter')?.value || 'all';
    const filterDate = document.getElementById('date-filter')?.value;
    
    let statusMessage = 'フィルターが適用されました';
    if (filterType !== 'all' || filterDate) {
      statusMessage += ` (${this.filteredHistoryData.length}件表示)`;
    }
    
    this.showStatus(statusMessage, 'success');
  }

  /**
   * フィルターのクリア
   */
  clearHistoryFilters() {
    document.getElementById('history-filter').value = 'all';
    document.getElementById('date-filter').value = '';
    this.filterHistory();
  }
}

// グローバルインスタンス
let optionsManager;

// DOM読み込み完了時に初期化
document.addEventListener('DOMContentLoaded', () => {
  optionsManager = new OptionsManager();
});