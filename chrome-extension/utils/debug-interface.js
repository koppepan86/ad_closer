/**
 * デバッグインターフェース
 * 開発者向けのデバッグツールとユーザー向けの診断機能
 */

/**
 * デバッグインターフェースクラス
 */
class DebugInterface {
  constructor(logger) {
    this.logger = logger;
    this.debugPanel = null;
    this.isVisible = false;
    this.diagnostics = new Map();
    this.realTimeMonitoring = false;
    this.monitoringInterval = null;
    
    this.initializeDebugInterface();
    this.setupKeyboardShortcuts();
  }

  /**
   * デバッグインターフェースの初期化
   */
  initializeDebugInterface() {
    // デバッグパネルのHTML構造を作成
    this.createDebugPanel();
    
    // イベントリスナーを設定
    this.setupEventListeners();
    
    // 診断機能を初期化
    this.initializeDiagnostics();
  }

  /**
   * デバッグパネルを作成
   */
  createDebugPanel() {
    const panelHTML = `
      <div id="popup-blocker-debug-panel" style="
        position: fixed;
        top: 10px;
        right: 10px;
        width: 400px;
        max-height: 600px;
        background: #1e1e1e;
        color: #ffffff;
        border: 1px solid #444;
        border-radius: 8px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        z-index: 999999;
        display: none;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      ">
        <div style="
          background: #2d2d2d;
          padding: 10px;
          border-bottom: 1px solid #444;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <span style="font-weight: bold;">🔍 ポップアップブロッカー デバッグ</span>
          <button id="debug-panel-close" style="
            background: #ff4444;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
          ">×</button>
        </div>
        
        <div style="padding: 10px; max-height: 500px; overflow-y: auto;">
          <!-- タブナビゲーション -->
          <div id="debug-tabs" style="
            display: flex;
            margin-bottom: 10px;
            border-bottom: 1px solid #444;
          ">
            <button class="debug-tab active" data-tab="logs" style="
              background: #3d3d3d;
              color: white;
              border: none;
              padding: 8px 12px;
              cursor: pointer;
              border-radius: 4px 4px 0 0;
              margin-right: 2px;
            ">ログ</button>
            <button class="debug-tab" data-tab="performance" style="
              background: #2d2d2d;
              color: #ccc;
              border: none;
              padding: 8px 12px;
              cursor: pointer;
              border-radius: 4px 4px 0 0;
              margin-right: 2px;
            ">パフォーマンス</button>
            <button class="debug-tab" data-tab="diagnostics" style="
              background: #2d2d2d;
              color: #ccc;
              border: none;
              padding: 8px 12px;
              cursor: pointer;
              border-radius: 4px 4px 0 0;
              margin-right: 2px;
            ">診断</button>
            <button class="debug-tab" data-tab="errors" style="
              background: #2d2d2d;
              color: #ccc;
              border: none;
              padding: 8px 12px;
              cursor: pointer;
              border-radius: 4px 4px 0 0;
            ">エラー</button>
          </div>

          <!-- ログタブ -->
          <div id="debug-tab-logs" class="debug-tab-content">
            <div style="margin-bottom: 10px;">
              <select id="log-level-filter" style="
                background: #3d3d3d;
                color: white;
                border: 1px solid #555;
                padding: 4px;
                margin-right: 10px;
              ">
                <option value="">全レベル</option>
                <option value="0">DEBUG</option>
                <option value="1">INFO</option>
                <option value="2">WARN</option>
                <option value="3">ERROR</option>
                <option value="4">CRITICAL</option>
              </select>
              
              <select id="log-category-filter" style="
                background: #3d3d3d;
                color: white;
                border: 1px solid #555;
                padding: 4px;
                margin-right: 10px;
              ">
                <option value="">全カテゴリ</option>
                <option value="popup_detection">ポップアップ検出</option>
                <option value="dom_monitoring">DOM監視</option>
                <option value="user_interaction">ユーザー操作</option>
                <option value="communication">通信</option>
                <option value="performance">パフォーマンス</option>
                <option value="error_handling">エラー処理</option>
                <option value="storage">ストレージ</option>
                <option value="system">システム</option>
              </select>
              
              <button id="clear-logs" style="
                background: #ff6600;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
              ">クリア</button>
            </div>
            
            <div id="log-entries" style="
              background: #0d1117;
              padding: 10px;
              border-radius: 4px;
              max-height: 300px;
              overflow-y: auto;
              font-size: 11px;
              line-height: 1.4;
            "></div>
          </div>

          <!-- パフォーマンスタブ -->
          <div id="debug-tab-performance" class="debug-tab-content" style="display: none;">
            <div style="margin-bottom: 10px;">
              <button id="start-monitoring" style="
                background: #28a745;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
              ">監視開始</button>
              
              <button id="stop-monitoring" style="
                background: #dc3545;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
              ">監視停止</button>
              
              <button id="export-metrics" style="
                background: #007bff;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
              ">エクスポート</button>
            </div>
            
            <div id="performance-metrics" style="
              background: #0d1117;
              padding: 10px;
              border-radius: 4px;
              max-height: 300px;
              overflow-y: auto;
              font-size: 11px;
            "></div>
          </div>

          <!-- 診断タブ -->
          <div id="debug-tab-diagnostics" class="debug-tab-content" style="display: none;">
            <div style="margin-bottom: 10px;">
              <button id="run-diagnostics" style="
                background: #17a2b8;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
              ">診断実行</button>
              
              <button id="health-check" style="
                background: #28a745;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
              ">ヘルスチェック</button>
            </div>
            
            <div id="diagnostics-results" style="
              background: #0d1117;
              padding: 10px;
              border-radius: 4px;
              max-height: 300px;
              overflow-y: auto;
              font-size: 11px;
            "></div>
          </div>

          <!-- エラータブ -->
          <div id="debug-tab-errors" class="debug-tab-content" style="display: none;">
            <div style="margin-bottom: 10px;">
              <button id="export-error-report" style="
                background: #6f42c1;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 10px;
              ">エラーレポート</button>
              
              <button id="clear-errors" style="
                background: #dc3545;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
              ">エラークリア</button>
            </div>
            
            <div id="error-reports" style="
              background: #0d1117;
              padding: 10px;
              border-radius: 4px;
              max-height: 300px;
              overflow-y: auto;
              font-size: 11px;
            "></div>
          </div>
        </div>
      </div>
    `;

    // パネルをDOMに追加
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = panelHTML;
    this.debugPanel = tempDiv.firstElementChild;
    document.body.appendChild(this.debugPanel);
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    // パネルを閉じる
    const closeButton = this.debugPanel.querySelector('#debug-panel-close');
    closeButton.addEventListener('click', () => this.hideDebugPanel());

    // タブ切り替え
    const tabs = this.debugPanel.querySelectorAll('.debug-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // ログフィルター
    const levelFilter = this.debugPanel.querySelector('#log-level-filter');
    const categoryFilter = this.debugPanel.querySelector('#log-category-filter');
    levelFilter.addEventListener('change', () => this.updateLogDisplay());
    categoryFilter.addEventListener('change', () => this.updateLogDisplay());

    // ボタンイベント
    this.debugPanel.querySelector('#clear-logs').addEventListener('click', () => this.clearLogs());
    this.debugPanel.querySelector('#start-monitoring').addEventListener('click', () => this.startRealTimeMonitoring());
    this.debugPanel.querySelector('#stop-monitoring').addEventListener('click', () => this.stopRealTimeMonitoring());
    this.debugPanel.querySelector('#export-metrics').addEventListener('click', () => this.exportMetrics());
    this.debugPanel.querySelector('#run-diagnostics').addEventListener('click', () => this.runDiagnostics());
    this.debugPanel.querySelector('#health-check').addEventListener('click', () => this.runHealthCheck());
    this.debugPanel.querySelector('#export-error-report').addEventListener('click', () => this.exportErrorReport());
    this.debugPanel.querySelector('#clear-errors').addEventListener('click', () => this.clearErrors());
  }

  /**
   * キーボードショートカットを設定
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+D でデバッグパネルを切り替え
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.toggleDebugPanel();
      }
    });
  }

  /**
   * 診断機能を初期化
   */
  initializeDiagnostics() {
    // DOM状態診断
    this.diagnostics.set('dom_state', () => this.diagnoseDOMState());
    
    // 拡張機能状態診断
    this.diagnostics.set('extension_state', () => this.diagnoseExtensionState());
    
    // パフォーマンス診断
    this.diagnostics.set('performance', () => this.diagnosePerformance());
    
    // 通信状態診断
    this.diagnostics.set('communication', () => this.diagnoseCommunication());
    
    // ストレージ状態診断
    this.diagnostics.set('storage', () => this.diagnoseStorage());
  }

  /**
   * デバッグパネルを表示/非表示切り替え
   */
  toggleDebugPanel() {
    if (this.isVisible) {
      this.hideDebugPanel();
    } else {
      this.showDebugPanel();
    }
  }

  /**
   * デバッグパネルを表示
   */
  showDebugPanel() {
    this.debugPanel.style.display = 'block';
    this.isVisible = true;
    this.updateLogDisplay();
    this.updatePerformanceDisplay();
    this.updateErrorDisplay();
  }

  /**
   * デバッグパネルを非表示
   */
  hideDebugPanel() {
    this.debugPanel.style.display = 'none';
    this.isVisible = false;
    this.stopRealTimeMonitoring();
  }

  /**
   * タブを切り替え
   */
  switchTab(tabName) {
    // すべてのタブを非アクティブに
    const tabs = this.debugPanel.querySelectorAll('.debug-tab');
    const contents = this.debugPanel.querySelectorAll('.debug-tab-content');
    
    tabs.forEach(tab => {
      tab.style.background = '#2d2d2d';
      tab.style.color = '#ccc';
      tab.classList.remove('active');
    });
    
    contents.forEach(content => {
      content.style.display = 'none';
    });

    // 選択されたタブをアクティブに
    const activeTab = this.debugPanel.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = this.debugPanel.querySelector(`#debug-tab-${tabName}`);
    
    if (activeTab && activeContent) {
      activeTab.style.background = '#3d3d3d';
      activeTab.style.color = 'white';
      activeTab.classList.add('active');
      activeContent.style.display = 'block';

      // タブ固有の更新処理
      switch (tabName) {
        case 'logs':
          this.updateLogDisplay();
          break;
        case 'performance':
          this.updatePerformanceDisplay();
          break;
        case 'diagnostics':
          this.updateDiagnosticsDisplay();
          break;
        case 'errors':
          this.updateErrorDisplay();
          break;
      }
    }
  }

  /**
   * ログ表示を更新
   */
  updateLogDisplay() {
    const levelFilter = this.debugPanel.querySelector('#log-level-filter').value;
    const categoryFilter = this.debugPanel.querySelector('#log-category-filter').value;
    const logEntries = this.debugPanel.querySelector('#log-entries');

    const level = levelFilter ? parseInt(levelFilter) : null;
    const category = categoryFilter || null;

    const logs = this.logger.getLogs(category, level);
    const recentLogs = logs.slice(-50); // 最新50件

    logEntries.innerHTML = recentLogs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      const levelName = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'][log.level];
      const levelColor = ['#888', '#4CAF50', '#FF9800', '#F44336', '#9C27B0'][log.level];
      
      return `
        <div style="margin-bottom: 8px; padding: 6px; background: #161b22; border-radius: 4px; border-left: 3px solid ${levelColor};">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: ${levelColor}; font-weight: bold;">[${levelName}]</span>
            <span style="color: #7d8590; font-size: 10px;">${timestamp}</span>
          </div>
          <div style="color: #c9d1d9; margin-bottom: 4px;">
            <strong>${log.category}:</strong> ${log.message}
          </div>
          ${Object.keys(log.data).length > 0 ? `
            <details style="color: #7d8590; font-size: 10px;">
              <summary style="cursor: pointer;">データを表示</summary>
              <pre style="margin: 4px 0; white-space: pre-wrap;">${JSON.stringify(log.data, null, 2)}</pre>
            </details>
          ` : ''}
        </div>
      `;
    }).join('');

    // 最新ログまでスクロール
    logEntries.scrollTop = logEntries.scrollHeight;
  }

  /**
   * パフォーマンス表示を更新
   */
  updatePerformanceDisplay() {
    const metricsContainer = this.debugPanel.querySelector('#performance-metrics');
    const metrics = this.logger.getPerformanceMetrics();

    const metricsHTML = Object.entries(metrics).map(([name, data]) => {
      return `
        <div style="margin-bottom: 12px; padding: 8px; background: #161b22; border-radius: 4px;">
          <div style="color: #58a6ff; font-weight: bold; margin-bottom: 4px;">${name}</div>
          <div style="color: #c9d1d9; font-size: 11px;">
            <div>回数: ${data.count}</div>
            <div>平均: ${data.average.toFixed(2)}ms</div>
            ${data.latest ? `<div>最新: ${new Date(data.latest.timestamp).toLocaleTimeString()}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    metricsContainer.innerHTML = metricsHTML || '<div style="color: #7d8590;">パフォーマンスデータがありません</div>';
  }

  /**
   * 診断表示を更新
   */
  updateDiagnosticsDisplay() {
    const diagnosticsContainer = this.debugPanel.querySelector('#diagnostics-results');
    diagnosticsContainer.innerHTML = '<div style="color: #7d8590;">診断を実行してください</div>';
  }

  /**
   * エラー表示を更新
   */
  updateErrorDisplay() {
    const errorContainer = this.debugPanel.querySelector('#error-reports');
    const errorReports = this.logger.getErrorReports();

    const errorsHTML = errorReports.slice(-20).map(report => {
      const timestamp = new Date(report.timestamp).toLocaleTimeString();
      
      return `
        <div style="margin-bottom: 12px; padding: 8px; background: #161b22; border-radius: 4px; border-left: 3px solid #F44336;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #F44336; font-weight: bold;">エラー</span>
            <span style="color: #7d8590; font-size: 10px;">${timestamp}</span>
          </div>
          <div style="color: #c9d1d9; margin-bottom: 4px;">${report.message}</div>
          <div style="color: #58a6ff; font-size: 11px; margin-bottom: 4px;">${report.userFriendlyMessage}</div>
          <details style="color: #7d8590; font-size: 10px;">
            <summary style="cursor: pointer;">回復アクション</summary>
            <ul style="margin: 4px 0; padding-left: 16px;">
              ${report.recoveryActions.map(action => `
                <li style="margin: 2px 0;">
                  <strong>${action.priority}:</strong> ${action.description}
                </li>
              `).join('')}
            </ul>
          </details>
        </div>
      `;
    }).join('');

    errorContainer.innerHTML = errorsHTML || '<div style="color: #7d8590;">エラーレポートがありません</div>';
  }

  /**
   * リアルタイム監視を開始
   */
  startRealTimeMonitoring() {
    if (this.realTimeMonitoring) return;

    this.realTimeMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      if (this.isVisible) {
        const activeTab = this.debugPanel.querySelector('.debug-tab.active');
        if (activeTab) {
          const tabName = activeTab.dataset.tab;
          switch (tabName) {
            case 'logs':
              this.updateLogDisplay();
              break;
            case 'performance':
              this.updatePerformanceDisplay();
              break;
            case 'errors':
              this.updateErrorDisplay();
              break;
          }
        }
      }
    }, 1000);

    this.debugPanel.querySelector('#start-monitoring').style.background = '#6c757d';
    this.debugPanel.querySelector('#stop-monitoring').style.background = '#dc3545';
  }

  /**
   * リアルタイム監視を停止
   */
  stopRealTimeMonitoring() {
    if (!this.realTimeMonitoring) return;

    this.realTimeMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.debugPanel.querySelector('#start-monitoring').style.background = '#28a745';
    this.debugPanel.querySelector('#stop-monitoring').style.background = '#6c757d';
  }

  /**
   * ログをクリア
   */
  clearLogs() {
    this.logger.clearLogs();
    this.updateLogDisplay();
  }

  /**
   * メトリクスをエクスポート
   */
  exportMetrics() {
    const metrics = this.logger.getPerformanceMetrics();
    const exportData = {
      timestamp: Date.now(),
      url: location.href,
      metrics: metrics
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `popup-blocker-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 診断を実行
   */
  async runDiagnostics() {
    const diagnosticsContainer = this.debugPanel.querySelector('#diagnostics-results');
    diagnosticsContainer.innerHTML = '<div style="color: #58a6ff;">診断実行中...</div>';

    const results = {};
    
    for (const [name, diagnostic] of this.diagnostics.entries()) {
      try {
        results[name] = await diagnostic();
      } catch (error) {
        results[name] = { error: error.message };
      }
    }

    const resultsHTML = Object.entries(results).map(([name, result]) => {
      const status = result.error ? '❌' : (result.status === 'ok' ? '✅' : '⚠️');
      const statusColor = result.error ? '#F44336' : (result.status === 'ok' ? '#4CAF50' : '#FF9800');
      
      return `
        <div style="margin-bottom: 12px; padding: 8px; background: #161b22; border-radius: 4px; border-left: 3px solid ${statusColor};">
          <div style="color: ${statusColor}; font-weight: bold; margin-bottom: 4px;">
            ${status} ${name}
          </div>
          <div style="color: #c9d1d9; font-size: 11px;">
            ${result.error ? `エラー: ${result.error}` : result.message || 'OK'}
          </div>
          ${result.details ? `
            <details style="color: #7d8590; font-size: 10px; margin-top: 4px;">
              <summary style="cursor: pointer;">詳細</summary>
              <pre style="margin: 4px 0; white-space: pre-wrap;">${JSON.stringify(result.details, null, 2)}</pre>
            </details>
          ` : ''}
        </div>
      `;
    }).join('');

    diagnosticsContainer.innerHTML = resultsHTML;
  }

  /**
   * ヘルスチェックを実行
   */
  async runHealthCheck() {
    const diagnosticsContainer = this.debugPanel.querySelector('#diagnostics-results');
    
    const healthChecks = [
      { name: 'DOM監視', check: () => this.checkDOMMonitoring() },
      { name: 'ポップアップ検出', check: () => this.checkPopupDetection() },
      { name: '通信状態', check: () => this.checkCommunication() },
      { name: 'ストレージ', check: () => this.checkStorage() },
      { name: 'パフォーマンス', check: () => this.checkPerformance() }
    ];

    let healthHTML = '<div style="color: #58a6ff; margin-bottom: 10px;">ヘルスチェック実行中...</div>';
    diagnosticsContainer.innerHTML = healthHTML;

    for (const healthCheck of healthChecks) {
      try {
        const result = await healthCheck.check();
        const status = result.healthy ? '✅' : '❌';
        const statusColor = result.healthy ? '#4CAF50' : '#F44336';
        
        healthHTML += `
          <div style="margin-bottom: 8px; padding: 6px; background: #161b22; border-radius: 4px; border-left: 3px solid ${statusColor};">
            <span style="color: ${statusColor};">${status} ${healthCheck.name}</span>
            <span style="color: #7d8590; margin-left: 10px;">${result.message}</span>
          </div>
        `;
        
        diagnosticsContainer.innerHTML = healthHTML;
        await new Promise(resolve => setTimeout(resolve, 100)); // 視覚的な遅延
      } catch (error) {
        healthHTML += `
          <div style="margin-bottom: 8px; padding: 6px; background: #161b22; border-radius: 4px; border-left: 3px solid #F44336;">
            <span style="color: #F44336;">❌ ${healthCheck.name}</span>
            <span style="color: #7d8590; margin-left: 10px;">エラー: ${error.message}</span>
          </div>
        `;
        diagnosticsContainer.innerHTML = healthHTML;
      }
    }
  }

  /**
   * エラーレポートをエクスポート
   */
  exportErrorReport() {
    const errorReports = this.logger.getErrorReports();
    const exportData = {
      timestamp: Date.now(),
      url: location.href,
      userAgent: navigator.userAgent,
      errorReports: errorReports,
      logs: this.logger.getLogs().slice(-100), // 最新100件のログ
      performanceMetrics: this.logger.getPerformanceMetrics()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `popup-blocker-error-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * エラーをクリア
   */
  clearErrors() {
    this.logger.errorReports = [];
    this.updateErrorDisplay();
  }

  // 診断関数群

  /**
   * DOM状態を診断
   */
  diagnoseDOMState() {
    const state = this.logger.captureDOMState();
    return {
      status: state.error ? 'error' : 'ok',
      message: state.error ? state.error : 'DOM状態は正常です',
      details: state
    };
  }

  /**
   * 拡張機能状態を診断
   */
  diagnoseExtensionState() {
    const hasChrome = typeof chrome !== 'undefined';
    const hasRuntime = hasChrome && chrome.runtime;
    const hasStorage = hasChrome && chrome.storage;
    
    return {
      status: hasChrome && hasRuntime && hasStorage ? 'ok' : 'error',
      message: hasChrome && hasRuntime && hasStorage ? '拡張機能は正常に動作しています' : '拡張機能APIにアクセスできません',
      details: {
        chrome: hasChrome,
        runtime: hasRuntime,
        storage: hasStorage
      }
    };
  }

  /**
   * パフォーマンスを診断
   */
  diagnosePerformance() {
    const metrics = this.logger.getPerformanceMetrics();
    const memoryMetrics = metrics[window.PERFORMANCE_METRICS?.MEMORY_USAGE];
    
    let status = 'ok';
    let message = 'パフォーマンスは正常です';
    
    if (memoryMetrics && memoryMetrics.latest) {
      const memoryUsage = memoryMetrics.latest.value.usedJSHeapSize / (1024 * 1024); // MB
      if (memoryUsage > 50) {
        status = 'warning';
        message = `メモリ使用量が高めです (${memoryUsage.toFixed(1)}MB)`;
      }
    }
    
    return {
      status,
      message,
      details: metrics
    };
  }

  /**
   * 通信状態を診断
   */
  async diagnoseCommunication() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('タイムアウト')), 5000);
          chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
        
        return {
          status: 'ok',
          message: '通信は正常です'
        };
      } else {
        return {
          status: 'error',
          message: 'Chrome拡張機能APIが利用できません'
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `通信エラー: ${error.message}`
      };
    }
  }

  /**
   * ストレージ状態を診断
   */
  async diagnoseStorage() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const testKey = 'diagnostic_test';
        const testValue = { timestamp: Date.now() };
        
        // 書き込みテスト
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ [testKey]: testValue }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
        
        // 読み込みテスト
        await new Promise((resolve, reject) => {
          chrome.storage.local.get([testKey], (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          });
        });
        
        // クリーンアップ
        chrome.storage.local.remove([testKey]);
        
        return {
          status: 'ok',
          message: 'ストレージは正常です'
        };
      } else {
        return {
          status: 'error',
          message: 'ストレージAPIが利用できません'
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `ストレージエラー: ${error.message}`
      };
    }
  }

  // ヘルスチェック関数群

  checkDOMMonitoring() {
    const hasObserver = typeof window !== 'undefined' && window.popupDetector && window.popupDetector.observer;
    return {
      healthy: hasObserver,
      message: hasObserver ? 'DOM監視は動作中です' : 'DOM監視が停止しています'
    };
  }

  checkPopupDetection() {
    const hasDetector = typeof window !== 'undefined' && window.popupDetector;
    return {
      healthy: hasDetector,
      message: hasDetector ? 'ポップアップ検出は動作中です' : 'ポップアップ検出が無効です'
    };
  }

  async checkCommunication() {
    try {
      const result = await this.diagnoseCommunication();
      return {
        healthy: result.status === 'ok',
        message: result.message
      };
    } catch (error) {
      return {
        healthy: false,
        message: `通信チェック失敗: ${error.message}`
      };
    }
  }

  async checkStorage() {
    try {
      const result = await this.diagnoseStorage();
      return {
        healthy: result.status === 'ok',
        message: result.message
      };
    } catch (error) {
      return {
        healthy: false,
        message: `ストレージチェック失敗: ${error.message}`
      };
    }
  }

  checkPerformance() {
    const result = this.diagnosePerformance();
    return {
      healthy: result.status !== 'error',
      message: result.message
    };
  }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DebugInterface };
} else if (typeof window !== 'undefined') {
  window.DebugInterface = DebugInterface;
}