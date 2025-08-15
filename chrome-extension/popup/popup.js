// ポップアップ広告ブロッカー拡張機能 - ポップアップインターフェース JavaScript

// エラーハンドリングシステムを読み込み
(function() {
  const scripts = [
    'utils/error-handler.js',
    'utils/communication-error-handler.js',
    'utils/permission-error-handler.js',
    'utils/component-recovery.js'
  ];
  
  scripts.forEach(scriptPath => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(scriptPath);
    document.head.appendChild(script);
  });
})();

/**
 * ポップアップインターフェースの初期化と管理
 */
class PopupInterface {
  constructor() {
    this.elements = {};
    this.currentTab = null;
    this.init();
  }

  /**
   * インターフェースの初期化
   */
  async init() {
    try {
      // Notify background script that popup was opened (user interaction)
      this.notifyUserInteraction('popup_opened');
      
      // DOM要素の取得
      this.elements = {
        extensionToggle: document.getElementById('extension-toggle'),
        statusText: document.getElementById('status-text'),
        totalBlocked: document.getElementById('total-blocked'),
        todayBlocked: document.getElementById('today-blocked'),
        currentSiteBlocked: document.getElementById('current-site-blocked'),
        currentDomain: document.getElementById('current-domain'),
        whitelistBtn: document.getElementById('whitelist-btn'),
        activityList: document.getElementById('activity-list'),
        settingsBtn: document.getElementById('settings-btn'),
        toggleSlider: document.querySelector('.toggle-slider')
      };

      // DOM要素の存在確認とデバッグ情報
      console.log('DOM要素の取得結果:', {
        extensionToggle: !!this.elements.extensionToggle,
        statusText: !!this.elements.statusText,
        toggleSlider: !!this.elements.toggleSlider
      });

      if (!this.elements.extensionToggle) {
        console.error('拡張機能トグルボタンが見つかりません');
        throw new Error('必要なDOM要素が見つかりません: extension-toggle');
      }

      // 現在のタブ情報を取得
      await this.getCurrentTab();
      
      // イベントリスナーの設定
      this.setupEventListeners();
      
      // データの読み込み
      await this.loadData();
      
      // 定期更新を開始
      this.startStatusUpdates();
      
      console.log('ポップアップインターフェースが初期化されました');
    } catch (error) {
      console.error('ポップアップインターフェースの初期化エラー:', error);
      this.showError('インターフェースの初期化に失敗しました');
    }
  }

  /**
   * クリーンアップ処理
   */
  cleanup() {
    this.stopStatusUpdates();
  }

  /**
   * 現在のタブ情報を取得
   */
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      
      if (tab && tab.url) {
        const url = new URL(tab.url);
        this.elements.currentDomain.textContent = url.hostname;
      } else {
        this.elements.currentDomain.textContent = '不明なドメイン';
      }
    } catch (error) {
      console.error('タブ情報の取得エラー:', error);
      this.elements.currentDomain.textContent = 'エラー';
    }
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // 拡張機能トグル
    if (this.elements.extensionToggle) {
      this.elements.extensionToggle.addEventListener('change', (e) => {
        console.log('拡張機能トグルボタンがクリックされました:', e.target.checked);
        this.notifyUserInteraction('toggle_extension');
        this.toggleExtension(e.target.checked);
      });
      console.log('拡張機能トグルのイベントリスナーが設定されました');
    } else {
      console.error('拡張機能トグルボタンが見つからないため、イベントリスナーを設定できません');
    }

    // トグルスライダーのキーボード操作
    if (this.elements.toggleSlider) {
      this.elements.toggleSlider.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          console.log('キーボードで拡張機能トグルが操作されました');
          this.notifyUserInteraction('keyboard_toggle');
          this.elements.extensionToggle.click();
        }
      });
      console.log('トグルスライダーのキーボードイベントリスナーが設定されました');
    }

    // ホワイトリストボタン
    this.elements.whitelistBtn.addEventListener('click', () => {
      this.notifyUserInteraction('whitelist_button');
      this.toggleWhitelist();
    });

    // 設定ボタン
    this.elements.settingsBtn.addEventListener('click', () => {
      this.notifyUserInteraction('settings_button');
      this.openSettings();
    });

    // キーボードナビゲーション
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardNavigation(e);
    });
  }

  /**
   * データの読み込み
   */
  async loadData() {
    console.log('ポップアップデータの読み込みを開始...');
    
    try {
      // ユーザー設定を取得
      console.log('ユーザー設定を取得中...');
      const preferences = await this.getUserPreferences();
      console.log('取得したユーザー設定:', preferences);
      
      // 拡張機能の状態を更新
      const isEnabled = preferences.extensionEnabled !== false; // デフォルトは有効
      console.log('拡張機能の状態:', isEnabled);
      this.updateExtensionStatus(isEnabled);
      
      // 統計を更新
      console.log('統計を更新中...');
      await this.updateStatistics(preferences.statistics || {});
      
      // ホワイトリスト状態を更新
      console.log('ホワイトリスト状態を更新中...');
      await this.updateWhitelistStatus(preferences.whitelistedDomains || []);
      
      // 最近のアクティビティを更新
      console.log('最近のアクティビティを更新中...');
      await this.updateRecentActivity();
      
      console.log('ポップアップデータの読み込みが完了しました');
      
    } catch (error) {
      console.error('データ読み込みエラー:', error);
      console.error('エラーの詳細:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      this.showError(`データの読み込みに失敗しました: ${error.message}`);
    }
  }

  /**
   * ユーザーインタラクションを通知
   */
  async notifyUserInteraction(interactionType, data = {}) {
    try {
      await chrome.runtime.sendMessage({
        type: 'user_interaction',
        interactionType: interactionType,
        data: {
          ...data,
          timestamp: Date.now(),
          source: 'popup'
        }
      });
      console.log(`User interaction notified: ${interactionType}`);
    } catch (error) {
      console.error('Failed to notify user interaction:', error);
      // Don't throw - this is not critical for popup functionality
    }
  }

  /**
   * バックグラウンドスクリプトにメッセージを送信
   */
  async sendMessage(type, data = null) {
    try {
      // 通信エラーハンドラーが利用可能な場合は使用
      if (typeof window !== 'undefined' && window.communicationErrorHandler) {
        const response = await window.communicationErrorHandler.sendMessage(
          { type, data },
          {
            timeout: 10000,
            fallback: true,
            callback: (error, result) => {
              if (error) {
                console.error('通信エラー:', error);
              }
            }
          }
        );
        
        if (response && response.success) {
          return response.data;
        } else {
          throw new Error(response?.error || 'メッセージ送信に失敗しました');
        }
      }
      
      // フォールバック: 従来の方法
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type, data }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || 'メッセージ送信に失敗しました'));
          }
        });
      });
    } catch (error) {
      // エラーハンドラーに報告
      if (typeof window !== 'undefined' && window.globalErrorHandler) {
        window.globalErrorHandler.handleError(
          error,
          window.ERROR_TYPES.COMMUNICATION,
          window.ERROR_SEVERITY.MEDIUM,
          { component: 'popupInterface', operation: 'sendMessage', messageType: type }
        );
      }
      
      throw error;
    }
  }

  /**
   * ユーザー設定を取得
   */
  async getUserPreferences() {
    try {
      return await this.sendMessage('GET_USER_PREFERENCES');
    } catch (error) {
      console.error('ユーザー設定取得エラー:', error);
      // フォールバック: ローカルストレージから直接取得
      return await this.getStorageData(['userPreferences']).then(result => 
        result.userPreferences || {}
      );
    }
  }

  /**
   * ストレージからデータを取得（フォールバック用）
   */
  async getStorageData(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  /**
   * ストレージにデータを保存（フォールバック用）
   */
  async setStorageData(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve);
    });
  }

  /**
   * 拡張機能の有効/無効を切り替え
   */
  async toggleExtension(enabled) {
    console.log(`拡張機能の切り替えを開始: ${enabled ? '有効' : '無効'}`);
    
    try {
      // 現在の設定を取得
      console.log('現在のユーザー設定を取得中...');
      const preferences = await this.getUserPreferences();
      console.log('取得した設定:', preferences);
      
      // 設定を更新
      preferences.extensionEnabled = enabled;
      console.log('更新する設定:', preferences);
      
      // バックグラウンドスクリプトに設定を送信
      console.log('バックグラウンドスクリプトに設定を送信中...');
      await this.sendMessage('UPDATE_USER_PREFERENCES', preferences);
      console.log('設定の送信が完了しました');
      
      // UIを更新
      console.log('UIを更新中...');
      this.updateExtensionStatus(enabled);
      
      // 成功メッセージを表示
      this.showSuccess(`拡張機能を${enabled ? '有効' : '無効'}にしました`);
      console.log(`拡張機能が${enabled ? '有効' : '無効'}になりました`);
      
    } catch (error) {
      console.error('拡張機能切り替えエラー:', error);
      console.error('エラーの詳細:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // UIを元の状態に戻す
      this.elements.extensionToggle.checked = !enabled;
      this.updateExtensionStatus(!enabled);
      
      // エラーメッセージを表示
      this.showError(`設定の保存に失敗しました: ${error.message}`);
    }
  }

  /**
   * 拡張機能の状態を更新
   */
  updateExtensionStatus(enabled) {
    console.log(`拡張機能の状態をUIに反映: ${enabled ? '有効' : '無効'}`);
    
    try {
      // チェックボックスの状態を更新
      if (this.elements.extensionToggle) {
        this.elements.extensionToggle.checked = enabled;
        console.log('チェックボックスの状態を更新しました:', enabled);
      }
      
      // ステータステキストを更新
      if (this.elements.statusText) {
        this.elements.statusText.textContent = enabled ? '有効' : '無効';
        console.log('ステータステキストを更新しました:', enabled ? '有効' : '無効');
      }
      
      // アクセシビリティ属性を更新
      if (this.elements.toggleSlider) {
        this.elements.toggleSlider.setAttribute('aria-checked', enabled.toString());
        console.log('アクセシビリティ属性を更新しました:', enabled);
      }
      
      // コンテナのクラスを更新
      const container = document.getElementById('popup-container');
      if (container) {
        if (enabled) {
          container.classList.remove('extension-disabled');
          console.log('extension-disabledクラスを削除しました');
        } else {
          container.classList.add('extension-disabled');
          console.log('extension-disabledクラスを追加しました');
        }
      }
      
      console.log('拡張機能の状態更新が完了しました');
    } catch (error) {
      console.error('拡張機能状態更新エラー:', error);
    }
  }

  /**
   * 統計を更新
   */
  async updateStatistics(stats) {
    try {
      // バックグラウンドスクリプトから拡張統計を取得
      const statistics = await this.sendMessage('GET_STATISTICS');
      
      // 基本統計を更新
      const totalBlocked = statistics.totalPopupsClosed || 0;
      const todayBlocked = statistics.effectivenessMetrics?.today?.totalClosed || 0;
      const currentSiteBlocked = await this.getCurrentSiteBlockedCount();

      this.elements.totalBlocked.textContent = totalBlocked.toLocaleString();
      this.elements.todayBlocked.textContent = todayBlocked.toLocaleString();
      this.elements.currentSiteBlocked.textContent = currentSiteBlocked.toLocaleString();
      
      // 拡張統計を表示（効果メトリクス）
      await this.updateEffectivenessMetrics(statistics.effectivenessMetrics);
      
      // データ可視化を更新
      await this.updateDataVisualization(statistics);
      
    } catch (error) {
      console.error('統計更新エラー:', error);
      // フォールバック: 渡された統計を使用
      const totalBlocked = stats.totalPopupsClosed || 0;
      this.elements.totalBlocked.textContent = totalBlocked.toLocaleString();
      this.elements.todayBlocked.textContent = '0';
      this.elements.currentSiteBlocked.textContent = '0';
    }
  }

  /**
   * 効果メトリクスを更新
   */
  async updateEffectivenessMetrics(effectivenessMetrics) {
    if (!effectivenessMetrics) return;
    
    try {
      // 効果メトリクス表示エリアを作成または更新
      let metricsSection = document.getElementById('effectiveness-metrics');
      if (!metricsSection) {
        metricsSection = this.createEffectivenessMetricsSection();
        const statisticsSection = document.querySelector('.statistics-section');
        statisticsSection.appendChild(metricsSection);
      }
      
      // 今日の効果メトリクス
      const todayMetrics = effectivenessMetrics.today || {};
      const blockRate = todayMetrics.blockRate || 0;
      const averageResponseTime = todayMetrics.averageResponseTime || 0;
      
      // メトリクス値を更新
      const blockRateElement = metricsSection.querySelector('#block-rate');
      const responseTimeElement = metricsSection.querySelector('#response-time');
      
      if (blockRateElement) {
        blockRateElement.textContent = `${blockRate.toFixed(1)}%`;
      }
      
      if (responseTimeElement) {
        responseTimeElement.textContent = `${(averageResponseTime / 1000).toFixed(1)}秒`;
      }
      
      // トレンド表示を更新
      await this.updateTrendIndicators(effectivenessMetrics);
      
    } catch (error) {
      console.error('効果メトリクス更新エラー:', error);
    }
  }

  /**
   * 効果メトリクスセクションを作成
   */
  createEffectivenessMetricsSection() {
    const section = document.createElement('div');
    section.id = 'effectiveness-metrics';
    section.className = 'effectiveness-metrics';
    
    section.innerHTML = `
      <h3 class="metrics-title">効果メトリクス</h3>
      <div class="metrics-grid">
        <div class="metric-item">
          <span class="metric-number" id="block-rate">0%</span>
          <span class="metric-label">ブロック率</span>
        </div>
        <div class="metric-item">
          <span class="metric-number" id="response-time">0秒</span>
          <span class="metric-label">平均応答時間</span>
        </div>
      </div>
      <div class="trend-indicators" id="trend-indicators">
        <div class="trend-item">
          <span class="trend-label">今週のトレンド:</span>
          <span class="trend-value" id="week-trend">--</span>
        </div>
      </div>
    `;
    
    return section;
  }

  /**
   * トレンド指標を更新
   */
  async updateTrendIndicators(effectivenessMetrics) {
    try {
      const activityTrends = await this.sendMessage('GET_ACTIVITY_TRENDS');
      
      if (activityTrends && activityTrends.trend) {
        const trendElement = document.getElementById('week-trend');
        if (trendElement) {
          const { changePercentage, direction } = activityTrends.trend;
          const trendIcon = direction === 'increasing' ? '↑' : 
                           direction === 'decreasing' ? '↓' : '→';
          const trendColor = direction === 'increasing' ? '#28a745' : 
                            direction === 'decreasing' ? '#dc3545' : '#6c757d';
          
          trendElement.innerHTML = `
            <span style="color: ${trendColor}">
              ${trendIcon} ${Math.abs(changePercentage).toFixed(1)}%
            </span>
          `;
        }
      }
    } catch (error) {
      console.error('トレンド指標更新エラー:', error);
    }
  }

  /**
   * データ可視化を更新
   */
  async updateDataVisualization(statistics) {
    try {
      // 簡単な可視化要素を作成
      let visualizationSection = document.getElementById('data-visualization');
      if (!visualizationSection) {
        visualizationSection = this.createDataVisualizationSection();
        const activitySection = document.querySelector('.recent-activity-section');
        activitySection.parentNode.insertBefore(visualizationSection, activitySection);
      }
      
      // ウェブサイト別統計のトップ5を表示
      await this.updateWebsiteChart(statistics.websiteStatistics);
      
      // 時間別アクティビティを表示
      await this.updateHourlyActivity(statistics.activityTrends);
      
    } catch (error) {
      console.error('データ可視化更新エラー:', error);
    }
  }

  /**
   * データ可視化セクションを作成
   */
  createDataVisualizationSection() {
    const section = document.createElement('section');
    section.id = 'data-visualization';
    section.className = 'data-visualization-section';
    
    section.innerHTML = `
      <h2 class="section-title">データ可視化</h2>
      <div class="visualization-content">
        <div class="chart-container">
          <h3 class="chart-title">トップサイト（ブロック数）</h3>
          <div class="website-chart" id="website-chart">
            <div class="chart-loading">データを読み込み中...</div>
          </div>
        </div>
        <div class="chart-container">
          <h3 class="chart-title">時間別アクティビティ</h3>
          <div class="hourly-chart" id="hourly-chart">
            <div class="chart-loading">データを読み込み中...</div>
          </div>
        </div>
      </div>
    `;
    
    return section;
  }

  /**
   * ウェブサイト別チャートを更新
   */
  async updateWebsiteChart(websiteStatistics) {
    const chartContainer = document.getElementById('website-chart');
    if (!chartContainer || !websiteStatistics) return;
    
    try {
      const topSites = websiteStatistics.slice(0, 5);
      
      if (topSites.length === 0) {
        chartContainer.innerHTML = '<div class="no-data">データがありません</div>';
        return;
      }
      
      const maxBlocked = Math.max(...topSites.map(site => site.totalClosed));
      
      const chartHtml = topSites.map(site => {
        const percentage = maxBlocked > 0 ? (site.totalClosed / maxBlocked) * 100 : 0;
        return `
          <div class="chart-bar">
            <div class="bar-label">${site.domain}</div>
            <div class="bar-container">
              <div class="bar-fill" style="width: ${percentage}%"></div>
              <span class="bar-value">${site.totalClosed}</span>
            </div>
          </div>
        `;
      }).join('');
      
      chartContainer.innerHTML = chartHtml;
    } catch (error) {
      console.error('ウェブサイトチャート更新エラー:', error);
      chartContainer.innerHTML = '<div class="chart-error">チャートの更新に失敗しました</div>';
    }
  }

  /**
   * 時間別アクティビティチャートを更新
   */
  async updateHourlyActivity(activityTrends) {
    const chartContainer = document.getElementById('hourly-chart');
    if (!chartContainer || !activityTrends || !activityTrends.hourlyActivity) return;
    
    try {
      const hourlyData = activityTrends.hourlyActivity;
      const maxActivity = Math.max(...hourlyData.map(h => h.activity));
      
      if (maxActivity === 0) {
        chartContainer.innerHTML = '<div class="no-data">アクティビティデータがありません</div>';
        return;
      }
      
      const chartHtml = hourlyData.map(hourData => {
        const height = maxActivity > 0 ? (hourData.activity / maxActivity) * 100 : 0;
        const opacity = height > 0 ? Math.max(0.3, height / 100) : 0.1;
        
        return `
          <div class="hour-bar" title="${hourData.hour}時: ${hourData.activity}件">
            <div class="hour-fill" style="height: ${height}%; opacity: ${opacity}"></div>
            <div class="hour-label">${hourData.hour}</div>
          </div>
        `;
      }).join('');
      
      chartContainer.innerHTML = `<div class="hourly-bars">${chartHtml}</div>`;
    } catch (error) {
      console.error('時間別アクティビティチャート更新エラー:', error);
      chartContainer.innerHTML = '<div class="chart-error">チャートの更新に失敗しました</div>';
    }
  }

  /**
   * 今日ブロックされたポップアップ数を取得
   */
  async getTodayBlockedCount() {
    try {
      // バックグラウンドスクリプトから統計を取得
      const statistics = await this.sendMessage('GET_STATISTICS');
      
      // 今日の日付を取得
      const today = new Date().toDateString();
      
      // ユーザー決定から今日のブロック数を計算
      const decisions = await this.sendMessage('GET_USER_DECISIONS', {
        startDate: new Date(today).getTime(),
        endDate: new Date(today).getTime() + 24 * 60 * 60 * 1000
      });
      
      return decisions.filter(d => d.decision === 'close').length;
    } catch (error) {
      console.error('今日の統計取得エラー:', error);
      // フォールバック: ローカルストレージから取得
      try {
        const today = new Date().toDateString();
        const data = await this.getStorageData(['dailyStats']);
        const dailyStats = data.dailyStats || {};
        return dailyStats[today] || 0;
      } catch (fallbackError) {
        return 0;
      }
    }
  }

  /**
   * 現在のサイトでブロックされたポップアップ数を取得
   */
  async getCurrentSiteBlockedCount() {
    try {
      if (!this.currentTab || !this.currentTab.url) return 0;
      
      const url = new URL(this.currentTab.url);
      const domain = url.hostname;
      
      // バックグラウンドスクリプトから該当ドメインの決定を取得
      const decisions = await this.sendMessage('GET_USER_DECISIONS', {
        domain: domain
      });
      
      return decisions.filter(d => d.decision === 'close').length;
    } catch (error) {
      console.error('サイト統計取得エラー:', error);
      // フォールバック: ローカルストレージから取得
      try {
        if (!this.currentTab || !this.currentTab.url) return 0;
        
        const url = new URL(this.currentTab.url);
        const domain = url.hostname;
        
        const data = await this.getStorageData(['siteStats']);
        const siteStats = data.siteStats || {};
        return siteStats[domain] || 0;
      } catch (fallbackError) {
        return 0;
      }
    }
  }

  /**
   * ホワイトリスト状態を更新
   */
  async updateWhitelistStatus(whitelistedDomains) {
    if (!this.currentTab || !this.currentTab.url) {
      this.elements.whitelistBtn.disabled = true;
      this.elements.whitelistBtn.textContent = 'ホワイトリストに追加';
      return;
    }

    try {
      const url = new URL(this.currentTab.url);
      const domain = url.hostname;
      
      // バックグラウンドスクリプトから最新の設定を取得
      const preferences = await this.getUserPreferences();
      const currentWhitelistedDomains = preferences.whitelistedDomains || [];
      const isWhitelisted = currentWhitelistedDomains.includes(domain);
      
      this.elements.whitelistBtn.textContent = isWhitelisted ? 
        'ホワイトリストから削除' : 'ホワイトリストに追加';
      this.elements.whitelistBtn.disabled = false;
    } catch (error) {
      console.error('ホワイトリスト状態更新エラー:', error);
      this.elements.whitelistBtn.disabled = true;
    }
  }

  /**
   * ホワイトリストの切り替え
   */
  async toggleWhitelist() {
    if (!this.currentTab || !this.currentTab.url) return;

    const originalText = this.elements.whitelistBtn.textContent;
    
    try {
      // 読み込み状態を表示
      this.showLoading(this.elements.whitelistBtn, originalText);
      this.elements.whitelistBtn.disabled = true;
      
      const url = new URL(this.currentTab.url);
      const domain = url.hostname;
      
      // 現在の設定を取得
      const preferences = await this.getUserPreferences();
      let whitelistedDomains = preferences.whitelistedDomains || [];
      
      const isWhitelisted = whitelistedDomains.includes(domain);
      
      if (isWhitelisted) {
        whitelistedDomains = whitelistedDomains.filter(d => d !== domain);
      } else {
        whitelistedDomains.push(domain);
      }
      
      // 更新された設定を保存
      preferences.whitelistedDomains = whitelistedDomains;
      await this.sendMessage('UPDATE_USER_PREFERENCES', preferences);
      
      await this.updateWhitelistStatus(whitelistedDomains);
      
      this.showSuccess(`${domain}を${isWhitelisted ? '削除' : '追加'}しました`);
      console.log(`${domain}を${isWhitelisted ? '削除' : '追加'}しました`);
    } catch (error) {
      console.error('ホワイトリスト切り替えエラー:', error);
      this.hideLoading(this.elements.whitelistBtn, originalText);
      this.elements.whitelistBtn.disabled = false;
      this.showError('ホワイトリストの更新に失敗しました');
    }
  }

  /**
   * 最近のアクティビティを更新
   */
  async updateRecentActivity() {
    try {
      // バックグラウンドスクリプトからユーザー決定履歴を取得
      const decisions = await this.sendMessage('GET_USER_DECISIONS', { limit: 5 });
      
      if (!decisions || decisions.length === 0) {
        this.elements.activityList.innerHTML = `
          <div class="activity-item">
            <span class="activity-text">最近のアクティビティはありません</span>
          </div>
        `;
        return;
      }
      
      const activityHtml = decisions.map(decision => {
        const action = decision.decision === 'close' ? 'ブロック' : '許可';
        const domain = decision.domain || '不明なドメイン';
        
        return `
          <div class="activity-item">
            <span class="activity-text">
              <span class="activity-action">${action}</span>
              <span class="activity-domain">${domain}</span>
            </span>
            <span class="activity-time">${this.formatTime(decision.timestamp)}</span>
          </div>
        `;
      }).join('');
      
      this.elements.activityList.innerHTML = activityHtml;
    } catch (error) {
      console.error('アクティビティ更新エラー:', error);
      // フォールバック: ローカルストレージから取得を試行
      try {
        const data = await this.getStorageData(['recentActivity']);
        const activities = data.recentActivity || [];
        
        if (activities.length === 0) {
          this.elements.activityList.innerHTML = `
            <div class="activity-item">
              <span class="activity-text">最近のアクティビティはありません</span>
            </div>
          `;
          return;
        }
        
        const activityHtml = activities.slice(0, 5).map(activity => `
          <div class="activity-item">
            <span class="activity-text">
              <span class="activity-action">${activity.action}</span>
              <span class="activity-domain">${activity.domain}</span>
            </span>
            <span class="activity-time">${this.formatTime(activity.timestamp)}</span>
          </div>
        `).join('');
        
        this.elements.activityList.innerHTML = activityHtml;
      } catch (fallbackError) {
        this.elements.activityList.innerHTML = `
          <div class="activity-item">
            <span class="activity-text">アクティビティの読み込みに失敗しました</span>
          </div>
        `;
      }
    }
  }

  /**
   * 時刻をフォーマット
   */
  formatTime(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;
    
    if (diff < 60000) return '今';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
    return time.toLocaleDateString();
  }

  /**
   * 設定ページを開く
   */
  openSettings() {
    try {
      chrome.runtime.openOptionsPage();
      window.close();
    } catch (error) {
      console.error('設定ページ開放エラー:', error);
      // フォールバック: 新しいタブで設定ページを開く
      chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
      window.close();
    }
  }

  /**
   * 拡張機能の状態を定期的に更新
   */
  startStatusUpdates() {
    // 30秒ごとに統計を更新
    this.statusUpdateInterval = setInterval(async () => {
      try {
        const preferences = await this.getUserPreferences();
        await this.updateStatistics(preferences.statistics || {});
        await this.updateRecentActivity();
      } catch (error) {
        console.error('定期更新エラー:', error);
      }
    }, 30000);
  }

  /**
   * 定期更新を停止
   */
  stopStatusUpdates() {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }

  /**
   * キーボードナビゲーション
   */
  handleKeyboardNavigation(e) {
    // Escキーでポップアップを閉じる
    if (e.key === 'Escape') {
      window.close();
    }
  }

  /**
   * エラーメッセージを表示
   */
  showError(message) {
    console.error(message);
    
    // ステータステキストにエラーを表示
    const originalText = this.elements.statusText.textContent;
    const originalColor = this.elements.statusText.style.color;
    
    this.elements.statusText.textContent = 'エラー';
    this.elements.statusText.style.color = '#dc3545';
    
    setTimeout(() => {
      this.elements.statusText.textContent = originalText;
      this.elements.statusText.style.color = originalColor;
    }, 3000);
  }

  /**
   * 読み込み状態を表示
   */
  showLoading(element, originalText) {
    if (element) {
      element.textContent = '読み込み中...';
      element.style.opacity = '0.6';
    }
  }

  /**
   * 読み込み状態を解除
   */
  hideLoading(element, text) {
    if (element) {
      element.textContent = text;
      element.style.opacity = '1';
    }
  }

  /**
   * 成功メッセージを表示
   */
  showSuccess(message) {
    console.log(message);
    
    const originalText = this.elements.statusText.textContent;
    const originalColor = this.elements.statusText.style.color;
    
    this.elements.statusText.textContent = '完了';
    this.elements.statusText.style.color = '#28a745';
    
    setTimeout(() => {
      this.elements.statusText.textContent = originalText;
      this.elements.statusText.style.color = originalColor;
    }, 2000);
  }
}

// ポップアップが読み込まれたときに初期化
let popupInterface = null;

document.addEventListener('DOMContentLoaded', () => {
  popupInterface = new PopupInterface();
});

// ポップアップが閉じられるときのクリーンアップ
window.addEventListener('beforeunload', () => {
  if (popupInterface) {
    popupInterface.cleanup();
  }
});

console.log('ポップアップ広告ブロッカー - ポップアップインターフェースが読み込まれました');  /*
*
   * 通知設定を更新
   */
  async updateNotificationSettings(type, enabled) {
    try {
      console.log(`通知設定を更新: ${type} = ${enabled}`);
      
      const preferences = await this.getUserPreferences();
      
      if (type === 'notifications') {
        preferences.notificationsDisabled = !enabled;
      } else if (type === 'badge') {
        preferences.badgeDisabled = !enabled;
      }
      
      await this.sendMessage('UPDATE_USER_PREFERENCES', preferences);
      
      // 成功メッセージを表示
      this.showSuccess(`${type === 'notifications' ? '通知' : 'バッジ'}設定を更新しました`);
      
      // デバッグ: 設定変更をログ出力
      console.log('通知設定更新完了:', {
        type,
        enabled,
        notificationsDisabled: preferences.notificationsDisabled,
        badgeDisabled: preferences.badgeDisabled
      });
      
    } catch (error) {
      console.error('通知設定の更新エラー:', error);
      this.showError('設定の更新に失敗しました');
    }
  }

  /**
   * バッジトグルの状態を更新
   */
  updateBadgeToggle(preferences) {
    try {
      if (this.elements.badgeToggle) {
        this.elements.badgeToggle.checked = !preferences.badgeDisabled;
      }
      
      console.log('バッジトグルの状態を更新しました:', {
        badge: !preferences.badgeDisabled
      });
    } catch (error) {
      console.error('バッジトグル更新エラー:', error);
    }
  }